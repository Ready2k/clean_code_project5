import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { setConnectionStatus } from '../store/slices/connectionsSlice';
import { updateJobProgress } from '../store/slices/enhancementSlice';
import { addNotification } from '../store/slices/uiSlice';
import { updateSystemStatus } from '../store/slices/systemSlice';

export interface WebSocketEvents {
  // Connection events
  'connection:test:started': { connectionId: string };
  'connection:test:completed': { connectionId: string; result: any };
  'connection:test:failed': { connectionId: string; error: string };
  'connections:test:started': { userId: string };
  'connections:test:completed': { userId: string; results: Record<string, any> };
  'connections:test:failed': { userId: string; error: string };
  
  // Enhancement events
  'enhancement:progress': { 
    jobId: string; 
    promptId: string; 
    status: string; 
    progress: number; 
    message: string; 
    result?: any; 
    error?: string 
  };
  'enhancement:started': { jobId: string; promptId: string; userId: string };
  'enhancement:completed': { jobId: string; promptId: string; result: any };
  'enhancement:failed': { jobId: string; promptId: string; error: string };
  
  // System events
  'system:status:update': { 
    status: 'healthy' | 'degraded' | 'down';
    services: Record<string, any>;
    timestamp: string;
  };
  'system:alert': { 
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  };
  'system:maintenance': { 
    status: 'started' | 'completed';
    message: string;
    timestamp: string;
  };
  
  // User activity events
  'user:activity': {
    userId: string;
    username: string;
    action: string;
    resource: string;
    timestamp: string;
  };
  
  // Collaborative editing events
  'prompt:editing:started': { 
    promptId: string; 
    userId: string; 
    username: string;
    timestamp: string;
  };
  'prompt:editing:stopped': { 
    promptId: string; 
    userId: string;
    timestamp: string;
  };
  'prompt:updated': { 
    promptId: string; 
    userId: string; 
    username: string;
    changes: any;
    timestamp: string;
  };
  
  // Export events
  'export:started': { 
    exportId: string; 
    userId: string;
    type: string;
    timestamp: string;
  };
  'export:progress': { 
    exportId: string; 
    progress: number;
    message: string;
    timestamp: string;
  };
  'export:completed': { 
    exportId: string; 
    downloadUrl: string;
    timestamp: string;
  };
  'export:failed': { 
    exportId: string; 
    error: string;
    timestamp: string;
  };
  
  // Rating events
  'rating:updated': { 
    promptId: string; 
    rating: any;
    userId: string;
    timestamp: string;
  };
}

export interface NotificationData {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  autoHide?: boolean;
  duration?: number;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnected = false;
  private eventListeners: Map<string, Set<Function>> = new Map();

  connect(token: string, userId: string): void {
    if (this.socket?.connected) {
      return;
    }

    const serverUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    
    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.setupEventListeners(userId);
  }

  private setupEventListeners(userId: string): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Join user-specific room
      this.socket?.emit('join', userId);
      
      // Dispatch connection success notification
      store.dispatch(addNotification({
        id: `ws-connected-${Date.now()}`,
        type: 'success',
        title: 'Connected',
        message: 'Real-time updates enabled',
        timestamp: new Date().toISOString(),
        autoHide: true,
        duration: 3000
      }));
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        this.handleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.handleReconnect();
    });

    // Connection test events
    this.socket.on('connection:test:started', ({ connectionId }) => {
      console.log('Connection test started:', connectionId);
      store.dispatch(setConnectionStatus({ id: connectionId, status: 'inactive' }));
      
      store.dispatch(addNotification({
        id: `conn-test-${connectionId}`,
        type: 'info',
        title: 'Connection Test',
        message: 'Testing connection...',
        timestamp: new Date().toISOString(),
        autoHide: true,
        duration: 5000
      }));
    });

    this.socket.on('connection:test:completed', ({ connectionId, result }) => {
      console.log('Connection test completed:', connectionId, result);
      const status = result.success ? 'active' : 'error';
      store.dispatch(setConnectionStatus({ id: connectionId, status }));
      
      store.dispatch(addNotification({
        id: `conn-result-${connectionId}`,
        type: result.success ? 'success' : 'error',
        title: 'Connection Test',
        message: result.success ? 'Connection successful' : `Connection failed: ${result.error}`,
        timestamp: new Date().toISOString(),
        autoHide: true,
        duration: 5000
      }));
    });

    this.socket.on('connection:test:failed', ({ connectionId, error }) => {
      console.log('Connection test failed:', connectionId, error);
      store.dispatch(setConnectionStatus({ id: connectionId, status: 'error' }));
      
      store.dispatch(addNotification({
        id: `conn-error-${connectionId}`,
        type: 'error',
        title: 'Connection Test Failed',
        message: error,
        timestamp: new Date().toISOString(),
        autoHide: false
      }));
    });

    // Enhancement events
    this.socket.on('enhancement:progress', (progress) => {
      console.log('Enhancement progress update:', progress);
      store.dispatch(updateJobProgress(progress));
    });

    this.socket.on('enhancement:started', ({ jobId }) => {
      store.dispatch(addNotification({
        id: `enhancement-started-${jobId}`,
        type: 'info',
        title: 'Enhancement Started',
        message: `AI enhancement started for prompt`,
        timestamp: new Date().toISOString(),
        autoHide: true,
        duration: 5000
      }));
    });

    this.socket.on('enhancement:completed', ({ jobId, promptId }) => {
      store.dispatch(addNotification({
        id: `enhancement-completed-${jobId}`,
        type: 'success',
        title: 'Enhancement Complete',
        message: 'AI enhancement completed successfully',
        timestamp: new Date().toISOString(),
        autoHide: false,
        actions: [{
          label: 'View Results',
          action: () => {
            // Navigate to prompt detail view
            window.location.href = `/prompts/${promptId}`;
          }
        }]
      }));
    });

    this.socket.on('enhancement:failed', ({ jobId, error }) => {
      store.dispatch(addNotification({
        id: `enhancement-failed-${jobId}`,
        type: 'error',
        title: 'Enhancement Failed',
        message: `Enhancement failed: ${error}`,
        timestamp: new Date().toISOString(),
        autoHide: false
      }));
    });

    // System events
    this.socket.on('system:status:update', (statusUpdate) => {
      console.log('System status update:', statusUpdate);
      store.dispatch(updateSystemStatus(statusUpdate));
    });

    this.socket.on('system:alert', ({ level, message, timestamp }) => {
      store.dispatch(addNotification({
        id: `system-alert-${timestamp}`,
        type: level === 'info' ? 'info' : level === 'warning' ? 'warning' : 'error',
        title: 'System Alert',
        message,
        timestamp,
        autoHide: level === 'info',
        duration: level === 'info' ? 5000 : undefined
      }));
    });

    this.socket.on('system:maintenance', ({ status, message, timestamp }) => {
      store.dispatch(addNotification({
        id: `maintenance-${timestamp}`,
        type: status === 'started' ? 'warning' : 'info',
        title: 'System Maintenance',
        message,
        timestamp,
        autoHide: status === 'completed',
        duration: status === 'completed' ? 5000 : undefined
      }));
    });

    // Collaborative editing events
    this.socket.on('prompt:editing:started', ({ promptId, userId: editorUserId, username, timestamp }) => {
      if (editorUserId !== userId) { // Don't notify self
        this.emitToListeners('prompt:editing:started', { promptId, userId: editorUserId, username, timestamp });
        
        store.dispatch(addNotification({
          id: `editing-${promptId}-${editorUserId}`,
          type: 'info',
          title: 'Collaborative Editing',
          message: `${username} is now editing this prompt`,
          timestamp,
          autoHide: true,
          duration: 5000
        }));
      }
    });

    this.socket.on('prompt:editing:stopped', ({ promptId, userId: editorUserId, timestamp }) => {
      if (editorUserId !== userId) { // Don't notify self
        this.emitToListeners('prompt:editing:stopped', { promptId, userId: editorUserId, timestamp });
      }
    });

    this.socket.on('prompt:updated', ({ promptId, userId: updaterUserId, username, changes, timestamp }) => {
      if (updaterUserId !== userId) { // Don't notify self
        this.emitToListeners('prompt:updated', { promptId, userId: updaterUserId, username, changes, timestamp });
        
        store.dispatch(addNotification({
          id: `prompt-updated-${promptId}-${timestamp}`,
          type: 'info',
          title: 'Prompt Updated',
          message: `${username} updated this prompt`,
          timestamp,
          autoHide: true,
          duration: 5000,
          actions: [{
            label: 'Refresh',
            action: () => {
              window.location.reload();
            }
          }]
        }));
      }
    });

    // Export events
    this.socket.on('export:started', ({ exportId, userId: exportUserId, type, timestamp }) => {
      if (exportUserId === userId) {
        store.dispatch(addNotification({
          id: `export-started-${exportId}`,
          type: 'info',
          title: 'Export Started',
          message: `${type} export started`,
          timestamp,
          autoHide: true,
          duration: 5000
        }));
      }
    });

    this.socket.on('export:progress', ({ exportId, progress, message, timestamp }) => {
      this.emitToListeners('export:progress', { exportId, progress, message, timestamp });
    });

    this.socket.on('export:completed', ({ exportId, downloadUrl, timestamp }) => {
      store.dispatch(addNotification({
        id: `export-completed-${exportId}`,
        type: 'success',
        title: 'Export Complete',
        message: 'Your export is ready for download',
        timestamp,
        autoHide: false,
        actions: [{
          label: 'Download',
          action: () => {
            window.open(downloadUrl, '_blank');
          }
        }]
      }));
    });

    this.socket.on('export:failed', ({ exportId, error, timestamp }) => {
      store.dispatch(addNotification({
        id: `export-failed-${exportId}`,
        type: 'error',
        title: 'Export Failed',
        message: `Export failed: ${error}`,
        timestamp,
        autoHide: false
      }));
    });

    // Rating events
    this.socket.on('rating:updated', ({ promptId, rating, userId: raterUserId, timestamp }) => {
      if (raterUserId !== userId) { // Don't notify self
        this.emitToListeners('rating:updated', { promptId, rating, userId: raterUserId, timestamp });
      }
    });

    // User activity events
    this.socket.on('user:activity', (activity) => {
      if (activity.userId !== userId) { // Don't notify self
        this.emitToListeners('user:activity', activity);
      }
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      store.dispatch(addNotification({
        id: `ws-reconnect-failed-${Date.now()}`,
        type: 'error',
        title: 'Connection Lost',
        message: 'Unable to reconnect to real-time updates',
        timestamp: new Date().toISOString(),
        autoHide: false,
        actions: [{
          label: 'Retry',
          action: () => {
            this.reconnectAttempts = 0;
            this.handleReconnect();
          }
        }]
      }));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    setTimeout(() => {
      this.socket?.connect();
    }, delay);
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  emit<K extends keyof WebSocketEvents>(event: K, data: WebSocketEvents[K]): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected, cannot emit event:', event);
    }
  }

  // Event listener management for components
  addEventListener<K extends keyof WebSocketEvents>(
    event: K, 
    listener: (data: WebSocketEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  removeEventListener<K extends keyof WebSocketEvents>(
    event: K, 
    listener: (data: WebSocketEvents[K]) => void
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  private emitToListeners<K extends keyof WebSocketEvents>(event: K, data: WebSocketEvents[K]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('Error in WebSocket event listener:', error);
        }
      });
    }
  }

  isSocketConnected(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  // Collaborative editing methods
  startEditing(promptId: string): void {
    this.emit('prompt:editing:started', {
      promptId,
      userId: '', // Will be filled by backend
      username: '', // Will be filled by backend
      timestamp: new Date().toISOString()
    });
  }

  stopEditing(promptId: string): void {
    this.emit('prompt:editing:stopped', {
      promptId,
      userId: '', // Will be filled by backend
      timestamp: new Date().toISOString()
    });
  }

  notifyPromptUpdate(promptId: string, changes: any): void {
    this.emit('prompt:updated', {
      promptId,
      userId: '', // Will be filled by backend
      username: '', // Will be filled by backend
      changes,
      timestamp: new Date().toISOString()
    });
  }
}

// Singleton instance
export const webSocketService = new WebSocketService();