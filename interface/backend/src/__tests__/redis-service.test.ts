import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RedisService } from '../services/redis-service.js';

describe('Redis Service', () => {
  let redisService: RedisService;

  beforeEach(async () => {
    redisService = new RedisService();
    await redisService.connect();
    await redisService.flushall(); // Clear all data
  });

  afterEach(async () => {
    if (redisService) {
      await redisService.flushall();
      await redisService.disconnect();
    }
  });

  describe('Basic Operations', () => {
    it('should set and get a value', async () => {
      await redisService.set('test-key', 'test-value');
      const value = await redisService.get('test-key');
      expect(value).toBe('test-value');
    });

    it('should return null for non-existent key', async () => {
      const value = await redisService.get('non-existent-key');
      expect(value).toBeNull();
    });

    it('should set value with expiration', async () => {
      await redisService.setex('expiring-key', 1, 'expiring-value');
      const value = await redisService.get('expiring-key');
      expect(value).toBe('expiring-value');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      const expiredValue = await redisService.get('expiring-key');
      expect(expiredValue).toBeNull();
    });

    it('should delete a key', async () => {
      await redisService.set('delete-me', 'value');
      const deletedCount = await redisService.del('delete-me');
      expect(deletedCount).toBe(1);

      const value = await redisService.get('delete-me');
      expect(value).toBeNull();
    });

    it('should check if key exists', async () => {
      await redisService.set('exists-key', 'value');
      const exists = await redisService.exists('exists-key');
      expect(exists).toBe(true);

      const notExists = await redisService.exists('not-exists-key');
      expect(notExists).toBe(false);
    });

    it('should set expiration on existing key', async () => {
      await redisService.set('expire-me', 'value');
      const result = await redisService.expire('expire-me', 1);
      expect(result).toBe(true);

      // Check TTL
      const ttl = await redisService.ttl('expire-me');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(1);
    });

    it('should get TTL of a key', async () => {
      await redisService.setex('ttl-key', 10, 'value');
      const ttl = await redisService.ttl('ttl-key');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(10);
    });

    it('should find keys by pattern', async () => {
      await redisService.set('test:1', 'value1');
      await redisService.set('test:2', 'value2');
      await redisService.set('other:1', 'value3');

      const keys = await redisService.keys('test:*');
      expect(keys).toHaveLength(2);
      expect(keys).toContain('test:1');
      expect(keys).toContain('test:2');
    });

    it('should ping successfully', async () => {
      const pong = await redisService.ping();
      expect(pong).toBe('PONG');
    });

    it('should report healthy status when connected', () => {
      expect(redisService.isHealthy()).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should set and get session data', async () => {
      const sessionData = {
        userId: '123',
        username: 'testuser',
        role: 'user'
      };

      await redisService.setSession('session-123', sessionData, 3600);
      const retrievedData = await redisService.getSession('session-123');

      expect(retrievedData).toEqual(sessionData);
    });

    it('should return null for non-existent session', async () => {
      const sessionData = await redisService.getSession('non-existent-session');
      expect(sessionData).toBeNull();
    });

    it('should delete session', async () => {
      const sessionData = { userId: '123' };
      await redisService.setSession('delete-session', sessionData);
      
      await redisService.deleteSession('delete-session');
      const retrievedData = await redisService.getSession('delete-session');
      
      expect(retrievedData).toBeNull();
    });

    it('should extend session expiration', async () => {
      const sessionData = { userId: '123' };
      await redisService.setSession('extend-session', sessionData, 1);
      
      const extended = await redisService.extendSession('extend-session', 10);
      expect(extended).toBe(true);
      
      const ttl = await redisService.ttl('session:extend-session');
      expect(ttl).toBeGreaterThan(1);
    });
  });

  describe('Token Blacklist', () => {
    it('should blacklist a token', async () => {
      const token = 'test-token-123';
      await redisService.blacklistToken(token, 3600);
      
      const isBlacklisted = await redisService.isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(true);
    });

    it('should return false for non-blacklisted token', async () => {
      const isBlacklisted = await redisService.isTokenBlacklisted('non-blacklisted-token');
      expect(isBlacklisted).toBe(false);
    });

    it('should expire blacklisted tokens', async () => {
      const token = 'expiring-token';
      await redisService.blacklistToken(token, 1);
      
      let isBlacklisted = await redisService.isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(true);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      isBlacklisted = await redisService.isTokenBlacklisted(token);
      expect(isBlacklisted).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should increment rate limit counter', async () => {
      const key = 'user:123';
      
      const count1 = await redisService.incrementRateLimit(key, 60);
      expect(count1).toBe(1);
      
      const count2 = await redisService.incrementRateLimit(key, 60);
      expect(count2).toBe(2);
      
      const count3 = await redisService.incrementRateLimit(key, 60);
      expect(count3).toBe(3);
    });

    it('should get rate limit info', async () => {
      const key = 'user:456';
      
      await redisService.incrementRateLimit(key, 60);
      await redisService.incrementRateLimit(key, 60);
      
      const rateLimit = await redisService.getRateLimit(key);
      expect(rateLimit.count).toBe(2);
      expect(rateLimit.ttl).toBeGreaterThan(0);
      expect(rateLimit.ttl).toBeLessThanOrEqual(60);
    });

    it('should reset rate limit after expiration', async () => {
      const key = 'user:789';
      
      await redisService.incrementRateLimit(key, 1);
      let rateLimit = await redisService.getRateLimit(key);
      expect(rateLimit.count).toBe(1);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      rateLimit = await redisService.getRateLimit(key);
      expect(rateLimit.count).toBe(0);
      expect(rateLimit.ttl).toBe(-2); // Key doesn't exist
    });
  });
});