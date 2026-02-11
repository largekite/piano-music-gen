'use client';

import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  MusicParameters,
  GenerationProgressEvent,
  GenerationCompleteEvent,
  GenerationErrorEvent,
  MidiFileMetadata,
} from '@/types/api';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000';

interface GenerationState {
  jobId: string | null;
  isGenerating: boolean;
  progress: number;
  stage: string;
  message: string;
  result: MidiFileMetadata | null;
  error: string | null;
}

export function useGeneration() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [state, setState] = useState<GenerationState>({
    jobId: null,
    isGenerating: false,
    progress: 0,
    stage: 'idle',
    message: '',
    result: null,
    error: null,
  });

  // Initialize WebSocket connection
  useEffect(() => {
    const socketInstance = io(WS_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      console.log('WebSocket connected');
    });

    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    socketInstance.on('generation_progress', (data: GenerationProgressEvent) => {
      setState((prev) => ({
        ...prev,
        progress: data.progress,
        stage: data.stage,
        message: data.message,
      }));
    });

    socketInstance.on('generation_complete', (data: GenerationCompleteEvent) => {
      setState((prev) => ({
        ...prev,
        isGenerating: false,
        progress: 100,
        stage: 'complete',
        message: 'Generation completed successfully!',
        result: {
          file_id: data.fileId,
          filename: data.filename,
          file_size: data.fileSize,
          backend: 'huggingface', // Will be updated from actual backend
          parameters: {} as MusicParameters, // Will be filled from job
          created_at: new Date().toISOString(),
        },
      }));
    });

    socketInstance.on('generation_error', (data: GenerationErrorEvent) => {
      setState((prev) => ({
        ...prev,
        isGenerating: false,
        stage: 'error',
        error: data.error,
        message: data.fallback
          ? `Primary backend failed: ${data.error}. Trying fallback...`
          : `Generation failed: ${data.error}`,
      }));
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Generate music
  const generate = useCallback(
    (parameters: MusicParameters) => {
      if (!socket || !socket.connected) {
        setState((prev) => ({
          ...prev,
          error: 'WebSocket not connected. Please refresh the page.',
        }));
        return;
      }

      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      setState({
        jobId,
        isGenerating: true,
        progress: 0,
        stage: 'initializing',
        message: 'Starting generation...',
        result: null,
        error: null,
      });

      socket.emit('generate_request', {
        jobId,
        parameters,
      });
    },
    [socket]
  );

  // Reset state
  const reset = useCallback(() => {
    setState({
      jobId: null,
      isGenerating: false,
      progress: 0,
      stage: 'idle',
      message: '',
      result: null,
      error: null,
    });
  }, []);

  return {
    ...state,
    generate,
    reset,
    isConnected: socket?.connected || false,
  };
}
