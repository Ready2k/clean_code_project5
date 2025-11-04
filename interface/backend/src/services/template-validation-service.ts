/**
 * Template Validation Service
 * 
 * Comprehensive validation for template syntax and variables, security validation
 * to prevent code injection, provider compatibility validation, and comprehensive
 * error reporting with suggestions.
 */

import { logger } from '../utils/logger.js';
import { AppError, ValidationError, ErrorCode } from '../types/errors.js';
import {
  TemplateVariable,
  ValidationResult,
  ValidationError as TemplateValidationError,
  ValidationWarning,
  SyntaxValidationResult,
  VariableValidationResult,
  SecurityValidationResult,
  CompatibilityValidationResult,
  SecurityViolation
} from '../types/prompt-templates.js';

export interface TemplateValidationConfig {
  enableSecurityValidation?: boolean;
  enableProviderValidation?: boolean;
  maxTemplateLength?: number;
  maxVariableCount?: number;
  allowedProviders?: string[];
  securityLevel?: 'strict' | 'moderate' | 'permissive';
}

export interface ProviderCapabilities {
  supportsSystemMessages?: boolean;
  maxContextLength?: number;
  supportedRoles?: string[];
  supportsStreaming?: boolean;
  supportsTools?: boolean;
  variableSyntax?: 'handlebars' | 'jinja2' | 'custom';
  reservedKeywords?: string[];
}

/**
 * Template Validation Service
 */
export class TemplateValidationService {
  private config: Required<TemplateValidationConfig>;
  private providerCapabilities: Map<string, ProviderCapabilities>;

  constructor(config: TemplateValidationConfig = {}) {
    this.config = {
      enableSecurityValidation: true,
      enableProviderValidation: true,
      maxTemplateLength: 50000, // 50KB
      maxVariableCount: 100,
      allowedProviders: ['openai', 'anthropic', 'meta', 'aws-bedrock', 'azure-openai'],
      securityLevel: 'strict',
      ...config
    };

    this.providerCapabilities = new Map();
    this.initializeProviderCapabilities();
  }

  // ============================================================================
  // Main Validation Methods
  // ============================================================================

  /**
   * Validate template syntax
   */
  validateSyntax(template: string): SyntaxValidationResult {
    const errors: TemplateValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Check template length
      if (template.length > this.config.maxTemplateLength) {
        errors.push({
          type: 'SYNTAX_ERROR',
          message: `Template exceeds maximum length of ${this.config.maxTemplateLength} characters`,
          suggestion: 'Consider breaking the template into smaller parts or removing unnecessary content'
        });
      }

      // Check for empty template
      if (!template || template.trim().length === 0) {
        errors.push({
          type: 'SYNTAX_ERROR',
          message: 'Template cannot be empty',
          suggestion: 'Add template content with appropriate variable placeholders'
        });
        return { isValid: false, errors, warnings };
      }

      // Validate variable syntax ({{variable_name}})
      const syntaxErrors = this.validateVariableSyntax(template);
      errors.push(...syntaxErrors);

      // Check for balanced braces
      const braceErrors = this.validateBraceBalance(template);
      errors.push(...braceErrors);

      // Check for nested variables (not supported)
      const nestedErrors = this.validateNestedVariables(template);
      errors.push(...nestedErrors);

      // Check for malformed variables
      const malformedErrors = this.validateMalformedVariables(template);
      errors.push(...malformedErrors);

      // Performance warnings
      const performanceWarnings = this.checkPerformanceConcerns(template);
      warnings.push(...performanceWarnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      logger.error('Syntax validation failed', { error });
      return {
        isValid: false,
        errors: [{
          type: 'SYNTAX_ERROR',
          message: 'Internal validation error occurred'
        }],
        warnings: []
      };
    }
  }

  /**
   * Validate template variables
   */
  validateVariables(template: string, variables: TemplateVariable[]): VariableValidationResult {
    const errors: TemplateValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Check variable count limit
      if (variables.length > this.config.maxVariableCount) {
        errors.push({
          type: 'INVALID_VARIABLE',
          message: `Too many variables (${variables.length}). Maximum allowed: ${this.config.maxVariableCount}`,
          suggestion: 'Consider consolidating variables or breaking the template into smaller parts'
        });
      }

      // Validate individual variables
      const variableErrors = this.validateVariableDefinitions(variables);
      errors.push(...variableErrors);

      // Check variable usage in template
      const usageResult = this.validateVariableUsage(template, variables);
      errors.push(...usageResult.errors);
      warnings.push(...usageResult.warnings);

      // Check for duplicate variable names
      const duplicateErrors = this.validateDuplicateVariables(variables);
      errors.push(...duplicateErrors);

      // Validate variable types and constraints
      const constraintErrors = this.validateVariableConstraints(variables);
      errors.push(...constraintErrors);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      logger.error('Variable validation failed', { error });
      return {
        isValid: false,
        errors: [{
          type: 'INVALID_VARIABLE',
          message: 'Internal variable validation error occurred'
        }],
        warnings: []
      };
    }
  }

  /**
   * Validate template security
   */
  validateSecurity(template: string): SecurityValidationResult {
    const errors: TemplateValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!this.config.enableSecurityValidation) {
      return { isValid: true, errors, warnings };
    }

    try {
      // Check for code injection patterns
      const injectionViolations = this.detectCodeInjection(template);
      for (const violation of injectionViolations) {
        if (violation.severity === 'critical' || violation.severity === 'high') {
          errors.push({
            type: 'SECURITY_VIOLATION',
            message: violation.message,
            suggestion: 'Remove or escape potentially dangerous code patterns'
          });
        } else {
          warnings.push({
            type: 'SECURITY_CONCERN',
            message: violation.message,
            suggestion: 'Review and validate this pattern is intentional'
          });
        }
      }

      // Check for sensitive data exposure
      const sensitiveViolations = this.detectSensitiveData(template);
      for (const violation of sensitiveViolations) {
        warnings.push({
          type: 'SECURITY_CONCERN',
          message: violation.message,
          suggestion: 'Ensure sensitive data is properly handled and not exposed'
        });
      }

      // Check for unsafe patterns based on security level
      const unsafePatterns = this.detectUnsafePatterns(template);
      for (const violation of unsafePatterns) {
        if (this.config.securityLevel === 'strict') {
          errors.push({
            type: 'SECURITY_VIOLATION',
            message: violation.message,
            suggestion: 'Remove unsafe patterns or adjust security level'
          });
        } else {
          warnings.push({
            type: 'SECURITY_CONCERN',
            message: violation.message,
            suggestion: 'Review pattern for security implications'
          });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      logger.error('Security validation failed', { error });
      return {
        isValid: false,
        errors: [{
          type: 'SECURITY_VIOLATION',
          message: 'Internal security validation error occurred'
        }],
        warnings: []
      };
    }
  }

  /**
   * Validate provider compatibility
   */
  validateProviderCompatibility(template: string, provider: string): CompatibilityValidationResult {
    const errors: TemplateValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!this.config.enableProviderValidation) {
      return { isValid: true, errors, warnings };
    }

    try {
      // Check if provider is supported
      if (!this.config.allowedProviders.includes(provider)) {
        errors.push({
          type: 'INVALID_VARIABLE',
          message: `Unsupported provider: ${provider}`,
          suggestion: `Use one of the supported providers: ${this.config.allowedProviders.join(', ')}`
        });
        return { isValid: false, errors, warnings };
      }

      const capabilities = this.providerCapabilities.get(provider);
      if (!capabilities) {
        warnings.push({
          type: 'PERFORMANCE_CONCERN',
          message: `No capabilities defined for provider: ${provider}`,
          suggestion: 'Provider compatibility cannot be fully validated'
        });
        return { isValid: true, errors, warnings };
      }

      // Check template length against provider limits
      if (capabilities.maxContextLength && template.length > capabilities.maxContextLength) {
        errors.push({
          type: 'INVALID_VARIABLE',
          message: `Template length (${template.length}) exceeds provider limit (${capabilities.maxContextLength})`,
          suggestion: 'Reduce template length or use a provider with higher limits'
        });
      }

      // Check for reserved keywords
      if (capabilities.reservedKeywords) {
        const keywordViolations = this.checkReservedKeywords(template, capabilities.reservedKeywords);
        errors.push(...keywordViolations);
      }

      // Check variable syntax compatibility
      if (capabilities.variableSyntax && capabilities.variableSyntax !== 'handlebars') {
        warnings.push({
          type: 'PERFORMANCE_CONCERN',
          message: `Provider uses ${capabilities.variableSyntax} syntax, but template uses handlebars syntax`,
          suggestion: 'Consider adapting template syntax for optimal provider compatibility'
        });
      }

      // Check role compatibility
      const roleCompatibility = this.validateRoleCompatibility(template, capabilities);
      warnings.push(...roleCompatibility);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      logger.error('Provider compatibility validation failed', { provider, error });
      return {
        isValid: false,
        errors: [{
          type: 'INVALID_VARIABLE',
          message: 'Internal provider compatibility validation error occurred'
        }],
        warnings: []
      };
    }
  }

  /**
   * Comprehensive template validation
   */
  async validateTemplate(
    template: string, 
    variables: TemplateVariable[], 
    provider?: string
  ): Promise<ValidationResult> {
    const allErrors: TemplateValidationError[] = [];
    const allWarnings: ValidationWarning[] = [];

    try {
      // Syntax validation
      const syntaxResult = this.validateSyntax(template);
      allErrors.push(...syntaxResult.errors);
      allWarnings.push(...syntaxResult.warnings);

      // Variable validation
      const variableResult = this.validateVariables(template, variables);
      allErrors.push(...variableResult.errors);
      allWarnings.push(...variableResult.warnings);

      // Security validation
      const securityResult = this.validateSecurity(template);
      allErrors.push(...securityResult.errors);
      allWarnings.push(...securityResult.warnings);

      // Provider compatibility validation
      if (provider) {
        const compatibilityResult = this.validateProviderCompatibility(template, provider);
        allErrors.push(...compatibilityResult.errors);
        allWarnings.push(...compatibilityResult.warnings);
      }

      return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings
      };

    } catch (error) {
      logger.error('Template validation failed', { error });
      return {
        isValid: false,
        errors: [{
          type: 'SYNTAX_ERROR',
          message: 'Template validation failed due to internal error'
        }],
        warnings: []
      };
    }
  }

  // ============================================================================
  // Syntax Validation Helpers
  // ============================================================================

  /**
   * Validate variable syntax in template
   */
  private validateVariableSyntax(template: string): TemplateValidationError[] {
    const errors: TemplateValidationError[] = [];
    
    // Check for valid variable pattern: {{variable_name}}
    const variablePattern = /\{\{([^}]*)\}\}/g;
    let match;
    
    while ((match = variablePattern.exec(template)) !== null) {
      const variableContent = match[1].trim();
      const fullMatch = match[0];
      const position = match.index;
      
      if (!variableContent) {
        errors.push({
          type: 'SYNTAX_ERROR',
          message: 'Empty variable placeholder found',
          line: this.getLineNumber(template, position),
          column: this.getColumnNumber(template, position),
          suggestion: 'Add a variable name between the braces: {{variableName}}'
        });
        continue;
      }

      // Check for valid variable name (alphanumeric and underscore only)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variableContent)) {
        errors.push({
          type: 'SYNTAX_ERROR',
          message: `Invalid variable name: ${variableContent}`,
          line: this.getLineNumber(template, position),
          column: this.getColumnNumber(template, position),
          suggestion: 'Variable names must start with a letter or underscore and contain only letters, numbers, and underscores'
        });
      }

      // Check for reserved words
      const reservedWords = ['if', 'else', 'endif', 'for', 'endfor', 'while', 'endwhile'];
      if (reservedWords.includes(variableContent.toLowerCase())) {
        errors.push({
          type: 'SYNTAX_ERROR',
          message: `Reserved word used as variable name: ${variableContent}`,
          line: this.getLineNumber(template, position),
          column: this.getColumnNumber(template, position),
          suggestion: 'Use a different variable name that is not a reserved word'
        });
      }
    }

    return errors;
  }

  /**
   * Validate brace balance
   */
  private validateBraceBalance(template: string): TemplateValidationError[] {
    const errors: TemplateValidationError[] = [];
    let openBraces = 0;
    let position = 0;

    for (let i = 0; i < template.length - 1; i++) {
      if (template[i] === '{' && template[i + 1] === '{') {
        openBraces++;
        i++; // Skip next character
      } else if (template[i] === '}' && template[i + 1] === '}') {
        openBraces--;
        if (openBraces < 0) {
          errors.push({
            type: 'SYNTAX_ERROR',
            message: 'Unmatched closing braces }}',
            line: this.getLineNumber(template, i),
            column: this.getColumnNumber(template, i),
            suggestion: 'Ensure each }} has a matching {{ before it'
          });
          openBraces = 0; // Reset to continue checking
        }
        i++; // Skip next character
      }
    }

    if (openBraces > 0) {
      errors.push({
        type: 'SYNTAX_ERROR',
        message: `${openBraces} unmatched opening braces {{`,
        suggestion: 'Ensure each {{ has a matching }} after it'
      });
    }

    return errors;
  }

  /**
   * Validate nested variables (not supported)
   */
  private validateNestedVariables(template: string): TemplateValidationError[] {
    const errors: TemplateValidationError[] = [];
    
    // Look for nested braces like {{outer{{inner}}}}
    const nestedPattern = /\{\{[^}]*\{\{[^}]*\}\}[^}]*\}\}/g;
    let match;
    
    while ((match = nestedPattern.exec(template)) !== null) {
      errors.push({
        type: 'SYNTAX_ERROR',
        message: 'Nested variables are not supported',
        line: this.getLineNumber(template, match.index),
        column: this.getColumnNumber(template, match.index),
        suggestion: 'Use separate variables instead of nesting them'
      });
    }

    return errors;
  }

  /**
   * Validate malformed variables
   */
  private validateMalformedVariables(template: string): TemplateValidationError[] {
    const errors: TemplateValidationError[] = [];
    
    // Look for single braces or mismatched braces
    const malformedPatterns = [
      { pattern: /\{[^{][^}]*\}/g, message: 'Single braces found - use double braces {{}}' },
      { pattern: /\{\{[^}]*\{[^}]*\}\}/g, message: 'Malformed variable with mixed brace types' },
      { pattern: /\{[^}]*\}\}/g, message: 'Mismatched braces - opening single, closing double' },
      { pattern: /\{\{[^}]*\}/g, message: 'Mismatched braces - opening double, closing single' }
    ];

    for (const { pattern, message } of malformedPatterns) {
      let match;
      while ((match = pattern.exec(template)) !== null) {
        errors.push({
          type: 'SYNTAX_ERROR',
          message,
          line: this.getLineNumber(template, match.index),
          column: this.getColumnNumber(template, match.index),
          suggestion: 'Use proper variable syntax: {{variableName}}'
        });
      }
    }

    return errors;
  }

  /**
   * Check performance concerns
   */
  private checkPerformanceConcerns(template: string): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check for very long lines
    const lines = template.split('\n');
    lines.forEach((line, index) => {
      if (line.length > 1000) {
        warnings.push({
          type: 'PERFORMANCE_CONCERN',
          message: `Very long line (${line.length} characters) at line ${index + 1}`,
          suggestion: 'Consider breaking long lines for better readability'
        });
      }
    });

    // Check for excessive variable usage in a single line
    lines.forEach((line, index) => {
      const variableCount = (line.match(/\{\{[^}]+\}\}/g) || []).length;
      if (variableCount > 10) {
        warnings.push({
          type: 'PERFORMANCE_CONCERN',
          message: `Many variables (${variableCount}) in line ${index + 1}`,
          suggestion: 'Consider simplifying the template or using fewer variables per line'
        });
      }
    });

    return warnings;
  }

  // ============================================================================
  // Variable Validation Helpers
  // ============================================================================

  /**
   * Validate variable definitions
   */
  private validateVariableDefinitions(variables: TemplateVariable[]): TemplateValidationError[] {
    const errors: TemplateValidationError[] = [];

    for (const variable of variables) {
      // Check variable name
      if (!variable.name || variable.name.trim().length === 0) {
        errors.push({
          type: 'INVALID_VARIABLE',
          message: 'Variable name cannot be empty',
          suggestion: 'Provide a valid variable name'
        });
        continue;
      }

      // Check variable name format
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(variable.name)) {
        errors.push({
          type: 'INVALID_VARIABLE',
          message: `Invalid variable name format: ${variable.name}`,
          suggestion: 'Variable names must start with a letter or underscore and contain only letters, numbers, and underscores'
        });
      }

      // Check variable type
      const validTypes = ['string', 'number', 'boolean', 'array', 'object'];
      if (!validTypes.includes(variable.type)) {
        errors.push({
          type: 'INVALID_VARIABLE',
          message: `Invalid variable type: ${variable.type}`,
          suggestion: `Use one of the valid types: ${validTypes.join(', ')}`
        });
      }

      // Check description
      if (!variable.description || variable.description.trim().length === 0) {
        errors.push({
          type: 'INVALID_VARIABLE',
          message: `Variable '${variable.name}' missing description`,
          suggestion: 'Provide a clear description for the variable'
        });
      }

      // Validate default value type
      if (variable.defaultValue !== undefined && variable.defaultValue !== null) {
        const actualType = Array.isArray(variable.defaultValue) ? 'array' : typeof variable.defaultValue;
        if (variable.type !== actualType && !(variable.type === 'object' && actualType === 'object')) {
          errors.push({
            type: 'INVALID_VARIABLE',
            message: `Variable '${variable.name}' default value type (${actualType}) doesn't match declared type (${variable.type})`,
            suggestion: 'Ensure default value matches the declared variable type'
          });
        }
      }
    }

    return errors;
  }

  /**
   * Validate variable usage in template
   */
  private validateVariableUsage(template: string, variables: TemplateVariable[]): {
    errors: TemplateValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: TemplateValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const variableMap = new Map(variables.map(v => [v.name, v]));
    const usedVariables = new Set<string>();

    // Find all variables used in template
    const variablePattern = /\{\{(\w+)\}\}/g;
    let match;

    while ((match = variablePattern.exec(template)) !== null) {
      const variableName = match[1];
      usedVariables.add(variableName);

      if (!variableMap.has(variableName)) {
        errors.push({
          type: 'MISSING_VARIABLE',
          message: `Variable '${variableName}' used in template but not defined`,
          line: this.getLineNumber(template, match.index),
          column: this.getColumnNumber(template, match.index),
          suggestion: `Define the variable '${variableName}' in the variables array`
        });
      }
    }

    // Check for unused variables
    for (const variable of variables) {
      if (!usedVariables.has(variable.name)) {
        warnings.push({
          type: 'UNUSED_VARIABLE',
          message: `Variable '${variable.name}' defined but not used in template`,
          suggestion: 'Remove unused variable or add it to the template'
        });
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate duplicate variables
   */
  private validateDuplicateVariables(variables: TemplateVariable[]): TemplateValidationError[] {
    const errors: TemplateValidationError[] = [];
    const seen = new Set<string>();

    for (const variable of variables) {
      if (seen.has(variable.name)) {
        errors.push({
          type: 'INVALID_VARIABLE',
          message: `Duplicate variable name: ${variable.name}`,
          suggestion: 'Use unique names for all variables'
        });
      } else {
        seen.add(variable.name);
      }
    }

    return errors;
  }

  /**
   * Validate variable constraints
   */
  private validateVariableConstraints(variables: TemplateVariable[]): TemplateValidationError[] {
    const errors: TemplateValidationError[] = [];

    for (const variable of variables) {
      if (variable.validation) {
        for (const rule of variable.validation) {
          // Validate rule structure
          if (!rule.type || !rule.value) {
            errors.push({
              type: 'INVALID_VARIABLE',
              message: `Invalid validation rule for variable '${variable.name}'`,
              suggestion: 'Validation rules must have type and value properties'
            });
            continue;
          }

          // Validate rule compatibility with variable type
          const ruleCompatibility = this.validateRuleCompatibility(variable, rule);
          if (!ruleCompatibility.isValid) {
            errors.push({
              type: 'INVALID_VARIABLE',
              message: ruleCompatibility.message,
              suggestion: ruleCompatibility.suggestion
            });
          }
        }
      }
    }

    return errors;
  }

  /**
   * Validate rule compatibility with variable type
   */
  private validateRuleCompatibility(variable: TemplateVariable, rule: any): {
    isValid: boolean;
    message: string;
    suggestion: string;
  } {
    const stringRules = ['minLength', 'maxLength', 'pattern'];
    const numberRules = ['min', 'max'];
    const allTypeRules = ['enum'];

    if (stringRules.includes(rule.type) && variable.type !== 'string') {
      return {
        isValid: false,
        message: `Rule '${rule.type}' can only be used with string variables`,
        suggestion: 'Use appropriate validation rules for the variable type'
      };
    }

    if (numberRules.includes(rule.type) && variable.type !== 'number') {
      return {
        isValid: false,
        message: `Rule '${rule.type}' can only be used with number variables`,
        suggestion: 'Use appropriate validation rules for the variable type'
      };
    }

    return { isValid: true, message: '', suggestion: '' };
  }

  // ============================================================================
  // Security Validation Helpers
  // ============================================================================

  /**
   * Detect code injection patterns
   */
  private detectCodeInjection(template: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    const dangerousPatterns = [
      { pattern: /eval\s*\(/gi, severity: 'critical' as const, message: 'eval() function detected - potential code injection' },
      { pattern: /function\s*\(/gi, severity: 'high' as const, message: 'Function declaration detected - potential code injection' },
      { pattern: /javascript:/gi, severity: 'high' as const, message: 'JavaScript protocol detected - potential XSS' },
      { pattern: /<script[^>]*>/gi, severity: 'critical' as const, message: 'Script tag detected - potential XSS' },
      { pattern: /on\w+\s*=/gi, severity: 'high' as const, message: 'Event handler attribute detected - potential XSS' },
      { pattern: /\$\{.*\}/g, severity: 'medium' as const, message: 'Template literal syntax detected - potential injection' },
      { pattern: /document\./gi, severity: 'medium' as const, message: 'DOM access detected - potential security risk' },
      { pattern: /window\./gi, severity: 'medium' as const, message: 'Window object access detected - potential security risk' },
      { pattern: /import\s+/gi, severity: 'high' as const, message: 'Import statement detected - potential code injection' },
      { pattern: /require\s*\(/gi, severity: 'high' as const, message: 'Require statement detected - potential code injection' }
    ];

    for (const { pattern, severity, message } of dangerousPatterns) {
      if (pattern.test(template)) {
        violations.push({
          type: 'CODE_INJECTION',
          message,
          severity
        });
      }
    }

    return violations;
  }

  /**
   * Detect sensitive data patterns
   */
  private detectSensitiveData(template: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    const sensitivePatterns = [
      { pattern: /password/gi, message: 'Password reference detected in template' },
      { pattern: /secret/gi, message: 'Secret reference detected in template' },
      { pattern: /token/gi, message: 'Token reference detected in template' },
      { pattern: /api[_-]?key/gi, message: 'API key reference detected in template' },
      { pattern: /credential/gi, message: 'Credential reference detected in template' },
      { pattern: /private[_-]?key/gi, message: 'Private key reference detected in template' },
      { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, message: 'Credit card number pattern detected' },
      { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, message: 'SSN pattern detected' }
    ];

    for (const { pattern, message } of sensitivePatterns) {
      if (pattern.test(template)) {
        violations.push({
          type: 'SENSITIVE_DATA',
          message,
          severity: 'medium'
        });
      }
    }

    return violations;
  }

  /**
   * Detect unsafe patterns
   */
  private detectUnsafePatterns(template: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    const unsafePatterns = [
      { pattern: /\.\.\//g, message: 'Path traversal pattern detected' },
      { pattern: /file:\/\//gi, message: 'File protocol detected' },
      { pattern: /data:/gi, message: 'Data URI detected - potential security risk' },
      { pattern: /vbscript:/gi, message: 'VBScript protocol detected' },
      { pattern: /<!--.*-->/gs, message: 'HTML comments detected - potential information disclosure' },
      { pattern: /<\?.*\?>/gs, message: 'Processing instruction detected' }
    ];

    for (const { pattern, message } of unsafePatterns) {
      if (pattern.test(template)) {
        violations.push({
          type: 'UNSAFE_PATTERN',
          message,
          severity: 'low'
        });
      }
    }

    return violations;
  }

  // ============================================================================
  // Provider Compatibility Helpers
  // ============================================================================

  /**
   * Initialize provider capabilities
   */
  private initializeProviderCapabilities(): void {
    // OpenAI capabilities
    this.providerCapabilities.set('openai', {
      supportsSystemMessages: true,
      maxContextLength: 128000,
      supportedRoles: ['system', 'user', 'assistant'],
      supportsStreaming: true,
      supportsTools: true,
      variableSyntax: 'handlebars',
      reservedKeywords: ['model', 'messages', 'temperature', 'max_tokens']
    });

    // Anthropic capabilities
    this.providerCapabilities.set('anthropic', {
      supportsSystemMessages: true,
      maxContextLength: 200000,
      supportedRoles: ['system', 'user', 'assistant'],
      supportsStreaming: true,
      supportsTools: true,
      variableSyntax: 'handlebars',
      reservedKeywords: ['model', 'messages', 'max_tokens', 'system']
    });

    // Meta capabilities
    this.providerCapabilities.set('meta', {
      supportsSystemMessages: true,
      maxContextLength: 32000,
      supportedRoles: ['system', 'user', 'assistant'],
      supportsStreaming: true,
      supportsTools: false,
      variableSyntax: 'handlebars',
      reservedKeywords: ['model', 'messages', 'temperature']
    });

    // AWS Bedrock capabilities
    this.providerCapabilities.set('aws-bedrock', {
      supportsSystemMessages: true,
      maxContextLength: 200000,
      supportedRoles: ['system', 'user', 'assistant'],
      supportsStreaming: true,
      supportsTools: false,
      variableSyntax: 'handlebars',
      reservedKeywords: ['modelId', 'body', 'accept', 'contentType']
    });

    // Azure OpenAI capabilities
    this.providerCapabilities.set('azure-openai', {
      supportsSystemMessages: true,
      maxContextLength: 128000,
      supportedRoles: ['system', 'user', 'assistant'],
      supportsStreaming: true,
      supportsTools: true,
      variableSyntax: 'handlebars',
      reservedKeywords: ['model', 'messages', 'temperature', 'max_tokens', 'deployment_id']
    });
  }

  /**
   * Check for reserved keywords
   */
  private checkReservedKeywords(template: string, reservedKeywords: string[]): TemplateValidationError[] {
    const errors: TemplateValidationError[] = [];

    for (const keyword of reservedKeywords) {
      const pattern = new RegExp(`\\{\\{\\s*${keyword}\\s*\\}\\}`, 'gi');
      let match;

      while ((match = pattern.exec(template)) !== null) {
        errors.push({
          type: 'INVALID_VARIABLE',
          message: `Reserved keyword '${keyword}' used as variable name`,
          line: this.getLineNumber(template, match.index),
          column: this.getColumnNumber(template, match.index),
          suggestion: `Use a different variable name. '${keyword}' is reserved by the provider`
        });
      }
    }

    return errors;
  }

  /**
   * Validate role compatibility
   */
  private validateRoleCompatibility(template: string, capabilities: ProviderCapabilities): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check for role-specific patterns in template
    const rolePatterns = [
      { pattern: /system:/gi, role: 'system' },
      { pattern: /user:/gi, role: 'user' },
      { pattern: /assistant:/gi, role: 'assistant' },
      { pattern: /tool:/gi, role: 'tool' }
    ];

    for (const { pattern, role } of rolePatterns) {
      if (pattern.test(template) && capabilities.supportedRoles && !capabilities.supportedRoles.includes(role)) {
        warnings.push({
          type: 'PERFORMANCE_CONCERN',
          message: `Template references '${role}' role which is not supported by this provider`,
          suggestion: `Use one of the supported roles: ${capabilities.supportedRoles.join(', ')}`
        });
      }
    }

    return warnings;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get line number for position in template
   */
  private getLineNumber(template: string, position: number): number {
    return template.substring(0, position).split('\n').length;
  }

  /**
   * Get column number for position in template
   */
  private getColumnNumber(template: string, position: number): number {
    const lines = template.substring(0, position).split('\n');
    return lines[lines.length - 1].length + 1;
  }

  /**
   * Update provider capabilities
   */
  updateProviderCapabilities(provider: string, capabilities: ProviderCapabilities): void {
    this.providerCapabilities.set(provider, capabilities);
    logger.info('Provider capabilities updated', { provider });
  }

  /**
   * Get provider capabilities
   */
  getProviderCapabilities(provider: string): ProviderCapabilities | undefined {
    return this.providerCapabilities.get(provider);
  }

  /**
   * Get supported providers
   */
  getSupportedProviders(): string[] {
    return Array.from(this.providerCapabilities.keys());
  }

  /**
   * Test template compatibility with multiple providers
   */
  async testProviderCompatibility(
    templateId: string, 
    providers: string[], 
    testData?: any
  ): Promise<any[]> {
    try {
      // Get template content (would need to integrate with SystemPromptManager)
      // For now, we'll simulate this
      const template = testData?.template || "Sample template with {{variable}}";
      const variables = testData?.variables || [
        { name: 'variable', type: 'string', description: 'Test variable', required: true }
      ];

      const results = await Promise.all(
        providers.map(async (provider) => {
          try {
            // Validate compatibility
            const compatibilityResult = this.validateProviderCompatibility(template, provider);
            
            // Get provider capabilities
            const capabilities = this.getProviderCapabilities(provider);
            
            // Test template rendering (simulate)
            let renderTest = { success: true, renderTime: 0, error: null as string | null };
            try {
              const startTime = Date.now();
              // Simulate template rendering
              await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
              renderTest.renderTime = Date.now() - startTime;
            } catch (error) {
              renderTest.success = false;
              renderTest.error = error instanceof Error ? error.message : 'Unknown error';
            }

            return {
              provider,
              compatible: compatibilityResult.isValid,
              capabilities,
              validation: {
                errors: compatibilityResult.errors,
                warnings: compatibilityResult.warnings
              },
              renderTest,
              score: this.calculateCompatibilityScore(compatibilityResult, capabilities, renderTest)
            };

          } catch (error) {
            logger.error('Provider compatibility test failed', { provider, error });
            return {
              provider,
              compatible: false,
              capabilities: null,
              validation: {
                errors: [{
                  type: 'INVALID_VARIABLE' as const,
                  message: `Failed to test provider: ${error instanceof Error ? error.message : 'Unknown error'}`
                }],
                warnings: []
              },
              renderTest: { success: false, renderTime: 0, error: 'Test failed' },
              score: 0
            };
          }
        })
      );

      // Sort by compatibility score
      results.sort((a, b) => b.score - a.score);

      return results;

    } catch (error) {
      logger.error('Provider compatibility testing failed', { templateId, providers, error });
      throw new AppError('Failed to test provider compatibility', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Calculate compatibility score
   */
  private calculateCompatibilityScore(
    validation: CompatibilityValidationResult,
    capabilities: ProviderCapabilities | undefined,
    renderTest: any
  ): number {
    let score = 100;

    // Deduct points for errors
    score -= validation.errors.length * 20;

    // Deduct points for warnings
    score -= validation.warnings.length * 5;

    // Deduct points for render test failure
    if (!renderTest.success) {
      score -= 30;
    }

    // Bonus points for good capabilities
    if (capabilities) {
      if (capabilities.supportsSystemMessages) score += 5;
      if (capabilities.supportsStreaming) score += 5;
      if (capabilities.supportsTools) score += 5;
      if (capabilities.maxContextLength && capabilities.maxContextLength > 50000) score += 10;
    }

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }
}

// Singleton instance
let templateValidationServiceInstance: TemplateValidationService | null = null;

/**
 * Initialize the Template Validation Service
 */
export function initializeTemplateValidationService(config?: TemplateValidationConfig): TemplateValidationService {
  if (!templateValidationServiceInstance) {
    templateValidationServiceInstance = new TemplateValidationService(config);
    logger.info('Template Validation Service initialized');
  }
  return templateValidationServiceInstance;
}

/**
 * Get the Template Validation Service instance
 */
export function getTemplateValidationService(): TemplateValidationService {
  if (!templateValidationServiceInstance) {
    throw new AppError(
      'Template Validation Service not initialized',
      500,
      ErrorCode.SERVICE_UNAVAILABLE
    );
  }
  return templateValidationServiceInstance;
}