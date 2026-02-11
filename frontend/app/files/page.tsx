'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { filesApi } from '@/lib/api/client';
import type { MidiFileMetadata } from '@/types/api';

export default function FilesPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadFiles();
  }, [page]);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await filesApi.listFiles({
        page,
        page_size: 12,
        search: searchQuery || undefined,
        sort_by: 'created_at',
        sort_order: 'desc',
      });

      setFiles(response.items);
      setTotalPages(Math.ceil(response.total / response.page_size));
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading files:', err);
      setError('Failed to load files');
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadFiles();
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      await filesApi.deleteFile(fileId);
      loadFiles(); // Reload the list
    } catch (err) {
      alert('Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                📊 Generated Files
              </h1>
              <p className="text-gray-600 mt-1">Browse and manage your generated MIDI files</p>
            </div>
            <Link
              href="/"
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition"
            >
              ← Back to Generator
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search files..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleSearch}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-2 rounded-lg transition"
            >
              🔍 Search
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-flex items-center space-x-2">
              <div className="w-4 h-4 bg-purple-600 rounded-full animate-bounce"></div>
              <span className="text-gray-600">Loading files...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Files Grid */}
        {!isLoading && !error && files.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file) => (
              <div key={file.file_id} className="bg-white rounded-lg shadow p-4 hover:shadow-lg transition">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-800 truncate flex-1">{file.filename}</h3>
                  <button
                    onClick={() => handleDelete(file.file_id)}
                    className="text-red-600 hover:text-red-800 ml-2"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>

                <div className="text-sm text-gray-600 space-y-1">
                  <p>Size: {formatFileSize(file.file_size)}</p>
                  <p>Created: {new Date(file.created_at * 1000).toLocaleDateString()}</p>
                </div>

                <a
                  href={filesApi.getDownloadUrl(file.file_id)}
                  download={file.filename}
                  className="mt-4 block w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-2 px-4 rounded-lg text-center transition"
                >
                  ⬇️ Download
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && files.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No files found</p>
            <Link
              href="/"
              className="mt-4 inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition"
            >
              Generate Your First File
            </Link>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
            >
              ← Previous
            </button>
            <span className="px-4 py-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
