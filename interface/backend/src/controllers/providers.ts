/**
 * Provider Management API Controller
 * 
 * Handles REST endpoints for dynamic provider CRUD operations, testing,
 * and validation. Includes admin authentication and authorization checks.
 */

import { Request, Response } from 'express';

import { getDynamicProviderService } from '../services/dynamic-provider-service.js';
import { getProviderValidationService } from '../services/provider-validation-service.js';
import { ValidationError, NotFoundError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import {
  Provider,
  CreateProviderRequest,
  UpdateProviderRequest,
  ProviderQueryOptions,
  ProviderStatus
} from '../types/dynamic-providers.js';
import {
  providerQuerySchema,
  createProviderSchema,
  updateProviderSchema
} from '../types/dynamic-provider-validation.js';

// Validation schemas are imported from dynamic-provider-validation.ts

// ============================================================================
// Provider CRUD Operations
// ============================================================================

/**
 * Create a new provider
 * POST /api/admin/providers
 */
export const createProvider = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = createProviderSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const request: CreateProviderRequest = value;
  const createdBy = req.user?.userId;

  logger.info('Creating provider', {
    identifier: request.identifier,
    name: request.name,
    createdBy,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const provider = await dynamicProviderService.createProvider(request, createdBy);

    logger.info('Provider created successfully', {
      providerId: provider.id,
      identifier: provider.identifier,
      createdBy,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: { provider },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to create provider:', error);
    throw error;
  }
};

/**
 * Get all providers with filtering and pagination
 * GET /api/admin/providers
 */
export const getProviders = async (req: Request, res: Response): Promise<void> => {
  // Parse query parameters - handle comma-separated arrays
  const queryParams = { ...req.query };
  
  // Convert comma-separated status to array
  if (queryParams['status'] && typeof queryParams['status'] === 'string') {
    queryParams['status'] = queryParams['status'].split(',');
  }
  
  // Convert comma-separated authMethod to array
  if (queryParams['authMethod'] && typeof queryParams['authMethod'] === 'string') {
    queryParams['authMethod'] = queryParams['authMethod'].split(',');
  }

  const { error, value } = providerQuerySchema.validate(queryParams);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const options: ProviderQueryOptions = value;

  try {
    const dynamicProviderService = getDynamicProviderService();
    const result = await dynamicProviderService.getProviders(options);

    res.json({
      success: true,
      data: {
        providers: result.providers,
        total: result.total,
        page: options.page || 1,
        limit: options.limit || 50
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get providers:', error);
    throw error;
  }
};

/**
 * Get a specific provider by ID
 * GET /api/admin/providers/:id
 */
export const getProvider = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Provider ID is required');
  }

  try {
    const dynamicProviderService = getDynamicProviderService();
    const provider = await dynamicProviderService.getProvider(id);

    res.json({
      success: true,
      data: { provider },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw new NotFoundError(`Provider with ID ${id} not found`);
    }
    logger.error('Failed to get provider:', error);
    throw error;
  }
};

/**
 * Update a provider
 * PUT /api/admin/providers/:id
 */
export const updateProvider = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Provider ID is required');
  }

  const { error, value } = updateProviderSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const request: UpdateProviderRequest = value;

  logger.info('Updating provider', {
    providerId: id,
    updatedFields: Object.keys(request),
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const provider = await dynamicProviderService.updateProvider(id, request);

    logger.info('Provider updated successfully', {
      providerId: id,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.json({
      success: true,
      data: { provider },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to update provider:', error);
    throw error;
  }
};

/**
 * Delete a provider
 * DELETE /api/admin/providers/:id
 */
export const deleteProvider = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Provider ID is required');
  }

  logger.info('Deleting provider', {
    providerId: id,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    await dynamicProviderService.deleteProvider(id);

    logger.info('Provider deleted successfully', {
      providerId: id,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Provider deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to delete provider:', error);
    throw error;
  }
};

// ============================================================================
// Provider Testing and Validation
// ============================================================================

/**
 * Test provider connectivity and configuration
 * POST /api/admin/providers/:id/test
 */
export const testProvider = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Provider ID is required');
  }

  logger.info('Testing provider connectivity', {
    providerId: id,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const testResult = await dynamicProviderService.testProvider(id);

    logger.info('Provider test completed', {
      providerId: id,
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
    logger.error('Failed to test provider:', error);
    throw error;
  }
};

/**
 * Validate provider configuration without saving
 * POST /api/admin/providers/validate
 */
export const validateProvider = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = createProviderSchema.validate(req.body);
  if (error) {
    throw new ValidationError(
      error.details[0]?.message || 'Validation error',
      error.details[0]?.path?.[0] as string || 'unknown'
    );
  }

  const request: CreateProviderRequest = value;

  logger.info('Validating provider configuration', {
    identifier: request.identifier,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const validationService = getProviderValidationService();
    // Create a temporary provider object for validation
    const tempProvider: Provider = {
      id: 'temp',
      identifier: request.identifier,
      name: request.name,
      description: request.description || '',
      apiEndpoint: request.apiEndpoint,
      authMethod: request.authMethod,
      authConfig: request.authConfig,
      capabilities: request.capabilities,
      status: 'testing',
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const validationResult = await validationService.validateProviderConfig(tempProvider);

    res.json({
      success: true,
      data: { validation: validationResult },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to validate provider configuration:', error);
    throw error;
  }
};

/**
 * Check if provider identifier is available
 * GET /api/admin/providers/check-identifier/:identifier
 */
export const checkIdentifierAvailability = async (req: Request, res: Response): Promise<void> => {
  const { identifier } = req.params;

  if (!identifier) {
    throw new ValidationError('Provider identifier is required');
  }

  // Validate identifier format
  const identifierPattern = /^[a-z0-9-_]+$/;
  if (!identifierPattern.test(identifier) || identifier.length < 2 || identifier.length > 50) {
    throw new ValidationError('Invalid identifier format. Must be 2-50 characters, lowercase letters, numbers, hyphens, and underscores only');
  }

  try {
    const dynamicProviderService = getDynamicProviderService();
    const isAvailable = await dynamicProviderService.isIdentifierAvailable(identifier);

    res.json({
      success: true,
      data: {
        identifier,
        available: isAvailable
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to check identifier availability:', error);
    throw error;
  }
};

// ============================================================================
// Provider Status Management
// ============================================================================

/**
 * Update provider status (activate/deactivate)
 * PUT /api/admin/providers/:id/status
 */
export const updateProviderStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body;

  if (!id) {
    throw new ValidationError('Provider ID is required');
  }

  if (!status || !['active', 'inactive', 'testing'].includes(status)) {
    throw new ValidationError('Valid status is required (active, inactive, testing)');
  }

  logger.info('Updating provider status', {
    providerId: id,
    newStatus: status,
    userId: req.user?.userId,
    ip: req.ip
  });

  try {
    const dynamicProviderService = getDynamicProviderService();
    const provider = await dynamicProviderService.updateProvider(id, { status: status as ProviderStatus });

    logger.info('Provider status updated successfully', {
      providerId: id,
      newStatus: status,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.json({
      success: true,
      data: { provider },
      message: `Provider status updated to ${status}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to update provider status:', error);
    throw error;
  }
};

/**
 * Get provider health status
 * GET /api/admin/providers/:id/health
 */
export const getProviderHealth = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Provider ID is required');
  }

  try {
    const dynamicProviderService = getDynamicProviderService();
    const health = await dynamicProviderService.getProviderHealth(id);

    res.json({
      success: true,
      data: { health },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get provider health:', error);
    throw error;
  }
};

/**
 * Get provider statistics
 * GET /api/admin/providers/:id/stats
 */
export const getProviderStats = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new ValidationError('Provider ID is required');
  }

  try {
    const dynamicProviderService = getDynamicProviderService();
    const stats = await dynamicProviderService.getProviderStats(id);

    res.json({
      success: true,
      data: { stats },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get provider stats:', error);
    throw error;
  }
};
/**

 * Get system-wide provider statistics
 * GET /api/admin/providers/system-stats
 */
export const getSystemStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const dynamicProviderService = getDynamicProviderService();
    const result = await dynamicProviderService.getProviders();
    const providers = result.providers;
    
    // Calculate system statistics
    const totalProviders = providers.length;
    const activeProviders = providers.filter(p => p.status === 'active').length;
    const inactiveProviders = totalProviders - activeProviders;
    const systemProviders = providers.filter(p => p.isSystem).length;
    const customProviders = totalProviders - systemProviders;
    
    // For now, return mock model and template counts since those services aren't fully implemented
    const stats = {
      totalProviders,
      activeProviders,
      inactiveProviders,
      systemProviders,
      customProviders,
      totalModels: 0,
      activeModels: 0,
      totalTemplates: 0,
      systemTemplates: 0,
      customTemplates: 0,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: { stats },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get system stats:', error);
    
    // Return empty stats instead of failing
    const emptyStats = {
      totalProviders: 0,
      activeProviders: 0,
      inactiveProviders: 0,
      systemProviders: 0,
      customProviders: 0,
      totalModels: 0,
      activeModels: 0,
      totalTemplates: 0,
      systemTemplates: 0,
      customTemplates: 0,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: { stats: emptyStats },
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get health status for all providers
 * GET /api/admin/providers/health
 */
export const getAllProviderHealth = async (_req: Request, res: Response): Promise<void> => {
  try {
    const dynamicProviderService = getDynamicProviderService();
    const result = await dynamicProviderService.getProviders();
    const providers = result.providers;
    
    // Get health status for each provider
    const healthPromises = providers.map(async (provider) => {
      try {
        const health = await dynamicProviderService.getProviderHealth(provider.id);
        return {
          providerId: provider.id,
          status: health.status,
          lastCheck: health.lastCheck,
          responseTime: health.responseTime,
          error: health.error,
          uptime: health.uptime
        };
      } catch (error) {
        // If health check fails, return degraded status
        return {
          providerId: provider.id,
          status: 'down' as const,
          lastCheck: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Health check failed',
          uptime: 0
        };
      }
    });

    const health = await Promise.all(healthPromises);

    res.json({
      success: true,
      data: { health },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get all provider health:', error);
    
    // Return empty health array instead of failing
    res.json({
      success: true,
      data: { health: [] },
      timestamp: new Date().toISOString()
    });
  }
};