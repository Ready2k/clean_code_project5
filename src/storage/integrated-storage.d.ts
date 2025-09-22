import { PromptRecord } from '../models/prompt';
import { ProviderPayload, PromptFilters } from '../types/common';
import { PromptStorage } from './prompt-storage';
import { PromptIndex } from './metadata-index';
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
export declare class FileSystemIntegratedStorage implements IntegratedStorage {
    private readonly storage;
    private readonly cache;
    private readonly indexer;
    private readonly watcher;
    private readonly baseDir;
    private readonly enableFileWatching;
    private isInitialized;
    constructor(baseDir?: string, enableFileWatching?: boolean);
    /**
     * Initialize all storage components
     */
    initialize(): Promise<void>;
    /**
     * Setup file watching for automatic cache invalidation and index updates
     */
    private setupFileWatching;
    /**
     * Handle prompt file changes
     */
    private handlePromptFileChanged;
    /**
     * Handle prompt file deletion
     */
    private handlePromptFileDeleted;
    /**
     * Shutdown and cleanup
     */
    shutdown(): Promise<void>;
    savePrompt(prompt: PromptRecord): Promise<void>;
    loadPrompt(id: string): Promise<PromptRecord>;
    loadPromptBySlug(slug: string): Promise<PromptRecord>;
    listPrompts(): Promise<PromptRecord[]>;
    deletePrompt(id: string): Promise<void>;
    promptExists(id: string): Promise<boolean>;
    saveRender(promptId: string, provider: string, payload: ProviderPayload): Promise<string>;
    loadRender(contentRef: string): Promise<ProviderPayload>;
    generateSlug(title: string): Promise<string>;
    getStorageInfo(): Promise<{
        promptsDir: string;
        rendersDir: string;
        specsDir: string;
        totalPrompts: number;
        totalRenders: number;
    }>;
    searchPrompts(filters: PromptFilters): Promise<PromptIndex[]>;
    getCachedRender(promptId: string, provider: string, version: number): Promise<ProviderPayload | null>;
    cacheRender(promptId: string, provider: string, version: number, payload: ProviderPayload): Promise<void>;
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
    rebuildIndex(): Promise<void>;
    clearAllCaches(): Promise<void>;
}
//# sourceMappingURL=integrated-storage.d.ts.map