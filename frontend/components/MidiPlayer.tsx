'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import PianoRoll, { PianoNote } from './PianoRoll';
import SheetMusic, { KeySignature } from './SheetMusic';
import PracticeMode from './PracticeMode';

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
  const [viewMode, setViewMode] = useState<'piano-roll' | 'sheet' | 'practice' | 'hidden'>('sheet');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [tempo, setTempo] = useState(120);
  const [keySignature, setKeySignature] = useState<KeySignature>('C major');

  const samplerRef = useRef<Tone.Sampler | null>(null);
  const reverbRef = useRef<Tone.Reverb | null>(null);
  const compressorRef = useRef<Tone.Compressor | null>(null);
  const midiRef = useRef<Midi | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const progressRef = useRef<number>(0);
  const [samplerReady, setSamplerReady] = useState(false);

  // Keep progressRef in sync with state
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Create a fresh sampler connected to the effects chain
  const createSynth = useCallback(() => {
    if (samplerRef.current) samplerRef.current.dispose();
    const baseUrl = 'https://tonejs.github.io/audio/salamander/';
    samplerRef.current = new Tone.Sampler({
      urls: {
        A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
        A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
        A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
        A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
        A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
        A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
        A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
        A7: 'A7.mp3', C8: 'C8.mp3',
      },
      release: 1,
      baseUrl,
      onload: () => setSamplerReady(true),
    }).connect(compressorRef.current!);
    samplerRef.current.volume.value = (volume - 100) / 3;
  }, [volume]);

  // Initialize effects chain and sampler
  useEffect(() => {
    const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).toDestination();
    reverbRef.current = reverb;
    const compressor = new Tone.Compressor(-20, 4).connect(reverb);
    compressorRef.current = compressor;

    const baseUrl = 'https://tonejs.github.io/audio/salamander/';
    samplerRef.current = new Tone.Sampler({
      urls: {
        A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
        A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
        A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
        A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
        A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
        A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
        A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
        A7: 'A7.mp3', C8: 'C8.mp3',
      },
      release: 1,
      baseUrl,
      onload: () => setSamplerReady(true),
    }).connect(compressor);

    return () => {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      if (samplerRef.current) samplerRef.current.dispose();
      if (reverbRef.current) reverbRef.current.dispose();
      if (compressorRef.current) compressorRef.current.dispose();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  // Load MIDI file
  useEffect(() => {
    const controller = new AbortController();

    async function loadMidi() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(midiUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to load MIDI file: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        if (controller.signal.aborted) return;

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
        if (controller.signal.aborted) return;
        console.error('Error loading MIDI:', err);
        setError(err instanceof Error ? err.message : 'Failed to load MIDI file');
        setIsLoading(false);
      }
    }

    loadMidi();

    return () => controller.abort();
  }, [midiUrl]);

  // Update volume
  useEffect(() => {
    if (samplerRef.current) {
      samplerRef.current.volume.value = (volume - 100) / 3;
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
    if (!samplerRef.current || !samplerReady) return;

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
      const offset = progressRef.current;
      startTimeRef.current = now - offset;

      notesToPlay.forEach((note) => {
        if (note.time + note.duration > offset) {
          const noteStart = Math.max(0, note.time - offset);
          const noteDur = note.time < offset
            ? note.duration - (offset - note.time)
            : note.duration;

          const vel = (note.velocity || 80) / 127;

          samplerRef.current?.triggerAttackRelease(
            Tone.Frequency(note.midi, 'midi').toNote(),
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
    // Dispose and recreate synth to cancel all scheduled triggerAttackRelease calls
    if (compressorRef.current) {
      createSynth();
    }
  };

  const handleSeek = async (newProgress: number) => {
    const wasPlaying = isPlaying;
    if (wasPlaying) {
      handleStop();
    }
    setProgress(newProgress);
    if (wasPlaying) {
      // Wait a tick for state to settle, then resume from new position
      await new Promise(r => setTimeout(r, 0));
      // Manually trigger play from the new position
      if (!samplerRef.current) return;
      await Tone.start();
      Tone.Transport.cancel();

      const notesToPlay = pianoNotes.length > 0 ? pianoNotes : [];
      const playDuration = pianoNotes.length > 0
        ? Math.max(...pianoNotes.map(n => n.time + n.duration))
        : duration;

      const now = Tone.now();
      startTimeRef.current = now - newProgress;

      notesToPlay.forEach((note) => {
        if (note.time + note.duration > newProgress) {
          const noteStart = Math.max(0, note.time - newProgress);
          const noteDur = note.time < newProgress
            ? note.duration - (newProgress - note.time)
            : note.duration;
          const vel = (note.velocity || 80) / 127;
          samplerRef.current?.triggerAttackRelease(
            Tone.Frequency(note.midi, 'midi').toNote(),
            Math.max(0.01, noteDur),
            now + noteStart,
            vel
          );
        }
      });

      Tone.Transport.start(undefined, newProgress);
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

  const viewModes = [
    { key: 'piano-roll' as const, label: 'Piano Roll' },
    { key: 'sheet' as const, label: 'Sheet' },
    { key: 'practice' as const, label: 'Practice' },
    { key: 'hidden' as const, label: 'Hide' },
  ];

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white/80 backdrop-blur border border-warm-200/60 p-8 shadow-lg shadow-warm-100/50">
        <div className="flex justify-center gap-2.5 mb-2">
          <div className="w-3 h-3 bg-coral-400 rounded-full anim-bounce-1" />
          <div className="w-3 h-3 bg-warm-400 rounded-full anim-bounce-2" />
          <div className="w-3 h-3 bg-coral-400 rounded-full anim-bounce-3" />
        </div>
        <p className="text-center text-sm text-warm-400 font-medium">Loading player...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-coral-50 border border-coral-200 p-6">
        <p className="text-coral-600 text-sm font-medium">{error}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur border border-warm-200/60 shadow-lg shadow-warm-100/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-warm-100/60 bg-warm-50/50">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-extrabold text-sm bg-gradient-to-r from-warm-600 to-coral-500 text-gradient">Player</h3>
          <div className="flex items-center gap-1.5">
            <div className="flex bg-warm-100/80 rounded-xl p-0.5">
              {viewModes.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    viewMode === key
                      ? 'bg-white text-coral-500 shadow-md'
                      : 'text-warm-400 hover:text-warm-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {editable && fileId && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1 rounded-lg text-xs font-bold bg-mint-100 text-mint-500 hover:bg-mint-200 transition disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>
        {saveMessage && (
          <p className={`text-xs mt-1 font-medium ${saveMessage.includes('Failed') ? 'text-coral-600' : 'text-mint-500'}`}>
            {saveMessage}
          </p>
        )}
      </div>

      {/* Views */}
      {viewMode === 'piano-roll' && (
        <PianoRoll
          notes={pianoNotes}
          duration={duration || 16}
          currentTime={progress}
          isPlaying={isPlaying}
          editable={editable}
          onNotesChange={editable ? handleNotesChange : undefined}
        />
      )}

      {viewMode === 'sheet' && (
        <SheetMusic
          notes={pianoNotes}
          tempo={tempo}
          currentTime={progress}
          isPlaying={isPlaying}
          keySignature={keySignature}
          onNotesChange={editable ? handleNotesChange : undefined}
          onKeySignatureChange={setKeySignature}
        />
      )}

      {viewMode === 'practice' && (
        <PracticeMode notes={pianoNotes} tempo={tempo} />
      )}

      {/* Controls */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-coral-400 to-coral-500 hover:from-coral-500 hover:to-coral-600 active:scale-90 text-white flex items-center justify-center transition-all shadow-lg shadow-coral-300/30"
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="2" width="4" height="12" rx="1" />
                <rect x="9" y="2" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2.5v11l9-5.5z" />
              </svg>
            )}
          </button>

          {/* Stop */}
          <button
            onClick={handleStop}
            className="w-10 h-10 rounded-full bg-warm-200 hover:bg-warm-300 active:scale-90 text-warm-500 flex items-center justify-center transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="1" y="1" width="10" height="10" rx="1.5" />
            </svg>
          </button>

          {/* Seek */}
          <div className="flex-1">
            <input
              type="range"
              min="0"
              max={duration}
              step="0.1"
              value={progress}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-warm-400 mt-1 font-medium">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-1.5 w-28">
            <svg className="w-4 h-4 text-warm-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
            </svg>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-4 text-xs text-warm-400 border-t border-warm-100/60 pt-2 font-medium">
          <span className="font-bold text-warm-500">{filename}</span>
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
                className="w-14 px-1.5 py-0.5 bg-warm-50 border border-warm-200 rounded-lg text-xs text-warm-600 focus:ring-2 focus:ring-coral-300 focus:border-transparent outline-none"
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
