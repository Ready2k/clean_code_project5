import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { ConnectionStorageService } from './connection-storage-service.js';
import { ConnectionTestingService } from './connection-testing-service.js';
import { getDynamicProviderService } from './dynamic-provider-service.js';
// Removed unused provider registry service import
import { 
  LLMConnection, 
  CreateConnectionRequest, 
  UpdateConnectionRequest,
  ConnectionTestResult,
  OPENAI_MODELS,
  BEDROCK_MODELS,
  MICROSOFT_COPILOT_MODELS,
  OpenAIConfig,
  BedrockConfig,
  MicrosoftCopilotConfig
} from '../types/connections.js';
import {
  ExtendedLLMConnection,
  ExtendedCreateConnectionRequest,
  ExtendedConnectionTestResult,
  DynamicConnectionConfig,
  ConnectionMigrationPlan,
  ConnectionMigrationResult,
  BatchMigrationRequest,
  BatchMigrationResult,
  CompatibilityCheckResult,
  ExtendedConnectionService,
  isLegacyConnection,
  isDynamicConnection,
  ExtendedConnectionErrorCode
} from '../types/extended-connections.js';
// Removed unused dynamic provider imports
import { AppError, ValidationError, NotFoundError } from '../types/errors.js';

export interface ConnectionManagementServiceConfig {
  storageDir?: string;
}

export class ConnectionManagementService extends EventEmitter implements ExtendedConnectionService {
  private storageService: ConnectionStorageService;
  private initialized = false;

  constructor(config: ConnectionManagementServiceConfig = {}) {
    super();
    this.storageService = new ConnectionStorageService(config.storageDir);
  }

  /**
   * Initialize the connection management service
   */
  public async initialize(): Promise<void> {
    try {
      await this.storageService.initialize();
      this.initialized = true;
      
      logger.info('Connection management service initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize connection management service:', error);
      throw error;
    }
  }

  /**
   * Create a new LLM connection (legacy method for backward compatibility)
   */
  public async createConnection(
    userId: string, 
    request: CreateConnectionRequest
  ): Promise<LLMConnection> {
    // Convert to extended request and delegate
    const extendedRequest: ExtendedCreateConnectionRequest = {
      name: request.name,
      provider: request.provider,
      config: request.config
    };
    
    const extendedConnection = await this.createLegacyConnection(userId, extendedRequest);
    
    // Convert back to legacy format for backward compatibility
    return {
      id: extendedConnection.id,
      name: extendedConnection.name,
      provider: extendedConnection.provider!,
      config: extendedConnection.config!,
      status: extendedConnection.status,
      createdAt: extendedConnection.createdAt,
      updatedAt: extendedConnection.updatedAt,
      lastTested: extendedConnection.lastTested || new Date(),
      userId: extendedConnection.userId
    };
  }

  /**
   * Create a legacy connection (for backward compatibility)
   */
  public async createLegacyConnection(
    userId: string, 
    request: ExtendedCreateConnectionRequest
  ): Promise<ExtendedLLMConnection> {
    this.ensureInitialized();
    
    try {
      // Validate the request
      this.validateExtendedCreateConnectionRequest(request);
      
      if (request.provider && request.config) {
        // Legacy provider connection
        ConnectionTestingService.validateConfig(request.provider, request.config);
        
        // Set default models if not provided
        const configWithDefaults = this.setDefaultModels(request.provider, request.config);
        
        // Create the connection
        const connection = await this.storageService.createExtendedConnection(userId, {
          ...request,
          config: configWithDefaults,
          connectionType: 'legacy'
        });
        
        logger.info('Created new legacy connection', {
          connectionId: connection.id,
          name: connection.name,
          provider: connection.provider,
          userId
        });
        
        this.emit('connectionCreated', { connection, userId });
        return connection;
      } else {
        throw new ValidationError('Legacy connection requires provider and config');
      }
      
    } catch (error) {
      logger.error('Failed to create legacy connection:', error);
      throw error;
    }
  }

  /**
   * Create a dynamic provider connection
   */
  public async createDynamicConnection(
    userId: string, 
    providerId: string, 
    config: DynamicConnectionConfig
  ): Promise<ExtendedLLMConnection> {
    this.ensureInitialized();
    
    try {
      // Validate provider exists and is active
      const dynamicProviderService = getDynamicProviderService();
      const provider = await dynamicProviderService.getProvider(providerId);
      
      if (provider.status !== 'active') {
        throw new AppError(
          `Provider ${provider.name} is not active`,
          400,
          ExtendedConnectionErrorCode.DYNAMIC_PROVIDER_INACTIVE as any
        );
      }

      // Validate dynamic configuration
      this.validateDynamicConnectionConfig(config);
      
      // Get available models for the provider
      const models = await dynamicProviderService.getProviderModels(providerId);
      const availableModelIds = models.map(m => m.identifier);
      
      // Set default model if not specified
      if (!config.modelPreferences?.defaultModel && models.length > 0) {
        const defaultModel = models.find(m => m.isDefault) || models[0];
        config.modelPreferences = {
          ...config.modelPreferences,
          defaultModel: defaultModel?.identifier || ''
        };
      }
      
      // Create the connection
      const connection = await this.storageService.createExtendedConnection(userId, {
        name: `${provider.name} Connection`,
        providerId,
        dynamicConfig: config,
        selectedModels: config.modelPreferences?.preferredModels || availableModelIds,
        connectionType: 'dynamic'
      });
      
      logger.info('Created new dynamic connection', {
        connectionId: connection.id,
        name: connection.name,
        providerId,
        userId
      });
      
      // Test connection asynchronously
      this.testConnectionAsync(userId, connection.id).catch(error => {
        logger.warn('Initial connection test failed', {
          connectionId: connection.id,
          error: error.message
        });
      });
      
      this.emit('connectionCreated', { connection, userId });
      return connection;
      
    } catch (error) {
      logger.error('Failed to create dynamic connection:', error);
      throw error;
    }
  }

  /**
   * Get all connections for a user
   */
  public async getConnections(userId: string): Promise<LLMConnection[]> {
    this.ensureInitialized();
    
    try {
      const connections = await this.storageService.getConnections(userId);
      
      logger.debug('Retrieved connections for user', {
        userId,
        count: connections.length
      });
      
      return connections;
    } catch (error) {
      logger.error('Failed to get connections:', error);
      throw error;
    }
  }

  /**
   * Get all connections across all users (for system monitoring)
   */
  public async getAllConnections(): Promise<LLMConnection[]> {
    this.ensureInitialized();
    
    try {
      const connections = await this.storageService.getAllConnections();
      
      logger.debug('Retrieved all connections', {
        count: connections.length
      });
      
      return connections;
    } catch (error) {
      logger.error('Failed to get all connections:', error);
      throw error;
    }
  }

  /**
   * Get a specific connection by ID (legacy method for backward compatibility)
   */
  public async getConnection(userId: string, connectionId: string): Promise<ExtendedLLMConnection> {
    const extendedConnection = await this.getExtendedConnection(userId, connectionId);
    
    return extendedConnection;
  }

  /**
   * Get a specific extended connection by ID
   */
  public async getExtendedConnection(userId: string, connectionId: string): Promise<ExtendedLLMConnection> {
    this.ensureInitialized();
    
    try {
      const connection = await this.storageService.getExtendedConnection(userId, connectionId);
      
      logger.debug('Retrieved extended connection', {
        connectionId,
        userId,
        name: connection.name,
        type: connection.connectionType
      });
      
      return connection;
    } catch (error) {
      logger.error('Failed to get extended connection:', error);
      throw error;
    }
  }

  /**
   * Update a connection
   */
  public async updateConnection(
    userId: string,
    connectionId: string,
    request: UpdateConnectionRequest
  ): Promise<ExtendedLLMConnection> {
    this.ensureInitialized();
    
    try {
      // Validate the request
      this.validateUpdateConnectionRequest(request);
      
      // If config is being updated, validate it
      if (request.config) {
        const existingConnection = await this.storageService.getConnection(userId, connectionId);
        ConnectionTestingService.validateConfig(existingConnection.provider, {
          ...existingConnection.config,
          ...request.config
        });
      }
      
      const connection = await this.storageService.updateConnection(userId, connectionId, request);
      
      logger.info('Updated connection', {
        connectionId,
        userId,
        updatedFields: Object.keys(request)
      });
      
      this.emit('connectionUpdated', { connection, userId });
      return { ...connection, connectionType: 'legacy' as const } as ExtendedLLMConnection;
      
    } catch (error) {
      logger.error('Failed to update connection:', error);
      throw error;
    }
  }

  /**
   * Delete a connection
   */
  public async deleteConnection(userId: string, connectionId: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      // Get connection info before deletion for logging
      const connection = await this.storageService.getConnection(userId, connectionId);
      
      await this.storageService.deleteConnection(userId, connectionId);
      
      logger.info('Deleted connection', {
        connectionId,
        userId,
        name: connection.name
      });
      
      this.emit('connectionDeleted', { connectionId, userId, connection });
      
    } catch (error) {
      logger.error('Failed to delete connection:', error);
      throw error;
    }
  }

  /**
   * Test a connection (legacy method for backward compatibility)
   */
  public async testConnection(userId: string, connectionId: string): Promise<ConnectionTestResult> {
    const extendedResult = await this.testExtendedConnection(userId, connectionId);
    
    // Convert to legacy format
    return {
      success: extendedResult.success,
      latency: extendedResult.latency || 0,
      error: extendedResult.error || '',
      availableModels: extendedResult.availableModels || [],
      testedAt: extendedResult.testedAt
    };
  }

  /**
   * Test an extended connection (supports both legacy and dynamic providers)
   */
  public async testExtendedConnection(userId: string, connectionId: string): Promise<ExtendedConnectionTestResult> {
    this.ensureInitialized();
    
    try {
      // Get the extended connection
      const connection = await this.getExtendedConnection(userId, connectionId);
      
      logger.info('Testing extended connection', {
        connectionId,
        userId,
        type: connection.connectionType,
        name: connection.name
      });
      
      this.emit('connectionTestStarted', { connectionId, userId });
      
      let testResult: ExtendedConnectionTestResult;
      
      if (isLegacyConnection(connection)) {
        // Test legacy connection
        testResult = await this.testLegacyConnection(userId, connectionId, connection);
      } else if (isDynamicConnection(connection)) {
        // Test dynamic connection
        testResult = await this.testDynamicConnection(userId, connectionId, connection);
      } else {
        throw new AppError(
          'Invalid connection type',
          400,
          'INVALID_CONNECTION_TYPE' as any
        );
      }
      
      // Update the connection status based on test result
      await this.storageService.updateConnectionTestResult(
        userId,
        connectionId,
        testResult.success,
        testResult.error
      );
      
      logger.info('Extended connection test completed', {
        connectionId,
        userId,
        success: testResult.success,
        latency: testResult.latency,
        error: testResult.error
      });
      
      this.emit('connectionTestCompleted', { 
        connectionId, 
        userId, 
        testResult 
      });
      
      return testResult;
      
    } catch (error) {
      logger.error('Failed to test extended connection:', error);
      
      // Update connection status to error
      try {
        await this.storageService.updateConnectionTestResult(
          userId,
          connectionId,
          false,
          error instanceof Error ? error.message : 'Unknown error'
        );
      } catch (updateError) {
        logger.error('Failed to update connection status after test failure:', updateError);
      }
      
      this.emit('connectionTestFailed', { connectionId, userId, error });
      throw error;
    }
  }

  /**
   * Test a legacy connection
   */
  private async testLegacyConnection(
    userId: string, 
    connectionId: string, 
    connection: ExtendedLLMConnection
  ): Promise<ExtendedConnectionTestResult> {
    const config = await this.storageService.getDecryptedConfig(userId, connectionId);
    
    let baseResult: ConnectionTestResult;
    
    // Test based on provider type
    if (connection.provider === 'openai') {
      baseResult = await ConnectionTestingService.testOpenAIConnection(config as OpenAIConfig);
    } else if (connection.provider === 'microsoft-copilot') {
      baseResult = await ConnectionTestingService.testMicrosoftCopilotConnection(config as MicrosoftCopilotConfig);
    } else if (connection.provider === 'bedrock') {
      baseResult = await ConnectionTestingService.testBedrockConnection(config as BedrockConfig);
    } else {
      throw new AppError(
        `Unsupported legacy provider: ${connection.provider}`,
        400,
        'UNSUPPORTED_PROVIDER' as any
      );
    }
    
    // Enhance with provider information
    return {
      ...baseResult,
      providerInfo: {
        id: connection.provider!,
        name: connection.provider!,
        capabilities: ['legacy']
      }
    };
  }

  /**
   * Test a dynamic connection
   */
  private async testDynamicConnection(
    _userId: string, 
    _connectionId: string, 
    connection: ExtendedLLMConnection
  ): Promise<ExtendedConnectionTestResult> {
    const dynamicProviderService = getDynamicProviderService();
    
    // Get provider information
    const provider = await dynamicProviderService.getProvider(connection.providerId!);
    
    if (provider.status !== 'active') {
      return {
        success: false,
        error: `Provider ${provider.name} is not active`,
        testedAt: new Date(),
        providerInfo: {
          id: provider.id,
          name: provider.name,
          capabilities: Object.keys(provider.capabilities)
        }
      };
    }
    
    // Test provider connectivity
    const providerTestResult = await dynamicProviderService.testProvider(connection.providerId!);
    
    if (!providerTestResult.success) {
      return {
        success: false,
        error: providerTestResult.error || 'Provider test failed',
        latency: providerTestResult.latency || 0,
        testedAt: new Date(),
        providerInfo: {
          id: provider.id,
          name: provider.name,
          capabilities: Object.keys(provider.capabilities)
        }
      };
    }
    
    // Test model availability
    const models = await dynamicProviderService.getProviderModels(connection.providerId!);
    const selectedModels = connection.selectedModels || [];
    
    const modelTests = await Promise.all(
      selectedModels.map(async (modelId) => {
        const model = models.find(m => m.identifier === modelId);
        if (!model) {
          return {
            identifier: modelId,
            name: modelId,
            available: false,
            error: 'Model not found'
          };
        }
        
        try {
          const modelTestResult = await dynamicProviderService.testModel(model.id);
          return {
            identifier: model.identifier,
            name: model.name,
            available: modelTestResult.success,
            latency: modelTestResult.latency || 0,
            error: modelTestResult.error || ''
          };
        } catch (error) {
          return {
            identifier: model.identifier,
            name: model.name,
            available: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      })
    );
    
    const availableModels = modelTests.filter(m => m.available);
    const avgLatency = modelTests
      .filter(m => m.latency)
      .reduce((sum, m) => sum + (m.latency || 0), 0) / modelTests.length;
    
    return {
      success: providerTestResult.success && availableModels.length > 0,
      latency: providerTestResult.latency || 0,
      availableModels: availableModels.map(m => m.identifier),
      testedAt: new Date(),
      providerInfo: {
        id: provider.id,
        name: provider.name,
        capabilities: Object.keys(provider.capabilities)
      },
      modelAvailability: {
        total: modelTests.length,
        available: availableModels.length,
        unavailable: modelTests.length - availableModels.length,
        models: modelTests
      },
      performance: {
        averageLatency: avgLatency || 0,
        minLatency: Math.min(...modelTests.map(m => m.latency || 0)),
        maxLatency: Math.max(...modelTests.map(m => m.latency || 0)),
        successRate: availableModels.length / modelTests.length
      }
    };
  }

  /**
   * Test connection asynchronously (for background testing)
   */
  private async testConnectionAsync(userId: string, connectionId: string): Promise<void> {
    try {
      await this.testExtendedConnection(userId, connectionId);
    } catch (error) {
      logger.warn('Async connection test failed', {
        userId,
        connectionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get available models for a provider
   */
  public getAvailableModels(provider: 'openai' | 'bedrock' | 'microsoft-copilot'): string[] {
    if (provider === 'openai') {
      return [...OPENAI_MODELS];
    } else if (provider === 'microsoft-copilot') {
      return [...MICROSOFT_COPILOT_MODELS];
    } else if (provider === 'bedrock') {
      return [...BEDROCK_MODELS];
    } else {
      throw new AppError(
        `Unsupported provider: ${provider}`,
        400,
        'UNSUPPORTED_PROVIDER' as any
      );
    }
  }

  /**
   * Get connection statistics
   */
  public async getConnectionStats(userId?: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    error: number;
    byProvider: Record<string, number>;
  }> {
    this.ensureInitialized();
    
    try {
      let connections: LLMConnection[];
      
      if (userId) {
        connections = await this.storageService.getConnections(userId);
      } else {
        // For admin users, get all connections
        const allConnections = await this.storageService.getConnections(''); // This would need to be modified to get all
        connections = allConnections;
      }
      
      const stats = {
        total: connections.length,
        active: connections.filter(c => c.status === 'active').length,
        inactive: connections.filter(c => c.status === 'inactive').length,
        error: connections.filter(c => c.status === 'error').length,
        byProvider: connections.reduce((acc, conn) => {
          acc[conn.provider] = (acc[conn.provider] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
      
      return stats;
    } catch (error) {
      logger.error('Failed to get connection stats:', error);
      throw error;
    }
  }

  /**
   * Test all connections for a user
   */
  public async testAllConnections(userId: string): Promise<Record<string, ConnectionTestResult>> {
    this.ensureInitialized();
    
    try {
      const connections = await this.storageService.getConnections(userId);
      const results: Record<string, ConnectionTestResult> = {};
      
      logger.info('Testing all connections for user', {
        userId,
        connectionCount: connections.length
      });
      
      // Test connections in parallel (with some concurrency limit)
      const testPromises = connections.map(async (connection) => {
        try {
          const result = await this.testConnection(userId, connection.id);
          results[connection.id] = result;
        } catch (error) {
          results[connection.id] = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            testedAt: new Date()
          };
        }
      });
      
      await Promise.all(testPromises);
      
      logger.info('Completed testing all connections', {
        userId,
        totalTests: Object.keys(results).length,
        successfulTests: Object.values(results).filter(r => r.success).length
      });
      
      return results;
    } catch (error) {
      logger.error('Failed to test all connections:', error);
      throw error;
    }
  }

  // ============================================================================
  // Migration Methods
  // ============================================================================

  /**
   * Plan migration from legacy to dynamic provider
   */
  public async planMigration(connectionId: string, targetProviderId?: string): Promise<ConnectionMigrationPlan> {
    this.ensureInitialized();
    
    try {
      // Get the connection (assuming it's a legacy connection)
      const connection = await this.storageService.getExtendedConnection('', connectionId); // Admin access
      
      if (!isLegacyConnection(connection)) {
        throw new AppError(
          'Connection is not a legacy connection',
          400,
          'INVALID_CONNECTION_TYPE' as any
        );
      }
      
      // Determine target provider
      let targetProvider: string;
      if (targetProviderId) {
        targetProvider = targetProviderId;
      } else {
        // Use default mapping
        const dynamicProviderService = getDynamicProviderService();
        const result = await dynamicProviderService.getProviders();
        const providers = result.providers;
        const matchingProvider = providers.find((p: any) => 
          p.identifier === connection.provider && p.isSystem
        );
        
        if (!matchingProvider) {
          throw new NotFoundError(`No matching dynamic provider found for ${connection.provider}`);
        }
        
        targetProvider = matchingProvider.id;
      }
      
      // Create migration plan
      const plan: ConnectionMigrationPlan = {
        connectionId,
        currentProvider: connection.provider!,
        targetProviderId: targetProvider,
        estimatedDuration: 60, // 1 minute
        migrationSteps: [
          {
            step: 1,
            description: 'Validate current connection configuration',
            action: 'validate',
            estimated: 10,
            reversible: true
          },
          {
            step: 2,
            description: 'Create backup of current connection',
            action: 'backup',
            estimated: 5,
            reversible: false
          },
          {
            step: 3,
            description: 'Convert configuration to dynamic provider format',
            action: 'convert',
            estimated: 15,
            reversible: true
          },
          {
            step: 4,
            description: 'Test new dynamic provider connection',
            action: 'test',
            estimated: 20,
            reversible: true
          },
          {
            step: 5,
            description: 'Activate dynamic provider connection',
            action: 'activate',
            estimated: 10,
            reversible: true
          }
        ],
        risks: [
          {
            level: 'low',
            description: 'Temporary service interruption during migration',
            mitigation: 'Migration is performed quickly with automatic rollback on failure'
          },
          {
            level: 'medium',
            description: 'Configuration incompatibility with dynamic provider',
            mitigation: 'Validation step checks compatibility before migration'
          }
        ]
      };
      
      return plan;
      
    } catch (error) {
      logger.error('Failed to plan migration:', error);
      throw error;
    }
  }

  /**
   * Migrate a connection from legacy to dynamic provider
   */
  public async migrateConnection(connectionId: string, plan: ConnectionMigrationPlan): Promise<ConnectionMigrationResult> {
    this.ensureInitialized();
    
    try {
      logger.info('Starting connection migration', {
        connectionId,
        targetProvider: plan.targetProviderId
      });
      
      // Get the legacy connection
      const connection = await this.storageService.getExtendedConnection('', connectionId);
      
      if (!isLegacyConnection(connection)) {
        throw new AppError(
          'Connection is not a legacy connection',
          400,
          'INVALID_CONNECTION_TYPE' as any
        );
      }
      
      // Step 1: Validate current configuration
      await this.testExtendedConnection(connection.userId, connectionId);
      
      // Step 2: Create backup
      const backupId = await this.storageService.createConnectionBackup(connectionId);
      
      try {
        // Step 3: Convert configuration
        const dynamicConfig = await this.convertLegacyToDynamicConfig(connection);
        
        // Step 4: Test new configuration
        const dynamicProviderService = getDynamicProviderService();
        const testResult = await dynamicProviderService.testProvider(plan.targetProviderId);
        
        if (!testResult.success) {
          throw new AppError(
            `Target provider test failed: ${testResult.error}`,
            400,
            ExtendedConnectionErrorCode.MIGRATION_FAILED as any
          );
        }
        
        // Step 5: Update connection to dynamic
        await this.storageService.migrateConnectionToDynamic(
          connectionId,
          plan.targetProviderId,
          dynamicConfig,
          backupId
        );
        
        logger.info('Connection migration completed successfully', {
          connectionId,
          targetProvider: plan.targetProviderId,
          backupId
        });
        
        return {
          connectionId,
          success: true,
          migratedAt: new Date(),
          newProviderId: plan.targetProviderId,
          backupId
        };
        
      } catch (error) {
        // Rollback on failure
        logger.warn('Migration failed, attempting rollback', {
          connectionId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        try {
          await this.storageService.restoreConnectionFromBackup(connectionId, backupId);
        } catch (rollbackError) {
          logger.error('Rollback failed', {
            connectionId,
            backupId,
            rollbackError
          });
        }
        
        return {
          connectionId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
      
    } catch (error) {
      logger.error('Failed to migrate connection:', error);
      return {
        connectionId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Batch migrate multiple connections
   */
  public async batchMigrate(request: BatchMigrationRequest): Promise<BatchMigrationResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    const results: ConnectionMigrationResult[] = [];
    let successful = 0;
    let failed = 0;
    const skipped = 0;
    const errors: string[] = [];
    const warnings: string[] = [];
    let backupsCreated = 0;
    
    logger.info('Starting batch migration', {
      connectionCount: request.connectionIds.length,
      dryRun: request.options?.dryRun
    });
    
    for (const connectionId of request.connectionIds) {
      try {
        // Plan migration
        const targetProviderId = request.targetProviderMappings?.[connectionId];
        const plan = await this.planMigration(connectionId, targetProviderId);
        
        if (request.options?.dryRun) {
          // Dry run - just validate
          results.push({
            connectionId,
            success: true,
            warnings: ['Dry run - no actual migration performed']
          });
          successful++;
          continue;
        }
        
        if (request.options?.validateOnly) {
          // Validation only
          await this.storageService.getExtendedConnection('', connectionId);
          await this.checkCompatibility(connectionId, plan.targetProviderId);
          
          results.push({
            connectionId,
            success: true,
            warnings: ['Validation only - no migration performed']
          });
          successful++;
          continue;
        }
        
        // Perform actual migration
        const result = await this.migrateConnection(connectionId, plan);
        results.push(result);
        
        if (result.success) {
          successful++;
          if (result.backupId) {
            backupsCreated++;
          }
        } else {
          failed++;
          if (result.error) {
            errors.push(`${connectionId}: ${result.error}`);
          }
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (request.options?.continueOnError) {
          results.push({
            connectionId,
            success: false,
            error: errorMessage
          });
          failed++;
          errors.push(`${connectionId}: ${errorMessage}`);
        } else {
          // Stop on first error
          results.push({
            connectionId,
            success: false,
            error: errorMessage
          });
          failed++;
          errors.push(`${connectionId}: ${errorMessage}`);
          break;
        }
      }
    }
    
    const duration = Date.now() - startTime;
    
    logger.info('Batch migration completed', {
      total: request.connectionIds.length,
      successful,
      failed,
      skipped,
      duration
    });
    
    return {
      totalConnections: request.connectionIds.length,
      successful,
      failed,
      skipped,
      results,
      summary: {
        duration,
        backupsCreated,
        errors,
        warnings
      }
    };
  }

  /**
   * Check compatibility between connection and target provider
   */
  public async checkCompatibility(connectionId: string, targetProviderId: string): Promise<CompatibilityCheckResult> {
    try {
      const connection = await this.storageService.getExtendedConnection('', connectionId);
      const dynamicProviderService = getDynamicProviderService();
      const targetProvider = await dynamicProviderService.getProvider(targetProviderId);
      
      const issues: any[] = [];
      const recommendations: string[] = [];
      
      if (isLegacyConnection(connection)) {
        // Check if legacy provider maps to target provider
        if (connection.provider !== targetProvider.identifier) {
          issues.push({
            type: 'warning',
            field: 'provider',
            message: `Provider mismatch: ${connection.provider} -> ${targetProvider.identifier}`,
            resolution: 'Configuration will be converted automatically'
          });
        }
        
        // Check model compatibility
        const models = await dynamicProviderService.getProviderModels(targetProviderId);
        const legacyModels = connection.config?.models || [];
        const incompatibleModels = legacyModels.filter(model => 
          !models.some(m => m.identifier === model)
        );
        
        if (incompatibleModels.length > 0) {
          issues.push({
            type: 'warning',
            field: 'models',
            message: `Some models not available: ${incompatibleModels.join(', ')}`,
            resolution: 'Models will be mapped to compatible alternatives'
          });
          recommendations.push('Review model mappings after migration');
        }
      }
      
      return {
        compatible: issues.filter(i => i.type === 'error').length === 0,
        issues,
        recommendations,
        migrationRequired: true
      };
      
    } catch (error) {
      return {
        compatible: false,
        issues: [{
          type: 'error',
          field: 'general',
          message: error instanceof Error ? error.message : 'Unknown error',
          resolution: 'Fix the error before attempting migration'
        }],
        recommendations: [],
        migrationRequired: false
      };
    }
  }

  /**
   * Get provider mappings for migration
   */
  public async getProviderMappings(): Promise<any[]> {
    const dynamicProviderService = getDynamicProviderService();
    const result = await dynamicProviderService.getProviders();
    const providers = result.providers;
    
    return [
      {
        legacyProvider: 'openai',
        dynamicProviderId: providers.find((p: any) => p.identifier === 'openai')?.id || '',
        configMapping: [
          { legacyField: 'apiKey', dynamicField: 'credentials.apiKey', required: true },
          { legacyField: 'organizationId', dynamicField: 'credentials.organizationId', required: false },
          { legacyField: 'baseUrl', dynamicField: 'settings.baseUrl', required: false }
        ],
        modelMapping: []
      },
      {
        legacyProvider: 'bedrock',
        dynamicProviderId: providers.find((p: any) => p.identifier === 'bedrock')?.id || '',
        configMapping: [
          { legacyField: 'accessKeyId', dynamicField: 'credentials.accessKeyId', required: true },
          { legacyField: 'secretAccessKey', dynamicField: 'credentials.secretAccessKey', required: true },
          { legacyField: 'region', dynamicField: 'credentials.region', required: true }
        ],
        modelMapping: []
      },
      {
        legacyProvider: 'microsoft-copilot',
        dynamicProviderId: providers.find((p: any) => p.identifier === 'microsoft-copilot')?.id || '',
        configMapping: [
          { legacyField: 'apiKey', dynamicField: 'credentials.apiKey', required: true },
          { legacyField: 'endpoint', dynamicField: 'settings.baseUrl', required: true },
          { legacyField: 'apiVersion', dynamicField: 'settings.apiVersion', required: false }
        ],
        modelMapping: []
      }
    ];
  }

  /**
   * Convert legacy configuration to dynamic configuration
   */
  private async convertLegacyToDynamicConfig(connection: ExtendedLLMConnection): Promise<DynamicConnectionConfig> {
    if (!isLegacyConnection(connection)) {
      throw new AppError('Connection is not a legacy connection', 400, 'INVALID_CONNECTION_TYPE' as any);
    }
    
    const config = connection.config;
    
    if (connection.provider === 'openai') {
      const openaiConfig = config as OpenAIConfig;
      return {
        credentials: {
          apiKey: openaiConfig.apiKey,
          organizationId: openaiConfig.organizationId
        },
        settings: openaiConfig.baseUrl ? {
          baseUrl: openaiConfig.baseUrl
        } : {},
        modelPreferences: {
          preferredModels: openaiConfig.models,
          defaultModel: openaiConfig.defaultModel
        }
      };
    } else if (connection.provider === 'bedrock') {
      const bedrockConfig = config as BedrockConfig;
      return {
        credentials: {
          accessKeyId: bedrockConfig.accessKeyId,
          secretAccessKey: bedrockConfig.secretAccessKey,
          region: bedrockConfig.region
        },
        modelPreferences: {
          preferredModels: bedrockConfig.models,
          defaultModel: bedrockConfig.defaultModel
        }
      };
    } else if (connection.provider === 'microsoft-copilot') {
      const copilotConfig = config as MicrosoftCopilotConfig;
      return {
        credentials: {
          apiKey: copilotConfig.apiKey
        },
        settings: {
          ...(copilotConfig.endpoint && { baseUrl: copilotConfig.endpoint }),
          ...(copilotConfig.apiVersion && { apiVersion: copilotConfig.apiVersion })
        },
        modelPreferences: {
          preferredModels: copilotConfig.models,
          defaultModel: copilotConfig.defaultModel
        }
      };
    } else {
      throw new AppError(`Unsupported legacy provider: ${connection.provider}`, 400, 'UNSUPPORTED_PROVIDER' as any);
    }
  }

  // ============================================================================
  // Validation Methods
  // ============================================================================


  /**
   * Validate extended create connection request
   */
  private validateExtendedCreateConnectionRequest(request: ExtendedCreateConnectionRequest): void {
    if (!request.name || request.name.trim() === '') {
      throw new ValidationError('Connection name is required', 'name');
    }
    
    if (request.name.length > 100) {
      throw new ValidationError('Connection name must be 100 characters or less', 'name');
    }
    
    // Validate legacy provider request
    if (request.provider && request.config) {
      if (!['openai', 'bedrock', 'microsoft-copilot'].includes(request.provider)) {
        throw new ValidationError('Provider must be "openai", "bedrock", or "microsoft-copilot"', 'provider');
      }
    }
    
    // Validate dynamic provider request
    if (request.providerId && request.dynamicConfig) {
      this.validateDynamicConnectionConfig(request.dynamicConfig);
    }
    
    // Ensure either legacy or dynamic configuration is provided
    if (!(request.provider && request.config) && !(request.providerId && request.dynamicConfig)) {
      throw new ValidationError('Either legacy provider configuration or dynamic provider configuration is required');
    }
  }

  /**
   * Validate dynamic connection configuration
   */
  private validateDynamicConnectionConfig(config: DynamicConnectionConfig): void {
    if (!config.credentials || typeof config.credentials !== 'object') {
      throw new ValidationError('Dynamic connection credentials are required', 'credentials');
    }
    
    // Additional validation can be added based on provider requirements
  }

  /**
   * Validate update connection request
   */
  private validateUpdateConnectionRequest(request: UpdateConnectionRequest): void {
    if (request.name !== undefined) {
      if (!request.name || request.name.trim() === '') {
        throw new ValidationError('Connection name cannot be empty', 'name');
      }
      
      if (request.name.length > 100) {
        throw new ValidationError('Connection name must be 100 characters or less', 'name');
      }
    }
    
    if (request.status !== undefined) {
      if (!['active', 'inactive'].includes(request.status)) {
        throw new ValidationError('Status must be either "active" or "inactive"', 'status');
      }
    }
  }

  /**
   * Set default models for provider configurations
   */
  private setDefaultModels(provider: 'openai' | 'bedrock' | 'microsoft-copilot', config: any): any {
    const configCopy = { ...config };
    
    if (provider === 'openai') {
      const openaiConfig = configCopy as OpenAIConfig;
      if (!openaiConfig.models || openaiConfig.models.length === 0) {
        openaiConfig.models = [...OPENAI_MODELS];
      }
      if (!openaiConfig.defaultModel) {
        openaiConfig.defaultModel = 'gpt-3.5-turbo';
      }
    } else if (provider === 'microsoft-copilot') {
      const copilotConfig = configCopy as MicrosoftCopilotConfig;
      if (!copilotConfig.models || copilotConfig.models.length === 0) {
        copilotConfig.models = [...MICROSOFT_COPILOT_MODELS];
      }
      if (!copilotConfig.defaultModel) {
        copilotConfig.defaultModel = 'gpt-4';
      }
    } else if (provider === 'bedrock') {
      const bedrockConfig = configCopy as BedrockConfig;
      if (!bedrockConfig.models || bedrockConfig.models.length === 0) {
        bedrockConfig.models = [...BEDROCK_MODELS];
      }
      if (!bedrockConfig.defaultModel) {
        bedrockConfig.defaultModel = 'anthropic.claude-3-sonnet-20240229-v1:0';
      }
    }
    
    return configCopy;
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new AppError(
        'Connection management service not initialized',
        500,
        'SERVICE_NOT_INITIALIZED' as any
      );
    }
  }

  /**
   * Shutdown the service
   */
  public async shutdown(): Promise<void> {
    try {
      await this.storageService.shutdown();
      this.initialized = false;
      
      logger.info('Connection management service shut down successfully');
      this.emit('shutdown');
    } catch (error) {
      logger.error('Error during connection management service shutdown:', error);
      throw error;
    }
  }
}

// Singleton instance
let connectionManagementService: ConnectionManagementService | null = null;

/**
 * Initialize the connection management service
 */
export async function initializeConnectionManagementService(
  config: ConnectionManagementServiceConfig = {}
): Promise<void> {
  if (connectionManagementService) {
    logger.warn('Connection management service already initialized');
    return;
  }
  
  connectionManagementService = new ConnectionManagementService(config);
  await connectionManagementService.initialize();
}

/**
 * Get the connection management service instance
 */
export function getConnectionManagementService(): ConnectionManagementService {
  if (!connectionManagementService) {
    throw new AppError(
      'Connection management service not initialized',
      500,
      'SERVICE_NOT_INITIALIZED' as any
    );
  }
  
  return connectionManagementService;
}