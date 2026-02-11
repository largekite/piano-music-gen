/**
 * AI-powered music description generator.
 * TypeScript port of backend prompt_generator.py
 */
import type { MusicStyle, MusicKey, Mood, Duration } from '@/types/api';

const TEMPO_DESCRIPTORS: Record<string, string> = {
  '40-69': 'very slow',
  '70-89': 'slow',
  '90-119': 'moderate',
  '120-139': 'fast',
  '140-180': 'very fast',
};

const STYLE_VARIATIONS: Record<MusicStyle, string[]> = {
  Classical: ['elegant', 'sophisticated', 'graceful', 'refined'],
  Jazz: ['smooth', 'syncopated', 'improvisational', 'swinging'],
  Pop: ['catchy', 'melodic', 'contemporary', 'accessible'],
  Ambient: ['atmospheric', 'ethereal', 'floating', 'meditative'],
};

const MOOD_DESCRIPTORS: Record<Mood, string[]> = {
  Happy: ['joyful', 'uplifting', 'bright', 'cheerful', 'energetic'],
  Melancholic: ['wistful', 'nostalgic', 'contemplative', 'bittersweet', 'reflective'],
  Dreamy: ['flowing', 'gentle', 'soft', 'peaceful', 'serene'],
  Intense: ['dramatic', 'powerful', 'passionate', 'dynamic', 'bold'],
};

function getTempoWord(tempo: number): string {
  if (tempo >= 40 && tempo < 70) return 'very slow';
  if (tempo >= 70 && tempo < 90) return 'slow';
  if (tempo >= 90 && tempo < 120) return 'moderate';
  if (tempo >= 120 && tempo < 140) return 'fast';
  if (tempo >= 140 && tempo <= 180) return 'very fast';
  return 'moderate';
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function generateAIPrompt(
  style: MusicStyle,
  key: MusicKey,
  tempo: number,
  mood: Mood,
  duration: Duration
): string {
  const tempoWord = getTempoWord(tempo);
  const styleAdj = randomChoice(STYLE_VARIATIONS[style] || ['beautiful']);
  const moodAdj = randomChoice(MOOD_DESCRIPTORS[mood] || ['expressive']);

  const templates = [
    `A ${moodAdj} ${style.toLowerCase()} piano piece in ${key}, ${tempoWord} tempo (${tempo} BPM), lasting ${duration}`,
    `${capitalize(styleAdj)} ${style.toLowerCase()} piano music with a ${mood.toLowerCase()} mood, ${tempoWord} paced in ${key}`,
    `${capitalize(tempoWord)} ${mood.toLowerCase()} piano composition in ${key}, ${style.toLowerCase()} style, ${duration} duration`,
    `Piano solo: ${moodAdj} and ${styleAdj}, ${key} signature, ${tempo} BPM ${style.toLowerCase()} piece`,
  ];

  return randomChoice(templates);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
