// Base abstract class for provider adapters
export class BaseProviderAdapter {
    /**
     * Check if a model is supported
     */
    supports(model) {
        return this.supportedModels.includes(model);
    }
    /**
     * Get model-specific information
     */
    getModelInfo(model) {
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
    estimateTokens(prompt) {
        // Simple estimation: ~4 characters per token
        return Math.ceil(prompt.length / 4);
    }
    /**
     * Validate render options
     */
    validateRenderOptions(options) {
        const errors = [];
        // Check if model is supported
        if (!this.supports(options.model)) {
            errors.push(`Model '${options.model}' is not supported by ${this.name}`);
        }
        // Validate temperature
        if (options.temperature !== undefined) {
            if (!this.capabilities.supportsTemperature) {
                errors.push(`${this.name} does not support temperature parameter`);
            }
            else if (options.temperature < 0 || options.temperature > 2) {
                errors.push('Temperature must be between 0 and 2');
            }
        }
        // Validate topP
        if (options.topP !== undefined) {
            if (!this.capabilities.supportsTopP) {
                errors.push(`${this.name} does not support topP parameter`);
            }
            else if (options.topP < 0 || options.topP > 1) {
                errors.push('TopP must be between 0 and 1');
            }
        }
        // Validate maxTokens
        if (options.maxTokens !== undefined) {
            if (!this.capabilities.supportsMaxTokens) {
                errors.push(`${this.name} does not support maxTokens parameter`);
            }
            else if (options.maxTokens <= 0) {
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
    substituteVariables(template, variables) {
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
    validateStructuredPrompt(structured) {
        const errors = [];
        if (!structured.user_template) {
            errors.push('User template is required');
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
//# sourceMappingURL=base-provider-adapter.js.map