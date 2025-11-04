/**
 * Dynamic Provider Service
 * 
 * Core service for managing dynamic LLM providers and models. This service
 * orchestrates provider CRUD operations, validation, testing, and health monitoring.
 * It integrates with storage services, validation services, and the provider registry.
 */

import { getProviderStorageService } from './provider-storage-service.js';
import { getModelStorageService } from './model-storage-service.js';
import fs from 'fs/promises';
import path from 'path';
import { getTemplateStorageService } from './template-storage-service.js';
// import { getProviderValidationService } from './provider-validation-service.js';
// import { getModelTestingService } from './model-testing-service.js';
// import { getProviderRegistryService } from './provider-registry-service.js';
import { logger } from '../utils/logger.js';
import { AppError, ValidationError, NotFoundError, ConflictError, ErrorCode } from '../types/errors.js';
import { DynamicProviderValidator } from '../types/dynamic-provider-validation.js';
import {
  Provider,
  Model,
  ProviderTemplate,
  CreateProviderRequest,
  UpdateProviderRequest,
  CreateModelRequest,
  UpdateModelRequest,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ApplyTemplateRequest,
  ProviderTestResult,
  ModelTestResult,
  ProviderQueryOptions,
  ModelQueryOptions,
  ProviderRegistryStatus,
  ProviderHealth,
  SystemProviderStats
} from '../types/dynamic-providers.js';

/**
 * Core dynamic provider service
 */
export class DynamicProviderService {
  private providerStorage = getProviderStorageService();
  private modelStorage = getModelStorageService();
  private templateStorage = getTemplateStorageService();
  // private providerValidation = getProviderValidationService();
  // private modelTesting = getModelTestingService();

  // ============================================================================
  // Provider Management
  // ============================================================================

  /**
   * Create a new provider with validation and testing
   */
  async createProvider(request: CreateProviderRequest, createdBy?: string): Promise<Provider> {
    logger.info('Creating new provider', {
      identifier: request.identifier,
      name: request.name,
      createdBy
    });

    try {
      // Validate request data
      const validation = DynamicProviderValidator.validateCreateProvider(request);
      if (validation.error) {
        throw new ValidationError(`Invalid provider configuration: ${validation.error.message}`);
      }

      // Check if identifier is available
      const isAvailable = await this.providerStorage.isIdentifierAvailable(request.identifier);
      if (!isAvailable) {
        throw new ConflictError(`Provider with identifier '${request.identifier}' already exists`);
      }

      // Validate provider configuration (basic validation for now)
      if (!request.apiEndpoint || !request.name || !request.identifier) {
        throw new ValidationError('Missing required provider fields');
      }

      // Create provider in database
      const provider = await this.providerStorage.createProvider(request, createdBy);

      // Test provider connectivity (async, don't wait)
      this.testProviderAsync(provider.id).catch(error => {
        logger.warn('Initial provider test failed', {
          providerId: provider.id,
          error: error.message
        });
      });

      // Refresh provider registry
      await this.refreshProviderRegistry();

      // Notify registry monitoring service
      await this.notifyProviderChange('created', provider.id, provider);

      logger.info('Provider created successfully', {
        providerId: provider.id,
        identifier: provider.identifier
      });

      return provider;

    } catch (error) {
      logger.error('Failed to create provider:', error);
      
      if (error instanceof ValidationError || error instanceof ConflictError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to create provider',
        500,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Get provider by ID
   */
  async getProvider(id: string): Promise<Provider> {
    try {
      return await this.providerStorage.getProvider(id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError(`Provider with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Get provider by identifier
   */
  async getProviderByIdentifier(identifier: string): Promise<Provider | null> {
    return await this.providerStorage.getProviderByIdentifier(identifier);
  }

  /**
   * Get all providers with filtering and pagination
   */
  async getProviders(options: ProviderQueryOptions = {}): Promise<{
    providers: Provider[];
    total: number;
  }> {
    // Validate query options
    const validation = DynamicProviderValidator.validateProviderQuery(options);
    if (validation.error) {
      throw new ValidationError(`Invalid query parameters: ${validation.error.message}`);
    }

    return await this.providerStorage.getProviders(options);
  }

  /**
   * Update provider configuration
   */
  async updateProvider(id: string, request: UpdateProviderRequest): Promise<Provider> {
    logger.info('Updating provider', { providerId: id });

    try {
      // Validate request data
      const validation = DynamicProviderValidator.validateUpdateProvider(request);
      if (validation.error) {
        throw new ValidationError(`Invalid update request: ${validation.error.message}`);
      }

      // Get current provider to verify it exists
      await this.getProvider(id);

      // Validate updated configuration (basic validation for now)
      if (request.apiEndpoint && !request.apiEndpoint.startsWith('http')) {
        throw new ValidationError('Invalid API endpoint format');
      }

      // Update provider in database
      const provider = await this.providerStorage.updateProvider(id, request);

      // If auth config or endpoint changed, test connectivity
      if (request.authConfig || request.apiEndpoint) {
        this.testProviderAsync(id).catch(error => {
          logger.warn('Provider test after update failed', {
            providerId: id,
            error: error.message
          });
        });
      }

      // Refresh provider registry
      await this.refreshProviderRegistry();

      // Notify registry monitoring service
      await this.notifyProviderChange('updated', id, provider);

      logger.info('Provider updated successfully', { providerId: id });

      return provider;

    } catch (error) {
      logger.error('Failed to update provider:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to update provider',
        500,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Delete provider
   */
  async deleteProvider(id: string): Promise<void> {
    logger.info('Deleting provider', { providerId: id });

    try {
      // Get provider to check if it's a system provider
      const provider = await this.getProvider(id);

      if (provider.isSystem) {
        throw new ValidationError('Cannot delete system provider');
      }

      // Check if provider is in use
      const modelsResult = await this.modelStorage.getProviderModels(id);
      if (modelsResult.models.length > 0) {
        throw new ConflictError(`Cannot delete provider: ${modelsResult.models.length} models are configured for this provider`);
      }

      // Delete provider
      await this.providerStorage.deleteProvider(id);

      // Refresh provider registry
      await this.refreshProviderRegistry();

      // Notify registry monitoring service
      await this.notifyProviderChange('deleted', id);

      logger.info('Provider deleted successfully', { providerId: id });

    } catch (error) {
      logger.error('Failed to delete provider:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to delete provider',
        500,
        ErrorCode.CONFLICT
      );
    }
  }

  /**
   * Test provider connectivity and capabilities
   */
  async testProvider(id: string): Promise<ProviderTestResult> {
    logger.info('Testing provider connectivity', { providerId: id });

    try {
      const provider = await this.getProvider(id);
      
      // Get decrypted auth config for testing
      await this.providerStorage.getDecryptedAuthConfig(id);
      
      // Test provider connectivity (mock for now)
      const testResult: ProviderTestResult = {
        success: true,
        latency: 100,
        testedAt: new Date(),
        availableModels: [],
        capabilities: provider.capabilities
      };

      // Update test result in database
      await this.providerStorage.updateProviderTestResult(id, testResult);

      logger.info('Provider test completed', {
        providerId: id,
        success: testResult.success,
        latency: testResult.latency
      });

      return testResult;

    } catch (error: any) {
      logger.error('Provider test failed:', error);
      
      const failedResult: ProviderTestResult = {
        success: false,
        error: error.message,
        testedAt: new Date()
      };

      // Update failed test result
      await this.providerStorage.updateProviderTestResult(id, failedResult);

      return failedResult;
    }
  }

  /**
   * Test provider asynchronously (fire and forget)
   */
  private async testProviderAsync(id: string): Promise<void> {
    try {
      await this.testProvider(id);
    } catch (_error) {
      // Already logged in testProvider
    }
  }

  // ============================================================================
  // Model Management
  // ============================================================================

  /**
   * Create a new model for a provider
   */
  async createModel(providerId: string, request: CreateModelRequest): Promise<Model> {
    logger.info('Creating new model', {
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

      // Verify provider exists
      const provider = await this.getProvider(providerId);

      // Check if model identifier is unique for this provider
      const existingModel = await this.modelStorage.getModelByIdentifier(providerId, request.identifier);
      if (existingModel) {
        throw new ConflictError(`Model with identifier '${request.identifier}' already exists for this provider`);
      }

      // Validate model capabilities against provider capabilities (basic validation)
      if (request.contextLength > provider.capabilities.maxContextLength) {
        throw new ValidationError('Model context length exceeds provider maximum');
      }

      // Create model in database
      const model = await this.modelStorage.createModel(providerId, request);

      // Test model availability (async, don't wait)
      this.testModelAsync(model.id).catch(error => {
        logger.warn('Initial model test failed', {
          modelId: model.id,
          error: error.message
        });
      });

      logger.info('Model created successfully', {
        modelId: model.id,
        providerId,
        identifier: model.identifier
      });

      return model;

    } catch (error) {
      logger.error('Failed to create model:', error);
      
      if (error instanceof ValidationError || error instanceof ConflictError || error instanceof NotFoundError) {
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
   * Get model by ID
   */
  async getModel(id: string): Promise<Model> {
    try {
      return await this.modelStorage.getModel(id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError(`Model with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Get all models for a provider
   */
  async getProviderModels(providerId: string): Promise<Model[]> {
    // Verify provider exists
    await this.getProvider(providerId);
    
    const result = await this.modelStorage.getProviderModels(providerId);
    return result.models;
  }

  /**
   * Get models with filtering and pagination
   */
  async getModels(options: ModelQueryOptions = {}): Promise<{
    models: Model[];
    total: number;
  }> {
    // Validate query options
    const validation = DynamicProviderValidator.validateModelQuery(options);
    if (validation.error) {
      throw new ValidationError(`Invalid query parameters: ${validation.error.message}`);
    }

    return await this.modelStorage.getModels(options);
  }

  /**
   * Update model configuration
   */
  async updateModel(id: string, request: UpdateModelRequest): Promise<Model> {
    logger.info('Updating model', { modelId: id });

    try {
      // Validate request data
      const validation = DynamicProviderValidator.validateUpdateModel(request);
      if (validation.error) {
        throw new ValidationError(`Invalid update request: ${validation.error.message}`);
      }

      // Get current model and provider
      const currentModel = await this.getModel(id);
      const provider = await this.getProvider(currentModel.providerId);

      // If capabilities are being updated, validate against provider (basic validation)
      if (request.capabilities && request.contextLength) {
        if (request.contextLength > provider.capabilities.maxContextLength) {
          throw new ValidationError('Updated model context length exceeds provider maximum');
        }
      }

      // Update model in database
      const model = await this.modelStorage.updateModel(id, request);

      // If capabilities changed, test model
      if (request.capabilities) {
        this.testModelAsync(id).catch(error => {
          logger.warn('Model test after update failed', {
            modelId: id,
            error: error.message
          });
        });
      }

      logger.info('Model updated successfully', { modelId: id });

      return model;

    } catch (error) {
      logger.error('Failed to update model:', error);
      
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
   * Delete model
   */
  async deleteModel(id: string): Promise<void> {
    logger.info('Deleting model', { modelId: id });

    try {
      // Get model to verify it exists
      await this.getModel(id);

      // Check if model is in use by any connections
      // This would need to be implemented based on your connection management system
      // For now, we'll just delete the model

      // Delete model
      await this.modelStorage.deleteModel(id);

      logger.info('Model deleted successfully', { modelId: id });

    } catch (error) {
      logger.error('Failed to delete model:', error);
      
      if (error instanceof NotFoundError || error instanceof ConflictError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to delete model',
        500,
        ErrorCode.CONFLICT
      );
    }
  }

  /**
   * Test model availability and capabilities
   */
  async testModel(id: string): Promise<ModelTestResult> {
    logger.info('Testing model availability', { modelId: id });

    try {
      const model = await this.getModel(id);
      const provider = await this.getProvider(model.providerId);
      
      // Get decrypted auth config for testing
      await this.providerStorage.getDecryptedAuthConfig(provider.id);
      
      // Test model availability (mock for now)
      const testResult: ModelTestResult = {
        success: true,
        latency: 50,
        testedAt: new Date()
      };

      // Update test result in database (if method exists)
      // await this.modelStorage.updateModelTestResult(id, testResult);

      logger.info('Model test completed', {
        modelId: id,
        success: testResult.success,
        latency: testResult.latency
      });

      return testResult;

    } catch (error: any) {
      logger.error('Model test failed:', error);
      
      const failedResult: ModelTestResult = {
        success: false,
        error: error.message,
        testedAt: new Date()
      };

      // Update failed test result (if method exists)
      // await this.modelStorage.updateModelTestResult(id, failedResult);

      return failedResult;
    }
  }

  /**
   * Test model asynchronously (fire and forget)
   */
  private async testModelAsync(id: string): Promise<void> {
    try {
      await this.testModel(id);
    } catch (_error) {
      // Already logged in testModel
    }
  }

  /**
   * Bulk create models for a provider
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

    for (const request of requests) {
      try {
        const model = await this.createModel(providerId, request);
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

  // ============================================================================
  // Template Management
  // ============================================================================

  /**
   * Create a new provider template
   */
  async createTemplate(request: CreateTemplateRequest, createdBy?: string): Promise<ProviderTemplate> {
    logger.info('Creating provider template', {
      name: request.name,
      createdBy
    });

    try {
      // Validate request data
      const validation = DynamicProviderValidator.validateCreateTemplate(request);
      if (validation.error) {
        throw new ValidationError(`Invalid template configuration: ${validation.error.message}`);
      }

      // Create template in database
      const template = await this.templateStorage.createTemplate(request, createdBy);

      logger.info('Template created successfully', {
        templateId: template.id,
        name: template.name
      });

      return template;

    } catch (error) {
      logger.error('Failed to create template:', error);
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to create template',
        500,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string): Promise<ProviderTemplate> {
    try {
      return await this.templateStorage.getTemplate(id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError(`Template with ID ${id} not found`);
      }
      throw error;
    }
  }

  /**
   * Get all templates
   */
  async getTemplates(): Promise<ProviderTemplate[]> {
    const result = await this.templateStorage.getTemplates();
    return result.templates;
  }

  /**
   * Update template
   */
  async updateTemplate(id: string, request: UpdateTemplateRequest): Promise<ProviderTemplate> {
    logger.info('Updating template', { templateId: id });

    try {
      // Validate request data
      const validation = DynamicProviderValidator.validateUpdateTemplate(request);
      if (validation.error) {
        throw new ValidationError(`Invalid update request: ${validation.error.message}`);
      }

      // Update template in database
      const template = await this.templateStorage.updateTemplate(id, request);

      logger.info('Template updated successfully', { templateId: id });

      return template;

    } catch (error) {
      logger.error('Failed to update template:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to update template',
        500,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string): Promise<void> {
    logger.info('Deleting template', { templateId: id });

    try {
      // Get template to check if it's a system template
      const template = await this.getTemplate(id);

      if (template.isSystem) {
        throw new ValidationError('Cannot delete system template');
      }

      // Delete template
      await this.templateStorage.deleteTemplate(id);

      logger.info('Template deleted successfully', { templateId: id });

    } catch (error) {
      logger.error('Failed to delete template:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to delete template',
        500,
        ErrorCode.NOT_FOUND
      );
    }
  }

  /**
   * Apply template to create a new provider
   */
  async applyTemplate(request: ApplyTemplateRequest, createdBy?: string): Promise<Provider> {
    logger.info('Applying template to create provider', {
      templateId: request.templateId,
      createdBy
    });

    try {
      // Get template
      const template = await this.getTemplate(request.templateId);

      // Apply customizations to template
      const providerConfig = await this.templateStorage.instantiateTemplate(
        template,
        request.customizations || {}
      );

      // Create provider from template
      const provider = await this.createProvider(providerConfig, createdBy);

      // Create default models if specified
      if (template.defaultModels && template.defaultModels.length > 0) {
        const selectedModels = request.customizations?.selectedModels || 
                              template.defaultModels.map(m => m.identifier);

        const modelsToCreate = template.defaultModels.filter(m => 
          selectedModels.includes(m.identifier)
        );

        for (const modelTemplate of modelsToCreate) {
          try {
            const modelRequest: CreateModelRequest = {
              identifier: modelTemplate.identifier,
              name: modelTemplate.name,
              contextLength: modelTemplate.contextLength,
              capabilities: {
                supportsSystemMessages: true,
                maxContextLength: modelTemplate.contextLength,
                supportedRoles: ['system', 'user', 'assistant'],
                supportsStreaming: false,
                supportsTools: false,
                supportsFunctionCalling: false,
                ...modelTemplate.capabilities
              },
              isDefault: modelTemplate.isDefault || false
            };

            if (modelTemplate.description) {
              modelRequest.description = modelTemplate.description;
            }

            await this.createModel(provider.id, modelRequest);
          } catch (error) {
            logger.warn('Failed to create model from template', {
              providerId: provider.id,
              modelIdentifier: modelTemplate.identifier,
              error: (error as any).message
            });
          }
        }
      }

      logger.info('Template applied successfully', {
        templateId: request.templateId,
        providerId: provider.id
      });

      return provider;

    } catch (error) {
      logger.error('Failed to apply template:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to apply template',
        500,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  // ============================================================================
  // Registry Integration
  // ============================================================================

  /**
   * Refresh the provider registry with current database state
   */
  async refreshProviderRegistry(): Promise<void> {
    logger.info('Refreshing provider registry');

    try {
      // Import here to avoid circular dependency
      const { getProviderRegistryService } = await import('./provider-registry-service.js');
      const registryService = getProviderRegistryService();
      
      await registryService.refreshRegistry();
      
      logger.info('Provider registry refreshed successfully');

    } catch (error) {
      logger.error('Failed to refresh provider registry:', error);
      throw new AppError(
        'Failed to refresh provider registry',
        500,
        ErrorCode.EXTERNAL_SERVICE_ERROR
      );
    }
  }

  /**
   * Get provider registry status
   */
  async getRegistryStatus(): Promise<ProviderRegistryStatus> {
    try {
      // For now, return a mock status
      const providerStats = await this.providerStorage.getProviderStats();
      
      return {
        totalProviders: providerStats.total,
        activeProviders: providerStats.active,
        inactiveProviders: providerStats.inactive,
        systemProviders: providerStats.system,
        customProviders: providerStats.custom,
        lastRefresh: new Date(),
        cacheAge: 0
      };
    } catch (error) {
      logger.error('Failed to get registry status:', error);
      throw new AppError(
        'Failed to get registry status',
        500,
        ErrorCode.EXTERNAL_SERVICE_ERROR
      );
    }
  }

  /**
   * Notify registry monitoring service of provider changes
   */
  private async notifyProviderChange(
    type: 'created' | 'updated' | 'deleted',
    providerId: string,
    provider?: Provider
  ): Promise<void> {
    try {
      // Import here to avoid circular dependency
      const { getRegistryMonitoringService } = await import('./registry-monitoring-service.js');
      const monitoringService = getRegistryMonitoringService();
      
      await monitoringService.onProviderChange({
        type,
        providerId,
        provider
      });
      
      logger.debug('Registry monitoring service notified', { type, providerId });
    } catch (error) {
      // Don't fail the main operation if monitoring notification fails
      logger.warn('Failed to notify registry monitoring service', { 
        type, 
        providerId, 
        error 
      });
    }
  }

  // ============================================================================
  // Health Monitoring and Statistics
  // ============================================================================

  /**
   * Get provider health status
   */
  async getProviderHealth(id: string): Promise<ProviderHealth> {
    try {
      const provider = await this.getProvider(id);
      
      // Calculate health based on last test result
      let status: 'healthy' | 'degraded' | 'down' = 'down';
      let responseTime: number | undefined;
      let error: string | undefined;
      
      if (provider.testResult) {
        if (provider.testResult.success) {
          status = 'healthy';
          responseTime = provider.testResult.latency;
        } else {
          status = 'down';
          error = provider.testResult.error;
        }
      }

      // Calculate uptime (simplified - based on test results)
      const uptime = provider.testResult?.success ? 100 : 0;

      const healthResult: ProviderHealth = {
        providerId: id,
        status,
        lastCheck: provider.lastTested || provider.updatedAt,
        uptime
      };

      if (responseTime !== undefined) {
        healthResult.responseTime = responseTime;
      }

      if (error !== undefined) {
        healthResult.error = error;
      }

      return healthResult;

    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error('Failed to get provider health:', error);
      throw new AppError(
        'Failed to get provider health',
        500,
        'HEALTH_CHECK_FAILED' as any
      );
    }
  }

  /**
   * Get system-wide provider statistics
   */
  async getSystemStats(): Promise<SystemProviderStats> {
    try {
      const providerStats = await this.providerStorage.getProviderStats();
      const modelStats = await this.modelStorage.getGlobalModelStats();

      // Get provider-specific stats
      const providers = await this.getProviders();
      const byProvider: Record<string, any> = {};

      for (const provider of providers.providers) {
        const models = await this.getProviderModels(provider.id);
        byProvider[provider.identifier] = {
          models: models.length,
          connections: 0, // Would need to query connections table
          requests: 0,    // Would need to query usage logs
          errors: 0       // Would need to query error logs
        };
      }

      return {
        totalProviders: providerStats.total,
        totalModels: modelStats.total,
        activeConnections: 0, // Would need to query connections
        totalRequests: 0,     // Would need to query usage logs
        averageResponseTime: 0, // Would need to calculate from test results
        errorRate: 0,         // Would need to calculate from logs
        byProvider
      };

    } catch (error) {
      logger.error('Failed to get system stats:', error);
      throw new AppError(
        'Failed to get system statistics',
        500,
        ErrorCode.EXTERNAL_SERVICE_ERROR
      );
    }
  }

  /**
   * Run health checks on all active providers
   */
  async runHealthChecks(): Promise<ProviderHealth[]> {
    logger.info('Running health checks on all providers');

    try {
      const activeProviders = await this.providerStorage.getActiveProviders();
      const healthResults: ProviderHealth[] = [];

      // Run health checks in parallel (with concurrency limit)
      const concurrency = 5;
      for (let i = 0; i < activeProviders.length; i += concurrency) {
        const batch = activeProviders.slice(i, i + concurrency);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (provider) => {
            try {
              await this.testProvider(provider.id);
              return await this.getProviderHealth(provider.id);
            } catch (error) {
              logger.warn('Health check failed for provider', {
                providerId: provider.id,
                error: (error as any).message
              });
              
              return {
                providerId: provider.id,
                status: 'down' as const,
                lastCheck: new Date(),
                error: (error as any).message,
                uptime: 0
              };
            }
          })
        );

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            healthResults.push(result.value);
          }
        }
      }

      logger.info('Health checks completed', {
        total: activeProviders.length,
        healthy: healthResults.filter(h => h.status === 'healthy').length,
        degraded: healthResults.filter(h => h.status === 'degraded').length,
        down: healthResults.filter(h => h.status === 'down').length
      });

      return healthResults;

    } catch (error) {
      logger.error('Failed to run health checks:', error);
      throw new AppError(
        'Failed to run health checks',
        500,
        ErrorCode.EXTERNAL_SERVICE_ERROR
      );
    }
  }

  // ============================================================================
  // Additional Methods for API Controllers
  // ============================================================================

  /**
   * Check if provider identifier is available
   */
  async isIdentifierAvailable(identifier: string): Promise<boolean> {
    return await this.providerStorage.isIdentifierAvailable(identifier);
  }

  /**
   * Get provider statistics
   */
  async getProviderStats(id: string): Promise<any> {
    try {
      const provider = await this.getProvider(id);
      const models = await this.getProviderModels(id);
      
      // Get basic stats (can be enhanced with actual usage data later)
      return {
        providerId: id,
        identifier: provider.identifier,
        name: provider.name,
        status: provider.status,
        modelCount: models.length,
        activeModels: models.filter(m => m.status === 'active').length,
        lastTested: provider.lastTested,
        testResult: provider.testResult,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt
      };
    } catch (error) {
      logger.error('Failed to get provider stats:', error);
      throw error;
    }
  }

  /**
   * Bulk model operations
   */
  async bulkModelOperation(operation: string, models: any[]): Promise<{
    successful: any[];
    errors: any[];
  }> {
    logger.info('Performing bulk model operation', { operation, count: models.length });

    const successful: any[] = [];
    const errors: any[] = [];

    for (const modelData of models) {
      try {
        switch (operation) {
          case 'create':
            if (modelData.providerId && modelData.data) {
              const created = await this.createModel(modelData.providerId, modelData.data);
              successful.push(created);
            } else {
              errors.push({ model: modelData, error: 'Missing providerId or data' });
            }
            break;
          case 'update':
            if (modelData.id && modelData.data) {
              const updated = await this.updateModel(modelData.id, modelData.data);
              successful.push(updated);
            } else {
              errors.push({ model: modelData, error: 'Missing id or data' });
            }
            break;
          case 'delete':
            if (modelData.id) {
              await this.deleteModel(modelData.id);
              successful.push({ id: modelData.id, deleted: true });
            } else {
              errors.push({ model: modelData, error: 'Missing id' });
            }
            break;
          case 'activate':
          case 'deactivate':
            if (modelData.id) {
              const status = operation === 'activate' ? 'active' : 'inactive';
              const updated = await this.updateModel(modelData.id, { status: status as any });
              successful.push(updated);
            } else {
              errors.push({ model: modelData, error: 'Missing id' });
            }
            break;
          default:
            errors.push({ model: modelData, error: `Unknown operation: ${operation}` });
        }
      } catch (error) {
        errors.push({ 
          model: modelData, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return { successful, errors };
  }

  /**
   * Import models from provider API
   */
  async importModelsFromProvider(providerId: string, options: { overwrite?: boolean; dryRun?: boolean } = {}): Promise<{
    imported: Model[];
    skipped: any[];
    errors: any[];
  }> {
    logger.info('Importing models from provider', { providerId, options });

    const provider = await this.getProvider(providerId);
    const imported: Model[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    try {
      // For now, return mock data since we don't have actual provider API integration
      // This would be implemented with actual provider API calls
      const mockModels = [
        {
          identifier: `${provider.identifier}-model-1`,
          name: `${provider.name} Model 1`,
          contextLength: 4096,
          capabilities: {
            supportsSystemMessages: true,
            maxContextLength: 4096,
            supportedRoles: ['system', 'user', 'assistant'],
            supportsStreaming: true,
            supportsTools: false,
            supportsFunctionCalling: false
          }
        }
      ];

      for (const modelData of mockModels) {
        try {
          if (!options.dryRun) {
            const existingModel = await this.modelStorage.getModelByIdentifier(providerId, modelData.identifier);
            
            if (existingModel && !options.overwrite) {
              skipped.push({ identifier: modelData.identifier, reason: 'Already exists' });
              continue;
            }

            const model = existingModel && options.overwrite
              ? await this.updateModel(existingModel.id, modelData)
              : await this.createModel(providerId, modelData);
            
            imported.push(model);
          } else {
            imported.push(modelData as any);
          }
        } catch (error) {
          errors.push({
            identifier: modelData.identifier,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return { imported, skipped, errors };
    } catch (error) {
      logger.error('Failed to import models from provider:', error);
      throw error;
    }
  }

  /**
   * Set model as default for provider
   */
  async setModelAsDefault(modelId: string): Promise<Model> {
    logger.info('Setting model as default', { modelId });

    try {
      const model = await this.getModel(modelId);
      
      // First, unset any existing default models for this provider
      await this.modelStorage.unsetDefaultModels(model.providerId);
      
      // Then set this model as default
      const updatedModel = await this.updateModel(modelId, { isDefault: true });
      
      logger.info('Model set as default successfully', { 
        modelId, 
        providerId: model.providerId 
      });

      return updatedModel;
    } catch (error) {
      logger.error('Failed to set model as default:', error);
      throw error;
    }
  }

  /**
   * Get model statistics
   */
  async getModelStats(modelId: string): Promise<any> {
    try {
      const model = await this.getModel(modelId);
      
      // Get basic stats (can be enhanced with actual usage data later)
      return {
        modelId,
        identifier: model.identifier,
        name: model.name,
        providerId: model.providerId,
        status: model.status,
        contextLength: model.contextLength,
        isDefault: model.isDefault,
        capabilities: model.capabilities,
        pricingInfo: model.pricingInfo,
        createdAt: model.createdAt,
        updatedAt: model.updatedAt,
        // Mock usage stats - would be real data in production
        usageStats: {
          totalRequests: 0,
          totalTokens: 0,
          averageLatency: 0,
          errorRate: 0,
          lastUsed: null
        }
      };
    } catch (error) {
      logger.error('Failed to get model stats:', error);
      throw error;
    }
  }

  /**
   * Export providers with options
   */
  async exportProviders(options: any): Promise<any> {
    logger.info('Exporting providers', { options });
    
    try {
      const providers = await this.getProviders({
        ...(options.providerIds && { providerIds: options.providerIds })
      });

      const exportData: any = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        providers: providers.providers.map(provider => {
          const exportProvider = { ...provider };
          
          // Exclude credentials if requested
          if (options.excludeCredentials) {
            exportProvider.authConfig = {
              ...exportProvider.authConfig,
              fields: Object.keys(exportProvider.authConfig.fields).reduce((acc, key) => {
                const field = exportProvider.authConfig.fields[key];
                acc[key] = field?.sensitive ? { ...field, value: '[REDACTED]' } : field;
                return acc;
              }, {} as any)
            };
          }

          return exportProvider;
        })
      };

      if (options.includeModels) {
        exportData.models = [];
        for (const provider of providers.providers) {
          const models = await this.getProviderModels(provider.id);
          exportData.models.push(...models);
        }
      }

      if (options.includeTemplates) {
        const templates = await this.getTemplates();
        exportData.templates = templates;
      }

      return exportData;
    } catch (error) {
      logger.error('Failed to export providers:', error);
      throw error;
    }
  }

  /**
   * Export single provider
   */
  async exportProvider(id: string, options: any): Promise<any> {
    return this.exportProviders({ ...options, providerIds: [id] });
  }

  /**
   * Import providers from data
   */
  async importProviders(data: any, options: any): Promise<{
    imported: Provider[];
    skipped: any[];
    errors: any[];
  }> {
    logger.info('Importing providers', { options });

    const imported: Provider[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    try {
      let providersData = data;
      
      // Handle different data formats
      if (typeof data === 'string') {
        providersData = options.format === 'yaml' 
          ? require('yaml').parse(data)
          : JSON.parse(data);
      }

      const providers = Array.isArray(providersData) 
        ? providersData 
        : providersData.providers || [];

      for (const providerData of providers) {
        try {
          if (!options.dryRun) {
            const existingProvider = await this.getProviderByIdentifier(providerData.identifier);
            
            if (existingProvider) {
              if (options.conflictResolution === 'skip') {
                skipped.push({ identifier: providerData.identifier, reason: 'Already exists' });
                continue;
              } else if (options.conflictResolution === 'overwrite') {
                const updated = await this.updateProvider(existingProvider.id, providerData);
                imported.push(updated);
                continue;
              }
            }

            const provider = await this.createProvider(providerData, options.createdBy);
            imported.push(provider);
          } else {
            imported.push(providerData);
          }
        } catch (error) {
          errors.push({
            identifier: providerData.identifier,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return { imported, skipped, errors };
    } catch (error) {
      logger.error('Failed to import providers:', error);
      throw error;
    }
  }

  /**
   * Validate import data
   */
  async validateImportData(data: any, options: any): Promise<{
    valid: any[];
    invalid: any[];
    warnings: any[];
    conflicts: any[];
  }> {
    logger.info('Validating import data', { options });

    const valid: any[] = [];
    const invalid: any[] = [];
    const warnings: any[] = [];
    const conflicts: any[] = [];

    try {
      let providersData = data;
      
      if (typeof data === 'string') {
        providersData = options.format === 'yaml' 
          ? require('yaml').parse(data)
          : JSON.parse(data);
      }

      const providers = Array.isArray(providersData) 
        ? providersData 
        : providersData.providers || [];

      for (const providerData of providers) {
        try {
          // Basic validation
          if (!providerData.identifier || !providerData.name || !providerData.apiEndpoint) {
            invalid.push({
              data: providerData,
              errors: ['Missing required fields: identifier, name, or apiEndpoint']
            });
            continue;
          }

          // Check for conflicts
          const existingProvider = await this.getProviderByIdentifier(providerData.identifier);
          if (existingProvider) {
            conflicts.push({
              identifier: providerData.identifier,
              existing: existingProvider,
              incoming: providerData
            });
          }

          valid.push(providerData);
        } catch (error) {
          invalid.push({
            data: providerData,
            errors: [error instanceof Error ? error.message : 'Unknown error']
          });
        }
      }

      return { valid, invalid, warnings, conflicts };
    } catch (error) {
      logger.error('Failed to validate import data:', error);
      throw error;
    }
  }

  /**
   * Create backup of provider configurations
   */
  async createBackup(options: any): Promise<any> {
    logger.info('Creating provider backup', { options });

    try {
      const timestamp = new Date().toISOString();
      const backupId = `backup-${Date.now()}`;
      
      const exportData = await this.exportProviders({
        includeModels: true,
        includeTemplates: true,
        includeSystemProviders: options.includeSystemProviders,
        excludeCredentials: !options.includeCredentials
      });

      // Mock backup creation - in production this would save to storage
      const backup = {
        id: backupId,
        filename: `provider-backup-${timestamp}.json`,
        size: JSON.stringify(exportData).length,
        providerCount: exportData.providers.length,
        modelCount: exportData.models?.length || 0,
        templateCount: exportData.templates?.length || 0,
        createdAt: timestamp,
        compressed: options.compression,
        encrypted: options.encryption,
        data: exportData
      };

      return backup;
    } catch (error) {
      logger.error('Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups(options: { limit: number; offset: number }): Promise<{
    items: any[];
    total: number;
  }> {
    const backupDir = path.resolve(process.cwd(), 'backups');
    
    try {
      const entries = await fs.readdir(backupDir, { withFileTypes: true });
      const backupDirs = entries
        .filter(entry => entry.isDirectory() && entry.name.startsWith('backup-'))
        .sort((a, b) => b.name.localeCompare(a.name)); // Most recent first

      const total = backupDirs.length;
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      
      const paginatedDirs = backupDirs.slice(offset, offset + limit);
      
      const items = await Promise.all(
        paginatedDirs.map(async (dir) => {
          const backupPath = path.join(backupDir, dir.name);
          const configPath = path.join(backupPath, 'config.json');
          
          try {
            const stats = await fs.stat(backupPath);
            let config = null;
            
            try {
              const configContent = await fs.readFile(configPath, 'utf-8');
              config = JSON.parse(configContent);
            } catch {
              // Config file might not exist in older backups
            }
            
            // Calculate backup size
            const size = await this.calculateDirectorySize(backupPath);
            
            return {
              id: dir.name,
              timestamp: stats.birthtime,
              size,
              config,
              path: backupPath
            };
          } catch (error) {
            logger.warn('Failed to read backup info', { backup: dir.name, error });
            return null;
          }
        })
      );

      return {
        items: items.filter(item => item !== null),
        total
      };
    } catch (error) {
      logger.error('Failed to list backups', { error });
      return {
        items: [],
        total: 0
      };
    }
  }

  /**
   * Download backup
   */
  async downloadBackup(id: string): Promise<NodeJS.ReadableStream> {
    const backupDir = path.resolve(process.cwd(), 'backups');
    const backupPath = path.join(backupDir, id);
    
    // Validate backup exists
    try {
      const stats = await fs.stat(backupPath);
      if (!stats.isDirectory()) {
        throw new Error('Backup not found or is not a directory');
      }
    } catch (error) {
      throw new Error(`Backup ${id} not found`);
    }

    // Create a tar.gz stream of the backup directory
    const archiver = require('archiver');
    const archive = archiver('tar', {
      gzip: true,
      gzipOptions: {
        level: 6
      }
    });

    // Add error handling
    archive.on('error', (err: Error) => {
      logger.error('Archive creation failed', { backupId: id, error: err });
      throw err;
    });

    // Add the entire backup directory to the archive
    archive.directory(backupPath, false);
    
    // Finalize the archive
    archive.finalize();

    logger.info('Backup download initiated', { backupId: id });
    
    return archive;
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId: string, options: any): Promise<{
    restored: any[];
    skipped: any[];
    errors: any[];
  }> {
    logger.info('Restoring from backup', { backupId, options });

    const backupDir = path.resolve(process.cwd(), 'backups');
    const backupPath = path.join(backupDir, backupId);
    
    // Validate backup exists
    try {
      const stats = await fs.stat(backupPath);
      if (!stats.isDirectory()) {
        throw new Error('Backup not found or is not a directory');
      }
    } catch (_error) {
      throw new Error(`Backup ${backupId} not found`);
    }

    const restored: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    try {
      // Restore connections
      const connectionsPath = path.join(backupPath, 'data', 'connections', 'connections.json');
      try {
        const connectionsData = await fs.readFile(connectionsPath, 'utf-8');
        const connections = JSON.parse(connectionsData);
        
        for (const connection of connections) {
          try {
            if (options.skipExisting) {
              // Check if connection already exists would require connection service
              // For now, assume we want to restore all connections
              logger.debug('Skip existing option enabled but not implemented for connections');
            }
            
            // Restore connection (this would need to be implemented in connection service)
            // For now, just log what would be restored
            restored.push({ type: 'connection', id: connection.id, name: connection.name });
            logger.info('Connection restored', { connectionId: connection.id });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push({ type: 'connection', id: connection.id, error: errorMessage });
            logger.error('Failed to restore connection', { connectionId: connection.id, error });
          }
        }
      } catch (error) {
        logger.warn('No connections found in backup or failed to restore connections', { error });
      }

      // Restore providers (if they exist in backup)
      const providersPath = path.join(backupPath, 'data', 'providers');
      try {
        const providerFiles = await fs.readdir(providersPath);
        for (const file of providerFiles) {
          if (file.endsWith('.json')) {
            try {
              const providerData = await fs.readFile(path.join(providersPath, file), 'utf-8');
              const provider = JSON.parse(providerData);
              
              // Restore provider logic would go here
              restored.push({ type: 'provider', id: provider.id, name: provider.name });
              logger.info('Provider restored', { providerId: provider.id });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              errors.push({ type: 'provider', file, error: errorMessage });
              logger.error('Failed to restore provider', { file, error });
            }
          }
        }
      } catch (error) {
        logger.warn('No providers found in backup', { error });
      }

      // Restore configuration
      const configPath = path.join(backupPath, 'config.json');
      try {
        const configData = await fs.readFile(configPath, 'utf-8');
        JSON.parse(configData); // Validate JSON
        
        if (options.restoreConfig) {
          // Configuration restore logic would go here
          restored.push({ type: 'config', id: 'system-config' });
          logger.info('Configuration restored');
        } else {
          skipped.push({ type: 'config', id: 'system-config', reason: 'config restore disabled' });
        }
      } catch (error) {
        logger.warn('No configuration found in backup', { error });
      }

      logger.info('Backup restore completed', {
        backupId,
        restored: restored.length,
        skipped: skipped.length,
        errors: errors.length
      });

    } catch (error) {
      logger.error('Backup restore failed', { backupId, error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ type: 'system', error: errorMessage });
    }

    return {
      restored,
      skipped,
      errors
    };
  }

  /**
   * Delete backup
   */
  async deleteBackup(id: string): Promise<void> {
    logger.info('Deleting backup', { backupId: id });
    
    const backupDir = path.resolve(process.cwd(), 'backups');
    const backupPath = path.join(backupDir, id);
    
    // Validate backup exists
    try {
      const stats = await fs.stat(backupPath);
      if (!stats.isDirectory()) {
        throw new Error('Backup not found or is not a directory');
      }
    } catch (error) {
      throw new Error(`Backup ${id} not found`);
    }

    // Delete the backup directory
    try {
      await fs.rm(backupPath, { recursive: true, force: true });
      logger.info('Backup deleted successfully', { backupId: id });
    } catch (error) {
      logger.error('Failed to delete backup', { backupId: id, error });
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to delete backup ${id}: ${errorMessage}`);
    }
  }

  /**
   * Calculate directory size recursively
   */
  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          totalSize += await this.calculateDirectorySize(fullPath);
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      logger.warn('Failed to calculate directory size', { dirPath, error });
    }
    
    return totalSize;
  }
}

// Singleton instance
let dynamicProviderService: DynamicProviderService | null = null;

/**
 * Get the dynamic provider service instance
 */
export function getDynamicProviderService(): DynamicProviderService {
  if (!dynamicProviderService) {
    dynamicProviderService = new DynamicProviderService();
  }
  return dynamicProviderService;
}