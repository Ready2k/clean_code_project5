// Tests for FileSystemMetadataIndexer

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemMetadataIndexer } from '../metadata-index';
import { PromptRecordClass } from '../../models/prompt';
import { PromptFilters } from '../../types/common';
import * as fs from 'fs/promises';

describe('FileSystemMetadataIndexer', () => {
  const testDir = './test-index';
  let indexer: FileSystemMetadataIndexer;

  beforeEach(async () => {
    indexer = new FileSystemMetadataIndexer(testDir);
  });

  afterEach(async () => {
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

  describe('basic indexing operations', () => {
    it('should build index from prompts', async () => {
      const prompt1 = createTestPrompt({
        metadata: { title: 'First Prompt', summary: 'First test', tags: ['test', 'first'], owner: 'user1' }
      });
      const prompt2 = createTestPrompt({
        metadata: { title: 'Second Prompt', summary: 'Second test', tags: ['test', 'second'], owner: 'user2' }
      });

      await indexer.buildIndex([prompt1, prompt2]);

      const index1 = await indexer.getPromptById(prompt1.id);
      const index2 = await indexer.getPromptById(prompt2.id);

      expect(index1).toBeTruthy();
      expect(index1!.title).toBe('First Prompt');
      expect(index1!.tags).toEqual(['test', 'first']);

      expect(index2).toBeTruthy();
      expect(index2!.title).toBe('Second Prompt');
      expect(index2!.tags).toEqual(['test', 'second']);
    });

    it('should add prompt to index', async () => {
      const prompt = createTestPrompt();

      await indexer.addToIndex(prompt);

      const indexed = await indexer.getPromptById(prompt.id);
      expect(indexed).toBeTruthy();
      expect(indexed!.title).toBe('Test Prompt');
    });

    it('should update prompt in index', async () => {
      const prompt = createTestPrompt();
      await indexer.addToIndex(prompt);

      prompt.metadata.title = 'Updated Title';
      await indexer.updateIndex(prompt);

      const indexed = await indexer.getPromptById(prompt.id);
      expect(indexed!.title).toBe('Updated Title');
    });

    it('should remove prompt from index', async () => {
      const prompt = createTestPrompt();
      await indexer.addToIndex(prompt);

      expect(await indexer.getPromptById(prompt.id)).toBeTruthy();

      await indexer.removeFromIndex(prompt.id);

      expect(await indexer.getPromptById(prompt.id)).toBeNull();
    });
  });

  describe('search functionality', () => {
    beforeEach(async () => {
      const prompts = [
        createTestPrompt({
          metadata: { title: 'Active Prompt', summary: 'Active test', tags: ['active', 'test'], owner: 'user1' },
          status: 'active'
        }),
        createTestPrompt({
          metadata: { title: 'Draft Prompt', summary: 'Draft test', tags: ['draft', 'test'], owner: 'user2' },
          status: 'draft'
        }),
        createTestPrompt({
          metadata: { title: 'High Rated', summary: 'High rated prompt', tags: ['quality'], owner: 'user1' },
          history: {
            versions: [],
            ratings: [
              { user: 'user1', score: 5, note: 'Great!', created_at: new Date().toISOString() },
              { user: 'user2', score: 4, note: 'Good', created_at: new Date().toISOString() }
            ]
          }
        })
      ];

      await indexer.buildIndex(prompts);
    });

    it('should search by status', async () => {
      const filters: PromptFilters = { status: 'active' };
      const results = await indexer.searchPrompts(filters);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Active Prompt');
    });

    it('should search by tags', async () => {
      const filters: PromptFilters = { tags: ['draft'] };
      const results = await indexer.searchPrompts(filters);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Draft Prompt');
    });

    it('should search by owner', async () => {
      const filters: PromptFilters = { owner: 'user1' };
      const results = await indexer.searchPrompts(filters);

      expect(results).toHaveLength(2);
      expect(results.map(r => r.title).sort()).toEqual(['Active Prompt', 'High Rated']);
    });

    it('should search by minimum rating', async () => {
      const filters: PromptFilters = { minRating: 4 };
      const results = await indexer.searchPrompts(filters);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('High Rated');
    });

    it('should search by text', async () => {
      const filters: PromptFilters = { searchTerm: 'rated' };
      const results = await indexer.searchPrompts(filters);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('High Rated');
    });

    it('should combine multiple filters', async () => {
      const filters: PromptFilters = { 
        owner: 'user1',
        tags: ['active']
      };
      const results = await indexer.searchPrompts(filters);

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Active Prompt');
    });
  });

  describe('lookup operations', () => {
    it('should find prompt by slug', async () => {
      const prompt = createTestPrompt();
      await indexer.addToIndex(prompt);

      const indexed = await indexer.getPromptBySlug(prompt.slug);
      expect(indexed).toBeTruthy();
      expect(indexed!.id).toBe(prompt.id);
    });

    it('should return null for non-existent prompt', async () => {
      expect(await indexer.getPromptById('non-existent')).toBeNull();
      expect(await indexer.getPromptBySlug('non-existent')).toBeNull();
    });
  });

  describe('aggregation operations', () => {
    beforeEach(async () => {
      const prompts = [
        createTestPrompt({
          metadata: { title: 'Prompt 1', tags: ['tag1', 'common'], owner: 'user1' },
          status: 'active'
        }),
        createTestPrompt({
          metadata: { title: 'Prompt 2', tags: ['tag2', 'common'], owner: 'user2' },
          status: 'draft'
        }),
        createTestPrompt({
          metadata: { title: 'Prompt 3', tags: ['tag3'], owner: 'user1' },
          status: 'active'
        })
      ];

      await indexer.buildIndex(prompts);
    });

    it('should get all tags', async () => {
      const tags = await indexer.getAllTags();
      expect(tags.sort()).toEqual(['common', 'tag1', 'tag2', 'tag3']);
    });

    it('should get all owners', async () => {
      const owners = await indexer.getAllOwners();
      expect(owners.sort()).toEqual(['user1', 'user2']);
    });

    it('should get index statistics', async () => {
      const stats = await indexer.getIndexStats();

      expect(stats.totalPrompts).toBe(3);
      expect(stats.totalTags).toBe(4);
      expect(stats.totalOwners).toBe(2);
      expect(stats.statusCounts).toEqual({
        active: 2,
        draft: 1
      });
    });
  });

  describe('persistence', () => {
    it('should persist index to file and reload', async () => {
      const prompt = createTestPrompt();
      await indexer.addToIndex(prompt);

      // Create new indexer instance (simulates restart)
      const newIndexer = new FileSystemMetadataIndexer(testDir);
      
      const indexed = await newIndexer.getPromptById(prompt.id);
      expect(indexed).toBeTruthy();
      expect(indexed!.title).toBe('Test Prompt');
    });

    it('should handle corrupted index file gracefully', async () => {
      // Create corrupted index file
      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(`${testDir}/metadata.index.json`, 'invalid json', 'utf8');

      const prompt = createTestPrompt();
      await indexer.addToIndex(prompt);

      const indexed = await indexer.getPromptById(prompt.id);
      expect(indexed).toBeTruthy();
    });
  });
});