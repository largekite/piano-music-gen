'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';

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
const PIANO_KEY_WIDTH = 48;
const SNAP_VALUES = [
  { label: 'Off', value: 0 },
  { label: '1/16', value: 0.25 },
  { label: '1/8', value: 0.5 },
  { label: '1/4', value: 1.0 },
  { label: '1/2', value: 2.0 },
  { label: '1 bar', value: 4.0 },
];
const ZOOM_LEVELS = [40, 60, 80, 120, 160, 240];
const MAX_UNDO = 50;

function midiToName(midi: number): string {
  const note = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

function isBlackKey(midi: number): boolean {
  const n = midi % 12;
  return [1, 3, 6, 8, 10].includes(n);
}

function snapToGrid(value: number, gridSize: number): number {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
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
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set());
  const [tool, setTool] = useState<'select' | 'draw' | 'erase'>('select');
  const [snapValue, setSnapValue] = useState(0.5); // 1/8 note default
  const [zoomIndex, setZoomIndex] = useState(2); // 80px/s default
  const [keyHeight, setKeyHeight] = useState(10);
  const [drawVelocity, setDrawVelocity] = useState(80);
  const [showHelp, setShowHelp] = useState(false);

  // Undo/redo stacks
  const [undoStack, setUndoStack] = useState<PianoNote[][]>([]);
  const [redoStack, setRedoStack] = useState<PianoNote[][]>([]);

  // Drag state
  const [dragState, setDragState] = useState<{
    type: 'draw' | 'move' | 'select-rect' | null;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    origNotes?: PianoNote[]; // original positions for move
    preMoveFull?: PianoNote[]; // full notes snapshot before move started (for undo)
  } | null>(null);

  const pixelsPerSecond = ZOOM_LEVELS[zoomIndex];
  const totalKeys = MAX_MIDI - MIN_MIDI + 1;
  const canvasHeight = totalKeys * keyHeight;
  const canvasWidth = Math.max(800, (duration + 8) * pixelsPerSecond + PIANO_KEY_WIDTH);

  const midiToY = useCallback((midi: number) => (MAX_MIDI - midi) * keyHeight, [keyHeight]);
  const yToMidi = useCallback((y: number) => MAX_MIDI - Math.floor(y / keyHeight), [keyHeight]);
  const timeToX = useCallback((time: number) => PIANO_KEY_WIDTH + time * pixelsPerSecond, [pixelsPerSecond]);
  const xToTime = useCallback((x: number) => Math.max(0, (x - PIANO_KEY_WIDTH) / pixelsPerSecond), [pixelsPerSecond]);

  // Push current state to undo stack
  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-MAX_UNDO + 1), [...notes]]);
    setRedoStack([]);
  }, [notes]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0 || !onNotesChange) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, [...notes]]);
    setUndoStack(u => u.slice(0, -1));
    onNotesChange(prev);
    setSelectedNotes(new Set());
  }, [undoStack, notes, onNotesChange]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0 || !onNotesChange) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, [...notes]]);
    setRedoStack(r => r.slice(0, -1));
    onNotesChange(next);
    setSelectedNotes(new Set());
  }, [redoStack, notes, onNotesChange]);

  // Find note under cursor
  const findNoteAt = useCallback((time: number, midi: number): number => {
    return notes.findIndex(n =>
      n.midi === midi && time >= n.time && time <= n.time + n.duration
    );
  }, [notes]);

  // Compute drag preview for drawing
  const drawPreview = useMemo(() => {
    if (!dragState || dragState.type !== 'draw') return null;
    const startTime = xToTime(Math.min(dragState.startX, dragState.currentX));
    const endTime = xToTime(Math.max(dragState.startX, dragState.currentX));
    const midi = yToMidi(dragState.startY);
    const t = snapValue > 0 ? snapToGrid(startTime, snapValue) : startTime;
    const dur = Math.max(snapValue || 0.1, snapValue > 0
      ? snapToGrid(endTime - startTime, snapValue)
      : endTime - startTime);
    return { midi, time: t, duration: dur };
  }, [dragState, xToTime, yToMidi, snapValue]);

  // Selection rectangle
  const selectRect = useMemo(() => {
    if (!dragState || dragState.type !== 'select-rect') return null;
    const x1 = Math.min(dragState.startX, dragState.currentX);
    const x2 = Math.max(dragState.startX, dragState.currentX);
    const y1 = Math.min(dragState.startY, dragState.currentY);
    const y2 = Math.max(dragState.startY, dragState.currentY);
    return { x1, y1, x2, y2 };
  }, [dragState]);

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

    // Draw piano keys
    for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
      const y = midiToY(midi);
      const black = isBlackKey(midi);

      ctx.fillStyle = black ? '#2d2d44' : '#16213e';
      ctx.fillRect(0, y, PIANO_KEY_WIDTH, keyHeight);

      if (midi % 12 === 0) {
        ctx.fillStyle = '#8888aa';
        ctx.font = `${Math.min(keyHeight - 1, 10)}px monospace`;
        ctx.fillText(midiToName(midi), 2, y + keyHeight - 1);
      }

      // Grid row
      ctx.fillStyle = black ? 'rgba(30, 30, 50, 0.6)' : 'rgba(22, 33, 62, 0.3)';
      ctx.fillRect(PIANO_KEY_WIDTH, y, canvasWidth - PIANO_KEY_WIDTH, keyHeight);

      ctx.strokeStyle = black ? '#252540' : '#1e1e3a';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(PIANO_KEY_WIDTH, y + keyHeight);
      ctx.lineTo(canvasWidth, y + keyHeight);
      ctx.stroke();
    }

    // Draw vertical grid lines (snap-aware)
    const gridStep = snapValue > 0 ? snapValue : 1.0;
    const totalTime = duration + 8;
    for (let t = 0; t < totalTime; t += gridStep) {
      const x = timeToX(t);
      const isMeasure = Math.abs(t % 4) < 0.001;
      const isBeat = Math.abs(t % 1) < 0.001;

      if (isMeasure) {
        ctx.strokeStyle = 'rgba(100, 100, 160, 0.6)';
        ctx.lineWidth = 1.5;
      } else if (isBeat) {
        ctx.strokeStyle = 'rgba(80, 80, 130, 0.4)';
        ctx.lineWidth = 0.8;
      } else {
        ctx.strokeStyle = 'rgba(60, 60, 100, 0.2)';
        ctx.lineWidth = 0.5;
      }

      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();

      if (isMeasure) {
        ctx.fillStyle = '#6666aa';
        ctx.font = '10px monospace';
        ctx.fillText(`${Math.round(t / 4) + 1}`, x + 3, 12);
      }
    }

    // Draw notes
    notes.forEach((note, idx) => {
      const x = timeToX(note.time);
      const y = midiToY(note.midi);
      const width = Math.max(3, note.duration * pixelsPerSecond);
      const height = keyHeight - 1;

      const hue = note.track === 1 ? 200 : 280;
      const lightness = 35 + (note.velocity / 127) * 30;
      const saturation = 60 + (note.velocity / 127) * 30;
      const isSelected = selectedNotes.has(idx);

      ctx.fillStyle = isSelected
        ? `hsl(50, 90%, 60%)`
        : `hsl(${hue}, ${saturation}%, ${lightness}%)`;

      const radius = Math.min(2, height / 3);
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

      ctx.strokeStyle = isSelected
        ? 'rgba(255, 255, 100, 0.8)'
        : `hsl(${hue}, ${saturation}%, ${lightness + 20}%)`;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Velocity bar
      const velHeight = Math.max(1, (note.velocity / 127) * height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(x + 1, y + height - velHeight, width - 2, velHeight);

      // Note name if tall enough
      if (keyHeight >= 12 && width > 20) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = `${Math.min(keyHeight - 3, 9)}px monospace`;
        ctx.fillText(midiToName(note.midi), x + 3, y + height - 2);
      }
    });

    // Draw preview
    if (drawPreview) {
      const x = timeToX(drawPreview.time);
      const y = midiToY(drawPreview.midi);
      const width = Math.max(3, drawPreview.duration * pixelsPerSecond);
      ctx.fillStyle = 'rgba(140, 100, 255, 0.5)';
      ctx.fillRect(x, y, width, keyHeight - 1);
      ctx.strokeStyle = 'rgba(180, 140, 255, 0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, keyHeight - 1);
    }

    // Draw selection rectangle
    if (selectRect) {
      ctx.fillStyle = 'rgba(100, 100, 255, 0.1)';
      ctx.fillRect(selectRect.x1, selectRect.y1,
        selectRect.x2 - selectRect.x1, selectRect.y2 - selectRect.y1);
      ctx.strokeStyle = 'rgba(100, 100, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(selectRect.x1, selectRect.y1,
        selectRect.x2 - selectRect.x1, selectRect.y2 - selectRect.y1);
      ctx.setLineDash([]);
    }

    // Playhead
    if (currentTime > 0 || isPlaying) {
      const playheadX = timeToX(currentTime);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, canvasHeight);
      ctx.stroke();

      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 8);
      ctx.fill();
    }
  }, [notes, currentTime, isPlaying, selectedNotes, canvasWidth, canvasHeight,
      duration, midiToY, timeToX, keyHeight, pixelsPerSecond, drawPreview, selectRect, snapValue]);

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

  // Get canvas coordinates from mouse event
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0),
      y: e.clientY - rect.top + (scrollRef.current?.scrollTop || 0),
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editable) return;
    const { x, y } = getCanvasCoords(e);
    const time = xToTime(x);
    const midi = yToMidi(y);

    if (tool === 'draw') {
      setDragState({ type: 'draw', startX: x, startY: y, currentX: x, currentY: y });
    } else if (tool === 'erase') {
      const noteIdx = findNoteAt(time, midi);
      if (noteIdx >= 0 && onNotesChange) {
        pushUndo();
        const newNotes = [...notes];
        newNotes.splice(noteIdx, 1);
        onNotesChange(newNotes);
      }
    } else {
      // Select tool
      const noteIdx = findNoteAt(time, midi);
      if (noteIdx >= 0) {
        if (e.shiftKey) {
          const newSelected = new Set(selectedNotes);
          if (newSelected.has(noteIdx)) newSelected.delete(noteIdx);
          else newSelected.add(noteIdx);
          setSelectedNotes(newSelected);
        } else if (!selectedNotes.has(noteIdx)) {
          setSelectedNotes(new Set([noteIdx]));
        }
        // Start move drag — save full snapshot for undo
        const activeSelection = selectedNotes.has(noteIdx) ? selectedNotes : new Set([noteIdx]);
        const origNotes = Array.from(activeSelection).map(i => ({ ...notes[i] }));
        setDragState({
          type: 'move', startX: x, startY: y, currentX: x, currentY: y,
          origNotes,
          preMoveFull: notes.map(n => ({ ...n })),
        });
      } else {
        // Start selection rectangle
        if (!e.shiftKey) setSelectedNotes(new Set());
        setDragState({ type: 'select-rect', startX: x, startY: y, currentX: x, currentY: y });
      }
    }
  }, [editable, tool, notes, selectedNotes, onNotesChange, getCanvasCoords, xToTime, yToMidi, findNoteAt, pushUndo]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState) return;
    const { x, y } = getCanvasCoords(e);
    setDragState(prev => prev ? { ...prev, currentX: x, currentY: y } : null);

    // Live move of selected notes
    if (dragState.type === 'move' && onNotesChange && dragState.origNotes) {
      const deltaTime = xToTime(x) - xToTime(dragState.startX);
      const deltaMidi = yToMidi(y) - yToMidi(dragState.startY);

      const selectedArr = Array.from(selectedNotes);
      const newNotes = [...notes];
      selectedArr.forEach((idx, i) => {
        if (dragState.origNotes && dragState.origNotes[i]) {
          const orig = dragState.origNotes[i];
          let newTime = orig.time + deltaTime;
          let newMidi = orig.midi + deltaMidi;

          if (snapValue > 0) newTime = snapToGrid(newTime, snapValue);
          newTime = Math.max(0, newTime);
          newMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, newMidi));

          newNotes[idx] = { ...newNotes[idx], time: newTime, midi: newMidi };
        }
      });
      onNotesChange(newNotes);
    }

    // Update selection rect
    if (dragState.type === 'select-rect') {
      const x1 = Math.min(dragState.startX, x);
      const x2 = Math.max(dragState.startX, x);
      const y1 = Math.min(dragState.startY, y);
      const y2 = Math.max(dragState.startY, y);

      const newSelected = new Set<number>();
      notes.forEach((note, idx) => {
        const nx = timeToX(note.time);
        const ny = midiToY(note.midi);
        const nw = note.duration * pixelsPerSecond;
        // Note intersects rect?
        if (nx + nw >= x1 && nx <= x2 && ny + keyHeight >= y1 && ny <= y2) {
          newSelected.add(idx);
        }
      });
      setSelectedNotes(newSelected);
    }
  }, [dragState, getCanvasCoords, notes, selectedNotes, onNotesChange, xToTime, yToMidi,
      snapValue, timeToX, midiToY, pixelsPerSecond, keyHeight]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState) return;

    if (dragState.type === 'draw' && onNotesChange) {
      const { x } = getCanvasCoords(e);
      const startTime = xToTime(Math.min(dragState.startX, x));
      const endTime = xToTime(Math.max(dragState.startX, x));
      const midi = yToMidi(dragState.startY);

      let t = snapValue > 0 ? snapToGrid(startTime, snapValue) : startTime;
      let dur = endTime - startTime;
      if (snapValue > 0) dur = Math.max(snapValue, snapToGrid(dur, snapValue));
      else dur = Math.max(0.1, dur);

      if (dur < 0.05) dur = snapValue > 0 ? snapValue : 0.25; // click = place single note

      pushUndo();
      onNotesChange([...notes, { midi, time: t, duration: dur, velocity: drawVelocity }]);
    }

    if (dragState.type === 'move' && dragState.preMoveFull) {
      // Push the pre-move snapshot so undo restores to before the drag
      setUndoStack(prev => [...prev.slice(-MAX_UNDO + 1), dragState.preMoveFull!]);
      setRedoStack([]);
    }

    setDragState(null);
  }, [dragState, getCanvasCoords, onNotesChange, notes, xToTime, yToMidi, snapValue, drawVelocity, pushUndo]);

  // Delete selected
  const handleDeleteSelected = useCallback(() => {
    if (!editable || selectedNotes.size === 0 || !onNotesChange) return;
    pushUndo();
    onNotesChange(notes.filter((_, idx) => !selectedNotes.has(idx)));
    setSelectedNotes(new Set());
  }, [editable, selectedNotes, notes, onNotesChange, pushUndo]);

  // Select all
  const handleSelectAll = useCallback(() => {
    setSelectedNotes(new Set(notes.map((_, i) => i)));
  }, [notes]);

  // Transpose selected
  const handleTranspose = useCallback((semitones: number) => {
    if (selectedNotes.size === 0 || !onNotesChange) return;
    pushUndo();
    const newNotes = notes.map((note, idx) => {
      if (selectedNotes.has(idx)) {
        const newMidi = Math.max(MIN_MIDI, Math.min(MAX_MIDI, note.midi + semitones));
        return { ...note, midi: newMidi };
      }
      return note;
    });
    onNotesChange(newNotes);
  }, [selectedNotes, notes, onNotesChange, pushUndo]);

  // Quantize selected
  const handleQuantize = useCallback(() => {
    if (snapValue <= 0 || !onNotesChange) return;
    pushUndo();
    const targetIdxs = selectedNotes.size > 0 ? selectedNotes : new Set(notes.map((_, i) => i));
    const newNotes = notes.map((note, idx) => {
      if (targetIdxs.has(idx)) {
        return {
          ...note,
          time: snapToGrid(note.time, snapValue),
          duration: Math.max(snapValue, snapToGrid(note.duration, snapValue)),
        };
      }
      return note;
    });
    onNotesChange(newNotes);
  }, [snapValue, notes, selectedNotes, onNotesChange, pushUndo]);

  // Set velocity on selected
  const handleSetVelocity = useCallback((vel: number) => {
    if (selectedNotes.size === 0 || !onNotesChange) return;
    pushUndo();
    const newNotes = notes.map((note, idx) => {
      if (selectedNotes.has(idx)) return { ...note, velocity: vel };
      return note;
    });
    onNotesChange(newNotes);
  }, [selectedNotes, notes, onNotesChange, pushUndo]);

  // Duplicate selected
  const handleDuplicate = useCallback(() => {
    if (selectedNotes.size === 0 || !onNotesChange) return;
    pushUndo();
    const selected = Array.from(selectedNotes).map(i => notes[i]);
    const maxTime = Math.max(...selected.map(n => n.time + n.duration));
    const minTime = Math.min(...selected.map(n => n.time));
    const offset = maxTime - minTime;

    const duplicated = selected.map(n => ({
      ...n,
      time: n.time + offset,
    }));
    const newNotes = [...notes, ...duplicated];
    // Select only duplicated
    const newSelected = new Set(duplicated.map((_, i) => notes.length + i));
    onNotesChange(newNotes);
    setSelectedNotes(newSelected);
  }, [selectedNotes, notes, onNotesChange, pushUndo]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!editable) return;
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNotes.size > 0) {
        e.preventDefault();
        handleDeleteSelected();
      } else if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        handleSelectAll();
      } else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        handleDuplicate();
      } else if (e.key === 'ArrowUp' && selectedNotes.size > 0) {
        e.preventDefault();
        handleTranspose(e.shiftKey ? 12 : 1);
      } else if (e.key === 'ArrowDown' && selectedNotes.size > 0) {
        e.preventDefault();
        handleTranspose(e.shiftKey ? -12 : -1);
      } else if (e.key === 'q') {
        handleQuantize();
      } else if (e.key === '1') setTool('select');
      else if (e.key === '2') setTool('draw');
      else if (e.key === '3') setTool('erase');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [editable, selectedNotes, handleDeleteSelected, handleUndo, handleRedo,
      handleSelectAll, handleDuplicate, handleTranspose, handleQuantize]);

  // Zoom with scroll wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) setZoomIndex(z => Math.min(ZOOM_LEVELS.length - 1, z + 1));
      else setZoomIndex(z => Math.max(0, z - 1));
    }
  }, []);

  // Auto-scroll to note range on initial load
  useEffect(() => {
    if (notes.length > 0 && scrollRef.current) {
      const minNote = Math.min(...notes.map(n => n.midi));
      const maxNote = Math.max(...notes.map(n => n.midi));
      const centerMidi = (minNote + maxNote) / 2;
      const centerY = midiToY(centerMidi);
      const viewHeight = scrollRef.current.clientHeight;
      scrollRef.current.scrollTop = centerY - viewHeight / 2;
    }
  // Only on first load
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notes.length === 0 ? 0 : 1]);

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg overflow-hidden">
      {/* Toolbar */}
      {editable && (
        <div className="flex flex-wrap items-center gap-1 px-3 py-2 bg-gray-800 border-b border-gray-700">
          {/* Tools */}
          <div className="flex items-center gap-1 mr-2">
            {([['select', 'Select (1)'], ['draw', 'Draw (2)'], ['erase', 'Erase (3)']] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setTool(t)}
                title={label}
                className={`px-2 py-1 rounded text-xs font-medium transition ${
                  tool === t
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {t === 'select' ? 'Sel' : t === 'draw' ? 'Draw' : 'Del'}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-600 mx-1" />

          {/* Snap */}
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-xs">Snap:</span>
            <select
              value={snapValue}
              onChange={e => setSnapValue(parseFloat(e.target.value))}
              className="bg-gray-700 text-gray-200 text-xs rounded px-1 py-0.5 border-gray-600"
            >
              {SNAP_VALUES.map(s => (
                <option key={s.label} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-5 bg-gray-600 mx-1" />

          {/* Velocity */}
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-xs">Vel:</span>
            <input
              type="range" min="1" max="127" value={drawVelocity}
              onChange={e => setDrawVelocity(parseInt(e.target.value))}
              className="w-16 h-1 accent-purple-500"
              title={`Velocity: ${drawVelocity}`}
            />
            <span className="text-gray-400 text-xs w-6">{drawVelocity}</span>
          </div>

          <div className="w-px h-5 bg-gray-600 mx-1" />

          {/* Zoom */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoomIndex(z => Math.max(0, z - 1))}
              className="text-gray-400 hover:text-white text-xs px-1"
              title="Zoom out"
            >-</button>
            <span className="text-gray-400 text-xs">{Math.round(pixelsPerSecond / 80 * 100)}%</span>
            <button
              onClick={() => setZoomIndex(z => Math.min(ZOOM_LEVELS.length - 1, z + 1))}
              className="text-gray-400 hover:text-white text-xs px-1"
              title="Zoom in"
            >+</button>
          </div>

          <div className="w-px h-5 bg-gray-600 mx-1" />

          {/* Row height */}
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-xs">H:</span>
            <button
              onClick={() => setKeyHeight(h => Math.max(4, h - 2))}
              className="text-gray-400 hover:text-white text-xs px-1"
            >-</button>
            <button
              onClick={() => setKeyHeight(h => Math.min(20, h + 2))}
              className="text-gray-400 hover:text-white text-xs px-1"
            >+</button>
          </div>

          <div className="w-px h-5 bg-gray-600 mx-1" />

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="text-gray-400 hover:text-white text-xs px-1 disabled:opacity-30"
              title="Undo (Ctrl+Z)"
            >Undo</button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="text-gray-400 hover:text-white text-xs px-1 disabled:opacity-30"
              title="Redo (Ctrl+Y)"
            >Redo</button>
          </div>

          {selectedNotes.size > 0 && (
            <>
              <div className="w-px h-5 bg-gray-600 mx-1" />
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDeleteSelected}
                  className="px-2 py-0.5 rounded text-xs bg-red-700 text-white hover:bg-red-600"
                  title="Delete selected (Del)"
                >Del {selectedNotes.size}</button>
                <button
                  onClick={handleDuplicate}
                  className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600"
                  title="Duplicate (Ctrl+D)"
                >Dup</button>
                <button
                  onClick={handleQuantize}
                  className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600"
                  title="Quantize to grid (Q)"
                >Qtz</button>
                <button
                  onClick={() => handleTranspose(1)}
                  className="px-1 py-0.5 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600"
                  title="Transpose up (Arrow Up)"
                >+1</button>
                <button
                  onClick={() => handleTranspose(-1)}
                  className="px-1 py-0.5 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600"
                  title="Transpose down (Arrow Down)"
                >-1</button>
                <button
                  onClick={() => handleTranspose(12)}
                  className="px-1 py-0.5 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600"
                  title="Transpose up octave (Shift+Up)"
                >+8va</button>
                <button
                  onClick={() => handleTranspose(-12)}
                  className="px-1 py-0.5 rounded text-xs bg-gray-700 text-gray-300 hover:bg-gray-600"
                  title="Transpose down octave (Shift+Down)"
                >-8va</button>
              </div>
              {/* Velocity for selected */}
              <div className="flex items-center gap-1 ml-1">
                <span className="text-gray-400 text-xs">Set vel:</span>
                <input
                  type="range" min="1" max="127"
                  value={selectedNotes.size > 0 ? notes[Array.from(selectedNotes)[0]]?.velocity ?? 80 : 80}
                  onChange={e => handleSetVelocity(parseInt(e.target.value))}
                  className="w-14 h-1 accent-yellow-500"
                />
              </div>
            </>
          )}

          {/* Help toggle */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="ml-auto text-gray-400 hover:text-white text-xs px-1"
            title="Keyboard shortcuts"
          >?</button>

          <span className="text-gray-500 text-xs">{notes.length} notes</span>
        </div>
      )}

      {/* Help panel */}
      {showHelp && editable && (
        <div className="px-4 py-2 bg-gray-850 border-b border-gray-700 text-xs text-gray-400 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1" style={{ background: '#1e1e30' }}>
          <span><kbd className="bg-gray-700 px-1 rounded">1</kbd> Select tool</span>
          <span><kbd className="bg-gray-700 px-1 rounded">2</kbd> Draw tool</span>
          <span><kbd className="bg-gray-700 px-1 rounded">3</kbd> Erase tool</span>
          <span><kbd className="bg-gray-700 px-1 rounded">Del</kbd> Delete selected</span>
          <span><kbd className="bg-gray-700 px-1 rounded">Ctrl+Z</kbd> Undo</span>
          <span><kbd className="bg-gray-700 px-1 rounded">Ctrl+Y</kbd> Redo</span>
          <span><kbd className="bg-gray-700 px-1 rounded">Ctrl+A</kbd> Select all</span>
          <span><kbd className="bg-gray-700 px-1 rounded">Ctrl+D</kbd> Duplicate</span>
          <span><kbd className="bg-gray-700 px-1 rounded">Up/Down</kbd> Transpose +-1</span>
          <span><kbd className="bg-gray-700 px-1 rounded">Shift+Up/Down</kbd> Transpose +-octave</span>
          <span><kbd className="bg-gray-700 px-1 rounded">Q</kbd> Quantize</span>
          <span><kbd className="bg-gray-700 px-1 rounded">Ctrl+Scroll</kbd> Zoom</span>
          <span>Drag in select mode: move notes</span>
          <span>Drag on empty: rectangle select</span>
          <span>Shift+click: toggle selection</span>
          <span>Velocity slider: set for drawn/selected notes</span>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={scrollRef}
        className="overflow-auto"
        style={{ maxHeight: editable ? '450px' : '300px' }}
        onWheel={handleWheel}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            if (dragState) {
              // For move drags, push undo snapshot before cancelling
              if (dragState.type === 'move' && dragState.preMoveFull) {
                setUndoStack(prev => [...prev.slice(-MAX_UNDO + 1), dragState.preMoveFull!]);
                setRedoStack([]);
              }
              setDragState(null);
            }
          }}
          className={editable ? (tool === 'draw' ? 'cursor-crosshair' : tool === 'erase' ? 'cursor-pointer' : 'cursor-default') : 'cursor-default'}
          style={{ display: 'block' }}
        />
      </div>

      {/* Info bar (read-only mode) */}
      {!editable && notes.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
          <span>{notes.length} notes</span>
          <span>
            Range: {midiToName(Math.min(...notes.map(n => n.midi)))} - {midiToName(Math.max(...notes.map(n => n.midi)))}
          </span>
          <span>{duration.toFixed(1)}s</span>
        </div>
      )}
    </div>
  );
}
