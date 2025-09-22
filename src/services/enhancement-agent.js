// Enhancement Agent - LLM-powered prompt improvement and structuring
import { HumanPromptClass, StructuredPromptClass } from '../models/prompt';
import { QuestionClass } from '../models/variable';
export class EnhancementAgentImpl {
    llmService;
    constructor(llmService) {
        this.llmService = llmService;
    }
    async enhance(humanPrompt, context) {
        try {
            // Validate input
            const humanPromptClass = new HumanPromptClass(humanPrompt);
            const validation = humanPromptClass.validate();
            if (!validation.isValid) {
                throw new Error(`Invalid human prompt: ${validation.errors.join(', ')}`);
            }
            // Build enhancement prompt for LLM
            const enhancementPrompt = this.buildEnhancementPrompt(humanPrompt, context);
            // Call LLM service
            const llmResponse = await this.llmService.complete(enhancementPrompt, {
                temperature: 0.3,
                maxTokens: 2000,
                systemPrompt: this.getEnhancementSystemPrompt()
            });
            // Parse LLM response
            const parsedResult = this.parseLLMResponse(llmResponse);
            // Create structured prompt
            const structuredPrompt = new StructuredPromptClass(parsedResult.structured);
            // Validate structured prompt
            const structuredValidation = this.validateStructuredPrompt(structuredPrompt);
            if (!structuredValidation.isValid) {
                throw new Error(`Generated structured prompt is invalid: ${structuredValidation.errors.join(', ')}`);
            }
            // Extract variables and generate questions
            const variables = this.extractVariables(structuredPrompt.user_template);
            const questions = await this.generateQuestions(variables);
            // Calculate confidence score
            const confidence = this.calculateConfidence(humanPrompt, structuredPrompt, parsedResult.warnings || []);
            // Generate rationale
            const rationale = this.generateRationale(humanPrompt, structuredPrompt);
            return {
                structuredPrompt,
                questions,
                rationale,
                confidence,
                changes_made: parsedResult.changes_made || [],
                warnings: parsedResult.warnings
            };
        }
        catch (error) {
            throw new Error(`Enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async generateQuestions(variables) {
        const questions = [];
        for (const variable of variables) {
            // Generate a temporary prompt ID for question creation
            const tempPromptId = 'temp-prompt-id';
            const question = QuestionClass.fromVariable(variable, tempPromptId);
            questions.push(question);
        }
        return questions;
    }
    validateStructuredPrompt(structured) {
        const structuredClass = new StructuredPromptClass(structured);
        const baseValidation = structuredClass.validate();
        if (!baseValidation.isValid) {
            return baseValidation;
        }
        // Additional quality checks
        const errors = [];
        const warnings = [];
        // Check for minimum system instructions
        if (structured.system.length < 2) {
            warnings.push('Consider adding more detailed system instructions');
        }
        // Check for rules
        if (structured.rules.length === 0) {
            warnings.push('Consider adding specific rules or constraints');
        }
        // Check template complexity
        if (structured.user_template.length < 50) {
            warnings.push('User template might be too simple');
        }
        // Check for variable usage
        const templateVars = structuredClass.getTemplateVariables();
        if (templateVars.length === 0 && structured.variables.length > 0) {
            errors.push('Variables defined but not used in template');
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    async analyzePrompt(prompt) {
        const suggestions = [];
        const missing_elements = [];
        let quality_score = 0;
        // Determine if it's human or structured prompt
        const isHuman = 'goal' in prompt;
        if (isHuman) {
            const humanPrompt = prompt;
            // Analyze human prompt
            if (!humanPrompt.goal || humanPrompt.goal.length < 20) {
                missing_elements.push('Clear, detailed goal');
                suggestions.push('Expand the goal to be more specific and actionable');
            }
            else {
                quality_score += 25;
            }
            if (!humanPrompt.audience || humanPrompt.audience.length < 10) {
                missing_elements.push('Target audience definition');
                suggestions.push('Define who will be using this prompt');
            }
            else {
                quality_score += 20;
            }
            if (humanPrompt.steps.length < 2) {
                missing_elements.push('Detailed steps');
                suggestions.push('Break down the task into clear, actionable steps');
            }
            else {
                quality_score += 25;
            }
            if (!humanPrompt.output_expectations.format) {
                missing_elements.push('Output format specification');
                suggestions.push('Specify the expected format of the output');
            }
            else {
                quality_score += 15;
            }
            if (humanPrompt.output_expectations.fields.length === 0) {
                missing_elements.push('Expected output fields');
                suggestions.push('List the specific fields or elements expected in the output');
            }
            else {
                quality_score += 15;
            }
        }
        else {
            const structuredPrompt = prompt;
            // Analyze structured prompt
            if (structuredPrompt.system.length < 2) {
                missing_elements.push('Comprehensive system instructions');
                suggestions.push('Add more detailed system-level instructions');
            }
            else {
                quality_score += 30;
            }
            if (structuredPrompt.rules.length === 0) {
                missing_elements.push('Specific rules and constraints');
                suggestions.push('Define clear rules for the AI to follow');
            }
            else {
                quality_score += 25;
            }
            if (!structuredPrompt.user_template || structuredPrompt.user_template.length < 50) {
                missing_elements.push('Detailed user template');
                suggestions.push('Expand the user template with more context and structure');
            }
            else {
                quality_score += 25;
            }
            if (structuredPrompt.capabilities.length === 0) {
                suggestions.push('Consider defining specific capabilities or skills needed');
                quality_score += 10;
            }
            else {
                quality_score += 20;
            }
        }
        return {
            suggestions,
            quality_score: Math.min(quality_score, 100),
            missing_elements
        };
    }
    extractVariables(template) {
        const variableRegex = /\{\{([^}]+)\}\}/g;
        const variables = [];
        const foundKeys = new Set();
        let match;
        while ((match = variableRegex.exec(template)) !== null) {
            const variableName = match[1].trim();
            if (!foundKeys.has(variableName)) {
                foundKeys.add(variableName);
                // Infer variable type from name patterns
                const type = this.inferVariableType(variableName);
                variables.push({
                    key: variableName,
                    label: this.generateVariableLabel(variableName),
                    type,
                    required: true, // Default to required, can be adjusted later
                    sensitive: this.isVariableSensitive(variableName)
                });
            }
        }
        return variables;
    }
    generateRationale(_original, enhanced) {
        const changes = [];
        // Analyze what was transformed
        if (enhanced.system.length > 0) {
            changes.push(`Added ${enhanced.system.length} system instruction(s) to provide clear context and role definition`);
        }
        if (enhanced.rules.length > 0) {
            changes.push(`Defined ${enhanced.rules.length} specific rule(s) to ensure consistent behavior`);
        }
        if (enhanced.capabilities.length > 0) {
            changes.push(`Identified ${enhanced.capabilities.length} key capability requirement(s)`);
        }
        const templateVars = this.extractVariables(enhanced.user_template);
        if (templateVars.length > 0) {
            changes.push(`Extracted ${templateVars.length} variable(s) to make the prompt reusable`);
        }
        // Check if this is a minimal change scenario
        const isMinimal = enhanced.system.length <= 1 &&
            enhanced.rules.length === 0 &&
            enhanced.capabilities.length === 0 &&
            templateVars.length === 0;
        if (isMinimal) {
            return 'Converted human prompt to structured format with minimal changes needed.';
        }
        // Structure improvements
        changes.push('Converted free-form instructions into structured template format');
        changes.push('Organized content into system context and user-facing template');
        return `Enhanced the prompt by: ${changes.join('; ')}.`;
    }
    buildEnhancementPrompt(humanPrompt, context) {
        let prompt = `Please enhance the following human-readable prompt into a structured format.

HUMAN PROMPT:
Goal: ${humanPrompt.goal}
Audience: ${humanPrompt.audience}
Steps: ${humanPrompt.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}
Output Format: ${humanPrompt.output_expectations.format}
Expected Fields: ${humanPrompt.output_expectations.fields.join(', ')}

REQUIREMENTS:
- Convert to structured format with system instructions, user template, rules, and capabilities
- Extract variables using {{variable_name}} syntax where content should be dynamic
- Preserve the original intent and goal
- Make the prompt clear, specific, and actionable
- Include appropriate rules and constraints`;
        if (context?.targetProvider) {
            prompt += `\n- Optimize for ${context.targetProvider} provider`;
        }
        if (context?.domainKnowledge) {
            prompt += `\n- Consider this domain context: ${context.domainKnowledge}`;
        }
        prompt += `\n\nRespond with a JSON object containing:
{
  "structured": {
    "schema_version": 1,
    "system": ["instruction1", "instruction2"],
    "capabilities": ["capability1", "capability2"],
    "user_template": "template with {{variables}}",
    "rules": [{"name": "rule1", "description": "desc1"}],
    "variables": ["var1", "var2"]
  },
  "changes_made": ["change1", "change2"],
  "warnings": ["warning1", "warning2"]
}`;
        return prompt;
    }
    getEnhancementSystemPrompt() {
        return `You are an expert prompt engineer specializing in converting human-readable prompts into structured, reusable formats. Your goal is to:

1. Preserve the original intent and meaning
2. Create clear, actionable system instructions
3. Design flexible user templates with appropriate variables
4. Define specific rules and constraints
5. Identify required capabilities
6. Ensure the result is provider-agnostic and reusable

Focus on clarity, specificity, and maintainability. Extract variables for any content that should be dynamic or reusable.`;
    }
    parseLLMResponse(response) {
        try {
            // Try to extract JSON from the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in LLM response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            if (!parsed.structured) {
                throw new Error('Missing structured prompt in LLM response');
            }
            return {
                structured: parsed.structured,
                changes_made: parsed.changes_made || [],
                warnings: parsed.warnings || []
            };
        }
        catch (error) {
            throw new Error(`Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    calculateConfidence(original, enhanced, warnings) {
        let confidence = 1.0;
        // Reduce confidence for warnings
        confidence -= warnings.length * 0.1;
        // Check if key elements were preserved
        const originalText = `${original.goal} ${original.audience} ${original.steps.join(' ')}`.toLowerCase();
        const enhancedText = `${enhanced.system.join(' ')} ${enhanced.user_template}`.toLowerCase();
        // Simple keyword overlap check
        const originalWords = new Set(originalText.split(/\s+/).filter(w => w.length > 3));
        const enhancedWords = new Set(enhancedText.split(/\s+/).filter(w => w.length > 3));
        const overlap = [...originalWords].filter(word => enhancedWords.has(word)).length;
        const overlapRatio = overlap / Math.max(originalWords.size, 1);
        if (overlapRatio < 0.3) {
            confidence -= 0.2; // Significant content divergence
        }
        // Check structural completeness
        if (enhanced.system.length === 0)
            confidence -= 0.2;
        if (!enhanced.user_template)
            confidence -= 0.3;
        if (enhanced.rules.length === 0)
            confidence -= 0.1;
        return Math.max(0, Math.min(1, confidence));
    }
    inferVariableType(variableName) {
        const name = variableName.toLowerCase();
        if (name.includes('count') || name.includes('number') || name.includes('amount') || name.includes('quantity')) {
            return 'number';
        }
        if (name.includes('enable') || name.includes('disable') || name.includes('is_') || name.includes('has_') || name.includes('should_')) {
            return 'boolean';
        }
        if (name.includes('type') || name.includes('category') || name.includes('status') || name.includes('mode')) {
            return 'select';
        }
        if (name.includes('tags') || name.includes('options') || name.includes('items')) {
            return 'multiselect';
        }
        return 'string'; // Default
    }
    generateVariableLabel(variableName) {
        return variableName
            .replace(/_/g, ' ')
            .replace(/([A-Z])/g, ' $1')
            .replace(/\b\w/g, l => l.toUpperCase())
            .trim();
    }
    isVariableSensitive(variableName) {
        const name = variableName.toLowerCase();
        const sensitiveKeywords = ['password', 'key', 'secret', 'token', 'credential', 'private', 'confidential'];
        return sensitiveKeywords.some(keyword => name.includes(keyword));
    }
}
//# sourceMappingURL=enhancement-agent.js.map