// Import Service Tests

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ImportService, ImportOptions } from '../import-service';
import { PromptRecord } from '../../models/prompt';
import { ProviderRegistry } from '../../adapters/provider-registry';
import { PromptManager } from '../prompt-manager';
import * as fs from 'fs/promises';

// Mock fs module
vi.mock('fs/promises');

// Mock provider registry
class MockProviderRegistry implements ProviderRegistry {
  registerAdapter(): void {}
  getAdapter(): any { return null; }
  listProviders() { return []; }
  supportsModel() { return []; }
  hasProvider(): boolean { return true; }
  unregisterAdapter(): void {}
  getAllAdapters() { return []; }
  findBestProvider() { return null; }
  getRecommendations() { return []; }
}

// Mock prompt manager
class MockPromptManager implements PromptManager {
  async createPrompt(humanPrompt: any): Promise<PromptRecord> {
    return {
      version: 1,
      id: 'created-prompt-id',
      slug: 'created-prompt',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'draft',
      metadata: {
        title: 'Created Prompt',
        summary: '',
        tags: [],
        owner: ''
      },
      prompt_human: humanPrompt,
      variables: [],
      history: { versions: [], ratings: [] },
      renders: []
    } as PromptRecord;
  }

  async updatePrompt(): Promise<PromptRecord> {
    throw new Error('Not implemented');
  }

  async getPrompt(): Promise<PromptRecord> {
    throw new Error('Prompt not found');
  }

  async listPrompts(): Promise<PromptRecord[]> {
    return [];
  }

  async deletePrompt(): Promise<void> {}
  async enhancePrompt(): Promise<any> { return null; }
  async renderPrompt(): Promise<any> { return null; }
}

describe('ImportService', () => {
  let importService: ImportService;
  let mockRegistry: MockProviderRegistry;
  let mockPromptManager: MockPromptManager;

  beforeEach(() => {
    mockRegistry = new MockProviderRegistry();
    mockPromptManager = new MockPromptManager();
    importService = new ImportService(mockPromptManager);

    // Mock fs functions
    vi.mocked(fs.readFile).mockResolvedValue('{}');
    vi.mocked(fs.readdir).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('detectProviderFormat', () => {
    it('should detect OpenAI format', () => {
      const openAIContent = {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello' }
        ]
      };

      const validation = importService.validateImportContent(openAIContent, {
        conflictResolution: 'skip'
      });

      expect(validation.detectedProvider).toBe('openai');
      expect(validation.confidence).toBe(0.9);
    });

    it('should detect Anthropic format', () => {
      const anthropicContent = {
        model: 'claude-3',
        system: 'You are a helpful assistant',
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      };

      const validation = importService.validateImportContent(anthropicContent, {
        conflictResolution: 'skip'
      });

      expect(validation.detectedProvider).toBe('anthropic');
      expect(validation.confidence).toBe(0.9);
    });

    it('should detect internal format', () => {
      const internalContent = {
        version: 1,
        id: 'test-id',
        slug: 'test-prompt',
        prompt_human: {
          goal: 'Test goal',
          audience: 'Test audience',
          steps: ['Step 1'],
          output_expectations: { format: 'text', fields: [] }
        }
      };

      const validation = importService.validateImportContent(internalContent, {
        conflictResolution: 'skip'
      });

      expect(validation.detectedProvider).toBe('internal');
      expect(validation.confidence).toBe(1.0);
    });

    it('should fail to detect unknown format', () => {
      const unknownContent = {
        someField: 'someValue'
      };

      const validation = importService.validateImportContent(unknownContent, {
        conflictResolution: 'skip'
      });

      expect(validation.detectedProvider).toBeUndefined();
      expect(validation.confidence).toBe(0);
      expect(validation.isValid).toBe(false);
    });
  });

  describe('validateImportContent', () => {
    it('should validate valid OpenAI content', () => {
      const content = {
        messages: [
          { role: 'system', content: 'System message' },
          { role: 'user', content: 'User message' }
        ]
      };

      const result = importService.validateImportContent(content, {
        conflictResolution: 'skip'
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid content', () => {
      const result = importService.validateImportContent(null, {
        conflictResolution: 'skip'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Content must be a valid object');
    });

    it('should validate with specified provider', () => {
      const content = {
        messages: [{ role: 'user', content: 'Hello' }]
      };

      const result = importService.validateImportContent(content, {
        sourceProvider: 'openai',
        conflictResolution: 'skip'
      });

      expect(result.isValid).toBe(true);
    });

    it('should reject empty messages array', () => {
      const content = {
        messages: []
      };

      const result = importService.validateImportContent(content, {
        sourceProvider: 'openai',
        conflictResolution: 'skip'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Messages array cannot be empty');
    });
  });

  describe('importFromContent', () => {
    it('should import OpenAI format successfully', async () => {
      // Use ImportService without PromptManager to test direct conversion
      const importServiceWithoutManager = new ImportService();
      
      const openAIContent = JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Write a {{type}} about {{topic}}' }
        ]
      });

      const options: ImportOptions = {
        conflictResolution: 'create_new',
        defaultOwner: 'test-user',
        defaultTags: ['imported']
      };

      const result = await importServiceWithoutManager.importFromContent(openAIContent, options);

      expect(result).toBeDefined();
      expect(result?.metadata.owner).toBe('test-user');
      expect(result?.metadata.tags).toContain('imported');
      expect(result?.prompt_structured?.variables).toContain('type');
      expect(result?.prompt_structured?.variables).toContain('topic');
    });

    it('should import Anthropic format successfully', async () => {
      const importServiceWithoutManager = new ImportService();
      
      const anthropicContent = JSON.stringify({
        model: 'claude-3',
        system: 'You are a helpful writing assistant',
        messages: [
          { role: 'user', content: 'Help me write about {{subject}}' }
        ]
      });

      const options: ImportOptions = {
        conflictResolution: 'create_new',
        defaultOwner: 'test-user'
      };

      const result = await importServiceWithoutManager.importFromContent(anthropicContent, options);

      expect(result).toBeDefined();
      expect(result?.prompt_structured?.system).toEqual(['You are a helpful writing assistant']);
      expect(result?.prompt_structured?.variables).toContain('subject');
    });

    it('should import internal format successfully', async () => {
      const importServiceWithoutManager = new ImportService();
      
      const internalContent = JSON.stringify({
        version: 1,
        id: 'original-id',
        slug: 'original-slug',
        metadata: {
          title: 'Original Title',
          summary: 'Original summary',
          tags: ['original'],
          owner: 'original-owner'
        },
        prompt_human: {
          goal: 'Original goal',
          audience: 'Original audience',
          steps: ['Step 1'],
          output_expectations: { format: 'text', fields: [] }
        }
      });

      const options: ImportOptions = {
        conflictResolution: 'create_new',
        defaultOwner: 'new-owner',
        defaultTags: ['imported'],
        slugPrefix: 'imported'
      };

      const result = await importServiceWithoutManager.importFromContent(internalContent, options);

      expect(result).toBeDefined();
      expect(result?.id).not.toBe('original-id'); // Should generate new ID
      expect(result?.slug).toContain('imported-'); // Should have prefix
      expect(result?.metadata.owner).toBe('new-owner'); // Should override owner
      expect(result?.metadata.tags).toContain('imported'); // Should add new tags
      expect(result?.metadata.tags).toContain('original'); // Should keep original tags
    });

    it('should throw error for invalid JSON', async () => {
      const invalidContent = 'invalid json content';

      const options: ImportOptions = {
        conflictResolution: 'skip'
      };

      await expect(importService.importFromContent(invalidContent, options))
        .rejects.toThrow('Invalid JSON content');
    });

    it('should throw error for undetectable format', async () => {
      const unknownContent = JSON.stringify({
        someField: 'someValue'
      });

      const options: ImportOptions = {
        conflictResolution: 'skip'
      };

      await expect(importService.importFromContent(unknownContent, options))
        .rejects.toThrow('Could not detect provider format');
    });
  });

  describe('importFromFiles', () => {
    it('should import multiple files successfully', async () => {
      const openAIContent = JSON.stringify({
        messages: [
          { role: 'system', content: 'System' },
          { role: 'user', content: 'User message' }
        ]
      });

      vi.mocked(fs.readFile).mockResolvedValue(openAIContent);

      const options: ImportOptions = {
        conflictResolution: 'create_new',
        defaultOwner: 'test-user'
      };

      const result = await importService.importFromFiles(['file1.json', 'file2.json'], options);

      expect(result.summary.totalFiles).toBe(2);
      expect(result.summary.imported).toBe(2);
      expect(result.summary.failed).toBe(0);
      expect(result.imported).toHaveLength(2);
    });

    it('should handle file read errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const options: ImportOptions = {
        conflictResolution: 'skip'
      };

      const result = await importService.importFromFiles(['nonexistent.json'], options);

      expect(result.summary.totalFiles).toBe(1);
      expect(result.summary.failed).toBe(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('File not found');
    });

    it('should handle mixed success and failure', async () => {
      const validContent = JSON.stringify({
        messages: [{ role: 'user', content: 'Valid content' }]
      });

      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(validContent)
        .mockRejectedValueOnce(new Error('Read error'));

      const options: ImportOptions = {
        conflictResolution: 'create_new'
      };

      const result = await importService.importFromFiles(['valid.json', 'invalid.json'], options);

      expect(result.summary.totalFiles).toBe(2);
      expect(result.summary.imported).toBe(1);
      expect(result.summary.failed).toBe(1);
    });
  });

  describe('importFromDirectory', () => {
    it('should import files from directory', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['file1.json', 'file2.yaml', 'file3.txt'] as any);
      
      const validContent = JSON.stringify({
        messages: [{ role: 'user', content: 'Content' }]
      });
      vi.mocked(fs.readFile).mockResolvedValue(validContent);

      const options: ImportOptions = {
        conflictResolution: 'create_new'
      };

      const result = await importService.importFromDirectory('./test-dir', options);

      // Should only process .json and .yaml files, not .txt
      expect(result.summary.totalFiles).toBe(2);
      expect(vi.mocked(fs.readFile)).toHaveBeenCalledTimes(2);
    });

    it('should use custom file pattern', async () => {
      vi.mocked(fs.readdir).mockResolvedValue(['file1.json', 'file2.custom'] as any);
      
      const validContent = JSON.stringify({
        messages: [{ role: 'user', content: 'Content' }]
      });
      vi.mocked(fs.readFile).mockResolvedValue(validContent);

      const options: ImportOptions = {
        conflictResolution: 'create_new'
      };

      const customPattern = /\.custom$/;
      const result = await importService.importFromDirectory('./test-dir', options, customPattern);

      // Should only process .custom files
      expect(result.summary.totalFiles).toBe(1);
    });
  });

  describe('conflict resolution', () => {
    beforeEach(() => {
      // Mock existing prompt found
      vi.spyOn(mockPromptManager, 'getPrompt').mockResolvedValue({
        id: 'existing-id',
        slug: 'existing-slug',
        metadata: { title: 'Existing Prompt', summary: '', tags: [], owner: 'existing-owner' }
      } as PromptRecord);
    });

    it('should skip on conflict when resolution is skip', async () => {
      const content = JSON.stringify({
        messages: [{ role: 'user', content: 'Content' }]
      });

      const options: ImportOptions = {
        conflictResolution: 'skip'
      };

      const result = await importService.importFromContent(content, options);

      expect(result).toBeNull();
    });

    it('should create new on conflict when resolution is create_new', async () => {
      // Mock that a prompt is found to trigger conflict resolution
      vi.spyOn(mockPromptManager, 'listPrompts').mockResolvedValue([{
        id: 'existing-id',
        slug: 'existing-slug',
        metadata: { title: 'Content', summary: '', tags: [], owner: 'existing-owner' }
      } as PromptRecord]);

      const content = JSON.stringify({
        messages: [{ role: 'user', content: 'Content' }]
      });

      const options: ImportOptions = {
        conflictResolution: 'create_new'
      };

      const result = await importService.importFromContent(content, options);

      expect(result).toBeDefined();
      // When using PromptManager, it returns the created prompt structure
      expect(result?.id).toBe('created-prompt-id');
    });
  });

  describe('variable extraction', () => {
    it('should extract variables from template', async () => {
      const importServiceWithoutManager = new ImportService();
      
      const content = JSON.stringify({
        messages: [
          { role: 'user', content: 'Write a {{type}} about {{topic}} for {{audience}}' }
        ]
      });

      const options: ImportOptions = {
        conflictResolution: 'create_new'
      };

      const result = await importServiceWithoutManager.importFromContent(content, options);

      expect(result?.prompt_structured?.variables).toContain('type');
      expect(result?.prompt_structured?.variables).toContain('topic');
      expect(result?.prompt_structured?.variables).toContain('audience');
      expect(result?.variables).toHaveLength(3);
    });

    it('should create proper variable definitions', async () => {
      const importServiceWithoutManager = new ImportService();
      
      const content = JSON.stringify({
        messages: [
          { role: 'user', content: 'Process {{user_input}}' }
        ]
      });

      const options: ImportOptions = {
        conflictResolution: 'create_new'
      };

      const result = await importServiceWithoutManager.importFromContent(content, options);

      const variable = result?.variables.find(v => v.key === 'user_input');
      expect(variable).toBeDefined();
      expect(variable?.label).toBe('User Input'); // Should be humanized
      expect(variable?.type).toBe('string');
      expect(variable?.required).toBe(true);
    });
  });

  describe('title extraction', () => {
    it('should extract title from markdown header', async () => {
      const importServiceWithoutManager = new ImportService();
      
      const content = JSON.stringify({
        messages: [
          { role: 'user', content: '# Email Generator\n\nGenerate an email about {{topic}}' }
        ]
      });

      const options: ImportOptions = {
        conflictResolution: 'create_new'
      };

      const result = await importServiceWithoutManager.importFromContent(content, options);

      expect(result?.metadata.title).toBe('Email Generator');
    });

    it('should extract title from Title: prefix', async () => {
      const importServiceWithoutManager = new ImportService();
      
      const content = JSON.stringify({
        messages: [
          { role: 'user', content: 'Title: Code Review Helper\n\nHelp review code' }
        ]
      });

      const options: ImportOptions = {
        conflictResolution: 'create_new'
      };

      const result = await importServiceWithoutManager.importFromContent(content, options);

      expect(result?.metadata.title).toBe('Code Review Helper');
    });

    it('should use first 50 characters as fallback title', async () => {
      const importServiceWithoutManager = new ImportService();
      
      const content = JSON.stringify({
        messages: [
          { role: 'user', content: 'This is a very long message that should be truncated to create a title from the first part of the content' }
        ]
      });

      const options: ImportOptions = {
        conflictResolution: 'create_new'
      };

      const result = await importServiceWithoutManager.importFromContent(content, options);

      expect(result?.metadata.title).toBe('This is a very long message that should be truncat');
    });
  });
});