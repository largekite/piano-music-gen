'use client';

import { useState, useRef } from 'react';
import { useGeneration } from '@/lib/hooks/useGeneration';
import GenerationForm from '@/components/GenerationForm';
import ProgressDisplay from '@/components/ProgressDisplay';
import ResultCard from '@/components/ResultCard';
import PianoRoll, { PianoNote } from '@/components/PianoRoll';
import SheetMusic, { KeySignature } from '@/components/SheetMusic';
import PracticeMode from '@/components/PracticeMode';
import Link from 'next/link';

function ComposeFromScratch() {
  const [notes, setNotes] = useState<PianoNote[]>([]);
  const [tempo, setTempo] = useState(120);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ fileId: string; filename: string } | null>(null);
  const [viewMode, setViewMode] = useState<'piano-roll' | 'sheet' | 'practice'>('piano-roll');
  const [keySignature, setKeySignature] = useState<KeySignature>('C major');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);

  const duration = notes.length > 0
    ? Math.max(...notes.map(n => n.time + n.duration)) + 4
    : 32; // Default 8 bars at 120bpm

  const handleSaveNew = async () => {
    if (notes.length === 0) return;
    setIsSaving(true);
    setSaveResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // First generate a minimal MIDI to get a file ID, then update it with our notes
      const genResponse = await fetch(`${apiUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parameters: {
            backend: 'simple',
            style: 'Classical',
            key: 'C major',
            tempo,
            mood: 'Happy',
            duration: '30 sec',
          },
        }),
      });

      if (!genResponse.ok) throw new Error('Failed to create file');
      const job = await genResponse.json();

      // Wait for generation to complete
      let fileId = '';
      let filename = '';
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 500));
        const statusRes = await fetch(`${apiUrl}/api/generate/${job.job_id}/status`);
        const status = await statusRes.json();
        if (status.status === 'completed' && status.result) {
          fileId = status.result.file_id;
          filename = status.result.filename;
          break;
        }
        if (status.status === 'failed') throw new Error('Generation failed');
      }

      if (!fileId) throw new Error('Timed out');

      // Now overwrite with our composed notes
      const editResponse = await fetch(`${apiUrl}/api/files/${fileId}/notes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notes.map(n => ({
            midi: n.midi,
            time: n.time,
            duration: n.duration,
            velocity: n.velocity || 80,
          })),
          tempo,
        }),
      });

      if (!editResponse.ok) throw new Error('Failed to save notes');
      setSaveResult({ fileId, filename });
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const downloadUrl = saveResult
    ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/files/${saveResult.fileId}/download`
    : null;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-lg text-gray-800">Compose from Scratch</h2>
            <p className="text-sm text-gray-500">
              Use the piano roll editor below. Select the Draw tool, set snap grid, and click/drag to place notes.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-sm">
              <label htmlFor="scratch-tempo" className="text-gray-600">Tempo:</label>
              <input
                id="scratch-tempo"
                type="number"
                min="40" max="300"
                value={tempo}
                onChange={e => setTempo(Math.max(40, Math.min(300, parseInt(e.target.value) || 120)))}
                className="w-16 px-2 py-1 border rounded text-sm"
              />
              <span className="text-gray-500">BPM</span>
            </div>
            <button
              onClick={handleSaveNew}
              disabled={isSaving || notes.length === 0}
              className="px-4 py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 transition disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save as MIDI'}
            </button>
          </div>
        </div>

        {saveResult && downloadUrl && (
          <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
            <span className="text-green-700 text-sm">Saved! {saveResult.filename}</span>
            <a
              href={downloadUrl}
              download={saveResult.filename}
              className="text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition"
            >
              Download MIDI
            </a>
          </div>
        )}
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        {(['piano-roll', 'sheet', 'practice'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              viewMode === mode
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {mode === 'piano-roll' ? 'Piano Roll' : mode === 'sheet' ? 'Sheet Music' : 'Practice'}
          </button>
        ))}
      </div>

      {/* Piano Roll Editor */}
      {viewMode === 'piano-roll' && (
        <PianoRoll
          notes={notes}
          duration={duration}
          currentTime={playbackTime}
          isPlaying={isPlaying}
          editable={true}
          onNotesChange={setNotes}
        />
      )}

      {/* Sheet Music View */}
      {viewMode === 'sheet' && (
        <SheetMusic
          notes={notes}
          tempo={tempo}
          currentTime={playbackTime}
          isPlaying={isPlaying}
          keySignature={keySignature}
          onNotesChange={setNotes}
          onKeySignatureChange={setKeySignature}
        />
      )}

      {/* Practice Mode */}
      {viewMode === 'practice' && (
        <PracticeMode notes={notes} tempo={tempo} />
      )}

      {/* Playback for composed notes */}
      {notes.length > 0 && (
        <ScratchPlayer
          notes={notes}
          tempo={tempo}
          isPlaying={isPlaying}
          progress={playbackTime}
          onIsPlayingChange={setIsPlaying}
          onProgressChange={setPlaybackTime}
        />
      )}
    </div>
  );
}

// Lightweight player for scratch compositions (no MIDI file needed)
interface ScratchPlayerProps {
  notes: PianoNote[];
  tempo: number;
  isPlaying: boolean;
  progress: number;
  onIsPlayingChange: (playing: boolean) => void;
  onProgressChange: (time: number) => void;
}

function ScratchPlayer({ notes, tempo, isPlaying, progress, onIsPlayingChange, onProgressChange }: ScratchPlayerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const synthRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const duration = Math.max(...notes.map(n => n.time + n.duration));

  const cleanup = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (synthRef.current) {
      synthRef.current.dispose();
      synthRef.current = null;
    }
  };

  const handlePlay = async () => {
    const Tone = await import('tone');
    await Tone.start();

    if (isPlaying) {
      Tone.Transport.stop();
      Tone.Transport.cancel();
      cleanup();
      onIsPlayingChange(false);
      onProgressChange(0);
      return;
    }

    const synth = new Tone.PolySynth(Tone.Synth, {
      volume: -8,
      oscillator: { type: 'fmtriangle' as const, modulationType: 'sine' as const, harmonicity: 3.01, modulationIndex: 14 },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 1.5 },
    }).toDestination();
    synthRef.current = synth;

    const now = Tone.now();
    notes.forEach(note => {
      const vel = (note.velocity || 80) / 127;
      synth.triggerAttackRelease(
        Tone.Frequency(note.midi, 'midi').toFrequency(),
        Math.max(0.01, note.duration),
        now + note.time,
        vel
      );
    });

    onIsPlayingChange(true);
    const startTime = Tone.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Tone.now() - startTime;
      onProgressChange(elapsed);
      if (elapsed > duration + 0.5) {
        cleanup();
        onIsPlayingChange(false);
        onProgressChange(0);
      }
    }, 50);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="bg-white rounded-lg shadow p-4 flex items-center gap-3">
      <button
        onClick={handlePlay}
        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-2 px-5 rounded-lg shadow transition"
      >
        {isPlaying ? 'Stop' : 'Play'}
      </button>
      <div className="flex-1">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all"
            style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <span className="text-xs text-gray-500">{notes.length} notes | {tempo} BPM</span>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'generate' | 'compose'>('generate');
  const {
    generate,
    reset,
    isGenerating,
    progress,
    stage,
    message,
    result,
    error,
    isConnected,
  } = useGeneration();

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Piano Music Studio
              </h1>
              <p className="text-gray-600 mt-1">Generate, compose, visualize, and edit piano music</p>
            </div>

            {/* Connection Status */}
            <div className="mt-4 md:mt-0">
              <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="flex space-x-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-6 py-3 font-medium transition border-b-2 ${
              activeTab === 'generate'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Generate Music
          </button>
          <button
            onClick={() => setActiveTab('compose')}
            className={`px-6 py-3 font-medium transition border-b-2 ${
              activeTab === 'compose'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Compose from Scratch
          </button>
          <Link
            href="/files"
            className="px-6 py-3 font-medium transition border-b-2 border-transparent text-gray-500 hover:text-gray-700"
          >
            Generated Files
          </Link>
        </div>

        {/* Generate Tab */}
        {activeTab === 'generate' && (
          <div className="space-y-6">
            <GenerationForm
              onGenerate={generate}
              isGenerating={isGenerating}
            />

            <ProgressDisplay
              isGenerating={isGenerating}
              progress={progress}
              stage={stage}
              message={message}
              error={error}
            />

            {result && !isGenerating && (
              <div>
                <ResultCard result={result} />
                <button
                  onClick={reset}
                  className="mt-4 w-full md:w-auto bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg transition"
                >
                  Generate Another
                </button>
              </div>
            )}
          </div>
        )}

        {/* Compose Tab */}
        {activeTab === 'compose' && (
          <ComposeFromScratch />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-gray-600 text-sm">
          <p>Piano Music Studio - Generate, Compose, Visualize & Edit</p>
        </div>
      </footer>
    </div>
  );
}
