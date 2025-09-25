import { HumanPrompt, StructuredPrompt, Variable } from '../models/prompt';
import { Question } from '../models/variable';
import { EnhancementContext } from '../types/common';
export interface QuestionGenerationContext {
    humanPrompt: HumanPrompt;
    structuredPrompt?: StructuredPrompt;
    enhancementContext?: EnhancementContext;
    existingVariables?: Variable[];
    taskType?: TaskType;
}
export type TaskType = 'analysis' | 'generation' | 'transformation' | 'classification' | 'summarization' | 'conversation' | 'code' | 'creative' | 'unknown';
export interface IntelligentQuestionGenerator {
    /**
     * Generate context-aware questions based on the enhancement context
     */
    generateQuestions(context: QuestionGenerationContext): Promise<Question[]>;
    /**
     * Detect the task type from the human prompt
     */
    detectTaskType(humanPrompt: HumanPrompt): TaskType;
    /**
     * Generate questions for missing variables only when needed
     */
    generateVariableQuestions(variables: Variable[], promptId: string): Question[];
    /**
     * Determine if questions are actually needed for this enhancement
     */
    shouldGenerateQuestions(context: QuestionGenerationContext): boolean;
}
export declare class IntelligentQuestionGeneratorImpl implements IntelligentQuestionGenerator {
    generateQuestions(context: QuestionGenerationContext): Promise<Question[]>;
    detectTaskType(humanPrompt: HumanPrompt): TaskType;
    generateVariableQuestions(variables: Variable[], promptId: string): Question[];
    shouldGenerateQuestions(context: QuestionGenerationContext): boolean;
    private generateTaskSpecificQuestions;
    private generateAnalysisQuestions;
    private generateGenerationQuestions;
    private generateTransformationQuestions;
    private generateClassificationQuestions;
    private generateCodeQuestions;
    private generateGenericQuestions;
    private extractMissingVariables;
    private extractVariablesFromTemplate;
    private prioritizeAndDeduplicateQuestions;
    private containsKeywords;
    private isPromptAlreadySpecific;
    private isSelfContainedTask;
    private hasDataSpecified;
    private isGoalVague;
    private hasTopicSpecified;
    private hasStyleSpecified;
    private hasLanguageSpecified;
    private isPromptVeryVague;
    private generateVariableLabel;
    private inferVariableType;
    private isVariableSensitive;
}
//# sourceMappingURL=intelligent-question-generator.d.ts.map