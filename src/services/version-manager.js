// Version Management Service - Handles prompt versioning, change tracking, and diff functionality
export class PromptVersionManager {
    /**
     * Create a new version of a prompt
     */
    createVersion(prompt, options) {
        const { author, message } = options;
        if (!author || author.trim().length === 0) {
            throw new Error('Author is required for version creation');
        }
        if (!message || message.trim().length === 0) {
            throw new Error('Change message is required for version creation');
        }
        const newVersion = {
            number: prompt.version,
            message: message.trim(),
            created_at: new Date().toISOString(),
            author: author.trim()
        };
        // Validate the version
        const validation = this.validateVersion(newVersion);
        if (!validation.isValid) {
            throw new Error(`Invalid version data: ${validation.errors.join(', ')}`);
        }
        return newVersion;
    }
    /**
     * Compare two versions of a prompt
     */
    compareVersions(oldPrompt, newPrompt) {
        const changes = [];
        // Compare metadata
        this.compareMetadata(oldPrompt, newPrompt, changes);
        // Compare human prompt
        this.compareHumanPrompt(oldPrompt, newPrompt, changes);
        // Compare structured prompt
        this.compareStructuredPrompt(oldPrompt, newPrompt, changes);
        // Compare variables
        this.compareVariables(oldPrompt, newPrompt, changes);
        // Compare status
        if (oldPrompt.status !== newPrompt.status) {
            changes.push({
                field: 'status',
                oldValue: oldPrompt.status,
                newValue: newPrompt.status,
                changeType: 'modified'
            });
        }
        const summary = this.generateChangeSummary(changes);
        return {
            fromVersion: oldPrompt.version,
            toVersion: newPrompt.version,
            changes,
            summary
        };
    }
    /**
     * Get version history for a prompt
     */
    getVersionHistory(prompt) {
        return [...prompt.history.versions].sort((a, b) => b.number - a.number);
    }
    /**
     * Get specific version details
     */
    getVersionDetails(prompt, versionNumber) {
        return prompt.history.versions.find(v => v.number === versionNumber) || null;
    }
    /**
     * Validate version data
     */
    validateVersion(version) {
        const errors = [];
        if (!version.number || version.number < 1) {
            errors.push('Version number must be a positive integer');
        }
        if (!version.message || version.message.trim().length === 0) {
            errors.push('Version message is required');
        }
        if (!version.author || version.author.trim().length === 0) {
            errors.push('Version author is required');
        }
        if (!version.created_at) {
            errors.push('Version creation timestamp is required');
        }
        else {
            // Validate ISO 8601 format
            const date = new Date(version.created_at);
            if (isNaN(date.getTime())) {
                errors.push('Version creation timestamp must be a valid ISO 8601 date');
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Generate change summary from diffs
     */
    generateChangeSummary(changes) {
        if (changes.length === 0) {
            return 'No changes detected';
        }
        const summaryParts = [];
        const changesByType = this.groupChangesByType(changes);
        if (changesByType.modified.length > 0) {
            const fields = changesByType.modified.map(c => c.field).join(', ');
            summaryParts.push(`Modified: ${fields}`);
        }
        if (changesByType.added.length > 0) {
            const fields = changesByType.added.map(c => c.field).join(', ');
            summaryParts.push(`Added: ${fields}`);
        }
        if (changesByType.removed.length > 0) {
            const fields = changesByType.removed.map(c => c.field).join(', ');
            summaryParts.push(`Removed: ${fields}`);
        }
        return summaryParts.join('; ');
    }
    /**
     * Compare metadata between two prompts
     */
    compareMetadata(oldPrompt, newPrompt, changes) {
        const oldMeta = oldPrompt.metadata;
        const newMeta = newPrompt.metadata;
        if (oldMeta.title !== newMeta.title) {
            changes.push({
                field: 'metadata.title',
                oldValue: oldMeta.title,
                newValue: newMeta.title,
                changeType: 'modified'
            });
        }
        if (oldMeta.summary !== newMeta.summary) {
            changes.push({
                field: 'metadata.summary',
                oldValue: oldMeta.summary,
                newValue: newMeta.summary,
                changeType: 'modified'
            });
        }
        if (oldMeta.owner !== newMeta.owner) {
            changes.push({
                field: 'metadata.owner',
                oldValue: oldMeta.owner,
                newValue: newMeta.owner,
                changeType: 'modified'
            });
        }
        // Compare tags
        const oldTags = new Set(oldMeta.tags);
        const newTags = new Set(newMeta.tags);
        if (oldTags.size !== newTags.size || ![...oldTags].every(tag => newTags.has(tag))) {
            changes.push({
                field: 'metadata.tags',
                oldValue: [...oldTags],
                newValue: [...newTags],
                changeType: 'modified'
            });
        }
    }
    /**
     * Compare human prompt between two prompts
     */
    compareHumanPrompt(oldPrompt, newPrompt, changes) {
        const oldHuman = oldPrompt.prompt_human;
        const newHuman = newPrompt.prompt_human;
        if (oldHuman.goal !== newHuman.goal) {
            changes.push({
                field: 'prompt_human.goal',
                oldValue: oldHuman.goal,
                newValue: newHuman.goal,
                changeType: 'modified'
            });
        }
        if (oldHuman.audience !== newHuman.audience) {
            changes.push({
                field: 'prompt_human.audience',
                oldValue: oldHuman.audience,
                newValue: newHuman.audience,
                changeType: 'modified'
            });
        }
        // Compare steps
        if (!this.arraysEqual(oldHuman.steps, newHuman.steps)) {
            changes.push({
                field: 'prompt_human.steps',
                oldValue: oldHuman.steps,
                newValue: newHuman.steps,
                changeType: 'modified'
            });
        }
        // Compare output expectations
        const oldOutput = oldHuman.output_expectations;
        const newOutput = newHuman.output_expectations;
        if (oldOutput.format !== newOutput.format) {
            changes.push({
                field: 'prompt_human.output_expectations.format',
                oldValue: oldOutput.format,
                newValue: newOutput.format,
                changeType: 'modified'
            });
        }
        if (!this.arraysEqual(oldOutput.fields, newOutput.fields)) {
            changes.push({
                field: 'prompt_human.output_expectations.fields',
                oldValue: oldOutput.fields,
                newValue: newOutput.fields,
                changeType: 'modified'
            });
        }
    }
    /**
     * Compare structured prompt between two prompts
     */
    compareStructuredPrompt(oldPrompt, newPrompt, changes) {
        const oldStructured = oldPrompt.prompt_structured;
        const newStructured = newPrompt.prompt_structured;
        // Handle cases where structured prompt is added or removed
        if (!oldStructured && newStructured) {
            changes.push({
                field: 'prompt_structured',
                oldValue: null,
                newValue: newStructured,
                changeType: 'added'
            });
            return;
        }
        if (oldStructured && !newStructured) {
            changes.push({
                field: 'prompt_structured',
                oldValue: oldStructured,
                newValue: null,
                changeType: 'removed'
            });
            return;
        }
        // Both exist, compare fields
        if (oldStructured && newStructured) {
            if (oldStructured.schema_version !== newStructured.schema_version) {
                changes.push({
                    field: 'prompt_structured.schema_version',
                    oldValue: oldStructured.schema_version,
                    newValue: newStructured.schema_version,
                    changeType: 'modified'
                });
            }
            if (!this.arraysEqual(oldStructured.system, newStructured.system)) {
                changes.push({
                    field: 'prompt_structured.system',
                    oldValue: oldStructured.system,
                    newValue: newStructured.system,
                    changeType: 'modified'
                });
            }
            if (!this.arraysEqual(oldStructured.capabilities, newStructured.capabilities)) {
                changes.push({
                    field: 'prompt_structured.capabilities',
                    oldValue: oldStructured.capabilities,
                    newValue: newStructured.capabilities,
                    changeType: 'modified'
                });
            }
            if (oldStructured.user_template !== newStructured.user_template) {
                changes.push({
                    field: 'prompt_structured.user_template',
                    oldValue: oldStructured.user_template,
                    newValue: newStructured.user_template,
                    changeType: 'modified'
                });
            }
            if (!this.arraysEqual(oldStructured.variables, newStructured.variables)) {
                changes.push({
                    field: 'prompt_structured.variables',
                    oldValue: oldStructured.variables,
                    newValue: newStructured.variables,
                    changeType: 'modified'
                });
            }
            // Compare rules
            if (!this.rulesEqual(oldStructured.rules, newStructured.rules)) {
                changes.push({
                    field: 'prompt_structured.rules',
                    oldValue: oldStructured.rules,
                    newValue: newStructured.rules,
                    changeType: 'modified'
                });
            }
        }
    }
    /**
     * Compare variables between two prompts
     */
    compareVariables(oldPrompt, newPrompt, changes) {
        const oldVars = oldPrompt.variables;
        const newVars = newPrompt.variables;
        // Create maps for easier comparison
        const oldVarMap = new Map(oldVars.map(v => [v.key, v]));
        const newVarMap = new Map(newVars.map(v => [v.key, v]));
        // Find added variables
        for (const [key, variable] of newVarMap) {
            if (!oldVarMap.has(key)) {
                changes.push({
                    field: `variables.${key}`,
                    oldValue: null,
                    newValue: variable,
                    changeType: 'added'
                });
            }
        }
        // Find removed variables
        for (const [key, variable] of oldVarMap) {
            if (!newVarMap.has(key)) {
                changes.push({
                    field: `variables.${key}`,
                    oldValue: variable,
                    newValue: null,
                    changeType: 'removed'
                });
            }
        }
        // Find modified variables
        for (const [key, newVar] of newVarMap) {
            const oldVar = oldVarMap.get(key);
            if (oldVar && !this.variablesEqual(oldVar, newVar)) {
                changes.push({
                    field: `variables.${key}`,
                    oldValue: oldVar,
                    newValue: newVar,
                    changeType: 'modified'
                });
            }
        }
    }
    /**
     * Check if two arrays are equal
     */
    arraysEqual(a, b) {
        if (a.length !== b.length)
            return false;
        return a.every((val, index) => val === b[index]);
    }
    /**
     * Check if two rule arrays are equal
     */
    rulesEqual(a, b) {
        if (a.length !== b.length)
            return false;
        return a.every((rule, index) => rule.name === b[index].name && rule.description === b[index].description);
    }
    /**
     * Check if two variables are equal
     */
    variablesEqual(a, b) {
        return (a.key === b.key &&
            a.label === b.label &&
            a.type === b.type &&
            a.required === b.required &&
            a.sensitive === b.sensitive &&
            a.default_value === b.default_value &&
            this.arraysEqual(a.options || [], b.options || []));
    }
    /**
     * Group changes by type
     */
    groupChangesByType(changes) {
        return {
            added: changes.filter(c => c.changeType === 'added'),
            modified: changes.filter(c => c.changeType === 'modified'),
            removed: changes.filter(c => c.changeType === 'removed')
        };
    }
}
//# sourceMappingURL=version-manager.js.map