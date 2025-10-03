import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { setConnectionStatus } from '../store/slices/connectionsSlice';
import { updateJobProgress } from '../store/slices/enhancementSlice';
import { addNotification, removeNotification } from '../store/slices/uiSlice';
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

  // Render events
  'render:started': {
    promptId: string;
    provider: string;
    userId: string;
    connectionId: string;
    timestamp: string;
  };
  'render:progress': {
    promptId: string;
    provider: string;
    userId: string;
    connectionId: string;
    status: 'preparing' | 'executing' | 'processing' | 'completing';
    message: string;
    timestamp: string;
  };
  'render:completed': {
    promptId: string;
    provider: string;
    userId: string;
    connectionId: string;
    result: any;
    renderTime: number;
    timestamp: string;
  };
  'render:failed': {
    promptId: string;
    provider: string;
    userId: string;
    connectionId: string;
    error: string;
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
  private isConnected = false;
  private reconnectAttempts = 0;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private renderStates: Map<string, { status: string; timestamp: number }> = new Map();

  connect(token: string, userId: string): void {
    if (this.socket?.connected) {
      return;
    }

    // Clean up existing connection first
    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
    }

    const serverUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
    
    this.socket = io(serverUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: false, // Don't force new connection
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000
    });

    this.setupEventListeners(userId);
  }

  private setupEventListeners(userId: string): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {

      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Join user-specific room
      this.socket?.emit('join', userId);
      
      // Only show notification on reconnect, not initial connect
      if (this.reconnectAttempts > 0) {
        store.dispatch(addNotification({
          id: `ws-reconnected-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'success',
          title: 'Reconnected',
          message: 'Real-time updates restored',
          timestamp: new Date().toISOString(),
          autoHide: true,
          duration: 3000
        }));
      }
    });

    this.socket.on('disconnect', (reason) => {

      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {

    });

    // Connection test events
    this.socket.on('connection:test:started', ({ connectionId }) => {

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
        autoHide: false
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

      store.dispatch(updateSystemStatus(statusUpdate));
    });

    this.socket.on('system:alert', ({ level, message, timestamp }) => {
      store.dispatch(addNotification({
        id: `system-alert-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
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
        id: `maintenance-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
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
          id: `prompt-updated-${promptId}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'info',
          title: 'Prompt Updated',
          message: `${username} updated this prompt`,
          timestamp,
          autoHide: true,
          duration: 5000
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
        autoHide: false
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

    // Render events
    this.socket.on('render:started', ({ promptId, provider, userId: renderUserId, connectionId, timestamp }) => {

      if (renderUserId === userId) {
        const renderKey = `${promptId}-${connectionId}`;
        
        // Track render state
        this.renderStates.set(renderKey, { status: 'started', timestamp: Date.now() });
        
        this.emitToListeners('render:started', { promptId, provider, userId: renderUserId, connectionId, timestamp });
        
        // Clear any existing render notifications for this prompt/connection
        store.dispatch(removeNotification(`render-progress-${promptId}-${connectionId}`));
        store.dispatch(removeNotification(`render-completed-${promptId}-${connectionId}`));
        store.dispatch(removeNotification(`render-failed-${promptId}-${connectionId}`));
        
        store.dispatch(addNotification({
          id: `render-started-${promptId}-${connectionId}`,
          type: 'info',
          title: 'Rendering Started',
          message: `Starting to render prompt with ${provider}...`,
          timestamp,
          autoHide: true,
          duration: 3000
        }));
      }
    });

    this.socket.on('render:progress', ({ promptId, provider, userId: renderUserId, connectionId, status, message, timestamp }) => {

      if (renderUserId === userId) {
        const renderKey = `${promptId}-${connectionId}`;
        const currentState = this.renderStates.get(renderKey);
        
        // Only process progress events if we have a valid render state and it's not completed
        if (currentState && currentState.status !== 'completed' && currentState.status !== 'failed') {
          // Update render state
          this.renderStates.set(renderKey, { status: 'progress', timestamp: Date.now() });
          
          this.emitToListeners('render:progress', { promptId, provider, userId: renderUserId, connectionId, status, message, timestamp });
          
          // Only show progress notifications for meaningful stages, not completion messages
          if (status !== 'completing' && !message.includes('completed successfully')) {
            // Clear the started notification and update with progress
            store.dispatch(removeNotification(`render-started-${promptId}-${connectionId}`));
            
            // Update existing notification or create new one
            store.dispatch(addNotification({
              id: `render-progress-${promptId}-${connectionId}`,
              type: 'info',
              title: 'Rendering Progress',
              message: message,
              timestamp,
              autoHide: false // Keep showing until completed
            }));
          }
        }
      }
    });

    this.socket.on('render:completed', ({ promptId, provider, userId: renderUserId, connectionId, result, renderTime, timestamp }) => {

      if (renderUserId === userId) {
        const renderKey = `${promptId}-${connectionId}`;
        
        // Mark render as completed
        this.renderStates.set(renderKey, { status: 'completed', timestamp: Date.now() });
        
        this.emitToListeners('render:completed', { promptId, provider, userId: renderUserId, connectionId, result, renderTime, timestamp });
        
        // Clear all previous render notifications for this prompt/connection
        store.dispatch(removeNotification(`render-started-${promptId}-${connectionId}`));
        store.dispatch(removeNotification(`render-progress-${promptId}-${connectionId}`));
        store.dispatch(removeNotification(`render-failed-${promptId}-${connectionId}`));
        
        store.dispatch(addNotification({
          id: `render-completed-${promptId}-${connectionId}`,
          type: 'success',
          title: 'Rendering Complete',
          message: `Prompt rendered successfully with ${provider} in ${(renderTime / 1000).toFixed(1)}s`,
          timestamp,
          autoHide: true,
          duration: 5000
        }));
        
        // Clean up render state after a delay
        setTimeout(() => {
          this.renderStates.delete(renderKey);
        }, 10000);
      }
    });

    this.socket.on('render:failed', ({ promptId, provider, userId: renderUserId, connectionId, error, timestamp }) => {
      if (renderUserId === userId) {
        this.emitToListeners('render:failed', { promptId, provider, userId: renderUserId, connectionId, error, timestamp });
        
        // Clear all previous render notifications for this prompt/connection
        store.dispatch(removeNotification(`render-started-${promptId}-${connectionId}`));
        store.dispatch(removeNotification(`render-progress-${promptId}-${connectionId}`));
        store.dispatch(removeNotification(`render-completed-${promptId}-${connectionId}`));
        
        store.dispatch(addNotification({
          id: `render-failed-${promptId}-${connectionId}`,
          type: 'error',
          title: 'Rendering Failed',
          message: `Failed to render prompt with ${provider}: ${error}`,
          timestamp,
          autoHide: false
        }));
      }
    });
  }



  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket.removeAllListeners();
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
  startEditing(promptId: string, userId: string, username: string): void {
    this.emit('prompt:editing:started', {
      promptId,
      userId,
      username,
      timestamp: new Date().toISOString()
    });
  }

  stopEditing(promptId: string, userId: string): void {
    this.emit('prompt:editing:stopped', {
      promptId,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  notifyPromptUpdate(promptId: string, userId: string, username: string, changes: any): void {
    this.emit('prompt:updated', {
      promptId,
      userId,
      username,
      changes,
      timestamp: new Date().toISOString()
    });
  }
}

// Singleton instance
export const webSocketService = new WebSocketService();