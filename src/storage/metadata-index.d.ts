import { PromptRecord } from '../models/prompt';
import { PromptFilters } from '../types/common';
export interface PromptIndex {
    id: string;
    slug: string;
    title: string;
    summary: string;
    tags: string[];
    owner: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    averageRating: number;
    ratingCount: number;
    variableCount: number;
    hasStructured: boolean;
    filePath: string;
}
export interface MetadataIndexer {
    /**
     * Build index from all prompts
     */
    buildIndex(prompts: PromptRecord[]): Promise<void>;
    /**
     * Add prompt to index
     */
    addToIndex(prompt: PromptRecord): Promise<void>;
    /**
     * Remove prompt from index
     */
    removeFromIndex(promptId: string): Promise<void>;
    /**
     * Update prompt in index
     */
    updateIndex(prompt: PromptRecord): Promise<void>;
    /**
     * Search prompts using filters
     */
    searchPrompts(filters: PromptFilters): Promise<PromptIndex[]>;
    /**
     * Get prompt by ID from index
     */
    getPromptById(id: string): Promise<PromptIndex | null>;
    /**
     * Get prompt by slug from index
     */
    getPromptBySlug(slug: string): Promise<PromptIndex | null>;
    /**
     * Get all tags
     */
    getAllTags(): Promise<string[]>;
    /**
     * Get all owners
     */
    getAllOwners(): Promise<string[]>;
    /**
     * Get index statistics
     */
    getIndexStats(): Promise<{
        totalPrompts: number;
        totalTags: number;
        totalOwners: number;
        averageRating: number;
        statusCounts: Record<string, number>;
    }>;
    /**
     * Clear the index
     */
    clearIndex(): Promise<void>;
}
export declare class FileSystemMetadataIndexer implements MetadataIndexer {
    private readonly indexDir;
    private readonly indexFile;
    private index;
    private isLoaded;
    constructor(indexDir?: string);
    /**
     * Initialize index directory and load existing index
     */
    private initialize;
    /**
     * Load index from file
     */
    private loadIndex;
    /**
     * Save index to file
     */
    private saveIndex;
    /**
     * Convert PromptRecord to PromptIndex
     */
    private promptToIndex;
    /**
     * Build index from all prompts
     */
    buildIndex(prompts: PromptRecord[]): Promise<void>;
    /**
     * Add prompt to index
     */
    addToIndex(prompt: PromptRecord): Promise<void>;
    /**
     * Remove prompt from index
     */
    removeFromIndex(promptId: string): Promise<void>;
    /**
     * Update prompt in index
     */
    updateIndex(prompt: PromptRecord): Promise<void>;
    /**
     * Search prompts using filters
     */
    searchPrompts(filters: PromptFilters): Promise<PromptIndex[]>;
    /**
     * Get prompt by ID from index
     */
    getPromptById(id: string): Promise<PromptIndex | null>;
    /**
     * Get prompt by slug from index
     */
    getPromptBySlug(slug: string): Promise<PromptIndex | null>;
    /**
     * Get all tags
     */
    getAllTags(): Promise<string[]>;
    /**
     * Get all owners
     */
    getAllOwners(): Promise<string[]>;
    /**
     * Get index statistics
     */
    getIndexStats(): Promise<{
        totalPrompts: number;
        totalTags: number;
        totalOwners: number;
        averageRating: number;
        statusCounts: Record<string, number>;
    }>;
    /**
     * Clear the index
     */
    clearIndex(): Promise<void>;
}
//# sourceMappingURL=metadata-index.d.ts.map