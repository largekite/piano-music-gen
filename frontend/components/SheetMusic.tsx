'use client';

import { useRef, useEffect, useMemo } from 'react';
import type { PianoNote } from './PianoRoll';

interface SheetMusicProps {
  notes: PianoNote[];
  tempo?: number;
  currentTime?: number;
  isPlaying?: boolean;
}

// Staff constants
const STAFF_LINE_GAP = 10;       // pixels between staff lines
const STAFF_TOP_MARGIN = 45;     // top margin before first staff system
const STAFF_LEFT_MARGIN = 70;    // left margin for clef + key sig
const SYSTEM_SPACING = 180;      // vertical spacing between grand staff systems
const NOTE_HEAD_RX = 5;          // note head horizontal radius
const NOTE_HEAD_RY = 3.8;        // note head vertical radius
const STEM_LENGTH = 35;
const BEATS_PER_MEASURE = 4;
const MEASURES_PER_LINE = 4;
const BEAT_WIDTH = 40;           // pixels per beat
const MEASURE_WIDTH = BEATS_PER_MEASURE * BEAT_WIDTH;
const LINE_WIDTH = MEASURES_PER_LINE * MEASURE_WIDTH;

// MIDI note -> staff position mapping
// Middle C (MIDI 60) = ledger line below treble staff = position 0
// Each position = one staff step (line or space)
// Positive = up from middle C, Negative = down from middle C

const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Map note name to staff position within an octave (C=0, D=1, E=2, F=3, G=4, A=5, B=6)
const NOTE_TO_STAFF_POS: Record<string, number> = {
  'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G': 4, 'A': 5, 'B': 6,
};

function midiToStaffPosition(midi: number): number {
  const octave = Math.floor(midi / 12) - 1;
  const noteIdx = midi % 12;
  const noteName = NOTE_NAMES_SHARP[noteIdx];
  // Get the base note name (without sharp)
  const baseName = noteName.replace('#', '');
  const staffPos = NOTE_TO_STAFF_POS[baseName];
  // Middle C (MIDI 60) is octave 4, position 0
  // Each octave = 7 staff positions
  return (octave - 4) * 7 + staffPos;
}

function isSharp(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}

// Treble clef: bottom line = E4 (staff pos 2), top line = F5 (staff pos 9)
// Bass clef: bottom line = G2 (staff pos -12), top line = A3 (staff pos -5)
// Staff position 0 = middle C = one ledger line below treble staff

function staffPosToTrebleY(staffPos: number, trebleTopY: number): number {
  // Top line of treble staff = F5 = staff pos 9
  // Each staff pos down = STAFF_LINE_GAP/2 pixels down
  return trebleTopY + (9 - staffPos) * (STAFF_LINE_GAP / 2);
}

function staffPosToBassY(staffPos: number, bassTopY: number): number {
  // Top line of bass staff = A3 = staff pos -5
  return bassTopY + (-5 - staffPos) * (STAFF_LINE_GAP / 2);
}

interface QuantizedNote {
  midi: number;
  staffPos: number;
  beat: number;      // beat position (0-indexed)
  duration: number;  // in beats
  velocity: number;
  sharp: boolean;
  clef: 'treble' | 'bass';
}

function quantizeNotes(notes: PianoNote[], tempo: number): QuantizedNote[] {
  const beatsPerSecond = tempo / 60;

  return notes.map(n => {
    const beat = n.time * beatsPerSecond;
    const durBeats = n.duration * beatsPerSecond;
    const staffPos = midiToStaffPosition(n.midi);

    // Notes at or above middle C go to treble clef, below to bass
    const clef: 'treble' | 'bass' = staffPos >= 0 ? 'treble' : 'bass';

    return {
      midi: n.midi,
      staffPos,
      beat: Math.round(beat * 4) / 4, // quantize to 16th notes
      duration: Math.max(0.25, Math.round(durBeats * 4) / 4),
      velocity: n.velocity,
      sharp: isSharp(n.midi),
      clef,
    };
  });
}

// Determine note head type based on duration
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
  // Unicode treble clef
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

export default function SheetMusic({
  notes,
  tempo = 120,
  currentTime = 0,
  isPlaying = false,
}: SheetMusicProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const quantized = useMemo(() => quantizeNotes(notes, tempo), [notes, tempo]);

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

    // Draw each system (grand staff line)
    for (let line = 0; line < totalLines; line++) {
      const systemY = STAFF_TOP_MARGIN + line * SYSTEM_SPACING;
      const trebleTopY = systemY;
      const bassTopY = systemY + STAFF_LINE_GAP * 4 + 35; // gap between treble and bass

      // Draw staff lines
      ctx.strokeStyle = '#999';
      ctx.lineWidth = 1;

      // Treble staff (5 lines)
      for (let i = 0; i < 5; i++) {
        const y = trebleTopY + i * STAFF_LINE_GAP;
        ctx.beginPath();
        ctx.moveTo(STAFF_LEFT_MARGIN - 20, y);
        ctx.lineTo(STAFF_LEFT_MARGIN + LINE_WIDTH, y);
        ctx.stroke();
      }

      // Bass staff (5 lines)
      for (let i = 0; i < 5; i++) {
        const y = bassTopY + i * STAFF_LINE_GAP;
        ctx.beginPath();
        ctx.moveTo(STAFF_LEFT_MARGIN - 20, y);
        ctx.lineTo(STAFF_LEFT_MARGIN + LINE_WIDTH, y);
        ctx.stroke();
      }

      // System bracket (left brace)
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(STAFF_LEFT_MARGIN - 22, trebleTopY);
      ctx.lineTo(STAFF_LEFT_MARGIN - 22, bassTopY + 4 * STAFF_LINE_GAP);
      ctx.stroke();

      // Clefs
      drawTrebleClef(ctx, STAFF_LEFT_MARGIN - 16, trebleTopY);
      drawBassClef(ctx, STAFF_LEFT_MARGIN - 12, bassTopY);

      // Measure bar lines
      const startMeasure = line * MEASURES_PER_LINE;
      for (let m = 0; m <= MEASURES_PER_LINE; m++) {
        const measure = startMeasure + m;
        if (measure > totalMeasures) break;

        const x = STAFF_LEFT_MARGIN + m * MEASURE_WIDTH;
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
        const x = STAFF_LEFT_MARGIN + beatInLine * BEAT_WIDTH;

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
          // Below treble staff (middle C and below)
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
          // Above treble staff
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
          // Above bass staff (middle C area)
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
          // Below bass staff
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

        // Sharp sign
        if (note.sharp) {
          ctx.fillStyle = '#333';
          ctx.font = '14px serif';
          ctx.fillText('#', x - NOTE_HEAD_RX - 11, y + 5);
        }

        // Note head (ellipse)
        ctx.save();
        ctx.beginPath();
        ctx.translate(x, y);
        ctx.rotate(-0.2); // slight tilt like real notation
        ctx.ellipse(0, 0, NOTE_HEAD_RX, NOTE_HEAD_RY, 0, 0, Math.PI * 2);
        ctx.restore();

        if (filled) {
          // Velocity -> color intensity
          const intensity = Math.round(20 + (1 - note.velocity / 127) * 30);
          ctx.fillStyle = `rgb(${intensity}, ${intensity}, ${intensity + 10})`;
          ctx.fill();
        } else {
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Stem (not for whole notes)
        if (noteType !== 'whole') {
          // Stem direction: notes on/above middle of staff go down, below go up
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

          // Flags for eighth and sixteenth notes
          if (noteType === 'eighth' || noteType === 'sixteenth') {
            const flagDir = stemUp ? -1 : 1;
            const stemEndX = stemUp ? x + NOTE_HEAD_RX - 1 : x - NOTE_HEAD_RX + 1;
            const stemEndY = stemUp ? y - STEM_LENGTH : y + STEM_LENGTH;

            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(stemEndX, stemEndY);
            ctx.quadraticCurveTo(
              stemEndX + 10,
              stemEndY + flagDir * 10,
              stemEndX + 8,
              stemEndY + flagDir * 20
            );
            ctx.stroke();

            if (noteType === 'sixteenth') {
              ctx.beginPath();
              ctx.moveTo(stemEndX, stemEndY + flagDir * 6);
              ctx.quadraticCurveTo(
                stemEndX + 10,
                stemEndY + flagDir * 16,
                stemEndX + 8,
                stemEndY + flagDir * 26
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
        const playX = STAFF_LEFT_MARGIN + beatInLine * BEAT_WIDTH;

        ctx.strokeStyle = 'rgba(200, 50, 50, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playX, systemY - 5);
        ctx.lineTo(playX, bassBottomY + 5);
        ctx.stroke();
      }
    }

    // Title area
    ctx.fillStyle = '#555';
    ctx.font = '11px sans-serif';
    const tempoText = `\u2669 = ${tempo}`;
    ctx.fillText(tempoText, STAFF_LEFT_MARGIN, STAFF_TOP_MARGIN - 15);

  }, [notes, quantized, tempo, currentTime, isPlaying, totalLines, totalMeasures, canvasWidth, canvasHeight]);

  // Auto-scroll to follow playhead
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
      <div className="bg-amber-50 rounded-lg border border-amber-200 p-8 text-center text-amber-700">
        <p>No notes to display. Generate or compose some music first.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
        <h3 className="font-medium text-gray-700 text-sm">Sheet Music</h3>
        <span className="text-xs text-gray-400">
          {totalMeasures} measures | {quantized.length} notes
        </span>
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
