'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import type { PianoNote } from './PianoRoll';

interface PracticeModeProps {
  notes: PianoNote[];
  tempo: number;
}

interface NoteEvent {
  midi: number;
  beat: number;
  duration: number;
  name: string;
}

interface FeedbackItem {
  expected: NoteEvent;
  played: number | null; // midi number detected, or null if missed
  correct: boolean;
  timestamp: number;
}

// ── Pitch detection via autocorrelation ─────────────────────────

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${octave}`;
}

function frequencyToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function autoCorrelate(buf: any, sampleRate: number): number {
  // Find a good signal level
  let rms = 0;
  for (let i = 0; i < buf.length; i++) {
    rms += buf[i] * buf[i];
  }
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.01) return -1; // too quiet

  // Trim silence from edges
  let r1 = 0;
  let r2 = buf.length - 1;
  const threshold = 0.2;
  for (let i = 0; i < buf.length / 2; i++) {
    if (Math.abs(buf[i]) < threshold) { r1 = i; } else { break; }
  }
  for (let i = 1; i < buf.length / 2; i++) {
    if (Math.abs(buf[buf.length - i]) < threshold) { r2 = buf.length - i; } else { break; }
  }

  const trimmed = buf.slice(r1, r2);
  const size = trimmed.length;

  // Autocorrelation
  const c = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - i; j++) {
      c[i] += trimmed[j] * trimmed[j + i];
    }
  }

  // Find first dip then first peak after it
  let d = 0;
  while (d < size && c[d] > c[d + 1]) d++;

  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < size; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }

  if (maxPos <= 0) return -1;

  // Parabolic interpolation for better precision
  const y1 = c[maxPos - 1] || 0;
  const y2 = c[maxPos];
  const y3 = c[maxPos + 1] || 0;
  const shift = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
  const period = maxPos + (isFinite(shift) ? shift : 0);

  return sampleRate / period;
}

// ── Component ───────────────────────────────────────────────────

export default function PracticeMode({ notes, tempo }: PracticeModeProps) {
  const [isListening, setIsListening] = useState(false);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [detectedMidi, setDetectedMidi] = useState<number | null>(null);
  const [detectedFreq, setDetectedFreq] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [micError, setMicError] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bufRef = useRef<any>(null);
  const holdCountRef = useRef(0);
  const lastDetectedRef = useRef<number | null>(null);

  // Sort notes by time and build the sequence to practice
  const noteSequence: NoteEvent[] = (() => {
    const beatsPerSecond = tempo / 60;
    const sorted = [...notes].sort((a, b) => a.time - b.time);

    // Group notes at the same time (chords) — for now just take single notes
    const seq: NoteEvent[] = [];
    let lastBeat = -1;
    for (const n of sorted) {
      const beat = Math.round(n.time * beatsPerSecond * 4) / 4;
      if (beat === lastBeat) continue; // skip chord duplicates for simplicity
      seq.push({
        midi: n.midi,
        beat,
        duration: n.duration * beatsPerSecond,
        name: midiToName(n.midi),
      });
      lastBeat = beat;
    }
    return seq;
  })();

  const currentNote = noteSequence[currentNoteIndex] || null;

  const stopListening = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsListening(false);
    setDetectedMidi(null);
    setDetectedFreq(null);
  }, []);

  const startListening = useCallback(async () => {
    setMicError(null);
    setFeedback([]);
    setCurrentNoteIndex(0);
    holdCountRef.current = 0;
    lastDetectedRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 4096;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Float32Array(analyser.fftSize);
      bufRef.current = buf;

      setIsListening(true);
      setIsWaiting(true);
    } catch {
      setMicError('Could not access microphone. Please allow microphone access and try again.');
    }
  }, []);

  // Detection loop — runs continuously while listening
  useEffect(() => {
    if (!isListening || !analyserRef.current || !bufRef.current) return;

    const detect = () => {
      const analyser = analyserRef.current;
      const buf = bufRef.current;
      const audioCtx = audioCtxRef.current;
      if (!analyser || !buf || !audioCtx) return;

      analyser.getFloatTimeDomainData(buf);
      const freq = autoCorrelate(buf, audioCtx.sampleRate);

      if (freq > 0) {
        const midi = frequencyToMidi(freq);
        // Only accept piano range
        if (midi >= 21 && midi <= 108) {
          setDetectedFreq(Math.round(freq * 10) / 10);
          setDetectedMidi(midi);

          // Require stable detection (same note for a few frames)
          if (midi === lastDetectedRef.current) {
            holdCountRef.current++;
          } else {
            holdCountRef.current = 1;
            lastDetectedRef.current = midi;
          }

          // After 3 consistent frames (~100ms), register as a played note
          if (holdCountRef.current === 3 && currentNote && autoAdvance) {
            const correct = midi === currentNote.midi ||
              midi === currentNote.midi + 12 || midi === currentNote.midi - 12; // allow octave
            const item: FeedbackItem = {
              expected: currentNote,
              played: midi,
              correct,
              timestamp: Date.now(),
            };
            setFeedback(prev => [...prev, item]);
            setCurrentNoteIndex(prev => prev + 1);
            holdCountRef.current = 0;
            lastDetectedRef.current = null;
          }
        }
      } else {
        setDetectedMidi(null);
        setDetectedFreq(null);
        holdCountRef.current = 0;
        lastDetectedRef.current = null;
      }

      rafRef.current = requestAnimationFrame(detect);
    };

    rafRef.current = requestAnimationFrame(detect);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isListening, currentNote, autoAdvance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopListening(); };
  }, [stopListening]);

  const correctCount = feedback.filter(f => f.correct).length;
  const totalPlayed = feedback.length;
  const accuracy = totalPlayed > 0 ? Math.round((correctCount / totalPlayed) * 100) : 0;
  const isDone = currentNoteIndex >= noteSequence.length && noteSequence.length > 0;

  const handleManualCheck = () => {
    if (!currentNote || detectedMidi === null) return;
    const correct = detectedMidi === currentNote.midi ||
      detectedMidi === currentNote.midi + 12 || detectedMidi === currentNote.midi - 12;
    setFeedback(prev => [...prev, {
      expected: currentNote,
      played: detectedMidi,
      correct,
      timestamp: Date.now(),
    }]);
    setCurrentNoteIndex(prev => prev + 1);
    holdCountRef.current = 0;
    lastDetectedRef.current = null;
  };

  const handleSkip = () => {
    if (!currentNote) return;
    setFeedback(prev => [...prev, {
      expected: currentNote,
      played: null,
      correct: false,
      timestamp: Date.now(),
    }]);
    setCurrentNoteIndex(prev => prev + 1);
    holdCountRef.current = 0;
    lastDetectedRef.current = null;
  };

  const handleRestart = () => {
    setCurrentNoteIndex(0);
    setFeedback([]);
    holdCountRef.current = 0;
    lastDetectedRef.current = null;
  };

  if (notes.length === 0) {
    return (
      <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 text-center text-amber-700 text-sm">
        No notes to practice. Generate or compose some music first.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gradient-to-r from-indigo-50 to-purple-50 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">Practice Mode</h3>
          <p className="text-xs text-gray-500">Play the notes on your piano — the mic listens and checks each note</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={e => setAutoAdvance(e.target.checked)}
              className="accent-purple-600"
            />
            Auto-advance
          </label>
          {!isListening ? (
            <button
              onClick={startListening}
              className="px-4 py-1.5 text-sm font-medium bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition"
            >
              Start Practice
            </button>
          ) : (
            <button
              onClick={stopListening}
              className="px-4 py-1.5 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {micError && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-700 text-sm">
          {micError}
        </div>
      )}

      {isListening && (
        <div className="p-4 space-y-4">
          {/* Current note to play */}
          {!isDone && currentNote ? (
            <div className="flex items-center gap-6">
              {/* Expected note */}
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-1">Play this note</div>
                <div className="text-4xl font-bold text-indigo-700">{currentNote.name}</div>
                <div className="text-xs text-gray-400 mt-1">
                  Note {currentNoteIndex + 1} of {noteSequence.length}
                </div>
              </div>

              {/* Arrow */}
              <div className="text-2xl text-gray-300">→</div>

              {/* Detected note */}
              <div className="text-center min-w-[100px]">
                <div className="text-xs text-gray-500 mb-1">Detected</div>
                {detectedMidi !== null ? (
                  <>
                    <div className={`text-4xl font-bold ${
                      detectedMidi === currentNote.midi ||
                      detectedMidi === currentNote.midi + 12 ||
                      detectedMidi === currentNote.midi - 12
                        ? 'text-green-600'
                        : 'text-red-500'
                    }`}>
                      {midiToName(detectedMidi)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{detectedFreq} Hz</div>
                  </>
                ) : (
                  <div className="text-2xl text-gray-300">...</div>
                )}
              </div>

              {/* Manual controls */}
              {!autoAdvance && (
                <div className="flex flex-col gap-1">
                  <button
                    onClick={handleManualCheck}
                    disabled={detectedMidi === null}
                    className="px-3 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition disabled:opacity-40"
                  >
                    Check
                  </button>
                  <button
                    onClick={handleSkip}
                    className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition"
                  >
                    Skip
                  </button>
                </div>
              )}

              {autoAdvance && (
                <button
                  onClick={handleSkip}
                  className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition"
                >
                  Skip
                </button>
              )}
            </div>
          ) : isDone ? (
            <div className="text-center py-4">
              <div className="text-2xl font-bold text-green-600 mb-2">Practice Complete!</div>
              <div className="text-gray-600">
                Accuracy: <span className="font-bold">{accuracy}%</span> ({correctCount}/{totalPlayed} correct)
              </div>
              <button
                onClick={handleRestart}
                className="mt-3 px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Try Again
              </button>
            </div>
          ) : null}

          {/* Progress bar */}
          {noteSequence.length > 0 && (
            <div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${(currentNoteIndex / noteSequence.length) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{accuracy}% accuracy</span>
                <span>{currentNoteIndex}/{noteSequence.length} notes</span>
              </div>
            </div>
          )}

          {/* Recent feedback */}
          {feedback.length > 0 && (
            <div className="border-t pt-3">
              <h4 className="text-xs font-medium text-gray-500 mb-2">Recent Results</h4>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {feedback.slice(-30).map((item, i) => (
                  <div
                    key={i}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      item.correct
                        ? 'bg-green-100 text-green-700'
                        : item.played === null
                          ? 'bg-gray-100 text-gray-500'
                          : 'bg-red-100 text-red-700'
                    }`}
                    title={
                      item.correct
                        ? `${item.expected.name} ✓`
                        : item.played !== null
                          ? `Expected ${item.expected.name}, played ${midiToName(item.played)}`
                          : `${item.expected.name} (skipped)`
                    }
                  >
                    {item.correct ? '✓' : item.played !== null ? '✗' : '–'} {item.expected.name}
                    {!item.correct && item.played !== null && (
                      <span className="opacity-60"> ({midiToName(item.played)})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Idle state info */}
      {!isListening && !micError && (
        <div className="p-4 text-center text-gray-500 text-sm">
          <p>{noteSequence.length} notes in this piece. Click <strong>Start Practice</strong> to begin.</p>
          <p className="text-xs mt-1 text-gray-400">
            Your microphone will listen for piano notes and check them against the sheet music.
          </p>
        </div>
      )}
    </div>
  );
}
