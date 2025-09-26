// Microsoft Copilot Provider Adapter - Implementation for Microsoft Copilot API format

import { BaseProviderAdapter } from './base-provider-adapter';
import { StructuredPrompt } from '../models/prompt';
import { ProviderConfiguration, ProviderCapabilities } from '../models/provider';
import { RenderOptions, ProviderPayload } from '../types/common';
import { ValidationResult } from '../types/validation';

interface CopilotMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CopilotPayload {
  model: string;
  messages: CopilotMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
}

export class MicrosoftCopilotAdapter extends BaseProviderAdapter {
  readonly id = 'microsoft-copilot';
  readonly name = 'Microsoft Copilot';
  readonly supportedModels = [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-4-32k',
    'gpt-35-turbo',
    'gpt-35-turbo-16k',
    'text-davinci-003',
    'code-davinci-002'
  ];
  
  readonly capabilities: ProviderCapabilities = {
    supportsSystemMessages: true,
    supportsMultipleMessages: true,
    supportsTemperature: true,
    supportsTopP: true,
    supportsMaxTokens: true,
    maxContextLength: 32768, // GPT-4-32k max
    supportedMessageRoles: ['system', 'user', 'assistant']
  };

  /**
   * Render structured prompt into Microsoft Copilot messages format
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

    const messages: CopilotMessage[] = [];

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

    // Build Microsoft Copilot payload
    const payload: CopilotPayload = {
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

    // Add Copilot-specific parameters with defaults
    if (options.presencePenalty !== undefined) {
      payload.presence_penalty = options.presencePenalty;
    }
    if (options.frequencyPenalty !== undefined) {
      payload.frequency_penalty = options.frequencyPenalty;
    }

    return {
      provider: this.id,
      model: options.model,
      content: payload,
      metadata: {
        messageCount: messages.length,
        hasSystemMessage: messages.some(m => m.role === 'system'),
        estimatedTokens: this.estimateTokens(messages.map(m => m.content).join(' ')),
        apiVersion: '2024-02-15-preview'
      }
    };
  }

  /**
   * Validate Microsoft Copilot payload format
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

    const content = payload.content as CopilotPayload;

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

    if (content.presence_penalty !== undefined) {
      if (typeof content.presence_penalty !== 'number' || content.presence_penalty < -2 || content.presence_penalty > 2) {
        errors.push('presence_penalty must be a number between -2 and 2');
      }
    }

    if (content.frequency_penalty !== undefined) {
      if (typeof content.frequency_penalty !== 'number' || content.frequency_penalty < -2 || content.frequency_penalty > 2) {
        errors.push('frequency_penalty must be a number between -2 and 2');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get default render options for Microsoft Copilot
   */
  getDefaultOptions(): RenderOptions {
    return {
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 4096
    };
  }

  /**
   * Get Microsoft Copilot provider configuration
   */
  getConfiguration(): ProviderConfiguration {
    return {
      id: this.id,
      name: this.name,
      defaultModel: 'gpt-4',
      models: this.supportedModels.map(modelId => ({
        id: modelId,
        name: this.getModelDisplayName(modelId),
        contextLength: this.getModelContextLength(modelId),
        deprecated: this.isModelDeprecated(modelId),
        capabilities: this.capabilities
      })),
      rateLimits: {
        requestsPerMinute: 1000, // Azure OpenAI Service default
        tokensPerMinute: 60000
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
   * Parse Microsoft Copilot API response
   */
  parseResponse(response: any): { content: string; metadata: Record<string, any> } {
    if (!response.choices || response.choices.length === 0) {
      throw new Error('Invalid Microsoft Copilot response: no choices found');
    }

    const choice = response.choices[0];
    const content = choice.message?.content || choice.text || '';

    return {
      content,
      metadata: {
        model: response.model,
        usage: response.usage,
        finishReason: choice.finish_reason,
        index: choice.index,
        apiVersion: response.api_version
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
      'gpt-4-32k': 'GPT-4 32K',
      'gpt-35-turbo': 'GPT-3.5 Turbo',
      'gpt-35-turbo-16k': 'GPT-3.5 Turbo 16K',
      'text-davinci-003': 'Text Davinci 003',
      'code-davinci-002': 'Code Davinci 002'
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
      'gpt-4-32k': 32768,
      'gpt-35-turbo': 4096,
      'gpt-35-turbo-16k': 16384,
      'text-davinci-003': 4097,
      'code-davinci-002': 8001
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
      'gpt-4-32k': 4096,
      'gpt-35-turbo': 4096,
      'gpt-35-turbo-16k': 4096,
      'text-davinci-003': 4097,
      'code-davinci-002': 8001
    };
    return maxTokens[modelId] || 4096;
  }

  /**
   * Check if model is deprecated
   */
  private isModelDeprecated(modelId: string): boolean {
    const deprecatedModels = [
      'text-davinci-003', // Legacy completion models
      'code-davinci-002'
    ];
    return deprecatedModels.includes(modelId);
  }
}