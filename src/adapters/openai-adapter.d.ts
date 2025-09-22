import { BaseProviderAdapter } from './base-provider-adapter';
import { StructuredPrompt } from '../models/prompt';
import { ProviderConfiguration, ProviderCapabilities } from '../models/provider';
import { RenderOptions, ProviderPayload } from '../types/common';
import { ValidationResult } from '../types/validation';
export declare class OpenAIAdapter extends BaseProviderAdapter {
    readonly id = "openai";
    readonly name = "OpenAI";
    readonly supportedModels: string[];
    readonly capabilities: ProviderCapabilities;
    /**
     * Render structured prompt into OpenAI messages format
     */
    render(structured: StructuredPrompt, options: RenderOptions): ProviderPayload;
    /**
     * Validate OpenAI payload format
     */
    validate(payload: ProviderPayload): ValidationResult;
    /**
     * Get default render options for OpenAI
     */
    getDefaultOptions(): RenderOptions;
    /**
     * Get OpenAI provider configuration
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
     * Parse OpenAI API response
     */
    parseResponse(response: any): {
        content: string;
        metadata: Record<string, any>;
    };
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
//# sourceMappingURL=openai-adapter.d.ts.map