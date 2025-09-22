// Meta Provider Adapter - Implementation for Llama API format

import { BaseProviderAdapter } from './base-provider-adapter';
import { StructuredPrompt } from '../models/prompt';
import { ProviderConfiguration, ProviderCapabilities } from '../models/provider';
import { RenderOptions, ProviderPayload } from '../types/common';
import { ValidationResult } from '../types/validation';

interface MetaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MetaPayload {
  model: string;
  messages: MetaMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

export class MetaAdapter extends BaseProviderAdapter {
  readonly id = 'meta';
  readonly name = 'Meta';
  readonly supportedModels = [
    'llama-3.1-405b-instruct',
    'llama-3.1-70b-instruct',
    'llama-3.1-8b-instruct',
    'llama-3-70b-instruct',
    'llama-3-8b-instruct',
    'llama-2-70b-chat',
    'llama-2-13b-chat',
    'llama-2-7b-chat'
  ];
  
  readonly capabilities: ProviderCapabilities = {
    supportsSystemMessages: true,
    supportsMultipleMessages: true,
    supportsTemperature: true,
    supportsTopP: true,
    supportsMaxTokens: true,
    maxContextLength: 128000, // Llama 3.1 context length
    supportedMessageRoles: ['system', 'user', 'assistant']
  };

  /**
   * Render structured prompt into Meta/Llama messages format
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

    const messages: MetaMessage[] = [];

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

    // Build Meta payload
    const payload: MetaPayload = {
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
        estimatedTokens: this.estimateTokens(messages.map(m => m.content).join(' ')),
        modelFamily: this.getModelFamily(options.model)
      }
    };
  }

  /**
   * Validate Meta payload format
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

    const content = payload.content as MetaPayload;

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

      // Validate message order for Llama models
      const systemMessages = content.messages.filter(m => m.role === 'system');
      if (systemMessages.length > 1) {
        errors.push('Llama models support only one system message');
      }
      if (systemMessages.length === 1 && content.messages[0].role !== 'system') {
        errors.push('System message must be the first message for Llama models');
      }
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
   * Get default render options for Meta
   */
  getDefaultOptions(): RenderOptions {
    return {
      model: 'llama-3.1-70b-instruct',
      temperature: 0.7,
      maxTokens: 4096
    };
  }

  /**
   * Get Meta provider configuration
   */
  getConfiguration(): ProviderConfiguration {
    return {
      id: this.id,
      name: this.name,
      defaultModel: 'llama-3.1-70b-instruct',
      models: this.supportedModels.map(modelId => ({
        id: modelId,
        name: this.getModelDisplayName(modelId),
        contextLength: this.getModelContextLength(modelId),
        deprecated: this.isModelDeprecated(modelId),
        capabilities: this.capabilities
      })),
      rateLimits: {
        requestsPerMinute: 200, // Meta API default
        tokensPerMinute: 10000
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
   * Parse Meta API response
   */
  parseResponse(response: any): { content: string; metadata: Record<string, any> } {
    if (!response.choices || response.choices.length === 0) {
      throw new Error('Invalid Meta response: no choices found');
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
   * Get model family (Llama 2, Llama 3, etc.)
   */
  private getModelFamily(modelId: string): string {
    if (modelId.includes('llama-3.1')) return 'Llama 3.1';
    if (modelId.includes('llama-3')) return 'Llama 3';
    if (modelId.includes('llama-2')) return 'Llama 2';
    return 'Unknown';
  }

  /**
   * Get display name for model
   */
  private getModelDisplayName(modelId: string): string {
    const displayNames: Record<string, string> = {
      'llama-3.1-405b-instruct': 'Llama 3.1 405B Instruct',
      'llama-3.1-70b-instruct': 'Llama 3.1 70B Instruct',
      'llama-3.1-8b-instruct': 'Llama 3.1 8B Instruct',
      'llama-3-70b-instruct': 'Llama 3 70B Instruct',
      'llama-3-8b-instruct': 'Llama 3 8B Instruct',
      'llama-2-70b-chat': 'Llama 2 70B Chat',
      'llama-2-13b-chat': 'Llama 2 13B Chat',
      'llama-2-7b-chat': 'Llama 2 7B Chat'
    };
    return displayNames[modelId] || modelId;
  }

  /**
   * Get context length for model
   */
  private getModelContextLength(modelId: string): number {
    const contextLengths: Record<string, number> = {
      'llama-3.1-405b-instruct': 128000,
      'llama-3.1-70b-instruct': 128000,
      'llama-3.1-8b-instruct': 128000,
      'llama-3-70b-instruct': 8192,
      'llama-3-8b-instruct': 8192,
      'llama-2-70b-chat': 4096,
      'llama-2-13b-chat': 4096,
      'llama-2-7b-chat': 4096
    };
    return contextLengths[modelId] || 4096;
  }

  /**
   * Get max tokens for model
   */
  private getModelMaxTokens(modelId: string): number {
    const maxTokens: Record<string, number> = {
      'llama-3.1-405b-instruct': 4096,
      'llama-3.1-70b-instruct': 4096,
      'llama-3.1-8b-instruct': 4096,
      'llama-3-70b-instruct': 4096,
      'llama-3-8b-instruct': 4096,
      'llama-2-70b-chat': 4096,
      'llama-2-13b-chat': 4096,
      'llama-2-7b-chat': 4096
    };
    return maxTokens[modelId] || 4096;
  }

  /**
   * Check if model is deprecated
   */
  private isModelDeprecated(modelId: string): boolean {
    const deprecatedModels = [
      'llama-2-7b-chat', // Older smaller models
      'llama-2-13b-chat'
    ];
    return deprecatedModels.includes(modelId);
  }
}