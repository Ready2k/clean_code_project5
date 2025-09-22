import { PromptStatus, VariableType } from '../types/common';
import { ValidationResult } from '../types/validation';
export interface PromptMetadata {
    title: string;
    summary: string;
    tags: string[];
    owner: string;
}
export interface HumanPrompt {
    goal: string;
    audience: string;
    steps: string[];
    output_expectations: {
        format: string;
        fields: string[];
    };
}
export interface StructuredPrompt {
    schema_version: number;
    system: string[];
    capabilities: string[];
    user_template: string;
    rules: Array<{
        name: string;
        description: string;
    }>;
    variables: string[];
}
export declare class HumanPromptClass implements HumanPrompt {
    goal: string;
    audience: string;
    steps: string[];
    output_expectations: {
        format: string;
        fields: string[];
    };
    constructor(data?: Partial<HumanPrompt>);
    /**
     * Validate the human prompt structure
     */
    validate(): ValidationResult;
    /**
     * Convert to a readable string format
     */
    toString(): string;
}
export declare class StructuredPromptClass implements StructuredPrompt {
    schema_version: number;
    system: string[];
    capabilities: string[];
    user_template: string;
    rules: Array<{
        name: string;
        description: string;
    }>;
    variables: string[];
    constructor(data?: Partial<StructuredPrompt>);
    /**
     * Validate the structured prompt
     */
    validate(): ValidationResult;
    /**
     * Extract variable references from template (e.g., {{variable_name}})
     */
    private extractVariablesFromTemplate;
    /**
     * Substitute variables in the user template
     */
    substituteVariables(values: Record<string, any>): string;
    /**
     * Get all variable references in the template
     */
    getTemplateVariables(): string[];
}
export interface Variable {
    key: string;
    label: string;
    type: VariableType;
    required: boolean;
    options?: string[];
    sensitive?: boolean;
    default_value?: any;
}
export interface PromptVersion {
    number: number;
    message: string;
    created_at: string;
    author: string;
}
export interface PromptRender {
    provider: string;
    model_hint: string;
    version_of_prompt: number;
    created_at: string;
    content_ref: string;
}
export interface PromptRecord {
    version: number;
    id: string;
    slug: string;
    created_at: string;
    updated_at: string;
    status: PromptStatus;
    metadata: PromptMetadata;
    prompt_human: HumanPrompt;
    prompt_structured?: StructuredPrompt;
    variables: Variable[];
    history: {
        versions: PromptVersion[];
        ratings: Array<{
            user: string;
            score: number;
            note: string;
            created_at: string;
        }>;
    };
    renders: PromptRender[];
}
export declare class PromptRecordClass implements PromptRecord {
    version: number;
    id: string;
    slug: string;
    created_at: string;
    updated_at: string;
    status: PromptStatus;
    metadata: PromptMetadata;
    prompt_human: HumanPrompt;
    prompt_structured?: StructuredPrompt;
    variables: Variable[];
    history: {
        versions: PromptVersion[];
        ratings: Array<{
            user: string;
            score: number;
            note: string;
            created_at: string;
        }>;
    };
    renders: PromptRender[];
    constructor(data?: Partial<PromptRecord>);
    private generateSlug;
    /**
     * Serialize the PromptRecord to YAML string
     */
    toYAML(): string;
    /**
     * Create PromptRecord from YAML string
     */
    static fromYAML(yamlString: string): PromptRecordClass;
    /**
     * Validate the PromptRecord structure
     */
    validate(): ValidationResult;
    private validateVariable;
    /**
     * Update the prompt and increment version
     */
    update(updates: Partial<PromptRecord>, author: string, message: string): void;
    /**
     * Add a rating to the prompt
     */
    addRating(user: string, score: number, note?: string): void;
    /**
     * Get average rating
     */
    getAverageRating(): number;
    /**
     * Clone the prompt record
     */
    clone(): PromptRecordClass;
}
//# sourceMappingURL=prompt.d.ts.map