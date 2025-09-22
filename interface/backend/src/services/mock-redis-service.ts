import { logger } from '../utils/logger.js';

export class MockRedisService {
  private data: Map<string, { value: string; expiry?: number }> = new Map();
  public isConnected = false;
  public client: any = null; // Mock client property to match RedisService interface

  constructor() {
    // Mock constructor
  }

  async connect(): Promise<void> {
    this.isConnected = true;
    logger.info('Mock Redis service connected');
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.data.clear();
    logger.info('Mock Redis service disconnected');
  }

  async get(key: string): Promise<string | null> {
    this.ensureConnected();
    const item = this.data.get(key);
    
    if (!item) {
      return null;
    }

    // Check expiry
    if (item.expiry && Date.now() > item.expiry) {
      this.data.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: string): Promise<void> {
    this.ensureConnected();
    this.data.set(key, { value });
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    this.ensureConnected();
    const expiry = Date.now() + (seconds * 1000);
    this.data.set(key, { value, expiry });
  }

  async del(key: string): Promise<number> {
    this.ensureConnected();
    const existed = this.data.has(key);
    this.data.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<boolean> {
    this.ensureConnected();
    const item = this.data.get(key);
    
    if (!item) {
      return false;
    }

    // Check expiry
    if (item.expiry && Date.now() > item.expiry) {
      this.data.delete(key);
      return false;
    }

    return true;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    this.ensureConnected();
    const item = this.data.get(key);
    
    if (!item) {
      return false;
    }

    const expiry = Date.now() + (seconds * 1000);
    this.data.set(key, { ...item, expiry });
    return true;
  }

  async ttl(key: string): Promise<number> {
    this.ensureConnected();
    const item = this.data.get(key);
    
    if (!item) {
      return -2; // Key doesn't exist
    }

    if (!item.expiry) {
      return -1; // Key exists but has no expiry
    }

    const remaining = Math.ceil((item.expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async keys(pattern: string): Promise<string[]> {
    this.ensureConnected();
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const matchingKeys: string[] = [];

    for (const [key, item] of this.data.entries()) {
      // Check expiry
      if (item.expiry && Date.now() > item.expiry) {
        this.data.delete(key);
        continue;
      }

      if (regex.test(key)) {
        matchingKeys.push(key);
      }
    }

    return matchingKeys;
  }

  async flushall(): Promise<void> {
    this.ensureConnected();
    this.data.clear();
  }

  async ping(): Promise<string> {
    this.ensureConnected();
    return 'PONG';
  }

  isHealthy(): boolean {
    return this.isConnected;
  }

  public ensureConnected(): void {
    if (!this.isConnected) {
      throw new Error('Mock Redis service not connected');
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
    
    const current = await this.get(rateLimitKey);
    const count = current ? parseInt(current) + 1 : 1;
    
    if (count === 1) {
      await this.setex(rateLimitKey, windowSeconds, count.toString());
    } else {
      await this.set(rateLimitKey, count.toString());
    }
    
    return count;
  }

  async getRateLimit(key: string): Promise<{ count: number; ttl: number }> {
    const rateLimitKey = `rate_limit:${key}`;
    
    const count = parseInt(await this.get(rateLimitKey) || '0');
    const ttl = await this.ttl(rateLimitKey);
    
    return { count, ttl };
  }
}