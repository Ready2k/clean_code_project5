import { PromptRecord, HumanPrompt } from '../models/prompt';
import { EnhancementResult } from '../models/enhancement';
import { PromptFilters, RenderOptions, ProviderPayload } from '../types/common';
export interface PromptManager {
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
     * Render a prompt for a specific provider
     */
    renderPrompt(id: string, provider: string, options: RenderOptions): Promise<ProviderPayload>;
    /**
     * Get prompt history and versions
     */
    getPromptHistory(id: string): Promise<PromptRecord['history']>;
    /**
     * Create a new version of a prompt
     */
    createVersion(id: string, changes: Partial<PromptRecord>, message: string, author: string): Promise<PromptRecord>;
}
//# sourceMappingURL=prompt-manager.d.ts.map