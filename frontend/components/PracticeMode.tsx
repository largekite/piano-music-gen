'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
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
  played: number | null;
  correct: boolean;
  timestamp: number;
}

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
  let rms = 0;
  for (let i = 0; i < buf.length; i++) {
    rms += buf[i] * buf[i];
  }
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.01) return -1;

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

  const c = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size - i; j++) {
      c[i] += trimmed[j] * trimmed[j + i];
    }
  }

  let d = 0;
  while (d < size - 1 && c[d] > c[d + 1]) d++;

  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < size; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }

  if (maxPos <= 0) return -1;

  const y1 = c[maxPos - 1] || 0;
  const y2 = c[maxPos];
  const y3 = c[maxPos + 1] || 0;
  const shift = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
  const period = maxPos + (isFinite(shift) ? shift : 0);

  return sampleRate / period;
}

export default function PracticeMode({ notes, tempo }: PracticeModeProps) {
  const [isListening, setIsListening] = useState(false);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [detectedMidi, setDetectedMidi] = useState<number | null>(null);
  const [detectedFreq, setDetectedFreq] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [micError, setMicError] = useState<string | null>(null);
  const [autoAdvance, setAutoAdvance] = useState(true);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bufRef = useRef<any>(null);
  const holdCountRef = useRef(0);
  const lastDetectedRef = useRef<number | null>(null);

  const noteSequence = useMemo<NoteEvent[]>(() => {
    const beatsPerSecond = tempo / 60;
    const sorted = [...notes].sort((a, b) => a.time - b.time);
    const seq: NoteEvent[] = [];
    let lastBeat = -1;
    for (const n of sorted) {
      const beat = Math.round(n.time * beatsPerSecond * 4) / 4;
      if (beat === lastBeat) continue;
      seq.push({
        midi: n.midi,
        beat,
        duration: n.duration * beatsPerSecond,
        name: midiToName(n.midi),
      });
      lastBeat = beat;
    }
    return seq;
  }, [notes, tempo]);

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
    } catch {
      setMicError('Could not access microphone. Please allow microphone access and try again.');
    }
  }, []);

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
        if (midi >= 21 && midi <= 108) {
          setDetectedFreq(Math.round(freq * 10) / 10);
          setDetectedMidi(midi);

          if (midi === lastDetectedRef.current) {
            holdCountRef.current++;
          } else {
            holdCountRef.current = 1;
            lastDetectedRef.current = midi;
          }

          if (holdCountRef.current === 3 && currentNote && autoAdvance) {
            const correct = midi === currentNote.midi ||
              midi === currentNote.midi + 12 || midi === currentNote.midi - 12;
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

  useEffect(() => {
    return () => { stopListening(); };
  }, [stopListening]);

  const correctCount = feedback.filter(f => f.correct).length;
  const totalPlayed = feedback.length;
  const accuracy = totalPlayed > 0 ? Math.round((correctCount / totalPlayed) * 100) : 0;
  const isDone = currentNoteIndex >= noteSequence.length && noteSequence.length > 0;

  const isNoteCorrect = (detected: number, expected: number) =>
    detected === expected || detected === expected + 12 || detected === expected - 12;

  const handleManualCheck = () => {
    if (!currentNote || detectedMidi === null) return;
    const correct = isNoteCorrect(detectedMidi, currentNote.midi);
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
      <div className="rounded-2xl bg-warm-100 border border-warm-200 p-6 text-center text-warm-600 text-sm">
        No notes to practice yet. Compose or generate some music first!
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur border border-warm-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-warm-100 bg-gradient-to-r from-plum-50 to-warm-50 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-stone-700 text-sm">Practice Mode</h3>
          <p className="text-xs text-stone-400">Play each note on your piano &mdash; we&apos;ll listen and let you know!</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-stone-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={e => setAutoAdvance(e.target.checked)}
              className="accent-plum-500 rounded"
            />
            Auto-advance
          </label>
          {!isListening ? (
            <button
              onClick={startListening}
              className="px-4 py-2 text-sm font-semibold bg-plum-500 text-white rounded-xl hover:bg-plum-600 active:scale-95 transition-all shadow-sm"
            >
              Start Practice
            </button>
          ) : (
            <button
              onClick={stopListening}
              className="px-4 py-2 text-sm font-semibold bg-coral-500 text-white rounded-xl hover:bg-coral-600 active:scale-95 transition-all"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {micError && (
        <div className="px-5 py-3 bg-coral-50 border-b border-coral-200 text-coral-600 text-sm">
          {micError}
        </div>
      )}

      {isListening && (
        <div className="p-5 space-y-5">
          {/* Current note prompt */}
          {!isDone && currentNote ? (
            <div className="flex items-center gap-8 justify-center py-4">
              {/* Expected */}
              <div className="text-center">
                <div className="text-xs text-stone-400 mb-2 uppercase tracking-wide font-medium">Play</div>
                <div className="w-24 h-24 rounded-2xl bg-plum-50 border-2 border-plum-200 flex items-center justify-center">
                  <span className="text-3xl font-bold text-plum-500">{currentNote.name}</span>
                </div>
                <div className="text-xs text-stone-400 mt-2">
                  {currentNoteIndex + 1} / {noteSequence.length}
                </div>
              </div>

              {/* Arrow */}
              <div className="text-stone-300">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </div>

              {/* Detected */}
              <div className="text-center">
                <div className="text-xs text-stone-400 mb-2 uppercase tracking-wide font-medium">Heard</div>
                {detectedMidi !== null ? (
                  <div className={`w-24 h-24 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${
                    isNoteCorrect(detectedMidi, currentNote.midi)
                      ? 'bg-mint-50 border-mint-300'
                      : 'bg-coral-50 border-coral-300'
                  }`}>
                    <span className={`text-3xl font-bold ${
                      isNoteCorrect(detectedMidi, currentNote.midi) ? 'text-mint-500' : 'text-coral-500'
                    }`}>
                      {midiToName(detectedMidi)}
                    </span>
                    <span className="text-xs text-stone-400 mt-0.5">{detectedFreq} Hz</span>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-warm-50 border-2 border-dashed border-warm-200 flex items-center justify-center">
                    <span className="text-stone-300 text-sm">Listening...</span>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-col gap-2">
                {!autoAdvance && (
                  <button
                    onClick={handleManualCheck}
                    disabled={detectedMidi === null}
                    className="px-4 py-2 text-xs font-semibold bg-plum-100 text-plum-600 rounded-lg hover:bg-plum-200 transition disabled:opacity-40"
                  >
                    Check
                  </button>
                )}
                <button
                  onClick={handleSkip}
                  className="px-4 py-2 text-xs font-medium bg-warm-100 text-stone-500 rounded-lg hover:bg-warm-200 transition"
                >
                  Skip
                </button>
              </div>
            </div>
          ) : isDone ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-mint-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-mint-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-stone-700 mb-1">Great job!</h3>
              <p className="text-stone-500">
                You scored <span className="font-bold text-plum-500">{accuracy}%</span> accuracy ({correctCount}/{totalPlayed} correct)
              </p>
              <button
                onClick={handleRestart}
                className="mt-4 px-5 py-2.5 text-sm font-semibold bg-plum-500 text-white rounded-xl hover:bg-plum-600 active:scale-95 transition-all"
              >
                Try Again
              </button>
            </div>
          ) : null}

          {/* Progress */}
          {noteSequence.length > 0 && !isDone && (
            <div>
              <div className="w-full bg-warm-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-plum-400 to-plum-500 h-2 rounded-full transition-all"
                  style={{ width: `${(currentNoteIndex / noteSequence.length) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-stone-400 mt-1.5">
                <span>{accuracy}% accuracy</span>
                <span>{currentNoteIndex}/{noteSequence.length} notes</span>
              </div>
            </div>
          )}

          {/* Recent feedback pills */}
          {feedback.length > 0 && (
            <div className="border-t border-warm-100 pt-4">
              <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">History</h4>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {feedback.slice(-30).map((item, i) => (
                  <div
                    key={i}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                      item.correct
                        ? 'bg-mint-100 text-mint-500'
                        : item.played === null
                          ? 'bg-warm-100 text-stone-400'
                          : 'bg-coral-100 text-coral-500'
                    }`}
                    title={
                      item.correct
                        ? `${item.expected.name} correct`
                        : item.played !== null
                          ? `Expected ${item.expected.name}, played ${midiToName(item.played)}`
                          : `${item.expected.name} (skipped)`
                    }
                  >
                    {item.expected.name}
                    {!item.correct && item.played !== null && (
                      <span className="opacity-60 ml-1">({midiToName(item.played)})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Idle */}
      {!isListening && !micError && (
        <div className="p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-plum-50 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-plum-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <p className="text-stone-600 text-sm font-medium">{noteSequence.length} notes ready to practice</p>
          <p className="text-xs text-stone-400 mt-1">
            Click Start Practice, then play each note on your piano.
          </p>
        </div>
      )}
    </div>
  );
}
