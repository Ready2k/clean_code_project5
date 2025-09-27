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
    if (user) {
      webSocketService.startEditing(promptId, user.id, user.username);
    }
  }, [user]);

  const stopEditing = useCallback((promptId: string) => {
    if (user) {
      webSocketService.stopEditing(promptId, user.id);
    }
  }, [user]);

  const notifyPromptUpdate = useCallback((promptId: string, changes: any) => {
    if (user) {
      webSocketService.notifyPromptUpdate(promptId, user.id, user.username, changes);
    }
  }, [user]);

  return { 
    emit, 
    addEventListener, 
    isConnected,
    startEditing,
    stopEditing,
    notifyPromptUpdate
  };
};