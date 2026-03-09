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

// All supported keys
const ALL_MAJOR_KEYS: KeySignature[] = [
  'C major', 'G major', 'D major', 'A major', 'E major', 'B major',
  'F major', 'Bb major', 'Eb major', 'Ab major',
];
const ALL_MINOR_KEYS: KeySignature[] = [
  'A minor', 'E minor', 'B minor', 'F# minor', 'C# minor', 'G# minor',
  'D minor', 'G minor', 'C minor', 'F minor',
];
export const ALL_KEYS: KeySignature[] = [...ALL_MAJOR_KEYS, ...ALL_MINOR_KEYS];

// ── Transpose helper ────────────────────────────────────────────
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
  const semitones = getKeyRoot(toKey) - getKeyRoot(fromKey);
  if (semitones === 0) return notes;
  return notes.map(n => {
    let newMidi = n.midi + semitones;
    while (newMidi < 21) newMidi += 12;
    while (newMidi > 108) newMidi -= 12;
    return { ...n, midi: newMidi };
  });
}

// ── Key detection ───────────────────────────────────────────────
const KEY_SIG_MAP: Record<KeySignature, number> = {
  'C major': 0, 'A minor': 0,
  'G major': 1, 'E minor': 1,
  'D major': 2, 'B minor': 2,
  'A major': 3, 'F# minor': 3,
  'E major': 4, 'C# minor': 4,
  'B major': 5, 'G# minor': 5,
  'F major': -1, 'D minor': -1,
  'Bb major': -2, 'G minor': -2,
  'Eb major': -3, 'C minor': -3,
  'Ab major': -4, 'F minor': -4,
};

function getScalePitchClasses(keySig: KeySignature): Set<number> {
  const isMinor = keySig.includes('minor');
  const majorScale = [0, 2, 4, 5, 7, 9, 11];
  const minorScale = [0, 2, 3, 5, 7, 8, 10];
  const roots: Record<string, number> = {
    'C': 0, 'G': 7, 'D': 2, 'A': 9, 'E': 4, 'B': 11,
    'F': 5, 'Bb': 10, 'Eb': 3, 'Ab': 8, 'F#': 6, 'C#': 1, 'G#': 8,
  };
  const root = roots[keySig.split(' ')[0]] ?? 0;
  const intervals = isMinor ? minorScale : majorScale;
  return new Set(intervals.map(i => (root + i) % 12));
}

function detectKey(notes: PianoNote[]): KeySignature {
  if (notes.length === 0) return 'C major';
  const pitchCounts = new Array(12).fill(0);
  for (const n of notes) pitchCounts[n.midi % 12] += n.duration;
  let bestKey: KeySignature = 'C major';
  let bestScore = -Infinity;
  for (const key of ALL_KEYS) {
    const scale = getScalePitchClasses(key);
    let score = 0;
    for (let pc = 0; pc < 12; pc++) {
      score += scale.has(pc) ? pitchCounts[pc] : -pitchCounts[pc] * 2;
    }
    score -= Math.abs(KEY_SIG_MAP[key]) * 0.1;
    if (key.includes('major')) score += 0.05;
    if (score > bestScore) { bestScore = score; bestKey = key; }
  }
  return bestKey;
}

// ── VexFlow key mapping ─────────────────────────────────────────
const VF_KEY_MAP: Record<KeySignature, string> = {
  'C major': 'C', 'G major': 'G', 'D major': 'D', 'A major': 'A',
  'E major': 'E', 'B major': 'B', 'F major': 'F', 'Bb major': 'Bb',
  'Eb major': 'Eb', 'Ab major': 'Ab',
  'A minor': 'Am', 'E minor': 'Em', 'B minor': 'Bm', 'F# minor': 'F#m',
  'C# minor': 'C#m', 'G# minor': 'G#m',
  'D minor': 'Dm', 'G minor': 'Gm', 'C minor': 'Cm', 'F minor': 'Fm',
};

// ── MIDI to VexFlow note conversion ─────────────────────────────
const SHARP_NOTES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const FLAT_NOTES = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];

function midiToVexKey(midi: number, useFlats: boolean): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIdx = midi % 12;
  const noteName = useFlats ? FLAT_NOTES[noteIdx] : SHARP_NOTES[noteIdx];
  // VexFlow format: "c/4", "c#/4", "db/4"
  const parts = noteName.length > 1
    ? `${noteName[0]}${noteName[1] === '#' ? '#' : 'b'}/${octave}`
    : `${noteName}/${octave}`;
  return parts;
}

function durationToVexDuration(beats: number): string {
  if (beats >= 3.5) return 'w';
  if (beats >= 1.5) return 'h';
  if (beats >= 0.75) return 'q';
  if (beats >= 0.375) return '8';
  return '16';
}

// ── Types ───────────────────────────────────────────────────────
interface MeasureNote {
  midi: number;
  beat: number;      // beat within the measure (0-based)
  duration: number;  // in beats
  velocity: number;
  time: number;      // original time in seconds
}

interface Measure {
  trebleNotes: MeasureNote[];
  bassNotes: MeasureNote[];
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
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);

  const detectedKey = useMemo(() => detectKey(notes), [notes]);
  const [localKey, setLocalKey] = useState<KeySignature>(keySignature || detectedKey);

  useEffect(() => {
    if (keySignature) setLocalKey(keySignature);
  }, [keySignature]);

  useEffect(() => {
    if (!keySignature && notes.length > 0) setLocalKey(detectedKey);
  }, [detectedKey, keySignature, notes.length]);

  const activeKey = keySignature || localKey;
  const useFlats = KEY_SIG_MAP[activeKey] < 0;

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

  // Organize notes into measures
  const measures = useMemo<Measure[]>(() => {
    if (notes.length === 0) return [];
    const bps = tempo / 60;
    const BEATS_PER_MEASURE = 4;

    const allNotes = notes.map(n => ({
      midi: n.midi,
      beat: n.time * bps,
      duration: Math.max(0.25, n.duration * bps),
      velocity: n.velocity ?? 80,
      time: n.time,
    }));

    const totalBeats = Math.max(...allNotes.map(n => n.beat + n.duration)) + BEATS_PER_MEASURE;
    const numMeasures = Math.ceil(totalBeats / BEATS_PER_MEASURE);
    const result: Measure[] = [];

    for (let m = 0; m < numMeasures; m++) {
      const mStart = m * BEATS_PER_MEASURE;
      const mEnd = mStart + BEATS_PER_MEASURE;
      const measureNotes = allNotes.filter(n => n.beat >= mStart && n.beat < mEnd);

      const treble: MeasureNote[] = [];
      const bass: MeasureNote[] = [];

      for (const n of measureNotes) {
        const entry: MeasureNote = {
          ...n,
          beat: n.beat - mStart,
          duration: Math.min(n.duration, mEnd - n.beat),
        };
        if (n.midi >= 60) treble.push(entry);
        else bass.push(entry);
      }

      result.push({ trebleNotes: treble, bassNotes: bass });
    }

    return result;
  }, [notes, tempo]);

  const totalMeasures = measures.length;

  // Render VexFlow
  useEffect(() => {
    const container = containerRef.current;
    if (!container || measures.length === 0) return;

    // Dynamically import VexFlow (it's a heavy library)
    let cancelled = false;

    async function render() {
      const VF = await import('vexflow');
      if (cancelled || !container) return;

      // Clear previous render
      container.innerHTML = '';
      renderedRef.current = false;

      const { Renderer, Stave, StaveNote, Voice, Formatter, GhostNote, StaveConnector } = VF.default || VF;
      const BEATS_PER_MEASURE = 4;
      const MEASURES_PER_LINE = 4;
      const STAVE_WIDTH = 280;
      const LINE_HEIGHT = 280;
      const LEFT_MARGIN = 20;
      const TOP_MARGIN = 40;

      const totalLines = Math.ceil(measures.length / MEASURES_PER_LINE);
      const canvasWidth = LEFT_MARGIN + MEASURES_PER_LINE * STAVE_WIDTH + 40;
      const canvasHeight = TOP_MARGIN + totalLines * LINE_HEIGHT + 60;

      const renderer = new Renderer(container, Renderer.Backends.SVG);
      renderer.resize(canvasWidth, canvasHeight);
      const context = renderer.getContext();
      context.setFont('serif', 10);

      // Style the SVG
      const svgEl = container.querySelector('svg');
      if (svgEl) {
        svgEl.style.background = '#faf7ff';
        svgEl.style.borderRadius = '0 0 16px 16px';
      }

      // Helper: group notes at the same beat into chords
      function groupByBeat(noteList: MeasureNote[]): Map<number, MeasureNote[]> {
        const map = new Map<number, MeasureNote[]>();
        for (const n of noteList) {
          const quantBeat = Math.round(n.beat * 4) / 4;
          const existing = map.get(quantBeat);
          if (existing) existing.push(n);
          else map.set(quantBeat, [n]);
        }
        return map;
      }

      // Helper: create VexFlow notes for a voice in a measure
      function createVoiceNotes(
        noteGroups: Map<number, MeasureNote[]>,
        clef: string,
      ): (InstanceType<typeof StaveNote> | InstanceType<typeof GhostNote>)[] {
        const vfNotes: (InstanceType<typeof StaveNote> | InstanceType<typeof GhostNote>)[] = [];

        // Fill beats 0-4 with notes or rests
        const sortedBeats = Array.from(noteGroups.keys()).sort((a, b) => a - b);

        if (sortedBeats.length === 0) {
          // Whole rest
          const rest = new StaveNote({
            keys: [clef === 'treble' ? 'd/5' : 'f/3'],
            duration: 'wr',
            clef,
          });
          rest.setStyle({ fillStyle: '#999', strokeStyle: '#999' });
          vfNotes.push(rest);
          return vfNotes;
        }

        let currentBeat = 0;

        for (const beat of sortedBeats) {
          // Fill gap with rests
          const gap = beat - currentBeat;
          if (gap >= 0.125) {
            const restNotes = fillWithRests(gap, clef);
            vfNotes.push(...restNotes);
          }

          const group = noteGroups.get(beat)!;
          const maxDur = Math.max(...group.map(n => n.duration));
          const vexDur = durationToVexDuration(maxDur);

          const keys = group.map(n => midiToVexKey(n.midi, useFlats));

          try {
            const staveNote = new StaveNote({
              keys,
              duration: vexDur,
              clef,
              autoStem: true,
            });

            // Color by velocity
            const avgVel = group.reduce((s, n) => s + n.velocity, 0) / group.length;
            const intensity = Math.round(10 + (1 - avgVel / 127) * 40);
            staveNote.setStyle({
              fillStyle: `rgb(${intensity}, ${intensity}, ${intensity + 8})`,
              strokeStyle: `rgb(${intensity}, ${intensity}, ${intensity + 8})`,
            });

            // Store time data for highlighting
            const midTime = group[0].time;
            staveNote.setAttribute('data-time', String(midTime));

            // Add accidentals
            for (let i = 0; i < keys.length; i++) {
              const key = keys[i];
              if (key.includes('#')) {
                staveNote.addModifier(new VF.Accidental('#'), i);
              } else if (key.includes('b') && key[0] !== 'b') {
                // has a flat but isn't the note 'b'
                const notePart = key.split('/')[0];
                if (notePart.length > 1 && notePart[1] === 'b') {
                  staveNote.addModifier(new VF.Accidental('b'), i);
                }
              }
            }

            vfNotes.push(staveNote);
          } catch {
            // If note creation fails, add a rest
            const rest = new StaveNote({
              keys: [clef === 'treble' ? 'b/4' : 'd/3'],
              duration: vexDur + 'r',
              clef,
            });
            rest.setStyle({ fillStyle: '#ccc', strokeStyle: '#ccc' });
            vfNotes.push(rest);
          }

          currentBeat = beat + maxDur;
        }

        // Fill remaining beats
        const remaining = BEATS_PER_MEASURE - currentBeat;
        if (remaining >= 0.125) {
          const restNotes = fillWithRests(remaining, clef);
          vfNotes.push(...restNotes);
        }

        return vfNotes;
      }

      function fillWithRests(
        beats: number,
        clef: string,
      ): InstanceType<typeof GhostNote>[] {
        const rests: InstanceType<typeof GhostNote>[] = [];
        let remaining = beats;

        const durations: [number, string][] = [
          [4, 'w'], [2, 'h'], [1, 'q'], [0.5, '8'], [0.25, '16'],
        ];

        for (const [dur, vexDur] of durations) {
          while (remaining >= dur - 0.001) {
            rests.push(new GhostNote({ duration: vexDur }));
            remaining -= dur;
          }
        }

        return rests;
      }

      // Render each line
      for (let line = 0; line < totalLines; line++) {
        const startMeasure = line * MEASURES_PER_LINE;
        const endMeasure = Math.min(startMeasure + MEASURES_PER_LINE, measures.length);
        const y = TOP_MARGIN + line * LINE_HEIGHT;

        for (let m = startMeasure; m < endMeasure; m++) {
          const measureIdx = m - startMeasure;
          const x = LEFT_MARGIN + measureIdx * STAVE_WIDTH;
          const isFirst = measureIdx === 0;
          const width = STAVE_WIDTH;

          // Treble stave
          const trebleStave = new Stave(x, y, width);
          if (isFirst) {
            trebleStave.addClef('treble');
            trebleStave.addKeySignature(VF_KEY_MAP[activeKey]);
            if (line === 0) {
              trebleStave.addTimeSignature('4/4');
            }
          }
          if (m === startMeasure) {
            trebleStave.setBegBarType(VF.Barline.type.NONE);
          }
          trebleStave.setContext(context).draw();

          // Bass stave
          const bassStave = new Stave(x, y + 100, width);
          if (isFirst) {
            bassStave.addClef('bass');
            bassStave.addKeySignature(VF_KEY_MAP[activeKey]);
            if (line === 0) {
              bassStave.addTimeSignature('4/4');
            }
          }
          if (m === startMeasure) {
            bassStave.setBegBarType(VF.Barline.type.NONE);
          }
          bassStave.setContext(context).draw();

          // System bracket/brace for first measure of each line
          if (isFirst) {
            const brace = new StaveConnector(trebleStave, bassStave);
            brace.setType('brace');
            brace.setContext(context).draw();

            const lineConn = new StaveConnector(trebleStave, bassStave);
            lineConn.setType('singleLeft');
            lineConn.setContext(context).draw();
          }

          // Right barline connector
          const rightConn = new StaveConnector(trebleStave, bassStave);
          rightConn.setType('singleRight');
          rightConn.setContext(context).draw();

          // Get measure data
          const measure = measures[m];
          if (!measure) continue;

          // Treble voice
          const trebleGroups = groupByBeat(measure.trebleNotes);
          const trebleVfNotes = createVoiceNotes(trebleGroups, 'treble');

          if (trebleVfNotes.length > 0) {
            try {
              const trebleVoice = new Voice({ numBeats: BEATS_PER_MEASURE, beatValue: 4 })
                .setMode(Voice.Mode.SOFT);
              trebleVoice.addTickables(trebleVfNotes);
              new Formatter().joinVoices([trebleVoice]).format([trebleVoice], width - (isFirst ? 100 : 30));
              trebleVoice.draw(context, trebleStave);
            } catch {
              // Silently handle formatting errors
            }
          }

          // Bass voice
          const bassGroups = groupByBeat(measure.bassNotes);
          const bassVfNotes = createVoiceNotes(bassGroups, 'bass');

          if (bassVfNotes.length > 0) {
            try {
              const bassVoice = new Voice({ numBeats: BEATS_PER_MEASURE, beatValue: 4 })
                .setMode(Voice.Mode.SOFT);
              bassVoice.addTickables(bassVfNotes);
              new Formatter().joinVoices([bassVoice]).format([bassVoice], width - (isFirst ? 100 : 30));
              bassVoice.draw(context, bassStave);
            } catch {
              // Silently handle formatting errors
            }
          }

          // Measure number
          context.save();
          context.setFont('sans-serif', 9, 'normal');
          context.setFillStyle('#aaa');
          context.fillText(String(m + 1), x + (isFirst ? 50 : 5), y - 5);
          context.restore();
        }
      }

      renderedRef.current = true;
    }

    render();

    return () => { cancelled = true; };
  }, [measures, activeKey, useFlats]);

  // Playhead highlighting
  useEffect(() => {
    const container = containerRef.current;
    if (!container || measures.length === 0) return;

    // Remove old playhead
    const oldPlayhead = container.querySelector('.vf-playhead');
    if (oldPlayhead) oldPlayhead.remove();

    // Remove old highlights
    container.querySelectorAll('.vf-highlight').forEach(el => el.remove());

    if (currentTime <= 0 && !isPlaying) return;

    const svg = container.querySelector('svg');
    if (!svg) return;

    const bps = tempo / 60;
    const currentBeat = currentTime * bps;
    const BEATS_PER_MEASURE = 4;
    const MEASURES_PER_LINE = 4;
    const STAVE_WIDTH = 280;
    const LINE_HEIGHT = 280;
    const LEFT_MARGIN = 20;
    const TOP_MARGIN = 40;

    const currentMeasure = Math.floor(currentBeat / BEATS_PER_MEASURE);
    const beatInMeasure = currentBeat - currentMeasure * BEATS_PER_MEASURE;
    const line = Math.floor(currentMeasure / MEASURES_PER_LINE);
    const measureInLine = currentMeasure % MEASURES_PER_LINE;

    // Calculate playhead x position
    const measureX = LEFT_MARGIN + measureInLine * STAVE_WIDTH;
    // Estimate note area start (after clef/key sig on first measure)
    const noteAreaStart = measureInLine === 0 ? 80 : 15;
    const noteAreaWidth = STAVE_WIDTH - noteAreaStart - 10;
    const playX = measureX + noteAreaStart + (beatInMeasure / BEATS_PER_MEASURE) * noteAreaWidth;

    const y = TOP_MARGIN + line * LINE_HEIGHT;

    // Draw playhead line
    const playhead = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    playhead.setAttribute('class', 'vf-playhead');
    playhead.setAttribute('x1', String(playX));
    playhead.setAttribute('y1', String(y - 5));
    playhead.setAttribute('x2', String(playX));
    playhead.setAttribute('y2', String(y + 200));
    playhead.setAttribute('stroke', 'rgba(255, 77, 155, 0.6)');
    playhead.setAttribute('stroke-width', '2.5');
    playhead.setAttribute('stroke-linecap', 'round');
    svg.appendChild(playhead);

    // Highlight active measure
    const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    highlight.setAttribute('class', 'vf-highlight');
    highlight.setAttribute('x', String(measureX));
    highlight.setAttribute('y', String(y - 5));
    highlight.setAttribute('width', String(STAVE_WIDTH));
    highlight.setAttribute('height', String(210));
    highlight.setAttribute('fill', 'rgba(180, 150, 247, 0.12)');
    highlight.setAttribute('rx', '4');
    svg.insertBefore(highlight, svg.firstChild?.nextSibling || null);

  }, [currentTime, isPlaying, measures, tempo]);

  // Auto-scroll during playback
  useEffect(() => {
    if (!isPlaying || !scrollRef.current) return;
    const bps = tempo / 60;
    const currentBeat = currentTime * bps;
    const currentMeasure = Math.floor(currentBeat / 4);
    const line = Math.floor(currentMeasure / 4);
    const targetY = 40 + line * 280 - 40;

    const el = scrollRef.current;
    if (targetY < el.scrollTop || targetY > el.scrollTop + el.clientHeight - 200) {
      el.scrollTo({ top: targetY, behavior: 'smooth' });
    }
  }, [currentTime, isPlaying, tempo]);

  // Download as PNG
  const handleDownload = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const dpr = 2;
      canvas.width = img.width * dpr;
      canvas.height = img.height * dpr;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#faf7ff';
      ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);

      const link = document.createElement('a');
      link.download = 'sheet-music.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

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
            onClick={handleDownload}
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
                {ALL_MAJOR_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
              </optgroup>
              <optgroup label="Minor">
                {ALL_MINOR_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
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
            {totalMeasures} measures &middot; {notes.length} notes
          </span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="overflow-auto bg-[#faf7ff]"
        style={{ maxHeight: '600px' }}
      >
        <div ref={containerRef} style={{ minHeight: '200px' }} />
      </div>
    </div>
  );
}
