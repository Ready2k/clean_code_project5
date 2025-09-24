// Intelligent Question Generator - Context-aware question generation for AI enhancement

import { HumanPrompt, StructuredPrompt, Variable } from '../models/prompt';
import { Question, QuestionClass } from '../models/variable';
import { EnhancementContext, VariableType } from '../types/common';

export interface QuestionGenerationContext {
    humanPrompt: HumanPrompt;
    structuredPrompt?: StructuredPrompt;
    enhancementContext?: EnhancementContext;
    existingVariables?: Variable[];
    taskType?: TaskType;
}

export type TaskType =
    | 'analysis'
    | 'generation'
    | 'transformation'
    | 'classification'
    | 'summarization'
    | 'conversation'
    | 'code'
    | 'creative'
    | 'unknown';

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

export class IntelligentQuestionGeneratorImpl implements IntelligentQuestionGenerator {

    async generateQuestions(context: QuestionGenerationContext): Promise<Question[]> {
        // First, check if we actually need questions
        if (!this.shouldGenerateQuestions(context)) {
            return [];
        }

        const questions: Question[] = [];
        const taskType = this.detectTaskType(context.humanPrompt);

        // Generate task-specific questions
        const taskQuestions = this.generateTaskSpecificQuestions(context, taskType);
        questions.push(...taskQuestions);

        // Generate variable-specific questions if we have a structured prompt
        if (context.structuredPrompt) {
            const variables = this.extractMissingVariables(context.structuredPrompt);
            const variableQuestions = this.generateVariableQuestions(variables, context.structuredPrompt.schema_version.toString());
            questions.push(...variableQuestions);
        }

        // Remove duplicates and prioritize
        return this.prioritizeAndDeduplicateQuestions(questions);
    }

    detectTaskType(humanPrompt: HumanPrompt): TaskType {
        const goalText = humanPrompt.goal.toLowerCase();
        const stepsText = humanPrompt.steps.join(' ').toLowerCase();
        const combinedText = `${goalText} ${stepsText}`;

        // Code keywords (check first as they're more specific)
        if (this.containsKeywords(combinedText, ['code', 'program', 'script', 'function', 'algorithm', 'debug', 'refactor', 'write a function', 'implement'])) {
            return 'code';
        }

        // Analysis keywords
        if (this.containsKeywords(combinedText, ['analyze', 'analysis', 'examine', 'evaluate', 'assess', 'review', 'study'])) {
            return 'analysis';
        }

        // Generation keywords (but exclude code-related generation)
        if (this.containsKeywords(combinedText, ['generate', 'create', 'write', 'produce', 'build', 'make', 'compose']) &&
            !this.containsKeywords(combinedText, ['function', 'code', 'program', 'script'])) {
            return 'generation';
        }

        // Transformation keywords
        if (this.containsKeywords(combinedText, ['transform', 'convert', 'translate', 'reformat', 'restructure', 'modify'])) {
            return 'transformation';
        }

        // Classification keywords
        if (this.containsKeywords(combinedText, ['classify', 'categorize', 'sort', 'group', 'label', 'tag'])) {
            return 'classification';
        }

        // Summarization keywords
        if (this.containsKeywords(combinedText, ['summarize', 'summary', 'condense', 'brief', 'overview', 'abstract'])) {
            return 'summarization';
        }

        // Conversation keywords
        if (this.containsKeywords(combinedText, ['chat', 'conversation', 'dialogue', 'discuss', 'talk', 'respond'])) {
            return 'conversation';
        }

        // Creative keywords
        if (this.containsKeywords(combinedText, ['creative', 'story', 'poem', 'design', 'brainstorm', 'imagine'])) {
            return 'creative';
        }

        return 'unknown';
    }

    generateVariableQuestions(variables: Variable[], promptId: string): Question[] {
        return variables.map(variable => QuestionClass.fromVariable(variable, promptId));
    }

    shouldGenerateQuestions(context: QuestionGenerationContext): boolean {
        // Don't generate questions if the prompt is already very specific
        if (this.isPromptAlreadySpecific(context.humanPrompt)) {
            return false;
        }

        // Don't generate questions if there are no variables to fill
        if (context.structuredPrompt) {
            const variables = this.extractMissingVariables(context.structuredPrompt);
            if (variables.length === 0) {
                return false;
            }
        }

        // Don't generate questions for simple, self-contained tasks
        if (this.isSelfContainedTask(context.humanPrompt)) {
            return false;
        }

        return true;
    }

    private generateTaskSpecificQuestions(context: QuestionGenerationContext, taskType: TaskType): Question[] {
        const questions: Question[] = [];
        const promptId = context.structuredPrompt?.schema_version.toString() || 'temp';

        switch (taskType) {
            case 'analysis':
                questions.push(...this.generateAnalysisQuestions(context, promptId));
                break;
            case 'generation':
                questions.push(...this.generateGenerationQuestions(context, promptId));
                break;
            case 'transformation':
                questions.push(...this.generateTransformationQuestions(context, promptId));
                break;
            case 'classification':
                questions.push(...this.generateClassificationQuestions(context, promptId));
                break;
            case 'code':
                questions.push(...this.generateCodeQuestions(context, promptId));
                break;
            default:
                // For unknown or simple tasks, generate minimal questions
                questions.push(...this.generateGenericQuestions(context, promptId));
        }

        return questions;
    }

    private generateAnalysisQuestions(context: QuestionGenerationContext, promptId: string): Question[] {
        const questions: Question[] = [];

        // Only ask for data if not already specified
        if (!this.hasDataSpecified(context.humanPrompt)) {
            questions.push(new QuestionClass({
                prompt_id: promptId,
                variable_key: 'analysis_data',
                text: 'What data or content should be analyzed?',
                type: 'string',
                required: true,
                help_text: 'Provide the specific data, document, or content to analyze'
            }));
        }

        // Ask for analysis focus if goal is vague
        if (this.isGoalVague(context.humanPrompt)) {
            questions.push(new QuestionClass({
                prompt_id: promptId,
                variable_key: 'analysis_focus',
                text: 'What specific aspects should the analysis focus on?',
                type: 'string',
                required: false,
                help_text: 'e.g., trends, patterns, quality, performance, etc.'
            }));
        }

        return questions;
    }

    private generateGenerationQuestions(context: QuestionGenerationContext, promptId: string): Question[] {
        const questions: Question[] = [];

        // Ask for topic/subject if not clear
        if (!this.hasTopicSpecified(context.humanPrompt)) {
            questions.push(new QuestionClass({
                prompt_id: promptId,
                variable_key: 'generation_topic',
                text: 'What topic or subject should be generated?',
                type: 'string',
                required: true,
                help_text: 'The main topic, theme, or subject for the generated content'
            }));
        }

        // Ask for style/tone if not specified
        if (!this.hasStyleSpecified(context.humanPrompt)) {
            questions.push(new QuestionClass({
                prompt_id: promptId,
                variable_key: 'content_style',
                text: 'What style or tone should be used?',
                type: 'select',
                required: false,
                options: ['professional', 'casual', 'academic', 'creative', 'technical', 'friendly'],
                help_text: 'The writing style or tone for the generated content'
            }));
        }

        return questions;
    }

    private generateTransformationQuestions(_context: QuestionGenerationContext, promptId: string): Question[] {
        const questions: Question[] = [];

        // Ask for source format if not clear
        questions.push(new QuestionClass({
            prompt_id: promptId,
            variable_key: 'source_format',
            text: 'What is the current format of the content?',
            type: 'string',
            required: true,
            help_text: 'The format of the input content (e.g., JSON, CSV, plain text)'
        }));

        // Ask for target format
        questions.push(new QuestionClass({
            prompt_id: promptId,
            variable_key: 'target_format',
            text: 'What format should the content be transformed to?',
            type: 'string',
            required: true,
            help_text: 'The desired output format'
        }));

        return questions;
    }

    private generateClassificationQuestions(_context: QuestionGenerationContext, promptId: string): Question[] {
        const questions: Question[] = [];

        // Ask for classification categories if not specified
        questions.push(new QuestionClass({
            prompt_id: promptId,
            variable_key: 'classification_categories',
            text: 'What categories should be used for classification?',
            type: 'string',
            required: true,
            help_text: 'List the categories or labels to classify content into'
        }));

        return questions;
    }

    private generateCodeQuestions(context: QuestionGenerationContext, promptId: string): Question[] {
        const questions: Question[] = [];

        // Ask for programming language if not specified
        if (!this.hasLanguageSpecified(context.humanPrompt)) {
            questions.push(new QuestionClass({
                prompt_id: promptId,
                variable_key: 'programming_language',
                text: 'What programming language should be used?',
                type: 'select',
                required: true,
                options: ['JavaScript', 'Python', 'TypeScript', 'Java', 'C#', 'Go', 'Rust', 'Other'],
                help_text: 'The programming language for the code'
            }));
        }

        // Ask for specific requirements if the goal is vague
        if (this.isGoalVague(context.humanPrompt)) {
            questions.push(new QuestionClass({
                prompt_id: promptId,
                variable_key: 'code_requirements',
                text: 'What are the specific requirements for the code?',
                type: 'string',
                required: false,
                help_text: 'Any specific requirements, constraints, or features needed'
            }));
        }

        return questions;
    }

    private generateGenericQuestions(context: QuestionGenerationContext, promptId: string): Question[] {
        const questions: Question[] = [];

        // Only generate generic questions if the prompt is very vague
        if (this.isPromptVeryVague(context.humanPrompt)) {
            questions.push(new QuestionClass({
                prompt_id: promptId,
                variable_key: 'specific_requirements',
                text: 'What are the specific requirements or details?',
                type: 'string',
                required: false,
                help_text: 'Any additional details that would help complete the task'
            }));
        }

        return questions;
    }

    private extractMissingVariables(structuredPrompt: StructuredPrompt): Variable[] {
        // Extract variables from template that don't have default values
        const templateVars = this.extractVariablesFromTemplate(structuredPrompt.user_template);
        return templateVars.filter(variable => !variable.default_value);
    }

    private extractVariablesFromTemplate(template: string): Variable[] {
        const variableRegex = /\{\{([^}]+)\}\}/g;
        const variables: Variable[] = [];
        const foundKeys = new Set<string>();
        let match;

        while ((match = variableRegex.exec(template)) !== null) {
            const variableName = match[1].trim();

            if (!foundKeys.has(variableName)) {
                foundKeys.add(variableName);

                variables.push({
                    key: variableName,
                    label: this.generateVariableLabel(variableName),
                    type: this.inferVariableType(variableName),
                    required: true,
                    sensitive: this.isVariableSensitive(variableName)
                });
            }
        }

        return variables;
    }

    private prioritizeAndDeduplicateQuestions(questions: Question[]): Question[] {
        // Remove duplicates based on variable_key
        const uniqueQuestions = questions.filter((question, index, array) =>
            array.findIndex(q => q.variable_key === question.variable_key) === index
        );

        // Sort by priority (required first, then by relevance)
        return uniqueQuestions.sort((a, b) => {
            if (a.required && !b.required) return -1;
            if (!a.required && b.required) return 1;
            return 0;
        });
    }

    private containsKeywords(text: string, keywords: string[]): boolean {
        return keywords.some(keyword => text.includes(keyword));
    }

    private isPromptAlreadySpecific(humanPrompt: HumanPrompt): boolean {
        const totalLength = humanPrompt.goal.length + humanPrompt.steps.join(' ').length;
        const hasDetailedSteps = humanPrompt.steps.length >= 3 && humanPrompt.steps.some(step => step.length > 50);
        const hasSpecificOutput = humanPrompt.output_expectations.fields.length > 1;

        return totalLength > 300 && hasDetailedSteps && hasSpecificOutput;
    }

    private isSelfContainedTask(humanPrompt: HumanPrompt): boolean {
        const goalText = humanPrompt.goal.toLowerCase();

        // Tasks that typically don't need additional input
        const selfContainedKeywords = [
            'explain', 'describe', 'list', 'define', 'compare',
            'what is', 'how to', 'why does', 'when should'
        ];

        return selfContainedKeywords.some(keyword => goalText.includes(keyword));
    }

    private hasDataSpecified(humanPrompt: HumanPrompt): boolean {
        const combinedText = `${humanPrompt.goal} ${humanPrompt.steps.join(' ')}`.toLowerCase();
        const dataKeywords = ['data', 'file', 'document', 'content', 'text', 'input'];
        return dataKeywords.some(keyword => combinedText.includes(keyword));
    }

    private isGoalVague(humanPrompt: HumanPrompt): boolean {
        return humanPrompt.goal.length < 50 ||
            humanPrompt.goal.toLowerCase().includes('analyze') &&
            !humanPrompt.goal.toLowerCase().includes('for');
    }

    private hasTopicSpecified(humanPrompt: HumanPrompt): boolean {
        const goalText = humanPrompt.goal.toLowerCase();
        return goalText.includes('about') || goalText.includes('on') || goalText.includes('regarding');
    }

    private hasStyleSpecified(humanPrompt: HumanPrompt): boolean {
        const combinedText = `${humanPrompt.goal} ${humanPrompt.steps.join(' ')}`.toLowerCase();
        const styleKeywords = ['professional', 'casual', 'formal', 'informal', 'technical', 'simple', 'detailed'];
        return styleKeywords.some(keyword => combinedText.includes(keyword));
    }

    private hasLanguageSpecified(humanPrompt: HumanPrompt): boolean {
        const combinedText = `${humanPrompt.goal} ${humanPrompt.steps.join(' ')}`.toLowerCase();
        const languages = ['javascript', 'python', 'java', 'typescript', 'c#', 'go', 'rust', 'php', 'ruby'];
        return languages.some(lang => combinedText.includes(lang));
    }

    private isPromptVeryVague(humanPrompt: HumanPrompt): boolean {
        return humanPrompt.goal.length < 30 && humanPrompt.steps.length < 2;
    }

    private generateVariableLabel(variableName: string): string {
        return variableName
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/\b\w/g, l => l.toUpperCase())
            .trim();
    }

    private inferVariableType(variableName: string): VariableType {
        const name = variableName.toLowerCase();

        if (name.includes('count') || name.includes('number') || name.includes('amount')) {
            return 'number';
        }

        if (name.includes('enable') || name.includes('is_') || name.includes('has_')) {
            return 'boolean';
        }

        if (name.includes('type') || name.includes('category') || name.includes('format')) {
            return 'select';
        }

        return 'string';
    }

    private isVariableSensitive(variableName: string): boolean {
        const name = variableName.toLowerCase();
        const sensitiveKeywords = ['password', 'key', 'secret', 'token', 'credential'];
        return sensitiveKeywords.some(keyword => name.includes(keyword));
    }
}