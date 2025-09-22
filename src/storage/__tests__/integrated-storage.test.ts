// Simple tests for FileSystemIntegratedStorage without file watching

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemIntegratedStorage } from '../integrated-storage';
import { PromptRecordClass } from '../../models/prompt';
import * as fs from 'fs/promises';

describe('FileSystemIntegratedStorage', () => {
  const testDir = './test-integrated-simple';
  let storage: FileSystemIntegratedStorage;

  beforeEach(async () => {
    storage = new FileSystemIntegratedStorage(testDir, false); // Disable file watching
  });

  afterEach(async () => {
    try {
      await storage.shutdown();
    } catch {
      // Ignore shutdown errors
    }
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  const createTestPrompt = (overrides: any = {}) => {
    return new PromptRecordClass({
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
      },
      variables: [
        {
          key: 'test_var',
          label: 'Test Variable',
          type: 'string',
          required: true
        }
      ],
      ...overrides
    });
  };

  it('should initialize and save a prompt', async () => {
    await storage.initialize();
    
    const prompt = createTestPrompt();
    await storage.savePrompt(prompt);

    const loaded = await storage.loadPrompt(prompt.id);
    expect(loaded.id).toBe(prompt.id);
    expect(loaded.metadata.title).toBe('Test Prompt');
  });

  it('should search prompts', async () => {
    await storage.initialize();
    
    const prompt = createTestPrompt({
      metadata: { title: 'Searchable Prompt', summary: 'Test', tags: ['search'], owner: 'user1' }
    });
    
    await storage.savePrompt(prompt);

    const results = await storage.searchPrompts({ searchTerm: 'Searchable' });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Searchable Prompt');
  });

  it('should provide storage statistics', async () => {
    await storage.initialize();
    
    const prompt = createTestPrompt();
    await storage.savePrompt(prompt);

    const stats = await storage.getStorageStats();
    expect(stats.prompts.total).toBe(1);
    expect(stats.index.totalPrompts).toBe(1);
  });
});