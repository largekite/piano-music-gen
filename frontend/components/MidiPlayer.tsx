'use client';

import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';

interface MidiPlayerProps {
  midiUrl: string;
  filename: string;
}

export default function MidiPlayer({ midiUrl, filename }: MidiPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const synthRef = useRef<Tone.PolySynth | null>(null);
  const midiRef = useRef<Midi | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize synthesizer
  useEffect(() => {
    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      volume: -10,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0.3,
        release: 1,
      },
    }).toDestination();

    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
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
      synthRef.current.volume.value = (volume - 100) / 4;
    }
  }, [volume]);

  const handlePlayPause = async () => {
    if (!midiRef.current || !synthRef.current) return;

    if (isPlaying) {
      // Pause
      Tone.Transport.pause();
      setIsPlaying(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    } else {
      // Play
      await Tone.start();

      // Clear previous events
      Tone.Transport.cancel();

      // Schedule all notes
      const now = Tone.now();
      midiRef.current.tracks.forEach((track) => {
        track.notes.forEach((note) => {
          synthRef.current?.triggerAttackRelease(
            note.name,
            note.duration,
            now + note.time
          );
        });
      });

      Tone.Transport.start();
      setIsPlaying(true);

      // Update progress
      progressIntervalRef.current = setInterval(() => {
        const currentTime = Tone.Transport.seconds;
        setProgress(currentTime);

        if (currentTime >= duration) {
          setIsPlaying(false);
          Tone.Transport.stop();
          Tone.Transport.seconds = 0;
          setProgress(0);
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
        }
      }, 100);
    }
  };

  const handleSeek = (newProgress: number) => {
    Tone.Transport.seconds = newProgress;
    setProgress(newProgress);
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
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
      <h3 className="font-bold text-lg text-gray-800">🎹 MIDI Player</h3>

      {/* Controls */}
      <div className="flex items-center space-x-4">
        <button
          onClick={handlePlayPause}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg shadow transition"
        >
          {isPlaying ? '⏸️ Pause' : '▶️ Play'}
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
        <div className="flex items-center space-x-2 w-32">
          <span className="text-sm">🔊</span>
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

      {/* File Info */}
      <div className="text-sm text-gray-600 border-t pt-3">
        <p><strong>File:</strong> {filename}</p>
        <p><strong>Duration:</strong> {formatTime(duration)}</p>
      </div>
    </div>
  );
}
