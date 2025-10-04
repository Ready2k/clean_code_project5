/**
 * Model Management API Controller
 * 
 * Handles REST endpoints for model CRUD operations, bulk operations,
 * testing, and capability management. Includes admin authentication
 * and authorization checks.
 */

import { Request, Response } from 'express';
import Joi from 'joi';
import { getDynamicProviderService } from '../services/dynamic-provider-service.js';
import { getModelTestingService } from '../services/model-testing-service.js';
import { ValidationError, NotFoundError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import {
  CreateModelRequest,
  UpdateModelRequest,
  ModelQueryOptions,
  ModelStatus
} from '../types/dynamic-providers.js';
import {
  modelQuerySchema,
  createModelSchema,
  updateModelSchema
} from '../types/dynamic-provider-validation.js';

// ============================================================================
// Validation Schemas
// ============================================================================



// Validation schemas are imported from dynamic-provider-validation.ts

const bulkModelOperationSchema = Joi.object({
  operation: Joi.string().valid('create', 'update', 'delete', 'activate', 'deactivate').required(),
  models: Joi.array().items(Joi.object({
    id: Joi.string().optional(),
    identifier: Joi.string().optional(),
    data: Joi.object().optional()
  })).min(1).max(50).required()
});

// ============================================================================
// Model CRUD Operations
// ============================================================================

/**
 * Create a new model for a provider
 * POST /api/admin/providers/:providerId/models
 */
export const createModel = async (req: Request, res: Response): Promise<void> => {
  const { providerId } = req.params;

  if (!providerId) {
    throw new ValidationError('Provider ID is required');
  }

  const { error, value } = createModelSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const request: CreateModelRequest = value;

  logger.info('Creating model', {
    providerId,
    identifier: request.identifier,
    name: request.name,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const model = await dynamicProviderService.createModel(providerId, request);

    logger.info('Model created successfully', {
      modelId: model.id,
      providerId,
      identifier: model.identifier,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: { model },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to create model:', error);
    throw error;
  }
};

/**
 * Get all models for a provider
 * GET /api/admin/providers/:providerId/models
 */
export const getProviderModels = async (req: Request, res: Response): Promise<void> => {
  const { providerId } = req.params;

  if (!providerId) {
    throw new ValidationError('Provider ID is required');
  }

  const { error, value } = modelQuerySchema.validate(req.query);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const options: ModelQueryOptions = { ...value, providerId };

  try {
    const dynamicProviderService = getDynamicProviderService();
    const result = await dynamicProviderService.getModels(options);

    res.json({
      success: true,
      data: {
        models: result.models,
        total: result.total,
        providerId,
        page: options.page || 1,
        limit: options.limit || 50
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get provider models:', error);
    throw error;
  }
};

/**
 * Get all models across all providers
 * GET /api/admin/models
 */
export const getAllModels = async (req: Request, res: Response): Promise<void> => {
  // Parse query parameters - handle comma-separated arrays
  const queryParams = { ...req.query };
  
  // Convert comma-separated status to array
  if (queryParams['status'] && typeof queryParams['status'] === 'string') {
    queryParams['status'] = queryParams['status'].split(',');
  }
  
  // Convert comma-separated capabilities to array
  if (queryParams['capabilities'] && typeof queryParams['capabilities'] === 'string') {
    queryParams['capabilities'] = queryParams['capabilities'].split(',');
  }

  const { error, value } = modelQuerySchema.validate(queryParams);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const options: ModelQueryOptions = value;

  try {
    const dynamicProviderService = getDynamicProviderService();
    const result = await dynamicProviderService.getModels(options);

    res.json({
      success: true,
      data: {
        models: result.models,
        total: result.total,
        page: options.page || 1,
        limit: options.limit || 50
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get all models:', error);
    throw error;
  }
};

/**
 * Get a specific model by ID
 * GET /api/admin/models/:id
 */
export const getModel = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Model ID is required');
  }

  try {
    const dynamicProviderService = getDynamicProviderService();
    const model = await dynamicProviderService.getModel(id);

    res.json({
      success: true,
      data: { model },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new NotFoundError(`Model with ID ${id} not found`);
    }
    logger.error('Failed to get model:', error);
    throw error;
  }
};

/**
 * Update a model
 * PUT /api/admin/models/:id
 */
export const updateModel = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Model ID is required');
  }

  const { error, value } = updateModelSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const request: UpdateModelRequest = value;

  logger.info('Updating model', {
    modelId: id,
    updatedFields: Object.keys(request),
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const model = await dynamicProviderService.updateModel(id, request);

    logger.info('Model updated successfully', {
      modelId: id,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.json({
      success: true,
      data: { model },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to update model:', error);
    throw error;
  }
};

/**
 * Delete a model
 * DELETE /api/admin/models/:id
 */
export const deleteModel = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Model ID is required');
  }

  logger.info('Deleting model', {
    modelId: id,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    await dynamicProviderService.deleteModel(id);

    logger.info('Model deleted successfully', {
      modelId: id,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Model deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to delete model:', error);
    throw error;
  }
};

// ============================================================================
// Model Testing and Validation
// ============================================================================

/**
 * Test model availability and capabilities
 * POST /api/admin/models/:id/test
 */
export const testModel = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Model ID is required');
  }

  logger.info('Testing model availability', {
    modelId: id,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const testResult = await dynamicProviderService.testModel(id);

    logger.info('Model test completed', {
      modelId: id,
      success: testResult.success,
      latency: testResult.latency,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.json({
      success: true,
      data: { testResult },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to test model:', error);
    throw error;
  }
};

/**
 * Validate model capabilities against provider
 * POST /api/admin/models/:id/validate-capabilities
 */
export const validateModelCapabilities = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Model ID is required');
  }

  logger.info('Validating model capabilities', {
    modelId: id,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const modelTestingService = getModelTestingService();
    const validationResult = await modelTestingService.verifyModelCapabilities(id);

    res.json({
      success: true,
      data: { validation: validationResult },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to validate model capabilities:', error);
    throw error;
  }
};

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * Perform bulk operations on models
 * POST /api/admin/models/bulk
 */
export const bulkModelOperation = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = bulkModelOperationSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const { operation, models } = value;

  logger.info('Performing bulk model operation', {
    operation,
    modelCount: models.length,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const results = await dynamicProviderService.bulkModelOperation(operation, models);

    logger.info('Bulk model operation completed', {
      operation,
      modelCount: models.length,
      successCount: results.successful.length,
      errorCount: results.errors.length,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        operation,
        results: {
          successful: results.successful,
          errors: results.errors,
          summary: {
            total: models.length,
            successful: results.successful.length,
            failed: results.errors.length
          }
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to perform bulk model operation:', error);
    throw error;
  }
};

/**
 * Import models from provider API
 * POST /api/admin/providers/:providerId/models/import
 */
export const importModelsFromProvider = async (req: Request, res: Response): Promise<void> => {
  const { providerId } = req.params;
  const { overwrite = false, dryRun = false } = req.body;

  if (!providerId) {
    throw new ValidationError('Provider ID is required');
  }

  logger.info('Importing models from provider', {
    providerId,
    overwrite,
    dryRun,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const importResult = await dynamicProviderService.importModelsFromProvider(
      providerId,
      { overwrite, dryRun }
    );

    logger.info('Model import completed', {
      providerId,
      imported: importResult.imported.length,
      skipped: importResult.skipped.length,
      errors: importResult.errors.length,
      dryRun,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        import: importResult,
        summary: {
          total: importResult.imported.length + importResult.skipped.length + importResult.errors.length,
          imported: importResult.imported.length,
          skipped: importResult.skipped.length,
          failed: importResult.errors.length,
          dryRun
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to import models from provider:', error);
    throw error;
  }
};

// ============================================================================
// Model Status and Capability Management
// ============================================================================

/**
 * Update model status
 * PUT /api/admin/models/:id/status
 */
export const updateModelStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;

  if (!id) {
    throw new ValidationError('Model ID is required');
  }

  if (!status || !['active', 'inactive', 'deprecated'].includes(status)) {
    throw new ValidationError('Valid status is required (active, inactive, deprecated)');
  }

  logger.info('Updating model status', {
    modelId: id,
    newStatus: status,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const model = await dynamicProviderService.updateModel(id, { status: status as ModelStatus });

    logger.info('Model status updated successfully', {
      modelId: id,
      newStatus: status,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.json({
      success: true,
      data: { model },
      message: `Model status updated to ${status}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to update model status:', error);
    throw error;
  }
};

/**
 * Set model as default for provider
 * PUT /api/admin/models/:id/set-default
 */
export const setModelAsDefault = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Model ID is required');
  }

  logger.info('Setting model as default', {
    modelId: id,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const model = await dynamicProviderService.setModelAsDefault(id);

    logger.info('Model set as default successfully', {
      modelId: id,
      providerId: model.providerId,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.json({
      success: true,
      data: { model },
      message: 'Model set as default for provider',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to set model as default:', error);
    throw error;
  }
};

/**
 * Get model usage statistics
 * GET /api/admin/models/:id/stats
 */
export const getModelStats = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Model ID is required');
  }

  try {
    const dynamicProviderService = getDynamicProviderService();
    const stats = await dynamicProviderService.getModelStats(id);

    res.json({
      success: true,
      data: { stats },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get model stats:', error);
    throw error;
  }
};