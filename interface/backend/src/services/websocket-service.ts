import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';
import { authenticateSocket } from '../middleware/socket-auth.js';
import { getRedisService, RedisService } from './redis-service.js';

export interface WebSocketEvents {
  // ... (event definitions remain the same)
}

export class WebSocketService {
  private io: Server | null = null;
  private redisService: RedisService | null = null;

  constructor() {
    // Redis service will be initialized when needed
  }

  initialize(io: Server): void {
    this.io = io;
    this.redisService = getRedisService(); // Initialize Redis when WebSocket is initialized
    this.io.use(authenticateSocket);
    this.setupEventHandlers();
    logger.info('WebSocket service initialized');
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      logger.info('Client connected', { socketId: socket.id, userId: socket.user?.userId });

      if (socket.user) {
        socket.join(`user:${socket.user.userId}`);
        if (this.redisService) {
          this.redisService.set(`socket:${socket.id}`, JSON.stringify({ userId: socket.user.userId, username: socket.user.username }));
        }
        logger.info('User joined room', { userId: socket.user.userId, socketId: socket.id });
      }

      socket.on('prompt:editing:started', async (data: { promptId: string }) => {
        if (!socket.user) return;

        const { userId, username } = socket.user;
        const { promptId } = data;

        if (this.redisService) {
          await this.redisService.client.sAdd(`prompt-editors:${promptId}`, userId);
        }

        try {
          socket.broadcast.emit('prompt:editing:started', {
            promptId,
            userId,
            username,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          logger.error('Error broadcasting prompt:editing:started event', { error, promptId, userId });
        }

        logger.info('User started editing prompt', { userId, promptId });
      });

      socket.on('prompt:editing:stopped', async (data: { promptId: string }) => {
        if (!socket.user) return;

        const { userId } = socket.user;
        const { promptId } = data;

        if (this.redisService) {
          await this.redisService.client.sRem(`prompt-editors:${promptId}`, userId);
        }

        try {
          socket.broadcast.emit('prompt:editing:stopped', {
            promptId,
            userId,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          logger.error('Error broadcasting prompt:editing:stopped event', { error, promptId, userId });
        }

        logger.info('User stopped editing prompt', { userId, promptId });
      });

      socket.on('disconnect', async () => {
        if (!this.redisService) {
          logger.info('Client disconnected', { socketId: socket.id });
          return;
        }

        const session = await this.redisService.get(`socket:${socket.id}`);
        if (session) {
          const { userId } = JSON.parse(session);
          await this.redisService.del(`socket:${socket.id}`);

          const keys = await this.redisService.keys('prompt-editors:*');
          for (const key of keys) {
            const promptId = key.split(':')[1];
            const isMember = await this.redisService.client.sIsMember(key, userId);
            if (isMember) {
              await this.redisService.client.sRem(key, userId);
              try {
              socket.broadcast.emit('prompt:editing:stopped', {
                promptId,
                userId,
                timestamp: new Date().toISOString()
              });
            } catch (error) {
              logger.error('Error broadcasting prompt:editing:stopped event on disconnect', { error, promptId, userId });
            }
            }
          }
        }
        
        logger.info('Client disconnected', { socketId: socket.id });
      });
    });
  }

  /**
   * Notify clients about enhancement completion
   */
  notifyEnhancementCompleted(jobId: string, promptId: string, result: any): void {
    if (this.io) {
      this.io.emit('enhancement:completed', {
        jobId,
        promptId,
        result,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Notify clients about enhancement failure
   */
  notifyEnhancementFailed(jobId: string, promptId: string, error: string): void {
    if (this.io) {
      this.io.emit('enhancement:failed', {
        jobId,
        promptId,
        error,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Notify clients about render started
   */
  notifyRenderStarted(promptId: string, provider: string, userId: string, connectionId?: string): void {
    if (this.io) {
      this.io.emit('render:started', {
        promptId,
        provider,
        userId,
        connectionId,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Notify clients about render progress
   */
  notifyRenderProgress(promptId: string, provider: string, userId: string, connectionId: string | undefined, stage: string, message: string): void {
    if (this.io) {
      this.io.emit('render:progress', {
        promptId,
        provider,
        userId,
        connectionId,
        stage,
        message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Notify clients about render completion
   */
  notifyRenderCompleted(promptId: string, provider: string, userId: string, connectionId: string | undefined, payload: any, renderTime: number): void {
    if (this.io) {
      this.io.emit('render:completed', {
        promptId,
        provider,
        userId,
        connectionId,
        payload,
        renderTime,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Notify clients about render failure
   */
  notifyRenderFailed(promptId: string, provider: string, userId: string, connectionId: string | undefined, error: string): void {
    if (this.io) {
      this.io.emit('render:failed', {
        promptId,
        provider,
        userId,
        connectionId,
        error,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast system status to all clients
   */
  broadcastSystemStatus(status: string, services: any): void {
    if (this.io) {
      this.io.emit('system:status', {
        status,
        services,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Broadcast system alert to all clients
   */
  broadcastSystemAlert(level: string, message: string): void {
    if (this.io) {
      this.io.emit('system:alert', {
        level,
        message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Notify about rating updates
   */
  notifyRatingUpdated(promptId: string, rating: number, userId: string): void {
    if (this.io) {
      this.io.emit('rating:updated', {
        promptId,
        rating,
        userId,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Track user activity
   */
  trackUserActivity(userId: string, username: string, action: string, details?: any): void {
    if (this.io) {
      this.io.emit('user:activity', {
        userId,
        username,
        action,
        details,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Notify about prompt updates
   */
  notifyPromptUpdated(promptId: string, userId: string, changes: any): void {
    if (this.io) {
      this.io.emit('prompt:updated', {
        promptId,
        userId,
        changes,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Singleton instance
let webSocketServiceInstance: WebSocketService | null = null;

export function getWebSocketService(): WebSocketService {
  if (!webSocketServiceInstance) {
    webSocketServiceInstance = new WebSocketService();
  }
  return webSocketServiceInstance;
}