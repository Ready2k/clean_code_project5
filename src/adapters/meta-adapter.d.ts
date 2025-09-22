import { BaseProviderAdapter } from './base-provider-adapter';
import { StructuredPrompt } from '../models/prompt';
import { ProviderConfiguration, ProviderCapabilities } from '../models/provider';
import { RenderOptions, ProviderPayload } from '../types/common';
import { ValidationResult } from '../types/validation';
export declare class MetaAdapter extends BaseProviderAdapter {
    readonly id = "meta";
    readonly name = "Meta";
    readonly supportedModels: string[];
    readonly capabilities: ProviderCapabilities;
    /**
     * Render structured prompt into Meta/Llama messages format
     */
    render(structured: StructuredPrompt, options: RenderOptions): ProviderPayload;
    /**
     * Validate Meta payload format
     */
    validate(payload: ProviderPayload): ValidationResult;
    /**
     * Get default render options for Meta
     */
    getDefaultOptions(): RenderOptions;
    /**
     * Get Meta provider configuration
     */
    getConfiguration(): ProviderConfiguration;
    /**
     * Get model-specific information
     */
    getModelInfo(model: string): {
        maxTokens: number;
        contextLength: number;
        supportsSystemMessages: boolean;
    } | null;
    /**
     * Parse Meta API response
     */
    parseResponse(response: any): {
        content: string;
        metadata: Record<string, any>;
    };
    /**
     * Get model family (Llama 2, Llama 3, etc.)
     */
    private getModelFamily;
    /**
     * Get display name for model
     */
    private getModelDisplayName;
    /**
     * Get context length for model
     */
    private getModelContextLength;
    /**
     * Get max tokens for model
     */
    private getModelMaxTokens;
    /**
     * Check if model is deprecated
     */
    private isModelDeprecated;
}
//# sourceMappingURL=meta-adapter.d.ts.map