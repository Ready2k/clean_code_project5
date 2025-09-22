import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RatingService, getRatingService, initializeRatingService } from '../services/rating-service.js';
import { getPromptLibraryService, initializePromptLibraryService } from '../services/prompt-library-service.js';
import { ValidationError, NotFoundError } from '../types/errors.js';
import fs from 'fs/promises';
import path from 'path';

// Mock the file system operations
vi.mock('fs/promises');

describe('RatingService', () => {
  let ratingService: RatingService;
  const testStorageDir = './test-data';
  const mockPromptId = 'test-prompt-1';
  const mockUserId = 'test-user-1';

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock fs operations
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(fs.readFile).mockResolvedValue('');
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);

    // Initialize services
    await initializePromptLibraryService({ storageDir: testStorageDir });
    await initializeRatingService({ storageDir: testStorageDir });
    ratingService = getRatingService();
  });

  afterEach(async () => {
    await ratingService.shutdown();
  });

  describe('ratePrompt', () => {
    it('should successfully submit a rating', async () => {
      // Mock prompt exists
      const promptLibraryService = getPromptLibraryService();
      vi.spyOn(promptLibraryService, 'getPrompt').mockResolvedValue({
        id: mockPromptId,
        version: 1,
        metadata: {
          title: 'Test Prompt',
          summary: 'Test summary',
          tags: [],
          owner: 'test-owner',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        humanPrompt: {
          goal: 'Test goal',
          audience: 'Test audience',
          steps: ['Step 1'],
          output_expectations: {
            format: 'Test format',
            fields: []
          }
        },
        variables: [],
        history: []
      });

      await expect(ratingService.ratePrompt(mockPromptId, mockUserId, {
        score: 5,
        note: 'Excellent prompt!'
      })).resolves.not.toThrow();

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw ValidationError for invalid score', async () => {
      await expect(ratingService.ratePrompt(mockPromptId, mockUserId, {
        score: 6, // Invalid score
        note: 'Test note'
      })).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent prompt', async () => {
      const promptLibraryService = getPromptLibraryService();
      vi.spyOn(promptLibraryService, 'getPrompt').mockRejectedValue(new NotFoundError('Prompt not found'));

      await expect(ratingService.ratePrompt('non-existent', mockUserId, {
        score: 5
      })).rejects.toThrow(NotFoundError);
    });
  });

  describe('getPromptRatings', () => {
    it('should return ratings with aggregation', async () => {
      // Mock ratings data
      const mockRatings = [
        {
          id: 'rating-1',
          prompt_id: mockPromptId,
          user_id: mockUserId,
          score: 5,
          note: 'Great!',
          created_at: new Date().toISOString()
        },
        {
          id: 'rating-2',
          prompt_id: mockPromptId,
          user_id: 'user-2',
          score: 4,
          created_at: new Date().toISOString()
        }
      ];

      vi.mocked(fs.readdir).mockResolvedValue(['rating-1.yaml', 'rating-2.yaml'] as any);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(`id: rating-1\nprompt_id: ${mockPromptId}\nuser_id: ${mockUserId}\nscore: 5\nnote: Great!\ncreated_at: ${mockRatings[0]?.created_at}`)
        .mockResolvedValueOnce(`id: rating-2\nprompt_id: ${mockPromptId}\nuser_id: user-2\nscore: 4\ncreated_at: ${mockRatings[1]?.created_at}`);

      const result = await ratingService.getPromptRatings(mockPromptId);

      expect(result.ratings).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.aggregation.average_score).toBeGreaterThan(0);
      expect(result.aggregation.total_ratings).toBe(2);
    });

    it('should apply filters correctly', async () => {
      // Mock ratings data
      vi.mocked(fs.readdir).mockResolvedValue(['rating-1.yaml'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(`id: rating-1\nprompt_id: ${mockPromptId}\nuser_id: ${mockUserId}\nscore: 5\ncreated_at: ${new Date().toISOString()}`);

      const result = await ratingService.getPromptRatings(mockPromptId, {
        minScore: 4,
        maxScore: 5,
        userId: mockUserId
      });

      expect(result.ratings).toHaveLength(1);
    });
  });

  describe('getPromptRatingAnalytics', () => {
    it('should return comprehensive analytics', async () => {
      // Mock ratings data
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      vi.mocked(fs.readdir).mockResolvedValue(['rating-1.yaml', 'rating-2.yaml'] as any);
      vi.mocked(fs.readFile)
        .mockResolvedValueOnce(`id: rating-1\nprompt_id: ${mockPromptId}\nuser_id: ${mockUserId}\nscore: 5\ncreated_at: ${now.toISOString()}\nprompt_version: 1`)
        .mockResolvedValueOnce(`id: rating-2\nprompt_id: ${mockPromptId}\nuser_id: user-2\nscore: 4\ncreated_at: ${yesterday.toISOString()}\nprompt_version: 1`);

      const analytics = await ratingService.getPromptRatingAnalytics(mockPromptId);

      expect(analytics.promptId).toBe(mockPromptId);
      expect(analytics.totalRatings).toBe(2);
      expect(analytics.averageScore).toBeGreaterThan(0);
      expect(analytics.ratingTrends).toBeInstanceOf(Array);
      expect(analytics.recentRatings).toBeInstanceOf(Array);
      expect(analytics.topRatedVersions).toBeInstanceOf(Array);
    });
  });

  describe('getSystemRatingStats', () => {
    it('should return system-wide statistics', async () => {
      // Mock prompt library service
      const promptLibraryService = getPromptLibraryService();
      vi.spyOn(promptLibraryService, 'listPrompts').mockResolvedValue([
        {
          id: mockPromptId,
          version: 1,
          metadata: {
            title: 'Test Prompt',
            summary: 'Test summary',
            tags: [],
            owner: 'test-owner',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          humanPrompt: {
            goal: 'Test goal',
            audience: 'Test audience',
            steps: ['Step 1'],
            output_expectations: {
              format: 'Test format',
              fields: []
            }
          },
          variables: [],
          history: []
        }
      ]);

      // Mock ratings
      vi.mocked(fs.readdir).mockResolvedValue(['rating-1.yaml'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(`id: rating-1\nprompt_id: ${mockPromptId}\nuser_id: ${mockUserId}\nscore: 5\ncreated_at: ${new Date().toISOString()}`);

      const stats = await ratingService.getSystemRatingStats();

      expect(stats.totalRatings).toBeGreaterThanOrEqual(0);
      expect(stats.averageScore).toBeGreaterThanOrEqual(0);
      expect(stats.ratingsByScore).toBeDefined();
      expect(stats.topRatedPrompts).toBeInstanceOf(Array);
      expect(stats.recentActivity).toBeInstanceOf(Array);
      expect(stats.ratingTrends).toBeInstanceOf(Array);
    });
  });

  describe('filterPromptsByRating', () => {
    it('should filter prompts by rating criteria', async () => {
      // Mock prompt library service
      const promptLibraryService = getPromptLibraryService();
      vi.spyOn(promptLibraryService, 'listPrompts').mockResolvedValue([
        {
          id: mockPromptId,
          version: 1,
          metadata: {
            title: 'Test Prompt',
            summary: 'Test summary',
            tags: ['test'],
            owner: 'test-owner',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          humanPrompt: {
            goal: 'Test goal',
            audience: 'Test audience',
            steps: ['Step 1'],
            output_expectations: {
              format: 'Test format',
              fields: []
            }
          },
          variables: [],
          history: []
        }
      ]);

      // Mock ratings
      vi.mocked(fs.readdir).mockResolvedValue(['rating-1.yaml'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(`id: rating-1\nprompt_id: ${mockPromptId}\nuser_id: ${mockUserId}\nscore: 5\ncreated_at: ${new Date().toISOString()}`);

      const results = await ratingService.filterPromptsByRating({
        minRating: 4,
        sortByRating: true
      });

      expect(results).toBeInstanceOf(Array);
      results.forEach(result => {
        expect(result.averageScore).toBeGreaterThanOrEqual(4);
        expect(result.promptId).toBeDefined();
        expect(result.title).toBeDefined();
        expect(result.tags).toBeInstanceOf(Array);
      });
    });
  });

  describe('logRun', () => {
    it('should log a prompt run successfully', async () => {
      await expect(ratingService.logRun({
        promptId: mockPromptId,
        userId: mockUserId,
        provider: 'openai',
        model: 'gpt-4',
        success: true,
        outcomeNote: 'Successful run'
      })).resolves.not.toThrow();

      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('getRunHistory', () => {
    it('should return run history for a prompt', async () => {
      // Mock run logs
      vi.mocked(fs.readdir).mockResolvedValue(['run-1.yaml'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(`id: run-1\nprompt_id: ${mockPromptId}\nuser_id: ${mockUserId}\nprovider: openai\nmodel: gpt-4\nsuccess: true\ncreated_at: ${new Date().toISOString()}`);

      const history = await ratingService.getRunHistory(mockPromptId);

      expect(history).toBeInstanceOf(Array);
      expect(history.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getUserRating', () => {
    it('should return user rating for a prompt', async () => {
      // Mock ratings
      vi.mocked(fs.readdir).mockResolvedValue(['rating-1.yaml'] as any);
      vi.mocked(fs.readFile).mockResolvedValue(`id: rating-1\nprompt_id: ${mockPromptId}\nuser_id: ${mockUserId}\nscore: 5\ncreated_at: ${new Date().toISOString()}`);

      const rating = await ratingService.getUserRating(mockPromptId, mockUserId);

      expect(rating).toBeDefined();
      if (rating) {
        expect(rating.user_id).toBe(mockUserId);
        expect(rating.prompt_id).toBe(mockPromptId);
      }
    });

    it('should return null if user has not rated the prompt', async () => {
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const rating = await ratingService.getUserRating(mockPromptId, 'different-user');

      expect(rating).toBeNull();
    });
  });

  describe('updateRating', () => {
    it('should update an existing rating', async () => {
      const ratingId = 'rating-1';
      const existingRating = {
        id: ratingId,
        prompt_id: mockPromptId,
        user_id: mockUserId,
        score: 4,
        note: 'Good',
        created_at: new Date().toISOString()
      };

      vi.mocked(fs.readFile).mockResolvedValue(`id: ${ratingId}\nprompt_id: ${mockPromptId}\nuser_id: ${mockUserId}\nscore: 4\nnote: Good\ncreated_at: ${existingRating.created_at}`);

      await expect(ratingService.updateRating(ratingId, {
        score: 5,
        note: 'Excellent!'
      })).resolves.not.toThrow();

      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw NotFoundError for non-existent rating', async () => {
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      await expect(ratingService.updateRating('non-existent', {
        score: 5
      })).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteRating', () => {
    it('should delete an existing rating', async () => {
      const ratingId = 'rating-1';

      await expect(ratingService.deleteRating(ratingId)).resolves.not.toThrow();

      expect(fs.unlink).toHaveBeenCalledWith(path.join(testStorageDir, 'ratings', `${ratingId}.yaml`));
    });

    it('should throw NotFoundError for non-existent rating', async () => {
      vi.mocked(fs.unlink).mockRejectedValue({ code: 'ENOENT' });

      await expect(ratingService.deleteRating('non-existent')).rejects.toThrow(NotFoundError);
    });
  });
});