import { HumanPrompt, StructuredPrompt, Variable } from '../models/prompt';
import { EnhancementResult } from '../models/enhancement';
import { Question } from '../models/variable';
import { ValidationResult } from '../types/validation';
import { EnhancementContext } from '../types/common';
export interface EnhancementAgent {
    /**
     * Enhance a human-readable prompt into structured format
     */
    enhance(humanPrompt: HumanPrompt, context?: EnhancementContext): Promise<EnhancementResult>;
    /**
     * Generate questions for missing or undefined variables
     */
    generateQuestions(variables: Variable[]): Promise<Question[]>;
    /**
     * Validate a structured prompt for completeness and quality
     */
    validateStructuredPrompt(structured: StructuredPrompt): ValidationResult;
    /**
     * Analyze a prompt and suggest improvements
     */
    analyzePrompt(prompt: HumanPrompt | StructuredPrompt): Promise<{
        suggestions: string[];
        quality_score: number;
        missing_elements: string[];
    }>;
    /**
     * Extract variables from a prompt template
     */
    extractVariables(template: string): Variable[];
    /**
     * Generate rationale for enhancement changes
     */
    generateRationale(original: HumanPrompt, enhanced: StructuredPrompt): string;
}
export interface LLMService {
    /**
     * Generate completion using the LLM
     */
    complete(prompt: string, options?: {
        temperature?: number;
        maxTokens?: number;
        systemPrompt?: string;
    }): Promise<string>;
    /**
     * Check if the service is available
     */
    isAvailable(): Promise<boolean>;
}
export declare class EnhancementAgentImpl implements EnhancementAgent {
    private llmService;
    constructor(llmService: LLMService);
    enhance(humanPrompt: HumanPrompt, context?: EnhancementContext): Promise<EnhancementResult>;
    generateQuestions(variables: Variable[]): Promise<Question[]>;
    validateStructuredPrompt(structured: StructuredPrompt): ValidationResult;
    analyzePrompt(prompt: HumanPrompt | StructuredPrompt): Promise<{
        suggestions: string[];
        quality_score: number;
        missing_elements: string[];
    }>;
    extractVariables(template: string): Variable[];
    generateRationale(_original: HumanPrompt, enhanced: StructuredPrompt): string;
    private buildEnhancementPrompt;
    private getEnhancementSystemPrompt;
    private parseLLMResponse;
    private calculateConfidence;
    private inferVariableType;
    private generateVariableLabel;
    private isVariableSensitive;
}
//# sourceMappingURL=enhancement-agent.d.ts.map