// Import Service - Import prompts from various provider formats
import { PromptRecordClass } from '../models/prompt';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
export class ImportService {
    promptManager;
    constructor(promptManager) {
        this.promptManager = promptManager;
    }
    /**
     * Import prompts from files
     */
    async importFromFiles(filePaths, options) {
        const result = {
            imported: [],
            skipped: [],
            failed: [],
            summary: {
                totalFiles: filePaths.length,
                imported: 0,
                skipped: 0,
                failed: 0
            }
        };
        for (const filePath of filePaths) {
            try {
                const filename = path.basename(filePath);
                const content = await fs.readFile(filePath, 'utf-8');
                const importedPrompt = await this.importFromContent(content, {
                    ...options,
                    filename
                });
                if (importedPrompt) {
                    result.imported.push(importedPrompt);
                    result.summary.imported++;
                }
                else {
                    result.skipped.push({
                        filename,
                        reason: 'Import returned null - likely skipped due to conflict resolution'
                    });
                    result.summary.skipped++;
                }
            }
            catch (error) {
                result.failed.push({
                    filename: path.basename(filePath),
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                result.summary.failed++;
            }
        }
        return result;
    }
    /**
     * Import prompt from content string
     */
    async importFromContent(content, options) {
        // Parse content
        let parsedContent;
        try {
            parsedContent = JSON.parse(content);
        }
        catch (error) {
            throw new Error(`Invalid JSON content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        // Validate content
        const validation = this.validateImportContent(parsedContent, options);
        if (!validation.isValid && options.validateBeforeImport !== false) {
            throw new Error(`Import validation failed: ${validation.errors.join(', ')}`);
        }
        // Detect provider format if not specified
        const sourceProvider = options.sourceProvider || validation.detectedProvider;
        if (!sourceProvider) {
            throw new Error('Could not detect provider format. Please specify sourceProvider in options.');
        }
        // Convert to internal format
        const promptRecord = this.convertToInternalFormat(parsedContent, sourceProvider, options);

        const metadataVariables = Array.isArray(parsedContent?._metadata?.variablesUsed)
            ? parsedContent._metadata.variablesUsed.filter((name) => typeof name === 'string' && name.trim().length > 0)
            : [];
        if (metadataVariables.length > 0 && promptRecord.prompt_structured && promptRecord.prompt_structured.variables.length === 0) {
            promptRecord.prompt_structured.variables = metadataVariables;
            promptRecord.variables = metadataVariables.map(varName => ({
                key: varName,
                label: this.humanizeVariableName(varName),
                type: 'string',
                required: true
            }));
        }
        
        // Check if imported content has variant characteristics
        const variantInfo = this.detectVariantCharacteristics(promptRecord);
        if (variantInfo.isVariant && !options.forceAsBasePrompt) {
            // Handle variant detection based on user preference
            const shouldImportAsBase = await this.handleVariantDetection(variantInfo, options);
            if (!shouldImportAsBase && options.allowVariantImport) {
                // User chose to import as variant - preserve variant metadata
                // This would require additional logic to link to base prompt
                throw new Error('Variant import not yet implemented. Use forceAsBasePrompt: true to import as base prompt.');
            }
        }
        
        // Clean variant metadata to ensure this becomes a base prompt
        this.cleanVariantMetadata(promptRecord);

        // If the converted content lacks a structured prompt but has a human prompt,
        // synthesize a minimal structured prompt so downstream callers have one.
        if (!promptRecord.prompt_structured && promptRecord.prompt_human) {
            try {
                promptRecord.prompt_structured = {
                    schema_version: 1,
                    system: [promptRecord.prompt_human.goal || 'You are a helpful assistant'],
                    capabilities: [],
                    user_template: (promptRecord.prompt_human.steps || []).join('\n\n') || promptRecord.prompt_human.goal || '',
                    rules: [],
                    variables: []
                };
                promptRecord.variables = promptRecord.variables || [];
            }
            catch {
                // ignore fallback failure
            }
        }

        // Handle conflicts
        if (this.promptManager) {
            const existingPrompt = await this.findExistingPrompt(promptRecord);
            if (existingPrompt) {
                return this.handleConflict(promptRecord, existingPrompt, options);
            }

            const created = await this.promptManager.createPrompt(promptRecord.prompt_human, promptRecord.metadata);

            if (promptRecord.prompt_structured || (promptRecord.variables && promptRecord.variables.length > 0)) {
                try {
                    return await this.promptManager.updatePrompt(created.id, {
                        prompt_structured: promptRecord.prompt_structured,
                        variables: promptRecord.variables
                    });
                }
                catch (err) {
                    console.warn('ImportService: failed to attach structured prompt during import:', err instanceof Error ? err.message : err);
                    if (err && err.stack) {
                        console.warn(err.stack);
                    }
                    try {
                        created.prompt_structured = promptRecord.prompt_structured;
                        created.variables = promptRecord.variables || [];
                    }
                    catch {
                        // ignore
                    }
                    return created;
                }
            }

            return created;
        }
        return promptRecord;
    }
    /**
     * Import from directory
     */
    async importFromDirectory(directoryPath, options, filePattern = /\.(json|yaml|yml)$/i) {
        const files = await fs.readdir(directoryPath);
        const matchingFiles = files
            .filter(file => filePattern.test(file))
            .map(file => path.join(directoryPath, file));
        return this.importFromFiles(matchingFiles, options);
    }
    /**
     * Validate import content
     */
    validateImportContent(content, options) {
        const errors = [];
        const suggestions = [];
        if (!content || typeof content !== 'object') {
            return {
                isValid: false,
                errors: ['Content must be a valid object'],
                suggestions: ['Ensure the file contains valid JSON']
            };
        }
        // Detect provider format
        const detection = this.detectProviderFormat(content);
        if (!detection.provider && !options.sourceProvider) {
            errors.push('Could not detect provider format');
            suggestions.push('Specify sourceProvider in import options');
        }
        // Validate based on detected/specified provider
        const provider = options.sourceProvider || detection.provider;
        if (provider) {
            const providerValidation = this.validateProviderFormat(content, provider);
            errors.push(...providerValidation.errors);
            suggestions.push(...providerValidation.suggestions);
        }
        return {
            isValid: errors.length === 0,
            errors,
            suggestions,
            detectedProvider: detection.provider,
            confidence: detection.confidence
        };
    }
    /**
     * Detect provider format from content
     */
    detectProviderFormat(content) {
        // Internal format detection (check first as it's most specific)
        if (content.prompt_human || content.prompt_structured) {
            return { provider: 'internal', confidence: 1.0 };
        }
        // Anthropic format detection (check before OpenAI since it's more specific)
        if (content.system && typeof content.system === 'string' && content.messages && Array.isArray(content.messages)) {
            return { provider: 'anthropic', confidence: 0.9 };
        }
        // OpenAI format detection
        if (content.messages && Array.isArray(content.messages)) {
            const hasValidMessages = content.messages.every((msg) => msg.role && ['system', 'user', 'assistant'].includes(msg.role) && msg.content);
            if (hasValidMessages) {
                return { provider: 'openai', confidence: 0.9 };
            }
        }
        // Meta/Llama format detection
        if (content.messages && Array.isArray(content.messages)) {
            const hasLlamaStructure = content.messages.some((msg) => msg.role === 'system' || (msg.role === 'user' && typeof msg.content === 'string'));
            if (hasLlamaStructure) {
                return { provider: 'meta', confidence: 0.7 };
            }
        }
        return { confidence: 0 };
    }
    /**
     * Validate provider-specific format
     */
    validateProviderFormat(content, provider) {
        const errors = [];
        const suggestions = [];
        switch (provider) {
            case 'openai':
                if (!content.messages || !Array.isArray(content.messages)) {
                    errors.push('OpenAI format requires messages array');
                }
                else if (content.messages.length === 0) {
                    errors.push('Messages array cannot be empty');
                }
                break;
            case 'anthropic':
                if (!content.messages || !Array.isArray(content.messages)) {
                    errors.push('Anthropic format requires messages array');
                }
                if (typeof content.system !== 'string') {
                    suggestions.push('Anthropic format typically includes system field');
                }
                break;
            case 'meta':
                if (!content.messages || !Array.isArray(content.messages)) {
                    errors.push('Meta format requires messages array');
                }
                break;
            case 'internal':
                if (!content.prompt_human && !content.prompt_structured) {
                    errors.push('Internal format requires prompt_human or prompt_structured');
                }
                break;
            default:
                errors.push(`Unknown provider format: ${provider}`);
        }
        return { errors, suggestions };
    }
    /**
     * Convert provider format to internal format
     */
    convertToInternalFormat(content, sourceProvider, options) {
        switch (sourceProvider) {
            case 'openai':
                return this.convertFromOpenAI(content, options);
            case 'anthropic':
                return this.convertFromAnthropic(content, options);
            case 'meta':
                return this.convertFromMeta(content, options);
            case 'internal':
                return this.convertFromInternal(content, options);
            default:
                throw new Error(`Unsupported provider format: ${sourceProvider}`);
        }
    }
    /**
     * Convert from OpenAI format
     */
    convertFromOpenAI(content, options) {
        const messages = content.messages || [];
        const systemMessages = messages.filter((m) => m.role === 'system');
        const userMessages = messages.filter((m) => m.role === 'user');
        // Extract title from metadata if available, otherwise from content
        let title = 'Imported OpenAI Prompt';
        if (content._metadata?.promptTitle) {
            title = content._metadata.promptTitle;
        }
        else if (userMessages[0]?.content) {
            title = this.extractTitleFromContent(userMessages[0].content) || title;
        }
        // Create human prompt from metadata if available
        const humanPrompt = {
            goal: content._metadata?.originalPrompt?.goal || this.extractGoalFromMessages(messages),
            audience: content._metadata?.originalPrompt?.audience || 'General',
            steps: this.extractStepsFromMessages(messages),
            output_expectations: {
                format: 'Text',
                fields: []
            }
        };
        // Create structured prompt
        const structuredPrompt = {
            schema_version: 1,
            system: systemMessages.map((m) => m.content),
            capabilities: [],
            user_template: userMessages.map((m) => m.content).join('\n\n'),
            rules: [],
            variables: this.extractVariablesFromTemplate(userMessages.map((m) => m.content).join('\n\n'))
        };
        return this.createPromptRecord(title, humanPrompt, structuredPrompt, options);
    }
    /**
     * Convert from Anthropic format
     */
    convertFromAnthropic(content, options) {
        const messages = content.messages || [];
        const systemContent = content.system || '';
        const userMessages = messages.filter((m) => m.role === 'user');
        // Extract title from metadata if available, otherwise from content
        let title = 'Imported Anthropic Prompt';
        if (content._metadata?.promptTitle) {
            title = content._metadata.promptTitle;
        }
        else if (userMessages[0]?.content) {
            title = this.extractTitleFromContent(userMessages[0].content) || title;
        }
        const humanPrompt = {
            goal: content._metadata?.originalPrompt?.goal || this.extractGoalFromContent(systemContent) || 'Imported goal',
            audience: content._metadata?.originalPrompt?.audience || 'General',
            steps: this.extractStepsFromMessages(messages),
            output_expectations: {
                format: 'Text',
                fields: []
            }
        };
        const userTemplate = userMessages.map((m) => m.content).join('\n\n');
        const structuredPrompt = {
            schema_version: 1,
            system: systemContent ? [systemContent] : [],
            capabilities: [],
            user_template: userTemplate,
            rules: [],
            variables: this.extractVariablesFromTemplate(userTemplate)
        };
        return this.createPromptRecord(title, humanPrompt, structuredPrompt, options);
    }
    /**
     * Convert from Meta format
     */
    convertFromMeta(content, options) {
        // Meta format is similar to OpenAI, so reuse that logic
        return this.convertFromOpenAI(content, options);
    }
    /**
     * Convert from internal format
     */
    convertFromInternal(content, options) {
        // If it's already in internal format, create a new record with updated metadata
        const existingRecord = new PromptRecordClass(content);
        // Update metadata for import
        existingRecord.id = uuidv4();
        existingRecord.created_at = new Date().toISOString();
        existingRecord.updated_at = new Date().toISOString();
        if (options.defaultOwner) {
            existingRecord.metadata.owner = options.defaultOwner;
        }
        if (options.defaultTags) {
            existingRecord.metadata.tags = [...existingRecord.metadata.tags, ...options.defaultTags];
        }
        if (options.slugPrefix) {
            existingRecord.slug = `${options.slugPrefix}-${existingRecord.slug}`;
        }
        return existingRecord;
    }
    /**
     * Create prompt record from converted data
     */
    createPromptRecord(title, humanPrompt, structuredPrompt, options) {
        const slug = this.generateSlug(title, options.slugPrefix);
        const variables = structuredPrompt.variables.map(varName => ({
            key: varName,
            label: this.humanizeVariableName(varName),
            type: 'string',
            required: true
        }));
        return new PromptRecordClass({
            id: uuidv4(),
            slug,
            status: 'draft',
            metadata: {
                title,
                summary: `Imported prompt: ${title}`,
                tags: options.defaultTags || ['imported'],
                owner: options.defaultOwner || 'unknown'
            },
            prompt_human: humanPrompt,
            prompt_structured: structuredPrompt,
            variables,
            history: {
                versions: [],
                ratings: []
            },
            renders: []
        });
    }
    /**
     * Generate slug from title
     */
    generateSlug(title, prefix) {
        const baseSlug = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
            .substring(0, 50);
        return prefix ? `${prefix}-${baseSlug}` : baseSlug;
    }
    /**
     * Extract variables from template
     */
    extractVariablesFromTemplate(template) {
        const variableRegex = /\{\{([^}]+)\}\}/g;
        const variables = [];
        let match;
        while ((match = variableRegex.exec(template)) !== null) {
            const variableName = match[1].trim();
            if (!variables.includes(variableName)) {
                variables.push(variableName);
            }
        }
        return variables;
    }
    /**
     * Extract title from content
     */
    extractTitleFromContent(content) {
        if (!content)
            return null;
        // Look for title-like patterns
        const titlePatterns = [
            /^#\s+(.+)$/m, // Markdown header
            /^Title:\s*(.+)$/mi, // Title: prefix
        ];
        for (const pattern of titlePatterns) {
            const match = content.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        // Fallback to first meaningful words (up to 50 chars)
        const firstLine = content.split('\n')[0];
        if (firstLine && firstLine.length > 0) {
            return firstLine.substring(0, 50).trim();
        }
        return null;
    }
    /**
     * Extract goal from messages or content
     */
    extractGoalFromMessages(messages) {
        const systemMessages = messages.filter(m => m.role === 'system');
        if (systemMessages.length > 0) {
            return systemMessages[0].content.substring(0, 200) + '...';
        }
        const userMessages = messages.filter(m => m.role === 'user');
        if (userMessages.length > 0) {
            return `Help with: ${userMessages[0].content.substring(0, 100)}...`;
        }
        return 'Imported prompt goal';
    }
    /**
     * Extract goal from content string
     */
    extractGoalFromContent(content) {
        if (!content)
            return null;
        return content.substring(0, 200) + (content.length > 200 ? '...' : '');
    }
    /**
     * Extract steps from messages
     */
    extractStepsFromMessages(messages) {
        const userMessages = messages.filter(m => m.role === 'user');
        if (userMessages.length === 0)
            return ['Process the request'];
        // Try to extract numbered steps
        const content = userMessages.map(m => m.content).join('\n');
        const stepMatches = content.match(/^\d+\.\s+(.+)$/gm);
        if (stepMatches && stepMatches.length > 1) {
            return stepMatches.map(step => step.replace(/^\d+\.\s+/, ''));
        }
        // Fallback to generic steps
        return [
            'Analyze the user request',
            'Process the information',
            'Provide appropriate response'
        ];
    }
    /**
     * Humanize variable name
     */
    humanizeVariableName(varName) {
        return varName
            .replace(/[_-]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }
    /**
     * Find existing prompt by slug or title
     */
    async findExistingPrompt(promptRecord) {
        if (!this.promptManager)
            return null;
        try {
            // Try to find by slug first
            const existingBySlug = await this.promptManager.getPrompt(promptRecord.slug);
            if (existingBySlug)
                return existingBySlug;
        }
        catch {
            // Prompt not found by slug
        }
        try {
            // Try to find by title
            const allPrompts = await this.promptManager.listPrompts({});
            const existingByTitle = allPrompts.find(p => p.metadata.title.toLowerCase() === promptRecord.metadata.title.toLowerCase());
            return existingByTitle || null;
        }
        catch {
            return null;
        }
    }
    /**
     * Detect if imported content has variant characteristics
     */
    detectVariantCharacteristics(promptRecord) {
        const variantIndicators = [];
        const metadata = promptRecord.metadata;
        const tags = metadata.tags || [];
        
        // Check for variant tags
        const variantTags = ['enhanced'];
        const providerModelPattern = /^(openai|anthropic|meta|aws|google)-/i;
        
        for (const tag of tags) {
            if (variantTags.includes(tag.toLowerCase())) {
                variantIndicators.push(`Tag: ${tag}`);
            }
            if (providerModelPattern.test(tag)) {
                variantIndicators.push(`Provider-model tag: ${tag}`);
            }
        }
        
        // Check for variant metadata fields
        if (metadata.variant_of) {
            variantIndicators.push(`Linked to base prompt: ${metadata.variant_of}`);
        }
        if (metadata.tuned_for_provider) {
            variantIndicators.push(`Tuned for provider: ${metadata.tuned_for_provider}`);
        }
        if (metadata.preferred_model) {
            variantIndicators.push(`Preferred model: ${metadata.preferred_model}`);
        }
        
        // Check for variant title patterns
        const title = metadata.title || '';
        const variantTitlePatterns = [
            /\(enhanced\)/i,
            /\(.*-.*\)/i, // provider-model pattern
            /enhanced/i,
            /optimized for/i,
            /tuned for/i
        ];
        
        for (const pattern of variantTitlePatterns) {
            if (pattern.test(title)) {
                variantIndicators.push(`Title pattern: ${title}`);
                break;
            }
        }
        
        return {
            isVariant: variantIndicators.length > 0,
            indicators: variantIndicators,
            confidence: Math.min(variantIndicators.length / 3, 1) // 0-1 scale
        };
    }
    
    /**
     * Handle variant detection - ask user or use options
     */
    async handleVariantDetection(variantInfo, options) {
        // If user has specified behavior, use it
        if (options.forceAsBasePrompt === true) {
            return true; // Import as base prompt
        }
        if (options.forceAsVariant === true) {
            return false; // Import as variant
        }
        
        // If interactive mode is disabled, default to base prompt
        if (options.interactive === false) {
            return true;
        }
        
        // In a real implementation, this would show a user prompt
        // For now, we'll use a callback if provided, otherwise default to base prompt
        if (options.onVariantDetected && typeof options.onVariantDetected === 'function') {
            return await options.onVariantDetected(variantInfo);
        }
        
        // Default: import as base prompt (safer option)
        return true;
    }
    
    /**
     * Clean variant metadata to ensure prompt becomes a base prompt
     */
    cleanVariantMetadata(promptRecord) {
        const metadata = promptRecord.metadata;
        
        // Remove variant-specific metadata fields
        delete metadata.variant_of;
        delete metadata.tuned_for_provider;
        delete metadata.preferred_model;
        
        // Clean variant tags
        if (metadata.tags) {
            const variantTags = ['enhanced'];
            const providerModelPattern = /^(openai|anthropic|meta|aws|google)-/i;
            
            metadata.tags = metadata.tags.filter(tag => {
                return !variantTags.includes(tag.toLowerCase()) && 
                       !providerModelPattern.test(tag);
            });
        }
        
        // Clean variant title patterns
        if (metadata.title) {
            metadata.title = metadata.title
                .replace(/\s*\(enhanced\)/i, '')
                .replace(/\s*\([^)]*-[^)]*\)/i, '') // Remove (provider-model) patterns
                .replace(/\s*-\s*enhanced\s+using\s+.*/i, '') // Remove enhancement descriptions
                .replace(/\s*-\s*optimized\s+for\s+.*/i, '') // Remove optimization descriptions
                .trim();
        }
        
        // Clean summary
        if (metadata.summary) {
            metadata.summary = metadata.summary
                .replace(/\s*-\s*enhanced\s+using\s+.*/i, '')
                .replace(/\s*-\s*optimized\s+for\s+.*/i, '')
                .trim();
        }
        
        // Ensure imported tag is present
        if (!metadata.tags) {
            metadata.tags = [];
        }
        if (!metadata.tags.includes('imported')) {
            metadata.tags.push('imported');
        }
        
        // Add base-prompt tag to clearly indicate this is a base prompt
        if (!metadata.tags.includes('base-prompt')) {
            metadata.tags.push('base-prompt');
        }
    }
    
    /**
     * Handle conflict resolution
     */
    async handleConflict(newPrompt, existingPrompt, options) {
        switch (options.conflictResolution) {
            case 'skip':
                return null;
            case 'overwrite':
                if (this.promptManager) {
                    return await this.promptManager.updatePrompt(existingPrompt.id, {
                        prompt_human: newPrompt.prompt_human,
                        prompt_structured: newPrompt.prompt_structured,
                        variables: newPrompt.variables,
                        metadata: {
                            ...existingPrompt.metadata,
                            ...newPrompt.metadata
                        }
                    });
                }
                return newPrompt;
            case 'create_new':
                // Modify slug to make it unique
                newPrompt.slug = `${newPrompt.slug}-imported-${Date.now()}`;
                newPrompt.metadata.title = `${newPrompt.metadata.title} (Imported)`;
                if (this.promptManager) {
                    const created = await this.promptManager.createPrompt(newPrompt.prompt_human, newPrompt.metadata);
                    if (newPrompt.prompt_structured || (newPrompt.variables && newPrompt.variables.length > 0)) {
                        try {
                            return await this.promptManager.updatePrompt(created.id, {
                                prompt_structured: newPrompt.prompt_structured,
                                variables: newPrompt.variables
                            });
                        }
                        catch (err) {
                            console.warn('ImportService: failed to attach structured prompt during import:', err instanceof Error ? err.message : err);
                            if (err && err.stack) {
                                console.warn(err.stack);
                            }
                            try {
                                created.prompt_structured = newPrompt.prompt_structured;
                                created.variables = newPrompt.variables || [];
                            }
                            catch {
                                // ignore
                            }
                            return created;
                        }
                    }
                    return created;
                }
                return newPrompt;
            case 'prompt':
                // In a real implementation, this would prompt the user
                // For now, default to create_new
                return this.handleConflict(newPrompt, existingPrompt, {
                    ...options,
                    conflictResolution: 'create_new'
                });
            default:
                throw new Error(`Unknown conflict resolution strategy: ${options.conflictResolution}`);
        }
    }
}
//# sourceMappingURL=import-service.js.map