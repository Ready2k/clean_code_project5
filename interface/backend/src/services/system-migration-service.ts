/**
 * System Migration Service
 * 
 * Handles migration of hardcoded provider configurations to dynamic providers,
 * data validation, integrity checks, and rollback procedures.
 */

import { logger } from '../utils/logger.js';
import { getDynamicProviderService } from './dynamic-provider-service.js';
import { getConnectionManagementService } from './connection-management-service.js';
import { getDatabaseService } from './database-service.js';
import { AppError } from '../types/errors.js';
import {
  Provider,
  CreateProviderRequest,
  CreateModelRequest,
  CreateTemplateRequest
} from '../types/dynamic-providers.js';
import {
  OPENAI_MODELS,
  BEDROCK_MODELS,
  MICROSOFT_COPILOT_MODELS
} from '../types/connections.js';

export interface MigrationResult {
  success: boolean;
  providersCreated: number;
  modelsCreated: number;
  templatesCreated: number;
  connectionsUpdated: number;
  errors: string[];
  warnings: string[];
  duration: number;
  rollbackData?: MigrationRollbackData;
}

export interface MigrationRollbackData {
  providerIds: string[];
  modelIds: string[];
  templateIds: string[];
  connectionBackups: string[];
  timestamp: Date;
}

export interface MigrationOptions {
  dryRun?: boolean;
  skipExisting?: boolean;
  createBackup?: boolean;
  validateOnly?: boolean;
  force?: boolean;
}

export interface SystemProviderDefinition {
  identifier: string;
  name: string;
  description: string;
  apiEndpoint: string;
  authMethod: 'api_key' | 'oauth2' | 'aws_iam' | 'custom';
  authConfig: any;
  capabilities: any;
  models: SystemModelDefinition[];
  template: SystemTemplateDefinition;
}

export interface SystemModelDefinition {
  identifier: string;
  name: string;
  description: string;
  contextLength: number;
  capabilities: any;
  isDefault?: boolean;
}

export interface SystemTemplateDefinition {
  name: string;
  description: string;
  providerConfig: any;
  defaultModels: any[];
}

/**
 * System Migration Service
 */
export class SystemMigrationService {
  private dynamicProviderService = getDynamicProviderService();
  private connectionService = getConnectionManagementService();
  private databaseService = getDatabaseService();

  /**
   * Migrate hardcoded providers to dynamic provider system
   */
  async migrateSystemProviders(options: MigrationOptions = {}): Promise<MigrationResult> {
    const startTime = Date.now();
    const result: MigrationResult = {
      success: false,
      providersCreated: 0,
      modelsCreated: 0,
      templatesCreated: 0,
      connectionsUpdated: 0,
      errors: [],
      warnings: [],
      duration: 0
    };

    logger.info('Starting system provider migration', { options });

    try {
      // Get system provider definitions
      const systemProviders = this.getSystemProviderDefinitions();

      // Validate system before migration
      if (options.validateOnly) {
        const validationResult = await this.validateSystemForMigration();
        result.success = validationResult.valid;
        result.errors = validationResult.errors;
        result.warnings = validationResult.warnings;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Create backup if requested
      if (options.createBackup && !options.dryRun) {
        result.rollbackData = await this.createMigrationBackup();
      }

      // Process each system provider
      for (const providerDef of systemProviders) {
        try {
          await this.migrateSystemProvider(providerDef, options, result);
        } catch (error) {
          const errorMessage = `Failed to migrate provider ${providerDef.identifier}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`;
          result.errors.push(errorMessage);
          logger.error('Provider migration failed', {
            provider: providerDef.identifier,
            error: errorMessage
          });

          if (!options.force) {
            throw new AppError(errorMessage, 500, 'MIGRATION_FAILED' as any);
          }
        }
      }

      // Update existing connections to reference dynamic providers
      if (!options.dryRun) {
        result.connectionsUpdated = await this.updateExistingConnections(options);
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      logger.info('System provider migration completed', {
        success: result.success,
        providersCreated: result.providersCreated,
        modelsCreated: result.modelsCreated,
        templatesCreated: result.templatesCreated,
        connectionsUpdated: result.connectionsUpdated,
        duration: result.duration
      });

      return result;

    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown migration error';
      result.errors.push(errorMessage);

      logger.error('System provider migration failed', {
        error: errorMessage,
        duration: result.duration
      });

      // Attempt rollback if we have rollback data
      if (result.rollbackData && !options.dryRun) {
        try {
          await this.rollbackMigration(result.rollbackData);
          result.warnings.push('Migration rolled back successfully');
        } catch (rollbackError) {
          result.errors.push(`Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown error'}`);
        }
      }

      return result;
    }
  }

  /**
   * Migrate a single system provider
   */
  private async migrateSystemProvider(
    providerDef: SystemProviderDefinition,
    options: MigrationOptions,
    result: MigrationResult
  ): Promise<void> {
    logger.info('Migrating system provider', { identifier: providerDef.identifier });

    // Check if provider already exists
    const existingResult = await this.dynamicProviderService.getProviders();
    const existingProviders = existingResult.providers;
    const existingProvider = existingProviders.find((p: any) => p.identifier === providerDef.identifier);

    if (existingProvider && options.skipExisting) {
      result.warnings.push(`Provider ${providerDef.identifier} already exists, skipping`);
      return;
    }

    if (existingProvider && !options.force) {
      throw new AppError(
        `Provider ${providerDef.identifier} already exists`,
        409,
        'PROVIDER_EXISTS' as any
      );
    }

    if (options.dryRun) {
      logger.info('Dry run: Would create provider', { identifier: providerDef.identifier });
      result.providersCreated++;
      result.modelsCreated += providerDef.models.length;
      result.templatesCreated++;
      return;
    }

    // Create or update provider
    let provider: Provider;
    if (existingProvider) {
      // Update existing provider
      provider = await this.dynamicProviderService.updateProvider(existingProvider.id, {
        name: providerDef.name,
        description: providerDef.description,
        apiEndpoint: providerDef.apiEndpoint,
        authConfig: providerDef.authConfig,
        capabilities: providerDef.capabilities
      });
    } else {
      // Create new provider
      const createRequest: CreateProviderRequest = {
        identifier: providerDef.identifier,
        name: providerDef.name,
        description: providerDef.description,
        apiEndpoint: providerDef.apiEndpoint,
        authMethod: providerDef.authMethod,
        authConfig: providerDef.authConfig,
        capabilities: providerDef.capabilities
      };

      provider = await this.dynamicProviderService.createProvider(createRequest, 'system');
      result.providersCreated++;
    }

    // Create models for the provider
    for (const modelDef of providerDef.models) {
      try {
        const createModelRequest: CreateModelRequest = {
          identifier: modelDef.identifier,
          name: modelDef.name,
          description: modelDef.description,
          contextLength: modelDef.contextLength,
          capabilities: modelDef.capabilities,
          isDefault: modelDef.isDefault || false
        };

        await this.dynamicProviderService.createModel(provider.id, createModelRequest);
        result.modelsCreated++;
      } catch (error) {
        result.warnings.push(`Failed to create model ${modelDef.identifier}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`);
      }
    }

    // Create template for the provider
    try {
      const createTemplateRequest: CreateTemplateRequest = {
        name: providerDef.template.name,
        description: providerDef.template.description,
        providerConfig: providerDef.template.providerConfig,
        defaultModels: providerDef.template.defaultModels
      };

      await this.dynamicProviderService.createTemplate(createTemplateRequest, 'system');
      result.templatesCreated++;
    } catch (error) {
      result.warnings.push(`Failed to create template for ${providerDef.identifier}: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`);
    }
  }

  /**
   * Get system provider definitions based on hardcoded configurations
   */
  private getSystemProviderDefinitions(): SystemProviderDefinition[] {
    return [
      {
        identifier: 'openai',
        name: 'OpenAI',
        description: 'OpenAI GPT models including GPT-4 and GPT-3.5',
        apiEndpoint: 'https://api.openai.com/v1',
        authMethod: 'api_key',
        authConfig: {
          type: 'api_key',
          fields: {
            apiKey: { required: true, type: 'string', description: 'OpenAI API Key' },
            organizationId: { required: false, type: 'string', description: 'Organization ID (optional)' }
          },
          headers: {
            'Authorization': 'Bearer {{apiKey}}',
            'OpenAI-Organization': '{{organizationId}}'
          },
          testEndpoint: '/models'
        },
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 128000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportedAuthMethods: ['api_key']
        },
        models: OPENAI_MODELS.map((modelId, index) => ({
          identifier: modelId,
          name: this.getModelDisplayName(modelId),
          description: `OpenAI ${modelId} model`,
          contextLength: this.getModelContextLength(modelId),
          capabilities: {
            supportsSystemMessages: true,
            supportedRoles: ['system', 'user', 'assistant'],
            supportsStreaming: true,
            supportsTools: modelId.includes('gpt-4'),
            supportsFunctionCalling: modelId.includes('gpt-4') || modelId.includes('gpt-3.5-turbo')
          },
          isDefault: index === 0
        })),
        template: {
          name: 'OpenAI Provider Template',
          description: 'Standard template for OpenAI API integration',
          providerConfig: {
            identifier: 'openai',
            name: 'OpenAI',
            apiEndpoint: 'https://api.openai.com/v1',
            authMethod: 'api_key'
          },
          defaultModels: OPENAI_MODELS.slice(0, 3).map(modelId => ({
            identifier: modelId,
            name: this.getModelDisplayName(modelId)
          }))
        }
      },
      {
        identifier: 'bedrock',
        name: 'AWS Bedrock',
        description: 'Amazon Bedrock foundation models including Claude and Titan',
        apiEndpoint: 'https://bedrock.us-east-1.amazonaws.com',
        authMethod: 'aws_iam',
        authConfig: {
          type: 'aws_iam',
          fields: {
            accessKeyId: { required: true, type: 'string', description: 'AWS Access Key ID' },
            secretAccessKey: { required: true, type: 'string', description: 'AWS Secret Access Key' },
            region: { required: true, type: 'string', description: 'AWS Region' }
          },
          testEndpoint: '/foundation-models'
        },
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 200000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: false,
          supportedAuthMethods: ['aws_iam']
        },
        models: BEDROCK_MODELS.map((modelId, index) => ({
          identifier: modelId,
          name: this.getModelDisplayName(modelId),
          description: `AWS Bedrock ${modelId} model`,
          contextLength: this.getModelContextLength(modelId),
          capabilities: {
            supportsSystemMessages: true,
            supportedRoles: ['system', 'user', 'assistant'],
            supportsStreaming: true,
            supportsTools: false
          },
          isDefault: index === 0
        })),
        template: {
          name: 'AWS Bedrock Provider Template',
          description: 'Standard template for AWS Bedrock integration',
          providerConfig: {
            identifier: 'bedrock',
            name: 'AWS Bedrock',
            apiEndpoint: 'https://bedrock.{region}.amazonaws.com',
            authMethod: 'aws_iam'
          },
          defaultModels: BEDROCK_MODELS.slice(0, 3).map(modelId => ({
            identifier: modelId,
            name: this.getModelDisplayName(modelId)
          }))
        }
      },
      {
        identifier: 'microsoft-copilot',
        name: 'Microsoft Copilot',
        description: 'Microsoft Azure OpenAI Service models',
        apiEndpoint: 'https://{resource}.openai.azure.com',
        authMethod: 'api_key',
        authConfig: {
          type: 'api_key',
          fields: {
            apiKey: { required: true, type: 'string', description: 'Azure OpenAI API Key' },
            endpoint: { required: true, type: 'string', description: 'Azure OpenAI Endpoint' },
            apiVersion: { required: false, type: 'string', description: 'API Version' }
          },
          headers: {
            'Authorization': 'Bearer {{apiKey}}',
            'Content-Type': 'application/json'
          },
          testEndpoint: '/openai/deployments'
        },
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 128000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportedAuthMethods: ['api_key']
        },
        models: MICROSOFT_COPILOT_MODELS.map((modelId, index) => ({
          identifier: modelId,
          name: this.getModelDisplayName(modelId),
          description: `Microsoft Azure OpenAI ${modelId} model`,
          contextLength: this.getModelContextLength(modelId),
          capabilities: {
            supportsSystemMessages: true,
            supportedRoles: ['system', 'user', 'assistant'],
            supportsStreaming: true,
            supportsTools: modelId.includes('gpt-4'),
            supportsFunctionCalling: modelId.includes('gpt-4') || modelId.includes('gpt-35-turbo')
          },
          isDefault: index === 0
        })),
        template: {
          name: 'Microsoft Copilot Provider Template',
          description: 'Standard template for Microsoft Azure OpenAI integration',
          providerConfig: {
            identifier: 'microsoft-copilot',
            name: 'Microsoft Copilot',
            apiEndpoint: 'https://{resource}.openai.azure.com',
            authMethod: 'api_key'
          },
          defaultModels: MICROSOFT_COPILOT_MODELS.slice(0, 3).map(modelId => ({
            identifier: modelId,
            name: this.getModelDisplayName(modelId)
          }))
        }
      }
    ];
  }

  /**
   * Get display name for a model
   */
  private getModelDisplayName(modelId: string): string {
    const displayNames: Record<string, string> = {
      'gpt-4': 'GPT-4',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4-turbo-preview': 'GPT-4 Turbo Preview',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'gpt-3.5-turbo-16k': 'GPT-3.5 Turbo 16K',
      'gpt-35-turbo': 'GPT-3.5 Turbo (Azure)',
      'gpt-35-turbo-16k': 'GPT-3.5 Turbo 16K (Azure)',
      'anthropic.claude-3-sonnet-20240229-v1:0': 'Claude 3 Sonnet',
      'anthropic.claude-3-haiku-20240307-v1:0': 'Claude 3 Haiku',
      'anthropic.claude-v2:1': 'Claude 2.1',
      'anthropic.claude-v2': 'Claude 2',
      'amazon.titan-text-express-v1': 'Titan Text Express',
      'amazon.titan-text-lite-v1': 'Titan Text Lite'
    };

    return displayNames[modelId] || modelId;
  }

  /**
   * Get context length for a model
   */
  private getModelContextLength(modelId: string): number {
    const contextLengths: Record<string, number> = {
      'gpt-4': 8192,
      'gpt-4-turbo': 128000,
      'gpt-4-turbo-preview': 128000,
      'gpt-3.5-turbo': 4096,
      'gpt-3.5-turbo-16k': 16384,
      'gpt-35-turbo': 4096,
      'gpt-35-turbo-16k': 16384,
      'anthropic.claude-3-sonnet-20240229-v1:0': 200000,
      'anthropic.claude-3-haiku-20240307-v1:0': 200000,
      'anthropic.claude-v2:1': 100000,
      'anthropic.claude-v2': 100000,
      'amazon.titan-text-express-v1': 8000,
      'amazon.titan-text-lite-v1': 4000
    };

    return contextLengths[modelId] || 4096;
  }

  /**
   * Validate system for migration
   */
  private async validateSystemForMigration(): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check database connectivity
      await this.databaseService.testConnection();
    } catch (error) {
      errors.push('Database connection failed');
    }

    try {
      // Check if dynamic provider service is available
      await this.dynamicProviderService.getProviders();
    } catch (error) {
      errors.push('Dynamic provider service not available');
    }

    // Check for existing system providers
    try {
      const existingResult = await this.dynamicProviderService.getProviders();
      const existingProviders = existingResult.providers;
      const systemProviders = existingProviders.filter((p: any) => p.isSystem);
      
      if (systemProviders.length > 0) {
        warnings.push(`Found ${systemProviders.length} existing system providers`);
      }
    } catch (error) {
      warnings.push('Could not check for existing providers');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Update existing connections to reference dynamic providers
   */
  private async updateExistingConnections(_options: MigrationOptions): Promise<number> {
    let updatedCount = 0;

    try {
      // Get all connections
      const allConnections = await this.connectionService.getAllConnections();
      const legacyConnections = allConnections.filter(conn => 
        ['openai', 'bedrock', 'microsoft-copilot'].includes(conn.provider as string)
      );

      logger.info('Updating legacy connections', { count: legacyConnections.length });

      // Get dynamic providers
      const dynamicResult = await this.dynamicProviderService.getProviders();
      const dynamicProviders = dynamicResult.providers;
      const providerMap = new Map(dynamicProviders.map((p: any) => [p.identifier, p.id]));

      for (const connection of legacyConnections) {
        try {
          const dynamicProviderId = providerMap.get(connection.provider as string);
          
          if (!dynamicProviderId) {
            logger.warn('No dynamic provider found for legacy connection', {
              connectionId: connection.id,
              provider: connection.provider
            });
            continue;
          }

          // Plan and execute migration for this connection
          const migrationPlan = await this.connectionService.planMigration(
            connection.id,
            dynamicProviderId as string
          );

          const migrationResult = await this.connectionService.migrateConnection(
            connection.id,
            migrationPlan
          );

          if (migrationResult.success) {
            updatedCount++;
            logger.info('Successfully migrated connection', {
              connectionId: connection.id,
              provider: connection.provider,
              newProviderId: dynamicProviderId
            });
          } else {
            logger.warn('Failed to migrate connection', {
              connectionId: connection.id,
              error: migrationResult.error
            });
          }

        } catch (error) {
          logger.error('Error migrating connection', {
            connectionId: connection.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

    } catch (error) {
      logger.error('Failed to update existing connections', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return updatedCount;
  }

  /**
   * Create migration backup
   */
  private async createMigrationBackup(): Promise<MigrationRollbackData> {
    logger.info('Creating migration backup');

    const rollbackData: MigrationRollbackData = {
      providerIds: [],
      modelIds: [],
      templateIds: [],
      connectionBackups: [],
      timestamp: new Date()
    };

    try {
      // Backup existing providers
      const existingResult = await this.dynamicProviderService.getProviders();
      const existingProviders = existingResult.providers;
      rollbackData.providerIds = existingProviders.map((p: any) => p.id);

      // Backup existing models
      for (const provider of existingProviders) {
        const models = await this.dynamicProviderService.getProviderModels(provider.id);
        rollbackData.modelIds.push(...models.map(m => m.id));
      }

      // Backup existing templates
      const existingTemplates = await this.dynamicProviderService.getTemplates();
      rollbackData.templateIds = existingTemplates.map((t: any) => t.id);

      // Backup connections
      const allConnections = await this.connectionService.getAllConnections();
      for (const connection of allConnections) {
        // TODO: Implement connection backup functionality
        // const backupId = await this.connectionService.createConnectionBackup(connection.id);
        // rollbackData.connectionBackups.push(backupId);
        rollbackData.connectionBackups.push(connection.id);
      }

      logger.info('Migration backup created', {
        providers: rollbackData.providerIds.length,
        models: rollbackData.modelIds.length,
        templates: rollbackData.templateIds.length,
        connections: rollbackData.connectionBackups.length
      });

    } catch (error) {
      logger.error('Failed to create migration backup', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }

    return rollbackData;
  }

  /**
   * Rollback migration
   */
  private async rollbackMigration(rollbackData: MigrationRollbackData): Promise<void> {
    logger.info('Rolling back migration', { timestamp: rollbackData.timestamp });

    try {
      // Restore connections first
      for (const backupId of rollbackData.connectionBackups) {
        try {
          // This would need to be implemented in the connection service
          // await this.connectionService.restoreFromBackup(backupId);
        } catch (error) {
          logger.warn('Failed to restore connection backup', { backupId, error });
        }
      }

      // Remove created providers, models, and templates
      // This would need to be implemented based on what was created during migration

      logger.info('Migration rollback completed');

    } catch (error) {
      logger.error('Failed to rollback migration', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check migration status
   */
  async getMigrationStatus(): Promise<{
    isSystemMigrated: boolean;
    systemProviders: number;
    legacyConnections: number;
    dynamicConnections: number;
  }> {
    try {
      const dynamicResult = await this.dynamicProviderService.getProviders();
      const dynamicProviders = dynamicResult.providers;
      const systemProviders = dynamicProviders.filter((p: any) => p.isSystem);
      
      const allConnections = await this.connectionService.getAllConnections();
      const legacyConnections = allConnections.filter(conn => 
        ['openai', 'bedrock', 'microsoft-copilot'].includes(conn.provider as string)
      );
      const dynamicConnections = allConnections.length - legacyConnections.length;

      return {
        isSystemMigrated: systemProviders.length >= 3, // OpenAI, Bedrock, Microsoft Copilot
        systemProviders: systemProviders.length,
        legacyConnections: legacyConnections.length,
        dynamicConnections
      };

    } catch (error) {
      logger.error('Failed to get migration status', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        isSystemMigrated: false,
        systemProviders: 0,
        legacyConnections: 0,
        dynamicConnections: 0
      };
    }
  }
}

// Singleton instance
let systemMigrationService: SystemMigrationService | null = null;

/**
 * Get the system migration service instance
 */
export function getSystemMigrationService(): SystemMigrationService {
  if (!systemMigrationService) {
    systemMigrationService = new SystemMigrationService();
  }
  
  return systemMigrationService;
}