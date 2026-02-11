'use client';

import { useState } from 'react';
import { useGeneration } from '@/lib/hooks/useGeneration';
import GenerationForm from '@/components/GenerationForm';
import ProgressDisplay from '@/components/ProgressDisplay';
import ResultCard from '@/components/ResultCard';
import Link from 'next/link';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'generate' | 'files'>('generate');
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
                🎹 Piano Music Generator
              </h1>
              <p className="text-gray-600 mt-1">Create beautiful piano MIDI music with AI</p>
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
            🎼 Generate Music
          </button>
          <Link
            href="/files"
            className="px-6 py-3 font-medium transition border-b-2 border-transparent text-gray-500 hover:text-gray-700"
          >
            📊 Generated Files
          </Link>
        </div>

        {/* Generate Tab */}
        {activeTab === 'generate' && (
          <div className="space-y-6">
            {/* Generation Form */}
            <GenerationForm
              onGenerate={generate}
              isGenerating={isGenerating}
            />

            {/* Progress Display */}
            <ProgressDisplay
              isGenerating={isGenerating}
              progress={progress}
              stage={stage}
              message={message}
              error={error}
            />

            {/* Result Card */}
            {result && !isGenerating && (
              <div>
                <ResultCard result={result} />

                {/* Generate Another Button */}
                <button
                  onClick={reset}
                  className="mt-4 w-full md:w-auto bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-lg transition"
                >
                  🔄 Generate Another
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-gray-600 text-sm">
          <p>Piano Music Generator - Powered by AI & Machine Learning</p>
          <p className="mt-1">Backends: HuggingFace Space | Google Magenta | Simple MIDI</p>
        </div>
      </footer>
    </div>
  );
}
