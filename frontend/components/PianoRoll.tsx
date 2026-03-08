'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

export interface PianoNote {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
  track?: number;
}

interface PianoRollProps {
  notes: PianoNote[];
  duration: number;
  currentTime?: number;
  isPlaying?: boolean;
  editable?: boolean;
  onNotesChange?: (notes: PianoNote[]) => void;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MIN_MIDI = 21;  // A0
const MAX_MIDI = 108; // C8
const KEY_HEIGHT = 8;
const PIXELS_PER_SECOND = 80;
const PIANO_KEY_WIDTH = 48;

function midiToName(midi: number): string {
  const note = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

function isBlackKey(midi: number): boolean {
  const n = midi % 12;
  return [1, 3, 6, 8, 10].includes(n);
}

export default function PianoRoll({
  notes,
  duration,
  currentTime = 0,
  isPlaying = false,
  editable = false,
  onNotesChange,
}: PianoRollProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoveredNote, setHoveredNote] = useState<number | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set());
  const [tool, setTool] = useState<'select' | 'draw' | 'erase'>('select');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);

  const totalKeys = MAX_MIDI - MIN_MIDI + 1;
  const canvasHeight = totalKeys * KEY_HEIGHT;
  const canvasWidth = Math.max(800, duration * PIXELS_PER_SECOND + PIANO_KEY_WIDTH + 100);

  const midiToY = useCallback((midi: number) => {
    return (MAX_MIDI - midi) * KEY_HEIGHT;
  }, []);

  const yToMidi = useCallback((y: number) => {
    return MAX_MIDI - Math.floor(y / KEY_HEIGHT);
  }, []);

  const timeToX = useCallback((time: number) => {
    return PIANO_KEY_WIDTH + time * PIXELS_PER_SECOND;
  }, []);

  const xToTime = useCallback((x: number) => {
    return Math.max(0, (x - PIANO_KEY_WIDTH) / PIXELS_PER_SECOND);
  }, []);

  // Draw piano roll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw piano keys on the left
    for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
      const y = midiToY(midi);
      const black = isBlackKey(midi);

      // Key background
      ctx.fillStyle = black ? '#2d2d44' : '#16213e';
      ctx.fillRect(0, y, PIANO_KEY_WIDTH, KEY_HEIGHT);

      // Key label for C notes
      if (midi % 12 === 0) {
        ctx.fillStyle = '#8888aa';
        ctx.font = '9px monospace';
        ctx.fillText(midiToName(midi), 2, y + KEY_HEIGHT - 1);
      }

      // Grid line
      ctx.strokeStyle = black ? '#252540' : '#1e1e3a';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PIANO_KEY_WIDTH, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();

      // Horizontal rows - alternating shading
      ctx.fillStyle = black ? 'rgba(30, 30, 50, 0.6)' : 'rgba(22, 33, 62, 0.3)';
      ctx.fillRect(PIANO_KEY_WIDTH, y, canvasWidth - PIANO_KEY_WIDTH, KEY_HEIGHT);
    }

    // Draw vertical beat lines
    const beatsVisible = duration + 2;
    for (let beat = 0; beat < beatsVisible; beat++) {
      const x = timeToX(beat);
      const isMeasure = beat % 4 === 0;
      ctx.strokeStyle = isMeasure ? 'rgba(100, 100, 160, 0.5)' : 'rgba(60, 60, 100, 0.3)';
      ctx.lineWidth = isMeasure ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();

      // Beat number for measures
      if (isMeasure) {
        ctx.fillStyle = '#6666aa';
        ctx.font = '9px monospace';
        ctx.fillText(`${beat / 4 + 1}`, x + 2, 10);
      }
    }

    // Draw notes
    notes.forEach((note, idx) => {
      const x = timeToX(note.time);
      const y = midiToY(note.midi);
      const width = Math.max(3, note.duration * PIXELS_PER_SECOND);
      const height = KEY_HEIGHT - 1;

      // Note color based on velocity and track
      const hue = note.track === 1 ? 200 : 280; // Blue for left hand, purple for right
      const lightness = 35 + (note.velocity / 127) * 30;
      const saturation = 60 + (note.velocity / 127) * 30;

      const isSelected = selectedNotes.has(idx);
      const isHovered = hoveredNote === idx;

      ctx.fillStyle = isSelected
        ? `hsl(50, 90%, 60%)`
        : isHovered
        ? `hsl(${hue}, ${saturation}%, ${lightness + 15}%)`
        : `hsl(${hue}, ${saturation}%, ${lightness}%)`;

      // Rounded rectangle
      const radius = 2;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.fill();

      // Border
      ctx.strokeStyle = isSelected
        ? 'rgba(255, 255, 100, 0.8)'
        : `hsl(${hue}, ${saturation}%, ${lightness + 20}%)`;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Velocity indicator (brightness bar at top)
      const velWidth = (note.velocity / 127) * width;
      ctx.fillStyle = `rgba(255, 255, 255, 0.15)`;
      ctx.fillRect(x, y, velWidth, 2);
    });

    // Draw playhead
    if (currentTime > 0 || isPlaying) {
      const playheadX = timeToX(currentTime);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, canvasHeight);
      ctx.stroke();

      // Playhead triangle
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 8);
      ctx.fill();
    }
  }, [notes, currentTime, isPlaying, hoveredNote, selectedNotes, canvasWidth, canvasHeight, duration, midiToY, timeToX]);

  // Auto-scroll to follow playhead
  useEffect(() => {
    if (isPlaying && scrollRef.current) {
      const playheadX = timeToX(currentTime);
      const scrollLeft = scrollRef.current.scrollLeft;
      const viewWidth = scrollRef.current.clientWidth;

      if (playheadX > scrollLeft + viewWidth - 100 || playheadX < scrollLeft) {
        scrollRef.current.scrollLeft = playheadX - 200;
      }
    }
  }, [currentTime, isPlaying, timeToX]);

  // Mouse event handlers for editing
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editable) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0);

    if (tool === 'draw') {
      setIsDrawing(true);
      setDrawStart({ x, y });
    } else if (tool === 'erase') {
      // Find and remove note under cursor
      const time = xToTime(x);
      const midi = yToMidi(y);
      const noteIdx = notes.findIndex(n =>
        n.midi === midi && time >= n.time && time <= n.time + n.duration
      );
      if (noteIdx >= 0 && onNotesChange) {
        const newNotes = [...notes];
        newNotes.splice(noteIdx, 1);
        onNotesChange(newNotes);
      }
    } else {
      // Select tool
      const time = xToTime(x);
      const midi = yToMidi(y);
      const noteIdx = notes.findIndex(n =>
        n.midi === midi && time >= n.time && time <= n.time + n.duration
      );
      if (noteIdx >= 0) {
        if (e.shiftKey) {
          const newSelected = new Set(selectedNotes);
          if (newSelected.has(noteIdx)) newSelected.delete(noteIdx);
          else newSelected.add(noteIdx);
          setSelectedNotes(newSelected);
        } else {
          setSelectedNotes(new Set([noteIdx]));
        }
      } else {
        setSelectedNotes(new Set());
      }
    }
  }, [editable, tool, notes, selectedNotes, onNotesChange, xToTime, yToMidi]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editable || !isDrawing || !drawStart) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
    const y = drawStart.y;

    const time = xToTime(Math.min(drawStart.x, x));
    const midi = yToMidi(y);
    const dur = Math.max(0.1, Math.abs(x - drawStart.x) / PIXELS_PER_SECOND);

    if (onNotesChange) {
      const newNote: PianoNote = { midi, time, duration: dur, velocity: 80 };
      onNotesChange([...notes, newNote]);
    }

    setIsDrawing(false);
    setDrawStart(null);
  }, [editable, isDrawing, drawStart, notes, onNotesChange, xToTime, yToMidi]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
    const y = e.clientY - rect.top + (scrollRef.current?.scrollTop || 0);

    const time = xToTime(x);
    const midi = yToMidi(y);

    const noteIdx = notes.findIndex(n =>
      n.midi === midi && time >= n.time && time <= n.time + n.duration
    );
    setHoveredNote(noteIdx >= 0 ? noteIdx : null);
  }, [notes, xToTime, yToMidi]);

  const handleDeleteSelected = useCallback(() => {
    if (!editable || selectedNotes.size === 0 || !onNotesChange) return;
    const newNotes = notes.filter((_, idx) => !selectedNotes.has(idx));
    onNotesChange(newNotes);
    setSelectedNotes(new Set());
  }, [editable, selectedNotes, notes, onNotesChange]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!editable) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editable, handleDeleteSelected]);

  // Find note range to auto-scroll vertically
  useEffect(() => {
    if (notes.length > 0 && scrollRef.current) {
      const minNote = Math.min(...notes.map(n => n.midi));
      const maxNote = Math.max(...notes.map(n => n.midi));
      const centerMidi = (minNote + maxNote) / 2;
      const centerY = midiToY(centerMidi);
      const viewHeight = scrollRef.current.clientHeight;
      scrollRef.current.scrollTop = centerY - viewHeight / 2;
    }
  }, [notes.length, midiToY]);

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden">
      {/* Toolbar */}
      {editable && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-gray-400 text-sm mr-2">Tools:</span>
          {(['select', 'draw', 'erase'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTool(t)}
              className={`px-3 py-1 rounded text-sm font-medium transition ${
                tool === t
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t === 'select' ? 'Select' : t === 'draw' ? 'Draw' : 'Erase'}
            </button>
          ))}
          {selectedNotes.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="ml-2 px-3 py-1 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition"
            >
              Delete ({selectedNotes.size})
            </button>
          )}
          <div className="ml-auto text-gray-500 text-xs">
            {notes.length} notes | {duration.toFixed(1)}s
          </div>
        </div>
      )}

      {/* Canvas container */}
      <div
        ref={scrollRef}
        className="overflow-auto"
        style={{ maxHeight: editable ? '400px' : '300px' }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className={editable ? 'cursor-crosshair' : 'cursor-default'}
          style={{ display: 'block' }}
        />
      </div>

      {/* Info bar */}
      {!editable && notes.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
          <span>{notes.length} notes</span>
          <span>
            Range: {midiToName(Math.min(...notes.map(n => n.midi)))} -{' '}
            {midiToName(Math.max(...notes.map(n => n.midi)))}
          </span>
          <span>{duration.toFixed(1)}s</span>
        </div>
      )}
    </div>
  );
}
