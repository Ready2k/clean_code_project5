// Export Service Tests

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ExportService, ExportOptions } from '../export-service';
import { PromptRecord, StructuredPrompt } from '../../models/prompt';
import { ProviderRegistry } from '../../adapters/provider-registry';
import { ProviderAdapter } from '../../adapters/provider-adapter';
import { RenderOptions, ProviderPayload } from '../../types/common';
import { ValidationResult } from '../../types/validation';
import { ProviderConfiguration, ProviderCapabilities } from '../../models/provider';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
vi.mock('fs/promises');

// Mock provider adapter
class MockProviderAdapter implements ProviderAdapter {
  readonly id = 'mock-provider';
  readonly name = 'Mock Provider';
  readonly supportedModels = ['mock-model-1', 'mock-model-2'];
  readonly capabilities: ProviderCapabilities = {
    supportsSystemMessages: true,
    supportsMultipleMessages: true,
    supportsTemperature: true,
    supportsTopP: true,
    supportsMaxTokens: true,
    maxContextLength: 4096,
    supportedMessageRoles: ['system', 'user', 'assistant']
  };

  render(structured: StructuredPrompt, options: RenderOptions): ProviderPayload {
    return {
      provider: this.id,
      model: options.model,
      content: {
        model: options.model,
        messages: [
          { role: 'system', content: structured.system.join('\n') },
          { role: 'user', content: structured.user_template }
        ],
        temperature: options.temperature
      },
      metadata: {
        messageCount: 2,
        hasSystemMessage: true
      }
    };
  }

  validate(payload: ProviderPayload): ValidationResult {
    if (payload.provider !== this.id) {
      return { isValid: false, errors: ['Invalid provider'] };
    }
    return { isValid: true, errors: [] };
  }

  supports(model: string): boolean {
    return this.supportedModels.includes(model);
  }

  getDefaultOptions(): RenderOptions {
    return {
      model: 'mock-model-1',
      temperature: 0.7
    };
  }

  getConfiguration(): ProviderConfiguration {
    return {
      id: this.id,
      name: this.name,
      defaultModel: 'mock-model-1',
      models: this.supportedModels.map(id => ({
        id,
        name: id,
        contextLength: 4096,
        deprecated: false,
        capabilities: this.capabilities
      })),
      rateLimits: {
        requestsPerMinute: 100,
        tokensPerMinute: 10000
      }
    };
  }

  getModelInfo(model: string) {
    if (!this.supports(model)) return null;
    return {
      maxTokens: 4096,
      contextLength: 4096,
      supportsSystemMessages: true
    };
  }
}

// Mock provider registry
class MockProviderRegistry implements ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>();

  constructor() {
    this.adapters.set('mock-provider', new MockProviderAdapter());
  }

  registerAdapter(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  getAdapter(providerId: string): ProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new Error(`Provider '${providerId}' not found`);
    }
    return adapter;
  }

  listProviders() {
    return Array.from(this.adapters.values()).map(adapter => ({
      id: adapter.id,
      name: adapter.name,
      supportedModels: adapter.supportedModels,
      defaultModel: adapter.getDefaultOptions().model
    }));
  }

  supportsModel(model: string) {
    return this.listProviders().filter(provider => 
      this.adapters.get(provider.id)?.supports(model)
    );
  }

  hasProvider(providerId: string): boolean {
    return this.adapters.has(providerId);
  }

  unregisterAdapter(providerId: string): void {
    this.adapters.delete(providerId);
  }

  getAllAdapters(): ProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  findBestProvider(model: string): ProviderAdapter | null {
    for (const adapter of this.adapters.values()) {
      if (adapter.supports(model)) {
        return adapter;
      }
    }
    return null;
  }

  getRecommendations() {
    return this.listProviders();
  }
}

describe('ExportService', () => {
  let exportService: ExportService;
  let mockRegistry: MockProviderRegistry;
  let samplePrompt: PromptRecord;

  beforeEach(() => {
    mockRegistry = new MockProviderRegistry();
    exportService = new ExportService(mockRegistry, './test-exports');

    // Create sample prompt
    samplePrompt = {
      version: 1,
      id: 'test-prompt-id',
      slug: 'test-prompt',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      status: 'active',
      metadata: {
        title: 'Test Prompt',
        summary: 'A test prompt',
        tags: ['test'],
        owner: 'test-user'
      },
      prompt_human: {
        goal: 'Test goal',
        audience: 'Test audience',
        steps: ['Step 1', 'Step 2'],
        output_expectations: {
          format: 'JSON',
          fields: ['field1', 'field2']
        }
      },
      prompt_structured: {
        schema_version: 1,
        system: ['You are a helpful assistant'],
        capabilities: ['reasoning'],
        user_template: 'Please help with {{task}}',
        rules: [
          { name: 'rule1', description: 'Be helpful' }
        ],
        variables: ['task']
      },
      variables: [
        {
          key: 'task',
          label: 'Task Description',
          type: 'string',
          required: true
        }
      ],
      history: {
        versions: [],
        ratings: []
      },
      renders: []
    };

    // Mock fs functions
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('exportPrompt', () => {
    it('should export prompt successfully with valid options', async () => {
      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1',
        variables: { task: 'test task' }
      };

      const result = await exportService.exportPrompt(samplePrompt, options);

      expect(result.filename).toBe('test-prompt_mock-provider_v1.json');
      expect(result.metadata.promptId).toBe('test-prompt-id');
      expect(result.metadata.provider).toBe('mock-provider');
      expect(result.metadata.model).toBe('mock-model-1');
      expect(result.metadata.variablesUsed).toEqual(['task']);
      expect(vi.mocked(fs.writeFile)).toHaveBeenCalledOnce();
    });

    it('should throw error for non-existent provider', async () => {
      const options: ExportOptions = {
        provider: 'non-existent',
        model: 'some-model'
      };

      await expect(exportService.exportPrompt(samplePrompt, options))
        .rejects.toThrow("Export validation failed: Provider 'non-existent' is not registered");
    });

    it('should throw error for prompt without structured format', async () => {
      const promptWithoutStructured = { ...samplePrompt };
      delete promptWithoutStructured.prompt_structured;

      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1'
      };

      await expect(exportService.exportPrompt(promptWithoutStructured, options))
        .rejects.toThrow('Prompt must have structured format for export');
    });

    it('should throw error for missing required variables', async () => {
      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1'
        // Missing required 'task' variable
      };

      await expect(exportService.exportPrompt(samplePrompt, options))
        .rejects.toThrow('Missing required variables: task');
    });

    it('should use custom filename when provided', async () => {
      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1',
        variables: { task: 'test task' },
        customFilename: 'custom-export'
      };

      const result = await exportService.exportPrompt(samplePrompt, options);

      expect(result.filename).toBe('custom-export.json');
    });

    it('should include metadata by default', async () => {
      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1',
        variables: { task: 'test task' }
      };

      await exportService.exportPrompt(samplePrompt, options);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1] as string);
      
      expect(writtenContent._metadata).toBeDefined();
      expect(writtenContent._metadata.promptId).toBe('test-prompt-id');
      expect(writtenContent._metadata.promptTitle).toBe('Test Prompt');
    });

    it('should exclude metadata when requested', async () => {
      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1',
        variables: { task: 'test task' },
        includeMetadata: false
      };

      await exportService.exportPrompt(samplePrompt, options);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1] as string);
      
      expect(writtenContent._metadata).toBeUndefined();
    });

    it('should create output directory if it does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Directory does not exist'));

      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1',
        variables: { task: 'test task' },
        outputDir: './custom-exports'
      };

      await exportService.exportPrompt(samplePrompt, options);

      expect(vi.mocked(fs.mkdir)).toHaveBeenCalledWith('./custom-exports', { recursive: true });
    });
  });

  describe('exportBatch', () => {
    it('should export multiple prompts successfully', async () => {
      const prompt2 = { ...samplePrompt, id: 'test-prompt-2', slug: 'test-prompt-2' };
      const prompts = [samplePrompt, prompt2];

      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1',
        variables: { task: 'test task' }
      };

      const results = await exportService.exportBatch(prompts, options);

      expect(results).toHaveLength(2);
      expect(results[0].metadata.promptId).toBe('test-prompt-id');
      expect(results[1].metadata.promptId).toBe('test-prompt-2');
      expect(vi.mocked(fs.writeFile)).toHaveBeenCalledTimes(2);
    });

    it('should continue with other prompts if one fails', async () => {
      const invalidPrompt = { ...samplePrompt };
      delete invalidPrompt.prompt_structured;
      
      const validPrompt = { ...samplePrompt, id: 'valid-prompt', slug: 'valid-prompt' };
      const prompts = [invalidPrompt, validPrompt];

      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1',
        variables: { task: 'test task' }
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const results = await exportService.exportBatch(prompts, options);

      expect(results).toHaveLength(1);
      expect(results[0].metadata.promptId).toBe('valid-prompt');
      expect(consoleSpy).toHaveBeenCalledOnce();
      
      consoleSpy.mockRestore();
    });
  });

  describe('validateExportOptions', () => {
    it('should validate successfully with correct options', () => {
      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1',
        variables: { task: 'test task' }
      };

      const result = exportService.validateExportOptions(samplePrompt, options);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.missingVariables).toHaveLength(0);
    });

    it('should detect missing required variables', () => {
      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1'
        // Missing required 'task' variable
      };

      const result = exportService.validateExportOptions(samplePrompt, options);

      expect(result.isValid).toBe(false);
      expect(result.missingVariables).toContain('task');
      expect(result.errors).toContain('Missing required variables: task');
    });

    it('should detect unsupported provider', () => {
      const options: ExportOptions = {
        provider: 'unsupported-provider',
        model: 'some-model'
      };

      const result = exportService.validateExportOptions(samplePrompt, options);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Provider 'unsupported-provider' is not registered");
    });

    it('should detect unsupported model', () => {
      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'unsupported-model',
        variables: { task: 'test task' }
      };

      const result = exportService.validateExportOptions(samplePrompt, options);

      expect(result.isValid).toBe(false);
      expect(result.providerIssues).toContain("Model 'unsupported-model' is not supported by provider 'mock-provider'");
    });

    it('should validate render options', () => {
      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1',
        variables: { task: 'test task' },
        renderOptions: {
          temperature: 3.0, // Invalid temperature
          maxTokens: 10000 // Exceeds model limit
        }
      };

      const result = exportService.validateExportOptions(samplePrompt, options);

      expect(result.isValid).toBe(false);
      expect(result.providerIssues).toContain('Temperature must be between 0 and 2');
      expect(result.providerIssues).toContain('Requested maxTokens (10000) exceeds model limit (4096)');
    });
  });

  describe('getSupportedProviders', () => {
    it('should return supported providers for a prompt', () => {
      const supportedProviders = exportService.getSupportedProviders(samplePrompt);

      expect(supportedProviders).toContain('mock-provider');
    });

    it('should return empty array for prompt without structured format', () => {
      const promptWithoutStructured = { ...samplePrompt };
      delete promptWithoutStructured.prompt_structured;

      const supportedProviders = exportService.getSupportedProviders(promptWithoutStructured);

      expect(supportedProviders).toHaveLength(0);
    });
  });

  describe('getExportPreview', () => {
    it('should return preview with valid options', async () => {
      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1',
        variables: { task: 'test task' }
      };

      const preview = await exportService.getExportPreview(samplePrompt, options);

      expect(preview.filename).toBe('test-prompt_mock-provider_v1.json');
      expect(preview.content).toBeDefined();
      expect(preview.validation.isValid).toBe(true);
    });

    it('should return preview with validation errors', async () => {
      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1'
        // Missing required variables
      };

      const preview = await exportService.getExportPreview(samplePrompt, options);

      expect(preview.filename).toBe('test-prompt_mock-provider_v1.json');
      expect(preview.content).toBeNull();
      expect(preview.validation.isValid).toBe(false);
      expect(preview.validation.missingVariables).toContain('task');
    });
  });

  describe('filename generation', () => {
    it('should sanitize invalid characters in filename', async () => {
      const promptWithSpecialChars = {
        ...samplePrompt,
        slug: 'test/prompt:with*special<chars>'
      };

      const options: ExportOptions = {
        provider: 'mock-provider',
        model: 'mock-model-1',
        variables: { task: 'test task' }
      };

      const result = await exportService.exportPrompt(promptWithSpecialChars, options);

      expect(result.filename).toBe('test_prompt_with_special_chars_mock-provider_v1.json');
    });

    it('should handle provider names with special characters', async () => {
      // Register provider with special characters
      const specialAdapter = new MockProviderAdapter();
      Object.defineProperty(specialAdapter, 'id', { value: 'special-provider@v2' });
      mockRegistry.registerAdapter(specialAdapter);

      const options: ExportOptions = {
        provider: 'special-provider@v2',
        model: 'mock-model-1',
        variables: { task: 'test task' }
      };

      const result = await exportService.exportPrompt(samplePrompt, options);

      expect(result.filename).toBe('test-prompt_special-provider_v2_v1.json');
    });
  });
});