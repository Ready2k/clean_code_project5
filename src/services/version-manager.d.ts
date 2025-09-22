import { PromptRecord, PromptVersion } from '../models/prompt';
import { ValidationResult } from '../types/validation';
export interface VersionDiff {
    field: string;
    oldValue: any;
    newValue: any;
    changeType: 'added' | 'modified' | 'removed';
}
export interface VersionComparison {
    fromVersion: number;
    toVersion: number;
    changes: VersionDiff[];
    summary: string;
}
export interface VersionCreateOptions {
    author: string;
    message: string;
    changes?: VersionDiff[];
}
export interface VersionManager {
    /**
     * Create a new version of a prompt
     */
    createVersion(prompt: PromptRecord, options: VersionCreateOptions): PromptVersion;
    /**
     * Compare two versions of a prompt
     */
    compareVersions(oldPrompt: PromptRecord, newPrompt: PromptRecord): VersionComparison;
    /**
     * Get version history for a prompt
     */
    getVersionHistory(prompt: PromptRecord): PromptVersion[];
    /**
     * Get specific version details
     */
    getVersionDetails(prompt: PromptRecord, versionNumber: number): PromptVersion | null;
    /**
     * Validate version data
     */
    validateVersion(version: PromptVersion): ValidationResult;
    /**
     * Generate change summary from diffs
     */
    generateChangeSummary(changes: VersionDiff[]): string;
}
export declare class PromptVersionManager implements VersionManager {
    /**
     * Create a new version of a prompt
     */
    createVersion(prompt: PromptRecord, options: VersionCreateOptions): PromptVersion;
    /**
     * Compare two versions of a prompt
     */
    compareVersions(oldPrompt: PromptRecord, newPrompt: PromptRecord): VersionComparison;
    /**
     * Get version history for a prompt
     */
    getVersionHistory(prompt: PromptRecord): PromptVersion[];
    /**
     * Get specific version details
     */
    getVersionDetails(prompt: PromptRecord, versionNumber: number): PromptVersion | null;
    /**
     * Validate version data
     */
    validateVersion(version: PromptVersion): ValidationResult;
    /**
     * Generate change summary from diffs
     */
    generateChangeSummary(changes: VersionDiff[]): string;
    /**
     * Compare metadata between two prompts
     */
    private compareMetadata;
    /**
     * Compare human prompt between two prompts
     */
    private compareHumanPrompt;
    /**
     * Compare structured prompt between two prompts
     */
    private compareStructuredPrompt;
    /**
     * Compare variables between two prompts
     */
    private compareVariables;
    /**
     * Check if two arrays are equal
     */
    private arraysEqual;
    /**
     * Check if two rule arrays are equal
     */
    private rulesEqual;
    /**
     * Check if two variables are equal
     */
    private variablesEqual;
    /**
     * Group changes by type
     */
    private groupChangesByType;
}
//# sourceMappingURL=version-manager.d.ts.map