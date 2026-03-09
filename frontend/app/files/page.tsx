'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { filesApi } from '@/lib/api/client';

export default function FilesPage() {
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadFiles = useCallback(async (overridePage?: number, overrideSearch?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await filesApi.listFiles({
        page: overridePage ?? page,
        page_size: 12,
        search: (overrideSearch ?? searchQuery) || undefined,
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
  }, [page, searchQuery]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleSearch = () => {
    setPage(1);
    loadFiles(1, searchQuery);
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      await filesApi.deleteFile(fileId);
      loadFiles();
    } catch {
      alert('Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-50 via-white to-coral-50/30">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-md border-b border-warm-200/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-plum-400 to-plum-500 flex items-center justify-center shadow-lg shadow-plum-300/30">
                <svg className="w-5 h-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-extrabold bg-gradient-to-r from-plum-500 to-warm-500 text-gradient">My Files</h1>
                <p className="text-xs text-warm-400 font-medium">Your MIDI collection</p>
              </div>
            </div>
            <Link
              href="/"
              className="px-4 py-2 rounded-xl text-sm font-semibold text-warm-500 hover:text-coral-500 hover:bg-warm-100 transition-all"
            >
              Back to Studio
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Search */}
        <div className="rounded-2xl bg-white/80 backdrop-blur border border-warm-200/60 p-4 mb-6 shadow-lg shadow-warm-100/50">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search your files..."
              className="flex-1 px-4 py-2.5 border border-warm-200 rounded-xl bg-white focus:ring-2 focus:ring-coral-300 focus:border-transparent outline-none text-sm font-medium text-warm-600"
            />
            <button
              onClick={handleSearch}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-coral-400 to-coral-500 hover:from-coral-500 hover:to-coral-600 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-coral-300/30"
            >
              Search
            </button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-16">
            <div className="flex justify-center gap-2.5 mb-3">
              <div className="w-3 h-3 bg-coral-400 rounded-full anim-bounce-1" />
              <div className="w-3 h-3 bg-warm-400 rounded-full anim-bounce-2" />
              <div className="w-3 h-3 bg-coral-400 rounded-full anim-bounce-3" />
            </div>
            <span className="text-sm text-warm-400 font-medium">Loading your files...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-coral-50 border border-coral-200 p-6 text-center">
            <p className="text-coral-600 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Files grid */}
        {!isLoading && !error && files.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file) => (
              <div
                key={file.file_id}
                className="rounded-2xl bg-white/80 backdrop-blur border border-warm-200/60 p-5 hover:shadow-lg hover:border-warm-300 transition-all group shadow-md shadow-warm-100/30"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-warm-600 truncate text-sm">{file.filename}</h3>
                    <div className="flex gap-3 text-xs text-warm-400 mt-1 font-medium">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>{new Date(file.created_at * 1000).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(file.file_id)}
                    className="text-warm-300 hover:text-coral-500 transition ml-2 opacity-0 group-hover:opacity-100"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                <a
                  href={filesApi.getDownloadUrl(file.file_id)}
                  download={file.filename}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-warm-100 hover:bg-coral-100 text-warm-500 hover:text-coral-600 font-bold text-sm transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Download
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && files.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-warm-100 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-warm-200/30">
              <svg className="w-8 h-8 text-warm-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
              </svg>
            </div>
            <p className="text-warm-500 font-bold">No files yet</p>
            <p className="text-xs text-warm-400 mt-1 mb-4 font-medium">Generate your first piece to see it here!</p>
            <Link
              href="/"
              className="inline-block px-5 py-2.5 rounded-xl bg-gradient-to-r from-coral-400 to-coral-500 hover:from-coral-500 hover:to-coral-600 text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-coral-300/30"
            >
              Create Music
            </Link>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl bg-warm-100 hover:bg-warm-200 text-warm-600 text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-warm-400 font-medium">
              {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-xl bg-warm-100 hover:bg-warm-200 text-warm-600 text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
