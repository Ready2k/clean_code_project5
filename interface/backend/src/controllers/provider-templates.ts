/**
 * Provider Template Controller
 * 
 * Handles REST endpoints for provider template management including
 * listing templates, applying templates, and template validation.
 */

import { Request, Response } from 'express';
import Joi from 'joi';
import { 
  getAllProviderTemplates, 
  getProviderTemplate, 
  searchProviderTemplates 
} from '../data/provider-templates.js';
import { getDynamicProviderService } from '../services/dynamic-provider-service.js';
import { ValidationError, NotFoundError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import {
  ProviderTemplate,
  CreateProviderRequest,
  Provider
} from '../types/dynamic-providers.js';

// ============================================================================
// Validation Schemas
// ============================================================================

const templateQuerySchema = Joi.object({
  search: Joi.string().max(100).optional(),
  isSystem: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sortBy: Joi.string().valid('name', 'createdAt', 'updatedAt').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').optional()
});

const applyTemplateSchema = Joi.object({
  templateId: Joi.string().required(),
  customizations: Joi.object({
    identifier: Joi.string().pattern(/^[a-z0-9-_]+$/).min(2).max(50).optional(),
    name: Joi.string().min(1).max(255).optional(),
    description: Joi.string().max(1000).optional(),
    authConfig: Joi.object().optional(),
    selectedModels: Joi.array().items(Joi.string()).optional()
  }).optional()
});

// ============================================================================
// Template Operations
// ============================================================================

/**
 * Get all provider templates
 * GET /api/admin/provider-templates
 */
export const getTemplates = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = templateQuerySchema.validate(req.query);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Invalid query parameters',
      error.details[0]?.path?.join('.') || 'query'
    );
  }

  const { search, isSystem, page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = value;

  try {
    let templates = getAllProviderTemplates();

    // Apply search filter
    if (search) {
      templates = searchProviderTemplates(search);
    }

    // Apply system filter
    if (isSystem !== undefined) {
      templates = templates.filter(template => template.isSystem === isSystem);
    }

    // Apply sorting
    templates.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt);
          bValue = new Date(b.updatedAt);
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (sortOrder === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      } else {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
    });

    // Apply pagination
    const total = templates.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTemplates = templates.slice(startIndex, endIndex);

    logger.info(`Retrieved ${paginatedTemplates.length} provider templates (page ${page}/${Math.ceil(total / limit)})`);

    res.json({
      templates: paginatedTemplates,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error('Failed to get provider templates:', error);
    throw error;
  }
};

/**
 * Get a specific provider template
 * GET /api/admin/provider-templates/:id
 */
export const getTemplate = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const template = getProviderTemplate(id);
    
    if (!template) {
      throw new NotFoundError(`Provider template with ID ${id} not found`);
    }

    logger.info(`Retrieved provider template: ${template.name}`);

    res.json({
      template
    });
  } catch (error) {
    logger.error(`Failed to get provider template ${id}:`, error);
    throw error;
  }
};

/**
 * Apply a template to create a new provider
 * POST /api/admin/provider-templates/apply
 */
export const applyTemplate = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = applyTemplateSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.join('.') || 'body'
    );
  }

  const { templateId, customizations = {} } = value;

  try {
    const template = getProviderTemplate(templateId);
    
    if (!template) {
      throw new NotFoundError(`Provider template with ID ${templateId} not found`);
    }

    // Create provider request from template
    const providerRequest: CreateProviderRequest = {
      identifier: customizations.identifier || template.providerConfig.name.toLowerCase().replace(/\s+/g, '-'),
      name: customizations.name || template.providerConfig.name,
      description: customizations.description || template.providerConfig.description || template.description,
      apiEndpoint: template.providerConfig.apiEndpoint,
      authMethod: template.providerConfig.authMethod,
      authConfig: {
        ...template.providerConfig.authConfig,
        // Merge any custom auth config
        ...(customizations.authConfig && { fields: { ...template.providerConfig.authConfig.fields, ...customizations.authConfig } })
      },
      capabilities: template.providerConfig.capabilities || {
        supportsSystemMessages: true,
        maxContextLength: 4096,
        supportedRoles: ['system', 'user', 'assistant'],
        supportsStreaming: false,
        supportsTools: false,
        supportedAuthMethods: [template.providerConfig.authMethod]
      }
    };

    // Create the provider using the dynamic provider service
    const providerService = getDynamicProviderService();
    const provider = await providerService.createProvider(providerRequest);

    // If selectedModels is provided, create those models
    if (customizations.selectedModels && customizations.selectedModels.length > 0) {
      const selectedModelConfigs = template.defaultModels.filter(model => 
        customizations.selectedModels!.includes(model.identifier)
      );

      for (const modelConfig of selectedModelConfigs) {
        await providerService.createModel(provider.id, {
          identifier: modelConfig.identifier,
          name: modelConfig.name,
          description: modelConfig.description,
          contextLength: modelConfig.contextLength,
          capabilities: modelConfig.capabilities || {
            supportsSystemMessages: true,
            maxContextLength: modelConfig.contextLength,
            supportedRoles: ['system', 'user', 'assistant'],
            supportsStreaming: false,
            supportsTools: false,
            supportsFunctionCalling: false
          },
          isDefault: modelConfig.isDefault
        });
      }
    } else {
      // Create all default models
      for (const modelConfig of template.defaultModels) {
        await providerService.createModel(provider.id, {
          identifier: modelConfig.identifier,
          name: modelConfig.name,
          description: modelConfig.description,
          contextLength: modelConfig.contextLength,
          capabilities: modelConfig.capabilities || {
            supportsSystemMessages: true,
            maxContextLength: modelConfig.contextLength,
            supportedRoles: ['system', 'user', 'assistant'],
            supportsStreaming: false,
            supportsTools: false,
            supportsFunctionCalling: false
          },
          isDefault: modelConfig.isDefault
        });
      }
    }

    logger.info(`Applied template ${template.name} to create provider ${provider.name}`);

    res.status(201).json({
      provider,
      appliedTemplate: template.name,
      modelsCreated: customizations.selectedModels?.length || template.defaultModels.length
    });
  } catch (error) {
    logger.error(`Failed to apply template ${templateId}:`, error);
    throw error;
  }
};

/**
 * Preview template application (validation only)
 * POST /api/admin/provider-templates/preview
 */
export const previewTemplate = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = applyTemplateSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.join('.') || 'body'
    );
  }

  const { templateId, customizations = {} } = value;

  try {
    const template = getProviderTemplate(templateId);
    
    if (!template) {
      throw new NotFoundError(`Provider template with ID ${templateId} not found`);
    }

    // Create preview of what would be created
    const preview = {
      provider: {
        identifier: customizations.identifier || template.providerConfig.name.toLowerCase().replace(/\s+/g, '-'),
        name: customizations.name || template.providerConfig.name,
        description: customizations.description || template.providerConfig.description || template.description,
        apiEndpoint: template.providerConfig.apiEndpoint,
        authMethod: template.providerConfig.authMethod,
        capabilities: template.providerConfig.capabilities
      },
      models: customizations.selectedModels 
        ? template.defaultModels.filter(model => customizations.selectedModels!.includes(model.identifier))
        : template.defaultModels,
      validation: {
        valid: true,
        errors: [],
        warnings: []
      }
    };

    // Basic validation
    const warnings = [];
    
    // Check for potential identifier conflicts (this would need to check against existing providers)
    if (!customizations.identifier) {
      warnings.push({
        field: 'identifier',
        code: 'AUTO_GENERATED',
        message: 'Identifier will be auto-generated from provider name',
        suggestion: 'Consider providing a custom identifier'
      });
    }

    preview.validation.warnings = warnings;

    logger.info(`Generated preview for template ${template.name}`);

    res.json({
      preview,
      template: {
        id: template.id,
        name: template.name,
        description: template.description
      }
    });
  } catch (error) {
    logger.error(`Failed to preview template ${templateId}:`, error);
    throw error;
  }
};

/**
 * Get template categories/providers
 * GET /api/admin/provider-templates/categories
 */
export const getTemplateCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = getAllProviderTemplates();
    
    // Group templates by provider name
    const categories = templates.reduce((acc, template) => {
      const category = template.name.split(' ')[0]; // Use first word as category
      if (!acc[category]) {
        acc[category] = {
          name: category,
          count: 0,
          templates: []
        };
      }
      acc[category].count++;
      acc[category].templates.push({
        id: template.id,
        name: template.name,
        description: template.description,
        modelCount: template.defaultModels.length
      });
      return acc;
    }, {} as Record<string, any>);

    const categoryList = Object.values(categories);

    logger.info(`Retrieved ${categoryList.length} template categories`);

    res.json({
      categories: categoryList,
      total: categoryList.length
    });
  } catch (error) {
    logger.error('Failed to get template categories:', error);
    throw error;
  }
};