import { useEffect, useCallback } from 'react';
import { useAppSelector } from './redux';
import { webSocketService, WebSocketEvents } from '../services/websocket-service';

export const useWebSocket = () => {
  const { user, token } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!user || !token) {
      webSocketService.disconnect();
      return;
    }

    // Connect to WebSocket service
    webSocketService.connect(token, user.id);

    return () => {
      webSocketService.disconnect();
    };
  }, [user, token]);

  const emit = useCallback(<K extends keyof WebSocketEvents>(
    event: K, 
    data: WebSocketEvents[K]
  ) => {
    webSocketService.emit(event, data);
  }, []);

  const addEventListener = useCallback(<K extends keyof WebSocketEvents>(
    event: K, 
    listener: (data: WebSocketEvents[K]) => void
  ) => {
    webSocketService.addEventListener(event, listener);
    
    // Return cleanup function
    return () => {
      webSocketService.removeEventListener(event, listener);
    };
  }, []);

  const isConnected = useCallback(() => {
    return webSocketService.isSocketConnected();
  }, []);

  // Collaborative editing helpers
  const startEditing = useCallback((promptId: string) => {
    webSocketService.startEditing(promptId);
  }, []);

  const stopEditing = useCallback((promptId: string) => {
    webSocketService.stopEditing(promptId);
  }, []);

  const notifyPromptUpdate = useCallback((promptId: string, changes: any) => {
    webSocketService.notifyPromptUpdate(promptId, changes);
  }, []);

  return { 
    emit, 
    addEventListener, 
    isConnected,
    startEditing,
    stopEditing,
    notifyPromptUpdate
  };
};