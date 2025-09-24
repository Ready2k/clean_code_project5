import { PromptRecord } from '../models/prompt';
import { ValidationResult } from '../types/validation';
import { PromptManager } from './prompt-manager';
export interface ImportOptions {
    /**
     * Source provider format
     */
    sourceProvider?: string;
    /**
     * How to handle conflicts with existing prompts
     */
    conflictResolution: 'skip' | 'overwrite' | 'create_new' | 'prompt';
    /**
     * Default owner for imported prompts
     */
    defaultOwner?: string;
    /**
     * Default tags to apply to imported prompts
     */
    defaultTags?: string[];
    /**
     * Whether to auto-enhance imported prompts
     */
    autoEnhance?: boolean;
    /**
     * Custom slug prefix for imported prompts
     */
    slugPrefix?: string;
    /**
     * Validate imported prompts before saving
     */
    validateBeforeImport?: boolean;
}
export interface ImportResult {
    /**
     * Successfully imported prompts
     */
    imported: PromptRecord[];
    /**
     * Prompts that were skipped due to conflicts
     */
    skipped: Array<{
        filename: string;
        reason: string;
        existingPrompt?: PromptRecord;
    }>;
    /**
     * Prompts that failed to import
     */
    failed: Array<{
        filename: string;
        error: string;
        content?: any;
    }>;
    /**
     * Import summary
     */
    summary: {
        totalFiles: number;
        imported: number;
        skipped: number;
        failed: number;
    };
}
export interface ImportValidationResult extends ValidationResult {
    /**
     * Detected provider format
     */
    detectedProvider?: string;
    /**
     * Confidence in provider detection (0-1)
     */
    confidence?: number;
    /**
     * Suggested improvements
     */
    suggestions?: string[];
}
export declare class ImportService {
    private promptManager?;
    constructor(promptManager?: PromptManager | undefined);
    /**
     * Import prompts from files
     */
    importFromFiles(filePaths: string[], options: ImportOptions): Promise<ImportResult>;
    /**
     * Import prompt from content string
     */
    importFromContent(content: string, options: ImportOptions & {
        filename?: string;
    }): Promise<PromptRecord | null>;
    /**
     * Import from directory
     */
    importFromDirectory(directoryPath: string, options: ImportOptions, filePattern?: RegExp): Promise<ImportResult>;
    /**
     * Validate import content
     */
    validateImportContent(content: any, options: ImportOptions): ImportValidationResult;
    /**
     * Detect provider format from content
     */
    private detectProviderFormat;
    /**
     * Validate provider-specific format
     */
    private validateProviderFormat;
    /**
     * Convert provider format to internal format
     */
    private convertToInternalFormat;
    /**
     * Convert from OpenAI format
     */
    private convertFromOpenAI;
    /**
     * Convert from Anthropic format
     */
    private convertFromAnthropic;
    /**
     * Convert from Meta format
     */
    private convertFromMeta;
    /**
     * Convert from internal format
     */
    private convertFromInternal;
    /**
     * Create prompt record from converted data
     */
    private createPromptRecord;
    /**
     * Generate slug from title
     */
    private generateSlug;
    /**
     * Extract variables from template
     */
    private extractVariablesFromTemplate;
    /**
     * Extract title from content
     */
    private extractTitleFromContent;
    /**
     * Extract goal from messages or content
     */
    private extractGoalFromMessages;
    /**
     * Extract goal from content string
     */
    private extractGoalFromContent;
    /**
     * Extract steps from messages
     */
    private extractStepsFromMessages;
    /**
     * Humanize variable name
     */
    private humanizeVariableName;
    /**
     * Find existing prompt by slug or title
     */
    private findExistingPrompt;
    /**
     * Handle conflict resolution
     */
    private handleConflict;
}
//# sourceMappingURL=import-service.d.ts.map