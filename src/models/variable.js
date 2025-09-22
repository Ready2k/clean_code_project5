// Variable and question/answer models
import { v4 as uuidv4 } from 'uuid';
export class QuestionClass {
    id;
    prompt_id;
    variable_key;
    text;
    type;
    required;
    options;
    help_text;
    constructor(data) {
        this.id = data.id || uuidv4();
        this.prompt_id = data.prompt_id;
        this.variable_key = data.variable_key;
        this.text = data.text;
        this.type = data.type;
        this.required = data.required || false;
        this.options = data.options;
        this.help_text = data.help_text;
    }
    /**
     * Validate the question structure
     */
    validate() {
        const errors = [];
        if (!this.id)
            errors.push('Question ID is required');
        if (!this.prompt_id)
            errors.push('Prompt ID is required');
        if (!this.variable_key)
            errors.push('Variable key is required');
        if (!this.text)
            errors.push('Question text is required');
        const validTypes = ['string', 'number', 'select', 'multiselect', 'boolean'];
        if (!validTypes.includes(this.type)) {
            errors.push(`Question type must be one of: ${validTypes.join(', ')}`);
        }
        // Select/multiselect must have options
        if ((this.type === 'select' || this.type === 'multiselect') &&
            (!this.options || this.options.length === 0)) {
            errors.push(`Question of type '${this.type}' must have options`);
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Generate a user-friendly question based on variable definition
     */
    static fromVariable(variable, promptId) {
        let questionText = variable.label || variable.key;
        // Add type-specific hints
        switch (variable.type) {
            case 'number':
                questionText += ' (enter a number)';
                break;
            case 'boolean':
                questionText += ' (yes/no)';
                break;
            case 'select':
                questionText += ` (choose one: ${variable.options?.join(', ') || 'no options available'})`;
                break;
            case 'multiselect':
                questionText += ` (choose multiple: ${variable.options?.join(', ') || 'no options available'})`;
                break;
        }
        if (variable.required) {
            questionText += ' *';
        }
        return new QuestionClass({
            prompt_id: promptId,
            variable_key: variable.key,
            text: questionText,
            type: variable.type,
            required: variable.required,
            options: variable.options,
            help_text: variable.help_text
        });
    }
}
export class AnswerClass {
    id;
    question_id;
    user_id;
    value;
    created_at;
    constructor(data) {
        this.id = data.id || uuidv4();
        this.question_id = data.question_id;
        this.user_id = data.user_id;
        this.value = data.value;
        this.created_at = data.created_at || new Date().toISOString();
    }
    /**
     * Validate the answer against the question type
     */
    validate(question) {
        const errors = [];
        if (!this.id)
            errors.push('Answer ID is required');
        if (!this.question_id)
            errors.push('Question ID is required');
        if (!this.user_id)
            errors.push('User ID is required');
        // Check if required value is provided
        if (question.required && (this.value === null || this.value === undefined || this.value === '')) {
            errors.push('Answer is required for this question');
        }
        // Type-specific validation
        if (this.value !== null && this.value !== undefined && this.value !== '') {
            switch (question.type) {
                case 'string':
                    if (typeof this.value !== 'string') {
                        errors.push('Answer must be a string');
                    }
                    break;
                case 'number':
                    if (typeof this.value !== 'number' && !Number.isFinite(Number(this.value))) {
                        errors.push('Answer must be a valid number');
                    }
                    break;
                case 'boolean':
                    if (typeof this.value !== 'boolean' && this.value !== 'true' && this.value !== 'false') {
                        errors.push('Answer must be true or false');
                    }
                    break;
                case 'select':
                    if (!question.options?.includes(this.value)) {
                        errors.push(`Answer must be one of: ${question.options?.join(', ') || 'no options available'}`);
                    }
                    break;
                case 'multiselect':
                    if (!Array.isArray(this.value)) {
                        errors.push('Answer must be an array for multiselect questions');
                    }
                    else {
                        const invalidOptions = this.value.filter(v => !question.options?.includes(v));
                        if (invalidOptions.length > 0) {
                            errors.push(`Invalid options: ${invalidOptions.join(', ')}. Must be from: ${question.options?.join(', ') || 'no options available'}`);
                        }
                    }
                    break;
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Get the normalized value for template substitution
     */
    getNormalizedValue() {
        switch (typeof this.value) {
            case 'string':
                return this.value;
            case 'number':
                return this.value;
            case 'boolean':
                return this.value;
            default:
                if (Array.isArray(this.value)) {
                    return this.value.join(', ');
                }
                return String(this.value);
        }
    }
}
//# sourceMappingURL=variable.js.map