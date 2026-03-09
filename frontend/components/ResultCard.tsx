'use client';

import MidiPlayer from './MidiPlayer';
import type { MidiFileMetadata } from '@/types/api';

interface ResultCardProps {
  result: MidiFileMetadata;
}

export default function ResultCard({ result }: ResultCardProps) {
  const downloadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/files/${result.file_id}/download`;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-5">
      {/* Success banner */}
      <div className="rounded-2xl bg-gradient-to-r from-mint-100 to-mint-50 border border-mint-200 p-5 shadow-lg shadow-mint-100/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-mint-400 flex items-center justify-center shadow-lg shadow-mint-300/30">
            <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-extrabold text-mint-500">Your piece is ready!</h3>
            <p className="text-sm text-mint-400 font-medium">Listen, edit, or download below.</p>
          </div>
        </div>
      </div>

      {/* File info + download */}
      <div className="rounded-2xl bg-white/80 backdrop-blur border border-warm-200/60 p-5 shadow-lg shadow-warm-100/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-extrabold text-warm-600">{result.filename}</h3>
            <div className="flex flex-wrap gap-3 text-xs text-warm-400 font-medium">
              <span>{formatFileSize(result.file_size)}</span>
              <span className="capitalize">{result.backend}</span>
              <span>{new Date(result.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <a
            href={downloadUrl}
            download={result.filename}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-coral-400 to-coral-500 hover:from-coral-500 hover:to-coral-600 active:scale-95 text-white font-bold text-sm transition-all shadow-lg shadow-coral-300/30"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Download MIDI
          </a>
        </div>
      </div>

      {/* Player */}
      <MidiPlayer
        midiUrl={downloadUrl}
        filename={result.filename}
        fileId={result.file_id}
        editable={true}
      />
    </div>
  );
}
