import { PromptRecord } from '../models/prompt';
import { ProviderPayload } from '../types/common';
export interface PromptStorage {
    /**
     * Save a prompt to filesystem
     */
    savePrompt(prompt: PromptRecord): Promise<void>;
    /**
     * Load a prompt from filesystem
     */
    loadPrompt(id: string): Promise<PromptRecord>;
    /**
     * Load a prompt by slug
     */
    loadPromptBySlug(slug: string): Promise<PromptRecord>;
    /**
     * List all prompts
     */
    listPrompts(): Promise<PromptRecord[]>;
    /**
     * Delete a prompt
     */
    deletePrompt(id: string): Promise<void>;
    /**
     * Check if a prompt exists
     */
    promptExists(id: string): Promise<boolean>;
    /**
     * Save a rendered prompt
     */
    saveRender(promptId: string, provider: string, payload: ProviderPayload): Promise<string>;
    /**
     * Load a rendered prompt
     */
    loadRender(contentRef: string): Promise<ProviderPayload>;
    /**
     * Generate unique slug from title
     */
    generateSlug(title: string): Promise<string>;
    /**
     * Get directory structure info
     */
    getStorageInfo(): Promise<{
        promptsDir: string;
        rendersDir: string;
        specsDir: string;
        totalPrompts: number;
        totalRenders: number;
    }>;
}
export declare class FileSystemPromptStorage implements PromptStorage {
    private readonly baseDir;
    private readonly promptsDir;
    private readonly rendersDir;
    private readonly specsDir;
    constructor(baseDir?: string);
    /**
     * Initialize directory structure
     */
    initialize(): Promise<void>;
    private ensureDirectoryExists;
    /**
     * Generate file path for a prompt
     */
    private getPromptFilePath;
    /**
     * Generate file path for a structured prompt
     */
    private getStructuredPromptFilePath;
    /**
     * Generate file path for a render
     */
    private getRenderFilePath;
    /**
     * Save a prompt to filesystem
     */
    savePrompt(prompt: PromptRecord): Promise<void>;
    /**
     * Load a prompt from filesystem
     */
    loadPrompt(id: string): Promise<PromptRecord>;
    /**
     * Load a prompt by slug
     */
    loadPromptBySlug(slug: string): Promise<PromptRecord>;
    /**
     * Load structured prompt if it exists
     */
    private loadStructuredPrompt;
    /**
     * List all prompts
     */
    listPrompts(): Promise<PromptRecord[]>;
    /**
     * Delete a prompt
     */
    deletePrompt(id: string): Promise<void>;
    /**
     * Check if a prompt exists
     */
    promptExists(id: string): Promise<boolean>;
    /**
     * Save a rendered prompt
     */
    saveRender(promptId: string, provider: string, payload: ProviderPayload): Promise<string>;
    /**
     * Load a rendered prompt
     */
    loadRender(contentRef: string): Promise<ProviderPayload>;
    /**
     * Generate unique slug from title
     */
    generateSlug(title: string): Promise<string>;
    /**
     * Create slug from title
     */
    private createSlugFromTitle;
    /**
     * Check if slug exists
     */
    private slugExists;
    /**
     * Get directory structure info
     */
    getStorageInfo(): Promise<{
        promptsDir: string;
        rendersDir: string;
        specsDir: string;
        totalPrompts: number;
        totalRenders: number;
    }>;
    /**
     * Convert structured prompt to YAML
     */
    private structuredPromptToYAML;
    /**
     * Parse structured prompt from YAML
     */
    private parseStructuredPromptYAML;
}
//# sourceMappingURL=prompt-storage.d.ts.map