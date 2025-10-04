// FileSystemPromptManager - Concrete implementation that orchestrates all services
import { PromptRecordClass } from '../models/prompt';
import { v4 as uuidv4 } from 'uuid';
export class FileSystemPromptManager {
    storage;
    enhancementAgent;
    variableManager;
    ratingSystem;
    versionManager;
    providerRegistry;
    constructor(config) {
        this.storage = config.storage;
        this.enhancementAgent = config.enhancementAgent;
        this.variableManager = config.variableManager;
        this.ratingSystem = config.ratingSystem;
        this.versionManager = config.versionManager;
        this.providerRegistry = config.providerRegistry;
    }
    /**
     * Initialize the prompt manager and all its services
     */
    async initialize() {
        // Initialize storage first as other services may depend on it
        await this.storage.initialize();
        // Initialize rating system if it has an initialize method
        if ('initialize' in this.ratingSystem && typeof this.ratingSystem.initialize === 'function') {
            await this.ratingSystem.initialize();
        }
    }
    /**
     * Create a new prompt from human-readable format
     */
    async createPrompt(humanPrompt, metadata) {
        // Validate input
        if (!metadata.title || metadata.title.trim().length === 0) {
            throw new Error('Title is required');
        }
        if (!metadata.owner || metadata.owner.trim().length === 0) {
            throw new Error('Owner is required');
        }
        // Validate human prompt
        const humanPromptClass = new (await import('../models/prompt')).HumanPromptClass(humanPrompt);
        const validation = humanPromptClass.validate();
        if (!validation.isValid) {
            throw new Error(`Invalid human prompt: ${validation.errors.join(', ')}`);
        }
        // Generate slug from title
        const slug = await this.storage.generateSlug(metadata.title);
        // Create prompt record
        const promptRecord = new PromptRecordClass({
            id: uuidv4(),
            slug,
            metadata: {
                title: metadata.title.trim(),
                summary: metadata.summary.trim(),
                tags: metadata.tags.map(tag => tag.trim()).filter(tag => tag.length > 0),
                owner: metadata.owner.trim()
            },
            prompt_human: humanPrompt,
            variables: [],
            status: 'draft'
        });
        // Add initial version to history
        const initialVersion = this.versionManager.createVersion(promptRecord, {
            author: metadata.owner,
            message: 'Initial prompt creation'
        });
        promptRecord.history.versions.push(initialVersion);
        // Save to storage
        await this.storage.savePrompt(promptRecord);
        return promptRecord;
    }
    /**
     * Update an existing prompt
     */
    async updatePrompt(id, updates) {
        // Load existing prompt
        const existingPrompt = await this.storage.loadPrompt(id);
        const oldPrompt = new PromptRecordClass(existingPrompt);
        // Create updated prompt
        const updatedPrompt = new PromptRecordClass({
            ...existingPrompt,
            ...updates,
            id: existingPrompt.id, // Ensure ID doesn't change
            updated_at: new Date().toISOString()
        });
        // Validate the updated prompt
        const validation = updatedPrompt.validate();
        if (!validation.isValid) {
            throw new Error(`Invalid prompt update: ${validation.errors.join(', ')}`);
        }
        // If this is a significant change, create a new version
        const comparison = this.versionManager.compareVersions(oldPrompt, updatedPrompt);
        if (comparison.changes.length > 0) {
            // Increment version
            updatedPrompt.version = existingPrompt.version + 1;
            // Create version entry
            const versionEntry = this.versionManager.createVersion(updatedPrompt, {
                author: updates.metadata?.owner || existingPrompt.metadata.owner,
                message: comparison.summary || 'Prompt updated'
            });
            // Add to history
            updatedPrompt.history.versions.push(versionEntry);
        }
        // Save updated prompt
        await this.storage.savePrompt(updatedPrompt);
        return updatedPrompt;
    }
    /**
     * Retrieve a prompt by ID
     */
    async getPrompt(id) {
        return await this.storage.loadPrompt(id);
    }
    /**
     * List prompts with optional filtering
     */
    async listPrompts(filters) {
        if (filters && Object.keys(filters).length > 0) {
            // Use indexed search if filters are provided
            const searchResults = await this.storage.searchPrompts(filters);
            // Load full prompt records
            const prompts = [];
            for (const result of searchResults) {
                try {
                    const prompt = await this.storage.loadPrompt(result.id);
                    prompts.push(prompt);
                }
                catch (error) {
                    console.warn(`Failed to load prompt ${result.id}:`, error);
                }
            }
            return prompts;
        }
        else {
            // Return all prompts
            return await this.storage.listPrompts();
        }
    }
    /**
     * Delete a prompt
     */
    async deletePrompt(id) {
        // Verify prompt exists
        const exists = await this.storage.promptExists(id);
        if (!exists) {
            throw new Error(`Prompt with ID ${id} not found`);
        }
        // Delete from storage
        await this.storage.deletePrompt(id);
    }
    /**
     * Enhance a prompt using LLM
     */
    async enhancePrompt(id, options) {
        // Load the prompt
        const prompt = await this.storage.loadPrompt(id);
        // Enhance using the enhancement agent
        const enhancementResult = await this.enhancementAgent.enhance(prompt.prompt_human, {
            targetProvider: options?.target_provider,
            userPreferences: options?.preserve_style ? { preserveStyle: true } : undefined
        });
        // Update the prompt with structured version and variables
        const updatedPrompt = new PromptRecordClass({
            ...prompt,
            prompt_structured: enhancementResult.structuredPrompt,
            variables: this.enhancementAgent.extractVariables(enhancementResult.structuredPrompt.user_template),
            updated_at: new Date().toISOString()
        });
        // Create new version for enhancement
        updatedPrompt.version = prompt.version + 1;
        const versionEntry = this.versionManager.createVersion(updatedPrompt, {
            author: 'system',
            message: `Enhanced prompt: ${enhancementResult.rationale}`
        });
        updatedPrompt.history.versions.push(versionEntry);
        // Save the enhanced prompt
        await this.storage.savePrompt(updatedPrompt);
        return enhancementResult;
    }
    /**
     * Get prompt history and versions
     */
    async getPromptHistory(id) {
        const prompt = await this.storage.loadPrompt(id);
        return prompt.history;
    }
    /**
     * Create a new version of a prompt
     */
    async createVersion(id, changes, message, author) {
        // Load existing prompt
        const existingPrompt = await this.storage.loadPrompt(id);
        // Apply changes
        const updatedPrompt = new PromptRecordClass({
            ...existingPrompt,
            ...changes,
            id: existingPrompt.id, // Ensure ID doesn't change
            version: existingPrompt.version + 1,
            updated_at: new Date().toISOString()
        });
        // Validate the updated prompt
        const validation = updatedPrompt.validate();
        if (!validation.isValid) {
            throw new Error(`Invalid prompt changes: ${validation.errors.join(', ')}`);
        }
        // Create version entry
        const versionEntry = this.versionManager.createVersion(updatedPrompt, {
            author,
            message
        });
        // Add to history
        updatedPrompt.history.versions.push(versionEntry);
        // Save updated prompt
        await this.storage.savePrompt(updatedPrompt);
        return updatedPrompt;
    }
    /**
     * Render a prompt for a specific provider
     */
    async renderPrompt(id, provider, options) {
        // Load the prompt
        const prompt = await this.storage.loadPrompt(id);
        // Check if prompt has structured version
        if (!prompt.prompt_structured) {
            throw new Error('Prompt must be enhanced before rendering. Call enhancePrompt() first.');
        }
        // Get provider adapter
        const adapter = this.providerRegistry.getAdapter(provider);
        if (!adapter) {
            throw new Error(`Provider '${provider}' not found`);
        }
        // Validate model support
        if (options.model && !adapter.supports(options.model)) {
            throw new Error(`Provider '${provider}' does not support model '${options.model}'`);
        }
        // Check for cached render
        const cachedRender = await this.storage.getCachedRender(id, provider, prompt.version);
        if (cachedRender && this.isRenderOptionsCompatible(cachedRender, options)) {
            if (cachedRender.variables_used === undefined) {
                const variablesUsed = this.computeVariablesUsed(prompt.prompt_structured, options.variables);
                cachedRender.variables_used = variablesUsed;
            }
            return cachedRender;
        }
        // Validate that all required variables have values
        const validationResult = this.validateVariablesForRendering(prompt, options);
        if (!validationResult.isValid) {
            throw new Error(`Cannot render prompt: ${validationResult.errors.join(', ')}`);
        }
        // Substitute variables in the structured prompt if variable values are provided
        let structuredPrompt = prompt.prompt_structured;
        if (options.variables) {
            structuredPrompt = this.substituteVariablesInStructuredPrompt(prompt.prompt_structured, options.variables);
        }
        // Render using provider adapter
        const payload = adapter.render(structuredPrompt, options);
        // Validate the rendered payload
        const payloadValidation = adapter.validate(payload);
        if (!payloadValidation.isValid) {
            throw new Error(`Invalid render output: ${payloadValidation.errors.join(', ')}`);
        }
        const variablesUsed = this.computeVariablesUsed(prompt.prompt_structured, options.variables);
        if (!payload.metadata)
            payload.metadata = {};
        payload.variables_used = variablesUsed;
        // Cache the render result
        await this.storage.cacheRender(id, provider, prompt.version, payload);
        // Update prompt renders metadata
        const renderEntry = {
            provider,
            model_hint: options.model || 'default',
            version_of_prompt: prompt.version,
            created_at: new Date().toISOString(),
            content_ref: `${id}_${provider}_v${prompt.version}`
        };
        // Add render entry if not already present
        const existingRenderIndex = prompt.renders.findIndex(r => r.provider === provider && r.version_of_prompt === prompt.version);
        if (existingRenderIndex >= 0) {
            prompt.renders[existingRenderIndex] = renderEntry;
        }
        else {
            prompt.renders.push(renderEntry);
        }
        // Save updated prompt metadata
        await this.storage.savePrompt(prompt);
        return payload;
    }
    /**
     * Export a prompt in provider-specific format
     */
    async exportPrompt(id, provider, options) {
        // Render the prompt
        const payload = await this.renderPrompt(id, provider, options);
        // Load prompt for metadata
        const prompt = await this.storage.loadPrompt(id);
        // Generate filename
        const filename = options.filename || `${prompt.slug}_${provider}_v${prompt.version}.json`;
        // Create export metadata
        const exportMetadata = {
            promptId: id,
            provider,
            version: prompt.version,
            exportedAt: new Date().toISOString()
        };
        // Create export content with metadata
        const exportContent = {
            ...payload,
            _metadata: exportMetadata
        };
        return {
            filename,
            content: JSON.stringify(exportContent, null, 2),
            metadata: exportMetadata
        };
    }
    computeVariablesUsed(structuredPrompt, providedVariables) {
        if (!structuredPrompt || !structuredPrompt.user_template) {
            return [];
        }
        try {
            const templateVariables = this.variableManager.extractVariableNames(structuredPrompt.user_template);
            if (!providedVariables) {
                return templateVariables;
            }
            const providedKeys = Object.keys(providedVariables);
            if (providedKeys.length === 0) {
                return [];
            }
            return templateVariables.filter(variable => providedKeys.includes(variable));
        }
        catch (error) {
            console.warn('Failed to compute variables_used metadata:', error);
            return [];
        }
    }
    /**
     * Validate that all required variables have values for rendering
     */
    validateVariablesForRendering(prompt, options) {
        const errors = [];
        if (!prompt.prompt_structured) {
            errors.push('Prompt must have structured version for rendering');
            return { isValid: false, errors };
        }
        // Get variables referenced in the template
        const templateVariables = this.variableManager.extractVariableNames(prompt.prompt_structured.user_template);
        // Check if variable values are provided
        if (!options.variables) {
            // Check if there are any required variables
            const requiredVariables = prompt.variables.filter(v => v.required);
            const requiredTemplateVariables = requiredVariables.filter(v => templateVariables.includes(v.key));
            if (requiredTemplateVariables.length > 0) {
                errors.push(`Missing variable values for required variables: ${requiredTemplateVariables.map(v => v.key).join(', ')}`);
            }
        }
        else {
            // Validate provided variable values
            const variableMap = new Map(prompt.variables.map(v => [v.key, v]));
            for (const templateVar of templateVariables) {
                const variable = variableMap.get(templateVar);
                if (!variable) {
                    errors.push(`Template references undefined variable: ${templateVar}`);
                    continue;
                }
                if (variable.required &&
                    (options.variables[templateVar] === undefined ||
                        options.variables[templateVar] === null ||
                        options.variables[templateVar] === '')) {
                    errors.push(`Required variable '${templateVar}' has no value`);
                }
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Substitute variables in structured prompt
     */
    substituteVariablesInStructuredPrompt(structured, variableValues) {
        const result = { ...structured };
        // Substitute in user template
        result.user_template = this.variableManager.substituteVariables(structured.user_template, variableValues, { strict: false });
        // Substitute in system instructions if they contain variables
        result.system = structured.system.map((instruction) => this.variableManager.substituteVariables(instruction, variableValues, { strict: false }));
        return result;
    }
    /**
     * Check if cached render is compatible with current options
     */
    isRenderOptionsCompatible(cachedRender, currentOptions) {
        // For now, we'll do a simple check
        // In a more sophisticated implementation, we might compare specific options
        // that affect the render output
        // If variable values are provided, we need to check if they match the cached version
        // For simplicity in this implementation, we'll assume cached renders are compatible
        // unless the model is different
        if (currentOptions.model && cachedRender.model !== currentOptions.model) {
            return false;
        }
        return true;
    }
    /**
     * Get service statistics and health information
     */
    async getServiceStats() {
        const [storageStats, prompts] = await Promise.all([
            this.storage.getStorageStats(),
            this.listPrompts()
        ]);
        // Calculate prompt statistics
        const promptStats = {
            total: prompts.length,
            byStatus: prompts.reduce((acc, prompt) => {
                acc[prompt.status] = (acc[prompt.status] || 0) + 1;
                return acc;
            }, {})
        };
        // Get provider statistics
        const providers = this.providerRegistry.listProviders();
        const providerStats = {
            total: providers.length,
            available: providers.map(p => p.id)
        };
        return {
            storage: storageStats,
            prompts: promptStats,
            providers: providerStats
        };
    }
    /**
     * Shutdown the prompt manager and cleanup resources
     */
    async shutdown() {
        await this.storage.shutdown();
    }
}
//# sourceMappingURL=filesystem-prompt-manager.js.map