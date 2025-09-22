// Integrated storage manager that combines file storage, caching, indexing, and file watching
import { FileSystemPromptStorage } from './prompt-storage';
import { FileSystemCacheManager } from './cache-manager';
import { FileSystemMetadataIndexer } from './metadata-index';
import { NodeFileWatcher } from './file-watcher';
import * as path from 'path';
export class FileSystemIntegratedStorage {
    storage;
    cache;
    indexer;
    watcher;
    baseDir;
    enableFileWatching;
    isInitialized = false;
    constructor(baseDir = './data', enableFileWatching = true) {
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
    async initialize() {
        if (this.isInitialized)
            return;
        // Initialize storage
        await this.storage.initialize();
        await this.cache.initialize();
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
    async setupFileWatching() {
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
                }
                else {
                    // Handle creation or modification
                    await this.handlePromptFileChanged(filePath);
                }
            }
            catch (error) {
                console.error(`Error handling file change for ${filePath}:`, error);
            }
        });
        // Start watching the prompts directory
        try {
            await this.watcher.startWatching(promptsDir);
        }
        catch (error) {
            console.warn(`Could not start watching ${promptsDir}:`, error);
            // Don't fail initialization if file watching fails
        }
    }
    /**
     * Handle prompt file changes
     */
    async handlePromptFileChanged(filePath) {
        if (filePath.endsWith('.prompt.yaml')) {
            try {
                const slug = path.basename(filePath, '.prompt.yaml');
                const prompt = await this.storage.loadPromptBySlug(slug);
                // Update index
                await this.indexer.updateIndex(prompt);
                // Invalidate cache for this prompt
                await this.cache.invalidatePromptCache(prompt.id);
            }
            catch (error) {
                console.error(`Error updating index for changed prompt file ${filePath}:`, error);
            }
        }
    }
    /**
     * Handle prompt file deletion
     */
    async handlePromptFileDeleted(filePath) {
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
            }
            catch (error) {
                console.error(`Error handling deleted prompt file ${filePath}:`, error);
            }
        }
    }
    /**
     * Shutdown and cleanup
     */
    async shutdown() {
        if (this.enableFileWatching) {
            try {
                await this.watcher.stopWatching();
            }
            catch (error) {
                console.warn('Error stopping file watcher:', error);
            }
        }
        this.isInitialized = false;
    }
    // PromptStorage interface methods with integrated functionality
    async savePrompt(prompt) {
        await this.initialize();
        // Save to filesystem
        await this.storage.savePrompt(prompt);
        // Update index
        await this.indexer.updateIndex(prompt);
        // Invalidate cache for this prompt
        await this.cache.invalidatePromptCache(prompt.id);
    }
    async loadPrompt(id) {
        await this.initialize();
        return this.storage.loadPrompt(id);
    }
    async loadPromptBySlug(slug) {
        await this.initialize();
        return this.storage.loadPromptBySlug(slug);
    }
    async listPrompts() {
        await this.initialize();
        return this.storage.listPrompts();
    }
    async deletePrompt(id) {
        await this.initialize();
        // Delete from filesystem
        await this.storage.deletePrompt(id);
        // Remove from index
        await this.indexer.removeFromIndex(id);
        // Invalidate cache
        await this.cache.invalidatePromptCache(id);
    }
    async promptExists(id) {
        await this.initialize();
        return this.storage.promptExists(id);
    }
    async saveRender(promptId, provider, payload) {
        await this.initialize();
        return this.storage.saveRender(promptId, provider, payload);
    }
    async loadRender(contentRef) {
        await this.initialize();
        return this.storage.loadRender(contentRef);
    }
    async generateSlug(title) {
        await this.initialize();
        return this.storage.generateSlug(title);
    }
    async getStorageInfo() {
        await this.initialize();
        return this.storage.getStorageInfo();
    }
    // Enhanced methods using integrated components
    async searchPrompts(filters) {
        await this.initialize();
        return this.indexer.searchPrompts(filters);
    }
    async getCachedRender(promptId, provider, version) {
        await this.initialize();
        return this.cache.getCachedRender(promptId, provider, version);
    }
    async cacheRender(promptId, provider, version, payload) {
        await this.initialize();
        await this.cache.cacheRender(promptId, provider, version, payload);
    }
    async getStorageStats() {
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
    async rebuildIndex() {
        // Don't call initialize here to avoid circular dependency
        const prompts = await this.storage.listPrompts();
        await this.indexer.buildIndex(prompts);
    }
    async clearAllCaches() {
        await this.initialize();
        await this.cache.clearCache();
    }
}
//# sourceMappingURL=integrated-storage.js.map