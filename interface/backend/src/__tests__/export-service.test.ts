import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExportService } from '../services/export-service.js';
import { PromptRecord } from '../services/prompt-library-service.js';
import * as fs from 'fs/promises';
import path from 'path';

// Mock dependencies
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

const mockPromptLibraryService = {
  getPrompt: vi.fn(),
  getPromptRatings: vi.fn(),
  renderPrompt: vi.fn()
};

vi.mock('../services/prompt-library-service.js', () => ({
  getPromptLibraryService: () => mockPromptLibraryService
}));

describe('ExportService', () => {
  let exportService: ExportService;
  let mockPrompt: PromptRecord;
  const testTempDir = path.resolve(process.cwd(), 'test-temp');

  beforeEach(async () => {
    exportService = new ExportService({ tempDir: testTempDir });
    await exportService.initialize();

    mockPrompt = {
      id: 'test-prompt-123',
      version: 1,
      metadata: {
        title: 'Test Prompt',
        summary: 'A test prompt for unit testing',
        tags: ['test', 'unit-test'],
        owner: 'test-user',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      humanPrompt: {
        goal: 'Test the export functionality',
        audience: 'Developers',
        steps: ['Step 1', 'Step 2', 'Step 3'],
        output_expectations: {
          format: 'JSON',
          fields: ['result', 'status']
        }
      },
      variables: [
        {
          key: 'input',
          label: 'Input Data',
          type: 'string',
          required: true,
          sensitive: false
        }
      ],
      history: []
    };
  });

  afterEach(async () => {
    await exportService.shutdown();
    try {
      await fs.rmdir(testTempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newService = new ExportService({ tempDir: testTempDir + '-new' });
      await expect(newService.initialize()).resolves.not.toThrow();
      await newService.shutdown();
    });

    it('should create temp directory on initialization', async () => {
      const newTempDir = testTempDir + '-init-test';
      const newService = new ExportService({ tempDir: newTempDir });
      await newService.initialize();
      
      const stats = await fs.stat(newTempDir);
      expect(stats.isDirectory()).toBe(true);
      
      await newService.shutdown();
      await fs.rmdir(newTempDir, { recursive: true });
    });
  });

  describe('getSupportedFormats', () => {
    it('should return all supported formats', () => {
      const formats = exportService.getSupportedFormats();
      
      expect(formats).toHaveLength(5);
      expect(formats.map(f => f.id)).toEqual(['json', 'yaml', 'openai', 'anthropic', 'meta']);
      
      formats.forEach(format => {
        expect(format).toHaveProperty('id');
        expect(format).toHaveProperty('name');
        expect(format).toHaveProperty('description');
      });
    });
  });

  describe('exportPrompt', () => {
    beforeEach(() => {
      mockPromptLibraryService.getPrompt.mockResolvedValue(mockPrompt);
      mockPromptLibraryService.getPromptRatings.mockResolvedValue([]);
      mockPromptLibraryService.renderPrompt.mockResolvedValue({
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Test prompt content' }
        ],
        parameters: { temperature: 0.7, max_tokens: 2000 },
        formatted_prompt: 'Test prompt content'
      });
    });

    it('should export prompt as JSON', async () => {
      const result = await exportService.exportPrompt('test-prompt-123', {
        format: 'json',
        includeMetadata: true
      });

      expect(result.filename).toBe('test_prompt.json');
      expect(result.mimeType).toBe('application/json');
      expect(result.size).toBeGreaterThan(0);
      
      const content = JSON.parse(result.content);
      expect(content.id).toBe('test-prompt-123');
      expect(content.metadata.title).toBe('Test Prompt');
    });

    it('should export prompt as YAML', async () => {
      const result = await exportService.exportPrompt('test-prompt-123', {
        format: 'yaml',
        includeMetadata: true
      });

      expect(result.filename).toBe('test_prompt.yaml');
      expect(result.mimeType).toBe('application/x-yaml');
      expect(result.content).toContain('id: test-prompt-123');
      expect(result.content).toContain('title: Test Prompt');
    });

    it('should export prompt in OpenAI format', async () => {
      const result = await exportService.exportPrompt('test-prompt-123', {
        format: 'openai',
        includeMetadata: true
      });

      expect(result.filename).toBe('test_prompt_openai.json');
      expect(result.mimeType).toBe('application/json');
      
      const content = JSON.parse(result.content);
      expect(content.provider).toBe('openai');
      expect(content.request.messages).toBeDefined();
    });

    it('should include ratings when requested', async () => {
      mockPromptLibraryService.getPromptRatings.mockResolvedValue([
        { id: 'rating-1', score: 5, note: 'Great prompt!' }
      ]);

      const result = await exportService.exportPrompt('test-prompt-123', {
        format: 'json',
        includeRatings: true
      });

      const content = JSON.parse(result.content);
      expect(content.ratings).toBeDefined();
      expect(content.ratings).toHaveLength(1);
    });

    it('should substitute variables when requested', async () => {
      const result = await exportService.exportPrompt('test-prompt-123', {
        format: 'json',
        substituteVariables: true,
        variableValues: { input: 'test value' }
      });

      const content = JSON.parse(result.content);
      expect(content.renderedContent).toBeDefined();
    });

    it('should use minimal template', async () => {
      const result = await exportService.exportPrompt('test-prompt-123', {
        format: 'json',
        template: 'minimal'
      });

      const content = JSON.parse(result.content);
      expect(content.title).toBe('Test Prompt');
      expect(content.goal).toBe('Test the export functionality');
      expect(content.metadata).toBeUndefined();
    });

    it('should throw error for invalid format', async () => {
      await expect(
        exportService.exportPrompt('test-prompt-123', {
          format: 'invalid' as any
        })
      ).rejects.toThrow('Unsupported export format');
    });
  });

  describe('bulkExport', () => {
    beforeEach(() => {
      mockPromptLibraryService.getPrompt.mockImplementation((id: string) => {
        return Promise.resolve({
          ...mockPrompt,
          id,
          metadata: { ...mockPrompt.metadata, title: `Test Prompt ${id}` }
        });
      });
      mockPromptLibraryService.getPromptRatings.mockResolvedValue([]);
      mockPromptLibraryService.renderPrompt.mockResolvedValue({
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test' }],
        parameters: {},
        formatted_prompt: 'Test'
      });
    });

    it('should create bulk export archive', async () => {
      const result = await exportService.bulkExport({
        promptIds: ['prompt-1', 'prompt-2'],
        format: 'json',
        archiveFormat: 'zip'
      });

      expect(result.filename).toMatch(/prompts_export_.*\.zip/);
      expect(result.mimeType).toBe('application/zip');
      expect(result.totalPrompts).toBe(2);
      expect(result.stream).toBeDefined();
    });

    it('should use custom filename', async () => {
      const result = await exportService.bulkExport({
        promptIds: ['prompt-1'],
        format: 'json',
        filename: 'custom_export.zip'
      });

      expect(result.filename).toBe('custom_export.zip');
    });

    it('should handle tar format', async () => {
      const result = await exportService.bulkExport({
        promptIds: ['prompt-1'],
        format: 'json',
        archiveFormat: 'tar'
      });

      expect(result.mimeType).toBe('application/x-tar');
      expect(result.filename).toMatch(/\.tar$/);
    });

    it('should throw error for empty prompt list', async () => {
      await expect(
        exportService.bulkExport({
          promptIds: [],
          format: 'json'
        })
      ).rejects.toThrow('No valid prompts found for export');
    });
  });

  describe('getStatus', () => {
    it('should return service status', async () => {
      const status = await exportService.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.healthy).toBe(true);
      expect(status.tempDir).toBe(testTempDir);
      expect(status.supportedFormats).toBe(5);
    });
  });

  describe('cleanup', () => {
    it('should clean up old temporary files', async () => {
      // Create a test file with old timestamp
      const oldFile = path.join(testTempDir, 'old-file.txt');
      await fs.writeFile(oldFile, 'test content');
      
      // Modify the file's timestamp to be old
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      await fs.utimes(oldFile, oldTime, oldTime);

      await exportService.cleanup();

      // File should be removed
      await expect(fs.access(oldFile)).rejects.toThrow();
    });

    it('should keep recent files', async () => {
      // Create a recent test file
      const recentFile = path.join(testTempDir, 'recent-file.txt');
      await fs.writeFile(recentFile, 'test content');

      await exportService.cleanup();

      // File should still exist
      await expect(fs.access(recentFile)).resolves.not.toThrow();
    });
  });

  describe('variable substitution', () => {
    it('should replace {{variable}} patterns', () => {
      const service = exportService as any;
      const result = service.replaceVariables('Hello {{name}}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should replace ${variable} patterns', () => {
      const service = exportService as any;
      const result = service.replaceVariables('Hello ${name}!', { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should handle multiple variables', () => {
      const service = exportService as any;
      const result = service.replaceVariables(
        '{{greeting}} {{name}}, your score is ${score}',
        { greeting: 'Hello', name: 'Alice', score: 95 }
      );
      expect(result).toBe('Hello Alice, your score is 95');
    });

    it('should handle missing variables gracefully', () => {
      const service = exportService as any;
      const result = service.replaceVariables('Hello {{missing}}!', {});
      expect(result).toBe('Hello {{missing}}!');
    });
  });

  describe('filename sanitization', () => {
    it('should sanitize special characters', () => {
      const service = exportService as any;
      const result = service.sanitizeFilename('Test/Prompt:With*Special?Chars');
      expect(result).toBe('testpromptwithspecialchars');
    });

    it('should replace spaces with underscores', () => {
      const service = exportService as any;
      const result = service.sanitizeFilename('Test Prompt Name');
      expect(result).toBe('test_prompt_name');
    });

    it('should limit filename length', () => {
      const service = exportService as any;
      const longName = 'a'.repeat(150);
      const result = service.sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(100);
    });
  });
});