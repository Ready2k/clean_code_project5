/**
 * Model Management Service
 * 
 * Enhanced model management functionality including CRUD operations with capability validation,
 * bulk model operations for efficiency, and model testing and status management.
 * This service builds on top of the ModelStorageService to provide higher-level operations.
 */

import { getModelStorageService } from './model-storage-service.js';
import { getProviderStorageService } from './provider-storage-service.js';
import { logger } from '../utils/logger.js';
import { AppError, ValidationError, NotFoundError, ErrorCode } from '../types/errors.js';
import { DynamicProviderValidator, validateCapabilityConsistency } from '../types/dynamic-provider-validation.js';
import {
  Model,
  Provider,
  CreateModelRequest,
  UpdateModelRequest,

  ModelStatus,
  ModelTestResult,
  ModelCapabilities,
  ProviderCapabilities
} from '../types/dynamic-providers.js';

/**
 * Enhanced model management service
 */
export class ModelManagementService {
  private modelStorage = getModelStorageService();
  private providerStorage = getProviderStorageService();

  // ============================================================================
  // Enhanced CRUD Operations with Validation
  // ============================================================================

  /**
   * Create a new model with comprehensive validation
   */
  async createModelWithValidation(providerId: string, request: CreateModelRequest): Promise<Model> {
    logger.info('Creating model with validation', {
      providerId,
      identifier: request.identifier,
      name: request.name
    });

    try {
      // Validate request data
      const validation = DynamicProviderValidator.validateCreateModel(request);
      if (validation.error) {
        throw new ValidationError(`Invalid model configuration: ${validation.error.message}`);
      }

      // Get provider to validate capabilities against
      const provider = await this.providerStorage.getProvider(providerId);

      // Validate model capabilities against provider capabilities
      const capabilityValidation = this.validateModelCapabilities(
        provider.capabilities,
        request.capabilities
      );

      if (!capabilityValidation.valid) {
        const errorMessages = capabilityValidation.conflicts.join(', ');
        throw new ValidationError(`Model capabilities validation failed: ${errorMessages}`);
      }

      // Check for context length consistency
      if (request.contextLength > provider.capabilities.maxContextLength) {
        throw new ValidationError(
          `Model context length (${request.contextLength}) exceeds provider maximum (${provider.capabilities.maxContextLength})`
        );
      }

      // Create the model
      const model = await this.modelStorage.createModel(providerId, request);

      logger.info('Model created successfully with validation', {
        modelId: model.id,
        providerId,
        identifier: model.identifier
      });

      return model;

    } catch (error) {
      logger.error('Failed to create model with validation:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to create model',
        500,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Update model with capability validation
   */
  async updateModelWithValidation(id: string, request: UpdateModelRequest): Promise<Model> {
    logger.info('Updating model with validation', { modelId: id });

    try {
      // Validate request data
      const validation = DynamicProviderValidator.validateUpdateModel(request);
      if (validation.error) {
        throw new ValidationError(`Invalid update request: ${validation.error.message}`);
      }

      // Get current model and provider
      const currentModel = await this.modelStorage.getModel(id);
      const provider = await this.providerStorage.getProvider(currentModel.providerId);

      // If capabilities are being updated, validate them
      if (request.capabilities) {
        const updatedCapabilities = { ...currentModel.capabilities, ...request.capabilities };
        
        const capabilityValidation = this.validateModelCapabilities(
          provider.capabilities,
          updatedCapabilities
        );

        if (!capabilityValidation.valid) {
          const errorMessages = capabilityValidation.conflicts.join(', ');
          throw new ValidationError(`Updated model capabilities validation failed: ${errorMessages}`);
        }
      }

      // If context length is being updated, validate it
      if (request.contextLength !== undefined) {
        if (request.contextLength > provider.capabilities.maxContextLength) {
          throw new ValidationError(
            `Updated context length (${request.contextLength}) exceeds provider maximum (${provider.capabilities.maxContextLength})`
          );
        }
      }

      // Update the model
      const model = await this.modelStorage.updateModel(id, request);

      logger.info('Model updated successfully with validation', { modelId: id });

      return model;

    } catch (error) {
      logger.error('Failed to update model with validation:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to update model',
        500,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Delete model with dependency checking
   */
  async deleteModelWithChecks(id: string): Promise<void> {
    logger.info('Deleting model with dependency checks', { modelId: id });

    try {
      // Get model to verify it exists
      const model = await this.modelStorage.getModel(id);

      // Check if model is in use by any connections
      // This would need to be implemented based on your connection management system
      // For now, we'll check if it's the only model for the provider
      const providerModels = await this.modelStorage.getProviderModels(model.providerId);
      
      if (providerModels.models.length === 1) {
        logger.warn('Attempting to delete the only model for provider', {
          modelId: id,
          providerId: model.providerId
        });
        // We could either prevent this or just warn - for now we'll allow it
      }

      // Delete the model
      await this.modelStorage.deleteModel(id);

      logger.info('Model deleted successfully', { modelId: id });

    } catch (error) {
      logger.error('Failed to delete model:', error);
      
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to delete model',
        500,
        ErrorCode.DATABASE_ERROR
      );
    }
  }

  // ============================================================================
  // Bulk Operations
  // ============================================================================

  /**
   * Bulk create models for a provider with validation
   */
  async bulkCreateModels(providerId: string, requests: CreateModelRequest[]): Promise<{
    created: Model[];
    errors: Array<{ request: CreateModelRequest; error: string }>;
  }> {
    logger.info('Bulk creating models', {
      providerId,
      count: requests.length
    });

    const created: Model[] = [];
    const errors: Array<{ request: CreateModelRequest; error: string }> = [];

    // Get provider once for all validations
    let provider: Provider;
    try {
      provider = await this.providerStorage.getProvider(providerId);
    } catch (error) {
      // If provider doesn't exist, all requests will fail
      const errorMessage = `Provider ${providerId} not found`;
      for (const request of requests) {
        errors.push({ request, error: errorMessage });
      }
      return { created, errors };
    }

    // Process each request
    for (const request of requests) {
      try {
        // Pre-validate before attempting creation
        const validation = DynamicProviderValidator.validateCreateModel(request);
        if (validation.error) {
          errors.push({
            request,
            error: `Validation failed: ${validation.error.message}`
          });
          continue;
        }

        // Validate capabilities
        const capabilityValidation = this.validateModelCapabilities(
          provider.capabilities,
          request.capabilities
        );

        if (!capabilityValidation.valid) {
          errors.push({
            request,
            error: `Capability validation failed: ${capabilityValidation.conflicts.join(', ')}`
          });
          continue;
        }

        // Create the model
        const model = await this.modelStorage.createModel(providerId, request);
        created.push(model);

      } catch (error) {
        errors.push({
          request,
          error: (error as any).message
        });
      }
    }

    logger.info('Bulk model creation completed', {
      providerId,
      created: created.length,
      errors: errors.length
    });

    return { created, errors };
  }

  /**
   * Bulk update model status
   */
  async bulkUpdateModelStatus(modelIds: string[], status: ModelStatus): Promise<{
    updated: number;
    errors: Array<{ modelId: string; error: string }>;
  }> {
    logger.info('Bulk updating model status', {
      count: modelIds.length,
      status
    });

    try {
      // Validate that all models exist first
      const errors: Array<{ modelId: string; error: string }> = [];
      const validModelIds: string[] = [];

      for (const modelId of modelIds) {
        try {
          await this.modelStorage.getModel(modelId);
          validModelIds.push(modelId);
        } catch (error) {
          errors.push({
            modelId,
            error: `Model not found: ${(error as any).message}`
          });
        }
      }

      // Update valid models
      const updated = await this.modelStorage.bulkUpdateModelStatus(validModelIds, status);

      logger.info('Bulk model status update completed', {
        requested: modelIds.length,
        updated,
        errors: errors.length
      });

      return { updated, errors };

    } catch (error) {
      logger.error('Failed to bulk update model status:', error);
      throw new AppError(
        'Failed to bulk update model status',
        500,
        ErrorCode.DATABASE_ERROR
      );
    }
  }

  /**
   * Bulk delete models with validation
   */
  async bulkDeleteModels(modelIds: string[]): Promise<{
    deleted: number;
    errors: Array<{ modelId: string; error: string }>;
  }> {
    logger.info('Bulk deleting models', {
      count: modelIds.length
    });

    const errors: Array<{ modelId: string; error: string }> = [];
    let deleted = 0;

    for (const modelId of modelIds) {
      try {
        await this.deleteModelWithChecks(modelId);
        deleted++;
      } catch (error) {
        errors.push({
          modelId,
          error: (error as any).message
        });
      }
    }

    logger.info('Bulk model deletion completed', {
      requested: modelIds.length,
      deleted,
      errors: errors.length
    });

    return { deleted, errors };
  }

  // ============================================================================
  // Model Testing and Status Management
  // ============================================================================

  /**
   * Test model availability and update status
   */
  async testModelAvailability(modelId: string): Promise<ModelTestResult> {
    logger.info('Testing model availability', { modelId });

    try {
      const model = await this.modelStorage.getModel(modelId);
      await this.providerStorage.getProvider(model.providerId);

      // For now, we'll simulate a test result
      // In a real implementation, this would make actual API calls to test the model
      const testResult: ModelTestResult = {
        success: true,
        latency: Math.floor(Math.random() * 200) + 50, // Random latency between 50-250ms
        testedAt: new Date(),
        actualCapabilities: model.capabilities
      };

      // Update model status based on test result
      if (testResult.success) {
        await this.modelStorage.updateModel(modelId, { status: 'active' });
      } else {
        await this.modelStorage.updateModel(modelId, { status: 'inactive' });
      }

      logger.info('Model availability test completed', {
        modelId,
        success: testResult.success,
        latency: testResult.latency
      });

      return testResult;

    } catch (error) {
      logger.error('Model availability test failed:', error);
      
      const failedResult: ModelTestResult = {
        success: false,
        error: (error as any).message,
        testedAt: new Date()
      };

      // Update model status to inactive on test failure
      try {
        await this.modelStorage.updateModel(modelId, { status: 'inactive' });
      } catch (updateError) {
        logger.warn('Failed to update model status after test failure', {
          modelId,
          error: (updateError as any).message
        });
      }

      return failedResult;
    }
  }

  /**
   * Test multiple models in parallel
   */
  async bulkTestModels(modelIds: string[]): Promise<{
    results: Array<{ modelId: string; result: ModelTestResult }>;
    errors: Array<{ modelId: string; error: string }>;
  }> {
    logger.info('Bulk testing models', {
      count: modelIds.length
    });

    const results: Array<{ modelId: string; result: ModelTestResult }> = [];
    const errors: Array<{ modelId: string; error: string }> = [];

    // Test models in parallel with concurrency limit
    const concurrency = 5;
    for (let i = 0; i < modelIds.length; i += concurrency) {
      const batch = modelIds.slice(i, i + concurrency);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (modelId) => {
          const result = await this.testModelAvailability(modelId);
          return { modelId, result };
        })
      );

      for (const batchResult of batchResults) {
        if (batchResult.status === 'fulfilled') {
          results.push(batchResult.value);
        } else {
          errors.push({
            modelId: 'unknown',
            error: batchResult.reason.message
          });
        }
      }
    }

    logger.info('Bulk model testing completed', {
      total: modelIds.length,
      successful: results.filter(r => r.result.success).length,
      failed: results.filter(r => !r.result.success).length,
      errors: errors.length
    });

    return { results, errors };
  }

  /**
   * Get model health status
   */
  async getModelHealth(modelId: string): Promise<{
    modelId: string;
    status: 'healthy' | 'degraded' | 'down';
    lastTested?: Date;
    responseTime?: number;
    error?: string;
  }> {
    try {
      const model = await this.modelStorage.getModel(modelId);
      
      // Determine health based on model status and any test results
      let status: 'healthy' | 'degraded' | 'down' = 'down';
      
      switch (model.status) {
        case 'active':
          status = 'healthy';
          break;
        case 'inactive':
          status = 'down';
          break;
        case 'deprecated':
          status = 'degraded';
          break;
      }

      return {
        modelId,
        status,
        lastTested: model.updatedAt // In a real implementation, this would be from test results
      };

    } catch (error) {
      logger.error('Failed to get model health:', error);
      
      return {
        modelId,
        status: 'down',
        error: (error as any).message
      };
    }
  }

  // ============================================================================
  // Capability Management
  // ============================================================================

  /**
   * Update model capabilities with validation
   */
  async updateModelCapabilities(modelId: string, capabilities: Partial<ModelCapabilities>): Promise<Model> {
    logger.info('Updating model capabilities', { modelId });

    try {
      const model = await this.modelStorage.getModel(modelId);
      const provider = await this.providerStorage.getProvider(model.providerId);

      // Merge capabilities
      const updatedCapabilities = { ...model.capabilities, ...capabilities };

      // Validate updated capabilities
      const capabilityValidation = this.validateModelCapabilities(
        provider.capabilities,
        updatedCapabilities
      );

      if (!capabilityValidation.valid) {
        const errorMessages = capabilityValidation.conflicts.join(', ');
        throw new ValidationError(`Capability validation failed: ${errorMessages}`);
      }

      // Update the model
      const updatedModel = await this.modelStorage.updateModel(modelId, {
        capabilities: updatedCapabilities
      });

      logger.info('Model capabilities updated successfully', { modelId });

      return updatedModel;

    } catch (error) {
      logger.error('Failed to update model capabilities:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to update model capabilities',
        500,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Validate model capabilities against provider capabilities
   */
  private validateModelCapabilities(
    providerCapabilities: ProviderCapabilities,
    modelCapabilities: ModelCapabilities
  ): { valid: boolean; conflicts: string[] } {
    return validateCapabilityConsistency(providerCapabilities, modelCapabilities);
  }

  // ============================================================================
  // Model Discovery and Synchronization
  // ============================================================================

  /**
   * Sync models with provider's available models
   */
  async syncProviderModels(providerId: string, availableModels: string[]): Promise<{
    added: Model[];
    removed: string[];
    errors: string[];
  }> {
    logger.info('Syncing provider models', {
      providerId,
      availableCount: availableModels.length
    });

    try {
      const provider = await this.providerStorage.getProvider(providerId);
      const existingModels = await this.modelStorage.getProviderModels(providerId);
      
      const added: Model[] = [];
      const removed: string[] = [];
      const errors: string[] = [];

      // Find models to add
      const existingIdentifiers = new Set(existingModels.models.map(m => m.identifier));
      const modelsToAdd = availableModels.filter(id => !existingIdentifiers.has(id));

      // Add new models
      for (const modelIdentifier of modelsToAdd) {
        try {
          const model = await this.modelStorage.createModel(providerId, {
            identifier: modelIdentifier,
            name: modelIdentifier, // Use identifier as name by default
            contextLength: provider.capabilities.maxContextLength,
            capabilities: {
              supportsSystemMessages: provider.capabilities.supportsSystemMessages,
              maxContextLength: provider.capabilities.maxContextLength,
              supportedRoles: provider.capabilities.supportedRoles,
              supportsStreaming: provider.capabilities.supportsStreaming,
              supportsTools: provider.capabilities.supportsTools,
              supportsFunctionCalling: provider.capabilities.supportsTools
            }
          });
          added.push(model);
        } catch (error) {
          errors.push(`Failed to add model ${modelIdentifier}: ${(error as any).message}`);
        }
      }

      // Find models to remove (models that no longer exist in provider)
      const availableSet = new Set(availableModels);
      const modelsToRemove = existingModels.models.filter(m => !availableSet.has(m.identifier));

      // Remove obsolete models (mark as deprecated instead of deleting)
      for (const model of modelsToRemove) {
        try {
          await this.modelStorage.updateModel(model.id, { status: 'deprecated' });
          removed.push(model.identifier);
        } catch (error) {
          errors.push(`Failed to deprecate model ${model.identifier}: ${(error as any).message}`);
        }
      }

      logger.info('Provider model sync completed', {
        providerId,
        added: added.length,
        removed: removed.length,
        errors: errors.length
      });

      return { added, removed, errors };

    } catch (error) {
      logger.error('Failed to sync provider models:', error);
      throw new AppError(
        'Failed to sync provider models',
        500,
        ErrorCode.EXTERNAL_SERVICE_ERROR
      );
    }
  }
}

// Singleton instance
let modelManagementService: ModelManagementService | null = null;

/**
 * Get the model management service instance
 */
export function getModelManagementService(): ModelManagementService {
  if (!modelManagementService) {
    modelManagementService = new ModelManagementService();
  }
  return modelManagementService;
}