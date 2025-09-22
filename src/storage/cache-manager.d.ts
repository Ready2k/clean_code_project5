import { ProviderPayload } from '../types/common';
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
export declare class FileSystemCacheManager implements CacheManager {
    private readonly cacheDir;
    private readonly maxAge;
    private readonly maxSize;
    private stats;
    constructor(cacheDir?: string, maxAge?: number, // 24 hours
    maxSize?: number);
    /**
     * Initialize cache directory
     */
    initialize(): Promise<void>;
    /**
     * Generate cache key
     */
    private getCacheKey;
    /**
     * Get cache file path
     */
    private getCacheFilePath;
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
    /**
     * Enforce maximum cache size by removing least recently used entries
     */
    private enforceMaxSize;
}
//# sourceMappingURL=cache-manager.d.ts.map