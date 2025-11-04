/**
 * Template Validator Utility
 * 
 * Validates template definitions for correctness and security
 */

import { DefaultTemplate, TemplateVariable } from '../types/prompt-templates';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TemplateValidationResult extends ValidationResult {
  templateKey: string;
  variableIssues: VariableValidationIssue[];
}

export interface VariableValidationIssue {
  variableName: string;
  issue: 'missing_definition' | 'unused_definition' | 'invalid_name' | 'invalid_type';
  message: string;
}

/**
 * Template validation rules
 */
const TEMPLATE_VALIDATION_RULES = {
  // Content validation
  minContentLength: 10,
  maxContentLength: 10000,
  
  // Variable validation
  maxVariables: 20,
  variableNamePattern: /^[a-zA-Z][a-zA-Z0-9_]*$/,
  
  // Template syntax validation
  variableSyntaxPattern: /\{\{([^}]+)\}\}/g,
  
  // Security validation
  forbiddenPatterns: [
    /<script/i,
    /javascript:/i,
    /eval\(/i,
    /function\s*\(/i
  ]
};

/**
 * Validate template content
 */
function validateTemplateContent(content: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check content length
  if (content.length < TEMPLATE_VALIDATION_RULES.minContentLength) {
    errors.push(`Content must be at least ${TEMPLATE_VALIDATION_RULES.minContentLength} characters`);
  }
  
  if (content.length > TEMPLATE_VALIDATION_RULES.maxContentLength) {
    errors.push(`Content must not exceed ${TEMPLATE_VALIDATION_RULES.maxContentLength} characters`);
  }
  
  // Check for forbidden patterns
  for (const pattern of TEMPLATE_VALIDATION_RULES.forbiddenPatterns) {
    if (pattern.test(content)) {
      errors.push(`Content contains forbidden pattern: ${pattern.source}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Extract variables from template content
 */
function extractVariablesFromContent(content: string): string[] {
  const variables: string[] = [];
  const matches = content.matchAll(TEMPLATE_VALIDATION_RULES.variableSyntaxPattern);
  
  for (const match of matches) {
    const variableName = match[1].trim();
    if (!variables.includes(variableName)) {
      variables.push(variableName);
    }
  }
  
  return variables;
}

/**
 * Validate a single template
 */
export function validateTemplate(template: DefaultTemplate): TemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const variableIssues: VariableValidationIssue[] = [];

  // Validate basic template structure
  if (!template.key || template.key.trim().length === 0) {
    errors.push('Template key is required');
  }

  if (!template.name || template.name.trim().length === 0) {
    errors.push('Template name is required');
  }

  if (!template.description || template.description.trim().length === 0) {
    errors.push('Template description is required');
  }

  // Validate content
  const contentValidation = validateTemplateContent(template.content);
  if (!contentValidation.isValid) {
    errors.push(...contentValidation.errors);
  }

  // Validate variables
  const variableValidation = validateTemplateVariables(template);
  variableIssues.push(...variableValidation.issues);
  errors.push(...variableValidation.errors);
  warnings.push(...variableValidation.warnings);

  // Validate metadata
  if (!template.metadata.version) {
    warnings.push('Template version is not specified');
  }

  if (!template.metadata.author) {
    warnings.push('Template author is not specified');
  }

  // Validate category-specific rules
  const categoryValidation = validateCategorySpecificRules(template);
  errors.push(...categoryValidation.errors);
  warnings.push(...categoryValidation.warnings);

  return {
    templateKey: template.key,
    isValid: errors.length === 0,
    errors,
    warnings,
    variableIssues
  };
}

/**
 * Validate template variables
 */
function validateTemplateVariables(template: DefaultTemplate): {
  errors: string[];
  warnings: string[];
  issues: VariableValidationIssue[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const issues: VariableValidationIssue[] = [];

  // Extract variables from content
  const contentVariables = extractVariablesFromContent(template.content);
  const definedVariables = template.variables.map(v => v.name);

  // Check for variables used in content but not defined
  for (const contentVar of contentVariables) {
    if (!definedVariables.includes(contentVar)) {
      issues.push({
        variableName: contentVar,
        issue: 'missing_definition',
        message: `Variable '${contentVar}' is used in template but not defined in variables array`
      });
      errors.push(`Missing variable definition: ${contentVar}`);
    }
  }

  // Check for variables defined but not used
  for (const definedVar of definedVariables) {
    if (!contentVariables.includes(definedVar)) {
      issues.push({
        variableName: definedVar,
        issue: 'unused_definition',
        message: `Variable '${definedVar}' is defined but not used in template content`
      });
      warnings.push(`Unused variable definition: ${definedVar}`);
    }
  }

  // Validate variable definitions
  for (const variable of template.variables) {
    const nameValidation = validateVariableName(variable.name);
    if (!nameValidation.isValid) {
      issues.push({
        variableName: variable.name,
        issue: 'invalid_name',
        message: nameValidation.error || 'Invalid variable name'
      });
      errors.push(`Invalid variable name '${variable.name}': ${nameValidation.error}`);
    }

    const typeValidation = validateVariableType(variable);
    if (!typeValidation.isValid) {
      issues.push({
        variableName: variable.name,
        issue: 'invalid_type',
        message: typeValidation.error || 'Invalid variable type'
      });
      errors.push(`Invalid variable type for '${variable.name}': ${typeValidation.error}`);
    }
  }

  // Check for too many variables
  if (template.variables.length > TEMPLATE_VALIDATION_RULES.maxVariables) {
    errors.push(`Too many variables: ${template.variables.length} (max: ${TEMPLATE_VALIDATION_RULES.maxVariables})`);
  }

  return { errors, warnings, issues };
}

/**
 * Validate variable name
 */
function validateVariableName(name: string): { isValid: boolean; error?: string } {
  if (!name || name.trim().length === 0) {
    return { isValid: false, error: 'Variable name cannot be empty' };
  }

  if (!TEMPLATE_VALIDATION_RULES.variableNamePattern.test(name)) {
    return { isValid: false, error: 'Variable name must start with a letter and contain only letters, numbers, and underscores' };
  }

  if (name.length > 50) {
    return { isValid: false, error: 'Variable name is too long (max 50 characters)' };
  }

  return { isValid: true };
}

/**
 * Validate variable type and constraints
 */
function validateVariableType(variable: TemplateVariable): { isValid: boolean; error?: string } {
  const validTypes = ['string', 'number', 'boolean', 'array', 'object', 'select', 'multiselect'];
  
  if (!validTypes.includes(variable.type)) {
    return { isValid: false, error: `Invalid variable type '${variable.type}'. Must be one of: ${validTypes.join(', ')}` };
  }

  // Validate type-specific constraints
  if (variable.type === 'select' || variable.type === 'multiselect') {
    if (!variable.options || variable.options.length === 0) {
      return { isValid: false, error: `Variable of type '${variable.type}' must have options defined` };
    }
  }

  // Validate default value type
  if (variable.defaultValue !== null && variable.defaultValue !== undefined) {
    const defaultValueValidation = validateDefaultValueType(variable.defaultValue, variable.type);
    if (!defaultValueValidation.isValid) {
      return { isValid: false, error: `Default value type mismatch: ${defaultValueValidation.error}` };
    }
  }

  return { isValid: true };
}

/**
 * Validate default value matches variable type
 */
function validateDefaultValueType(defaultValue: any, type: string): { isValid: boolean; error?: string } {
  switch (type) {
    case 'string':
    case 'select':
      if (typeof defaultValue !== 'string') {
        return { isValid: false, error: 'Default value must be a string' };
      }
      break;
    case 'number':
      if (typeof defaultValue !== 'number') {
        return { isValid: false, error: 'Default value must be a number' };
      }
      break;
    case 'boolean':
      if (typeof defaultValue !== 'boolean') {
        return { isValid: false, error: 'Default value must be a boolean' };
      }
      break;
    case 'array':
    case 'multiselect':
      if (!Array.isArray(defaultValue)) {
        return { isValid: false, error: 'Default value must be an array' };
      }
      break;
    case 'object':
      if (typeof defaultValue !== 'object' || Array.isArray(defaultValue)) {
        return { isValid: false, error: 'Default value must be an object' };
      }
      break;
  }

  return { isValid: true };
}

/**
 * Validate category-specific rules
 */
function validateCategorySpecificRules(template: DefaultTemplate): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  switch (template.category) {
    case 'enhancement':
      // Enhancement templates should have specific structure
      if (!template.content.includes('{{goal}}')) {
        warnings.push('Enhancement templates typically should include a {{goal}} variable');
      }
      if (!template.content.includes('JSON')) {
        warnings.push('Enhancement templates typically should expect JSON responses');
      }
      break;

    case 'question_generation':
      // Question generation templates should return JSON with questions array
      if (!template.content.includes('questions')) {
        errors.push('Question generation templates must include a questions structure');
      }
      try {
        // Try to parse as JSON to validate structure
        const parsed = JSON.parse(template.content);
        if (!parsed.questions || !Array.isArray(parsed.questions)) {
          errors.push('Question generation templates must have a valid questions array');
        }
      } catch {
        // Not JSON, check for other valid formats
        if (!template.content.includes('variable_key') || !template.content.includes('text')) {
          warnings.push('Question generation templates should include variable_key and text fields');
        }
      }
      break;

    case 'mock_responses':
      // Mock response templates should only be active in development
      if (!template.metadata.environmentRestriction) {
        warnings.push('Mock response templates should specify environment restrictions');
      }
      if (template.metadata.environmentRestriction !== 'development') {
        warnings.push('Mock response templates should be restricted to development environment');
      }
      break;

    case 'system_prompts':
      // System prompts should be concise and clear
      if (template.variables.length > 0) {
        warnings.push('System prompts typically should not require variables');
      }
      break;
  }

  return { errors, warnings };
}

/**
 * Validate all default templates
 */
export function validateAllDefaultTemplates(templates: DefaultTemplate[]): {
  isValid: boolean;
  results: TemplateValidationResult[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
  };
} {
  const results = templates.map(template => validateTemplate(template));
  
  const valid = results.filter(r => r.isValid).length;
  const invalid = results.filter(r => !r.isValid).length;
  const warnings = results.filter(r => r.warnings.length > 0).length;

  return {
    isValid: invalid === 0,
    results,
    summary: {
      total: templates.length,
      valid,
      invalid,
      warnings
    }
  };
}

/**
 * Generate validation report
 */
export function generateValidationReport(results: TemplateValidationResult[]): string {
  const lines: string[] = [];
  
  lines.push('Template Validation Report');
  lines.push('========================');
  lines.push('');

  const summary = {
    total: results.length,
    valid: results.filter(r => r.isValid).length,
    invalid: results.filter(r => !r.isValid).length,
    warnings: results.filter(r => r.warnings.length > 0).length
  };

  lines.push(`Summary: ${summary.valid}/${summary.total} templates valid, ${summary.warnings} with warnings`);
  lines.push('');

  // Report invalid templates
  const invalidTemplates = results.filter(r => !r.isValid);
  if (invalidTemplates.length > 0) {
    lines.push('Invalid Templates:');
    lines.push('-----------------');
    for (const result of invalidTemplates) {
      lines.push(`❌ ${result.templateKey}`);
      for (const error of result.errors) {
        lines.push(`   Error: ${error}`);
      }
      lines.push('');
    }
  }

  // Report templates with warnings
  const templatesWithWarnings = results.filter(r => r.isValid && r.warnings.length > 0);
  if (templatesWithWarnings.length > 0) {
    lines.push('Templates with Warnings:');
    lines.push('-----------------------');
    for (const result of templatesWithWarnings) {
      lines.push(`⚠️  ${result.templateKey}`);
      for (const warning of result.warnings) {
        lines.push(`   Warning: ${warning}`);
      }
      lines.push('');
    }
  }

  // Report valid templates
  const validTemplates = results.filter(r => r.isValid && r.warnings.length === 0);
  if (validTemplates.length > 0) {
    lines.push('Valid Templates:');
    lines.push('---------------');
    for (const result of validTemplates) {
      lines.push(`✅ ${result.templateKey}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}