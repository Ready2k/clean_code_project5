// Version Manager Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptVersionManager, VersionDiff, VersionCreateOptions } from '../version-manager';
import { PromptRecordClass } from '../../models/prompt';
import { PromptStatus } from '../../types/common';

describe('PromptVersionManager', () => {
  let versionManager: PromptVersionManager;
  let samplePrompt: PromptRecordClass;

  beforeEach(() => {
    versionManager = new PromptVersionManager();
    
    samplePrompt = new PromptRecordClass({
      version: 1,
      id: 'test-id',
      slug: 'test-prompt',
      status: 'draft' as PromptStatus,
      metadata: {
        title: 'Test Prompt',
        summary: 'A test prompt',
        tags: ['test'],
        owner: 'testuser'
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
          key: 'var1',
          label: 'Variable 1',
          type: 'string',
          required: true
        }
      ],
      history: {
        versions: [],
        ratings: []
      },
      renders: []
    });
  });

  describe('createVersion', () => {
    it('should create a valid version', () => {
      const options: VersionCreateOptions = {
        author: 'testuser',
        message: 'Initial version'
      };

      const version = versionManager.createVersion(samplePrompt, options);

      expect(version.number).toBe(1);
      expect(version.author).toBe('testuser');
      expect(version.message).toBe('Initial version');
      expect(version.created_at).toBeDefined();
      expect(new Date(version.created_at)).toBeInstanceOf(Date);
    });

    it('should throw error for missing author', () => {
      const options: VersionCreateOptions = {
        author: '',
        message: 'Test message'
      };

      expect(() => versionManager.createVersion(samplePrompt, options))
        .toThrow('Author is required for version creation');
    });

    it('should throw error for missing message', () => {
      const options: VersionCreateOptions = {
        author: 'testuser',
        message: ''
      };

      expect(() => versionManager.createVersion(samplePrompt, options))
        .toThrow('Change message is required for version creation');
    });

    it('should trim whitespace from author and message', () => {
      const options: VersionCreateOptions = {
        author: '  testuser  ',
        message: '  Test message  '
      };

      const version = versionManager.createVersion(samplePrompt, options);

      expect(version.author).toBe('testuser');
      expect(version.message).toBe('Test message');
    });
  });

  describe('compareVersions', () => {
    it('should detect no changes when prompts are identical', () => {
      const oldPrompt = samplePrompt.clone();
      const newPrompt = samplePrompt.clone();

      const comparison = versionManager.compareVersions(oldPrompt, newPrompt);

      expect(comparison.changes).toHaveLength(0);
      expect(comparison.summary).toBe('No changes detected');
      expect(comparison.fromVersion).toBe(1);
      expect(comparison.toVersion).toBe(1);
    });

    it('should detect metadata changes', () => {
      const oldPrompt = samplePrompt.clone();
      const newPrompt = samplePrompt.clone();
      newPrompt.metadata.title = 'Updated Title';
      newPrompt.metadata.tags = ['test', 'updated'];
      newPrompt.version = 2;

      const comparison = versionManager.compareVersions(oldPrompt, newPrompt);

      expect(comparison.changes).toHaveLength(2);
      expect(comparison.changes[0].field).toBe('metadata.title');
      expect(comparison.changes[0].changeType).toBe('modified');
      expect(comparison.changes[0].oldValue).toBe('Test Prompt');
      expect(comparison.changes[0].newValue).toBe('Updated Title');
      
      expect(comparison.changes[1].field).toBe('metadata.tags');
      expect(comparison.changes[1].changeType).toBe('modified');
    });

    it('should detect human prompt changes', () => {
      const oldPrompt = samplePrompt.clone();
      const newPrompt = samplePrompt.clone();
      newPrompt.prompt_human.goal = 'Updated goal';
      newPrompt.prompt_human.steps = ['Step 1', 'Step 2', 'Step 3'];
      newPrompt.version = 2;

      const comparison = versionManager.compareVersions(oldPrompt, newPrompt);

      expect(comparison.changes).toHaveLength(2);
      expect(comparison.changes.some(c => c.field === 'prompt_human.goal')).toBe(true);
      expect(comparison.changes.some(c => c.field === 'prompt_human.steps')).toBe(true);
    });

    it('should detect structured prompt addition', () => {
      const oldPrompt = samplePrompt.clone();
      const newPrompt = samplePrompt.clone();
      newPrompt.prompt_structured = {
        schema_version: 1,
        system: ['System instruction'],
        capabilities: ['capability1'],
        user_template: 'Template',
        rules: [{ name: 'Rule 1', description: 'Description' }],
        variables: ['var1']
      };
      newPrompt.version = 2;

      const comparison = versionManager.compareVersions(oldPrompt, newPrompt);

      expect(comparison.changes).toHaveLength(1);
      expect(comparison.changes[0].field).toBe('prompt_structured');
      expect(comparison.changes[0].changeType).toBe('added');
      expect(comparison.changes[0].oldValue).toBeNull();
    });

    it('should detect structured prompt removal', () => {
      const oldPrompt = samplePrompt.clone();
      oldPrompt.prompt_structured = {
        schema_version: 1,
        system: ['System instruction'],
        capabilities: ['capability1'],
        user_template: 'Template',
        rules: [{ name: 'Rule 1', description: 'Description' }],
        variables: ['var1']
      };
      
      const newPrompt = samplePrompt.clone();
      newPrompt.version = 2;

      const comparison = versionManager.compareVersions(oldPrompt, newPrompt);

      expect(comparison.changes).toHaveLength(1);
      expect(comparison.changes[0].field).toBe('prompt_structured');
      expect(comparison.changes[0].changeType).toBe('removed');
      expect(comparison.changes[0].newValue).toBeNull();
    });

    it('should detect variable changes', () => {
      const oldPrompt = samplePrompt.clone();
      const newPrompt = samplePrompt.clone();
      
      // Add a variable
      newPrompt.variables.push({
        key: 'var2',
        label: 'Variable 2',
        type: 'number',
        required: false
      });
      
      // Modify existing variable
      newPrompt.variables[0].label = 'Updated Variable 1';
      newPrompt.version = 2;

      const comparison = versionManager.compareVersions(oldPrompt, newPrompt);

      expect(comparison.changes).toHaveLength(2);
      expect(comparison.changes.some(c => c.field === 'variables.var2' && c.changeType === 'added')).toBe(true);
      expect(comparison.changes.some(c => c.field === 'variables.var1' && c.changeType === 'modified')).toBe(true);
    });

    it('should detect status changes', () => {
      const oldPrompt = samplePrompt.clone();
      const newPrompt = samplePrompt.clone();
      newPrompt.status = 'active';
      newPrompt.version = 2;

      const comparison = versionManager.compareVersions(oldPrompt, newPrompt);

      expect(comparison.changes).toHaveLength(1);
      expect(comparison.changes[0].field).toBe('status');
      expect(comparison.changes[0].oldValue).toBe('draft');
      expect(comparison.changes[0].newValue).toBe('active');
    });
  });

  describe('getVersionHistory', () => {
    it('should return empty array for prompt with no history', () => {
      const history = versionManager.getVersionHistory(samplePrompt);
      expect(history).toHaveLength(0);
    });

    it('should return sorted version history', () => {
      samplePrompt.history.versions = [
        {
          number: 1,
          message: 'First version',
          created_at: '2023-01-01T00:00:00Z',
          author: 'user1'
        },
        {
          number: 3,
          message: 'Third version',
          created_at: '2023-01-03T00:00:00Z',
          author: 'user3'
        },
        {
          number: 2,
          message: 'Second version',
          created_at: '2023-01-02T00:00:00Z',
          author: 'user2'
        }
      ];

      const history = versionManager.getVersionHistory(samplePrompt);

      expect(history).toHaveLength(3);
      expect(history[0].number).toBe(3);
      expect(history[1].number).toBe(2);
      expect(history[2].number).toBe(1);
    });
  });

  describe('getVersionDetails', () => {
    beforeEach(() => {
      samplePrompt.history.versions = [
        {
          number: 1,
          message: 'First version',
          created_at: '2023-01-01T00:00:00Z',
          author: 'user1'
        },
        {
          number: 2,
          message: 'Second version',
          created_at: '2023-01-02T00:00:00Z',
          author: 'user2'
        }
      ];
    });

    it('should return version details for existing version', () => {
      const version = versionManager.getVersionDetails(samplePrompt, 2);

      expect(version).toBeDefined();
      expect(version!.number).toBe(2);
      expect(version!.message).toBe('Second version');
      expect(version!.author).toBe('user2');
    });

    it('should return null for non-existing version', () => {
      const version = versionManager.getVersionDetails(samplePrompt, 99);
      expect(version).toBeNull();
    });
  });

  describe('validateVersion', () => {
    it('should validate correct version', () => {
      const version = {
        number: 1,
        message: 'Test message',
        created_at: '2023-01-01T00:00:00Z',
        author: 'testuser'
      };

      const result = versionManager.validateVersion(version);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid version number', () => {
      const version = {
        number: 0,
        message: 'Test message',
        created_at: '2023-01-01T00:00:00Z',
        author: 'testuser'
      };

      const result = versionManager.validateVersion(version);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Version number must be a positive integer');
    });

    it('should reject empty message', () => {
      const version = {
        number: 1,
        message: '',
        created_at: '2023-01-01T00:00:00Z',
        author: 'testuser'
      };

      const result = versionManager.validateVersion(version);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Version message is required');
    });

    it('should reject empty author', () => {
      const version = {
        number: 1,
        message: 'Test message',
        created_at: '2023-01-01T00:00:00Z',
        author: ''
      };

      const result = versionManager.validateVersion(version);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Version author is required');
    });

    it('should reject invalid timestamp', () => {
      const version = {
        number: 1,
        message: 'Test message',
        created_at: 'invalid-date',
        author: 'testuser'
      };

      const result = versionManager.validateVersion(version);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Version creation timestamp must be a valid ISO 8601 date');
    });
  });

  describe('generateChangeSummary', () => {
    it('should return "No changes detected" for empty changes', () => {
      const summary = versionManager.generateChangeSummary([]);
      expect(summary).toBe('No changes detected');
    });

    it('should generate summary for modified fields', () => {
      const changes: VersionDiff[] = [
        {
          field: 'metadata.title',
          oldValue: 'Old Title',
          newValue: 'New Title',
          changeType: 'modified'
        },
        {
          field: 'prompt_human.goal',
          oldValue: 'Old Goal',
          newValue: 'New Goal',
          changeType: 'modified'
        }
      ];

      const summary = versionManager.generateChangeSummary(changes);
      expect(summary).toBe('Modified: metadata.title, prompt_human.goal');
    });

    it('should generate summary for added fields', () => {
      const changes: VersionDiff[] = [
        {
          field: 'variables.newVar',
          oldValue: null,
          newValue: { key: 'newVar', type: 'string' },
          changeType: 'added'
        }
      ];

      const summary = versionManager.generateChangeSummary(changes);
      expect(summary).toBe('Added: variables.newVar');
    });

    it('should generate summary for removed fields', () => {
      const changes: VersionDiff[] = [
        {
          field: 'variables.oldVar',
          oldValue: { key: 'oldVar', type: 'string' },
          newValue: null,
          changeType: 'removed'
        }
      ];

      const summary = versionManager.generateChangeSummary(changes);
      expect(summary).toBe('Removed: variables.oldVar');
    });

    it('should generate comprehensive summary for mixed changes', () => {
      const changes: VersionDiff[] = [
        {
          field: 'metadata.title',
          oldValue: 'Old Title',
          newValue: 'New Title',
          changeType: 'modified'
        },
        {
          field: 'variables.newVar',
          oldValue: null,
          newValue: { key: 'newVar', type: 'string' },
          changeType: 'added'
        },
        {
          field: 'variables.oldVar',
          oldValue: { key: 'oldVar', type: 'string' },
          newValue: null,
          changeType: 'removed'
        }
      ];

      const summary = versionManager.generateChangeSummary(changes);
      expect(summary).toBe('Modified: metadata.title; Added: variables.newVar; Removed: variables.oldVar');
    });
  });
});