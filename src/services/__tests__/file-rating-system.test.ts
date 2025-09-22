// Tests for File-based Rating System

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileRatingSystem } from '../file-rating-system';
import { Rating, RunLog } from '../../models/rating';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('FileRatingSystem', () => {
  let ratingSystem: FileRatingSystem;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(__dirname, '../../../test-data/rating-system-test');
    ratingSystem = new FileRatingSystem(testDir);
    await ratingSystem.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('ratePrompt', () => {
    it('should create a new rating', async () => {
      const promptId = 'test-prompt-1';
      const userId = 'user-1';
      const rating = {
        prompt_id: promptId,
        user_id: userId,
        score: 4,
        note: 'Great prompt!',
        prompt_version: 1
      };

      await ratingSystem.ratePrompt(promptId, userId, rating);

      const ratings = await ratingSystem.getPromptRatings(promptId);
      expect(ratings).toHaveLength(1);
      expect(ratings[0].score).toBe(4);
      expect(ratings[0].note).toBe('Great prompt!');
      expect(ratings[0].user_id).toBe(userId);
      expect(ratings[0].prompt_id).toBe(promptId);
    });

    it('should update existing rating from same user', async () => {
      const promptId = 'test-prompt-1';
      const userId = 'user-1';

      // First rating
      await ratingSystem.ratePrompt(promptId, userId, {
        prompt_id: promptId,
        user_id: userId,
        score: 3,
        note: 'Good'
      });

      // Second rating from same user
      await ratingSystem.ratePrompt(promptId, userId, {
        prompt_id: promptId,
        user_id: userId,
        score: 5,
        note: 'Excellent!'
      });

      const ratings = await ratingSystem.getPromptRatings(promptId);
      expect(ratings).toHaveLength(1);
      expect(ratings[0].score).toBe(5);
      expect(ratings[0].note).toBe('Excellent!');
    });

    it('should reject invalid rating scores', async () => {
      const promptId = 'test-prompt-1';
      const userId = 'user-1';

      await expect(ratingSystem.ratePrompt(promptId, userId, {
        prompt_id: promptId,
        user_id: userId,
        score: 0
      })).rejects.toThrow('Rating score must be between 1 and 5');

      await expect(ratingSystem.ratePrompt(promptId, userId, {
        prompt_id: promptId,
        user_id: userId,
        score: 6
      })).rejects.toThrow('Rating score must be between 1 and 5');
    });
  });

  describe('getPromptRatings', () => {
    it('should return empty array for prompt with no ratings', async () => {
      const ratings = await ratingSystem.getPromptRatings('non-existent-prompt');
      expect(ratings).toEqual([]);
    });

    it('should return ratings sorted by creation date (newest first)', async () => {
      const promptId = 'test-prompt-1';

      // Add multiple ratings
      await ratingSystem.ratePrompt(promptId, 'user-1', {
        prompt_id: promptId,
        user_id: 'user-1',
        score: 3
      });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await ratingSystem.ratePrompt(promptId, 'user-2', {
        prompt_id: promptId,
        user_id: 'user-2',
        score: 5
      });

      const ratings = await ratingSystem.getPromptRatings(promptId);
      expect(ratings).toHaveLength(2);
      expect(new Date(ratings[0].created_at).getTime()).toBeGreaterThan(
        new Date(ratings[1].created_at).getTime()
      );
    });
  });

  describe('getAverageRating', () => {
    it('should return 0 for prompt with no ratings', async () => {
      const average = await ratingSystem.getAverageRating('non-existent-prompt');
      expect(average).toBe(0);
    });

    it('should calculate correct average rating', async () => {
      const promptId = 'test-prompt-1';

      await ratingSystem.ratePrompt(promptId, 'user-1', {
        prompt_id: promptId,
        user_id: 'user-1',
        score: 2
      });

      await ratingSystem.ratePrompt(promptId, 'user-2', {
        prompt_id: promptId,
        user_id: 'user-2',
        score: 4
      });

      await ratingSystem.ratePrompt(promptId, 'user-3', {
        prompt_id: promptId,
        user_id: 'user-3',
        score: 5
      });

      const average = await ratingSystem.getAverageRating(promptId);
      expect(average).toBe(3.67); // (2 + 4 + 5) / 3 = 3.67
    });
  });

  describe('logRun', () => {
    it('should log a prompt run', async () => {
      const runLog = {
        prompt_id: 'test-prompt-1',
        user_id: 'user-1',
        provider: 'openai',
        model: 'gpt-4',
        success: true,
        outcome_note: 'Generated good response',
        metadata: { temperature: 0.7 }
      };

      await ratingSystem.logRun(runLog);

      const history = await ratingSystem.getRunHistory('test-prompt-1');
      expect(history).toHaveLength(1);
      expect(history[0].provider).toBe('openai');
      expect(history[0].model).toBe('gpt-4');
      expect(history[0].success).toBe(true);
      expect(history[0].outcome_note).toBe('Generated good response');
      expect(history[0].metadata).toEqual({ temperature: 0.7 });
    });
  });

  describe('getRunHistory', () => {
    it('should return empty array for prompt with no run history', async () => {
      const history = await ratingSystem.getRunHistory('non-existent-prompt');
      expect(history).toEqual([]);
    });

    it('should return run history sorted by creation date (newest first)', async () => {
      const promptId = 'test-prompt-1';

      await ratingSystem.logRun({
        prompt_id: promptId,
        user_id: 'user-1',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        success: true
      });

      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      await ratingSystem.logRun({
        prompt_id: promptId,
        user_id: 'user-1',
        provider: 'anthropic',
        model: 'claude-3',
        success: false
      });

      const history = await ratingSystem.getRunHistory(promptId);
      expect(history).toHaveLength(2);
      expect(new Date(history[0].created_at).getTime()).toBeGreaterThan(
        new Date(history[1].created_at).getTime()
      );
      expect(history[0].provider).toBe('anthropic');
      expect(history[1].provider).toBe('openai');
    });
  });

  describe('getRatingAggregation', () => {
    it('should return empty aggregation for prompt with no ratings', async () => {
      const aggregation = await ratingSystem.getRatingAggregation('non-existent-prompt');
      expect(aggregation).toEqual({
        prompt_id: 'non-existent-prompt',
        average_score: 0,
        total_ratings: 0,
        score_distribution: {},
        latest_rating_date: ''
      });
    });

    it('should calculate correct aggregation data', async () => {
      const promptId = 'test-prompt-1';

      await ratingSystem.ratePrompt(promptId, 'user-1', {
        prompt_id: promptId,
        user_id: 'user-1',
        score: 5
      });

      await ratingSystem.ratePrompt(promptId, 'user-2', {
        prompt_id: promptId,
        user_id: 'user-2',
        score: 4
      });

      await ratingSystem.ratePrompt(promptId, 'user-3', {
        prompt_id: promptId,
        user_id: 'user-3',
        score: 5
      });

      const aggregation = await ratingSystem.getRatingAggregation(promptId);
      expect(aggregation.prompt_id).toBe(promptId);
      expect(aggregation.average_score).toBe(4.67); // (5 + 4 + 5) / 3
      expect(aggregation.total_ratings).toBe(3);
      expect(aggregation.score_distribution).toEqual({
        4: 1,
        5: 2
      });
      expect(aggregation.latest_rating_date).toBeTruthy();
    });
  });

  describe('getUserRating', () => {
    it('should return null for user who has not rated the prompt', async () => {
      const rating = await ratingSystem.getUserRating('test-prompt-1', 'user-1');
      expect(rating).toBeNull();
    });

    it('should return user rating if exists', async () => {
      const promptId = 'test-prompt-1';
      const userId = 'user-1';

      await ratingSystem.ratePrompt(promptId, userId, {
        prompt_id: promptId,
        user_id: userId,
        score: 4,
        note: 'Good prompt'
      });

      const rating = await ratingSystem.getUserRating(promptId, userId);
      expect(rating).toBeTruthy();
      expect(rating!.score).toBe(4);
      expect(rating!.note).toBe('Good prompt');
      expect(rating!.user_id).toBe(userId);
    });
  });

  describe('updateRating', () => {
    it('should update an existing rating', async () => {
      const promptId = 'test-prompt-1';
      const userId = 'user-1';

      await ratingSystem.ratePrompt(promptId, userId, {
        prompt_id: promptId,
        user_id: userId,
        score: 3,
        note: 'OK'
      });

      const originalRating = await ratingSystem.getUserRating(promptId, userId);
      expect(originalRating).toBeTruthy();

      await ratingSystem.updateRating(originalRating!.id, {
        score: 5,
        note: 'Much better now!'
      });

      const updatedRating = await ratingSystem.getUserRating(promptId, userId);
      expect(updatedRating!.score).toBe(5);
      expect(updatedRating!.note).toBe('Much better now!');
      expect(updatedRating!.id).toBe(originalRating!.id);
      expect(updatedRating!.created_at).toBe(originalRating!.created_at);
    });

    it('should reject invalid score updates', async () => {
      const promptId = 'test-prompt-1';
      const userId = 'user-1';

      await ratingSystem.ratePrompt(promptId, userId, {
        prompt_id: promptId,
        user_id: userId,
        score: 3
      });

      const rating = await ratingSystem.getUserRating(promptId, userId);
      
      await expect(ratingSystem.updateRating(rating!.id, { score: 0 }))
        .rejects.toThrow('Rating score must be between 1 and 5');

      await expect(ratingSystem.updateRating(rating!.id, { score: 6 }))
        .rejects.toThrow('Rating score must be between 1 and 5');
    });

    it('should throw error for non-existent rating', async () => {
      await expect(ratingSystem.updateRating('non-existent-id', { score: 4 }))
        .rejects.toThrow('Rating with ID non-existent-id not found');
    });
  });

  describe('deleteRating', () => {
    it('should delete an existing rating', async () => {
      const promptId = 'test-prompt-1';
      const userId = 'user-1';

      await ratingSystem.ratePrompt(promptId, userId, {
        prompt_id: promptId,
        user_id: userId,
        score: 4
      });

      const rating = await ratingSystem.getUserRating(promptId, userId);
      expect(rating).toBeTruthy();

      await ratingSystem.deleteRating(rating!.id);

      const deletedRating = await ratingSystem.getUserRating(promptId, userId);
      expect(deletedRating).toBeNull();
    });

    it('should throw error for non-existent rating', async () => {
      await expect(ratingSystem.deleteRating('non-existent-id'))
        .rejects.toThrow('Rating with ID non-existent-id not found');
    });
  });

  describe('getPromptRatingAggregationAllVersions', () => {
    it('should aggregate ratings across all versions', async () => {
      const promptId = 'test-prompt-1';

      // Add ratings for different versions
      await ratingSystem.ratePrompt(promptId, 'user-1', {
        prompt_id: promptId,
        user_id: 'user-1',
        score: 4,
        prompt_version: 1
      });

      await ratingSystem.ratePrompt(promptId, 'user-2', {
        prompt_id: promptId,
        user_id: 'user-2',
        score: 5,
        prompt_version: 2
      });

      await ratingSystem.ratePrompt(promptId, 'user-3', {
        prompt_id: promptId,
        user_id: 'user-3',
        score: 3,
        prompt_version: 1
      });

      const aggregation = await ratingSystem.getPromptRatingAggregationAllVersions(promptId);
      expect(aggregation.total_ratings).toBe(3);
      expect(aggregation.average_score).toBe(4); // (4 + 5 + 3) / 3 = 4
      expect(aggregation.score_distribution).toEqual({
        3: 1,
        4: 1,
        5: 1
      });
    });
  });

  describe('getPromptVersionRatingAggregation', () => {
    it('should aggregate ratings for specific version only', async () => {
      const promptId = 'test-prompt-1';

      // Add ratings for different versions
      await ratingSystem.ratePrompt(promptId, 'user-1', {
        prompt_id: promptId,
        user_id: 'user-1',
        score: 4,
        prompt_version: 1
      });

      await ratingSystem.ratePrompt(promptId, 'user-2', {
        prompt_id: promptId,
        user_id: 'user-2',
        score: 5,
        prompt_version: 2
      });

      await ratingSystem.ratePrompt(promptId, 'user-3', {
        prompt_id: promptId,
        user_id: 'user-3',
        score: 3,
        prompt_version: 1
      });

      const version1Aggregation = await ratingSystem.getPromptVersionRatingAggregation(promptId, 1);
      expect(version1Aggregation.total_ratings).toBe(2);
      expect(version1Aggregation.average_score).toBe(3.5); // (4 + 3) / 2 = 3.5

      const version2Aggregation = await ratingSystem.getPromptVersionRatingAggregation(promptId, 2);
      expect(version2Aggregation.total_ratings).toBe(1);
      expect(version2Aggregation.average_score).toBe(5);
    });
  });

  describe('getRunStatistics', () => {
    it('should calculate run statistics correctly', async () => {
      const promptId = 'test-prompt-1';

      // Add multiple run logs
      await ratingSystem.logRun({
        prompt_id: promptId,
        user_id: 'user-1',
        provider: 'openai',
        model: 'gpt-4',
        success: true
      });

      await ratingSystem.logRun({
        prompt_id: promptId,
        user_id: 'user-1',
        provider: 'anthropic',
        model: 'claude-3',
        success: false
      });

      await ratingSystem.logRun({
        prompt_id: promptId,
        user_id: 'user-2',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        success: true
      });

      const stats = await ratingSystem.getRunStatistics(promptId);
      expect(stats.total_runs).toBe(3);
      expect(stats.success_rate).toBe(0.67); // 2/3 = 0.67
      expect(stats.provider_distribution).toEqual({
        openai: 2,
        anthropic: 1
      });
      expect(stats.model_distribution).toEqual({
        'gpt-4': 1,
        'claude-3': 1,
        'gpt-3.5-turbo': 1
      });
      expect(stats.recent_runs).toHaveLength(3);
    });

    it('should return empty stats for prompt with no runs', async () => {
      const stats = await ratingSystem.getRunStatistics('non-existent-prompt');
      expect(stats).toEqual({
        total_runs: 0,
        success_rate: 0,
        provider_distribution: {},
        model_distribution: {},
        recent_runs: []
      });
    });
  });

  describe('getPromptAnalytics', () => {
    it('should provide comprehensive analytics', async () => {
      const promptId = 'test-prompt-1';

      // Add ratings
      await ratingSystem.ratePrompt(promptId, 'user-1', {
        prompt_id: promptId,
        user_id: 'user-1',
        score: 4,
        prompt_version: 1
      });

      await ratingSystem.ratePrompt(promptId, 'user-2', {
        prompt_id: promptId,
        user_id: 'user-2',
        score: 5,
        prompt_version: 2
      });

      // Add run logs
      await ratingSystem.logRun({
        prompt_id: promptId,
        user_id: 'user-1',
        provider: 'openai',
        model: 'gpt-4',
        success: true
      });

      await ratingSystem.logRun({
        prompt_id: promptId,
        user_id: 'user-1',
        provider: 'anthropic',
        model: 'claude-3',
        success: false
      });

      const analytics = await ratingSystem.getPromptAnalytics(promptId);
      
      expect(analytics.ratings.total_ratings).toBe(2);
      expect(analytics.ratings.average_score).toBe(4.5);
      
      expect(analytics.runs.total_runs).toBe(2);
      expect(analytics.runs.success_rate).toBe(0.5);
      
      expect(analytics.version_ratings[1].total_ratings).toBe(1);
      expect(analytics.version_ratings[1].average_score).toBe(4);
      expect(analytics.version_ratings[2].total_ratings).toBe(1);
      expect(analytics.version_ratings[2].average_score).toBe(5);
    });
  });
});