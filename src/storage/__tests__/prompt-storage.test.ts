// Tests for FileSystemPromptStorage

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemPromptStorage } from '../prompt-storage';
import { PromptRecordClass } from '../../models/prompt';
import { ProviderPayload } from '../../types/common';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('FileSystemPromptStorage', () => {
  const testDir = './test-data';
  let storage: FileSystemPromptStorage;

  beforeEach(async () => {
    storage = new FileSystemPromptStorage(testDir);
    await storage.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  describe('initialization', () => {
    it('should create directory structure', async () => {
      const info = await storage.getStorageInfo();
      
      expect(info.promptsDir).toBe(path.join(testDir, 'prompts'));
      expect(info.rendersDir).toBe(path.join(testDir, 'renders'));
      expect(info.specsDir).toBe(path.join(testDir, 'specs'));
      expect(info.totalPrompts).toBe(0);
      expect(info.totalRenders).toBe(0);
    });
  });

  describe('prompt operations', () => {
    it('should save and load a prompt', async () => {
      const prompt = new PromptRecordClass({
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
        variables: [
          {
            key: 'test_var',
            label: 'Test Variable',
            type: 'string',
            required: true
          }
        ]
      });

      await storage.savePrompt(prompt);
      const loaded = await storage.loadPrompt(prompt.id);

      expect(loaded.id).toBe(prompt.id);
      expect(loaded.metadata.title).toBe('Test Prompt');
      expect(loaded.prompt_human.goal).toBe('Test goal');
      expect(loaded.variables).toHaveLength(1);
      expect(loaded.variables[0].key).toBe('test_var');
    });

    it('should load prompt by slug', async () => {
      const prompt = new PromptRecordClass({
        metadata: {
          title: 'Test Prompt',
          summary: 'A test prompt',
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
        }
      });

      await storage.savePrompt(prompt);
      const loaded = await storage.loadPromptBySlug(prompt.slug);

      expect(loaded.id).toBe(prompt.id);
      expect(loaded.slug).toBe(prompt.slug);
    });

    it('should list all prompts', async () => {
      const prompt1 = new PromptRecordClass({
        metadata: {
          title: 'First Prompt',
          summary: 'First test prompt',
          tags: ['test'],
          owner: 'test-user'
        },
        prompt_human: {
          goal: 'First goal',
          audience: 'Test audience',
          steps: ['Step 1'],
          output_expectations: {
            format: 'JSON',
            fields: ['field1']
          }
        }
      });

      const prompt2 = new PromptRecordClass({
        metadata: {
          title: 'Second Prompt',
          summary: 'Second test prompt',
          tags: ['test'],
          owner: 'test-user'
        },
        prompt_human: {
          goal: 'Second goal',
          audience: 'Test audience',
          steps: ['Step 1'],
          output_expectations: {
            format: 'JSON',
            fields: ['field1']
          }
        }
      });

      await storage.savePrompt(prompt1);
      await storage.savePrompt(prompt2);

      const prompts = await storage.listPrompts();
      expect(prompts).toHaveLength(2);
      
      const titles = prompts.map(p => p.metadata.title).sort();
      expect(titles).toEqual(['First Prompt', 'Second Prompt']);
    });

    it('should check if prompt exists', async () => {
      const prompt = new PromptRecordClass({
        metadata: {
          title: 'Test Prompt',
          summary: 'A test prompt',
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
        }
      });

      expect(await storage.promptExists(prompt.id)).toBe(false);
      
      await storage.savePrompt(prompt);
      expect(await storage.promptExists(prompt.id)).toBe(true);
    });

    it('should delete a prompt', async () => {
      const prompt = new PromptRecordClass({
        metadata: {
          title: 'Test Prompt',
          summary: 'A test prompt',
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
        }
      });

      await storage.savePrompt(prompt);
      expect(await storage.promptExists(prompt.id)).toBe(true);

      await storage.deletePrompt(prompt.id);
      expect(await storage.promptExists(prompt.id)).toBe(false);
    });
  });

  describe('slug generation', () => {
    it('should generate unique slugs', async () => {
      const slug1 = await storage.generateSlug('Test Title');
      const slug2 = await storage.generateSlug('Test Title');

      expect(slug1).toBe('test-title');
      
      // Create a prompt with the first slug
      const prompt = new PromptRecordClass({
        slug: slug1,
        metadata: {
          title: 'Test Title',
          summary: 'A test prompt',
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
        }
      });
      await storage.savePrompt(prompt);

      // Second slug should be different
      const slug3 = await storage.generateSlug('Test Title');
      expect(slug3).toBe('test-title-1');
    });

    it('should handle special characters in titles', async () => {
      const slug = await storage.generateSlug('Test Title! @#$%^&*()');
      expect(slug).toBe('test-title');
    });
  });

  describe('render operations', () => {
    it('should save and load renders', async () => {
      const payload: ProviderPayload = {
        provider: 'openai',
        model: 'gpt-4',
        content: {
          messages: [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'Hello world' }
          ]
        },
        metadata: {
          temperature: 0.7
        }
      };

      const contentRef = await storage.saveRender('test-prompt-id', 'openai', payload);
      expect(contentRef).toMatch(/^test-prompt-id_openai_\d+_[a-f0-9]{8}$/);

      const loaded = await storage.loadRender(contentRef);
      expect(loaded).toEqual(payload);
    });
  });

  describe('error handling', () => {
    it('should throw error for non-existent prompt', async () => {
      await expect(storage.loadPrompt('non-existent-id')).rejects.toThrow('not found');
    });

    it('should throw error for non-existent slug', async () => {
      await expect(storage.loadPromptBySlug('non-existent-slug')).rejects.toThrow('not found');
    });

    it('should throw error for non-existent render', async () => {
      await expect(storage.loadRender('non-existent-ref')).rejects.toThrow('Failed to load render');
    });
  });
});