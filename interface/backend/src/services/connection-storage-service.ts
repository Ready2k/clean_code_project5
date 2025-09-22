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
      } else {
        logger.error('Failed to load connections:', error);
        throw error;
      }
    }
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
      const userConnections = Array.from(this.connections.values())
        .filter(conn => conn.user_id === userId)
        .map(record => this.recordToConnection(record));

      return userConnections;
    } catch (error) {
      logger.error('Failed to get connections:', error);
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