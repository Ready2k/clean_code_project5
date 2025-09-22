import { StructuredPrompt } from '../models/prompt';
import { ProviderConfiguration, ProviderCapabilities } from '../models/provider';
import { RenderOptions, ProviderPayload } from '../types/common';
import { ValidationResult } from '../types/validation';
export interface ProviderAdapter {
    /**
     * Unique identifier for the provider
     */
    readonly id: string;
    /**
     * Human-readable name of the provider
     */
    readonly name: string;
    /**
     * List of supported model IDs
     */
    readonly supportedModels: string[];
    /**
     * Provider capabilities
     */
    readonly capabilities: ProviderCapabilities;
    /**
     * Render a structured prompt into provider-specific format
     */
    render(structured: StructuredPrompt, options: RenderOptions): ProviderPayload;
    /**
     * Validate a provider payload
     */
    validate(payload: ProviderPayload): ValidationResult;
    /**
     * Check if a model is supported
     */
    supports(model: string): boolean;
    /**
     * Get default render options for this provider
     */
    getDefaultOptions(): RenderOptions;
    /**
     * Get provider configuration
     */
    getConfiguration(): ProviderConfiguration;
    /**
     * Transform provider-specific response back to common format
     */
    parseResponse?(response: any): {
        content: string;
        metadata: Record<string, any>;
    };
    /**
     * Estimate token count for a prompt
     */
    estimateTokens?(prompt: string): number;
    /**
     * Get model-specific limits and capabilities
     */
    getModelInfo(model: string): {
        maxTokens: number;
        contextLength: number;
        supportsSystemMessages: boolean;
    } | null;
}
//# sourceMappingURL=provider-adapter.d.ts.map