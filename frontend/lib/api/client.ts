/**
 * API client for backend communication.
 */
import axios from 'axios';
import type {
  GenerationRequest,
  GenerationJob,
  MidiFileMetadata,
  PaginatedResponse,
  HealthResponse,
  BackendStatus
} from '@/types/api';

// API base URL (configure via environment variable)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_PREFIX = '/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL + API_PREFIX,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Generation API
 */
export const generationApi = {
  /**
   * Start a new generation job
   */
  async startGeneration(request: GenerationRequest): Promise<GenerationJob> {
    const response = await apiClient.post<GenerationJob>('/generate', request);
    return response.data;
  },

  /**
   * Get generation job status
   */
  async getStatus(jobId: string): Promise<GenerationJob> {
    const response = await apiClient.get<GenerationJob>(`/generate/${jobId}/status`);
    return response.data;
  },

  /**
   * Get generation result
   */
  async getResult(jobId: string): Promise<MidiFileMetadata> {
    const response = await apiClient.get<MidiFileMetadata>(`/generate/${jobId}/result`);
    return response.data;
  },
};

/**
 * Files API
 */
export const filesApi = {
  /**
   * List files with pagination
   */
  async listFiles(params?: {
    page?: number;
    page_size?: number;
    search?: string;
    backend?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<MidiFileMetadata>> {
    const response = await apiClient.get<PaginatedResponse<MidiFileMetadata>>('/files', { params });
    return response.data;
  },

  /**
   * Get file metadata
   */
  async getFile(fileId: string): Promise<MidiFileMetadata> {
    const response = await apiClient.get<MidiFileMetadata>(`/files/${fileId}`);
    return response.data;
  },

  /**
   * Get download URL for a file
   */
  getDownloadUrl(fileId: string): string {
    return `${API_BASE_URL}${API_PREFIX}/files/${fileId}/download`;
  },

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<void> {
    await apiClient.delete(`/files/${fileId}`);
  },

  /**
   * Search files
   */
  async searchFiles(query: string): Promise<{ results: MidiFileMetadata[]; total: number }> {
    const response = await apiClient.get('/files/search', { params: { q: query } });
    return response.data;
  },
};

/**
 * Health API
 */
export const healthApi = {
  /**
   * Check system health
   */
  async checkHealth(): Promise<HealthResponse> {
    const response = await apiClient.get<HealthResponse>('/health');
    return response.data;
  },

  /**
   * Get backend status
   */
  async getBackendStatus(): Promise<BackendStatus[]> {
    const response = await apiClient.get<BackendStatus[]>('/backends');
    return response.data;
  },
};

export default apiClient;
