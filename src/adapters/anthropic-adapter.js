// Anthropic Provider Adapter - Implementation for Claude API format
import { BaseProviderAdapter } from './base-provider-adapter';
export class AnthropicAdapter extends BaseProviderAdapter {
    id = 'anthropic';
    name = 'Anthropic';
    supportedModels = [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-sonnet-20240620',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        'claude-3-5-haiku-20241022'
    ];
    capabilities = {
        supportsSystemMessages: true,
        supportsMultipleMessages: true,
        supportsTemperature: true,
        supportsTopP: true,
        supportsMaxTokens: true,
        maxContextLength: 200000, // Claude 3 context length
        supportedMessageRoles: ['user', 'assistant'] // Note: system is separate field
    };
    /**
     * Render structured prompt into Anthropic messages format
     */
    render(structured, options) {
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
        const messages = [];
        // Prepare user message from template
        let userContent = structured.user_template;
        // Substitute variables if any are provided in options
        if ('variables' in options && options.variables) {
            userContent = this.substituteVariables(userContent, options.variables);
        }
        messages.push({
            role: 'user',
            content: userContent
        });
        // Build Anthropic payload
        const payload = {
            model: options.model,
            messages,
            max_tokens: options.maxTokens || 4096 // Required field for Anthropic
        };
        // Add system message if present (separate field in Anthropic)
        if (structured.system && structured.system.length > 0) {
            let systemContent = structured.system.join('\n\n');
            // Apply system override if provided
            if (options.systemOverride) {
                systemContent = options.systemOverride;
            }
            payload.system = systemContent;
        }
        // Add optional parameters
        if (options.temperature !== undefined) {
            payload.temperature = options.temperature;
        }
        if (options.topP !== undefined) {
            payload.top_p = options.topP;
        }
        return {
            provider: this.id,
            model: options.model,
            content: payload,
            metadata: {
                messageCount: messages.length,
                hasSystemMessage: !!payload.system,
                estimatedTokens: this.estimateTokens((payload.system || '') + ' ' + messages.map(m => m.content).join(' '))
            }
        };
    }
    /**
     * Validate Anthropic payload format
     */
    validate(payload) {
        const errors = [];
        if (payload.provider !== this.id) {
            errors.push(`Expected provider '${this.id}', got '${payload.provider}'`);
        }
        if (!payload.content) {
            errors.push('Payload content is required');
            return { isValid: false, errors };
        }
        const content = payload.content;
        // Validate model
        if (!content.model) {
            errors.push('Model is required');
        }
        else if (!this.supports(content.model)) {
            errors.push(`Unsupported model: ${content.model}`);
        }
        // Validate max_tokens (required for Anthropic)
        if (content.max_tokens === undefined) {
            errors.push('max_tokens is required for Anthropic API');
        }
        else if (typeof content.max_tokens !== 'number' || content.max_tokens <= 0) {
            errors.push('max_tokens must be a positive number');
        }
        // Validate messages array
        if (!Array.isArray(content.messages)) {
            errors.push('Messages must be an array');
        }
        else {
            if (content.messages.length === 0) {
                errors.push('At least one message is required');
            }
            content.messages.forEach((message, index) => {
                if (!message.role || !['user', 'assistant'].includes(message.role)) {
                    errors.push(`Invalid role at message ${index}: ${message.role}. Anthropic supports only 'user' and 'assistant' roles`);
                }
                if (typeof message.content !== 'string') {
                    errors.push(`Message content must be string at index ${index}`);
                }
            });
        }
        // Validate system message (optional separate field)
        if (content.system !== undefined && typeof content.system !== 'string') {
            errors.push('System message must be a string');
        }
        // Validate optional parameters
        if (content.temperature !== undefined) {
            if (typeof content.temperature !== 'number' || content.temperature < 0 || content.temperature > 1) {
                errors.push('Temperature must be a number between 0 and 1 for Anthropic');
            }
        }
        if (content.top_p !== undefined) {
            if (typeof content.top_p !== 'number' || content.top_p < 0 || content.top_p > 1) {
                errors.push('top_p must be a number between 0 and 1');
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Get default render options for Anthropic
     */
    getDefaultOptions() {
        return {
            model: 'claude-3-5-sonnet-20241022',
            temperature: 0.7,
            maxTokens: 4096
        };
    }
    /**
     * Get Anthropic provider configuration
     */
    getConfiguration() {
        return {
            id: this.id,
            name: this.name,
            defaultModel: 'claude-3-5-sonnet-20241022',
            models: this.supportedModels.map(modelId => ({
                id: modelId,
                name: this.getModelDisplayName(modelId),
                contextLength: this.getModelContextLength(modelId),
                deprecated: this.isModelDeprecated(modelId),
                capabilities: this.capabilities
            })),
            rateLimits: {
                requestsPerMinute: 1000, // Anthropic default
                tokensPerMinute: 40000
            }
        };
    }
    /**
     * Get model-specific information
     */
    getModelInfo(model) {
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
     * Parse Anthropic API response
     */
    parseResponse(response) {
        if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
            throw new Error('Invalid Anthropic response: no content found');
        }
        // Anthropic returns content as array of content blocks
        const textContent = response.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('');
        return {
            content: textContent,
            metadata: {
                model: response.model,
                usage: response.usage,
                stopReason: response.stop_reason,
                stopSequence: response.stop_sequence
            }
        };
    }
    /**
     * Override validateRenderOptions to handle Anthropic-specific temperature range
     */
    validateRenderOptions(options) {
        const baseValidation = super.validateRenderOptions(options);
        // Override temperature validation for Anthropic (0-1 range instead of 0-2)
        if (options.temperature !== undefined && this.capabilities.supportsTemperature) {
            const temperatureErrors = baseValidation.errors.filter(e => !e.includes('Temperature must be between 0 and 2'));
            if (options.temperature < 0 || options.temperature > 1) {
                temperatureErrors.push('Temperature must be between 0 and 1 for Anthropic');
            }
            return {
                isValid: temperatureErrors.length === 0,
                errors: temperatureErrors
            };
        }
        return baseValidation;
    }
    /**
     * Get display name for model
     */
    getModelDisplayName(modelId) {
        const displayNames = {
            'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet (Latest)',
            'claude-3-5-sonnet-20240620': 'Claude 3.5 Sonnet',
            'claude-3-opus-20240229': 'Claude 3 Opus',
            'claude-3-sonnet-20240229': 'Claude 3 Sonnet',
            'claude-3-haiku-20240307': 'Claude 3 Haiku',
            'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku'
        };
        return displayNames[modelId] || modelId;
    }
    /**
     * Get context length for model
     */
    getModelContextLength(_modelId) {
        // All Claude 3 models have 200k context length
        return 200000;
    }
    /**
     * Get max tokens for model
     */
    getModelMaxTokens(modelId) {
        const maxTokens = {
            'claude-3-5-sonnet-20241022': 8192,
            'claude-3-5-sonnet-20240620': 8192,
            'claude-3-opus-20240229': 4096,
            'claude-3-sonnet-20240229': 4096,
            'claude-3-haiku-20240307': 4096,
            'claude-3-5-haiku-20241022': 8192
        };
        return maxTokens[modelId] || 4096;
    }
    /**
     * Check if model is deprecated
     */
    isModelDeprecated(modelId) {
        const deprecatedModels = [
            'claude-3-5-sonnet-20240620' // Older version
        ];
        return deprecatedModels.includes(modelId);
    }
}
//# sourceMappingURL=anthropic-adapter.js.map