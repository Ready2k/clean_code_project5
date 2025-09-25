import { useEffect, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import { useAppDispatch } from './redux';
import { addNotification } from '../store/slices/uiSlice';

export interface RenderProgress {
  promptId: string;
  provider: string;
  connectionId: string;
  status: 'preparing' | 'executing' | 'processing' | 'completing';
  message: string;
  timestamp: string;
}

export interface RenderProgressState {
  isRendering: boolean;
  progress: RenderProgress | null;
  error: string | null;
}

export const useRenderProgress = (promptId?: string, connectionId?: string) => {
  const { addEventListener } = useWebSocket();
  const dispatch = useAppDispatch();
  
  const [progressState, setProgressState] = useState<RenderProgressState>({
    isRendering: false,
    progress: null,
    error: null,
  });

  useEffect(() => {
    // Listen for render started events
    const unsubscribeStarted = addEventListener('render:started', (data) => {
      if (!promptId || !connectionId || (data.promptId === promptId && data.connectionId === connectionId)) {
        setProgressState(prev => ({
          ...prev,
          isRendering: true,
          error: null,
        }));
      }
    });

    // Listen for render progress events
    const unsubscribeProgress = addEventListener('render:progress', (data) => {
      if (!promptId || !connectionId || (data.promptId === promptId && data.connectionId === connectionId)) {
        setProgressState(prev => ({
          ...prev,
          isRendering: true,
          progress: {
            promptId: data.promptId,
            provider: data.provider,
            connectionId: data.connectionId,
            status: data.status,
            message: data.message,
            timestamp: data.timestamp,
          },
          error: null,
        }));
      }
    });

    // Listen for render completed events
    const unsubscribeCompleted = addEventListener('render:completed', (data) => {
      if (!promptId || !connectionId || (data.promptId === promptId && data.connectionId === connectionId)) {
        setProgressState(prev => ({
          ...prev,
          isRendering: false,
          progress: null,
          error: null,
        }));
      }
    });

    // Listen for render failed events
    const unsubscribeFailed = addEventListener('render:failed', (data) => {
      if (!promptId || !connectionId || (data.promptId === promptId && data.connectionId === connectionId)) {
        setProgressState(prev => ({
          ...prev,
          isRendering: false,
          progress: null,
          error: data.error,
        }));
      }
    });

    // Cleanup function
    return () => {
      unsubscribeStarted();
      unsubscribeProgress();
      unsubscribeCompleted();
      unsubscribeFailed();
    };
  }, [addEventListener, promptId, connectionId]);

  return progressState;
};

export default useRenderProgress;