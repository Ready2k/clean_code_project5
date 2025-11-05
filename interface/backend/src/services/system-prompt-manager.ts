/**
 * System Prompt Manager Service
 * 
 * Central service for managing all LLM prompt templates with CRUD operations,
 * template retrieval with caching and fallback mechanisms, template rendering
 * with variable substitution, and template versioning and history management.
 */

import { getDatabaseService } from './database-service.js';
import { getRedisService } from './redis-service.js';
import { logger } from '../utils/logger.js';
import { AppError, ValidationError, NotFoundError, ConflictError, ErrorCode } from '../types/errors.js';
import {
  TemplateCategory,
  TemplateInfo,
  TemplateMetadata,
  TemplateVariable,
  TemplateContext,
  TemplateFilters,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateTestData,
  TemplateTestResult,
  TemplateVersion,
  ValidationResult,
  ValidationError as TemplateValidationError,
  UsageStats,
  PerformanceMetrics,
  TimeRange,
  DefaultTemplate
} from '../types/prompt-templates.js';

export interface SystemPromptManagerConfig {
  cachePrefix?: string;
  defaultCacheTtl?: number;
  enableVersioning?: boolean;
  enableUsageTracking?: boolean;
}

/**
 * System Prompt Manager Service
 */
export class SystemPromptManager {
  private db = getDatabaseService();
  private redis = getRedisService();
  private config: Required<SystemPromptManagerConfig>;

  constructor(config: SystemPromptManagerConfig = {}) {
    this.config = {
      cachePrefix: 'prompt_template:',
      defaultCacheTtl: 3600, // 1 hour
      enableVersioning: true,
      enableUsageTracking: true,
      ...config
    };
  }

  /**
   * Helper function to safely parse JSON or return object if already parsed
   * This handles PostgreSQL JSONB columns that are automatically parsed by the driver
   */
  private safeJsonParse(value: any, defaultValue: any) {
    if (value === null || value === undefined) {
      return defaultValue;
    }
    if (typeof value === 'object') {
      return value; // Already parsed by PostgreSQL JSONB
    }
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        // Log the error with more context for debugging
        console.warn('Failed to parse JSON value in SystemPromptManager:', {
          value: typeof value === 'string' ? value.substring(0, 100) : value,
          error: error instanceof Error ? error.message : String(error),
          defaultValue
        });
        return defaultValue;
      }
    }
    // Handle unexpected types gracefully
    console.warn('Unexpected value type in safeJsonParse:', {
      type: typeof value,
      value: value,
      defaultValue
    });
    return defaultValue;
  }

  /**
   * Helper function to safely parse metadata with proper default structure
   */
  private safeParseMetadata(value: any): TemplateMetadata {
    const defaultMetadata: TemplateMetadata = {
      provider_optimized: [],
      task_types: [],
      complexity_level: 'basic',
      tags: []
    };

    const parsed = this.safeJsonParse(value, defaultMetadata);
    
    // Ensure the parsed object has the required structure
    return {
      provider_optimized: parsed.provider_optimized || [],
      task_types: parsed.task_types || [],
      complexity_level: parsed.complexity_level || 'basic',
      tags: parsed.tags || [],
      ...parsed // Include any additional properties
    };
  }

  // ============================================================================
  // Template Management
  // ============================================================================

  /**
   * Get template by category and key with caching and fallback
   */
  async getTemplate(category: TemplateCategory, key: string, context?: TemplateContext): Promise<string> {
    const cacheKey = this.getCacheKey(category, key);
    
    try {
      // Try cache first
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const template = JSON.parse(cached) as TemplateInfo;
        return this.renderTemplate(template.content, template.variables, context);
      }

      // Load from database
      const template = await this.getTemplateFromDb(category, key);
      
      // Cache the template
      await this.redis.setex(cacheKey, this.config.defaultCacheTtl, JSON.stringify(template));
      
      // Track usage if enabled
      if (this.config.enableUsageTracking) {
        await this.trackUsage(template.id, context);
      }

      return this.renderTemplate(template.content, template.variables, context);

    } catch (error) {
      if (error instanceof NotFoundError) {
        // Try fallback to default template
        try {
          const defaultTemplate = await this.getDefaultTemplate(category, key);
          if (defaultTemplate) {
            logger.warn(`Using default template for ${category}/${key}`, { error: error.message });
            return this.renderTemplate(defaultTemplate.content, defaultTemplate.variables, context);
          }
        } catch (fallbackError) {
          logger.error('Failed to load default template', { category, key, error: fallbackError });
        }
      }
      
      logger.error('Failed to get template', { category, key, error });
      throw error;
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(request: CreateTemplateRequest, createdBy?: string): Promise<TemplateInfo> {
    logger.info('Creating template', { category: request.category, key: request.key, name: request.name });

    try {
      // Validate request
      this.validateCreateRequest(request);

      // Check if template already exists
      try {
        await this.getTemplateFromDb(request.category, request.key);
        throw new ConflictError(`Template with category '${request.category}' and key '${request.key}' already exists`);
      } catch (error) {
        if (!(error instanceof NotFoundError)) {
          throw error;
        }
      }

      // Validate template content and variables
      const validationResult = await this.validateTemplate(request.content, request.variables);
      if (!validationResult.isValid) {
        throw new ValidationError(`Template validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
      }

      const templateId = this.generateTemplateId();
      const now = new Date();

      // Insert template
      const result = await this.db.query(`
        INSERT INTO prompt_templates (
          id, category, key, name, description, content, variables, metadata,
          is_active, is_default, created_at, updated_at, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        templateId,
        request.category,
        request.key,
        request.name,
        request.description,
        request.content,
        JSON.stringify(request.variables),
        JSON.stringify(request.metadata || {}),
        request.isActive !== false,
        request.isDefault || false,
        now,
        now,
        createdBy,
        createdBy
      ]);

      const template = this.mapDbRowToTemplate(result.rows[0]);

      // Create initial version if versioning is enabled
      if (this.config.enableVersioning) {
        await this.createTemplateVersion(template.id, template.content, template.variables, template.metadata, 'Initial version', createdBy);
      }

      // Invalidate cache
      await this.invalidateTemplateCache(request.category, request.key);

      logger.info('Template created successfully', { templateId: template.id, name: template.name });
      return template;

    } catch (error) {
      logger.error('Failed to create template', { request, error });
      throw error;
    }
  }

  /**
   * Update a template
   */
  async updateTemplate(id: string, request: UpdateTemplateRequest, updatedBy?: string): Promise<TemplateInfo> {
    logger.info('Updating template', { templateId: id });

    try {
      // Get current template
      const currentTemplate = await this.getTemplateById(id);

      // Validate update request
      if (request.content && request.variables) {
        const validationResult = await this.validateTemplate(request.content, request.variables);
        if (!validationResult.isValid) {
          throw new ValidationError(`Template validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
        }
      }

      const now = new Date();
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      // Build dynamic update query
      if (request.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(request.name);
      }
      if (request.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        updateValues.push(request.description);
      }
      if (request.content !== undefined) {
        updateFields.push(`content = $${paramIndex++}`);
        updateValues.push(request.content);
      }
      if (request.variables !== undefined) {
        updateFields.push(`variables = $${paramIndex++}`);
        updateValues.push(JSON.stringify(request.variables));
      }
      if (request.metadata !== undefined) {
        updateFields.push(`metadata = $${paramIndex++}`);
        updateValues.push(JSON.stringify(request.metadata));
      }
      if (request.isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        updateValues.push(request.isActive);
      }

      updateFields.push(`updated_at = $${paramIndex++}`);
      updateValues.push(now);
      updateFields.push(`updated_by = $${paramIndex++}`);
      updateValues.push(updatedBy);

      // Add WHERE clause
      updateValues.push(id);

      const result = await this.db.query(`
        UPDATE prompt_templates 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, updateValues);

      if (result.rows.length === 0) {
        throw new NotFoundError(`Template with id '${id}' not found`);
      }

      const updatedTemplate = this.mapDbRowToTemplate(result.rows[0]);

      // Create version if versioning is enabled and content changed
      if (this.config.enableVersioning && (request.content || request.variables)) {
        const nextVersion = await this.getNextVersionNumber(id);
        await this.createTemplateVersion(
          id,
          updatedTemplate.content,
          updatedTemplate.variables,
          updatedTemplate.metadata,
          request.changeMessage || 'Template updated',
          updatedBy
        );
      }

      // Invalidate cache
      await this.invalidateTemplateCache(currentTemplate.category, currentTemplate.key);

      logger.info('Template updated successfully', { templateId: id });
      return updatedTemplate;

    } catch (error) {
      logger.error('Failed to update template', { templateId: id, error });
      throw error;
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    logger.info('Deleting template', { templateId: id });

    try {
      // Get template to check if it's a default template
      const template = await this.getTemplateById(id);
      
      if (template.isDefault) {
        throw new ValidationError('Cannot delete default template');
      }

      // Delete template (cascade will handle versions)
      const result = await this.db.query('DELETE FROM prompt_templates WHERE id = $1', [id]);
      
      if (result.rowCount === 0) {
        throw new NotFoundError(`Template with id '${id}' not found`);
      }

      // Invalidate cache
      await this.invalidateTemplateCache(template.category, template.key);

      logger.info('Template deleted successfully', { templateId: id });

    } catch (error) {
      logger.error('Failed to delete template', { templateId: id, error });
      throw error;
    }
  }

  /**
   * List templates with filtering
   */
  async listTemplates(filters: TemplateFilters = {}): Promise<{ templates: TemplateInfo[]; total: number }> {
    try {
      const whereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Build WHERE conditions
      if (filters.category) {
        whereConditions.push(`category = $${paramIndex++}`);
        queryParams.push(filters.category);
      }
      if (filters.isActive !== undefined) {
        whereConditions.push(`is_active = $${paramIndex++}`);
        queryParams.push(filters.isActive);
      }
      if (filters.isDefault !== undefined) {
        whereConditions.push(`is_default = $${paramIndex++}`);
        queryParams.push(filters.isDefault);
      }
      if (filters.search) {
        whereConditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`);
        queryParams.push(`%${filters.search}%`);
        paramIndex++;
      }
      if (filters.provider) {
        whereConditions.push(`metadata->>'provider_optimized' ? $${paramIndex++}`);
        queryParams.push(filters.provider);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      // Get total count
      const countResult = await this.db.query(`
        SELECT COUNT(*) as total FROM prompt_templates ${whereClause}
      `, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get templates with pagination
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;
      
      const templatesResult = await this.db.query(`
        SELECT * FROM prompt_templates 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `, [...queryParams, limit, offset]);

      const templates = templatesResult.rows.map(row => this.mapDbRowToTemplate(row));

      return { templates, total };

    } catch (error) {
      logger.error('Failed to list templates', { filters, error });
      throw new AppError('Failed to list templates', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  // ============================================================================
  // Template Rendering
  // ============================================================================

  /**
   * Render template with variable substitution
   */
  private renderTemplate(content: string, variables: TemplateVariable[], context?: TemplateContext): string {
    let rendered = content;
    const variableMap = new Map(variables.map(v => [v.name, v]));

    // Replace template variables with context values
    rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      const variable = variableMap.get(variableName);
      if (!variable) {
        logger.warn(`Unknown variable in template: ${variableName}`);
        return match; // Keep original if variable not defined
      }

      // Get value from context or use default
      let value = context?.userContext?.[variableName] ?? variable.defaultValue;
      
      // Handle special context variables
      if (variableName === 'provider' && context?.provider) {
        value = context.provider;
      } else if (variableName === 'taskType' && context?.taskType) {
        value = context.taskType;
      } else if (variableName === 'domainKnowledge' && context?.domainKnowledge) {
        value = context.domainKnowledge;
      }

      if (value === undefined || value === null) {
        if (variable.required) {
          throw new ValidationError(`Required variable '${variableName}' not provided`);
        }
        return ''; // Return empty string for optional variables
      }

      return String(value);
    });

    return rendered;
  }

  /**
   * Public method to render template content (for preview functionality)
   */
  async renderTemplateContent(content: string, variables: TemplateVariable[], context?: TemplateContext): Promise<string> {
    return this.renderTemplate(content, variables, context);
  }

  // ============================================================================
  // Template Validation
  // ============================================================================

  /**
   * Validate template content and variables
   */
  async validateTemplate(content: string, variables: TemplateVariable[]): Promise<ValidationResult> {
    const errors: TemplateValidationError[] = [];
    const warnings: any[] = [];

    try {
      // Validate syntax
      const syntaxResult = this.validateSyntax(content);
      errors.push(...syntaxResult.errors);
      warnings.push(...syntaxResult.warnings);

      // Validate variables
      const variableResult = this.validateVariables(content, variables);
      errors.push(...variableResult.errors);
      warnings.push(...variableResult.warnings);

      // Validate security
      const securityResult = this.validateSecurity(content);
      errors.push(...securityResult.errors);
      warnings.push(...securityResult.warnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
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

  /**
   * Validate template syntax
   */
  private validateSyntax(content: string): ValidationResult {
    const errors: TemplateValidationError[] = [];
    const warnings: any[] = [];

    // Check for balanced braces
    const braceMatches = content.match(/\{\{|\}\}/g);
    if (braceMatches) {
      let openCount = 0;
      for (const match of braceMatches) {
        if (match === '{{') {
          openCount++;
        } else {
          openCount--;
          if (openCount < 0) {
            errors.push({
              type: 'SYNTAX_ERROR',
              message: 'Unmatched closing braces }}'
            });
            break;
          }
        }
      }
      if (openCount > 0) {
        errors.push({
          type: 'SYNTAX_ERROR',
          message: 'Unmatched opening braces {{'
        });
      }
    }

    // Check for valid variable syntax
    const variablePattern = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = variablePattern.exec(content)) !== null) {
      const variableName = match[1];
      if (!variableName || variableName.length === 0) {
        errors.push({
          type: 'SYNTAX_ERROR',
          message: 'Empty variable name in template'
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate template variables
   */
  private validateVariables(content: string, variables: TemplateVariable[]): ValidationResult {
    const errors: TemplateValidationError[] = [];
    const warnings: any[] = [];

    const variableMap = new Map(variables.map(v => [v.name, v]));
    const usedVariables = new Set<string>();

    // Find all variables used in content
    const variablePattern = /\{\{(\w+)\}\}/g;
    let match;
    while ((match = variablePattern.exec(content)) !== null) {
      const variableName = match[1];
      usedVariables.add(variableName);

      if (!variableMap.has(variableName)) {
        errors.push({
          type: 'MISSING_VARIABLE',
          message: `Variable '${variableName}' used in template but not defined`
        });
      }
    }

    // Check for unused variables
    for (const variable of variables) {
      if (!usedVariables.has(variable.name)) {
        warnings.push({
          type: 'UNUSED_VARIABLE',
          message: `Variable '${variable.name}' defined but not used in template`
        });
      }
    }

    // Validate variable definitions
    for (const variable of variables) {
      if (!variable.name || variable.name.trim().length === 0) {
        errors.push({
          type: 'INVALID_VARIABLE',
          message: 'Variable name cannot be empty'
        });
      }

      if (!/^\w+$/.test(variable.name)) {
        errors.push({
          type: 'INVALID_VARIABLE',
          message: `Invalid variable name '${variable.name}'. Must contain only letters, numbers, and underscores`
        });
      }

      if (variable.required && variable.defaultValue !== undefined) {
        warnings.push({
          type: 'PERFORMANCE_CONCERN',
          message: `Required variable '${variable.name}' has a default value, which may be confusing`
        });
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate template security
   */
  private validateSecurity(content: string): ValidationResult {
    const errors: TemplateValidationError[] = [];
    const warnings: any[] = [];

    // Check for potential code injection patterns
    const dangerousPatterns = [
      /eval\s*\(/i,
      /function\s*\(/i,
      /javascript:/i,
      /<script/i,
      /on\w+\s*=/i, // onclick, onload, etc.
      /\$\{.*\}/g, // Template literals
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        errors.push({
          type: 'SECURITY_VIOLATION',
          message: 'Template contains potentially dangerous code patterns'
        });
        break;
      }
    }

    // Check for sensitive data patterns
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /credential/i
    ];

    for (const pattern of sensitivePatterns) {
      if (pattern.test(content)) {
        warnings.push({
          type: 'SECURITY_CONCERN',
          message: 'Template may contain references to sensitive data'
        });
        break;
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  // ============================================================================
  // Template Testing
  // ============================================================================

  /**
   * Test template with sample data
   */
  async testTemplate(templateId: string, testData: TemplateTestData): Promise<TemplateTestResult> {
    const startTime = Date.now();

    try {
      const template = await this.getTemplateById(templateId);
      
      // Validate test data against template variables
      const validationResult = await this.validateTestData(template.variables, testData.variables);
      if (!validationResult.isValid) {
        return {
          success: false,
          renderedContent: '',
          errors: validationResult.errors,
          warnings: validationResult.warnings
        };
      }

      // Create context with test data
      const context: TemplateContext = {
        ...testData.context,
        userContext: testData.variables
      };

      // Render template
      const renderedContent = this.renderTemplate(template.content, template.variables, context);
      const renderTime = Date.now() - startTime;

      return {
        success: true,
        renderedContent,
        warnings: validationResult.warnings,
        performance: {
          renderTime,
          variableSubstitutions: Object.keys(testData.variables).length
        }
      };

    } catch (error) {
      logger.error('Template test failed', { templateId, error });
      return {
        success: false,
        renderedContent: '',
        errors: [{
          type: 'SYNTAX_ERROR',
          message: error instanceof Error ? error.message : 'Template test failed'
        }]
      };
    }
  }

  /**
   * Validate test data against template variables
   */
  private async validateTestData(variables: TemplateVariable[], testData: Record<string, any>): Promise<ValidationResult> {
    const errors: TemplateValidationError[] = [];
    const warnings: any[] = [];

    for (const variable of variables) {
      const value = testData[variable.name];

      if (variable.required && (value === undefined || value === null)) {
        errors.push({
          type: 'MISSING_VARIABLE',
          message: `Required variable '${variable.name}' not provided in test data`
        });
        continue;
      }

      if (value !== undefined && value !== null) {
        // Type validation
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (variable.type !== actualType && !(variable.type === 'object' && actualType === 'object')) {
          errors.push({
            type: 'INVALID_VARIABLE',
            message: `Variable '${variable.name}' expected type '${variable.type}' but got '${actualType}'`
          });
        }

        // Validation rules
        if (variable.validation) {
          for (const rule of variable.validation) {
            const ruleResult = this.validateRule(variable.name, value, rule);
            if (!ruleResult.isValid) {
              errors.push({
                type: 'INVALID_VARIABLE',
                message: ruleResult.message || `Variable '${variable.name}' failed validation rule '${rule.type}'`
              });
            }
          }
        }
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a single validation rule
   */
  private validateRule(variableName: string, value: any, rule: any): { isValid: boolean; message?: string } {
    switch (rule.type) {
      case 'minLength':
        if (typeof value === 'string' && value.length < rule.value) {
          return { isValid: false, message: `Variable '${variableName}' must be at least ${rule.value} characters long` };
        }
        break;
      case 'maxLength':
        if (typeof value === 'string' && value.length > rule.value) {
          return { isValid: false, message: `Variable '${variableName}' must be at most ${rule.value} characters long` };
        }
        break;
      case 'pattern':
        if (typeof value === 'string' && !new RegExp(rule.value).test(value)) {
          return { isValid: false, message: `Variable '${variableName}' does not match required pattern` };
        }
        break;
      case 'enum':
        if (!Array.isArray(rule.value) || !rule.value.includes(value)) {
          return { isValid: false, message: `Variable '${variableName}' must be one of: ${rule.value.join(', ')}` };
        }
        break;
      case 'min':
        if (typeof value === 'number' && value < rule.value) {
          return { isValid: false, message: `Variable '${variableName}' must be at least ${rule.value}` };
        }
        break;
      case 'max':
        if (typeof value === 'number' && value > rule.value) {
          return { isValid: false, message: `Variable '${variableName}' must be at most ${rule.value}` };
        }
        break;
    }
    return { isValid: true };
  }

  // ============================================================================
  // Version Management
  // ============================================================================

  /**
   * Get template history
   */
  async getTemplateHistory(templateId: string): Promise<TemplateVersion[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM prompt_template_versions 
        WHERE template_id = $1 
        ORDER BY version_number DESC
      `, [templateId]);

      return result.rows.map(row => ({
        id: row.id,
        templateId: row.template_id,
        versionNumber: row.version_number,
        content: row.content,
        variables: this.safeJsonParse(row.variables, []),
        metadata: this.safeJsonParse(row.metadata, {}),
        changeMessage: row.change_message,
        createdAt: row.created_at,
        createdBy: row.created_by
      }));

    } catch (error) {
      logger.error('Failed to get template history', { templateId, error });
      throw new AppError('Failed to get template history', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Revert template to previous version
   */
  async revertTemplate(templateId: string, version: number, revertedBy?: string): Promise<TemplateInfo> {
    logger.info('Reverting template', { templateId, version });

    try {
      // Get the version to revert to
      const versionResult = await this.db.query(`
        SELECT * FROM prompt_template_versions 
        WHERE template_id = $1 AND version_number = $2
      `, [templateId, version]);

      if (versionResult.rows.length === 0) {
        throw new NotFoundError(`Version ${version} not found for template ${templateId}`);
      }

      const versionData = versionResult.rows[0];

      // Update template with version data
      const updateRequest: UpdateTemplateRequest = {
        content: versionData.content,
        variables: this.safeJsonParse(versionData.variables, []),
        metadata: this.safeJsonParse(versionData.metadata, {}),
        changeMessage: `Reverted to version ${version}`
      };

      return await this.updateTemplate(templateId, updateRequest, revertedBy);

    } catch (error) {
      logger.error('Failed to revert template', { templateId, version, error });
      throw error;
    }
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  /**
   * Get template usage statistics
   */
  async getTemplateUsageStats(templateId: string, timeRange: TimeRange): Promise<UsageStats> {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_usage,
          COUNT(DISTINCT usage_context->>'userId') as unique_users,
          AVG(execution_time_ms) as avg_render_time,
          SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
        FROM prompt_template_usage 
        WHERE template_id = $1 
          AND created_at BETWEEN $2 AND $3
      `, [templateId, timeRange.start, timeRange.end]);

      const stats = result.rows[0];

      // Get usage by provider
      const providerResult = await this.db.query(`
        SELECT 
          usage_context->>'provider' as provider,
          COUNT(*) as count
        FROM prompt_template_usage 
        WHERE template_id = $1 
          AND created_at BETWEEN $2 AND $3
          AND usage_context->>'provider' IS NOT NULL
        GROUP BY usage_context->>'provider'
      `, [templateId, timeRange.start, timeRange.end]);

      const usageByProvider: Record<string, number> = {};
      for (const row of providerResult.rows) {
        usageByProvider[row.provider] = parseInt(row.count);
      }

      // Get usage by task type
      const taskTypeResult = await this.db.query(`
        SELECT 
          usage_context->>'taskType' as task_type,
          COUNT(*) as count
        FROM prompt_template_usage 
        WHERE template_id = $1 
          AND created_at BETWEEN $2 AND $3
          AND usage_context->>'taskType' IS NOT NULL
        GROUP BY usage_context->>'taskType'
      `, [templateId, timeRange.start, timeRange.end]);

      const usageByTaskType: Record<string, number> = {};
      for (const row of taskTypeResult.rows) {
        usageByTaskType[row.task_type] = parseInt(row.count);
      }

      return {
        templateId,
        totalUsage: parseInt(stats.total_usage || '0'),
        uniqueUsers: parseInt(stats.unique_users || '0'),
        averageRenderTime: parseFloat(stats.avg_render_time || '0'),
        successRate: parseFloat(stats.success_rate || '0'),
        timeRange,
        usageByProvider,
        usageByTaskType
      };

    } catch (error) {
      logger.error('Failed to get template usage stats', { templateId, timeRange, error });
      throw new AppError('Failed to get template usage statistics', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  /**
   * Get template performance metrics
   */
  async getTemplatePerformanceMetrics(templateId: string, timeRange: TimeRange): Promise<PerformanceMetrics> {
    try {
      const result = await this.db.query(`
        SELECT 
          AVG(execution_time_ms) as avg_render_time,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_render_time,
          SUM(CASE WHEN success THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate
        FROM prompt_template_usage 
        WHERE template_id = $1 
          AND created_at BETWEEN $2 AND $3
      `, [templateId, timeRange.start, timeRange.end]);

      const metrics = result.rows[0];

      // Calculate cache hit rate (would need to track cache hits/misses)
      // For now, return a placeholder value
      const cacheHitRate = 0.85; // 85% cache hit rate

      return {
        templateId,
        averageRenderTime: parseFloat(metrics.avg_render_time || '0'),
        p95RenderTime: parseFloat(metrics.p95_render_time || '0'),
        cacheHitRate,
        errorRate: 1 - parseFloat(metrics.success_rate || '1'),
        timeRange
      };

    } catch (error) {
      logger.error('Failed to get template performance metrics', { templateId, timeRange, error });
      throw new AppError('Failed to get template performance metrics', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get template from database
   */
  private async getTemplateFromDb(category: TemplateCategory, key: string): Promise<TemplateInfo> {
    const result = await this.db.query(`
      SELECT * FROM prompt_templates 
      WHERE category = $1 AND key = $2 AND is_active = true
    `, [category, key]);

    if (result.rows.length === 0) {
      throw new NotFoundError(`Template not found: ${category}/${key}`);
    }

    return this.mapDbRowToTemplate(result.rows[0]);
  }

  /**
   * Get template by ID
   */
  async getTemplateById(id: string): Promise<TemplateInfo> {
    try {
      const result = await this.db.query('SELECT * FROM prompt_templates WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError(`Template with id '${id}' not found`);
      }

      return this.mapDbRowToTemplate(result.rows[0]);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      // Log the error with context for debugging
      console.error('Error in getTemplateById:', {
        templateId: id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to retrieve template: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get default template
   */
  private async getDefaultTemplate(category: TemplateCategory, key: string): Promise<DefaultTemplate | null> {
    const result = await this.db.query(`
      SELECT * FROM prompt_templates 
      WHERE category = $1 AND key = $2 AND is_default = true
    `, [category, key]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      category: row.category,
      key: row.key,
      name: row.name,
      description: row.description,
      content: row.content,
      variables: this.safeJsonParse(row.variables, []),
      metadata: this.safeParseMetadata(row.metadata)
    };
  }

  /**
   * Map database row to TemplateInfo
   */
  private mapDbRowToTemplate(row: any): TemplateInfo {
    return {
      id: row.id,
      category: row.category,
      key: row.key,
      name: row.name,
      description: row.description,
      content: row.content,
      variables: this.safeJsonParse(row.variables, []),
      metadata: this.safeParseMetadata(row.metadata),
      isActive: row.is_active,
      isDefault: row.is_default,
      version: row.version || 1,
      lastModified: row.updated_at,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      usageCount: 0 // Would need to calculate from usage table
    };
  }

  /**
   * Generate unique template ID
   */
  private generateTemplateId(): string {
    return `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get cache key for template
   */
  private getCacheKey(category: TemplateCategory, key: string): string {
    return `${this.config.cachePrefix}${category}:${key}`;
  }

  /**
   * Invalidate template cache
   */
  private async invalidateTemplateCache(category: TemplateCategory, key: string): Promise<void> {
    const cacheKey = this.getCacheKey(category, key);
    await this.redis.del(cacheKey);
  }

  /**
   * Validate create request
   */
  private validateCreateRequest(request: CreateTemplateRequest): void {
    if (!request.category || !request.key || !request.name || !request.content) {
      throw new ValidationError('Missing required fields: category, key, name, content');
    }

    if (!Object.values(TemplateCategory).includes(request.category)) {
      throw new ValidationError(`Invalid category: ${request.category}`);
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(request.key)) {
      throw new ValidationError('Template key must contain only letters, numbers, hyphens, and underscores');
    }

    if (!Array.isArray(request.variables)) {
      throw new ValidationError('Variables must be an array');
    }
  }

  /**
   * Create template version
   */
  private async createTemplateVersion(
    templateId: string,
    content: string,
    variables: TemplateVariable[],
    metadata: any,
    changeMessage?: string,
    createdBy?: string
  ): Promise<void> {
    const versionNumber = await this.getNextVersionNumber(templateId);
    
    await this.db.query(`
      INSERT INTO prompt_template_versions (
        id, template_id, version_number, content, variables, metadata, 
        change_message, created_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      templateId,
      versionNumber,
      content,
      JSON.stringify(variables),
      JSON.stringify(metadata),
      changeMessage,
      new Date(),
      createdBy
    ]);
  }

  /**
   * Get next version number for template
   */
  private async getNextVersionNumber(templateId: string): Promise<number> {
    const result = await this.db.query(`
      SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
      FROM prompt_template_versions 
      WHERE template_id = $1
    `, [templateId]);

    return parseInt(result.rows[0].next_version);
  }

  /**
   * Track template usage
   */
  private async trackUsage(templateId: string, context?: TemplateContext): Promise<void> {
    if (!this.config.enableUsageTracking) {
      return;
    }

    try {
      await this.db.query(`
        INSERT INTO prompt_template_usage (
          id, template_id, usage_context, execution_time_ms, success, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        templateId,
        JSON.stringify(context || {}),
        0, // Would track actual render time
        true,
        new Date()
      ]);
    } catch (error) {
      logger.error('Failed to track template usage', { templateId, error });
      // Don't throw error for usage tracking failures
    }
  }
}

// Singleton instance
let systemPromptManagerInstance: SystemPromptManager | null = null;

/**
 * Initialize the System Prompt Manager service
 */
export function initializeSystemPromptManager(config?: SystemPromptManagerConfig): SystemPromptManager {
  if (!systemPromptManagerInstance) {
    systemPromptManagerInstance = new SystemPromptManager(config);
    logger.info('System Prompt Manager initialized');
  }
  return systemPromptManagerInstance;
}

/**
 * Get the System Prompt Manager service instance
 */
export function getSystemPromptManager(): SystemPromptManager {
  if (!systemPromptManagerInstance) {
    throw new AppError(
      'System Prompt Manager not initialized',
      500,
      ErrorCode.SERVICE_UNAVAILABLE
    );
  }
  return systemPromptManagerInstance;
}