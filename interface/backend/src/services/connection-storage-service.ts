import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { EncryptionService } from './encryption-service.js';
import { 
  LLMConnection, 
  ConnectionRecord, 
  CreateConnectionRequest, 
  UpdateConnectionRequest,
  OpenAIConfig,
  BedrockConfig
} from '../types/connections.js';
import {
  ExtendedLLMConnection,
  ExtendedConnectionRecord,
  ExtendedCreateConnectionRequest,
  ExtendedUpdateConnectionRequest,
  DynamicConnectionConfig
} from '../types/extended-connections.js';
import { NotFoundError, ConflictError } from '../types/errors.js';

export class ConnectionStorageService {
  private storageDir: string;
  private connectionsFile: string;
  private connections: Map<string, ConnectionRecord> = new Map();

  constructor(storageDir: string = './data/connections') {
    this.storageDir = storageDir;
    this.connectionsFile = path.join(storageDir, 'connections.json');
  }

  /**
   * Initialize the storage service
   */
  public async initialize(): Promise<void> {
    try {
      // Ensure storage directory exists
      await fs.mkdir(this.storageDir, { recursive: true });
      
      // Load existing connections
      await this.loadConnections();
      
      // If no connections exist, load sample data for development
      if (this.connections.size === 0 && (process.env['NODE_ENV'] === 'development' || process.env['DEMO_MODE'] === 'true')) {
        await this.loadSampleConnections();
      }
      
      // Clean up any connections that cannot be decrypted
      await this.cleanupCorruptedConnections();
      
      logger.info('Connection storage service initialized', {
        storageDir: this.storageDir,
        connectionsCount: this.connections.size
      });
    } catch (error) {
      logger.error('Failed to initialize connection storage service:', error);
      throw error;
    }
  }

  /**
   * Load connections from storage
   */
  private async loadConnections(): Promise<void> {
    try {
      const data = await fs.readFile(this.connectionsFile, 'utf-8');
      
      // Handle empty file or whitespace-only content
      if (!data.trim()) {
        logger.info('Connections file is empty, starting with empty storage');
        this.connections.clear();
        return;
      }
      
      const connectionsArray: ConnectionRecord[] = JSON.parse(data);
      
      this.connections.clear();
      for (const connection of connectionsArray) {
        // Convert date strings back to Date objects
        connection.created_at = new Date(connection.created_at);
        connection.updated_at = new Date(connection.updated_at);
        if (connection.last_tested) {
          connection.last_tested = new Date(connection.last_tested);
        }
        
        this.connections.set(connection.id, connection);
      }
      
      logger.info(`Loaded ${connectionsArray.length} connections from storage`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, start with empty connections
        logger.info('No existing connections file found, starting with empty storage');
        this.connections.clear();
      } else if (error instanceof SyntaxError) {
        // JSON parsing error - file is corrupted
        logger.warn('Connections file contains invalid JSON, starting with empty storage and backing up corrupted file');
        this.connections.clear();
        
        // Backup the corrupted file
        try {
          const backupFile = `${this.connectionsFile}.corrupted.${Date.now()}`;
          await fs.rename(this.connectionsFile, backupFile);
          logger.info(`Corrupted connections file backed up to: ${backupFile}`);
        } catch (backupError) {
          logger.error('Failed to backup corrupted connections file:', backupError);
        }
      } else {
        logger.error('Failed to load connections:', error);
        throw error;
      }
    }
  }

  /**
   * Load sample connections for development/demo
   */
  private async loadSampleConnections(): Promise<void> {
    try {
      const sampleConnectionConfigs = [
        {
          name: 'OpenAI GPT-4',
          provider: 'openai' as const,
          config: {
            apiKey: 'demo-key-openai-gpt4',
            models: ['gpt-4', 'gpt-4-turbo'],
            defaultModel: 'gpt-4'
          } as OpenAIConfig,
          status: 'active' as const,
          user_id: 'system',
          last_tested: new Date(Date.now() - 3600000) // 1 hour ago
        },
        {
          name: 'OpenAI GPT-3.5 Turbo',
          provider: 'openai' as const,
          config: {
            apiKey: 'demo-key-openai-gpt35',
            models: ['gpt-3.5-turbo', 'gpt-3.5-turbo-16k'],
            defaultModel: 'gpt-3.5-turbo'
          } as OpenAIConfig,
          status: 'active' as const,
          user_id: 'system',
          last_tested: new Date(Date.now() - 7200000) // 2 hours ago
        },
        {
          name: 'AWS Bedrock Claude',
          provider: 'bedrock' as const,
          config: {
            region: 'us-east-1',
            accessKeyId: 'demo-access-key',
            secretAccessKey: 'demo-secret-key',
            models: ['anthropic.claude-v2', 'anthropic.claude-instant-v1'],
            defaultModel: 'anthropic.claude-v2'
          } as BedrockConfig,
          status: 'inactive' as const,
          user_id: 'system',
          last_tested: new Date(Date.now() - 86400000) // 1 day ago
        }
      ];

      for (const connectionData of sampleConnectionConfigs) {
        // Encrypt the config before creating the connection record
        const encryptedConfig = EncryptionService.encryptConfig(connectionData.config);
        
        const connection: ConnectionRecord = {
          id: uuidv4(),
          name: connectionData.name,
          provider: connectionData.provider,
          encrypted_config: encryptedConfig,
          status: connectionData.status,
          user_id: connectionData.user_id,
          last_tested: connectionData.last_tested,
          created_at: new Date(Date.now() - Math.random() * 86400000 * 7), // Within last week
          updated_at: new Date(Date.now() - Math.random() * 86400000 * 2)  // Within last 2 days
        };

        this.connections.set(connection.id, connection);
      }

      // Save the sample connections
      await this.saveConnections();
      
      logger.info(`Loaded ${sampleConnectionConfigs.length} sample connections for development`);
    } catch (error) {
      logger.error('Failed to load sample connections:', error);
      // Don't throw - this is just for demo purposes
    }
  }

  /**
   * Migrate connections from old user ID to new user ID
   * This is useful when user IDs change due to service restarts before persistence was implemented
   */
  public async migrateUserConnections(oldUserId: string, newUserId: string): Promise<number> {
    let migratedCount = 0;
    
    for (const connection of this.connections.values()) {
      if (connection.user_id === oldUserId) {
        connection.user_id = newUserId;
        connection.updated_at = new Date();
        migratedCount++;
      }
    }
    
    if (migratedCount > 0) {
      await this.saveConnections();
      logger.info('Migrated connections to new user ID', { 
        oldUserId, 
        newUserId, 
        migratedCount 
      });
    }
    
    return migratedCount;
  }



  /**
   * Save connections to storage
   */
  private async saveConnections(): Promise<void> {
    try {
      const connectionsArray = Array.from(this.connections.values());
      const data = JSON.stringify(connectionsArray, null, 2);
      await fs.writeFile(this.connectionsFile, data, 'utf-8');
      
      logger.debug(`Saved ${connectionsArray.length} connections to storage`);
    } catch (error) {
      logger.error('Failed to save connections:', error);
      throw error;
    }
  }

  /**
   * Create a new connection
   */
  public async createConnection(
    userId: string, 
    request: CreateConnectionRequest
  ): Promise<LLMConnection> {
    try {
      // Check if connection with same name already exists for this user
      const existingConnection = Array.from(this.connections.values())
        .find(conn => conn.user_id === userId && conn.name === request.name);
      
      if (existingConnection) {
        throw new ConflictError(`Connection with name '${request.name}' already exists`);
      }

      // Encrypt the configuration
      const encryptedConfig = EncryptionService.encryptConfig(request.config);

      // Create connection record
      const connectionRecord: ConnectionRecord = {
        id: uuidv4(),
        name: request.name,
        provider: request.provider,
        status: 'inactive', // Start as inactive until tested
        encrypted_config: encryptedConfig,
        created_at: new Date(),
        updated_at: new Date(),
        user_id: userId
      };

      // Store the connection
      this.connections.set(connectionRecord.id, connectionRecord);
      await this.saveConnections();

      logger.info('Created new connection', {
        connectionId: connectionRecord.id,
        name: request.name,
        provider: request.provider,
        userId
      });

      return this.recordToConnection(connectionRecord);
    } catch (error) {
      logger.error('Failed to create connection:', error);
      throw error;
    }
  }

  /**
   * Get all connections for a user
   */
  public async getConnections(userId: string): Promise<LLMConnection[]> {
    try {
      const userConnections: LLMConnection[] = [];
      
      for (const record of this.connections.values()) {
        if (record.user_id === userId) {
          try {
            const connection = this.recordToConnection(record);
            userConnections.push(connection);
          } catch (decryptError) {
            logger.warn(`Failed to decrypt connection ${record.id} for user ${userId}, skipping:`, decryptError);
            // Continue processing other connections instead of failing completely
          }
        }
      }

      return userConnections;
    } catch (error) {
      logger.error('Failed to get connections:', error);
      throw error;
    }
  }

  /**
   * Get all connections across all users (for system monitoring)
   */
  public async getAllConnections(): Promise<LLMConnection[]> {
    try {
      const allConnections: LLMConnection[] = [];
      
      for (const record of this.connections.values()) {
        try {
          const connection = this.recordToConnection(record);
          allConnections.push(connection);
        } catch (decryptError) {
          logger.warn(`Failed to decrypt connection ${record.id}, skipping:`, decryptError);
          // Continue processing other connections instead of failing completely
        }
      }

      return allConnections;
    } catch (error) {
      logger.error('Failed to get all connections:', error);
      throw error;
    }
  }

  /**
   * Get a specific connection by ID
   */
  public async getConnection(userId: string, connectionId: string): Promise<LLMConnection> {
    try {
      const record = this.connections.get(connectionId);
      
      if (!record) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      if (record.user_id !== userId) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      return this.recordToConnection(record);
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
    try {
      const record = this.connections.get(connectionId);
      
      if (!record) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      if (record.user_id !== userId) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      // Update fields
      if (request.name !== undefined) {
        // Check for name conflicts
        const existingConnection = Array.from(this.connections.values())
          .find(conn => 
            conn.user_id === userId && 
            conn.name === request.name && 
            conn.id !== connectionId
          );
        
        if (existingConnection) {
          throw new ConflictError(`Connection with name '${request.name}' already exists`);
        }
        
        record.name = request.name;
      }

      if (request.status !== undefined) {
        record.status = request.status;
      }

      if (request.config !== undefined) {
        // Decrypt existing config, merge with updates, and re-encrypt
        const existingConfig = EncryptionService.decryptConfig(record.encrypted_config);
        const updatedConfig = { ...(existingConfig as any), ...(request.config as any) };
        record.encrypted_config = EncryptionService.encryptConfig(updatedConfig);
      }

      record.updated_at = new Date();

      // Save changes
      this.connections.set(connectionId, record);
      await this.saveConnections();

      logger.info('Updated connection', {
        connectionId,
        userId,
        updatedFields: Object.keys(request)
      });

      return this.recordToConnection(record);
    } catch (error) {
      logger.error('Failed to update connection:', error);
      throw error;
    }
  }

  /**
   * Delete a connection
   */
  public async deleteConnection(userId: string, connectionId: string): Promise<void> {
    try {
      const record = this.connections.get(connectionId);
      
      if (!record) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      if (record.user_id !== userId) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      // Remove from memory and save
      this.connections.delete(connectionId);
      await this.saveConnections();

      logger.info('Deleted connection', {
        connectionId,
        userId,
        name: record.name
      });
    } catch (error) {
      logger.error('Failed to delete connection:', error);
      throw error;
    }
  }

  /**
   * Update connection test results
   */
  public async updateConnectionTestResult(
    userId: string,
    connectionId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const record = this.connections.get(connectionId);
      
      if (!record) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      if (record.user_id !== userId) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      // Update status and test timestamp
      record.status = success ? 'active' : 'error';
      record.last_tested = new Date();
      record.updated_at = new Date();

      // Save changes
      this.connections.set(connectionId, record);
      await this.saveConnections();

      logger.info('Updated connection test result', {
        connectionId,
        userId,
        success,
        error
      });
    } catch (error) {
      logger.error('Failed to update connection test result:', error);
      throw error;
    }
  }

  /**
   * Get decrypted configuration for a connection
   */
  public async getDecryptedConfig<T extends OpenAIConfig | BedrockConfig>(
    userId: string,
    connectionId: string
  ): Promise<T> {
    try {
      const record = this.connections.get(connectionId);
      
      if (!record) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      if (record.user_id !== userId) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      return EncryptionService.decryptConfig<T>(record.encrypted_config);
    } catch (error) {
      logger.error('Failed to get decrypted config:', error);
      throw error;
    }
  }

  /**
   * Convert connection record to connection object
   */
  private recordToConnection(record: ConnectionRecord): LLMConnection {
    // Decrypt the configuration
    const config = EncryptionService.decryptConfig(record.encrypted_config);

    const result: LLMConnection = {
      id: record.id,
      name: record.name,
      provider: record.provider,
      status: record.status,
      config: config as OpenAIConfig | BedrockConfig,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      userId: record.user_id
    };
    
    if (record.last_tested) {
      result.lastTested = record.last_tested;
    }
    
    return result;
  }

  /**
   * Get storage statistics
   */
  public getStats(): { totalConnections: number; activeConnections: number } {
    const totalConnections = this.connections.size;
    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.status === 'active').length;

    return { totalConnections, activeConnections };
  }

  /**
   * Clean up connections that cannot be decrypted
   */
  public async cleanupCorruptedConnections(): Promise<void> {
    try {
      const corruptedIds: string[] = [];
      
      for (const [id, record] of this.connections.entries()) {
        try {
          // Try to decrypt the connection
          EncryptionService.decryptConfig(record.encrypted_config);
        } catch (decryptError) {
          logger.warn(`Connection ${id} cannot be decrypted, marking for removal:`, decryptError);
          corruptedIds.push(id);
        }
      }
      
      if (corruptedIds.length > 0) {
        for (const id of corruptedIds) {
          this.connections.delete(id);
        }
        
        await this.saveConnections();
        logger.info(`Cleaned up ${corruptedIds.length} corrupted connections`);
      }
    } catch (error) {
      logger.error('Failed to cleanup corrupted connections:', error);
    }
  }

  // ============================================================================
  // Extended Connection Methods
  // ============================================================================

  /**
   * Create an extended connection (supports both legacy and dynamic providers)
   */
  public async createExtendedConnection(
    userId: string, 
    request: ExtendedCreateConnectionRequest & { connectionType: 'legacy' | 'dynamic' }
  ): Promise<ExtendedLLMConnection> {
    try {
      // Check if connection with same name already exists for this user
      const existingConnection = Array.from(this.connections.values())
        .find(conn => conn.user_id === userId && conn.name === request.name);
      
      if (existingConnection) {
        throw new ConflictError(`Connection with name '${request.name}' already exists`);
      }

      let encryptedConfig: string | undefined;
      let encryptedDynamicConfig: string | undefined;

      if (request.connectionType === 'legacy' && request.config) {
        encryptedConfig = EncryptionService.encryptConfig(request.config);
      } else if (request.connectionType === 'dynamic' && request.dynamicConfig) {
        encryptedDynamicConfig = EncryptionService.encryptConfig(request.dynamicConfig);
      }

      // Create extended connection record
      const connectionRecord: ExtendedConnectionRecord = {
        id: uuidv4(),
        name: request.name,
        connection_type: request.connectionType,
        status: 'inactive', // Start as inactive until tested
        created_at: new Date(),
        updated_at: new Date(),
        user_id: userId,
        
        // Legacy fields
        ...(request.provider && { provider: request.provider }),
        ...(encryptedConfig && { encrypted_config: encryptedConfig }),
        
        // Dynamic fields
        ...(request.providerId && { provider_id: request.providerId }),
        ...(encryptedDynamicConfig && { encrypted_dynamic_config: encryptedDynamicConfig }),
        ...(request.selectedModels && { selected_models: JSON.stringify(request.selectedModels) }),
        ...(request.dynamicConfig?.modelPreferences?.defaultModel && { default_model: request.dynamicConfig.modelPreferences.defaultModel })
      };

      // Store the connection (using the same map for now, but with extended record)
      this.connections.set(connectionRecord.id, connectionRecord as any);
      await this.saveConnections();

      logger.info('Created new extended connection', {
        connectionId: connectionRecord.id,
        name: request.name,
        type: request.connectionType,
        userId
      });

      return this.extendedRecordToConnection(connectionRecord);
    } catch (error) {
      logger.error('Failed to create extended connection:', error);
      throw error;
    }
  }

  /**
   * Get an extended connection by ID
   */
  public async getExtendedConnection(userId: string, connectionId: string): Promise<ExtendedLLMConnection> {
    try {
      const record = this.connections.get(connectionId) as ExtendedConnectionRecord;
      
      if (!record) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      // Allow admin access (empty userId) for migration operations
      if (userId && record.user_id !== userId) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      return this.extendedRecordToConnection(record);
    } catch (error) {
      logger.error('Failed to get extended connection:', error);
      throw error;
    }
  }

  /**
   * Update an extended connection
   */
  public async updateExtendedConnection(
    userId: string,
    connectionId: string,
    request: ExtendedUpdateConnectionRequest
  ): Promise<ExtendedLLMConnection> {
    try {
      const record = this.connections.get(connectionId) as ExtendedConnectionRecord;
      
      if (!record) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      if (record.user_id !== userId) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      // Update fields
      if (request.name !== undefined) {
        record.name = request.name;
      }
      
      if (request.status !== undefined) {
        record.status = request.status;
      }

      // Update legacy config if provided
      if (request.config && record.encrypted_config) {
        const existingConfig = EncryptionService.decryptConfig(record.encrypted_config);
        const updatedConfig = { ...(existingConfig || {}), ...request.config };
        record.encrypted_config = EncryptionService.encryptConfig(updatedConfig);
      }

      // Update dynamic config if provided
      if (request.dynamicConfig && record.encrypted_dynamic_config) {
        const existingConfig = EncryptionService.decryptConfig(record.encrypted_dynamic_config);
        const updatedConfig = { ...(existingConfig || {}), ...request.dynamicConfig };
        record.encrypted_dynamic_config = EncryptionService.encryptConfig(updatedConfig);
      }

      // Update model selections
      if (request.selectedModels !== undefined) {
        record.selected_models = JSON.stringify(request.selectedModels);
      }

      if (request.defaultModel !== undefined) {
        record.default_model = request.defaultModel;
      }

      record.updated_at = new Date();

      await this.saveConnections();

      logger.info('Updated extended connection', {
        connectionId,
        userId,
        updatedFields: Object.keys(request)
      });

      return this.extendedRecordToConnection(record);
    } catch (error) {
      logger.error('Failed to update extended connection:', error);
      throw error;
    }
  }

  /**
   * Migrate a connection to dynamic provider
   */
  public async migrateConnectionToDynamic(
    connectionId: string,
    providerId: string,
    dynamicConfig: DynamicConnectionConfig,
    backupId: string
  ): Promise<void> {
    try {
      const record = this.connections.get(connectionId) as ExtendedConnectionRecord;
      
      if (!record) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      // Store migration info
      if (record.provider) {
        record.migrated_from = record.provider;
      }
      record.migrated_at = new Date();
      record.migration_backup_id = backupId;

      // Clear legacy fields
      delete record.provider;
      delete record.encrypted_config;

      // Set dynamic fields
      record.connection_type = 'dynamic';
      record.provider_id = providerId;
      record.encrypted_dynamic_config = EncryptionService.encryptConfig(dynamicConfig);
      
      if (dynamicConfig.modelPreferences?.preferredModels) {
        record.selected_models = JSON.stringify(dynamicConfig.modelPreferences.preferredModels);
      }
      
      if (dynamicConfig.modelPreferences?.defaultModel) {
        record.default_model = dynamicConfig.modelPreferences.defaultModel;
      }

      record.updated_at = new Date();

      await this.saveConnections();

      logger.info('Migrated connection to dynamic provider', {
        connectionId,
        providerId,
        backupId
      });
    } catch (error) {
      logger.error('Failed to migrate connection to dynamic:', error);
      throw error;
    }
  }

  /**
   * Create a backup of a connection
   */
  public async createConnectionBackup(connectionId: string): Promise<string> {
    try {
      const record = this.connections.get(connectionId);
      
      if (!record) {
        throw new NotFoundError(`Connection with ID '${connectionId}' not found`);
      }

      const backupId = `backup-${connectionId}-${Date.now()}`;
      const backupRecord = { ...record, id: backupId };

      // Store backup (in a real implementation, this might go to a separate backup storage)
      this.connections.set(backupId, backupRecord);
      await this.saveConnections();

      logger.info('Created connection backup', {
        connectionId,
        backupId
      });

      return backupId;
    } catch (error) {
      logger.error('Failed to create connection backup:', error);
      throw error;
    }
  }

  /**
   * Restore a connection from backup
   */
  public async restoreConnectionFromBackup(connectionId: string, backupId: string): Promise<void> {
    try {
      const backupRecord = this.connections.get(backupId);
      
      if (!backupRecord) {
        throw new NotFoundError(`Backup with ID '${backupId}' not found`);
      }

      // Restore the connection
      const restoredRecord = { ...backupRecord, id: connectionId, updated_at: new Date() };
      this.connections.set(connectionId, restoredRecord);

      // Remove the backup
      this.connections.delete(backupId);

      await this.saveConnections();

      logger.info('Restored connection from backup', {
        connectionId,
        backupId
      });
    } catch (error) {
      logger.error('Failed to restore connection from backup:', error);
      throw error;
    }
  }

  /**
   * Convert extended connection record to extended connection object
   */
  private extendedRecordToConnection(record: ExtendedConnectionRecord): ExtendedLLMConnection {
    const result: ExtendedLLMConnection = {
      id: record.id,
      name: record.name,
      connectionType: record.connection_type,
      status: record.status,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      userId: record.user_id
    };

    // Add legacy fields if present
    if (record.provider && record.encrypted_config) {
      result.provider = record.provider;
      result.config = EncryptionService.decryptConfig(record.encrypted_config);
    }

    // Add dynamic fields if present
    if (record.provider_id && record.encrypted_dynamic_config) {
      result.providerId = record.provider_id;
      result.dynamicConfig = EncryptionService.decryptConfig(record.encrypted_dynamic_config);
    }

    // Add model selections
    if (record.selected_models) {
      try {
        result.selectedModels = JSON.parse(record.selected_models);
      } catch (error) {
        logger.warn('Failed to parse selected models', { connectionId: record.id, error });
        result.selectedModels = [];
      }
    }

    if (record.default_model) {
      result.defaultModel = record.default_model;
    }

    if (record.last_tested) {
      result.lastTested = record.last_tested;
    }

    return result;
  }

  /**
   * Shutdown the service
   */
  public async shutdown(): Promise<void> {
    try {
      await this.saveConnections();
      logger.info('Connection storage service shut down successfully');
    } catch (error) {
      logger.error('Error during connection storage service shutdown:', error);
      throw error;
    }
  }
}