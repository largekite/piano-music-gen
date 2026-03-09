'use client';

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import type { PianoNote } from './PianoRoll';

export type KeySignature =
  | 'C major' | 'G major' | 'D major' | 'A major' | 'E major' | 'B major'
  | 'F major' | 'Bb major' | 'Eb major' | 'Ab major'
  | 'A minor' | 'E minor' | 'B minor' | 'F# minor' | 'C# minor' | 'G# minor'
  | 'D minor' | 'G minor' | 'C minor' | 'F minor';

interface SheetMusicProps {
  notes: PianoNote[];
  tempo?: number;
  currentTime?: number;
  isPlaying?: boolean;
  keySignature?: KeySignature;
  onNotesChange?: (notes: PianoNote[]) => void;
  onKeySignatureChange?: (key: KeySignature) => void;
}

// Staff constants
const STAFF_LINE_GAP = 10;
const STAFF_TOP_MARGIN = 45;
const STAFF_LEFT_MARGIN = 80;    // wider for key signature
const SYSTEM_SPACING = 180;
const NOTE_HEAD_RX = 5;
const NOTE_HEAD_RY = 3.8;
const STEM_LENGTH = 35;
const BEATS_PER_MEASURE = 4;
const MEASURES_PER_LINE = 4;
const BEAT_WIDTH = 40;
const MEASURE_WIDTH = BEATS_PER_MEASURE * BEAT_WIDTH;
const LINE_WIDTH = MEASURES_PER_LINE * MEASURE_WIDTH;

// ── Key signature data ──────────────────────────────────────────

// Number of sharps (positive) or flats (negative) for each key
const KEY_SIG_MAP: Record<KeySignature, number> = {
  'C major': 0,  'A minor': 0,
  'G major': 1,  'E minor': 1,
  'D major': 2,  'B minor': 2,
  'A major': 3,  'F# minor': 3,
  'E major': 4,  'C# minor': 4,
  'B major': 5,  'G# minor': 5,
  'F major': -1, 'D minor': -1,
  'Bb major': -2,'G minor': -2,
  'Eb major': -3,'C minor': -3,
  'Ab major': -4,'F minor': -4,
};

// Order of sharps on staff: F C G D A E B
// Staff positions relative to top line of each clef
// Treble: top line = F5 (staff pos 9). Sharps at: F5, C5, G5, D5, A4, E5, B4
const TREBLE_SHARP_POSITIONS = [9, 6, 10, 7, 4, 8, 5]; // staff positions
// Bass: top line = A3 (staff pos -5). Same pattern shifted
const BASS_SHARP_POSITIONS = [-5, -8, -4, -7, -10, -6, -9];

// Order of flats on staff: B E A D G C F (reverse of sharps)
const TREBLE_FLAT_POSITIONS = [5, 8, 4, 7, 3, 6, 2];
const BASS_FLAT_POSITIONS = [-9, -6, -10, -7, -11, -8, -12];

// Which pitch classes have sharps/flats in each key signature count
// Sharps order: F#, C#, G#, D#, A#, E#, B#  (pitch classes: 6, 1, 8, 3, 10, 5, 0)
const SHARP_PITCH_CLASSES = [6, 1, 8, 3, 10, 5, 0]; // F#=6, C#=1, G#=8, D#=3, A#=10, E#=5, B#=0
// Flats order: Bb, Eb, Ab, Db, Gb, Cb, Fb  (pitch classes: 10, 3, 8, 1, 6, 11, 4)
const FLAT_PITCH_CLASSES = [10, 3, 8, 1, 6, 11, 4];

function getKeyAccidentals(keySig: KeySignature): { sharps: Set<number>; flats: Set<number> } {
  const count = KEY_SIG_MAP[keySig];
  const sharps = new Set<number>();
  const flats = new Set<number>();

  if (count > 0) {
    for (let i = 0; i < count; i++) sharps.add(SHARP_PITCH_CLASSES[i]);
  } else if (count < 0) {
    for (let i = 0; i < -count; i++) flats.add(FLAT_PITCH_CLASSES[i]);
  }

  return { sharps, flats };
}

// Build set of pitch classes that belong to the key's scale
function getScalePitchClasses(keySig: KeySignature): Set<number> {
  const isMinor = keySig.includes('minor');
  const count = KEY_SIG_MAP[keySig];
  // C major scale: 0,2,4,5,7,9,11
  const majorScale = [0, 2, 4, 5, 7, 9, 11];
  const minorScale = [0, 2, 3, 5, 7, 8, 10]; // natural minor

  // Root note for the key
  const roots: Record<string, number> = {
    'C': 0, 'G': 7, 'D': 2, 'A': 9, 'E': 4, 'B': 11,
    'F': 5, 'Bb': 10, 'Eb': 3, 'Ab': 8,
    'F#': 6, 'C#': 1, 'G#': 8,
  };

  const keyName = keySig.split(' ')[0];
  const root = roots[keyName] ?? 0;
  const intervals = isMinor ? minorScale : majorScale;
  const pitches = new Set<number>();
  for (const interval of intervals) {
    pitches.add((root + interval) % 12);
  }
  return pitches;
}

// ── Transpose helper ────────────────────────────────────────────

// All supported keys ordered by circle of fifths for easy transposition
const ALL_MAJOR_KEYS: KeySignature[] = [
  'C major', 'G major', 'D major', 'A major', 'E major', 'B major',
  'F major', 'Bb major', 'Eb major', 'Ab major',
];
const ALL_MINOR_KEYS: KeySignature[] = [
  'A minor', 'E minor', 'B minor', 'F# minor', 'C# minor', 'G# minor',
  'D minor', 'G minor', 'C minor', 'F minor',
];
export const ALL_KEYS: KeySignature[] = [...ALL_MAJOR_KEYS, ...ALL_MINOR_KEYS];

function getKeyRoot(keySig: KeySignature): number {
  const roots: Record<string, number> = {
    'C': 0, 'G': 7, 'D': 2, 'A': 9, 'E': 4, 'B': 11,
    'F': 5, 'Bb': 10, 'Eb': 3, 'Ab': 8,
    'F#': 6, 'C#': 1, 'G#': 8,
  };
  return roots[keySig.split(' ')[0]] ?? 0;
}

export function transposeNotes(
  notes: PianoNote[],
  fromKey: KeySignature,
  toKey: KeySignature,
): PianoNote[] {
  const fromRoot = getKeyRoot(fromKey);
  const toRoot = getKeyRoot(toKey);
  const semitones = toRoot - fromRoot;
  if (semitones === 0) return notes;

  return notes.map(n => {
    let newMidi = n.midi + semitones;
    // Keep within MIDI range
    while (newMidi < 21) newMidi += 12;
    while (newMidi > 108) newMidi -= 12;
    return { ...n, midi: newMidi };
  });
}

// ── Staff position mapping ──────────────────────────────────────

// Map note name to staff position within an octave (C=0, D=1, E=2, F=3, G=4, A=5, B=6)
const NOTE_TO_STAFF_POS: Record<string, number> = {
  'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6,
};

// Enharmonic spelling: for sharp keys, use sharps; for flat keys, use flats
function midiToNoteInfo(midi: number, keySig: KeySignature): {
  staffPos: number;
  accidental: 'sharp' | 'flat' | 'natural' | null;
} {
  const pitchClass = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  const { sharps, flats } = getKeyAccidentals(keySig);
  const scalePitches = getScalePitchClasses(keySig);
  const sigCount = KEY_SIG_MAP[keySig];

  // Natural note names for each pitch class
  const NATURAL_MAP: Record<number, string> = {
    0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B',
  };

  // Check if this pitch class is a natural note
  const naturalName = NATURAL_MAP[pitchClass];

  if (naturalName) {
    // It's a white key
    const baseStaff = NOTE_TO_STAFF_POS[naturalName];
    const pos = (octave - 4) * 7 + baseStaff;

    // If this natural is in the key signature as a sharp/flat target, show natural sign
    if (sharps.has(pitchClass) || flats.has(pitchClass)) {
      // This natural note has been modified by the key sig, need a natural sign
      return { staffPos: pos, accidental: 'natural' };
    }

    // If it's in the scale, no accidental needed
    if (scalePitches.has(pitchClass)) {
      return { staffPos: pos, accidental: null };
    }

    // Not in scale and not in key sig (shouldn't normally happen for naturals)
    return { staffPos: pos, accidental: null };
  }

  // It's a black key - decide sharp or flat spelling
  if (sigCount >= 0) {
    // Sharp key: spell as sharp
    // pitch class 1=C#, 3=D#, 6=F#, 8=G#, 10=A#
    const sharpSpelling: Record<number, string> = {
      1: 'C', 3: 'D', 6: 'F', 8: 'G', 10: 'A',
    };
    const baseName = sharpSpelling[pitchClass] || 'C';
    const baseStaff = NOTE_TO_STAFF_POS[baseName];
    const pos = (octave - 4) * 7 + baseStaff;

    // If this sharp is in the key signature, no accidental needed
    if (sharps.has(pitchClass)) {
      return { staffPos: pos, accidental: null };
    }
    return { staffPos: pos, accidental: 'sharp' };
  } else {
    // Flat key: spell as flat
    // pitch class 1=Db, 3=Eb, 6=Gb, 8=Ab, 10=Bb
    const flatSpelling: Record<number, string> = {
      1: 'D', 3: 'E', 6: 'G', 8: 'A', 10: 'B',
    };
    const baseName = flatSpelling[pitchClass] || 'D';
    const baseStaff = NOTE_TO_STAFF_POS[baseName];
    const pos = (octave - 4) * 7 + baseStaff;

    // If this flat is in the key signature, no accidental needed
    if (flats.has(pitchClass)) {
      return { staffPos: pos, accidental: null };
    }
    return { staffPos: pos, accidental: 'flat' };
  }
}

// Treble clef: bottom line = E4 (staff pos 2), top line = F5 (staff pos 9)
// Bass clef: bottom line = G2 (staff pos -12), top line = A3 (staff pos -5)
// Staff position 0 = middle C

function staffPosToTrebleY(staffPos: number, trebleTopY: number): number {
  return trebleTopY + (9 - staffPos) * (STAFF_LINE_GAP / 2);
}

function staffPosToBassY(staffPos: number, bassTopY: number): number {
  return bassTopY + (-5 - staffPos) * (STAFF_LINE_GAP / 2);
}

interface QuantizedNote {
  midi: number;
  staffPos: number;
  beat: number;
  duration: number;
  velocity: number;
  accidental: 'sharp' | 'flat' | 'natural' | null;
  clef: 'treble' | 'bass';
}

function quantizeNotes(notes: PianoNote[], tempo: number, keySig: KeySignature): QuantizedNote[] {
  const beatsPerSecond = tempo / 60;

  return notes.map(n => {
    const beat = n.time * beatsPerSecond;
    const durBeats = n.duration * beatsPerSecond;
    const { staffPos, accidental } = midiToNoteInfo(n.midi, keySig);
    const clef: 'treble' | 'bass' = staffPos >= 0 ? 'treble' : 'bass';

    return {
      midi: n.midi,
      staffPos,
      beat: Math.round(beat * 4) / 4,
      duration: Math.max(0.25, Math.round(durBeats * 4) / 4),
      velocity: n.velocity,
      accidental,
      clef,
    };
  });
}

function getNoteType(durBeats: number): 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' {
  if (durBeats >= 3.5) return 'whole';
  if (durBeats >= 1.5) return 'half';
  if (durBeats >= 0.75) return 'quarter';
  if (durBeats >= 0.375) return 'eighth';
  return 'sixteenth';
}

function drawTrebleClef(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.font = '62px serif';
  ctx.fillStyle = '#333';
  ctx.fillText('\u{1D11E}', x, y + 38);
  ctx.restore();
}

function drawBassClef(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.font = '38px serif';
  ctx.fillStyle = '#333';
  ctx.fillText('\u{1D122}', x, y + 30);
  ctx.restore();
}

function drawKeySignature(
  ctx: CanvasRenderingContext2D,
  keySig: KeySignature,
  trebleTopY: number,
  bassTopY: number,
  startX: number,
) {
  const count = KEY_SIG_MAP[keySig];
  if (count === 0) return;

  ctx.fillStyle = '#333';
  ctx.font = '16px serif';
  const spacing = 10;

  if (count > 0) {
    // Draw sharps
    for (let i = 0; i < count; i++) {
      const treblePos = TREBLE_SHARP_POSITIONS[i];
      const bassPos = BASS_SHARP_POSITIONS[i];
      const x = startX + i * spacing;

      const ty = staffPosToTrebleY(treblePos, trebleTopY);
      ctx.fillText('\u266F', x, ty + 5);

      const by = staffPosToBassY(bassPos, bassTopY);
      ctx.fillText('\u266F', x, by + 5);
    }
  } else {
    // Draw flats
    const absCount = -count;
    for (let i = 0; i < absCount; i++) {
      const treblePos = TREBLE_FLAT_POSITIONS[i];
      const bassPos = BASS_FLAT_POSITIONS[i];
      const x = startX + i * spacing;

      const ty = staffPosToTrebleY(treblePos, trebleTopY);
      ctx.fillText('\u266D', x, ty + 5);

      const by = staffPosToBassY(bassPos, bassTopY);
      ctx.fillText('\u266D', x, by + 5);
    }
  }
}

// ── Auto-detect key from notes ──────────────────────────────────

function detectKey(notes: PianoNote[]): KeySignature {
  if (notes.length === 0) return 'C major';

  // Count pitch class occurrences
  const pitchCounts = new Array(12).fill(0);
  for (const n of notes) {
    pitchCounts[n.midi % 12] += n.duration;
  }

  // Score each key by how well the notes fit its scale
  let bestKey: KeySignature = 'C major';
  let bestScore = -Infinity;

  for (const key of ALL_KEYS) {
    const scale = getScalePitchClasses(key);
    let score = 0;
    for (let pc = 0; pc < 12; pc++) {
      if (scale.has(pc)) {
        score += pitchCounts[pc];
      } else {
        score -= pitchCounts[pc] * 2;
      }
    }
    // Slight preference for major keys and fewer accidentals
    const sigCount = Math.abs(KEY_SIG_MAP[key]);
    score -= sigCount * 0.1;
    if (key.includes('major')) score += 0.05;

    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  return bestKey;
}

// ── Component ───────────────────────────────────────────────────

export default function SheetMusic({
  notes,
  tempo = 120,
  currentTime = 0,
  isPlaying = false,
  keySignature,
  onNotesChange,
  onKeySignatureChange,
}: SheetMusicProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-detect key if not provided
  const detectedKey = useMemo(() => detectKey(notes), [notes]);
  const [localKey, setLocalKey] = useState<KeySignature>(keySignature || detectedKey);

  // Sync if parent provides key
  useEffect(() => {
    if (keySignature) setLocalKey(keySignature);
  }, [keySignature]);

  // Update detected key when notes change and no explicit key is set
  useEffect(() => {
    if (!keySignature && notes.length > 0) {
      setLocalKey(detectedKey);
    }
  }, [detectedKey, keySignature, notes.length]);

  const activeKey = keySignature || localKey;

  const handleKeyChange = useCallback((newKey: KeySignature) => {
    setLocalKey(newKey);
    onKeySignatureChange?.(newKey);
  }, [onKeySignatureChange]);

  const handleTranspose = useCallback((toKey: KeySignature) => {
    if (!onNotesChange) return;
    const transposed = transposeNotes(notes, activeKey, toKey);
    onNotesChange(transposed);
    handleKeyChange(toKey);
  }, [notes, activeKey, onNotesChange, handleKeyChange]);

  const quantized = useMemo(() => quantizeNotes(notes, tempo, activeKey), [notes, tempo, activeKey]);

  const totalBeats = useMemo(() => {
    if (quantized.length === 0) return BEATS_PER_MEASURE * MEASURES_PER_LINE;
    return Math.max(...quantized.map(n => n.beat + n.duration)) + BEATS_PER_MEASURE;
  }, [quantized]);

  const totalMeasures = Math.ceil(totalBeats / BEATS_PER_MEASURE);
  const totalLines = Math.ceil(totalMeasures / MEASURES_PER_LINE);
  const canvasWidth = STAFF_LEFT_MARGIN + LINE_WIDTH + 40;
  const canvasHeight = STAFF_TOP_MARGIN + totalLines * SYSTEM_SPACING + 60;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = '#fefcf8';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const sigCount = KEY_SIG_MAP[activeKey];
    const keySigWidth = Math.abs(sigCount) * 10 + (sigCount !== 0 ? 6 : 0);

    for (let line = 0; line < totalLines; line++) {
      const systemY = STAFF_TOP_MARGIN + line * SYSTEM_SPACING;
      const trebleTopY = systemY;
      const bassTopY = systemY + STAFF_LINE_GAP * 4 + 35;

      // Staff lines
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;

      for (let i = 0; i < 5; i++) {
        const y = trebleTopY + i * STAFF_LINE_GAP;
        ctx.beginPath();
        ctx.moveTo(STAFF_LEFT_MARGIN - 20, y);
        ctx.lineTo(STAFF_LEFT_MARGIN + LINE_WIDTH, y);
        ctx.stroke();
      }

      for (let i = 0; i < 5; i++) {
        const y = bassTopY + i * STAFF_LINE_GAP;
        ctx.beginPath();
        ctx.moveTo(STAFF_LEFT_MARGIN - 20, y);
        ctx.lineTo(STAFF_LEFT_MARGIN + LINE_WIDTH, y);
        ctx.stroke();
      }

      // System bracket
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(STAFF_LEFT_MARGIN - 22, trebleTopY);
      ctx.lineTo(STAFF_LEFT_MARGIN - 22, bassTopY + 4 * STAFF_LINE_GAP);
      ctx.stroke();

      // Clefs
      drawTrebleClef(ctx, STAFF_LEFT_MARGIN - 16, trebleTopY);
      drawBassClef(ctx, STAFF_LEFT_MARGIN - 12, bassTopY);

      // Key signature
      if (sigCount !== 0) {
        drawKeySignature(ctx, activeKey, trebleTopY, bassTopY, STAFF_LEFT_MARGIN + 2);
      }

      // Measure bar lines
      const startMeasure = line * MEASURES_PER_LINE;
      for (let m = 0; m <= MEASURES_PER_LINE; m++) {
        const measure = startMeasure + m;
        if (measure > totalMeasures) break;

        const x = STAFF_LEFT_MARGIN + keySigWidth + m * MEASURE_WIDTH;
        ctx.strokeStyle = '#999';
        ctx.lineWidth = m === 0 || m === MEASURES_PER_LINE ? 1.5 : 0.8;
        ctx.beginPath();
        ctx.moveTo(x, trebleTopY);
        ctx.lineTo(x, trebleTopY + 4 * STAFF_LINE_GAP);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, bassTopY);
        ctx.lineTo(x, bassTopY + 4 * STAFF_LINE_GAP);
        ctx.stroke();

        // Measure number
        if (m < MEASURES_PER_LINE && measure < totalMeasures) {
          ctx.fillStyle = '#aaa';
          ctx.font = '9px sans-serif';
          ctx.fillText(`${measure + 1}`, x + 3, trebleTopY - 6);
        }
      }

      // Draw notes for this line
      const lineStartBeat = startMeasure * BEATS_PER_MEASURE;
      const lineEndBeat = lineStartBeat + MEASURES_PER_LINE * BEATS_PER_MEASURE;

      const lineNotes = quantized.filter(n =>
        n.beat >= lineStartBeat && n.beat < lineEndBeat
      );

      lineNotes.forEach(note => {
        const beatInLine = note.beat - lineStartBeat;
        const x = STAFF_LEFT_MARGIN + keySigWidth + beatInLine * BEAT_WIDTH;

        let y: number;
        if (note.clef === 'treble') {
          y = staffPosToTrebleY(note.staffPos, trebleTopY);
        } else {
          y = staffPosToBassY(note.staffPos, bassTopY);
        }

        const noteType = getNoteType(note.duration);
        const filled = noteType !== 'whole' && noteType !== 'half';

        // Ledger lines
        if (note.clef === 'treble') {
          const bottomLine = trebleTopY + 4 * STAFF_LINE_GAP;
          if (y > bottomLine) {
            for (let ly = bottomLine + STAFF_LINE_GAP; ly <= y + 1; ly += STAFF_LINE_GAP) {
              ctx.strokeStyle = '#999';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(x - NOTE_HEAD_RX - 3, ly);
              ctx.lineTo(x + NOTE_HEAD_RX + 3, ly);
              ctx.stroke();
            }
          }
          if (y < trebleTopY) {
            for (let ly = trebleTopY - STAFF_LINE_GAP; ly >= y - 1; ly -= STAFF_LINE_GAP) {
              ctx.strokeStyle = '#999';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(x - NOTE_HEAD_RX - 3, ly);
              ctx.lineTo(x + NOTE_HEAD_RX + 3, ly);
              ctx.stroke();
            }
          }
        } else {
          if (y < bassTopY) {
            for (let ly = bassTopY - STAFF_LINE_GAP; ly >= y - 1; ly -= STAFF_LINE_GAP) {
              ctx.strokeStyle = '#999';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(x - NOTE_HEAD_RX - 3, ly);
              ctx.lineTo(x + NOTE_HEAD_RX + 3, ly);
              ctx.stroke();
            }
          }
          const bassBottom = bassTopY + 4 * STAFF_LINE_GAP;
          if (y > bassBottom) {
            for (let ly = bassBottom + STAFF_LINE_GAP; ly <= y + 1; ly += STAFF_LINE_GAP) {
              ctx.strokeStyle = '#999';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(x - NOTE_HEAD_RX - 3, ly);
              ctx.lineTo(x + NOTE_HEAD_RX + 3, ly);
              ctx.stroke();
            }
          }
        }

        // Accidentals (only for notes not covered by key signature)
        if (note.accidental) {
          ctx.fillStyle = '#333';
          ctx.font = '14px serif';
          const symbol = note.accidental === 'sharp' ? '\u266F'
            : note.accidental === 'flat' ? '\u266D'
            : '\u266E'; // natural
          ctx.fillText(symbol, x - NOTE_HEAD_RX - 13, y + 5);
        }

        // Note head
        ctx.save();
        ctx.beginPath();
        ctx.translate(x, y);
        ctx.rotate(-0.2);
        ctx.ellipse(0, 0, NOTE_HEAD_RX, NOTE_HEAD_RY, 0, 0, Math.PI * 2);
        ctx.restore();

        if (filled) {
          const intensity = Math.round(20 + (1 - note.velocity / 127) * 30);
          ctx.fillStyle = `rgb(${intensity}, ${intensity}, ${intensity + 10})`;
          ctx.fill();
        } else {
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Stem
        if (noteType !== 'whole') {
          const staffMiddle = note.clef === 'treble'
            ? trebleTopY + 2 * STAFF_LINE_GAP
            : bassTopY + 2 * STAFF_LINE_GAP;
          const stemUp = y > staffMiddle;

          ctx.strokeStyle = '#333';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          if (stemUp) {
            ctx.moveTo(x + NOTE_HEAD_RX - 1, y);
            ctx.lineTo(x + NOTE_HEAD_RX - 1, y - STEM_LENGTH);
          } else {
            ctx.moveTo(x - NOTE_HEAD_RX + 1, y);
            ctx.lineTo(x - NOTE_HEAD_RX + 1, y + STEM_LENGTH);
          }
          ctx.stroke();

          // Flags
          if (noteType === 'eighth' || noteType === 'sixteenth') {
            const flagDir = stemUp ? -1 : 1;
            const stemEndX = stemUp ? x + NOTE_HEAD_RX - 1 : x - NOTE_HEAD_RX + 1;
            const stemEndY = stemUp ? y - STEM_LENGTH : y + STEM_LENGTH;

            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(stemEndX, stemEndY);
            ctx.quadraticCurveTo(
              stemEndX + 10, stemEndY + flagDir * 10,
              stemEndX + 8, stemEndY + flagDir * 20,
            );
            ctx.stroke();

            if (noteType === 'sixteenth') {
              ctx.beginPath();
              ctx.moveTo(stemEndX, stemEndY + flagDir * 6);
              ctx.quadraticCurveTo(
                stemEndX + 10, stemEndY + flagDir * 16,
                stemEndX + 8, stemEndY + flagDir * 26,
              );
              ctx.stroke();
            }
          }
        }
      });
    }

    // Playhead
    if ((currentTime > 0 || isPlaying) && notes.length > 0) {
      const beatsPerSecond = tempo / 60;
      const currentBeat = currentTime * beatsPerSecond;
      const currentMeasure = Math.floor(currentBeat / BEATS_PER_MEASURE);
      const currentLine = Math.floor(currentMeasure / MEASURES_PER_LINE);
      const beatInLine = currentBeat - currentLine * MEASURES_PER_LINE * BEATS_PER_MEASURE;

      if (currentLine < totalLines) {
        const systemY = STAFF_TOP_MARGIN + currentLine * SYSTEM_SPACING;
        const bassBottomY = systemY + STAFF_LINE_GAP * 4 + 35 + 4 * STAFF_LINE_GAP;
        const playX = STAFF_LEFT_MARGIN + keySigWidth + beatInLine * BEAT_WIDTH;

        ctx.strokeStyle = 'rgba(200, 50, 50, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playX, systemY - 5);
        ctx.lineTo(playX, bassBottomY + 5);
        ctx.stroke();
      }
    }

    // Tempo + Key label
    ctx.fillStyle = '#555';
    ctx.font = '11px sans-serif';
    ctx.fillText(`\u2669 = ${tempo}`, STAFF_LEFT_MARGIN, STAFF_TOP_MARGIN - 15);
    ctx.fillText(activeKey, STAFF_LEFT_MARGIN + 60, STAFF_TOP_MARGIN - 15);

  }, [notes, quantized, tempo, currentTime, isPlaying, totalLines, totalMeasures, canvasWidth, canvasHeight, activeKey]);

  // Auto-scroll
  useEffect(() => {
    if (isPlaying && scrollRef.current) {
      const beatsPerSecond = tempo / 60;
      const currentBeat = currentTime * beatsPerSecond;
      const currentMeasure = Math.floor(currentBeat / BEATS_PER_MEASURE);
      const currentLine = Math.floor(currentMeasure / MEASURES_PER_LINE);
      const targetY = STAFF_TOP_MARGIN + currentLine * SYSTEM_SPACING - 40;

      const scrollTop = scrollRef.current.scrollTop;
      const viewHeight = scrollRef.current.clientHeight;
      if (targetY < scrollTop || targetY > scrollTop + viewHeight - 100) {
        scrollRef.current.scrollTop = targetY;
      }
    }
  }, [currentTime, isPlaying, tempo]);

  if (notes.length === 0) {
    return (
      <div className="rounded-2xl bg-warm-100 border border-warm-200 p-8 text-center text-warm-600 text-sm">
        <p>No notes to display. Generate or compose some music first.</p>
      </div>
    );
  }

  const smallSelectClass = "px-2 py-1 border border-warm-200 rounded-lg text-xs bg-white text-stone-600 focus:ring-2 focus:ring-coral-300 focus:border-transparent outline-none";

  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur border border-warm-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-warm-100 bg-warm-50 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-stone-700 text-sm">Sheet Music</h3>
          <button
            onClick={() => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const link = document.createElement('a');
              link.download = 'sheet-music.png';
              link.href = canvas.toDataURL('image/png');
              link.click();
            }}
            className="px-2.5 py-1 text-xs bg-warm-200 hover:bg-warm-300 text-stone-600 rounded-lg transition font-medium"
            title="Download as PNG"
          >
            Download PNG
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm">
            <label htmlFor="key-sig-select" className="text-stone-400 text-xs">Key:</label>
            <select
              id="key-sig-select"
              value={activeKey}
              onChange={(e) => handleKeyChange(e.target.value as KeySignature)}
              className={smallSelectClass}
            >
              <optgroup label="Major">
                {ALL_MAJOR_KEYS.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </optgroup>
              <optgroup label="Minor">
                {ALL_MINOR_KEYS.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {onNotesChange && (
            <div className="flex items-center gap-1.5 text-sm">
              <label htmlFor="transpose-select" className="text-stone-400 text-xs">Transpose:</label>
              <select
                id="transpose-select"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleTranspose(e.target.value as KeySignature);
                    e.target.value = '';
                  }
                }}
                className={smallSelectClass}
              >
                <option value="">Select...</option>
                <optgroup label="Major">
                  {ALL_MAJOR_KEYS.filter(k => k !== activeKey).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </optgroup>
                <optgroup label="Minor">
                  {ALL_MINOR_KEYS.filter(k => k !== activeKey).map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          <span className="text-xs text-stone-400">
            {totalMeasures} measures &middot; {quantized.length} notes
          </span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="overflow-auto"
        style={{ maxHeight: '500px' }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block' }}
        />
      </div>
    </div>
  );
}
