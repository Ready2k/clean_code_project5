import { Server } from 'socket.io';
import { logger } from '../utils/logger.js';

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

class WebSocketService {
  private io: Server | null = null;
  private activeEditors: Map<string, Set<string>> = new Map(); // promptId -> Set of userIds
  private userSessions: Map<string, { userId: string; username: string; socketId: string }> = new Map();

  initialize(io: Server): void {
    this.io = io;
    this.setupEventHandlers();
    logger.info('WebSocket service initialized');
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logger.info('Client connected', { socketId: socket.id });

      // Handle user joining
      socket.on('join', (userId: string) => {
        socket.join(`user:${userId}`);
        
        // Store user session info
        this.userSessions.set(socket.id, {
          userId,
          username: 'User', // This should be populated from auth token
          socketId: socket.id
        });
        
        logger.info('User joined room', { userId, socketId: socket.id });
      });

      // Handle collaborative editing events
      socket.on('prompt:editing:started', (data: { promptId: string }) => {
        const userSession = this.userSessions.get(socket.id);
        if (!userSession) return;

        const { userId, username } = userSession;
        const { promptId } = data;

        // Add user to active editors for this prompt
        if (!this.activeEditors.has(promptId)) {
          this.activeEditors.set(promptId, new Set());
        }
        this.activeEditors.get(promptId)!.add(userId);

        // Broadcast to all users except the sender
        socket.broadcast.emit('prompt:editing:started', {
          promptId,
          userId,
          username,
          timestamp: new Date().toISOString()
        });

        logger.info('User started editing prompt', { userId, promptId });
      });

      socket.on('prompt:editing:stopped', (data: { promptId: string }) => {
        const userSession = this.userSessions.get(socket.id);
        if (!userSession) return;

        const { userId } = userSession;
        const { promptId } = data;

        // Remove user from active editors
        if (this.activeEditors.has(promptId)) {
          this.activeEditors.get(promptId)!.delete(userId);
          if (this.activeEditors.get(promptId)!.size === 0) {
            this.activeEditors.delete(promptId);
          }
        }

        // Broadcast to all users except the sender
        socket.broadcast.emit('prompt:editing:stopped', {
          promptId,
          userId,
          timestamp: new Date().toISOString()
        });

        logger.info('User stopped editing prompt', { userId, promptId });
      });

      socket.on('disconnect', () => {
        const userSession = this.userSessions.get(socket.id);
        if (userSession) {
          const { userId } = userSession;
          
          // Remove user from all active editing sessions
          for (const [promptId, editors] of this.activeEditors.entries()) {
            if (editors.has(userId)) {
              editors.delete(userId);
              if (editors.size === 0) {
                this.activeEditors.delete(promptId);
              }
              
              // Notify others that user stopped editing
              socket.broadcast.emit('prompt:editing:stopped', {
                promptId,
                userId,
                timestamp: new Date().toISOString()
              });
            }
          }
          
          this.userSessions.delete(socket.id);
        }
        
        logger.info('Client disconnected', { socketId: socket.id });
      });
    });
  }

  // Emit events to specific users or rooms
  emitToUser<K extends keyof WebSocketEvents>(
    userId: string, 
    event: K, 
    data: WebSocketEvents[K]
  ): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
      logger.debug('Emitted event to user', { userId, event, data });
    }
  }

  emitToAll<K extends keyof WebSocketEvents>(
    event: K, 
    data: WebSocketEvents[K]
  ): void {
    if (this.io) {
      this.io.emit(event, data);
      logger.debug('Emitted event to all users', { event, data });
    }
  }

  emitToRoom<K extends keyof WebSocketEvents>(
    room: string, 
    event: K, 
    data: WebSocketEvents[K]
  ): void {
    if (this.io) {
      this.io.to(room).emit(event, data);
      logger.debug('Emitted event to room', { room, event, data });
    }
  }

  // User activity tracking
  trackUserActivity(userId: string, username: string, action: string, resource: string): void {
    this.emitToAll('user:activity', {
      userId,
      username,
      action,
      resource,
      timestamp: new Date().toISOString()
    });
  }

  // System status updates
  broadcastSystemStatus(status: 'healthy' | 'degraded' | 'down', services: Record<string, any>): void {
    this.emitToAll('system:status:update', {
      status,
      services,
      timestamp: new Date().toISOString()
    });
  }

  broadcastSystemAlert(level: 'info' | 'warning' | 'error', message: string): void {
    this.emitToAll('system:alert', {
      level,
      message,
      timestamp: new Date().toISOString()
    });
  }

  broadcastMaintenanceStatus(status: 'started' | 'completed', message: string): void {
    this.emitToAll('system:maintenance', {
      status,
      message,
      timestamp: new Date().toISOString()
    });
  }

  // Enhancement events
  notifyEnhancementStarted(jobId: string, promptId: string, userId: string): void {
    this.emitToUser(userId, 'enhancement:started', {
      jobId,
      promptId,
      userId
    });
  }

  notifyEnhancementCompleted(jobId: string, promptId: string, result: any): void {
    this.emitToAll('enhancement:completed', {
      jobId,
      promptId,
      result
    });
  }

  notifyEnhancementFailed(jobId: string, promptId: string, error: string): void {
    this.emitToAll('enhancement:failed', {
      jobId,
      promptId,
      error
    });
  }

  // Export events
  notifyExportStarted(exportId: string, userId: string, type: string): void {
    this.emitToUser(userId, 'export:started', {
      exportId,
      userId,
      type,
      timestamp: new Date().toISOString()
    });
  }

  notifyExportProgress(exportId: string, userId: string, progress: number, message: string): void {
    this.emitToUser(userId, 'export:progress', {
      exportId,
      progress,
      message,
      timestamp: new Date().toISOString()
    });
  }

  notifyExportCompleted(exportId: string, userId: string, downloadUrl: string): void {
    this.emitToUser(userId, 'export:completed', {
      exportId,
      downloadUrl,
      timestamp: new Date().toISOString()
    });
  }

  notifyExportFailed(exportId: string, userId: string, error: string): void {
    this.emitToUser(userId, 'export:failed', {
      exportId,
      error,
      timestamp: new Date().toISOString()
    });
  }

  // Prompt events
  notifyPromptUpdated(promptId: string, userId: string, username: string, changes: any): void {
    this.emitToAll('prompt:updated', {
      promptId,
      userId,
      username,
      changes,
      timestamp: new Date().toISOString()
    });
  }

  // Rating events
  notifyRatingUpdated(promptId: string, rating: any, userId: string): void {
    this.emitToAll('rating:updated', {
      promptId,
      rating,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  // Get active editors for a prompt
  getActiveEditors(promptId: string): string[] {
    const editors = this.activeEditors.get(promptId);
    return editors ? Array.from(editors) : [];
  }

  // Get all active editing sessions
  getAllActiveEditingSessions(): Record<string, string[]> {
    const sessions: Record<string, string[]> = {};
    for (const [promptId, editors] of this.activeEditors.entries()) {
      sessions[promptId] = Array.from(editors);
    }
    return sessions;
  }
}

// Singleton instance
export const webSocketService = new WebSocketService();