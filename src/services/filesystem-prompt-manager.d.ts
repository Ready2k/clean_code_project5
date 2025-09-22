import { PromptManager } from './prompt-manager';
import { PromptRecord, HumanPrompt } from '../models/prompt';
import { EnhancementResult } from '../models/enhancement';
import { PromptFilters, RenderOptions, ProviderPayload } from '../types/common';
import { IntegratedStorage } from '../storage/integrated-storage';
import { EnhancementAgent } from './enhancement-agent';
import { VariableManager } from './variable-manager';
import { RatingSystem } from './rating-system';
import { VersionManager } from './version-manager';
import { ProviderRegistry } from '../adapters/provider-registry';
export interface FileSystemPromptManagerConfig {
    storage: IntegratedStorage;
    enhancementAgent: EnhancementAgent;
    variableManager: VariableManager;
    ratingSystem: RatingSystem;
    versionManager: VersionManager;
    providerRegistry: ProviderRegistry;
}
export declare class FileSystemPromptManager implements PromptManager {
    private readonly storage;
    private readonly enhancementAgent;
    private readonly variableManager;
    private readonly ratingSystem;
    private readonly versionManager;
    private readonly providerRegistry;
    constructor(config: FileSystemPromptManagerConfig);
    /**
     * Initialize the prompt manager and all its services
     */
    initialize(): Promise<void>;
    /**
     * Create a new prompt from human-readable format
     */
    createPrompt(humanPrompt: HumanPrompt, metadata: {
        title: string;
        summary: string;
        tags: string[];
        owner: string;
    }): Promise<PromptRecord>;
    /**
     * Update an existing prompt
     */
    updatePrompt(id: string, updates: Partial<PromptRecord>): Promise<PromptRecord>;
    /**
     * Retrieve a prompt by ID
     */
    getPrompt(id: string): Promise<PromptRecord>;
    /**
     * List prompts with optional filtering
     */
    listPrompts(filters?: PromptFilters): Promise<PromptRecord[]>;
    /**
     * Delete a prompt
     */
    deletePrompt(id: string): Promise<void>;
    /**
     * Enhance a prompt using LLM
     */
    enhancePrompt(id: string, options?: {
        preserve_style?: boolean;
        target_provider?: string;
    }): Promise<EnhancementResult>;
    /**
     * Get prompt history and versions
     */
    getPromptHistory(id: string): Promise<PromptRecord['history']>;
    /**
     * Create a new version of a prompt
     */
    createVersion(id: string, changes: Partial<PromptRecord>, message: string, author: string): Promise<PromptRecord>;
    /**
     * Render a prompt for a specific provider
     */
    renderPrompt(id: string, provider: string, options: RenderOptions): Promise<ProviderPayload>;
    /**
     * Export a prompt in provider-specific format
     */
    exportPrompt(id: string, provider: string, options: RenderOptions & {
        filename?: string;
    }): Promise<{
        filename: string;
        content: string;
        metadata: {
            promptId: string;
            provider: string;
            version: number;
            exportedAt: string;
        };
    }>;
    /**
     * Validate that all required variables have values for rendering
     */
    private validateVariablesForRendering;
    /**
     * Substitute variables in structured prompt
     */
    private substituteVariablesInStructuredPrompt;
    /**
     * Check if cached render is compatible with current options
     */
    private isRenderOptionsCompatible;
    /**
     * Get service statistics and health information
     */
    getServiceStats(): Promise<{
        storage: any;
        prompts: {
            total: number;
            byStatus: Record<string, number>;
        };
        providers: {
            total: number;
            available: string[];
        };
    }>;
    /**
     * Shutdown the prompt manager and cleanup resources
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=filesystem-prompt-manager.d.ts.map