'use client';

import { useState } from 'react';
import type { MusicParameters, BackendType, MusicStyle, MusicKey, Mood, Duration } from '@/types/api';
import { generateAIPrompt } from '@/lib/utils/promptGenerator';

interface GenerationFormProps {
  onGenerate: (parameters: MusicParameters) => void;
  isGenerating: boolean;
}

export default function GenerationForm({ onGenerate, isGenerating }: GenerationFormProps) {
  const [backend, setBackend] = useState<BackendType>('simple');
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

  const isParamUsed = (param: string): boolean => {
    if (backend === 'magenta') {
      return param === 'key' || param === 'duration';
    }
    return true;
  };

  const moods: { value: Mood; label: string; emoji: string; color: string }[] = [
    { value: 'Happy', label: 'Happy', emoji: '\u2600', color: 'bg-plum-100 text-plum-600 border-plum-200' },
    { value: 'Melancholic', label: 'Melancholic', emoji: '\u2601', color: 'bg-sky-100 text-sky-500 border-sky-200' },
    { value: 'Dreamy', label: 'Dreamy', emoji: '\u2728', color: 'bg-warm-100 text-warm-600 border-warm-300' },
    { value: 'Intense', label: 'Intense', emoji: '\u26A1', color: 'bg-coral-100 text-coral-600 border-coral-200' },
  ];

  const durations: { value: Duration; label: string }[] = [
    { value: '30 sec', label: '30s' },
    { value: '1 min', label: '1 min' },
    { value: '2 min', label: '2 min' },
  ];

  const selectClass = "w-full px-3 py-2.5 border border-warm-200 rounded-xl bg-white focus:ring-2 focus:ring-coral-300 focus:border-transparent outline-none text-warm-600 text-sm font-medium transition-all";

  const cardClass = "rounded-2xl bg-white/80 backdrop-blur border border-warm-200/60 p-5 shadow-lg shadow-warm-100/50";

  return (
    <div className="space-y-5">
      {/* Engine selector */}
      <div className={cardClass}>
        <label className="block text-xs font-bold text-warm-400 uppercase tracking-wider mb-2">
          Engine
        </label>
        <select
          value={backend}
          onChange={(e) => setBackend(e.target.value as BackendType)}
          className={selectClass}
          disabled={isGenerating}
        >
          <option value="simple">Built-in Piano Engine (Recommended)</option>
          <option value="huggingface">HuggingFace Space (Requires API Key)</option>
          <option value="magenta">Local Magenta (Requires Install)</option>
        </select>

        {backend === 'magenta' && (
          <p className="mt-2 text-xs text-plum-500 bg-plum-50 px-3 py-2 rounded-lg font-medium">
            Magenta only uses Key and Duration parameters.
          </p>
        )}
      </div>

      {/* Musical parameters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Style */}
        <div className={`${cardClass} p-4 transition-opacity ${!isParamUsed('style') ? 'opacity-40' : ''}`}>
          <label className="block text-xs font-bold text-warm-400 uppercase tracking-wider mb-2">
            Style
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as MusicStyle)}
            className={selectClass}
            disabled={isGenerating || !isParamUsed('style')}
          >
            <option value="Classical">Classical</option>
            <option value="Jazz">Jazz</option>
            <option value="Pop">Pop</option>
            <option value="Ambient">Ambient</option>
          </select>
        </div>

        {/* Key */}
        <div className={`${cardClass} p-4 transition-opacity ${!isParamUsed('key') ? 'opacity-40' : ''}`}>
          <label className="block text-xs font-bold text-warm-400 uppercase tracking-wider mb-2">
            Key
          </label>
          <select
            value={key}
            onChange={(e) => setKey(e.target.value as MusicKey)}
            className={selectClass}
            disabled={isGenerating}
          >
            <optgroup label="Major">
              <option value="C major">C major</option>
              <option value="D major">D major</option>
              <option value="E major">E major</option>
              <option value="F major">F major</option>
              <option value="G major">G major</option>
              <option value="A major">A major</option>
              <option value="Bb major">Bb major</option>
            </optgroup>
            <optgroup label="Minor">
              <option value="A minor">A minor</option>
              <option value="C minor">C minor</option>
              <option value="D minor">D minor</option>
              <option value="E minor">E minor</option>
              <option value="G minor">G minor</option>
            </optgroup>
          </select>
        </div>

        {/* Mood */}
        <div className={`${cardClass} p-4 transition-opacity ${!isParamUsed('mood') ? 'opacity-40' : ''}`}>
          <label className="block text-xs font-bold text-warm-400 uppercase tracking-wider mb-2">
            Mood
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {moods.map(({ value, label, emoji, color }) => (
              <button
                key={value}
                onClick={() => setMood(value)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                  mood === value
                    ? `${color} shadow-md scale-[1.02]`
                    : 'bg-white text-warm-300 border-warm-200 hover:border-warm-300 hover:text-warm-500'
                }`}
                disabled={isGenerating || !isParamUsed('mood')}
              >
                <span className="mr-1">{emoji}</span>{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tempo */}
      <div className={`${cardClass} transition-opacity ${!isParamUsed('tempo') ? 'opacity-40' : ''}`}>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold text-warm-400 uppercase tracking-wider">
            Tempo
          </label>
          <span className="text-sm font-extrabold bg-gradient-to-r from-coral-500 to-warm-500 text-gradient">{tempo} BPM</span>
        </div>
        <input
          type="range"
          min="40"
          max="180"
          value={tempo}
          onChange={(e) => setTempo(parseInt(e.target.value))}
          className="w-full"
          disabled={isGenerating || !isParamUsed('tempo')}
        />
        <div className="flex justify-between text-xs text-warm-300 mt-1 font-medium">
          <span>Slow</span>
          <span>Moderate</span>
          <span>Fast</span>
        </div>
      </div>

      {/* Duration */}
      <div className={`${cardClass} transition-opacity ${!isParamUsed('duration') ? 'opacity-40' : ''}`}>
        <label className="block text-xs font-bold text-warm-400 uppercase tracking-wider mb-3">
          Duration
        </label>
        <div className="flex gap-2">
          {durations.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setDuration(value)}
              className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                duration === value
                  ? 'bg-gradient-to-r from-coral-400 to-coral-500 text-white shadow-lg shadow-coral-300/30'
                  : 'bg-warm-100 text-warm-500 hover:bg-warm-200'
              }`}
              disabled={isGenerating}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt (HuggingFace) */}
      {backend === 'huggingface' && (
        <div className={cardClass}>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-warm-400 uppercase tracking-wider">
              Description
            </label>
            <button
              onClick={handleGeneratePrompt}
              className="text-xs font-bold text-coral-500 hover:text-coral-600 transition"
              disabled={isGenerating}
            >
              Auto-generate
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the music you want..."
            className="w-full px-3 py-2.5 border border-warm-200 rounded-xl bg-white focus:ring-2 focus:ring-coral-300 focus:border-transparent outline-none text-sm h-24 resize-none"
            disabled={isGenerating}
          />
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className={`w-full py-4 rounded-2xl font-extrabold text-base transition-all ${
          isGenerating
            ? 'bg-warm-200 text-warm-400 cursor-not-allowed'
            : 'bg-gradient-to-r from-coral-400 via-coral-500 to-warm-500 hover:from-coral-500 hover:via-coral-600 hover:to-warm-600 text-white shadow-xl shadow-coral-300/30 hover:shadow-2xl hover:shadow-coral-400/30 active:scale-[0.99]'
        }`}
      >
        {isGenerating ? 'Creating your music...' : 'Generate Music'}
      </button>
    </div>
  );
}
