// History Service Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptHistoryService, HistoryDisplayOptions, AuditTrailEntry } from '../history-service';
import { PromptVersionManager } from '../version-manager';
import { PromptRecordClass } from '../../models/prompt';
import { PromptStatus } from '../../types/common';

describe('PromptHistoryService', () => {
  let historyService: PromptHistoryService;
  let versionManager: PromptVersionManager;
  let samplePrompt: PromptRecordClass;

  beforeEach(() => {
    versionManager = new PromptVersionManager();
    historyService = new PromptHistoryService(versionManager);
    
    samplePrompt = new PromptRecordClass({
      version: 3,
      id: 'test-prompt-id',
      slug: 'test-prompt',
      status: 'active' as PromptStatus,
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
      variables: [],
      history: {
        versions: [
          {
            number: 1,
            message: 'Initial version',
            created_at: '2023-01-01T00:00:00Z',
            author: 'user1'
          },
          {
            number: 2,
            message: 'Updated goal',
            created_at: '2023-01-02T00:00:00Z',
            author: 'user2'
          }
        ],
        ratings: [
          {
            user: 'rater1',
            score: 4,
            note: 'Good prompt',
            created_at: '2023-01-03T00:00:00Z'
          },
          {
            user: 'rater2',
            score: 5,
            note: 'Excellent',
            created_at: '2023-01-04T00:00:00Z'
          }
        ]
      },
      renders: []
    });
  });

  describe('getHistoryDisplay', () => {
    it('should return formatted history entries', () => {
      const history = historyService.getHistoryDisplay(samplePrompt);

      expect(history).toHaveLength(2);
      expect(history[0].version).toBe(2);
      expect(history[0].message).toBe('Updated goal');
      expect(history[0].author).toBe('user2');
      expect(history[0].ratings).toHaveLength(2); // All ratings for current version
      
      expect(history[1].version).toBe(1);
      expect(history[1].message).toBe('Initial version');
      expect(history[1].author).toBe('user1');
    });

    it('should limit entries when maxEntries is specified', () => {
      const options: HistoryDisplayOptions = { maxEntries: 1 };
      const history = historyService.getHistoryDisplay(samplePrompt, options);

      expect(history).toHaveLength(1);
      expect(history[0].version).toBe(2); // Most recent version
    });

    it('should filter by version range', () => {
      const options: HistoryDisplayOptions = { fromVersion: 2, toVersion: 2 };
      const history = historyService.getHistoryDisplay(samplePrompt, options);

      expect(history).toHaveLength(1);
      expect(history[0].version).toBe(2);
    });

    it('should exclude ratings when includeRatings is false', () => {
      const options: HistoryDisplayOptions = { includeRatings: false };
      const history = historyService.getHistoryDisplay(samplePrompt, options);

      expect(history[0].ratings).toHaveLength(0);
    });

    it('should include changes placeholder when includeChanges is true', () => {
      const options: HistoryDisplayOptions = { includeChanges: true };
      const history = historyService.getHistoryDisplay(samplePrompt, options);

      expect(history[0].changes).toBeDefined();
      expect(history[0].changes!.fromVersion).toBe(1);
      expect(history[0].changes!.toVersion).toBe(2);
    });
  });

  describe('getAuditTrail', () => {
    it('should return empty array for prompt with no audit trail', () => {
      const trail = historyService.getAuditTrail('non-existent-id');
      expect(trail).toHaveLength(0);
    });

    it('should return audit trail entries in reverse chronological order', async () => {
      const promptId = 'test-prompt-id';
      
      // Add some audit entries
      historyService.addAuditEntry({
        promptId,
        action: 'created',
        version: 1,
        author: 'user1',
        details: { initial: true }
      });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      historyService.addAuditEntry({
        promptId,
        action: 'updated',
        version: 2,
        author: 'user2',
        details: { field: 'goal' }
      });

      const trail = historyService.getAuditTrail(promptId);
      expect(trail).toHaveLength(2);
      expect(trail[0].action).toBe('updated'); // Most recent first
      expect(trail[1].action).toBe('created');
    });
  });

  describe('addAuditEntry', () => {
    it('should add audit entry with generated ID and timestamp', () => {
      const promptId = 'test-prompt-id';
      const entryData = {
        promptId,
        action: 'created' as const,
        version: 1,
        author: 'testuser',
        details: { test: true }
      };

      historyService.addAuditEntry(entryData);
      const trail = historyService.getAuditTrail(promptId);

      expect(trail).toHaveLength(1);
      expect(trail[0].id).toBeDefined();
      expect(trail[0].timestamp).toBeDefined();
      expect(trail[0].action).toBe('created');
      expect(trail[0].author).toBe('testuser');
      expect(trail[0].details).toEqual({ test: true });
    });

    it('should handle multiple audit entries for same prompt', () => {
      const promptId = 'test-prompt-id';

      historyService.addAuditEntry({
        promptId,
        action: 'created',
        version: 1,
        author: 'user1',
        details: {}
      });

      historyService.addAuditEntry({
        promptId,
        action: 'updated',
        version: 2,
        author: 'user2',
        details: {}
      });

      const trail = historyService.getAuditTrail(promptId);
      expect(trail).toHaveLength(2);
    });
  });

  describe('getVersionRatings', () => {
    it('should return ratings for current version', () => {
      const ratings = historyService.getVersionRatings(samplePrompt, 3);
      expect(ratings).toHaveLength(2);
      expect(ratings[0].user).toBe('rater1');
      expect(ratings[1].user).toBe('rater2');
    });

    it('should return all ratings for any version (current implementation)', () => {
      const ratings = historyService.getVersionRatings(samplePrompt, 1);
      expect(ratings).toHaveLength(2); // Current implementation returns all ratings
    });
  });

  describe('associateRatingWithVersion', () => {
    it('should add rating and create audit entry', () => {
      const rating = {
        user: 'newrater',
        score: 3,
        note: 'Average',
        version: 3
      };

      historyService.associateRatingWithVersion(samplePrompt, rating);

      // Check rating was added
      const userRating = samplePrompt.history.ratings.find(r => r.user === 'newrater');
      expect(userRating).toBeDefined();
      expect(userRating!.score).toBe(3);
      expect(userRating!.note).toBe('Average');

      // Check audit entry was created
      const trail = historyService.getAuditTrail(samplePrompt.id);
      expect(trail).toHaveLength(1);
      expect(trail[0].action).toBe('rated');
      expect(trail[0].author).toBe('newrater');
      expect(trail[0].details.score).toBe(3);
    });

    it('should replace existing rating from same user', () => {
      const initialRatingCount = samplePrompt.history.ratings.length;

      const rating = {
        user: 'rater1', // Existing user
        score: 2,
        note: 'Updated rating',
        version: 3
      };

      historyService.associateRatingWithVersion(samplePrompt, rating);

      // Should still have same number of ratings (replaced, not added)
      expect(samplePrompt.history.ratings).toHaveLength(initialRatingCount);
      
      const userRating = samplePrompt.history.ratings.find(r => r.user === 'rater1');
      expect(userRating!.score).toBe(2);
      expect(userRating!.note).toBe('Updated rating');
    });
  });

  describe('getVersionStatistics', () => {
    it('should calculate correct statistics', () => {
      const stats = historyService.getVersionStatistics(samplePrompt);

      expect(stats.totalVersions).toBe(3); // 2 in history + 1 current
      expect(stats.totalRatings).toBe(2);
      expect(stats.averageRating).toBe(4.5); // (4 + 5) / 2
      expect(stats.mostActiveAuthor).toBeDefined();
      expect(stats.versionFrequency).toHaveLength(2);
    });

    it('should handle prompt with no ratings', () => {
      samplePrompt.history.ratings = [];
      const stats = historyService.getVersionStatistics(samplePrompt);

      expect(stats.totalRatings).toBe(0);
      expect(stats.averageRating).toBe(0);
    });

    it('should handle prompt with no version history', () => {
      samplePrompt.history.versions = [];
      const stats = historyService.getVersionStatistics(samplePrompt);

      expect(stats.totalVersions).toBe(1); // Current version only
      expect(stats.mostActiveAuthor).toBe('');
      expect(stats.versionFrequency).toHaveLength(0);
    });

    it('should identify most active author correctly', () => {
      // Add more versions from user1
      samplePrompt.history.versions.push({
        number: 3,
        message: 'Another update',
        created_at: '2023-01-05T00:00:00Z',
        author: 'user1'
      });

      const stats = historyService.getVersionStatistics(samplePrompt);
      expect(stats.mostActiveAuthor).toBe('user1'); // 2 versions vs 1 for user2
    });
  });

  describe('clearAuditTrail', () => {
    it('should clear audit trail for specific prompt', () => {
      const promptId = 'test-prompt-id';
      
      historyService.addAuditEntry({
        promptId,
        action: 'created',
        version: 1,
        author: 'user1',
        details: {}
      });

      expect(historyService.getAuditTrail(promptId)).toHaveLength(1);
      
      historyService.clearAuditTrail(promptId);
      expect(historyService.getAuditTrail(promptId)).toHaveLength(0);
    });
  });

  describe('getAllAuditTrails', () => {
    it('should return all audit trails', () => {
      historyService.addAuditEntry({
        promptId: 'prompt1',
        action: 'created',
        version: 1,
        author: 'user1',
        details: {}
      });

      historyService.addAuditEntry({
        promptId: 'prompt2',
        action: 'created',
        version: 1,
        author: 'user2',
        details: {}
      });

      const allTrails = historyService.getAllAuditTrails();
      expect(allTrails.size).toBe(2);
      expect(allTrails.has('prompt1')).toBe(true);
      expect(allTrails.has('prompt2')).toBe(true);
    });
  });
});