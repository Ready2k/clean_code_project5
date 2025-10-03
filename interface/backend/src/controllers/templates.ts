/**
 * Template Management API Controller
 * 
 * Handles REST endpoints for provider template CRUD operations,
 * template application, preview, and customization. Includes admin
 * authentication and authorization checks.
 */

import { Request, Response } from 'express';
import Joi from 'joi';
import { getDynamicProviderService } from '../services/dynamic-provider-service.js';
import { getTemplateManagementService } from '../services/template-management-service.js';
import { ValidationError, NotFoundError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import {
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ApplyTemplateRequest,
  TemplateQueryOptions
} from '../types/dynamic-providers.js';
import { 
  getAllProviderTemplates, 
  getProviderTemplate, 
  searchProviderTemplates 
} from '../data/provider-templates.js';

// ============================================================================
// Validation Schemas
// ============================================================================

const providerTemplateConfigSchema = Joi.object({
  identifier: Joi.string().pattern(/^[a-z0-9-_]+$/).min(2).max(50).required(),
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  apiEndpoint: Joi.string().uri().required(),
  authMethod: Joi.string().valid('api_key', 'oauth2', 'aws_iam', 'custom').required(),
  authConfig: Joi.object({
    type: Joi.string().valid('api_key', 'oauth2', 'aws_iam', 'custom').required(),
    fields: Joi.object().pattern(Joi.string(), Joi.object({
      required: Joi.boolean().required(),
      description: Joi.string().required(),
      default: Joi.string().optional(),
      sensitive: Joi.boolean().optional(),
      placeholder: Joi.string().optional(),
      validation: Joi.object({
        pattern: Joi.string().optional(),
        minLength: Joi.number().optional(),
        maxLength: Joi.number().optional(),
        options: Joi.array().items(Joi.string()).optional()
      }).optional()
    })).required(),
    headers: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
    testEndpoint: Joi.string().uri().optional()
  }).required(),
  capabilities: Joi.object({
    supportsSystemMessages: Joi.boolean().required(),
    maxContextLength: Joi.number().integer().min(1).required(),
    supportedRoles: Joi.array().items(Joi.string()).min(1).required(),
    supportsStreaming: Joi.boolean().required(),
    supportsTools: Joi.boolean().required(),
    supportedAuthMethods: Joi.array().items(Joi.string().valid('api_key', 'oauth2', 'aws_iam', 'custom')).min(1).required(),
    rateLimits: Joi.object({
      requestsPerMinute: Joi.number().integer().min(1).optional(),
      tokensPerMinute: Joi.number().integer().min(1).optional(),
      requestsPerDay: Joi.number().integer().min(1).optional(),
      tokensPerDay: Joi.number().integer().min(1).optional()
    }).optional()
  }).required()
});

const modelTemplateConfigSchema = Joi.object({
  identifier: Joi.string().pattern(/^[a-zA-Z0-9-_.]+$/).min(1).max(100).required(),
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  contextLength: Joi.number().integer().min(1).required(),
  capabilities: Joi.object({
    supportsSystemMessages: Joi.boolean().required(),
    maxContextLength: Joi.number().integer().min(1).required(),
    supportedRoles: Joi.array().items(Joi.string()).min(1).required(),
    supportsStreaming: Joi.boolean().required(),
    supportsTools: Joi.boolean().required(),
    supportsFunctionCalling: Joi.boolean().required(),
    supportsVision: Joi.boolean().optional(),
    supportsAudio: Joi.boolean().optional(),
    supportsImageGeneration: Joi.boolean().optional(),
    supportsCodeExecution: Joi.boolean().optional()
  }).required(),
  pricingInfo: Joi.object({
    inputTokenPrice: Joi.number().min(0).optional(),
    outputTokenPrice: Joi.number().min(0).optional(),
    imagePrice: Joi.number().min(0).optional(),
    audioPrice: Joi.number().min(0).optional(),
    currency: Joi.string().length(3).optional(),
    billingUnit: Joi.string().optional()
  }).optional(),
  isDefault: Joi.boolean().optional()
});

const createTemplateSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  providerConfig: providerTemplateConfigSchema.required(),
  defaultModels: Joi.array().items(modelTemplateConfigSchema).min(1).required()
});

const updateTemplateSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).allow('').optional(),
  providerConfig: providerTemplateConfigSchema.optional(),
  defaultModels: Joi.array().items(modelTemplateConfigSchema).optional()
});

const applyTemplateSchema = Joi.object({
  templateId: Joi.string().required(),
  customizations: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    description: Joi.string().max(1000).optional(),
    authConfig: Joi.object().pattern(Joi.string(), Joi.any()).optional(),
    selectedModels: Joi.array().items(Joi.string()).optional(),
    providerIdentifier: Joi.string().pattern(/^[a-z0-9-_]+$/).min(2).max(50).optional()
  }).optional()
});

const templateQuerySchema = Joi.object({
  isSystem: Joi.boolean().optional(),
  search: Joi.string().max(100).optional(),
  category: Joi.string().max(50).optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sortBy: Joi.string().valid('name', 'createdAt', 'updatedAt').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').optional()
});

// ============================================================================
// Template CRUD Operations
// ============================================================================

/**
 * Create a new provider template
 * POST /api/admin/provider-templates
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

  logger.info('Creating provider template', {
    name: request.name,
    createdBy,
    ip: req.ip
  });

  try {
    const templateService = getTemplateManagementService();
    const template = await templateService.createTemplate(request, createdBy);

    logger.info('Provider template created successfully', {
      templateId: template.id,
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
    logger.error('Failed to create provider template:', error);
    throw error;
  }
};

/**
 * Get all provider templates
 * GET /api/admin/provider-templates
 */
export const getTemplates = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = templateQuerySchema.validate(req.query);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const options: TemplateQueryOptions = value;

  try {
    // Get predefined system templates
    let predefinedTemplates = getAllProviderTemplates();
    
    // Apply search filter to predefined templates if provided
    if (options.search) {
      predefinedTemplates = searchProviderTemplates(options.search);
    }

    // Get custom templates from the service
    const templateService = getTemplateManagementService();
    const customResult = await templateService.getTemplates(options);

    // Combine templates
    const allTemplates = [...predefinedTemplates, ...customResult.templates];
    
    // Apply pagination to combined results
    const page = options.page || 1;
    const limit = options.limit || 50;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTemplates = allTemplates.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        templates: paginatedTemplates,
        total: allTemplates.length,
        page,
        limit,
        predefined: predefinedTemplates.length,
        custom: customResult.total
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get provider templates:', error);
    throw error;
  }
};

/**
 * Get system templates (built-in templates)
 * GET /api/admin/provider-templates/system
 */
export const getSystemTemplates = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get predefined system templates
    const predefinedTemplates = getAllProviderTemplates();
    
    // Also get any custom system templates from the service
    const templateService = getTemplateManagementService();
    const customSystemTemplates = await templateService.getSystemTemplates();

    // Combine both sets of templates
    const allSystemTemplates = [...predefinedTemplates, ...customSystemTemplates];

    res.json({
      success: true,
      data: {
        templates: allSystemTemplates,
        total: allSystemTemplates.length,
        predefined: predefinedTemplates.length,
        custom: customSystemTemplates.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get system templates:', error);
    throw error;
  }
};

/**
 * Get a specific template by ID
 * GET /api/admin/provider-templates/:id
 */
export const getTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  try {
    // First check predefined templates
    let template = getProviderTemplate(id);
    
    if (!template) {
      // If not found in predefined, check custom templates
      const templateService = getTemplateManagementService();
      template = await templateService.getTemplate(id);
    }

    if (!template) {
      throw new NotFoundError(`Template with ID ${id} not found`);
    }

    res.json({
      success: true,
      data: { 
        template,
        isPredefined: !!getProviderTemplate(id)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Failed to get template:', error);
    throw error;
  }
};

/**
 * Update a template
 * PUT /api/admin/provider-templates/:id
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

  logger.info('Updating provider template', {
    templateId: id,
    updatedFields: Object.keys(request),
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const templateService = getTemplateManagementService();
    const template = await templateService.updateTemplate(id, request);

    logger.info('Provider template updated successfully', {
      templateId: id,
      userId: req.user?.userId,
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
 * DELETE /api/admin/provider-templates/:id
 */
export const deleteTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  logger.info('Deleting provider template', {
    templateId: id,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const templateService = getTemplateManagementService();
    await templateService.deleteTemplate(id);

    logger.info('Provider template deleted successfully', {
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
// Template Application and Preview
// ============================================================================

/**
 * Apply a template to create a new provider
 * POST /api/admin/provider-templates/:id/apply
 */
export const applyTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  const { error, value } = applyTemplateSchema.validate({ templateId: id, ...req.body });
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const request: ApplyTemplateRequest = value;
  const createdBy = req.user?.userId;

  logger.info('Applying provider template', {
    templateId: id,
    customizations: Object.keys(request.customizations || {}),
    createdBy,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const provider = await dynamicProviderService.applyTemplate(request, createdBy);

    logger.info('Provider template applied successfully', {
      templateId: id,
      providerId: provider.id,
      providerIdentifier: provider.identifier,
      createdBy,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: { provider },
      message: 'Template applied successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to apply template:', error);
    throw error;
  }
};

/**
 * Preview template application without creating provider
 * POST /api/admin/provider-templates/:id/preview
 */
export const previewTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  const { error, value } = applyTemplateSchema.validate({ templateId: id, ...req.body });
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const request: ApplyTemplateRequest = value;

  logger.info('Previewing provider template', {
    templateId: id,
    customizations: Object.keys(request.customizations || {}),
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const templateService = getTemplateManagementService();
    const preview = await templateService.previewTemplate(request);

    res.json({
      success: true,
      data: { preview },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to preview template:', error);
    throw error;
  }
};

/**
 * Get template customization options
 * GET /api/admin/provider-templates/:id/customization-options
 */
export const getTemplateCustomizationOptions = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  try {
    const templateService = getTemplateManagementService();
    const options = await templateService.getCustomizationOptions(id);

    res.json({
      success: true,
      data: { options },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get template customization options:', error);
    throw error;
  }
};

// ============================================================================
// Template Categories and Management
// ============================================================================

/**
 * Get template categories
 * GET /api/admin/provider-templates/categories
 */
export const getTemplateCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const templateService = getTemplateManagementService();
    const categories = await templateService.getTemplateCategories();

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
 * Clone an existing template
 * POST /api/admin/provider-templates/:id/clone
 */
export const cloneTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ValidationError('Template name is required');
  }

  const createdBy = req.user?.userId;

  logger.info('Cloning provider template', {
    sourceTemplateId: id,
    newName: name,
    createdBy,
    ip: req.ip
  });

  try {
    const templateService = getTemplateManagementService();
    const clonedTemplate = await templateService.cloneTemplate(id, {
      name: name.trim(),
      description: description?.trim() || undefined
    }, createdBy);

    logger.info('Provider template cloned successfully', {
      sourceTemplateId: id,
      clonedTemplateId: clonedTemplate.id,
      newName: name,
      createdBy,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: { template: clonedTemplate },
      message: 'Template cloned successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to clone template:', error);
    throw error;
  }
};

/**
 * Export template configuration
 * GET /api/admin/provider-templates/:id/export
 */
export const exportTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { format = 'json' } = req.query;

  if (!id) {
    throw new ValidationError('Template ID is required');
  }

  if (!['json', 'yaml'].includes(format as string)) {
    throw new ValidationError('Format must be json or yaml');
  }

  logger.info('Exporting provider template', {
    templateId: id,
    format,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const templateService = getTemplateManagementService();
    const exportData = await templateService.exportTemplate(id, format as 'json' | 'yaml');

    // Set appropriate content type and filename
    const contentType = format === 'yaml' ? 'application/x-yaml' : 'application/json';
    const filename = `template-${id}.${format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    if (format === 'yaml') {
      res.send(exportData);
    } else {
      res.json(exportData);
    }

    logger.info('Provider template exported successfully', {
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
 * POST /api/admin/provider-templates/import
 */
export const importTemplate = async (req: Request, res: Response): Promise<void> => {
  const { templateData, overwrite = false } = req.body;

  if (!templateData) {
    throw new ValidationError('Template data is required');
  }

  const createdBy = req.user?.userId;

  logger.info('Importing provider template', {
    overwrite,
    createdBy,
    ip: req.ip
  });

  try {
    const templateService = getTemplateManagementService();
    const importedTemplate = await templateService.importTemplate(templateData, {
      overwrite,
      ...(createdBy && { createdBy })
    });

    logger.info('Provider template imported successfully', {
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