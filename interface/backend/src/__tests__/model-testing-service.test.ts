/**
 * Tests for Model Testing Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModelTestingService, getModelTestingService } from '../services/model-testing-service.js';
import { Provider, Model } from '../types/dynamic-providers.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('ModelTestingService', () => {
  let service: ModelTestingService;
  let mockProvider: Provider;
  let mockModel: Model;

  beforeEach(() => {
    vi.clearAllMocks();
    service = getModelTestingService();
    
    mockProvider = {
      id: 'provider-1',
      identifier: 'test-openai',
      name: 'Test OpenAI Provider',
      apiEndpoint: 'https://api.openai.com/v1',
      authMethod: 'api_key',
      authConfig: {
        type: 'api_key',
        fields: {
          apiKey: {
            required: true,
            description: 'API Key',
            sensitive: true
          }
        }
      },
      capabilities: {
        supportsSystemMessages: true,
        maxContextLength: 128000,
        supportedRoles: ['system', 'user', 'assistant'],
        supportsStreaming: true,
        supportsTools: true,
        supportedAuthMethods: ['api_key']
      },
      status: 'active',
      isSystem: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockModel = {
      id: 'model-1',
      providerId: 'provider-1',
      identifier: 'gpt-4',
      name: 'GPT-4',
      contextLength: 8192,
      capabilities: {
        supportsSystemMessages: true,
        maxContextLength: 8192,
        supportedRoles: ['system', 'user', 'assistant'],
        supportsStreaming: true,
        supportsTools: true,
        supportsFunctionCalling: true
      },
      status: 'active',
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  });

  describe('buildApiRequest', () => {
    it('should build OpenAI format request', () => {
      const authConfig = { fields: { apiKey: 'test-key' } };
      
      // Access private method for testing
      const buildRequest = (service as any).buildApiRequest.bind(service);
      const result = buildRequest(mockProvider, mockModel, authConfig, 'Test prompt');

      expect(result.url).toBe('https://api.openai.com/v1/chat/completions');
      expect(result.headers['Authorization']).toBe('Bearer test-key');
      expect(result.body.model).toBe('gpt-4');
      expect(result.body.messages).toHaveLength(1);
      expect(result.body.messages[0].content).toBe('Test prompt');
    });

    it('should build Anthropic format request', () => {
      const anthropicProvider = {
        ...mockProvider,
        identifier: 'anthropic-claude',
        apiEndpoint: 'https://api.anthropic.com/v1'
      };
      const authConfig = { fields: { apiKey: 'test-key' } };
      
      const buildRequest = (service as any).buildApiRequest.bind(service);
      const result = buildRequest(anthropicProvider, mockModel, authConfig, 'Test prompt');

      expect(result.url).toBe('https://api.anthropic.com/v1/messages');
      expect(result.headers['x-api-key']).toBe('test-key');
      expect(result.headers['anthropic-version']).toBe('2023-06-01');
      expect(result.body.model).toBe('gpt-4');
      expect(result.body.messages).toHaveLength(1);
    });

    it('should handle custom auth headers', () => {
      const customProvider = {
        ...mockProvider,
        authMethod: 'custom' as const,
        authConfig: {
          type: 'custom' as const,
          fields: {},
          headers: {
            'X-Custom-Auth': 'custom-token',
            'X-API-Version': '2024-01-01'
          }
        }
      };
      const authConfig = { 
        headers: {
          'X-Custom-Auth': 'custom-token',
          'X-API-Version': '2024-01-01'
        }
      };
      
      const buildRequest = (service as any).buildApiRequest.bind(service);
      const result = buildRequest(customProvider, mockModel, authConfig, 'Test prompt');

      expect(result.headers['X-Custom-Auth']).toBe('custom-token');
      expect(result.headers['X-API-Version']).toBe('2024-01-01');
    });

    it('should throw error for unsupported auth method', () => {
      const unsupportedProvider = {
        ...mockProvider,
        authMethod: 'oauth2' as const
      };
      const authConfig = { fields: {} };
      
      const buildRequest = (service as any).buildApiRequest.bind(service);
      
      expect(() => buildRequest(unsupportedProvider, mockModel, authConfig, 'Test prompt'))
        .toThrow('Unsupported auth method for testing: oauth2');
    });
  });

  describe('extractCapabilitiesFromResponse', () => {
    it('should extract basic capabilities from response', () => {
      const response = {
        choices: [{
          message: { content: 'Test response' }
        }]
      };
      
      const extractCapabilities = (service as any).extractCapabilitiesFromResponse.bind(service);
      const capabilities = extractCapabilities(response);

      expect(capabilities.supportsSystemMessages).toBe(true);
      expect(capabilities.supportedRoles).toContain('user');
      expect(capabilities.supportedRoles).toContain('assistant');
    });

    it('should detect streaming capability', () => {
      const response = {
        object: 'chat.completion.chunk',
        choices: [{
          delta: { content: 'Streaming response' }
        }]
      };
      
      const extractCapabilities = (service as any).extractCapabilitiesFromResponse.bind(service);
      const capabilities = extractCapabilities(response);

      expect(capabilities.supportsStreaming).toBe(true);
    });

    it('should detect function calling capability', () => {
      const response = {
        choices: [{
          message: {
            content: null,
            function_call: {
              name: 'get_weather',
              arguments: '{"location": "New York"}'
            }
          }
        }]
      };
      
      const extractCapabilities = (service as any).extractCapabilitiesFromResponse.bind(service);
      const capabilities = extractCapabilities(response);

      expect(capabilities.supportsTools).toBe(true);
      expect(capabilities.supportsFunctionCalling).toBe(true);
    });

    it('should detect tool calls capability', () => {
      const response = {
        choices: [{
          message: {
            content: null,
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "New York"}'
              }
            }]
          }
        }]
      };
      
      const extractCapabilities = (service as any).extractCapabilitiesFromResponse.bind(service);
      const capabilities = extractCapabilities(response);

      expect(capabilities.supportsTools).toBe(true);
      expect(capabilities.supportsFunctionCalling).toBe(true);
    });

    it('should handle empty response', () => {
      const response = {};
      
      const extractCapabilities = (service as any).extractCapabilitiesFromResponse.bind(service);
      const capabilities = extractCapabilities(response);

      // Even empty responses get basic capabilities assigned
      expect(capabilities.supportsSystemMessages).toBe(true);
      expect(capabilities.supportedRoles).toContain('user');
      expect(capabilities.supportedRoles).toContain('assistant');
    });
  });

  describe('extractResponseContent', () => {
    it('should extract content from OpenAI format', () => {
      const response = {
        choices: [{
          message: { content: 'Test response content' }
        }]
      };
      
      const extractContent = (service as any).extractResponseContent.bind(service);
      const content = extractContent(response);

      expect(content).toBe('Test response content');
    });

    it('should extract content from Anthropic format', () => {
      const response = {
        content: [{ text: 'Anthropic response content' }]
      };
      
      const extractContent = (service as any).extractResponseContent.bind(service);
      const content = extractContent(response);

      expect(content).toBe('Anthropic response content');
    });

    it('should extract content from simple content field', () => {
      const response = {
        content: 'Simple content'
      };
      
      const extractContent = (service as any).extractResponseContent.bind(service);
      const content = extractContent(response);

      expect(content).toBe('Simple content');
    });

    it('should return empty string for invalid response', () => {
      const response = { invalid: 'response' };
      
      const extractContent = (service as any).extractResponseContent.bind(service);
      const content = extractContent(response);

      expect(content).toBe('');
    });
  });

  describe('chunkArray', () => {
    it('should chunk array correctly', () => {
      const array = [1, 2, 3, 4, 5, 6, 7];
      const chunkArray = (service as any).chunkArray.bind(service);
      
      const chunks = chunkArray(array, 3);
      
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual([1, 2, 3]);
      expect(chunks[1]).toEqual([4, 5, 6]);
      expect(chunks[2]).toEqual([7]);
    });

    it('should handle empty array', () => {
      const array: number[] = [];
      const chunkArray = (service as any).chunkArray.bind(service);
      
      const chunks = chunkArray(array, 3);
      
      expect(chunks).toHaveLength(0);
    });

    it('should handle chunk size larger than array', () => {
      const array = [1, 2];
      const chunkArray = (service as any).chunkArray.bind(service);
      
      const chunks = chunkArray(array, 5);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual([1, 2]);
    });
  });

  describe('sleep', () => {
    it('should sleep for specified duration', async () => {
      const sleep = (service as any).sleep.bind(service);
      const startTime = Date.now();
      
      await sleep(100);
      
      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThanOrEqual(90); // Allow some tolerance
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getModelTestingService();
      const instance2 = getModelTestingService();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('constants', () => {
    it('should have correct default values', () => {
      expect(ModelTestingService.DEFAULT_TIMEOUT).toBe(30000);
      expect(ModelTestingService.DEFAULT_RETRIES).toBe(2);
      expect(ModelTestingService.DEFAULT_TEST_PROMPT).toBe("Hello, this is a test message. Please respond with 'Test successful'.");
      expect(ModelTestingService.BENCHMARK_ITERATIONS).toBe(3);
    });
  });
});