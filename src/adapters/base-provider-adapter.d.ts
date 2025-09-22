import { ProviderAdapter } from './provider-adapter';
import { StructuredPrompt } from '../models/prompt';
import { ProviderConfiguration, ProviderCapabilities } from '../models/provider';
import { RenderOptions, ProviderPayload } from '../types/common';
import { ValidationResult } from '../types/validation';
export declare abstract class BaseProviderAdapter implements ProviderAdapter {
    abstract readonly id: string;
    abstract readonly name: string;
    abstract readonly supportedModels: string[];
    abstract readonly capabilities: ProviderCapabilities;
    /**
     * Check if a model is supported
     */
    supports(model: string): boolean;
    /**
     * Get model-specific information
     */
    getModelInfo(model: string): {
        maxTokens: number;
        contextLength: number;
        supportsSystemMessages: boolean;
    } | null;
    /**
     * Estimate token count for a prompt (basic implementation)
     */
    estimateTokens(prompt: string): number;
    /**
     * Validate render options
     */
    protected validateRenderOptions(options: RenderOptions): ValidationResult;
    /**
     * Substitute variables in a template string
     */
    protected substituteVariables(template: string, variables: Record<string, any>): string;
    /**
     * Validate structured prompt
     */
    protected validateStructuredPrompt(structured: StructuredPrompt): ValidationResult;
    abstract render(structured: StructuredPrompt, options: RenderOptions): ProviderPayload;
    abstract validate(payload: ProviderPayload): ValidationResult;
    abstract getDefaultOptions(): RenderOptions;
    abstract getConfiguration(): ProviderConfiguration;
}
//# sourceMappingURL=base-provider-adapter.d.ts.map