// Tests for FileSystemCacheManager

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemCacheManager } from '../cache-manager';
import { ProviderPayload } from '../../types/common';
import * as fs from 'fs/promises';

describe('FileSystemCacheManager', () => {
  const testDir = './test-cache';
  let cache: FileSystemCacheManager;

  beforeEach(async () => {
    cache = new FileSystemCacheManager(testDir, 1000, 1024 * 1024); // 1 second max age, 1MB max size
    await cache.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  describe('basic caching operations', () => {
    it('should cache and retrieve renders', async () => {
      const payload: ProviderPayload = {
        provider: 'openai',
        model: 'gpt-4',
        content: { messages: [{ role: 'user', content: 'test' }] }
      };

      // Cache should be empty initially
      const cached1 = await cache.getCachedRender('prompt1', 'openai', 1);
      expect(cached1).toBeNull();

      // Cache the render
      await cache.cacheRender('prompt1', 'openai', 1, payload);

      // Should retrieve from cache
      const cached2 = await cache.getCachedRender('prompt1', 'openai', 1);
      expect(cached2).toEqual(payload);
    });

    it('should handle different prompt/provider/version combinations', async () => {
      const payload1: ProviderPayload = {
        provider: 'openai',
        model: 'gpt-4',
        content: { messages: [{ role: 'user', content: 'test1' }] }
      };

      const payload2: ProviderPayload = {
        provider: 'anthropic',
        model: 'claude-3',
        content: { messages: [{ role: 'user', content: 'test2' }] }
      };

      await cache.cacheRender('prompt1', 'openai', 1, payload1);
      await cache.cacheRender('prompt1', 'anthropic', 1, payload2);
      await cache.cacheRender('prompt1', 'openai', 2, payload1);

      expect(await cache.getCachedRender('prompt1', 'openai', 1)).toEqual(payload1);
      expect(await cache.getCachedRender('prompt1', 'anthropic', 1)).toEqual(payload2);
      expect(await cache.getCachedRender('prompt1', 'openai', 2)).toEqual(payload1);
      expect(await cache.getCachedRender('prompt1', 'openai', 3)).toBeNull();
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate prompt cache', async () => {
      const payload: ProviderPayload = {
        provider: 'openai',
        model: 'gpt-4',
        content: { messages: [{ role: 'user', content: 'test' }] }
      };

      await cache.cacheRender('prompt1', 'openai', 1, payload);
      await cache.cacheRender('prompt1', 'anthropic', 1, payload);

      expect(await cache.getCachedRender('prompt1', 'openai', 1)).toEqual(payload);
      expect(await cache.getCachedRender('prompt1', 'anthropic', 1)).toEqual(payload);

      await cache.invalidatePromptCache('prompt1');

      expect(await cache.getCachedRender('prompt1', 'openai', 1)).toBeNull();
      expect(await cache.getCachedRender('prompt1', 'anthropic', 1)).toBeNull();
    });

    it('should invalidate provider-specific cache', async () => {
      const payload: ProviderPayload = {
        provider: 'openai',
        model: 'gpt-4',
        content: { messages: [{ role: 'user', content: 'test' }] }
      };

      await cache.cacheRender('prompt1', 'openai', 1, payload);
      await cache.cacheRender('prompt1', 'anthropic', 1, payload);

      await cache.invalidateProviderCache('prompt1', 'openai');

      expect(await cache.getCachedRender('prompt1', 'openai', 1)).toBeNull();
      expect(await cache.getCachedRender('prompt1', 'anthropic', 1)).toEqual(payload);
    });

    it('should clear all cache', async () => {
      const payload: ProviderPayload = {
        provider: 'openai',
        model: 'gpt-4',
        content: { messages: [{ role: 'user', content: 'test' }] }
      };

      await cache.cacheRender('prompt1', 'openai', 1, payload);
      await cache.cacheRender('prompt2', 'anthropic', 1, payload);

      await cache.clearCache();

      expect(await cache.getCachedRender('prompt1', 'openai', 1)).toBeNull();
      expect(await cache.getCachedRender('prompt2', 'anthropic', 1)).toBeNull();
    });
  });

  describe('cache expiration', () => {
    it('should expire old cache entries', async () => {
      const payload: ProviderPayload = {
        provider: 'openai',
        model: 'gpt-4',
        content: { messages: [{ role: 'user', content: 'test' }] }
      };

      await cache.cacheRender('prompt1', 'openai', 1, payload);
      
      // Should be cached initially
      expect(await cache.getCachedRender('prompt1', 'openai', 1)).toEqual(payload);

      // Wait for expiration (cache has 1 second max age)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should be expired now
      expect(await cache.getCachedRender('prompt1', 'openai', 1)).toBeNull();
    });

    it('should cleanup expired entries', async () => {
      const payload: ProviderPayload = {
        provider: 'openai',
        model: 'gpt-4',
        content: { messages: [{ role: 'user', content: 'test' }] }
      };

      await cache.cacheRender('prompt1', 'openai', 1, payload);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      await cache.cleanup();

      const stats = await cache.getCacheStats();
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe('cache statistics', () => {
    it('should provide cache statistics', async () => {
      const payload: ProviderPayload = {
        provider: 'openai',
        model: 'gpt-4',
        content: { messages: [{ role: 'user', content: 'test' }] }
      };

      const stats1 = await cache.getCacheStats();
      expect(stats1.totalEntries).toBe(0);
      expect(stats1.totalSize).toBe(0);

      await cache.cacheRender('prompt1', 'openai', 1, payload);

      const stats2 = await cache.getCacheStats();
      expect(stats2.totalEntries).toBe(1);
      expect(stats2.totalSize).toBeGreaterThan(0);
    });

    it('should track hit rate', async () => {
      const payload: ProviderPayload = {
        provider: 'openai',
        model: 'gpt-4',
        content: { messages: [{ role: 'user', content: 'test' }] }
      };

      await cache.cacheRender('prompt1', 'openai', 1, payload);

      // One hit
      await cache.getCachedRender('prompt1', 'openai', 1);
      
      // One miss
      await cache.getCachedRender('prompt1', 'openai', 2);

      const stats = await cache.getCacheStats();
      expect(stats.hitRate).toBe(50); // 1 hit out of 2 requests
    });
  });
});