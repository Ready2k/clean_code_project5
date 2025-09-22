// Cache Manager interface and implementation - Render cache management

import { ProviderPayload } from '../types/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface CacheManager {
  /**
   * Get cached render
   */
  getCachedRender(promptId: string, provider: string, version: number): Promise<ProviderPayload | null>;

  /**
   * Cache a render
   */
  cacheRender(promptId: string, provider: string, version: number, payload: ProviderPayload): Promise<void>;

  /**
   * Invalidate cache for a prompt
   */
  invalidatePromptCache(promptId: string): Promise<void>;

  /**
   * Invalidate cache for a specific provider
   */
  invalidateProviderCache(promptId: string, provider: string): Promise<void>;

  /**
   * Clear all cache
   */
  clearCache(): Promise<void>;

  /**
   * Get cache statistics
   */
  getCacheStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    hitRate: number;
    oldestEntry: string;
    newestEntry: string;
  }>;

  /**
   * Cleanup expired cache entries
   */
  cleanup(): Promise<void>;
}

interface CacheEntry {
  promptId: string;
  provider: string;
  version: number;
  payload: ProviderPayload;
  createdAt: string;
  lastAccessed: string;
  accessCount: number;
  size: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  totalRequests: number;
}

export class FileSystemCacheManager implements CacheManager {
  private readonly cacheDir: string;
  private readonly maxAge: number; // in milliseconds
  private readonly maxSize: number; // in bytes
  private stats: CacheStats;

  constructor(
    cacheDir: string = './data/cache',
    maxAge: number = 24 * 60 * 60 * 1000, // 24 hours
    maxSize: number = 100 * 1024 * 1024 // 100MB
  ) {
    this.cacheDir = cacheDir;
    this.maxAge = maxAge;
    this.maxSize = maxSize;
    this.stats = { hits: 0, misses: 0, totalRequests: 0 };
  }

  /**
   * Initialize cache directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.access(this.cacheDir);
    } catch {
      await fs.mkdir(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Generate cache key
   */
  private getCacheKey(promptId: string, provider: string, version: number): string {
    return `${promptId}_${provider}_v${version}`;
  }

  /**
   * Get cache file path
   */
  private getCacheFilePath(cacheKey: string): string {
    return path.join(this.cacheDir, `${cacheKey}.cache.json`);
  }

  /**
   * Get cached render
   */
  async getCachedRender(promptId: string, provider: string, version: number): Promise<ProviderPayload | null> {
    await this.initialize();
    
    this.stats.totalRequests++;
    
    const cacheKey = this.getCacheKey(promptId, provider, version);
    const filePath = this.getCacheFilePath(cacheKey);

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const entry: CacheEntry = JSON.parse(content);

      // Check if cache entry is expired
      const now = new Date();
      const createdAt = new Date(entry.createdAt);
      if (now.getTime() - createdAt.getTime() > this.maxAge) {
        // Remove expired entry
        await fs.unlink(filePath);
        this.stats.misses++;
        return null;
      }

      // Update access statistics
      entry.lastAccessed = now.toISOString();
      entry.accessCount++;
      await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8');

      this.stats.hits++;
      return entry.payload;
    } catch {
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Cache a render
   */
  async cacheRender(promptId: string, provider: string, version: number, payload: ProviderPayload): Promise<void> {
    await this.initialize();

    const cacheKey = this.getCacheKey(promptId, provider, version);
    const filePath = this.getCacheFilePath(cacheKey);
    const now = new Date().toISOString();

    const entry: CacheEntry = {
      promptId,
      provider,
      version,
      payload,
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
      size: JSON.stringify(payload).length
    };

    try {
      await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf8');
      
      // Check if we need to cleanup old entries
      await this.enforceMaxSize();
    } catch (error) {
      throw new Error(`Failed to cache render: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Invalidate cache for a prompt
   */
  async invalidatePromptCache(promptId: string): Promise<void> {
    await this.initialize();

    try {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(f => f.startsWith(`${promptId}_`) && f.endsWith('.cache.json'));

      for (const file of cacheFiles) {
        const filePath = path.join(this.cacheDir, file);
        try {
          await fs.unlink(filePath);
        } catch {
          // File might have been deleted already
        }
      }
    } catch {
      // Directory might not exist
    }
  }

  /**
   * Invalidate cache for a specific provider
   */
  async invalidateProviderCache(promptId: string, provider: string): Promise<void> {
    await this.initialize();

    try {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(f => 
        f.startsWith(`${promptId}_${provider}_`) && f.endsWith('.cache.json')
      );

      for (const file of cacheFiles) {
        const filePath = path.join(this.cacheDir, file);
        try {
          await fs.unlink(filePath);
        } catch {
          // File might have been deleted already
        }
      }
    } catch {
      // Directory might not exist
    }
  }

  /**
   * Clear all cache
   */
  async clearCache(): Promise<void> {
    try {
      await fs.rm(this.cacheDir, { recursive: true, force: true });
      await this.initialize();
      this.stats = { hits: 0, misses: 0, totalRequests: 0 };
    } catch (error) {
      throw new Error(`Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    totalSize: number;
    hitRate: number;
    oldestEntry: string;
    newestEntry: string;
  }> {
    await this.initialize();

    let totalEntries = 0;
    let totalSize = 0;
    let oldestDate = new Date();
    let newestDate = new Date(0);
    let oldestEntry = '';
    let newestEntry = '';

    try {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(f => f.endsWith('.cache.json'));

      for (const file of cacheFiles) {
        try {
          const filePath = path.join(this.cacheDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const entry: CacheEntry = JSON.parse(content);

          totalEntries++;
          totalSize += entry.size;

          const createdAt = new Date(entry.createdAt);
          if (createdAt < oldestDate) {
            oldestDate = createdAt;
            oldestEntry = file;
          }
          if (createdAt > newestDate) {
            newestDate = createdAt;
            newestEntry = file;
          }
        } catch {
          // Skip corrupted files
        }
      }
    } catch {
      // Directory might not exist
    }

    const hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests) * 100 
      : 0;

    return {
      totalEntries,
      totalSize,
      hitRate: Math.round(hitRate * 100) / 100,
      oldestEntry,
      newestEntry
    };
  }

  /**
   * Cleanup expired cache entries
   */
  async cleanup(): Promise<void> {
    await this.initialize();

    const now = new Date();

    try {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(f => f.endsWith('.cache.json'));

      for (const file of cacheFiles) {
        try {
          const filePath = path.join(this.cacheDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const entry: CacheEntry = JSON.parse(content);

          const createdAt = new Date(entry.createdAt);
          if (now.getTime() - createdAt.getTime() > this.maxAge) {
            await fs.unlink(filePath);
          }
        } catch {
          // Skip corrupted files or files that can't be deleted
        }
      }
    } catch {
      // Directory might not exist
    }
  }

  /**
   * Enforce maximum cache size by removing least recently used entries
   */
  private async enforceMaxSize(): Promise<void> {
    const stats = await this.getCacheStats();
    
    if (stats.totalSize <= this.maxSize) {
      return;
    }

    try {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(f => f.endsWith('.cache.json'));
      
      // Load all entries with their access info
      const entries: Array<{ file: string; entry: CacheEntry }> = [];
      
      for (const file of cacheFiles) {
        try {
          const filePath = path.join(this.cacheDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const entry: CacheEntry = JSON.parse(content);
          entries.push({ file, entry });
        } catch {
          // Skip corrupted files
        }
      }

      // Sort by last accessed (oldest first)
      entries.sort((a, b) => {
        const aDate = new Date(a.entry.lastAccessed);
        const bDate = new Date(b.entry.lastAccessed);
        return aDate.getTime() - bDate.getTime();
      });

      // Remove entries until we're under the size limit
      let currentSize = stats.totalSize;
      for (const { file, entry } of entries) {
        if (currentSize <= this.maxSize) {
          break;
        }

        try {
          const filePath = path.join(this.cacheDir, file);
          await fs.unlink(filePath);
          currentSize -= entry.size;
        } catch {
          // File might have been deleted already
        }
      }
    } catch {
      // Directory might not exist
    }
  }
}