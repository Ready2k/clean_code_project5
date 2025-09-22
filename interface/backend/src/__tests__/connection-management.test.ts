import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EncryptionService } from '../services/encryption-service.js';
import { ConnectionStorageService } from '../services/connection-storage-service.js';
import { ConnectionTestingService } from '../services/connection-testing-service.js';
import { ConnectionManagementService } from '../services/connection-management-service.js';
import { CreateConnectionRequest, OpenAIConfig, BedrockConfig } from '../types/connections.js';
import fs from 'fs/promises';
import path from 'path';

describe('Connection Management System', () => {
  const testStorageDir = './test-data/connections';
  let connectionService: ConnectionManagementService;
  const testUserId = 'test-user-123';

  beforeEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }

    // Initialize encryption service
    EncryptionService.reset();
    EncryptionService.initialize('test-encryption-key-32-characters');

    // Initialize connection service
    connectionService = new ConnectionManagementService({
      storageDir: testStorageDir
    });
    await connectionService.initialize();
  });

  afterEach(async () => {
    if (connectionService) {
      await connectionService.shutdown();
    }
    
    // Clean up test directory
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch (error) {
      // Directory might not exist
    }
  });

  describe('EncryptionService', () => {
    it('should encrypt and decrypt data correctly', () => {
      const testData = 'sensitive-api-key-12345';
      const encrypted = EncryptionService.encrypt(testData);
      const decrypted = EncryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(testData);
      expect(encrypted).not.toBe(testData);
    });

    it('should encrypt and decrypt configuration objects', () => {
      const config: OpenAIConfig = {
        apiKey: 'sk-test123',
        organizationId: 'org-test',
        models: ['gpt-3.5-turbo'],
        defaultModel: 'gpt-3.5-turbo'
      };

      const encrypted = EncryptionService.encryptConfig(config);
      const decrypted = EncryptionService.decryptConfig<OpenAIConfig>(encrypted);
      
      expect(decrypted).toEqual(config);
    });
  });

  describe('ConnectionStorageService', () => {
    let storageService: ConnectionStorageService;

    beforeEach(async () => {
      storageService = new ConnectionStorageService(testStorageDir);
      await storageService.initialize();
    });

    afterEach(async () => {
      if (storageService) {
        await storageService.shutdown();
      }
    });

    it('should create and retrieve connections', async () => {
      const createRequest: CreateConnectionRequest = {
        name: 'Test OpenAI Connection',
        provider: 'openai',
        config: {
          apiKey: 'sk-test123',
          models: ['gpt-3.5-turbo'],
          defaultModel: 'gpt-3.5-turbo'
        }
      };

      const connection = await storageService.createConnection(testUserId, createRequest);
      
      expect(connection.id).toBeDefined();
      expect(connection.name).toBe(createRequest.name);
      expect(connection.provider).toBe(createRequest.provider);
      expect(connection.userId).toBe(testUserId);
      expect(connection.status).toBe('inactive');

      // Retrieve the connection
      const retrieved = await storageService.getConnection(testUserId, connection.id);
      expect(retrieved).toEqual(connection);
    });

    it('should update connections', async () => {
      const createRequest: CreateConnectionRequest = {
        name: 'Test Connection',
        provider: 'openai',
        config: {
          apiKey: 'sk-test123',
          models: ['gpt-3.5-turbo'],
          defaultModel: 'gpt-3.5-turbo'
        }
      };

      const connection = await storageService.createConnection(testUserId, createRequest);
      
      const updateRequest = {
        name: 'Updated Connection Name',
        status: 'active' as const
      };

      const updated = await storageService.updateConnection(testUserId, connection.id, updateRequest);
      
      expect(updated.name).toBe(updateRequest.name);
      expect(updated.status).toBe(updateRequest.status);
    });

    it('should delete connections', async () => {
      const createRequest: CreateConnectionRequest = {
        name: 'Test Connection',
        provider: 'openai',
        config: {
          apiKey: 'sk-test123',
          models: ['gpt-3.5-turbo'],
          defaultModel: 'gpt-3.5-turbo'
        }
      };

      const connection = await storageService.createConnection(testUserId, createRequest);
      
      await storageService.deleteConnection(testUserId, connection.id);
      
      // Should throw error when trying to retrieve deleted connection
      await expect(
        storageService.getConnection(testUserId, connection.id)
      ).rejects.toThrow('not found');
    });
  });

  describe('ConnectionTestingService', () => {
    it('should validate OpenAI configuration', () => {
      const validConfig: OpenAIConfig = {
        apiKey: 'sk-test123',
        models: ['gpt-3.5-turbo'],
        defaultModel: 'gpt-3.5-turbo'
      };

      expect(() => {
        ConnectionTestingService.validateConfig('openai', validConfig);
      }).not.toThrow();

      const invalidConfig = {
        apiKey: '',
        models: ['gpt-3.5-turbo'],
        defaultModel: 'gpt-3.5-turbo'
      };

      expect(() => {
        ConnectionTestingService.validateConfig('openai', invalidConfig);
      }).toThrow('API key is required');
    });

    it('should validate Bedrock configuration', () => {
      const validConfig: BedrockConfig = {
        accessKeyId: 'AKIA123',
        secretAccessKey: 'secret123',
        region: 'us-east-1',
        models: ['anthropic.claude-v2'],
        defaultModel: 'anthropic.claude-v2'
      };

      expect(() => {
        ConnectionTestingService.validateConfig('bedrock', validConfig);
      }).not.toThrow();

      const invalidConfig = {
        accessKeyId: '',
        secretAccessKey: 'secret123',
        region: 'us-east-1',
        models: ['anthropic.claude-v2'],
        defaultModel: 'anthropic.claude-v2'
      };

      expect(() => {
        ConnectionTestingService.validateConfig('bedrock', invalidConfig);
      }).toThrow('Access Key ID is required');
    });
  });

  describe('ConnectionManagementService', () => {
    it('should create connections with default models', async () => {
      const createRequest: CreateConnectionRequest = {
        name: 'Test OpenAI Connection',
        provider: 'openai',
        config: {
          apiKey: 'sk-test123'
        } as OpenAIConfig
      };

      const connection = await connectionService.createConnection(testUserId, createRequest);
      
      expect(connection.config.models).toBeDefined();
      expect(connection.config.models.length).toBeGreaterThan(0);
      expect(connection.config.defaultModel).toBeDefined();
    });

    it('should get available models for providers', () => {
      const openaiModels = connectionService.getAvailableModels('openai');
      const bedrockModels = connectionService.getAvailableModels('bedrock');
      
      expect(openaiModels).toBeDefined();
      expect(openaiModels.length).toBeGreaterThan(0);
      expect(bedrockModels).toBeDefined();
      expect(bedrockModels.length).toBeGreaterThan(0);
    });

    it('should get connection statistics', async () => {
      // Create a few test connections
      await connectionService.createConnection(testUserId, {
        name: 'OpenAI Connection',
        provider: 'openai',
        config: { apiKey: 'sk-test1' } as OpenAIConfig
      });

      await connectionService.createConnection(testUserId, {
        name: 'Bedrock Connection',
        provider: 'bedrock',
        config: { 
          accessKeyId: 'AKIA123',
          secretAccessKey: 'secret123',
          region: 'us-east-1'
        } as BedrockConfig
      });

      const stats = await connectionService.getConnectionStats(testUserId);
      
      expect(stats.total).toBe(2);
      expect(stats.inactive).toBe(2); // New connections start as inactive
      expect(stats.byProvider.openai).toBe(1);
      expect(stats.byProvider.bedrock).toBe(1);
    });

    it('should prevent duplicate connection names for same user', async () => {
      const createRequest: CreateConnectionRequest = {
        name: 'Duplicate Name',
        provider: 'openai',
        config: { apiKey: 'sk-test1' } as OpenAIConfig
      };

      await connectionService.createConnection(testUserId, createRequest);
      
      // Should throw error for duplicate name
      await expect(
        connectionService.createConnection(testUserId, createRequest)
      ).rejects.toThrow('already exists');
    });
  });
});