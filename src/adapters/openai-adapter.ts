// OpenAI Provider Adapter - Implementation for OpenAI API format

import { BaseProviderAdapter } from './base-provider-adapter';
import { StructuredPrompt } from '../models/prompt';
import { ProviderConfiguration, ProviderCapabilities } from '../models/provider';
import { RenderOptions, ProviderPayload } from '../types/common';
import { ValidationResult } from '../types/validation';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIPayload {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

export class OpenAIAdapter extends BaseProviderAdapter {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly supportedModels = [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-4-turbo-preview',
    'gpt-4-0125-preview',
    'gpt-4-1106-preview',
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-0125',
    'gpt-3.5-turbo-1106'
  ];
  
  readonly capabilities: ProviderCapabilities = {
    supportsSystemMessages: true,
    supportsMultipleMessages: true,
    supportsTemperature: true,
    supportsTopP: true,
    supportsMaxTokens: true,
    maxContextLength: 128000, // GPT-4 Turbo max
    supportedMessageRoles: ['system', 'user', 'assistant']
  };

  /**
   * Render structured prompt into OpenAI messages format
   */
  render(structured: StructuredPrompt, options: RenderOptions): ProviderPayload {
    // Validate options first
    const optionsValidation = this.validateRenderOptions(options);
    if (!optionsValidation.isValid) {
      throw new Error(`Invalid render options: ${optionsValidation.errors.join(', ')}`);
    }

    // Validate structured prompt
    const promptValidation = this.validateStructuredPrompt(structured);
    if (!promptValidation.isValid) {
      throw new Error(`Invalid structured prompt: ${promptValidation.errors.join(', ')}`);
    }

    const messages: OpenAIMessage[] = [];

    // Add system messages if present
    if (structured.system && structured.system.length > 0) {
      let systemContent = structured.system.join('\n\n');
      
      // Apply system override if provided
      if (options.systemOverride) {
        systemContent = options.systemOverride;
      }

      messages.push({
        role: 'system',
        content: systemContent
      });
    }

    // Add user message from template
    let userContent = structured.user_template;
    
    // Substitute variables if any are provided in options
    if ('variables' in options && options.variables) {
      userContent = this.substituteVariables(userContent, options.variables);
    }

    messages.push({
      role: 'user',
      content: userContent
    });

    // Build OpenAI payload
    const payload: OpenAIPayload = {
      model: options.model,
      messages
    };

    // Add optional parameters
    if (options.temperature !== undefined) {
      payload.temperature = options.temperature;
    }
    if (options.topP !== undefined) {
      payload.top_p = options.topP;
    }
    if (options.maxTokens !== undefined) {
      payload.max_tokens = options.maxTokens;
    }

    return {
      provider: this.id,
      model: options.model,
      content: payload,
      metadata: {
        messageCount: messages.length,
        hasSystemMessage: messages.some(m => m.role === 'system'),
        estimatedTokens: this.estimateTokens(messages.map(m => m.content).join(' '))
      }
    };
  }

  /**
   * Validate OpenAI payload format
   */
  validate(payload: ProviderPayload): ValidationResult {
    const errors: string[] = [];

    if (payload.provider !== this.id) {
      errors.push(`Expected provider '${this.id}', got '${payload.provider}'`);
    }

    if (!payload.content) {
      errors.push('Payload content is required');
      return { isValid: false, errors };
    }

    const content = payload.content as OpenAIPayload;

    // Validate model
    if (!content.model) {
      errors.push('Model is required');
    } else if (!this.supports(content.model)) {
      errors.push(`Unsupported model: ${content.model}`);
    }

    // Validate messages array
    if (!Array.isArray(content.messages)) {
      errors.push('Messages must be an array');
    } else {
      if (content.messages.length === 0) {
        errors.push('At least one message is required');
      }

      content.messages.forEach((message, index) => {
        if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
          errors.push(`Invalid role at message ${index}: ${message.role}`);
        }
        if (typeof message.content !== 'string') {
          errors.push(`Message content must be string at index ${index}`);
        }
      });
    }

    // Validate optional parameters
    if (content.temperature !== undefined) {
      if (typeof content.temperature !== 'number' || content.temperature < 0 || content.temperature > 2) {
        errors.push('Temperature must be a number between 0 and 2');
      }
    }

    if (content.top_p !== undefined) {
      if (typeof content.top_p !== 'number' || content.top_p < 0 || content.top_p > 1) {
        errors.push('top_p must be a number between 0 and 1');
      }
    }

    if (content.max_tokens !== undefined) {
      if (typeof content.max_tokens !== 'number' || content.max_tokens <= 0) {
        errors.push('max_tokens must be a positive number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get default render options for OpenAI
   */
  getDefaultOptions(): RenderOptions {
    return {
      model: 'gpt-4-turbo',
      temperature: 0.7,
      maxTokens: 4096
    };
  }

  /**
   * Get OpenAI provider configuration
   */
  getConfiguration(): ProviderConfiguration {
    return {
      id: this.id,
      name: this.name,
      defaultModel: 'gpt-4-turbo',
      models: this.supportedModels.map(modelId => ({
        id: modelId,
        name: this.getModelDisplayName(modelId),
        contextLength: this.getModelContextLength(modelId),
        deprecated: this.isModelDeprecated(modelId),
        capabilities: this.capabilities
      })),
      rateLimits: {
        requestsPerMinute: 3500, // Tier 1 default
        tokensPerMinute: 90000
      }
    };
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

    return {
      maxTokens: this.getModelMaxTokens(model),
      contextLength: this.getModelContextLength(model),
      supportsSystemMessages: true
    };
  }

  /**
   * Parse OpenAI API response
   */
  parseResponse(response: any): { content: string; metadata: Record<string, any> } {
    if (!response.choices || response.choices.length === 0) {
      throw new Error('Invalid OpenAI response: no choices found');
    }

    const choice = response.choices[0];
    const content = choice.message?.content || choice.text || '';

    return {
      content,
      metadata: {
        model: response.model,
        usage: response.usage,
        finishReason: choice.finish_reason,
        index: choice.index
      }
    };
  }

  /**
   * Get display name for model
   */
  private getModelDisplayName(modelId: string): string {
    const displayNames: Record<string, string> = {
      'gpt-4': 'GPT-4',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
      'gpt-4-0125-preview': 'GPT-4 Turbo (0125)',
      'gpt-4-1106-preview': 'GPT-4 Turbo (1106)',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-3.5-turbo-0125': 'GPT-3.5 Turbo (0125)',
      'gpt-3.5-turbo-1106': 'GPT-3.5 Turbo (1106)'
    };
    return displayNames[modelId] || modelId;
  }

  /**
   * Get context length for model
   */
  private getModelContextLength(modelId: string): number {
    const contextLengths: Record<string, number> = {
      'gpt-4': 8192,
      'gpt-4-turbo': 128000,
      'gpt-4-turbo-preview': 128000,
      'gpt-4-0125-preview': 128000,
      'gpt-4-1106-preview': 128000,
      'gpt-3.5-turbo': 16385,
      'gpt-3.5-turbo-0125': 16385,
      'gpt-3.5-turbo-1106': 16385
    };
    return contextLengths[modelId] || 4096;
  }

  /**
   * Get max tokens for model
   */
  private getModelMaxTokens(modelId: string): number {
    const maxTokens: Record<string, number> = {
      'gpt-4': 4096,
      'gpt-4-turbo': 4096,
      'gpt-4-turbo-preview': 4096,
      'gpt-4-0125-preview': 4096,
      'gpt-4-1106-preview': 4096,
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-0125': 4096,
      'gpt-3.5-turbo-1106': 4096
    };
    return maxTokens[modelId] || 4096;
  }

  /**
   * Check if model is deprecated
   */
  private isModelDeprecated(modelId: string): boolean {
    const deprecatedModels = [
      'gpt-4-1106-preview', // Older preview versions
      'gpt-3.5-turbo-1106'
    ];
    return deprecatedModels.includes(modelId);
  }
}