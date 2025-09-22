// Version Control and History Integration Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptVersionManager } from '../version-manager';
import { PromptHistoryService } from '../history-service';
import { PromptRecordClass } from '../../models/prompt';
import { PromptStatus } from '../../types/common';

describe('Version Control and History Integration', () => {
  let versionManager: PromptVersionManager;
  let historyService: PromptHistoryService;
  let prompt: PromptRecordClass;

  beforeEach(() => {
    versionManager = new PromptVersionManager();
    historyService = new PromptHistoryService(versionManager);
    
    prompt = new PromptRecordClass({
      version: 1,
      id: 'integration-test-prompt',
      slug: 'integration-test',
      status: 'draft' as PromptStatus,
      metadata: {
        title: 'Integration Test Prompt',
        summary: 'Testing version control and history',
        tags: ['test', 'integration'],
        owner: 'testuser'
      },
      prompt_human: {
        goal: 'Test the integration between version control and history',
        audience: 'Developers',
        steps: ['Create prompt', 'Update prompt', 'Track changes'],
        output_expectations: {
          format: 'JSON',
          fields: ['result', 'status']
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
      history: {
        versions: [],
        ratings: []
      },
      renders: []
    });
  });

  it('should track complete lifecycle of prompt changes', () => {
    // Initial state
    expect(prompt.version).toBe(1);
    expect(prompt.history.versions).toHaveLength(0);

    // Add audit entry for creation
    historyService.addAuditEntry({
      promptId: prompt.id,
      action: 'created',
      version: 1,
      author: 'testuser',
      details: { initial: true }
    });

    // First update - change title and goal
    const oldPrompt = prompt.clone();
    prompt.metadata.title = 'Updated Integration Test Prompt';
    prompt.prompt_human.goal = 'Updated goal for testing';
    prompt.update({
      metadata: prompt.metadata,
      prompt_human: prompt.prompt_human
    }, 'testuser', 'Updated title and goal');

    // Add audit entry for update
    historyService.addAuditEntry({
      promptId: prompt.id,
      action: 'updated',
      version: 2,
      author: 'testuser',
      details: { fields: ['title', 'goal'] }
    });

    // Verify version tracking
    expect(prompt.version).toBe(2);
    expect(prompt.history.versions).toHaveLength(1);
    expect(prompt.history.versions[0].number).toBe(1);
    expect(prompt.history.versions[0].message).toBe('Updated title and goal');

    // Compare versions
    const comparison = versionManager.compareVersions(oldPrompt, prompt);
    expect(comparison.changes).toHaveLength(2);
    expect(comparison.changes.some(c => c.field === 'metadata.title')).toBe(true);
    expect(comparison.changes.some(c => c.field === 'prompt_human.goal')).toBe(true);
    expect(comparison.summary).toContain('Modified: metadata.title, prompt_human.goal');

    // Second update - add structured prompt
    const oldPrompt2 = prompt.clone();
    prompt.prompt_structured = {
      schema_version: 1,
      system: ['You are a helpful assistant'],
      capabilities: ['analysis', 'generation'],
      user_template: 'Please help with {{test_var}}',
      rules: [
        { name: 'Be helpful', description: 'Always provide helpful responses' }
      ],
      variables: ['test_var']
    };
    prompt.update({
      prompt_structured: prompt.prompt_structured
    }, 'developer', 'Added structured prompt');

    // Add audit entry for enhancement
    historyService.addAuditEntry({
      promptId: prompt.id,
      action: 'enhanced',
      version: 3,
      author: 'developer',
      details: { type: 'structured_prompt_added' }
    });

    // Verify second update
    expect(prompt.version).toBe(3);
    expect(prompt.history.versions).toHaveLength(2);

    const comparison2 = versionManager.compareVersions(oldPrompt2, prompt);
    expect(comparison2.changes).toHaveLength(1);
    expect(comparison2.changes[0].field).toBe('prompt_structured');
    expect(comparison2.changes[0].changeType).toBe('added');

    // Add some ratings
    historyService.associateRatingWithVersion(prompt, {
      user: 'reviewer1',
      score: 4,
      note: 'Good improvement',
      version: 3
    });

    historyService.associateRatingWithVersion(prompt, {
      user: 'reviewer2',
      score: 5,
      note: 'Excellent structured prompt',
      version: 3
    });

    // Test history display
    const history = historyService.getHistoryDisplay(prompt, {
      includeChanges: true,
      includeRatings: true
    });

    expect(history).toHaveLength(2);
    expect(history[0].version).toBe(2); // Most recent version in history
    expect(history[0].message).toBe('Added structured prompt');
    expect(history[0].author).toBe('developer');
    expect(history[0].ratings).toHaveLength(2); // All ratings

    expect(history[1].version).toBe(1);
    expect(history[1].message).toBe('Updated title and goal');
    expect(history[1].author).toBe('testuser');

    // Test audit trail
    const auditTrail = historyService.getAuditTrail(prompt.id);
    expect(auditTrail).toHaveLength(5); // created, updated, enhanced, rated (2 ratings = 2 audit entries)
    
    // Check that all expected actions are present
    const actions = auditTrail.map(entry => entry.action);
    expect(actions).toContain('created');
    expect(actions).toContain('updated');
    expect(actions).toContain('enhanced');
    expect(actions.filter(a => a === 'rated')).toHaveLength(2); // Two rating entries
    
    // Verify all entries have required fields
    auditTrail.forEach(entry => {
      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
      expect(entry.promptId).toBe(prompt.id);
      expect(entry.author).toBeDefined();
    });

    // Test version statistics
    const stats = historyService.getVersionStatistics(prompt);
    expect(stats.totalVersions).toBe(3);
    expect(stats.totalRatings).toBe(2);
    expect(stats.averageRating).toBe(4.5);
    expect(['testuser', 'developer']).toContain(stats.mostActiveAuthor); // Both have 1 version each
    expect(stats.versionFrequency).toHaveLength(2);
  });

  it('should handle complex variable changes across versions', () => {
    // Add initial variables
    prompt.variables = [
      {
        key: 'var1',
        label: 'Variable 1',
        type: 'string',
        required: true
      },
      {
        key: 'var2',
        label: 'Variable 2',
        type: 'number',
        required: false
      }
    ];

    const oldPrompt = prompt.clone();

    // Update variables - modify one, add one, remove one
    prompt.variables = [
      {
        key: 'var1',
        label: 'Updated Variable 1', // Modified
        type: 'string',
        required: true
      },
      {
        key: 'var3', // Added
        label: 'Variable 3',
        type: 'select',
        required: true,
        options: ['a', 'b', 'c']
      }
      // var2 removed
    ];

    prompt.update({
      variables: prompt.variables
    }, 'developer', 'Updated variables');

    const comparison = versionManager.compareVersions(oldPrompt, prompt);
    const variableChanges = comparison.changes.filter(c => c.field.startsWith('variables.'));
    
    expect(variableChanges).toHaveLength(3);
    expect(variableChanges.some(c => c.field === 'variables.var1' && c.changeType === 'modified')).toBe(true);
    expect(variableChanges.some(c => c.field === 'variables.var2' && c.changeType === 'removed')).toBe(true);
    expect(variableChanges.some(c => c.field === 'variables.var3' && c.changeType === 'added')).toBe(true);

    expect(comparison.summary).toContain('Modified: variables.var1');
    expect(comparison.summary).toContain('Added: variables.var3');
    expect(comparison.summary).toContain('Removed: variables.var2');
  });

  it('should maintain audit trail integrity across multiple operations', async () => {
    const operations = [
      { action: 'created' as const, author: 'creator', details: { initial: true } },
      { action: 'updated' as const, author: 'editor1', details: { field: 'title' } },
      { action: 'enhanced' as const, author: 'ai-agent', details: { type: 'structured' } },
      { action: 'rated' as const, author: 'reviewer1', details: { score: 4 } },
      { action: 'rendered' as const, author: 'user1', details: { provider: 'openai' } },
      { action: 'updated' as const, author: 'editor2', details: { field: 'variables' } },
      { action: 'rated' as const, author: 'reviewer2', details: { score: 5 } }
    ];

    // Add all operations with small delays to ensure proper ordering
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      historyService.addAuditEntry({
        promptId: prompt.id,
        action: op.action,
        version: Math.floor(i / 2) + 1, // Increment version every 2 operations
        author: op.author,
        details: op.details
      });
      
      // Small delay to ensure different timestamps
      if (i < operations.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    const auditTrail = historyService.getAuditTrail(prompt.id);
    expect(auditTrail).toHaveLength(7);

    // Verify chronological order (most recent first)
    expect(auditTrail[0].author).toBe('reviewer2');
    expect(auditTrail[6].author).toBe('creator');

    // Verify all operations are tracked
    const actionCounts = auditTrail.reduce((acc, entry) => {
      acc[entry.action] = (acc[entry.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    expect(actionCounts.created).toBe(1);
    expect(actionCounts.updated).toBe(2);
    expect(actionCounts.enhanced).toBe(1);
    expect(actionCounts.rated).toBe(2);
    expect(actionCounts.rendered).toBe(1);

    // Verify each entry has required fields
    auditTrail.forEach(entry => {
      expect(entry.id).toBeDefined();
      expect(entry.timestamp).toBeDefined();
      expect(entry.promptId).toBe(prompt.id);
      expect(entry.author).toBeDefined();
      expect(entry.details).toBeDefined();
    });
  });

  it('should provide comprehensive version details', () => {
    // Create a version history
    prompt.history.versions = [
      {
        number: 1,
        message: 'Initial version',
        created_at: '2023-01-01T00:00:00Z',
        author: 'creator'
      },
      {
        number: 2,
        message: 'Added variables',
        created_at: '2023-01-02T00:00:00Z',
        author: 'developer'
      },
      {
        number: 3,
        message: 'Enhanced with AI',
        created_at: '2023-01-03T00:00:00Z',
        author: 'ai-agent'
      }
    ];

    // Test version details retrieval
    const version2 = versionManager.getVersionDetails(prompt, 2);
    expect(version2).toBeDefined();
    expect(version2!.message).toBe('Added variables');
    expect(version2!.author).toBe('developer');

    const nonExistentVersion = versionManager.getVersionDetails(prompt, 99);
    expect(nonExistentVersion).toBeNull();

    // Test version history sorting
    const history = versionManager.getVersionHistory(prompt);
    expect(history).toHaveLength(3);
    expect(history[0].number).toBe(3); // Most recent first
    expect(history[1].number).toBe(2);
    expect(history[2].number).toBe(1);

    // Test history display with filtering
    const recentHistory = historyService.getHistoryDisplay(prompt, {
      maxEntries: 2,
      fromVersion: 2
    });
    expect(recentHistory).toHaveLength(2);
    expect(recentHistory[0].version).toBe(3);
    expect(recentHistory[1].version).toBe(2);
  });
});