// Variable management and questionnaire system
import { QuestionClass, AnswerClass } from '../models/variable';
export class VariableManager {
    answerStorage;
    constructor(answerStorage) {
        this.answerStorage = answerStorage;
    }
    /**
     * Generate questions from variable definitions
     */
    generateQuestions(variables, promptId, options = {}) {
        const questions = [];
        for (const variable of variables) {
            // Skip optional variables if not requested
            if (!variable.required && !options.includeOptional) {
                continue;
            }
            // Create question with custom label if provided
            const customLabel = options.customLabels?.[variable.key];
            const helpText = options.helpText?.[variable.key] || variable.label;
            const questionText = this.generateQuestionText(variable, customLabel);
            const question = new QuestionClass({
                prompt_id: promptId,
                variable_key: variable.key,
                text: questionText,
                type: variable.type,
                required: variable.required,
                options: variable.options,
                help_text: helpText
            });
            questions.push(question);
        }
        return questions;
    }
    /**
     * Generate user-friendly question text based on variable definition
     */
    generateQuestionText(variable, customLabel) {
        const baseLabel = customLabel || variable.label || this.humanizeKey(variable.key);
        let questionText = baseLabel;
        // Add type-specific hints and formatting
        switch (variable.type) {
            case 'string':
                questionText = `What is the ${baseLabel.toLowerCase()}?`;
                break;
            case 'number':
                questionText = `What is the ${baseLabel.toLowerCase()}? (enter a number)`;
                break;
            case 'boolean':
                questionText = `${baseLabel}? (yes/no)`;
                break;
            case 'select':
                if (variable.options && variable.options.length > 0) {
                    questionText = `Select ${baseLabel.toLowerCase()} (choose one: ${variable.options.join(', ')})`;
                }
                else {
                    questionText = `Select ${baseLabel.toLowerCase()}`;
                }
                break;
            case 'multiselect':
                if (variable.options && variable.options.length > 0) {
                    questionText = `Select ${baseLabel.toLowerCase()} (choose multiple: ${variable.options.join(', ')})`;
                }
                else {
                    questionText = `Select ${baseLabel.toLowerCase()} (multiple choices)`;
                }
                break;
        }
        // Add required indicator
        if (variable.required) {
            questionText += ' *';
        }
        return questionText;
    }
    /**
     * Convert snake_case or camelCase to human readable format
     */
    humanizeKey(key) {
        return key
            .replace(/([A-Z])/g, ' $1') // camelCase to spaces
            .replace(/[_-]/g, ' ') // snake_case and kebab-case to spaces
            .replace(/\s+/g, ' ') // multiple spaces to single
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
    /**
     * Validate questions against variable definitions
     */
    validateQuestions(questions, variables) {
        const errors = [];
        const variableMap = new Map(variables.map(v => [v.key, v]));
        for (const question of questions) {
            // Validate individual question structure
            const questionValidation = new QuestionClass(question).validate();
            if (!questionValidation.isValid) {
                errors.push(...questionValidation.errors.map(e => `Question '${question.variable_key}': ${e}`));
            }
            // Check if variable exists
            const variable = variableMap.get(question.variable_key);
            if (!variable) {
                errors.push(`Question references undefined variable: ${question.variable_key}`);
                continue;
            }
            // Validate question matches variable definition
            if (question.type !== variable.type) {
                errors.push(`Question type '${question.type}' doesn't match variable type '${variable.type}' for '${question.variable_key}'`);
            }
            if (question.required !== variable.required) {
                errors.push(`Question required flag doesn't match variable definition for '${question.variable_key}'`);
            }
            // Validate options for select/multiselect
            if ((variable.type === 'select' || variable.type === 'multiselect')) {
                if (!variable.options || variable.options.length === 0) {
                    errors.push(`Variable '${variable.key}' of type '${variable.type}' must have options`);
                }
                else if (!question.options || !this.arraysEqual(question.options, variable.options)) {
                    errors.push(`Question options don't match variable options for '${question.variable_key}'`);
                }
            }
        }
        // Check for missing required variables
        const requiredVariables = variables.filter(v => v.required);
        const questionVariableKeys = new Set(questions.map(q => q.variable_key));
        for (const variable of requiredVariables) {
            if (!questionVariableKeys.has(variable.key)) {
                errors.push(`Missing question for required variable: ${variable.key}`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Check if two arrays are equal (order-independent for options)
     */
    arraysEqual(a, b) {
        if (a.length !== b.length)
            return false;
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        return sortedA.every((val, index) => val === sortedB[index]);
    }
    /**
     * Validate answers against questions and variable requirements
     */
    validateAnswers(answers, questions) {
        const errors = [];
        const questionMap = new Map(questions.map(q => [q.id, q]));
        const answeredQuestions = new Set(answers.map(a => a.question_id));
        // Validate each answer
        for (const answer of answers) {
            const question = questionMap.get(answer.question_id);
            if (!question) {
                errors.push(`Answer references unknown question: ${answer.question_id}`);
                continue;
            }
            // Validate answer against question
            const answerValidation = new AnswerClass(answer).validate(question);
            if (!answerValidation.isValid) {
                errors.push(...answerValidation.errors.map(e => `Answer for '${question.variable_key}': ${e}`));
            }
        }
        // Check for missing required answers
        const requiredQuestions = questions.filter(q => q.required);
        for (const question of requiredQuestions) {
            if (!answeredQuestions.has(question.id)) {
                errors.push(`Missing answer for required question: ${question.variable_key}`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Convert answers to variable values for template substitution
     */
    answersToVariableValues(answers, questions) {
        const questionMap = new Map(questions.map(q => [q.id, q]));
        const variableValues = [];
        for (const answer of answers) {
            const question = questionMap.get(answer.question_id);
            if (!question)
                continue;
            const normalizedValue = new AnswerClass(answer).getNormalizedValue();
            variableValues.push({
                key: question.variable_key,
                value: normalizedValue,
                source: 'user_input'
            });
        }
        return variableValues;
    }
    /**
     * Get missing required variables from a set of answers
     */
    getMissingRequiredVariables(variables, answers, questions) {
        const questionMap = new Map(questions.map(q => [q.id, q]));
        const answeredVariables = new Set(answers
            .map(a => questionMap.get(a.question_id)?.variable_key)
            .filter(Boolean));
        return variables.filter(v => v.required && !answeredVariables.has(v.key));
    }
    /**
     * Generate questions for missing required variables only
     */
    generateMissingQuestions(variables, answers, questions, promptId) {
        const missingVariables = this.getMissingRequiredVariables(variables, answers, questions);
        return this.generateQuestions(missingVariables, promptId, { includeOptional: false });
    }
    /**
     * Check if all required variables have been answered
     */
    areAllRequiredVariablesAnswered(variables, answers, questions) {
        const missingVariables = this.getMissingRequiredVariables(variables, answers, questions);
        return missingVariables.length === 0;
    }
    // Answer Collection and Persistence Methods
    /**
     * Save an answer to storage
     */
    async saveAnswer(answer) {
        if (!this.answerStorage) {
            throw new Error('Answer storage not configured');
        }
        await this.answerStorage.saveAnswer(answer);
    }
    /**
     * Collect and save answers for a set of questions
     */
    async collectAnswers(questions, userId, answerValues) {
        const answers = [];
        const errors = [];
        for (const question of questions) {
            const value = answerValues[question.variable_key];
            // Skip if no value provided for optional questions
            if (!question.required && (value === undefined || value === null || value === '')) {
                continue;
            }
            const answer = new AnswerClass({
                question_id: question.id,
                user_id: userId,
                value: value
            });
            // Validate answer
            const validation = answer.validate(question);
            if (!validation.isValid) {
                errors.push(...validation.errors.map(e => `${question.variable_key}: ${e}`));
                continue;
            }
            answers.push(answer);
            // Save to storage if available
            if (this.answerStorage) {
                try {
                    await this.answerStorage.saveAnswer(answer);
                }
                catch (error) {
                    errors.push(`Failed to save answer for ${question.variable_key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        }
        if (errors.length > 0) {
            throw new Error(`Answer collection failed: ${errors.join(', ')}`);
        }
        return answers;
    }
    /**
     * Get answers for specific questions
     */
    async getAnswers(questionIds) {
        if (!this.answerStorage) {
            return [];
        }
        return await this.answerStorage.getAnswers(questionIds);
    }
    /**
     * Get all answers for a user and prompt
     */
    async getAnswersByUser(userId, promptId) {
        if (!this.answerStorage) {
            return [];
        }
        return await this.answerStorage.getAnswersByUser(userId, promptId);
    }
    /**
     * Update an existing answer
     */
    async updateAnswer(answerId, value, question) {
        if (!this.answerStorage) {
            throw new Error('Answer storage not configured');
        }
        // Validate new value
        const tempAnswer = new AnswerClass({
            question_id: question.id,
            user_id: 'temp',
            value: value
        });
        const validation = tempAnswer.validate(question);
        if (!validation.isValid) {
            throw new Error(`Invalid answer value: ${validation.errors.join(', ')}`);
        }
        await this.answerStorage.updateAnswer(answerId, value);
    }
    /**
     * Delete an answer
     */
    async deleteAnswer(answerId) {
        if (!this.answerStorage) {
            throw new Error('Answer storage not configured');
        }
        await this.answerStorage.deleteAnswer(answerId);
    }
    // Variable Substitution Engine
    /**
     * Substitute variables in a template string
     */
    substituteVariables(template, variableValues, options = {}) {
        const { strict = false, defaultValues = {} } = options;
        let result = template;
        const missingVariables = [];
        // Find all variable references in the template
        const variableRegex = /\{\{([^}]+)\}\}/g;
        let match;
        while ((match = variableRegex.exec(template)) !== null) {
            const variableName = match[1].trim();
            const fullMatch = match[0];
            let value = variableValues[variableName];
            // Use default value if not provided
            if (value === undefined || value === null) {
                value = defaultValues[variableName];
            }
            // Handle missing values
            if (value === undefined || value === null) {
                if (strict) {
                    missingVariables.push(variableName);
                    continue;
                }
                else {
                    value = ''; // Replace with empty string in non-strict mode
                }
            }
            // Convert value to string
            const stringValue = this.valueToString(value);
            result = result.replace(new RegExp(escapeRegExp(fullMatch), 'g'), stringValue);
        }
        if (strict && missingVariables.length > 0) {
            throw new Error(`Missing required variables: ${missingVariables.join(', ')}`);
        }
        return result;
    }
    /**
     * Substitute variables using answers and questions
     */
    substituteVariablesFromAnswers(template, answers, questions, options = {}) {
        const questionMap = new Map(questions.map(q => [q.id, q]));
        const variableValues = {};
        // Convert answers to variable values
        for (const answer of answers) {
            const question = questionMap.get(answer.question_id);
            if (question) {
                variableValues[question.variable_key] = new AnswerClass(answer).getNormalizedValue();
            }
        }
        return this.substituteVariables(template, variableValues, options);
    }
    /**
     * Convert a value to string for template substitution
     */
    valueToString(value) {
        if (value === null || value === undefined) {
            return '';
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    }
    /**
     * Extract variable names from a template
     */
    extractVariableNames(template) {
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
     * Validate that all required variables are available for substitution
     */
    validateVariableSubstitution(template, variables, answers, questions) {
        const errors = [];
        const templateVariables = this.extractVariableNames(template);
        const questionMap = new Map(questions.map(q => [q.id, q]));
        const variableMap = new Map(variables.map(v => [v.key, v]));
        // Get answered variables
        const answeredVariables = new Set(answers
            .map(a => questionMap.get(a.question_id)?.variable_key)
            .filter(Boolean));
        // Check each template variable
        for (const templateVar of templateVariables) {
            const variable = variableMap.get(templateVar);
            if (!variable) {
                errors.push(`Template references undefined variable: ${templateVar}`);
                continue;
            }
            if (variable.required && !answeredVariables.has(templateVar)) {
                errors.push(`Required variable '${templateVar}' has no answer`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
}
// Helper function to escape special regex characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
//# sourceMappingURL=variable-manager.js.map