import { templateAuditService } from './template-audit.js';

export interface SecurityValidationResult {
  isSecure: boolean;
  violations: SecurityViolation[];
  warnings: SecurityWarning[];
  riskScore: number; // 0-100, higher is more risky
}

export interface SecurityViolation {
  type: SecurityViolationType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  location?: {
    line?: number;
    column?: number;
    context?: string;
  };
  suggestion?: string;
}

export interface SecurityWarning {
  type: string;
  message: string;
  suggestion?: string;
}

export enum SecurityViolationType {
  CODE_INJECTION = 'CODE_INJECTION',
  SCRIPT_INJECTION = 'SCRIPT_INJECTION',
  COMMAND_INJECTION = 'COMMAND_INJECTION',
  SQL_INJECTION = 'SQL_INJECTION',
  TEMPLATE_INJECTION = 'TEMPLATE_INJECTION',
  SENSITIVE_DATA_EXPOSURE = 'SENSITIVE_DATA_EXPOSURE',
  UNSAFE_VARIABLE = 'UNSAFE_VARIABLE',
  MALICIOUS_PATTERN = 'MALICIOUS_PATTERN',
  EXCESSIVE_COMPLEXITY = 'EXCESSIVE_COMPLEXITY',
  UNSAFE_FUNCTION_CALL = 'UNSAFE_FUNCTION_CALL'
}

export class TemplateSecurityService {
  private readonly maxTemplateLength = 50000; // 50KB limit
  private readonly maxVariableCount = 100;
  private readonly maxNestingDepth = 10;

  /**
   * Comprehensive security validation for template content
   */
  async validateTemplateContent(
    content: string,
    variables: any[] = [],
    userId?: string
  ): Promise<SecurityValidationResult> {
    const violations: SecurityViolation[] = [];
    const warnings: SecurityWarning[] = [];
    let riskScore = 0;

    try {
      // Basic content validation
      this.validateBasicContent(content, violations, warnings);
      
      // Code injection detection
      this.detectCodeInjection(content, violations);
      
      // Script injection detection
      this.detectScriptInjection(content, violations);
      
      // Command injection detection
      this.detectCommandInjection(content, violations);
      
      // SQL injection patterns
      this.detectSQLInjection(content, violations);
      
      // Template injection detection
      this.detectTemplateInjection(content, violations);
      
      // Sensitive data exposure
      this.detectSensitiveDataExposure(content, violations, warnings);
      
      // Variable security validation
      this.validateVariableSecurity(variables, violations, warnings);
      
      // Malicious pattern detection
      this.detectMaliciousPatterns(content, violations);
      
      // Complexity analysis
      this.analyzeComplexity(content, violations, warnings);
      
      // Calculate risk score
      riskScore = this.calculateRiskScore(violations, warnings);
      
      const result: SecurityValidationResult = {
        isSecure: violations.length === 0,
        violations,
        warnings,
        riskScore
      };

      // Log security validation for audit
      if (userId) {
        await templateAuditService.logOperation({
          userId,
          userRole: 'unknown', // Will be filled by middleware
          operation: 'TEMPLATE_SECURITY_VALIDATION',
          details: {
            contentLength: content.length,
            variableCount: variables.length,
            riskScore,
            violationCount: violations.length,
            warningCount: warnings.length
          },
          success: result.isSecure
        });
      }

      return result;
    } catch (error) {
      console.error('Template security validation failed:', error);
      
      return {
        isSecure: false,
        violations: [{
          type: SecurityViolationType.MALICIOUS_PATTERN,
          severity: 'CRITICAL',
          message: 'Security validation failed due to internal error',
          suggestion: 'Contact system administrator'
        }],
        warnings: [],
        riskScore: 100
      };
    }
  }

  /**
   * Sanitize template content by removing or escaping dangerous patterns
   */
  sanitizeTemplateContent(content: string): string {
    let sanitized = content;

    // Remove or escape dangerous HTML/JavaScript
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    
    // Remove dangerous template expressions
    sanitized = sanitized.replace(/\{\{\s*constructor\s*\}\}/gi, '');
    sanitized = sanitized.replace(/\{\{\s*__proto__\s*\}\}/gi, '');
    
    // Escape potential command injection
    sanitized = sanitized.replace(/`([^`]*)`/g, (match, content) => {
      return '`' + content.replace(/[$\\]/g, '\\$&') + '`';
    });

    return sanitized;
  }

  /**
   * Monitor template usage for security anomalies
   */
  async monitorTemplateUsage(
    templateId: string,
    userId: string,
    executionContext: Record<string, any>
  ): Promise<void> {
    try {
      // Check for suspicious patterns in execution context
      const suspiciousPatterns = this.detectSuspiciousUsage(executionContext);
      
      if (suspiciousPatterns.length > 0) {
        await templateAuditService.logOperation({
          userId,
          userRole: 'unknown',
          operation: 'SUSPICIOUS_TEMPLATE_USAGE',
          templateId,
          details: {
            suspiciousPatterns,
            executionContext: this.sanitizeContextForLogging(executionContext)
          },
          success: false,
          errorMessage: 'Suspicious template usage detected'
        });

        // Could trigger alerts here
        console.warn(`Suspicious template usage detected for template ${templateId} by user ${userId}`);
      }
    } catch (error) {
      console.error('Template usage monitoring failed:', error);
    }
  }

  private validateBasicContent(content: string, violations: SecurityViolation[], warnings: SecurityWarning[]): void {
    // Length validation
    if (content.length > this.maxTemplateLength) {
      violations.push({
        type: SecurityViolationType.EXCESSIVE_COMPLEXITY,
        severity: 'MEDIUM',
        message: `Template exceeds maximum length of ${this.maxTemplateLength} characters`,
        suggestion: 'Reduce template size or split into multiple templates'
      });
    }

    // Check for null bytes
    if (content.includes('\0')) {
      violations.push({
        type: SecurityViolationType.MALICIOUS_PATTERN,
        severity: 'HIGH',
        message: 'Template contains null bytes',
        suggestion: 'Remove null bytes from template content'
      });
    }

    // Check for excessive line length
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 1000) {
        warnings.push({
          type: 'LONG_LINE',
          message: `Line ${i + 1} is excessively long (${lines[i].length} characters)`,
          suggestion: 'Consider breaking long lines for better readability'
        });
      }
    }
  }

  private detectCodeInjection(content: string, violations: SecurityViolation[]): void {
    const codeInjectionPatterns = [
      // JavaScript execution
      { pattern: /eval\s*\(/gi, message: 'Potential JavaScript eval() injection' },
      { pattern: /Function\s*\(/gi, message: 'Potential Function constructor injection' },
      { pattern: /setTimeout\s*\(/gi, message: 'Potential setTimeout injection' },
      { pattern: /setInterval\s*\(/gi, message: 'Potential setInterval injection' },
      
      // Node.js specific
      { pattern: /require\s*\(/gi, message: 'Potential Node.js require() injection' },
      { pattern: /process\./gi, message: 'Potential Node.js process object access' },
      { pattern: /global\./gi, message: 'Potential Node.js global object access' },
      
      // Template engine injection
      { pattern: /\{\{\s*constructor\s*\}\}/gi, message: 'Potential constructor injection' },
      { pattern: /\{\{\s*__proto__\s*\}\}/gi, message: 'Potential prototype pollution' },
    ];

    for (const { pattern, message } of codeInjectionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        violations.push({
          type: SecurityViolationType.CODE_INJECTION,
          severity: 'CRITICAL',
          message,
          suggestion: 'Remove or escape the dangerous code pattern'
        });
      }
    }
  }

  private detectScriptInjection(content: string, violations: SecurityViolation[]): void {
    const scriptPatterns = [
      { pattern: /<script\b[^>]*>/gi, message: 'HTML script tag detected' },
      { pattern: /javascript:/gi, message: 'JavaScript protocol detected' },
      { pattern: /on\w+\s*=/gi, message: 'HTML event handler detected' },
      { pattern: /<iframe\b[^>]*>/gi, message: 'HTML iframe tag detected' },
      { pattern: /<object\b[^>]*>/gi, message: 'HTML object tag detected' },
      { pattern: /<embed\b[^>]*>/gi, message: 'HTML embed tag detected' },
    ];

    for (const { pattern, message } of scriptPatterns) {
      if (pattern.test(content)) {
        violations.push({
          type: SecurityViolationType.SCRIPT_INJECTION,
          severity: 'HIGH',
          message,
          suggestion: 'Remove HTML/JavaScript content or properly escape it'
        });
      }
    }
  }

  private detectCommandInjection(content: string, violations: SecurityViolation[]): void {
    const commandPatterns = [
      { pattern: /`[^`]*`/g, message: 'Template literal with potential command execution' },
      { pattern: /\$\([^)]*\)/g, message: 'Command substitution pattern detected' },
      { pattern: /;\s*(rm|del|format|shutdown|reboot)/gi, message: 'Dangerous system command detected' },
      { pattern: /\|\s*(curl|wget|nc|netcat)/gi, message: 'Network command in pipe detected' },
    ];

    for (const { pattern, message } of commandPatterns) {
      if (pattern.test(content)) {
        violations.push({
          type: SecurityViolationType.COMMAND_INJECTION,
          severity: 'HIGH',
          message,
          suggestion: 'Remove command execution patterns'
        });
      }
    }
  }

  private detectSQLInjection(content: string, violations: SecurityViolation[]): void {
    const sqlPatterns = [
      { pattern: /'\s*(OR|AND)\s*'?\d*'?\s*=\s*'?\d*'?/gi, message: 'SQL injection pattern detected' },
      { pattern: /UNION\s+SELECT/gi, message: 'SQL UNION injection pattern detected' },
      { pattern: /DROP\s+TABLE/gi, message: 'SQL DROP TABLE command detected' },
      { pattern: /DELETE\s+FROM/gi, message: 'SQL DELETE command detected' },
      { pattern: /INSERT\s+INTO/gi, message: 'SQL INSERT command detected' },
      { pattern: /UPDATE\s+\w+\s+SET/gi, message: 'SQL UPDATE command detected' },
    ];

    for (const { pattern, message } of sqlPatterns) {
      if (pattern.test(content)) {
        violations.push({
          type: SecurityViolationType.SQL_INJECTION,
          severity: 'HIGH',
          message,
          suggestion: 'Remove SQL commands or use parameterized queries'
        });
      }
    }
  }

  private detectTemplateInjection(content: string, violations: SecurityViolation[]): void {
    const templatePatterns = [
      { pattern: /\{\{\s*config\s*\}\}/gi, message: 'Template config access detected' },
      { pattern: /\{\{\s*request\s*\}\}/gi, message: 'Template request object access detected' },
      { pattern: /\{\{\s*response\s*\}\}/gi, message: 'Template response object access detected' },
      { pattern: /\{\{\s*session\s*\}\}/gi, message: 'Template session access detected' },
    ];

    for (const { pattern, message } of templatePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        violations.push({
          type: SecurityViolationType.TEMPLATE_INJECTION,
          severity: 'MEDIUM',
          message,
          suggestion: 'Avoid accessing sensitive objects in templates'
        });
      }
    }
  }

  private detectSensitiveDataExposure(content: string, violations: SecurityViolation[], warnings: SecurityWarning[]): void {
    const sensitivePatterns = [
      { pattern: /password\s*[:=]\s*['"]\w+['"]/gi, message: 'Hardcoded password detected', severity: 'CRITICAL' as const },
      { pattern: /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9_-]+['"]/gi, message: 'Hardcoded API key detected', severity: 'CRITICAL' as const },
      { pattern: /secret\s*[:=]\s*['"]\w+['"]/gi, message: 'Hardcoded secret detected', severity: 'CRITICAL' as const },
      { pattern: /token\s*[:=]\s*['"]\w+['"]/gi, message: 'Hardcoded token detected', severity: 'HIGH' as const },
      { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, message: 'Credit card number pattern detected', severity: 'HIGH' as const },
      { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, message: 'SSN pattern detected', severity: 'HIGH' as const },
    ];

    for (const { pattern, message, severity } of sensitivePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        violations.push({
          type: SecurityViolationType.SENSITIVE_DATA_EXPOSURE,
          severity,
          message,
          suggestion: 'Remove sensitive data and use variables instead'
        });
      }
    }

    // Check for email addresses (warning only)
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatches = content.match(emailPattern);
    if (emailMatches) {
      warnings.push({
        type: 'EMAIL_EXPOSURE',
        message: 'Email addresses detected in template',
        suggestion: 'Consider using variables for email addresses'
      });
    }
  }

  private validateVariableSecurity(variables: any[], violations: SecurityViolation[], warnings: SecurityWarning[]): void {
    if (variables.length > this.maxVariableCount) {
      violations.push({
        type: SecurityViolationType.EXCESSIVE_COMPLEXITY,
        severity: 'MEDIUM',
        message: `Too many variables (${variables.length}), maximum allowed: ${this.maxVariableCount}`,
        suggestion: 'Reduce the number of variables or split template'
      });
    }

    for (const variable of variables) {
      if (typeof variable === 'object' && variable.name) {
        // Check for dangerous variable names
        const dangerousNames = ['constructor', '__proto__', 'prototype', 'eval', 'function'];
        if (dangerousNames.includes(variable.name.toLowerCase())) {
          violations.push({
            type: SecurityViolationType.UNSAFE_VARIABLE,
            severity: 'HIGH',
            message: `Dangerous variable name: ${variable.name}`,
            suggestion: 'Use a different variable name'
          });
        }

        // Check for overly complex variable definitions
        if (variable.validation && Array.isArray(variable.validation) && variable.validation.length > 10) {
          warnings.push({
            type: 'COMPLEX_VARIABLE',
            message: `Variable ${variable.name} has many validation rules`,
            suggestion: 'Consider simplifying variable validation'
          });
        }
      }
    }
  }

  private detectMaliciousPatterns(content: string, violations: SecurityViolation[]): void {
    const maliciousPatterns = [
      { pattern: /\.\.\//g, message: 'Directory traversal pattern detected' },
      { pattern: /file:\/\//gi, message: 'File protocol URL detected' },
      { pattern: /data:.*base64/gi, message: 'Base64 data URL detected' },
      { pattern: /%[0-9a-f]{2}/gi, message: 'URL encoded characters detected' },
    ];

    for (const { pattern, message } of maliciousPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        violations.push({
          type: SecurityViolationType.MALICIOUS_PATTERN,
          severity: 'MEDIUM',
          message,
          suggestion: 'Remove or properly validate the suspicious pattern'
        });
      }
    }
  }

  private analyzeComplexity(content: string, violations: SecurityViolation[], warnings: SecurityWarning[]): void {
    // Check nesting depth
    const nestingDepth = this.calculateNestingDepth(content);
    if (nestingDepth > this.maxNestingDepth) {
      violations.push({
        type: SecurityViolationType.EXCESSIVE_COMPLEXITY,
        severity: 'MEDIUM',
        message: `Template nesting too deep (${nestingDepth}), maximum: ${this.maxNestingDepth}`,
        suggestion: 'Reduce template complexity or split into multiple templates'
      });
    }

    // Check for excessive variable usage
    const variableMatches = content.match(/\{\{[^}]+\}\}/g) || [];
    if (variableMatches.length > 50) {
      warnings.push({
        type: 'HIGH_VARIABLE_USAGE',
        message: `High number of variable references (${variableMatches.length})`,
        suggestion: 'Consider reducing variable usage for better performance'
      });
    }
  }

  private calculateNestingDepth(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    
    for (let i = 0; i < content.length - 1; i++) {
      if (content.substring(i, i + 2) === '{{') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
        i++; // Skip next character
      } else if (content.substring(i, i + 2) === '}}') {
        currentDepth = Math.max(0, currentDepth - 1);
        i++; // Skip next character
      }
    }
    
    return maxDepth;
  }

  private calculateRiskScore(violations: SecurityViolation[], warnings: SecurityWarning[]): number {
    let score = 0;
    
    for (const violation of violations) {
      switch (violation.severity) {
        case 'CRITICAL': score += 25; break;
        case 'HIGH': score += 15; break;
        case 'MEDIUM': score += 8; break;
        case 'LOW': score += 3; break;
      }
    }
    
    // Add minor score for warnings
    score += warnings.length * 2;
    
    return Math.min(100, score);
  }

  private detectSuspiciousUsage(context: Record<string, any>): string[] {
    const suspicious: string[] = [];
    
    // Check for suspicious variable values
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        if (value.includes('<script>') || value.includes('javascript:')) {
          suspicious.push(`Suspicious script content in variable: ${key}`);
        }
        if (value.includes('eval(') || value.includes('Function(')) {
          suspicious.push(`Code execution pattern in variable: ${key}`);
        }
      }
    }
    
    return suspicious;
  }

  private sanitizeContextForLogging(context: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        // Truncate long strings and remove sensitive patterns
        let sanitizedValue = value.substring(0, 200);
        sanitizedValue = sanitizedValue.replace(/password\s*[:=]\s*['"]\w+['"]/gi, 'password=***');
        sanitizedValue = sanitizedValue.replace(/api[_-]?key\s*[:=]\s*['"]\w+['"]/gi, 'api_key=***');
        sanitized[key] = sanitizedValue;
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
}

// Singleton instance for application use
export const templateSecurityService = new TemplateSecurityService();