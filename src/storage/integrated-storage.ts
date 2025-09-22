// Integrated storage manager that combines file storage, caching, indexing, and file watching

import { PromptRecord } from '../models/prompt';
import { ProviderPayload, PromptFilters } from '../types/common';
import { FileSystemPromptStorage, PromptStorage } from './prompt-storage';
import { FileSystemCacheManager, CacheManager } from './cache-manager';
import { FileSystemMetadataIndexer, MetadataIndexer, PromptIndex } from './metadata-index';
import { NodeFileWatcher, FileWatcher } from './file-watcher';
import * as path from 'path';

export interface IntegratedStorage extends PromptStorage {
  /**
   * Initialize all storage components
   */
  initialize(): Promise<void>;

  /**
   * Shutdown and cleanup
   */
  shutdown(): Promise<void>;

  /**
   * Search prompts using the index
   */
  searchPrompts(filters: PromptFilters): Promise<PromptIndex[]>;

  /**
   * Get cached render or create new one
   */
  getCachedRender(promptId: string, provider: string, version: number): Promise<ProviderPayload | null>;

  /**
   * Cache a render result
   */
  cacheRender(promptId: string, provider: string, version: number, payload: ProviderPayload): Promise<void>;

  /**
   * Get storage statistics
   */
  getStorageStats(): Promise<{
    prompts: {
      total: number;
      byStatus: Record<string, number>;
    };
    cache: {
      totalEntries: number;
      totalSize: number;
      hitRate: number;
    };
    index: {
      totalPrompts: number;
      totalTags: number;
      totalOwners: number;
      averageRating: number;
    };
    fileWatcher: {
      isWatching: boolean;
      watchedDirectories: string[];
    };
  }>;

  /**
   * Rebuild the index from all prompts
   */
  rebuildIndex(): Promise<void>;

  /**
   * Clear all caches
   */
  clearAllCaches(): Promise<void>;
}

export class FileSystemIntegratedStorage implements IntegratedStorage {
  private readonly storage: PromptStorage;
  private readonly cache: CacheManager;
  private readonly indexer: MetadataIndexer;
  private readonly watcher: FileWatcher;
  private readonly baseDir: string;
  private readonly enableFileWatching: boolean;
  private isInitialized: boolean = false;

  constructor(baseDir: string = './data', enableFileWatching: boolean = true) {
    this.baseDir = baseDir;
    this.enableFileWatching = enableFileWatching;
    this.storage = new FileSystemPromptStorage(baseDir);
    this.cache = new FileSystemCacheManager(path.join(baseDir, 'cache'));
    this.indexer = new FileSystemMetadataIndexer(path.join(baseDir, 'index'));
    this.watcher = new NodeFileWatcher();
  }

  /**
   * Initialize all storage components
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Initialize storage
    await (this.storage as FileSystemPromptStorage).initialize();
    await (this.cache as FileSystemCacheManager).initialize();

    // Build initial index
    await this.rebuildIndex();

    // Set up file watching if enabled
    if (this.enableFileWatching) {
      await this.setupFileWatching();
    }

    this.isInitialized = true;
  }

  /**
   * Setup file watching for automatic cache invalidation and index updates
   */
  private async setupFileWatching(): Promise<void> {
    const promptsDir = path.join(this.baseDir, 'prompts');

    // Watch for prompt file changes
    this.watcher.onFileChange(async (filePath, eventType) => {
      if (!filePath.endsWith('.prompt.yaml') && !filePath.endsWith('.structured.yaml')) {
        return;
      }

      try {
        if (eventType === 'deleted') {
          // Extract prompt ID from file path and handle deletion
          await this.handlePromptFileDeleted(filePath);
        } else {
          // Handle creation or modification
          await this.handlePromptFileChanged(filePath);
        }
      } catch (error) {
        console.error(`Error handling file change for ${filePath}:`, error);
      }
    });

    // Start watching the prompts directory
    try {
      await this.watcher.startWatching(promptsDir);
    } catch (error) {
      console.warn(`Could not start watching ${promptsDir}:`, error);
      // Don't fail initialization if file watching fails
    }
  }

  /**
   * Handle prompt file changes
   */
  private async handlePromptFileChanged(filePath: string): Promise<void> {
    if (filePath.endsWith('.prompt.yaml')) {
      try {
        const slug = path.basename(filePath, '.prompt.yaml');
        const prompt = await this.storage.loadPromptBySlug(slug);
        
        // Update index
        await this.indexer.updateIndex(prompt);
        
        // Invalidate cache for this prompt
        await this.cache.invalidatePromptCache(prompt.id);
      } catch (error) {
        console.error(`Error updating index for changed prompt file ${filePath}:`, error);
      }
    }
  }

  /**
   * Handle prompt file deletion
   */
  private async handlePromptFileDeleted(filePath: string): Promise<void> {
    if (filePath.endsWith('.prompt.yaml')) {
      try {
        const slug = path.basename(filePath, '.prompt.yaml');
        
        // Find prompt in index by slug
        const promptIndex = await this.indexer.getPromptBySlug(slug);
        if (promptIndex) {
          // Remove from index
          await this.indexer.removeFromIndex(promptIndex.id);
          
          // Invalidate cache
          await this.cache.invalidatePromptCache(promptIndex.id);
        }
      } catch (error) {
        console.error(`Error handling deleted prompt file ${filePath}:`, error);
      }
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.enableFileWatching) {
      try {
        await this.watcher.stopWatching();
      } catch (error) {
        console.warn('Error stopping file watcher:', error);
      }
    }
    this.isInitialized = false;
  }

  // PromptStorage interface methods with integrated functionality

  async savePrompt(prompt: PromptRecord): Promise<void> {
    await this.initialize();
    
    // Save to filesystem
    await this.storage.savePrompt(prompt);
    
    // Update index
    await this.indexer.updateIndex(prompt);
    
    // Invalidate cache for this prompt
    await this.cache.invalidatePromptCache(prompt.id);
  }

  async loadPrompt(id: string): Promise<PromptRecord> {
    await this.initialize();
    return this.storage.loadPrompt(id);
  }

  async loadPromptBySlug(slug: string): Promise<PromptRecord> {
    await this.initialize();
    return this.storage.loadPromptBySlug(slug);
  }

  async listPrompts(): Promise<PromptRecord[]> {
    await this.initialize();
    return this.storage.listPrompts();
  }

  async deletePrompt(id: string): Promise<void> {
    await this.initialize();
    
    // Delete from filesystem
    await this.storage.deletePrompt(id);
    
    // Remove from index
    await this.indexer.removeFromIndex(id);
    
    // Invalidate cache
    await this.cache.invalidatePromptCache(id);
  }

  async promptExists(id: string): Promise<boolean> {
    await this.initialize();
    return this.storage.promptExists(id);
  }

  async saveRender(promptId: string, provider: string, payload: ProviderPayload): Promise<string> {
    await this.initialize();
    return this.storage.saveRender(promptId, provider, payload);
  }

  async loadRender(contentRef: string): Promise<ProviderPayload> {
    await this.initialize();
    return this.storage.loadRender(contentRef);
  }

  async generateSlug(title: string): Promise<string> {
    await this.initialize();
    return this.storage.generateSlug(title);
  }

  async getStorageInfo(): Promise<{
    promptsDir: string;
    rendersDir: string;
    specsDir: string;
    totalPrompts: number;
    totalRenders: number;
  }> {
    await this.initialize();
    return this.storage.getStorageInfo();
  }

  // Enhanced methods using integrated components

  async searchPrompts(filters: PromptFilters): Promise<PromptIndex[]> {
    await this.initialize();
    return this.indexer.searchPrompts(filters);
  }

  async getCachedRender(promptId: string, provider: string, version: number): Promise<ProviderPayload | null> {
    await this.initialize();
    return this.cache.getCachedRender(promptId, provider, version);
  }

  async cacheRender(promptId: string, provider: string, version: number, payload: ProviderPayload): Promise<void> {
    await this.initialize();
    await this.cache.cacheRender(promptId, provider, version, payload);
  }

  async getStorageStats(): Promise<{
    prompts: {
      total: number;
      byStatus: Record<string, number>;
    };
    cache: {
      totalEntries: number;
      totalSize: number;
      hitRate: number;
    };
    index: {
      totalPrompts: number;
      totalTags: number;
      totalOwners: number;
      averageRating: number;
    };
    fileWatcher: {
      isWatching: boolean;
      watchedDirectories: string[];
    };
  }> {
    await this.initialize();

    const [storageInfo, cacheStats, indexStats] = await Promise.all([
      this.storage.getStorageInfo(),
      this.cache.getCacheStats(),
      this.indexer.getIndexStats()
    ]);

    return {
      prompts: {
        total: storageInfo.totalPrompts,
        byStatus: indexStats.statusCounts
      },
      cache: {
        totalEntries: cacheStats.totalEntries,
        totalSize: cacheStats.totalSize,
        hitRate: cacheStats.hitRate
      },
      index: {
        totalPrompts: indexStats.totalPrompts,
        totalTags: indexStats.totalTags,
        totalOwners: indexStats.totalOwners,
        averageRating: indexStats.averageRating
      },
      fileWatcher: {
        isWatching: this.watcher.isWatching(),
        watchedDirectories: this.watcher.getWatchedDirectories()
      }
    };
  }

  async rebuildIndex(): Promise<void> {
    // Don't call initialize here to avoid circular dependency
    const prompts = await this.storage.listPrompts();
    await this.indexer.buildIndex(prompts);
  }

  async clearAllCaches(): Promise<void> {
    await this.initialize();
    await this.cache.clearCache();
  }
}