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
    <div className="space-y-4">
      {/* Success Message */}
      <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">✅</span>
          <div>
            <h3 className="font-bold text-green-800">Generation Complete!</h3>
            <p className="text-sm text-green-700">Your piano music has been successfully generated.</p>
          </div>
        </div>
      </div>

      {/* File Metadata */}
      <div className="bg-white rounded-lg shadow p-6 space-y-3">
        <h3 className="font-bold text-lg text-gray-800">📄 File Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="font-medium text-gray-600">Filename:</span>
            <p className="text-gray-800">{result.filename}</p>
          </div>
          <div>
            <span className="font-medium text-gray-600">Size:</span>
            <p className="text-gray-800">{formatFileSize(result.file_size)}</p>
          </div>
          <div>
            <span className="font-medium text-gray-600">Backend:</span>
            <p className="text-gray-800 capitalize">{result.backend}</p>
          </div>
          <div>
            <span className="font-medium text-gray-600">Created:</span>
            <p className="text-gray-800">{new Date(result.created_at).toLocaleString()}</p>
          </div>
        </div>

        {/* Download Button */}
        <a
          href={downloadUrl}
          download={result.filename}
          className="inline-block w-full md:w-auto bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg shadow transition text-center"
        >
          ⬇️ Download MIDI File
        </a>
      </div>

      {/* MIDI Player */}
      <MidiPlayer midiUrl={downloadUrl} filename={result.filename} />
    </div>
  );
}
