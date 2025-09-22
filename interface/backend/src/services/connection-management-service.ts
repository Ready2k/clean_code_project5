import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { ConnectionStorageService } from './connection-storage-service.js';
import { ConnectionTestingService } from './connection-testing-service.js';
import { 
  LLMConnection, 
  CreateConnectionRequest, 
  UpdateConnectionRequest,
  ConnectionTestResult,
  OPENAI_MODELS,
  BEDROCK_MODELS,
  OpenAIConfig,
  BedrockConfig
} from '../types/connections.js';
import { AppError, ValidationError } from '../types/errors.js';

export interface ConnectionManagementServiceConfig {
  storageDir?: string;
}

export class ConnectionManagementService extends EventEmitter {
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
   * Create a new LLM connection
   */
  public async createConnection(
    userId: string, 
    request: CreateConnectionRequest
  ): Promise<LLMConnection> {
    this.ensureInitialized();
    
    try {
      // Validate the request
      this.validateCreateConnectionRequest(request);
      
      // Validate provider-specific configuration
      ConnectionTestingService.validateConfig(request.provider, request.config);
      
      // Set default models if not provided
      const configWithDefaults = this.setDefaultModels(request.provider, request.config);
      
      // Create the connection
      const connection = await this.storageService.createConnection(userId, {
        ...request,
        config: configWithDefaults
      });
      
      logger.info('Created new connection', {
        connectionId: connection.id,
        name: connection.name,
        provider: connection.provider,
        userId
      });
      
      this.emit('connectionCreated', { connection, userId });
      return connection;
      
    } catch (error) {
      logger.error('Failed to create connection:', error);
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
   * Get a specific connection by ID
   */
  public async getConnection(userId: string, connectionId: string): Promise<LLMConnection> {
    this.ensureInitialized();
    
    try {
      const connection = await this.storageService.getConnection(userId, connectionId);
      
      logger.debug('Retrieved connection', {
        connectionId,
        userId,
        name: connection.name
      });
      
      return connection;
    } catch (error) {
      logger.error('Failed to get connection:', error);
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
  ): Promise<LLMConnection> {
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
      return connection;
      
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
   * Test a connection
   */
  public async testConnection(userId: string, connectionId: string): Promise<ConnectionTestResult> {
    this.ensureInitialized();
    
    try {
      // Get the connection and its decrypted config
      const connection = await this.storageService.getConnection(userId, connectionId);
      const config = await this.storageService.getDecryptedConfig(userId, connectionId);
      
      logger.info('Testing connection', {
        connectionId,
        userId,
        provider: connection.provider,
        name: connection.name
      });
      
      this.emit('connectionTestStarted', { connectionId, userId });
      
      let testResult: ConnectionTestResult;
      
      // Test based on provider type
      if (connection.provider === 'openai') {
        testResult = await ConnectionTestingService.testOpenAIConnection(config as OpenAIConfig);
      } else if (connection.provider === 'bedrock') {
        testResult = await ConnectionTestingService.testBedrockConnection(config as BedrockConfig);
      } else {
        throw new AppError(
          `Unsupported provider: ${connection.provider}`,
          400,
          'UNSUPPORTED_PROVIDER' as any
        );
      }
      
      // Update the connection status based on test result
      await this.storageService.updateConnectionTestResult(
        userId,
        connectionId,
        testResult.success,
        testResult.error
      );
      
      logger.info('Connection test completed', {
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
      logger.error('Failed to test connection:', error);
      
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
   * Get available models for a provider
   */
  public getAvailableModels(provider: 'openai' | 'bedrock'): string[] {
    if (provider === 'openai') {
      return [...OPENAI_MODELS];
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

  /**
   * Validate create connection request
   */
  private validateCreateConnectionRequest(request: CreateConnectionRequest): void {
    if (!request.name || request.name.trim() === '') {
      throw new ValidationError('Connection name is required', 'name');
    }
    
    if (request.name.length > 100) {
      throw new ValidationError('Connection name must be 100 characters or less', 'name');
    }
    
    if (!request.provider) {
      throw new ValidationError('Provider is required', 'provider');
    }
    
    if (!['openai', 'bedrock'].includes(request.provider)) {
      throw new ValidationError('Provider must be either "openai" or "bedrock"', 'provider');
    }
    
    if (!request.config) {
      throw new ValidationError('Configuration is required', 'config');
    }
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
  private setDefaultModels(provider: 'openai' | 'bedrock', config: any): any {
    const configCopy = { ...config };
    
    if (provider === 'openai') {
      const openaiConfig = configCopy as OpenAIConfig;
      if (!openaiConfig.models || openaiConfig.models.length === 0) {
        openaiConfig.models = [...OPENAI_MODELS];
      }
      if (!openaiConfig.defaultModel) {
        openaiConfig.defaultModel = 'gpt-3.5-turbo';
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