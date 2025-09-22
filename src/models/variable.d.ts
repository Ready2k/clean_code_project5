import { VariableType } from '../types/common';
import { ValidationResult } from '../types/validation';
export interface Question {
    id: string;
    prompt_id: string;
    variable_key: string;
    text: string;
    type: VariableType;
    required: boolean;
    options?: string[];
    help_text?: string;
}
export interface Answer {
    id: string;
    question_id: string;
    user_id: string;
    value: any;
    created_at: string;
}
export interface VariableValue {
    key: string;
    value: any;
    source: 'user_input' | 'default' | 'computed';
}
export declare class QuestionClass implements Question {
    id: string;
    prompt_id: string;
    variable_key: string;
    text: string;
    type: VariableType;
    required: boolean;
    options?: string[];
    help_text?: string;
    constructor(data: Partial<Question> & {
        prompt_id: string;
        variable_key: string;
        text: string;
        type: VariableType;
    });
    /**
     * Validate the question structure
     */
    validate(): ValidationResult;
    /**
     * Generate a user-friendly question based on variable definition
     */
    static fromVariable(variable: any, promptId: string): QuestionClass;
}
export declare class AnswerClass implements Answer {
    id: string;
    question_id: string;
    user_id: string;
    value: any;
    created_at: string;
    constructor(data: Partial<Answer> & {
        question_id: string;
        user_id: string;
        value: any;
    });
    /**
     * Validate the answer against the question type
     */
    validate(question: Question): ValidationResult;
    /**
     * Get the normalized value for template substitution
     */
    getNormalizedValue(): any;
}
//# sourceMappingURL=variable.d.ts.map