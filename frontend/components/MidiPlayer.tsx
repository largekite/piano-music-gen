'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import PianoRoll, { PianoNote } from './PianoRoll';

interface MidiPlayerProps {
  midiUrl: string;
  filename: string;
  fileId?: string;
  editable?: boolean;
}

export default function MidiPlayer({ midiUrl, filename, fileId, editable = false }: MidiPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pianoNotes, setPianoNotes] = useState<PianoNote[]>([]);
  const [showPianoRoll, setShowPianoRoll] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [tempo, setTempo] = useState(120);

  const synthRef = useRef<Tone.PolySynth | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const compressorRef = useRef<Tone.Compressor | null>(null);
  const midiRef = useRef<Midi | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Initialize a more piano-like synthesizer
  useEffect(() => {
    const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).toDestination();
    reverbRef.current = reverb;
    const compressor = new Tone.Compressor(-20, 4).connect(reverb);
    compressorRef.current = compressor;

    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      volume: -8,
      oscillator: {
        type: 'fmtriangle',
        modulationType: 'sine',
        harmonicity: 3.01,
        modulationIndex: 14,
      },
      envelope: {
        attack: 0.005,
        decay: 0.3,
        sustain: 0.2,
        release: 1.5,
      },
    }).connect(compressor);

    return () => {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      if (synthRef.current) synthRef.current.dispose();
      if (reverbRef.current) reverbRef.current.dispose();
      if (compressorRef.current) compressorRef.current.dispose();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  // Load MIDI file
  useEffect(() => {
    async function loadMidi() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(midiUrl);
        if (!response.ok) {
          throw new Error(`Failed to load MIDI file: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const midi = new Midi(arrayBuffer);
        midiRef.current = midi;
        setDuration(midi.duration);

        if (midi.header.tempos.length > 0) {
          setTempo(Math.round(midi.header.tempos[0].bpm));
        }

        // Extract notes for piano roll
        const extractedNotes: PianoNote[] = [];
        midi.tracks.forEach((track, trackIdx) => {
          track.notes.forEach((note) => {
            extractedNotes.push({
              midi: note.midi,
              time: note.time,
              duration: note.duration,
              velocity: Math.round(note.velocity * 127),
              track: trackIdx,
            });
          });
        });
        extractedNotes.sort((a, b) => a.time - b.time);
        setPianoNotes(extractedNotes);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading MIDI:', err);
        setError(err instanceof Error ? err.message : 'Failed to load MIDI file');
        setIsLoading(false);
      }
    }

    loadMidi();
  }, [midiUrl]);

  // Update volume
  useEffect(() => {
    if (synthRef.current) {
      synthRef.current.volume.value = (volume - 100) / 3;
    }
  }, [volume]);

  const stopPlayback = useCallback(() => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    setIsPlaying(false);
    setProgress(0);
    startTimeRef.current = 0;
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const handlePlayPause = async () => {
    if (!synthRef.current) return;

    if (isPlaying) {
      Tone.Transport.pause();
      setIsPlaying(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    } else {
      await Tone.start();
      Tone.Transport.cancel();

      const notesToPlay = pianoNotes.length > 0 ? pianoNotes : [];
      const playDuration = pianoNotes.length > 0
        ? Math.max(...pianoNotes.map(n => n.time + n.duration))
        : duration;

      const now = Tone.now();
      const offset = progress;
      startTimeRef.current = now - offset;

      notesToPlay.forEach((note) => {
        if (note.time + note.duration > offset) {
          const noteStart = Math.max(0, note.time - offset);
          const noteDur = note.time < offset
            ? note.duration - (offset - note.time)
            : note.duration;

          const vel = (note.velocity || 80) / 127;

          synthRef.current?.triggerAttackRelease(
            Tone.Frequency(note.midi, 'midi').toFrequency(),
            Math.max(0.01, noteDur),
            now + noteStart,
            vel
          );
        }
      });

      Tone.Transport.start(undefined, offset);
      setIsPlaying(true);

      progressIntervalRef.current = setInterval(() => {
        const elapsed = Tone.now() - startTimeRef.current;
        setProgress(elapsed);

        if (elapsed >= playDuration + 0.5) {
          stopPlayback();
        }
      }, 50);
    }
  };

  const handleStop = () => {
    stopPlayback();
    if (synthRef.current) {
      synthRef.current.releaseAll();
    }
  };

  const handleSeek = (newProgress: number) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      handleStop();
    }
    setProgress(newProgress);
  };

  const handleNotesChange = useCallback((newNotes: PianoNote[]) => {
    setPianoNotes(newNotes);
    setSaveMessage(null);
    if (newNotes.length > 0) {
      const maxTime = Math.max(...newNotes.map(n => n.time + n.duration));
      setDuration(maxTime);
    }
  }, []);

  const handleSave = async () => {
    if (!fileId) return;
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/files/${fileId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: pianoNotes.map(n => ({
            midi: n.midi,
            time: n.time,
            duration: n.duration,
            velocity: n.velocity || 80,
          })),
          tempo,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');
      const data = await response.json();
      setSaveMessage(`Saved ${data.note_count} notes`);
    } catch {
      setSaveMessage('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 bg-purple-600 rounded-full animate-bounce"></div>
          <span className="text-gray-600">Loading MIDI player...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800">Error loading MIDI player: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-800">MIDI Player</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPianoRoll(!showPianoRoll)}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                showPianoRoll
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {showPianoRoll ? 'Hide Piano Roll' : 'Show Piano Roll'}
            </button>
            {editable && fileId && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1 rounded text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200 transition disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
        {saveMessage && (
          <p className={`text-xs mt-1 ${saveMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
            {saveMessage}
          </p>
        )}
      </div>

      {/* Piano Roll Visualization */}
      {showPianoRoll && (
        <PianoRoll
          notes={pianoNotes}
          duration={duration || 16}
          currentTime={progress}
          isPlaying={isPlaying}
          editable={editable}
          onNotesChange={editable ? handleNotesChange : undefined}
        />
      )}

      {/* Playback Controls */}
      <div className="p-4 space-y-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={handlePlayPause}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-2 px-5 rounded-lg shadow transition"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          <button
            onClick={handleStop}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg transition"
          >
            Stop
          </button>

          {/* Progress Bar */}
          <div className="flex-1">
            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={progress}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Volume Control */}
          <div className="flex items-center space-x-1 w-28">
            <span className="text-xs text-gray-500">Vol</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
          </div>
        </div>

        {/* File Info & Tempo Control */}
        <div className="flex items-center gap-4 text-xs text-gray-500 border-t pt-2">
          <span>{filename}</span>
          <span>{formatTime(duration)}</span>
          <span>{pianoNotes.length} notes</span>
          {editable ? (
            <div className="flex items-center gap-1">
              <label htmlFor="tempo-ctrl">Tempo:</label>
              <input
                id="tempo-ctrl"
                type="number"
                min="40"
                max="300"
                value={tempo}
                onChange={(e) => setTempo(Math.max(40, Math.min(300, parseInt(e.target.value) || 120)))}
                className="w-14 px-1 py-0.5 bg-gray-100 border rounded text-xs text-gray-700"
              />
              <span>BPM</span>
            </div>
          ) : (
            <span>{tempo} BPM</span>
          )}
        </div>
      </div>
    </div>
  );
}
