// Tests for FileSystemPromptManager

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileSystemPromptManager, FileSystemPromptManagerConfig } from '../filesystem-prompt-manager';
import { PromptRecord, HumanPrompt } from '../../models/prompt';
import { EnhancementResult } from '../../models/enhancement';
import { IntegratedStorage } from '../../storage/integrated-storage';
import { EnhancementAgent } from '../enhancement-agent';
import { VariableManager } from '../variable-manager';
import { RatingSystem } from '../rating-system';
import { VersionManager } from '../version-manager';
import { ProviderRegistry } from '../../adapters/provider-registry';
import { ProviderAdapter } from '../../adapters/provider-adapter';
import { PromptFilters, RenderOptions, ProviderPayload } from '../../types/common';

// Mock implementations
const mockStorage: IntegratedStorage = {
  initialize: vi.fn(),
  shutdown: vi.fn(),
  savePrompt: vi.fn(),
  loadPrompt: vi.fn(),
  loadPromptBySlug: vi.fn(),
  listPrompts: vi.fn(),
  deletePrompt: vi.fn(),
  promptExists: vi.fn(),
  saveRender: vi.fn(),
  loadRender: vi.fn(),
  generateSlug: vi.fn(),
  getStorageInfo: vi.fn(),
  searchPrompts: vi.fn(),
  getCachedRender: vi.fn(),
  cacheRender: vi.fn(),
  getStorageStats: vi.fn(),
  rebuildIndex: vi.fn(),
  clearAllCaches: vi.fn()
};

const mockEnhancementAgent: EnhancementAgent = {
  enhance: vi.fn(),
  generateQuestions: vi.fn(),
  validateStructuredPrompt: vi.fn(),
  analyzePrompt: vi.fn(),
  extractVariables: vi.fn(),
  generateRationale: vi.fn()
};

const mockVariableManager = {
  generateQuestions: vi.fn(),
  validateQuestions: vi.fn(),
  validateAnswers: vi.fn(),
  answersToVariableValues: vi.fn(),
  getMissingRequiredVariables: vi.fn(),
  generateMissingQuestions: vi.fn(),
  areAllRequiredVariablesAnswered: vi.fn(),
  saveAnswer: vi.fn(),
  collectAnswers: vi.fn(),
  getAnswers: vi.fn(),
  getAnswersByUser: vi.fn(),
  updateAnswer: vi.fn(),
  deleteAnswer: vi.fn(),
  substituteVariables: vi.fn(),
  substituteVariablesFromAnswers: vi.fn(),
  extractVariableNames: vi.fn(),
  validateVariableSubstitution: vi.fn()
};

const mockRatingSystem: RatingSystem = {
  ratePrompt: vi.fn(),
  getPromptRatings: vi.fn(),
  getAverageRating: vi.fn(),
  getTopRatedPrompts: vi.fn(),
  logRun: vi.fn(),
  getRunHistory: vi.fn(),
  getRatingAggregation: vi.fn(),
  getUserRating: vi.fn(),
  updateRating: vi.fn(),
  deleteRating: vi.fn()
};

const mockVersionManager: VersionManager = {
  createVersion: vi.fn(),
  compareVersions: vi.fn(),
  getVersionHistory: vi.fn(),
  getVersionDetails: vi.fn(),
  validateVersion: vi.fn(),
  generateChangeSummary: vi.fn()
};

const mockProviderAdapter: ProviderAdapter = {
  id: 'test-provider',
  name: 'Test Provider',
  supportedModels: ['test-model'],
  capabilities: {
    supportsSystemMessages: true,
    maxContextLength: 4000,
    supportedRoles: ['system', 'user']
  },
  render: vi.fn(),
  validate: vi.fn(),
  supports: vi.fn(),
  getDefaultOptions: vi.fn(),
  getConfiguration: vi.fn()
};

const mockProviderRegistry: ProviderRegistry = {
  registerAdapter: vi.fn(),
  getAdapter: vi.fn(),
  listProviders: vi.fn(),
  supportsModel: vi.fn(),
  hasProvider: vi.fn(),
  unregisterAdapter: vi.fn(),
  getAllAdapters: vi.fn(),
  findBestProvider: vi.fn(),
  getRecommendations: vi.fn()
};

describe('FileSystemPromptManager', () => {
  let promptManager: FileSystemPromptManager;
  let config: FileSystemPromptManagerConfig;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    config = {
      storage: mockStorage,
      enhancementAgent: mockEnhancementAgent,
      variableManager: mockVariableManager,
      ratingSystem: mockRatingSystem,
      versionManager: mockVersionManager,
      providerRegistry: mockProviderRegistry
    };

    promptManager = new FileSystemPromptManager(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize all services', async () => {
      const mockRatingSystemWithInit = {
        ...mockRatingSystem,
        initialize: vi.fn()
      };
      
      const configWithInit = {
        ...config,
        ratingSystem: mockRatingSystemWithInit
      };
      
      const manager = new FileSystemPromptManager(configWithInit);
      
      await manager.initialize();
      
      expect(mockStorage.initialize).toHaveBeenCalled();
      expect(mockRatingSystemWithInit.initialize).toHaveBeenCalled();
    });
  });

  describe('createPrompt', () => {
    const humanPrompt: HumanPrompt = {
      goal: 'Test goal',
      audience: 'Test audience',
      steps: ['Step 1', 'Step 2'],
      output_expectations: {
        format: 'JSON',
        fields: ['field1', 'field2']
      }
    };

    const metadata = {
      title: 'Test Prompt',
      summary: 'Test summary',
      tags: ['test', 'example'],
      owner: 'test-user'
    };

    beforeEach(() => {
      vi.mocked(mockStorage.generateSlug).mockResolvedValue('test-prompt');
      vi.mocked(mockVersionManager.createVersion).mockReturnValue({
        number: 1,
        message: 'Initial prompt creation',
        created_at: '2023-01-01T00:00:00.000Z',
        author: 'test-user'
      });
    });

    it('should create a new prompt successfully', async () => {
      const result = await promptManager.createPrompt(humanPrompt, metadata);

      expect(result).toBeDefined();
      expect(result.metadata.title).toBe('Test Prompt');
      expect(result.metadata.owner).toBe('test-user');
      expect(result.prompt_human).toEqual(humanPrompt);
      expect(result.status).toBe('draft');
      expect(mockStorage.savePrompt).toHaveBeenCalledWith(result);
    });

    it('should throw error for missing title', async () => {
      const invalidMetadata = { ...metadata, title: '' };
      
      await expect(promptManager.createPrompt(humanPrompt, invalidMetadata))
        .rejects.toThrow('Title is required');
    });

    it('should throw error for missing owner', async () => {
      const invalidMetadata = { ...metadata, owner: '' };
      
      await expect(promptManager.createPrompt(humanPrompt, invalidMetadata))
        .rejects.toThrow('Owner is required');
    });
  });

  describe('renderPrompt', () => {
    const mockPrompt: PromptRecord = {
      version: 1,
      id: 'test-id',
      slug: 'test-prompt',
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
      status: 'active',
      metadata: {
        title: 'Test Prompt',
        summary: 'Test summary',
        tags: ['test'],
        owner: 'test-user'
      },
      prompt_human: {
        goal: 'Test goal',
        audience: 'Test audience',
        steps: ['Step 1'],
        output_expectations: {
          format: 'JSON',
          fields: ['field1']
        }
      },
      prompt_structured: {
        schema_version: 1,
        system: ['You are a helpful assistant'],
        capabilities: ['reasoning'],
        user_template: 'Please help with {{task}}',
        rules: [{ name: 'rule1', description: 'Be helpful' }],
        variables: ['task']
      },
      variables: [{
        key: 'task',
        label: 'Task',
        type: 'string',
        required: true
      }],
      history: {
        versions: [],
        ratings: []
      },
      renders: []
    };

    const renderOptions: RenderOptions = {
      model: 'test-model',
      variables: { task: 'test task' }
    };

    const mockPayload: ProviderPayload = {
      provider: 'test-provider',
      model: 'test-model',
      content: { messages: [{ role: 'user', content: 'Please help with test task' }] }
    };

    beforeEach(() => {
      vi.mocked(mockStorage.loadPrompt).mockResolvedValue(mockPrompt);
      vi.mocked(mockProviderRegistry.getAdapter).mockReturnValue(mockProviderAdapter);
      vi.mocked(mockProviderAdapter.supports).mockReturnValue(true);
      vi.mocked(mockProviderAdapter.render).mockReturnValue(mockPayload);
      vi.mocked(mockProviderAdapter.validate).mockReturnValue({ isValid: true, errors: [] });
      vi.mocked(mockStorage.getCachedRender).mockResolvedValue(null);
      vi.mocked(mockVariableManager.extractVariableNames).mockReturnValue(['task']);
      vi.mocked(mockVariableManager.substituteVariables).mockReturnValue('Please help with test task');
    });

    it('should render prompt successfully', async () => {
      const result = await promptManager.renderPrompt('test-id', 'test-provider', renderOptions);

      expect(result).toEqual(mockPayload);
      expect(mockProviderAdapter.render).toHaveBeenCalled();
      expect(mockStorage.cacheRender).toHaveBeenCalledWith('test-id', 'test-provider', 1, mockPayload);
    });

    it('should throw error if prompt not enhanced', async () => {
      const promptWithoutStructured = { ...mockPrompt, prompt_structured: undefined };
      vi.mocked(mockStorage.loadPrompt).mockResolvedValue(promptWithoutStructured);

      await expect(promptManager.renderPrompt('test-id', 'test-provider', renderOptions))
        .rejects.toThrow('Prompt must be enhanced before rendering');
    });

    it('should throw error for unsupported provider', async () => {
      vi.mocked(mockProviderRegistry.getAdapter).mockImplementation(() => {
        throw new Error("Provider 'invalid-provider' not found");
      });

      await expect(promptManager.renderPrompt('test-id', 'invalid-provider', renderOptions))
        .rejects.toThrow("Provider 'invalid-provider' not found");
    });

    it('should return cached render if available', async () => {
      vi.mocked(mockStorage.getCachedRender).mockResolvedValue(mockPayload);

      const result = await promptManager.renderPrompt('test-id', 'test-provider', renderOptions);

      expect(result).toEqual(mockPayload);
      expect(mockProviderAdapter.render).not.toHaveBeenCalled();
    });
  });

  describe('enhancePrompt', () => {
    const mockPrompt: PromptRecord = {
      version: 1,
      id: 'test-id',
      slug: 'test-prompt',
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
      status: 'draft',
      metadata: {
        title: 'Test Prompt',
        summary: 'Test summary',
        tags: ['test'],
        owner: 'test-user'
      },
      prompt_human: {
        goal: 'Test goal',
        audience: 'Test audience',
        steps: ['Step 1'],
        output_expectations: {
          format: 'JSON',
          fields: ['field1']
        }
      },
      variables: [],
      history: {
        versions: [],
        ratings: []
      },
      renders: []
    };

    const mockEnhancementResult: EnhancementResult = {
      structuredPrompt: {
        schema_version: 1,
        system: ['You are a helpful assistant'],
        capabilities: ['reasoning'],
        user_template: 'Please help with {{task}}',
        rules: [{ name: 'rule1', description: 'Be helpful' }],
        variables: ['task']
      },
      questions: [],
      rationale: 'Enhanced the prompt structure',
      confidence: 0.9
    };

    beforeEach(() => {
      vi.mocked(mockStorage.loadPrompt).mockResolvedValue(mockPrompt);
      vi.mocked(mockEnhancementAgent.enhance).mockResolvedValue(mockEnhancementResult);
      vi.mocked(mockEnhancementAgent.extractVariables).mockReturnValue([{
        key: 'task',
        label: 'Task',
        type: 'string',
        required: true
      }]);
      vi.mocked(mockVersionManager.createVersion).mockReturnValue({
        number: 2,
        message: 'Enhanced prompt: Enhanced the prompt structure',
        created_at: '2023-01-01T01:00:00.000Z',
        author: 'system'
      });
    });

    it('should enhance prompt successfully', async () => {
      const result = await promptManager.enhancePrompt('test-id');

      expect(result).toEqual(mockEnhancementResult);
      expect(mockEnhancementAgent.enhance).toHaveBeenCalledWith(
        mockPrompt.prompt_human,
        { targetProvider: undefined, preserveStyle: undefined }
      );
      expect(mockStorage.savePrompt).toHaveBeenCalled();
    });

    it('should pass enhancement options', async () => {
      const options = { target_provider: 'openai', preserve_style: true };
      
      await promptManager.enhancePrompt('test-id', options);

      expect(mockEnhancementAgent.enhance).toHaveBeenCalledWith(
        mockPrompt.prompt_human,
        { targetProvider: 'openai', userPreferences: { preserveStyle: true } }
      );
    });
  });

  describe('exportPrompt', () => {
    const mockPrompt: PromptRecord = {
      version: 1,
      id: 'test-id',
      slug: 'test-prompt',
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z',
      status: 'active',
      metadata: {
        title: 'Test Prompt',
        summary: 'Test summary',
        tags: ['test'],
        owner: 'test-user'
      },
      prompt_human: {
        goal: 'Test goal',
        audience: 'Test audience',
        steps: ['Step 1'],
        output_expectations: {
          format: 'JSON',
          fields: ['field1']
        }
      },
      prompt_structured: {
        schema_version: 1,
        system: ['You are a helpful assistant'],
        capabilities: ['reasoning'],
        user_template: 'Please help with {{task}}',
        rules: [{ name: 'rule1', description: 'Be helpful' }],
        variables: ['task']
      },
      variables: [{
        key: 'task',
        label: 'Task',
        type: 'string',
        required: true
      }],
      history: {
        versions: [],
        ratings: []
      },
      renders: []
    };

    const mockPayload: ProviderPayload = {
      provider: 'test-provider',
      model: 'test-model',
      content: { messages: [{ role: 'user', content: 'Please help with test task' }] }
    };

    beforeEach(() => {
      vi.mocked(mockStorage.loadPrompt).mockResolvedValue(mockPrompt);
      vi.mocked(mockProviderRegistry.getAdapter).mockReturnValue(mockProviderAdapter);
      vi.mocked(mockProviderAdapter.supports).mockReturnValue(true);
      vi.mocked(mockProviderAdapter.render).mockReturnValue(mockPayload);
      vi.mocked(mockProviderAdapter.validate).mockReturnValue({ isValid: true, errors: [] });
      vi.mocked(mockStorage.getCachedRender).mockResolvedValue(null);
      vi.mocked(mockVariableManager.extractVariableNames).mockReturnValue(['task']);
      vi.mocked(mockVariableManager.substituteVariables).mockReturnValue('Please help with test task');
    });

    it('should export prompt successfully', async () => {
      const result = await promptManager.exportPrompt('test-id', 'test-provider', {
        model: 'test-model',
        variables: { task: 'test task' }
      });

      expect(result.filename).toBe('test-prompt_test-provider_v1.json');
      expect(result.metadata.promptId).toBe('test-id');
      expect(result.metadata.provider).toBe('test-provider');
      expect(result.metadata.version).toBe(1);
      
      const parsedContent = JSON.parse(result.content);
      expect(parsedContent._metadata).toBeDefined();
      expect(parsedContent.provider).toBe('test-provider');
    });

    it('should use custom filename if provided', async () => {
      const result = await promptManager.exportPrompt('test-id', 'test-provider', {
        model: 'test-model',
        variables: { task: 'test task' },
        filename: 'custom-export.json'
      });

      expect(result.filename).toBe('custom-export.json');
    });
  });
});