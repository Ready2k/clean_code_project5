import { BaseProviderAdapter } from './base-provider-adapter';
import { StructuredPrompt } from '../models/prompt';
import { ProviderConfiguration, ProviderCapabilities } from '../models/provider';
import { RenderOptions, ProviderPayload } from '../types/common';
import { ValidationResult } from '../types/validation';
export declare class AnthropicAdapter extends BaseProviderAdapter {
    readonly id = "anthropic";
    readonly name = "Anthropic";
    readonly supportedModels: string[];
    readonly capabilities: ProviderCapabilities;
    /**
     * Render structured prompt into Anthropic messages format
     */
    render(structured: StructuredPrompt, options: RenderOptions): ProviderPayload;
    /**
     * Validate Anthropic payload format
     */
    validate(payload: ProviderPayload): ValidationResult;
    /**
     * Get default render options for Anthropic
     */
    getDefaultOptions(): RenderOptions;
    /**
     * Get Anthropic provider configuration
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
     * Parse Anthropic API response
     */
    parseResponse(response: any): {
        content: string;
        metadata: Record<string, any>;
    };
    /**
     * Override validateRenderOptions to handle Anthropic-specific temperature range
     */
    protected validateRenderOptions(options: RenderOptions): ValidationResult;
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
//# sourceMappingURL=anthropic-adapter.d.ts.map