'use client';

import { useState, useRef, useEffect } from 'react';
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
    : 32;

  const handleSaveNew = async () => {
    if (notes.length === 0) return;
    setIsSaving(true);
    setSaveResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

  const viewModes = [
    { key: 'piano-roll' as const, label: 'Piano Roll', icon: '\u2630' },
    { key: 'sheet' as const, label: 'Sheet Music', icon: '\u266B' },
    { key: 'practice' as const, label: 'Practice', icon: '\u2022' },
  ];

  return (
    <div className="space-y-5">
      {/* Compose header card */}
      <div className="rounded-2xl bg-white/80 backdrop-blur border border-warm-200 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
          <div>
            <h2 className="font-bold text-lg text-warm-600">Your Canvas</h2>
            <p className="text-sm text-stone-500">
              Draw notes on the piano roll, view as sheet music, or practice along.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm">
              <label htmlFor="scratch-tempo" className="text-stone-500">Tempo</label>
              <input
                id="scratch-tempo"
                type="number"
                min="40" max="300"
                value={tempo}
                onChange={e => setTempo(Math.max(40, Math.min(300, parseInt(e.target.value) || 120)))}
                className="w-16 px-2 py-1.5 border border-warm-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-coral-300 focus:border-transparent outline-none"
              />
              <span className="text-stone-400 text-xs">BPM</span>
            </div>
            <button
              onClick={handleSaveNew}
              disabled={isSaving || notes.length === 0}
              className="px-4 py-2 rounded-xl font-semibold text-sm bg-coral-400 text-white hover:bg-coral-500 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              {isSaving ? 'Saving...' : 'Save as MIDI'}
            </button>
          </div>
        </div>

        {saveResult && downloadUrl && (
          <div className="mt-3 p-3 bg-mint-50 border border-mint-200 rounded-xl flex items-center justify-between">
            <span className="text-mint-500 text-sm font-medium">Saved! {saveResult.filename}</span>
            <a
              href={downloadUrl}
              download={saveResult.filename}
              className="text-sm px-3 py-1.5 bg-mint-400 text-white rounded-lg hover:bg-mint-500 transition font-medium"
            >
              Download
            </a>
          </div>
        )}
      </div>

      {/* View mode pills */}
      <div className="flex gap-1.5 bg-warm-100 rounded-xl p-1 w-fit">
        {viewModes.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              viewMode === key
                ? 'bg-white text-coral-500 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            <span className="mr-1.5">{icon}</span>{label}
          </button>
        ))}
      </div>

      {/* Editor / View */}
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

      {viewMode === 'practice' && (
        <PracticeMode notes={notes} tempo={tempo} />
      )}

      {/* Playback */}
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

// Lightweight player for scratch compositions
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

  // Cleanup on unmount to prevent interval/synth leaks
  useEffect(() => {
    return () => { cleanup(); };
  }, []);

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
    <div className="rounded-2xl bg-white/80 backdrop-blur border border-warm-200 p-4 flex items-center gap-4 shadow-sm">
      <button
        onClick={handlePlay}
        className="w-12 h-12 rounded-full bg-coral-400 hover:bg-coral-500 active:scale-90 text-white flex items-center justify-center transition-all shadow-md"
      >
        {isPlaying ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="4" height="12" rx="1" />
            <rect x="9" y="2" width="4" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 2.5v11l9-5.5z" />
          </svg>
        )}
      </button>
      <div className="flex-1">
        <div className="w-full bg-warm-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-coral-400 to-warm-400 h-2 rounded-full transition-all"
            style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-stone-400 mt-1.5">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <div className="text-xs text-stone-400 text-right leading-relaxed">
        <div className="font-medium text-stone-600">{notes.length} notes</div>
        <div>{tempo} BPM</div>
      </div>
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

  const tabs = [
    { key: 'generate' as const, label: 'Generate', desc: 'AI-powered' },
    { key: 'compose' as const, label: 'Compose', desc: 'Free-form' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-50 via-white to-coral-50">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-md border-b border-warm-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-coral-400 to-warm-400 flex items-center justify-center shadow-sm anim-float">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                  <rect x="2" y="8" width="3" height="12" rx="0.5" />
                  <rect x="6" y="8" width="3" height="12" rx="0.5" />
                  <rect x="10" y="8" width="3" height="12" rx="0.5" />
                  <rect x="14" y="8" width="3" height="12" rx="0.5" />
                  <rect x="18" y="8" width="3" height="12" rx="0.5" />
                  <rect x="4" y="8" width="2" height="7" rx="0.5" fill="rgba(0,0,0,0.25)" />
                  <rect x="8" y="8" width="2" height="7" rx="0.5" fill="rgba(0,0,0,0.25)" />
                  <rect x="15" y="8" width="2" height="7" rx="0.5" fill="rgba(0,0,0,0.25)" />
                  <rect x="19" y="8" width="2" height="7" rx="0.5" fill="rgba(0,0,0,0.25)" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-stone-800">
                  Piano Studio
                </h1>
                <p className="text-xs text-stone-400 hidden sm:block">Create, play, and practice</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/files"
                className="px-4 py-2 rounded-xl text-sm font-medium text-stone-500 hover:text-stone-700 hover:bg-warm-100 transition-all"
              >
                My Files
              </Link>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                isConnected
                  ? 'bg-mint-100 text-mint-500'
                  : 'bg-coral-100 text-coral-500'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-mint-400' : 'bg-coral-400'} animate-pulse`} />
                {isConnected ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Tab selector */}
        <div className="flex gap-3 mb-8">
          {tabs.map(({ key, label, desc }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 sm:flex-none px-6 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                activeTab === key
                  ? 'bg-white text-stone-800 shadow-md border border-warm-200'
                  : 'text-stone-400 hover:text-stone-600 hover:bg-white/50'
              }`}
            >
              {label}
              {activeTab === key && (
                <span className="ml-2 text-xs font-normal text-stone-400">{desc}</span>
              )}
            </button>
          ))}
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
              <div className="space-y-4">
                <ResultCard result={result} />
                <button
                  onClick={reset}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm bg-warm-100 hover:bg-warm-200 text-stone-600 transition-all"
                >
                  Create Another
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
      <footer className="border-t border-warm-200 mt-16">
        <div className="container mx-auto px-4 py-6 text-center text-stone-400 text-xs">
          <p>Piano Music Studio &mdash; made with care</p>
        </div>
      </footer>
    </div>
  );
}
