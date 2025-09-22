// Base abstract class for provider adapters

import { ProviderAdapter } from './provider-adapter';
import { StructuredPrompt } from '../models/prompt';
import { ProviderConfiguration, ProviderCapabilities } from '../models/provider';
import { RenderOptions, ProviderPayload } from '../types/common';
import { ValidationResult } from '../types/validation';

export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly supportedModels: string[];
  abstract readonly capabilities: ProviderCapabilities;

  /**
   * Check if a model is supported
   */
  supports(model: string): boolean {
    return this.supportedModels.includes(model);
  }

  /**
   * Get model-specific information
   */
  getModelInfo(model: string): {
    maxTokens: number;
    contextLength: number;
    supportsSystemMessages: boolean;
  } | null {
    if (!this.supports(model)) {
      return null;
    }

    // Default implementation - subclasses should override for model-specific details
    return {
      maxTokens: 4096,
      contextLength: this.capabilities.maxContextLength,
      supportsSystemMessages: this.capabilities.supportsSystemMessages
    };
  }

  /**
   * Estimate token count for a prompt (basic implementation)
   */
  estimateTokens(prompt: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(prompt.length / 4);
  }

  /**
   * Validate render options
   */
  protected validateRenderOptions(options: RenderOptions): ValidationResult {
    const errors: string[] = [];

    // Check if model is supported
    if (!this.supports(options.model)) {
      errors.push(`Model '${options.model}' is not supported by ${this.name}`);
    }

    // Validate temperature
    if (options.temperature !== undefined) {
      if (!this.capabilities.supportsTemperature) {
        errors.push(`${this.name} does not support temperature parameter`);
      } else if (options.temperature < 0 || options.temperature > 2) {
        errors.push('Temperature must be between 0 and 2');
      }
    }

    // Validate topP
    if (options.topP !== undefined) {
      if (!this.capabilities.supportsTopP) {
        errors.push(`${this.name} does not support topP parameter`);
      } else if (options.topP < 0 || options.topP > 1) {
        errors.push('TopP must be between 0 and 1');
      }
    }

    // Validate maxTokens
    if (options.maxTokens !== undefined) {
      if (!this.capabilities.supportsMaxTokens) {
        errors.push(`${this.name} does not support maxTokens parameter`);
      } else if (options.maxTokens <= 0) {
        errors.push('MaxTokens must be greater than 0');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Substitute variables in a template string
   */
  protected substituteVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    
    // Replace {{variable}} patterns
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(pattern, String(value));
    }

    return result;
  }

  /**
   * Validate structured prompt
   */
  protected validateStructuredPrompt(structured: StructuredPrompt): ValidationResult {
    const errors: string[] = [];

    if (!structured.user_template) {
      errors.push('User template is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Abstract methods that must be implemented by subclasses
  abstract render(structured: StructuredPrompt, options: RenderOptions): ProviderPayload;
  abstract validate(payload: ProviderPayload): ValidationResult;
  abstract getDefaultOptions(): RenderOptions;
  abstract getConfiguration(): ProviderConfiguration;
}