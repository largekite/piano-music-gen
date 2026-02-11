/**
 * TypeScript type definitions for API models.
 * Mirrors backend Pydantic models.
 */

export type BackendType = 'huggingface' | 'magenta' | 'simple';

export type MusicStyle = 'Classical' | 'Jazz' | 'Pop' | 'Ambient';

export type MusicKey = 'C major' | 'D major' | 'G major' | 'A minor';

export type Mood = 'Happy' | 'Melancholic' | 'Dreamy' | 'Intense';

export type Duration = '30 sec' | '1 min' | '2 min';

export type GenerationStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export type GenerationStage = 'initializing' | 'generating' | 'processing' | 'complete' | 'error';

export interface MusicParameters {
  backend: BackendType;
  style: MusicStyle;
  key: MusicKey;
  tempo: number; // 40-180 BPM
  mood: Mood;
  duration: Duration;
  prompt?: string; // Optional custom prompt for HuggingFace
}

export interface GenerationRequest {
  parameters: MusicParameters;
}

export interface MidiFileMetadata {
  file_id: string;
  filename: string;
  file_size: number;
  backend: BackendType;
  parameters: MusicParameters;
  created_at: string; // ISO datetime
  duration_seconds?: number;
  track_count?: number;
  note_count?: number;
}

export interface GenerationJob {
  job_id: string;
  status: GenerationStatus;
  stage: GenerationStage;
  progress: number; // 0-100
  message: string;
  parameters: MusicParameters;
  created_at: string;
  completed_at?: string;
  result?: MidiFileMetadata;
  error?: string;
}

export interface GenerationProgressEvent {
  jobId: string;
  stage: GenerationStage;
  progress: number;
  message: string;
}

export interface GenerationCompleteEvent {
  jobId: string;
  fileId: string;
  filename: string;
  fileSize: number;
  downloadUrl: string;
}

export interface GenerationErrorEvent {
  jobId: string;
  error: string;
  fallback: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  backends: Record<string, boolean>;
  timestamp: string;
}

export interface BackendStatus {
  name: string;
  available: boolean;
  message?: string;
}
