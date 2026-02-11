'use client';

import { useState } from 'react';
import type { MusicParameters, BackendType, MusicStyle, MusicKey, Mood, Duration } from '@/types/api';
import { generateAIPrompt } from '@/lib/utils/promptGenerator';

interface GenerationFormProps {
  onGenerate: (parameters: MusicParameters) => void;
  isGenerating: boolean;
}

export default function GenerationForm({ onGenerate, isGenerating }: GenerationFormProps) {
  const [backend, setBackend] = useState<BackendType>('huggingface');
  const [style, setStyle] = useState<MusicStyle>('Classical');
  const [key, setKey] = useState<MusicKey>('C major');
  const [tempo, setTempo] = useState<number>(100);
  const [mood, setMood] = useState<Mood>('Happy');
  const [duration, setDuration] = useState<Duration>('1 min');
  const [prompt, setPrompt] = useState<string>('');

  const handleGeneratePrompt = () => {
    const generated = generateAIPrompt(style, key, tempo, mood, duration);
    setPrompt(generated);
  };

  const handleGenerate = () => {
    const parameters: MusicParameters = {
      backend,
      style,
      key,
      tempo,
      mood,
      duration,
      prompt: backend === 'huggingface' ? prompt : undefined,
    };
    onGenerate(parameters);
  };

  // Check if parameters are used by selected backend
  const isParamUsed = (param: string): boolean => {
    if (backend === 'magenta') {
      return param === 'key' || param === 'duration';
    }
    return true; // HuggingFace and Simple use all parameters
  };

  return (
    <div className="space-y-6">
      {/* Backend Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Backend
        </label>
        <select
          value={backend}
          onChange={(e) => setBackend(e.target.value as BackendType)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          disabled={isGenerating}
        >
          <option value="huggingface">🌐 HuggingFace Space (Cloud AI)</option>
          <option value="magenta">🎹 Local Magenta (Offline)</option>
          <option value="simple">🎼 Simple MIDI (Fallback)</option>
        </select>

        {backend === 'magenta' && (
          <p className="mt-2 text-sm text-amber-600">
            ⚠️ Note: Only Key and Duration parameters are used by Magenta
          </p>
        )}
      </div>

      {/* Parameter Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Style Selector */}
        <div className={`bg-white rounded-lg shadow p-4 ${!isParamUsed('style') ? 'opacity-50' : ''}`}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Style {!isParamUsed('style') && <span className="text-gray-400">⚠️ (ignored)</span>}
            {isParamUsed('style') && <span className="text-green-500">✓</span>}
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as MusicStyle)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            disabled={isGenerating || !isParamUsed('style')}
          >
            <option value="Classical">Classical</option>
            <option value="Jazz">Jazz</option>
            <option value="Pop">Pop</option>
            <option value="Ambient">Ambient</option>
          </select>
        </div>

        {/* Key Selector */}
        <div className={`bg-white rounded-lg shadow p-4 ${!isParamUsed('key') ? 'opacity-50' : ''}`}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Musical Key {isParamUsed('key') && <span className="text-green-500">✓</span>}
          </label>
          <select
            value={key}
            onChange={(e) => setKey(e.target.value as MusicKey)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            disabled={isGenerating}
          >
            <option value="C major">C major</option>
            <option value="D major">D major</option>
            <option value="G major">G major</option>
            <option value="A minor">A minor</option>
          </select>
        </div>

        {/* Mood Selector */}
        <div className={`bg-white rounded-lg shadow p-4 ${!isParamUsed('mood') ? 'opacity-50' : ''}`}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mood {!isParamUsed('mood') && <span className="text-gray-400">⚠️ (ignored)</span>}
            {isParamUsed('mood') && <span className="text-green-500">✓</span>}
          </label>
          <select
            value={mood}
            onChange={(e) => setMood(e.target.value as Mood)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            disabled={isGenerating || !isParamUsed('mood')}
          >
            <option value="Happy">Happy</option>
            <option value="Melancholic">Melancholic</option>
            <option value="Dreamy">Dreamy</option>
            <option value="Intense">Intense</option>
          </select>
        </div>
      </div>

      {/* Tempo Slider */}
      <div className={`bg-white rounded-lg shadow p-4 ${!isParamUsed('tempo') ? 'opacity-50' : ''}`}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tempo: {tempo} BPM {!isParamUsed('tempo') && <span className="text-gray-400">⚠️ (ignored)</span>}
          {isParamUsed('tempo') && <span className="text-green-500">✓</span>}
        </label>
        <input
          type="range"
          min="40"
          max="180"
          value={tempo}
          onChange={(e) => setTempo(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
          disabled={isGenerating || !isParamUsed('tempo')}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Very Slow (40)</span>
          <span>Moderate (100)</span>
          <span>Very Fast (180)</span>
        </div>
      </div>

      {/* Duration Selector */}
      <div className={`bg-white rounded-lg shadow p-4 ${!isParamUsed('duration') ? 'opacity-50' : ''}`}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Duration {isParamUsed('duration') && <span className="text-green-500">✓</span>}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['30 sec', '1 min', '2 min'] as Duration[]).map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                duration === d
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled={isGenerating}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Editor (HuggingFace only) */}
      {backend === 'huggingface' && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Music Description
            </label>
            <button
              onClick={handleGeneratePrompt}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              disabled={isGenerating}
            >
              🤖 AI Generate
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the music you want to generate..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 h-24 resize-none"
            disabled={isGenerating}
          />
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className={`w-full py-4 rounded-lg font-bold text-lg transition ${
          isGenerating
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg'
        }`}
      >
        {isGenerating ? '⏳ Generating...' : '🎵 Generate Music'}
      </button>
    </div>
  );
}
