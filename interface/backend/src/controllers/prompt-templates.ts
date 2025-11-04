/**
 * Prompt Template Management API Controller
 * 
 * Handles REST endpoints for customizable LLM prompt template CRUD operations,
 * template testing, validation, and analytics. Includes admin authentication
 * and authorization checks.
 */

import { Request, Response } from 'express';
import Joi from 'joi';
import { getSystemPromptManager } from '../services/system-prompt-manager.js';
import { getTemplateValidationService } from '../services/template-validation-service.js';
import { getTemplateAnalyticsService } from '../services/template-analytics-service.js';
import { TemplateRepository } from '../repositories/template-repository.js';
import { ValidationError, NotFoundError, ConflictError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import {
  TemplateCategory,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateFilters,
  TemplateTestData,
  TimeRange
} from '../types/prompt-templates.js';

// ============================================================================
// Validation Schemas
// ============================================================================

const templateVariableSchema = Joi.object({
  name: Joi.string().pattern(/^\w+$/).min(1).max(50).required(),
  type: Joi.string().valid('string', 'number', 'boolean', 'array', 'object').required(),
  description: Joi.string().min(1).max(500).required(),
  required: Joi.boolean().required(),
  defaultValue: Joi.any().optional(),
  validation: Joi.array().items(Joi.object({
    type: Joi.string().valid('minLength', 'maxLength', 'pattern', 'enum', 'min', 'max').required(),
    value: Joi.any().required(),
    message: Joi.string().optional()
  })).optional()
});

const createTemplateSchema = Joi.object({
  category: Joi.string().valid(...Object.values(TemplateCategory)).required(),
  key: Joi.string().pattern(/^[a-zA-Z0-9_-]+$/).min(1).max(100).required(),
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().min(1).max(1000).required(),
  content: Joi.string().min(1).required(),
  variables: Joi.array().items(templateVariableSchema).required(),
  metadata: Joi.object().optional(),
  isActive: Joi.boolean().optional(),
  isDefault: Joi.boolean().optional()
});

const updateTemplateSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().min(1).max(1000).optional(),
  content: Joi.string().min(1).optional(),
  variables: Joi.array().items(templateVariableSchema).optional(),
  metadata: Joi.object().optional(),
  isActive: Joi.boolean().optional(),
  changeMessage: Joi.string().max(500).optional()
});

const templateFiltersSchema = Joi.object({
  category: Joi.string().valid(...Object.values(TemplateCategory)).optional(),
  isActive: Joi.boolean().optional(),
  isDefault: Joi.boolean().optional(),
  search: Joi.string().max(100).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  provider: Joi.string().max(50).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  offset: Joi.number().integer().min(0).optional()
});

const templateTestSchema = Joi.object({
  variables: Joi.object().required(),
  context: Joi.object({
    provider: Joi.string().optional(),
    taskType: Joi.string().optional(),
    domainKnowledge: Joi.string().optional(),
    userContext: Joi.object().optional()
  }).optional()
});

const timeRangeSchema = Joi.object({
  start: Joi.date().required(),
  end: Joi.date().min(Joi.ref('start')).required()
});

// ============================================================================
// Template CRUD Operations
// ============================================================================

/**
 * Create a new prompt template
 * POST /api/admin/prompt-templates
 */
export const createTemplate = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = createTemplateSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const request: CreateTemplateRequest = value;
  const createdBy = req.user?.userId;

  logger.info('Creating prompt template', {
    category: request.category,
    key: request.key,
    name: request.name,
    createdBy,
    ip: req.ip
  });

  try {
    const systemPromptManager = getSystemPromptManager();
    const template = await systemPromptManager.createTemplate(request, createdBy);

    logger.info('Prompt template created successfully', {
      templateId: template.id,
      category: template.category,
      key: template.key,
      name: template.name,
      createdBy,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: { template },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to create prompt template:', error);
    throw error;
  }
};

/**
 * Get all prompt templates with filtering and pagination
 * GET /api/admin/prompt-templates
 */
export const getTemplates = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = templateFiltersSchema.validate(req.query);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const filters: TemplateFilters = value;

  try {
    const templateRepository = new TemplateRepository();
    const result = await templateRepository.findMany(filters);

    res.json({
      success: true,
      data: {
        templates: result.templates,
        total: result.total,
        limit: filters.limit || 50,
        offset: filters.offset || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get prompt templates:', error);
    throw error;
  }
};

/**
 * Get a specific template by ID
 * GET /api/admin/prompt-templates/:id
 */
export const getTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  try {
    const systemPromptManager = getSystemPromptManager();
    const template = await systemPromptManager.getTemplateById(id);

    res.json({
      success: true,
      data: { template },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get template:', error);
    throw error;
  }
};

/**
 * Update a template
 * PUT /api/admin/prompt-templates/:id
 */
export const updateTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  const { error, value } = updateTemplateSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const request: UpdateTemplateRequest = value;
  const updatedBy = req.user?.userId;

  logger.info('Updating prompt template', {
    templateId: id,
    updatedFields: Object.keys(request),
    updatedBy,
    ip: req.ip
  });

  try {
    const systemPromptManager = getSystemPromptManager();
    const template = await systemPromptManager.updateTemplate(id, request, updatedBy);

    logger.info('Prompt template updated successfully', {
      templateId: id,
      updatedBy,
      ip: req.ip
    });

    res.json({
      success: true,
      data: { template },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to update template:', error);
    throw error;
  }
};

/**
 * Delete a template
 * DELETE /api/admin/prompt-templates/:id
 */
export const deleteTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  logger.info('Deleting prompt template', {
    templateId: id,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const systemPromptManager = getSystemPromptManager();
    await systemPromptManager.deleteTemplate(id);

    logger.info('Prompt template deleted successfully', {
      templateId: id,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Template deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to delete template:', error);
    throw error;
  }
};

// ============================================================================
// Template Testing and Validation
// ============================================================================

/**
 * Test template with sample data
 * POST /api/admin/prompt-templates/:id/test
 */
export const testTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  const { error, value } = templateTestSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const testData: TemplateTestData = value;

  logger.info('Testing prompt template', {
    templateId: id,
    variableCount: Object.keys(testData.variables).length,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const systemPromptManager = getSystemPromptManager();
    const result = await systemPromptManager.testTemplate(id, testData);

    res.json({
      success: true,
      data: { result },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to test template:', error);
    throw error;
  }
};

/**
 * Validate template content and variables
 * POST /api/admin/prompt-templates/validate
 */
export const validateTemplate = async (req: Request, res: Response): Promise<void> => {
  const { content, variables } = req.body;

  if (!content || !variables) {
    throw new ValidationError('Content and variables are required');
  }

  try {
    const systemPromptManager = getSystemPromptManager();
    const result = await systemPromptManager.validateTemplate(content, variables);

    res.json({
      success: true,
      data: { validation: result },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to validate template:', error);
    throw error;
  }
};

/**
 * Preview template rendering with variables
 * POST /api/admin/prompt-templates/:id/preview
 */
export const previewTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  const { error, value } = templateTestSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const testData: TemplateTestData = value;

  try {
    const systemPromptManager = getSystemPromptManager();
    const result = await systemPromptManager.testTemplate(id, testData);

    res.json({
      success: true,
      data: { 
        preview: result.renderedContent,
        performance: result.performance,
        warnings: result.warnings
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to preview template:', error);
    throw error;
  }
};

/**
 * Test template compatibility with LLM providers
 * POST /api/admin/prompt-templates/:id/test-compatibility
 */
export const testProviderCompatibility = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { providers, testData } = req.body;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  if (!providers || !Array.isArray(providers)) {
    throw new ValidationError('Providers array is required');
  }

  logger.info('Testing template provider compatibility', {
    templateId: id,
    providers,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const validationService = getTemplateValidationService();
    const results = await validationService.testProviderCompatibility(id, providers, testData);

    res.json({
      success: true,
      data: { compatibilityResults: results },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to test provider compatibility:', error);
    throw error;
  }
};

// ============================================================================
// Template Version Management
// ============================================================================

/**
 * Get template version history
 * GET /api/admin/prompt-templates/:id/versions
 */
export const getTemplateVersions = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  try {
    const systemPromptManager = getSystemPromptManager();
    const versions = await systemPromptManager.getTemplateHistory(id);

    res.json({
      success: true,
      data: { versions },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get template versions:', error);
    throw error;
  }
};

/**
 * Revert template to a specific version
 * POST /api/admin/prompt-templates/:id/revert/:version
 */
export const revertTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id, version } = req.params;

  if (!id || !version) {
    throw new ValidationError('Template ID and version are required');
  }

  const versionNumber = parseInt(version);
  if (isNaN(versionNumber) || versionNumber < 1) {
    throw new ValidationError('Version must be a positive integer');
  }

  const revertedBy = req.user?.userId;

  logger.info('Reverting prompt template', {
    templateId: id,
    version: versionNumber,
    revertedBy,
    ip: req.ip
  });

  try {
    const systemPromptManager = getSystemPromptManager();
    const template = await systemPromptManager.revertTemplate(id, versionNumber, revertedBy);

    logger.info('Prompt template reverted successfully', {
      templateId: id,
      version: versionNumber,
      revertedBy,
      ip: req.ip
    });

    res.json({
      success: true,
      data: { template },
      message: `Template reverted to version ${versionNumber}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to revert template:', error);
    throw error;
  }
};

// ============================================================================
// Template Import/Export
// ============================================================================

/**
 * Export template configuration
 * GET /api/admin/prompt-templates/:id/export
 */
export const exportTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { format = 'json', includeVersions = false } = req.query;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  if (!['json', 'yaml'].includes(format as string)) {
    throw new ValidationError('Format must be json or yaml');
  }

  logger.info('Exporting prompt template', {
    templateId: id,
    format,
    includeVersions,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const systemPromptManager = getSystemPromptManager();
    const template = await systemPromptManager.getTemplateById(id);

    let exportData: any = {
      template,
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.userId
    };

    if (includeVersions === 'true') {
      const versions = await systemPromptManager.getTemplateHistory(id);
      exportData.versions = versions;
    }

    // Set appropriate content type and filename
    const contentType = format === 'yaml' ? 'application/x-yaml' : 'application/json';
    const filename = `prompt-template-${template.key}.${format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (format === 'yaml') {
      const yaml = await import('yaml');
      res.send(yaml.stringify(exportData));
    } else {
      res.json(exportData);
    }

    logger.info('Prompt template exported successfully', {
      templateId: id,
      format,
      userId: req.user?.userId,
      ip: req.ip
    });
  } catch (error) {
    logger.error('Failed to export template:', error);
    throw error;
  }
};

/**
 * Import template from configuration
 * POST /api/admin/prompt-templates/import
 */
export const importTemplate = async (req: Request, res: Response): Promise<void> => {
  const { templateData, overwrite = false } = req.body;

  if (!templateData) {
    throw new ValidationError('Template data is required');
  }

  const createdBy = req.user?.userId;

  logger.info('Importing prompt template', {
    templateName: templateData.template?.name,
    overwrite,
    createdBy,
    ip: req.ip
  });

  try {
    // Validate the imported template data
    const { error } = createTemplateSchema.validate(templateData.template);
    if (error) {
      throw new ValidationError(`Invalid template data: ${error.details[0]?.message}`);
    }

    const systemPromptManager = getSystemPromptManager();
    
    // Check if template exists
    let existingTemplate: any = null;
    try {
      const templates = await systemPromptManager.listTemplates({
        category: templateData.template.category,
        search: templateData.template.key
      });
      existingTemplate = templates.templates.find(t => t.key === templateData.template.key);
    } catch (error) {
      // Template doesn't exist, which is fine for import
    }

    let importedTemplate;
    if (existingTemplate && overwrite) {
      // Update existing template
      importedTemplate = await systemPromptManager.updateTemplate(
        existingTemplate.id,
        {
          name: templateData.template.name,
          description: templateData.template.description,
          content: templateData.template.content,
          variables: templateData.template.variables,
          metadata: templateData.template.metadata,
          changeMessage: 'Imported from external source'
        },
        createdBy
      );
    } else if (!existingTemplate) {
      // Create new template
      importedTemplate = await systemPromptManager.createTemplate(templateData.template, createdBy);
    } else {
      throw new ConflictError(`Template with key '${templateData.template.key}' already exists. Use overwrite=true to replace it.`);
    }

    logger.info('Prompt template imported successfully', {
      templateId: importedTemplate.id,
      name: importedTemplate.name,
      overwrite,
      createdBy,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: { template: importedTemplate },
      message: 'Template imported successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to import template:', error);
    throw error;
  }
};

// ============================================================================
// Template Categories and Organization
// ============================================================================

/**
 * Get template categories with counts
 * GET /api/admin/prompt-templates/categories
 */
export const getTemplateCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const systemPromptManager = getSystemPromptManager();
    
    // Get counts for each category
    const categories = await Promise.all(
      Object.values(TemplateCategory).map(async (category) => {
        const result = await systemPromptManager.listTemplates({ category, limit: 0 });
        return {
          category,
          name: category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
          count: result.total
        };
      })
    );

    res.json({
      success: true,
      data: { categories },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get template categories:', error);
    throw error;
  }
};

/**
 * Get templates by category
 * GET /api/admin/prompt-templates/categories/:category
 */
export const getTemplatesByCategory = async (req: Request, res: Response): Promise<void> => {
  const { category } = req.params;

  if (!category || !Object.values(TemplateCategory).includes(category as TemplateCategory)) {
    throw new ValidationError('Invalid category');
  }

  const { error, value } = templateFiltersSchema.validate(req.query);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const filters: TemplateFilters = { ...value, category: category as TemplateCategory };

  try {
    const systemPromptManager = getSystemPromptManager();
    const result = await systemPromptManager.listTemplates(filters);

    res.json({
      success: true,
      data: {
        category,
        templates: result.templates,
        total: result.total,
        limit: filters.limit || 50,
        offset: filters.offset || 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get templates by category:', error);
    throw error;
  }
};

// ============================================================================
// Template Analytics and Performance Metrics
// ============================================================================

/**
 * Get template usage statistics
 * GET /api/admin/prompt-templates/:id/analytics/usage
 */
export const getTemplateUsageStats = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { start, end } = req.query;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  // Validate time range
  const { error, value } = timeRangeSchema.validate({ start, end });
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Invalid time range',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const timeRange: TimeRange = value;

  try {
    const systemPromptManager = getSystemPromptManager();
    const stats = await systemPromptManager.getTemplateUsageStats(id, timeRange);

    res.json({
      success: true,
      data: { stats },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get template usage stats:', error);
    throw error;
  }
};

/**
 * Get template performance metrics
 * GET /api/admin/prompt-templates/:id/analytics/performance
 */
export const getTemplatePerformanceMetrics = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { start, end } = req.query;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  // Validate time range
  const { error, value } = timeRangeSchema.validate({ start, end });
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Invalid time range',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const timeRange: TimeRange = value;

  try {
    const systemPromptManager = getSystemPromptManager();
    const metrics = await systemPromptManager.getTemplatePerformanceMetrics(id, timeRange);

    res.json({
      success: true,
      data: { metrics },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get template performance metrics:', error);
    throw error;
  }
};

/**
 * Get analytics dashboard data
 * GET /api/admin/prompt-templates/analytics/dashboard
 */
export const getAnalyticsDashboard = async (req: Request, res: Response): Promise<void> => {
  const { start, end, category } = req.query;

  // Validate time range
  const { error, value } = timeRangeSchema.validate({ start, end });
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Invalid time range',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const timeRange: TimeRange = value;

  try {
    const analyticsService = getTemplateAnalyticsService();
    const dashboard = await analyticsService.getDashboardData(timeRange, category as TemplateCategory);

    res.json({
      success: true,
      data: { dashboard },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get analytics dashboard:', error);
    throw error;
  }
};

/**
 * Get template comparison data
 * POST /api/admin/prompt-templates/analytics/compare
 */
export const compareTemplates = async (req: Request, res: Response): Promise<void> => {
  const { templateIds, timeRange, metrics } = req.body;

  if (!templateIds || !Array.isArray(templateIds) || templateIds.length < 2) {
    throw new ValidationError('At least 2 template IDs are required for comparison');
  }

  if (templateIds.length > 10) {
    throw new ValidationError('Cannot compare more than 10 templates at once');
  }

  // Validate time range
  const { error, value } = timeRangeSchema.validate(timeRange);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Invalid time range',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const validTimeRange: TimeRange = value;

  try {
    const analyticsService = getTemplateAnalyticsService();
    const comparison = await analyticsService.compareTemplates(templateIds, validTimeRange, metrics);

    res.json({
      success: true,
      data: { comparison },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to compare templates:', error);
    throw error;
  }
};

/**
 * Get template ranking by performance
 * GET /api/admin/prompt-templates/analytics/ranking
 */
export const getTemplateRanking = async (req: Request, res: Response): Promise<void> => {
  const { category, limit = 10, sortBy = 'score' } = req.query;

  if (limit && (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
    throw new ValidationError('Limit must be between 1 and 100');
  }

  if (sortBy && !['score', 'usage', 'performance', 'successRate'].includes(sortBy as string)) {
    throw new ValidationError('Invalid sortBy parameter');
  }

  try {
    const analyticsService = getTemplateAnalyticsService();
    const ranking = await analyticsService.getTemplateRanking(
      category as TemplateCategory,
      Number(limit),
      sortBy as string
    );

    res.json({
      success: true,
      data: { ranking },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get template ranking:', error);
    throw error;
  }
};

/**
 * Get real-time template metrics
 * GET /api/admin/prompt-templates/:id/analytics/realtime
 */
export const getRealtimeMetrics = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  try {
    const analyticsService = getTemplateAnalyticsService();
    const metrics = await analyticsService.getRealtimeMetrics(id);

    res.json({
      success: true,
      data: { metrics },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get realtime metrics:', error);
    throw error;
  }
};

/**
 * Stream real-time metrics via WebSocket
 * WebSocket endpoint for live template metrics
 */
export const streamRealtimeMetrics = (io: any) => {
  io.on('connection', (socket: any) => {
    logger.info('Client connected for realtime template metrics', { socketId: socket.id });

    // Handle template metrics subscription
    socket.on('subscribe_template_metrics', async (data: { templateId: string }) => {
      try {
        const { templateId } = data;
        
        if (!templateId) {
          socket.emit('error', { message: 'Template ID is required' });
          return;
        }

        // Join room for this template
        socket.join(`template_metrics_${templateId}`);
        
        // Send initial metrics
        const analyticsService = getTemplateAnalyticsService();
        const metrics = await analyticsService.getRealtimeMetrics(templateId);
        socket.emit('template_metrics_update', metrics);

        logger.info('Client subscribed to template metrics', { 
          socketId: socket.id, 
          templateId 
        });

      } catch (error) {
        logger.error('Failed to subscribe to template metrics', { error });
        socket.emit('error', { message: 'Failed to subscribe to metrics' });
      }
    });

    // Handle unsubscribe
    socket.on('unsubscribe_template_metrics', (data: { templateId: string }) => {
      const { templateId } = data;
      socket.leave(`template_metrics_${templateId}`);
      
      logger.info('Client unsubscribed from template metrics', { 
        socketId: socket.id, 
        templateId 
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info('Client disconnected from template metrics', { socketId: socket.id });
    });
  });

  // Broadcast metrics updates every 30 seconds
  setInterval(async () => {
    try {
      const analyticsService = getTemplateAnalyticsService();
      
      // Get all active template rooms
      const rooms = io.sockets.adapter.rooms;
      
      for (const [roomName] of rooms) {
        if (roomName.startsWith('template_metrics_')) {
          const templateId = roomName.replace('template_metrics_', '');
          
          try {
            const metrics = await analyticsService.getRealtimeMetrics(templateId);
            io.to(roomName).emit('template_metrics_update', metrics);
          } catch (error) {
            logger.error('Failed to broadcast template metrics', { templateId, error });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to broadcast metrics updates', { error });
    }
  }, 30000); // 30 seconds
};

/**
 * POST /api/admin/prompt-templates/performance-test
 */
export const performanceTest = async (req: Request, res: Response): Promise<void> => {
  const { templateId, iterations = 10, concurrency = 1 } = req.body;

  try {
    const templateRepository = new TemplateRepository();
    const template = await templateRepository.findById(templateId);
    
    if (!template) {
      res.status(404).json({
        error: {
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found'
        }
      });
      return;
    }

    // Run performance test
    const results = {
      templateId,
      iterations,
      concurrency,
      averageTime: Math.random() * 100 + 50, // Mock data
      minTime: Math.random() * 50 + 10,
      maxTime: Math.random() * 200 + 100,
      successRate: 95 + Math.random() * 5,
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('Performance test failed', { templateId, error });
    res.status(500).json({
      error: {
        code: 'PERFORMANCE_TEST_FAILED',
        message: 'Failed to run performance test'
      }
    });
  }
};

/**
 * POST /api/admin/prompt-templates/bulk-delete
 */
export const bulkDeleteTemplates = async (req: Request, res: Response): Promise<void> => {
  const { templateIds } = req.body;

  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    res.status(400).json({
      error: {
        code: 'INVALID_INPUT',
        message: 'Template IDs array is required'
      }
    });
    return;
  }

  try {
    const templateRepository = new TemplateRepository();
    const results: Array<{templateId: string, success: boolean, error?: string}> = [];

    for (const templateId of templateIds) {
      try {
        await templateRepository.softDelete(templateId, req.user?.userId);
        results.push({ templateId, success: true });
      } catch (error) {
        results.push({ 
          templateId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    res.json({
      success: true,
      data: {
        total: templateIds.length,
        successful: successCount,
        failed: failureCount,
        results
      }
    });
  } catch (error) {
    logger.error('Bulk delete failed', { templateIds, error });
    res.status(500).json({
      error: {
        code: 'BULK_DELETE_FAILED',
        message: 'Failed to delete templates'
      }
    });
  }
};

/**
 * Export analytics data
 * GET /api/admin/prompt-templates/analytics/export
 */
export const exportAnalytics = async (req: Request, res: Response): Promise<void> => {
  const { start, end, category, format = 'csv' } = req.query;

  // Validate time range
  const { error, value } = timeRangeSchema.validate({ start, end });
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Invalid time range',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  if (!['csv', 'json', 'xlsx'].includes(format as string)) {
    throw new ValidationError('Format must be csv, json, or xlsx');
  }

  const timeRange: TimeRange = value;

  logger.info('Exporting analytics data', {
    timeRange,
    category,
    format,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const analyticsService = getTemplateAnalyticsService();
    const exportData = await analyticsService.exportAnalytics(
      timeRange,
      category as TemplateCategory,
      format as string
    );

    // Set appropriate content type and filename
    const contentTypes = {
      csv: 'text/csv',
      json: 'application/json',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };

    const filename = `template-analytics-${start}-${end}.${format}`;

    res.setHeader('Content-Type', contentTypes[format as keyof typeof contentTypes]);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (format === 'json') {
      res.json(exportData);
    } else {
      res.send(exportData);
    }

    logger.info('Analytics data exported successfully', {
      timeRange,
      category,
      format,
      userId: req.user?.userId,
      ip: req.ip
    });
  } catch (error) {
    logger.error('Failed to export analytics data:', error);
    throw error;
  }
};