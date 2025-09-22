import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger.js';
import { ServiceUnavailableError } from '../types/errors.js';

export class RedisService {
  public client: RedisClientType;
  public isConnected = false;

  constructor() {
    const redisUrl = process.env['REDIS_URL'] || 'redis://localhost:6379';
    
    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis connection failed after 10 retries');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 50, 1000);
        }
      }
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Redis client disconnected');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
      logger.info('Redis service connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw new ServiceUnavailableError('Redis connection failed');
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.disconnect();
        this.isConnected = false;
        logger.info('Redis service disconnected');
      }
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }
  }

  async get(key: string): Promise<string | null> {
    this.ensureConnected();
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Redis GET error:', { key, error });
      throw new ServiceUnavailableError('Redis operation failed');
    }
  }

  async set(key: string, value: string): Promise<void> {
    this.ensureConnected();
    try {
      await this.client.set(key, value);
    } catch (error) {
      logger.error('Redis SET error:', { key, error });
      throw new ServiceUnavailableError('Redis operation failed');
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    this.ensureConnected();
    try {
      await this.client.setEx(key, seconds, value);
    } catch (error) {
      logger.error('Redis SETEX error:', { key, seconds, error });
      throw new ServiceUnavailableError('Redis operation failed');
    }
  }

  async del(key: string): Promise<number> {
    this.ensureConnected();
    try {
      return await this.client.del(key);
    } catch (error) {
      logger.error('Redis DEL error:', { key, error });
      throw new ServiceUnavailableError('Redis operation failed');
    }
  }

  async exists(key: string): Promise<boolean> {
    this.ensureConnected();
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', { key, error });
      throw new ServiceUnavailableError('Redis operation failed');
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    this.ensureConnected();
    try {
      const result = await this.client.expire(key, seconds);
      return Boolean(result);
    } catch (error) {
      logger.error('Redis EXPIRE error:', { key, seconds, error });
      throw new ServiceUnavailableError('Redis operation failed');
    }
  }

  async ttl(key: string): Promise<number> {
    this.ensureConnected();
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Redis TTL error:', { key, error });
      throw new ServiceUnavailableError('Redis operation failed');
    }
  }

  async keys(pattern: string): Promise<string[]> {
    this.ensureConnected();
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      logger.error('Redis KEYS error:', { pattern, error });
      throw new ServiceUnavailableError('Redis operation failed');
    }
  }

  async flushall(): Promise<void> {
    this.ensureConnected();
    try {
      await this.client.flushAll();
      logger.info('Redis database flushed');
    } catch (error) {
      logger.error('Redis FLUSHALL error:', error);
      throw new ServiceUnavailableError('Redis operation failed');
    }
  }

  async ping(): Promise<string> {
    this.ensureConnected();
    try {
      return await this.client.ping();
    } catch (error) {
      logger.error('Redis PING error:', error);
      throw new ServiceUnavailableError('Redis operation failed');
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  public ensureConnected(): void {
    if (!this.isConnected) {
      throw new ServiceUnavailableError('Redis service not connected');
    }
  }

  // Session management helpers
  async setSession(sessionId: string, data: any, expirationSeconds = 3600): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    await this.setex(sessionKey, expirationSeconds, JSON.stringify(data));
  }

  async getSession(sessionId: string): Promise<any | null> {
    const sessionKey = `session:${sessionId}`;
    const data = await this.get(sessionKey);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    await this.del(sessionKey);
  }

  async extendSession(sessionId: string, expirationSeconds = 3600): Promise<boolean> {
    const sessionKey = `session:${sessionId}`;
    return await this.expire(sessionKey, expirationSeconds);
  }

  // Token blacklist helpers
  async blacklistToken(token: string, expirationSeconds: number): Promise<void> {
    const blacklistKey = `blacklist:${token}`;
    await this.setex(blacklistKey, expirationSeconds, 'true');
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const blacklistKey = `blacklist:${token}`;
    return await this.exists(blacklistKey);
  }

  // Rate limiting helpers
  async incrementRateLimit(key: string, windowSeconds: number): Promise<number> {
    const rateLimitKey = `rate_limit:${key}`;
    
    try {
      const current = await this.client.incr(rateLimitKey);
      
      if (current === 1) {
        await this.expire(rateLimitKey, windowSeconds);
      }
      
      return current;
    } catch (error) {
      logger.error('Redis rate limit error:', { key, error });
      throw new ServiceUnavailableError('Redis operation failed');
    }
  }

  async getRateLimit(key: string): Promise<{ count: number; ttl: number }> {
    const rateLimitKey = `rate_limit:${key}`;
    
    try {
      const count = parseInt(await this.get(rateLimitKey) || '0');
      const ttl = await this.ttl(rateLimitKey);
      
      return { count, ttl };
    } catch (error) {
      logger.error('Redis get rate limit error:', { key, error });
      throw new ServiceUnavailableError('Redis operation failed');
    }
  }
}

// Singleton instance
let redisServiceInstance: RedisService | null = null;

export async function initializeRedisService(): Promise<RedisService> {
  if (!redisServiceInstance) {
    redisServiceInstance = new RedisService();
    await redisServiceInstance.connect();
    logger.info('Redis service initialized');
  }
  return redisServiceInstance;
}

export function getRedisService(): RedisService {
  if (!redisServiceInstance) {
    throw new Error('Redis service not initialized. Call initializeRedisService first.');
  }
  return redisServiceInstance;
}