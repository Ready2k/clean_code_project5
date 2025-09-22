import { Variable } from '../models/prompt';
import { Question, Answer, VariableValue } from '../models/variable';
import { ValidationResult } from '../types/validation';
export interface QuestionGenerationOptions {
    includeOptional?: boolean;
    customLabels?: Record<string, string>;
    helpText?: Record<string, string>;
}
export interface VariableSubstitutionOptions {
    strict?: boolean;
    defaultValues?: Record<string, any>;
}
export interface AnswerStorage {
    saveAnswer(answer: Answer): Promise<void>;
    getAnswers(questionIds: string[]): Promise<Answer[]>;
    getAnswersByUser(userId: string, promptId: string): Promise<Answer[]>;
    deleteAnswer(answerId: string): Promise<void>;
    updateAnswer(answerId: string, value: any): Promise<void>;
}
export declare class VariableManager {
    private answerStorage?;
    constructor(answerStorage?: AnswerStorage);
    /**
     * Generate questions from variable definitions
     */
    generateQuestions(variables: Variable[], promptId: string, options?: QuestionGenerationOptions): Question[];
    /**
     * Generate user-friendly question text based on variable definition
     */
    private generateQuestionText;
    /**
     * Convert snake_case or camelCase to human readable format
     */
    private humanizeKey;
    /**
     * Validate questions against variable definitions
     */
    validateQuestions(questions: Question[], variables: Variable[]): ValidationResult;
    /**
     * Check if two arrays are equal (order-independent for options)
     */
    private arraysEqual;
    /**
     * Validate answers against questions and variable requirements
     */
    validateAnswers(answers: Answer[], questions: Question[]): ValidationResult;
    /**
     * Convert answers to variable values for template substitution
     */
    answersToVariableValues(answers: Answer[], questions: Question[]): VariableValue[];
    /**
     * Get missing required variables from a set of answers
     */
    getMissingRequiredVariables(variables: Variable[], answers: Answer[], questions: Question[]): Variable[];
    /**
     * Generate questions for missing required variables only
     */
    generateMissingQuestions(variables: Variable[], answers: Answer[], questions: Question[], promptId: string): Question[];
    /**
     * Check if all required variables have been answered
     */
    areAllRequiredVariablesAnswered(variables: Variable[], answers: Answer[], questions: Question[]): boolean;
    /**
     * Save an answer to storage
     */
    saveAnswer(answer: Answer): Promise<void>;
    /**
     * Collect and save answers for a set of questions
     */
    collectAnswers(questions: Question[], userId: string, answerValues: Record<string, any>): Promise<Answer[]>;
    /**
     * Get answers for specific questions
     */
    getAnswers(questionIds: string[]): Promise<Answer[]>;
    /**
     * Get all answers for a user and prompt
     */
    getAnswersByUser(userId: string, promptId: string): Promise<Answer[]>;
    /**
     * Update an existing answer
     */
    updateAnswer(answerId: string, value: any, question: Question): Promise<void>;
    /**
     * Delete an answer
     */
    deleteAnswer(answerId: string): Promise<void>;
    /**
     * Substitute variables in a template string
     */
    substituteVariables(template: string, variableValues: Record<string, any>, options?: VariableSubstitutionOptions): string;
    /**
     * Substitute variables using answers and questions
     */
    substituteVariablesFromAnswers(template: string, answers: Answer[], questions: Question[], options?: VariableSubstitutionOptions): string;
    /**
     * Convert a value to string for template substitution
     */
    private valueToString;
    /**
     * Extract variable names from a template
     */
    extractVariableNames(template: string): string[];
    /**
     * Validate that all required variables are available for substitution
     */
    validateVariableSubstitution(template: string, variables: Variable[], answers: Answer[], questions: Question[]): ValidationResult;
}
//# sourceMappingURL=variable-manager.d.ts.map