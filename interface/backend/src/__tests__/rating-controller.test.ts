import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { getRatingService, initializeRatingService } from '../services/rating-service.js';
import { initializePromptLibraryService } from '../services/prompt-library-service.js';
import { initializeRedisService } from '../services/redis-service.js';
import { initializeUserService } from '../services/user-service.js';
import jwt from 'jsonwebtoken';

// Mock the services
vi.mock('../services/rating-service.js');
vi.mock('../services/prompt-library-service.js');
vi.mock('../services/redis-service.js');
vi.mock('../services/user-service.js');

describe('Rating Controller', () => {
  let authToken: string;
  const mockUserId = 'test-user-1';
  const mockPromptId = 'test-prompt-1';

  beforeEach(async () => {
    // Create a mock JWT token
    authToken = jwt.sign(
      {
        userId: mockUserId,
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
        permissions: ['read:prompts', 'rate:prompts', 'view:system']
      },
      process.env['JWT_SECRET'] || 'test-secret',
      { expiresIn: '1h' }
    );

    // Mock service initialization
    vi.mocked(initializeRedisService).mockResolvedValue(undefined);
    vi.mocked(initializeUserService).mockResolvedValue(undefined);
    vi.mocked(initializePromptLibraryService).mockResolvedValue(undefined);
    vi.mocked(initializeRatingService).mockResolvedValue(undefined);

    // Mock rating service methods
    const mockRatingService = {
      ratePrompt: vi.fn().mockResolvedValue(undefined),
      getPromptRatings: vi.fn().mockResolvedValue({
        ratings: [
          {
            id: 'rating-1',
            prompt_id: mockPromptId,
            user_id: mockUserId,
            score: 5,
            note: 'Great prompt!',
            created_at: new Date().toISOString()
          }
        ],
        total: 1,
        aggregation: {
          prompt_id: mockPromptId,
          average_score: 5,
          total_ratings: 1,
          score_distribution: { 5: 1 },
          latest_rating_date: new Date().toISOString()
        }
      }),
      getPromptRatingAnalytics: vi.fn().mockResolvedValue({
        promptId: mockPromptId,
        totalRatings: 1,
        averageScore: 5,
        scoreDistribution: { 5: 1 },
        ratingTrends: [],
        recentRatings: [],
        topRatedVersions: []
      }),
      getSystemRatingStats: vi.fn().mockResolvedValue({
        totalRatings: 10,
        averageScore: 4.5,
        ratingsByScore: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 },
        topRatedPrompts: [],
        recentActivity: [],
        ratingTrends: []
      }),
      getUserRating: vi.fn().mockResolvedValue({
        id: 'rating-1',
        prompt_id: mockPromptId,
        user_id: mockUserId,
        score: 5,
        created_at: new Date().toISOString()
      }),
      updateRating: vi.fn().mockResolvedValue(undefined),
      deleteRating: vi.fn().mockResolvedValue(undefined),
      filterPromptsByRating: vi.fn().mockResolvedValue([
        {
          promptId: mockPromptId,
          title: 'Test Prompt',
          averageScore: 4.5,
          totalRatings: 2,
          tags: ['test']
        }
      ]),
      logRun: vi.fn().mockResolvedValue(undefined),
      getRunHistory: vi.fn().mockResolvedValue([
        {
          id: 'run-1',
          prompt_id: mockPromptId,
          user_id: mockUserId,
          provider: 'openai',
          model: 'gpt-4',
          success: true,
          created_at: new Date().toISOString()
        }
      ]),
      getPromptAnalytics: vi.fn().mockResolvedValue({
        ratings: {
          prompt_id: mockPromptId,
          average_score: 4.5,
          total_ratings: 2,
          score_distribution: { 4: 1, 5: 1 },
          latest_rating_date: new Date().toISOString()
        },
        runs: {
          total_runs: 5,
          success_rate: 0.8,
          provider_distribution: { openai: 3, anthropic: 2 },
          model_distribution: { 'gpt-4': 3, 'claude-3': 2 }
        },
        version_ratings: {}
      }),
      shutdown: vi.fn().mockResolvedValue(undefined)
    };

    vi.mocked(getRatingService).mockReturnValue(mockRatingService as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/ratings/prompts/:promptId/rate', () => {
    it('should submit a rating successfully', async () => {
      const response = await request(app)
        .post(`/api/ratings/prompts/${mockPromptId}/rate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          score: 5,
          note: 'Excellent prompt!'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Rating submitted successfully');
      expect(response.body.promptId).toBe(mockPromptId);
      expect(response.body.score).toBe(5);
    });

    it('should return 400 for invalid score', async () => {
      const response = await request(app)
        .post(`/api/ratings/prompts/${mockPromptId}/rate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          score: 6, // Invalid score
          note: 'Test note'
        });

      expect(response.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post(`/api/ratings/prompts/${mockPromptId}/rate`)
        .send({
          score: 5,
          note: 'Test note'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/ratings/prompts/:promptId/ratings', () => {
    it('should get prompt ratings successfully', async () => {
      const response = await request(app)
        .get(`/api/ratings/prompts/${mockPromptId}/ratings`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.promptId).toBe(mockPromptId);
      expect(response.body.ratings).toBeInstanceOf(Array);
      expect(response.body.total).toBe(1);
      expect(response.body.aggregation).toBeDefined();
    });

    it('should apply filters correctly', async () => {
      const response = await request(app)
        .get(`/api/ratings/prompts/${mockPromptId}/ratings`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          minScore: 4,
          maxScore: 5,
          sortBy: 'score',
          sortOrder: 'desc'
        });

      expect(response.status).toBe(200);
      expect(response.body.filters).toBeDefined();
    });
  });

  describe('GET /api/ratings/prompts/:promptId/analytics', () => {
    it('should get prompt rating analytics successfully', async () => {
      const response = await request(app)
        .get(`/api/ratings/prompts/${mockPromptId}/analytics`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.promptId).toBe(mockPromptId);
      expect(response.body.analytics).toBeDefined();
      expect(response.body.analytics.totalRatings).toBe(1);
      expect(response.body.analytics.averageScore).toBe(5);
    });
  });

  describe('GET /api/ratings/system/stats', () => {
    it('should get system rating stats successfully', async () => {
      const response = await request(app)
        .get('/api/ratings/system/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.systemStats).toBeDefined();
      expect(response.body.systemStats.totalRatings).toBe(10);
      expect(response.body.systemStats.averageScore).toBe(4.5);
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/ratings/prompts/:promptId/user-rating', () => {
    it('should get user rating for prompt successfully', async () => {
      const response = await request(app)
        .get(`/api/ratings/prompts/${mockPromptId}/user-rating`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.promptId).toBe(mockPromptId);
      expect(response.body.userRating).toBeDefined();
      expect(response.body.userRating.user_id).toBe(mockUserId);
    });
  });

  describe('PUT /api/ratings/:ratingId', () => {
    it('should update rating successfully', async () => {
      const ratingId = 'rating-1';
      const response = await request(app)
        .put(`/api/ratings/${ratingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          score: 4,
          note: 'Updated note'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Rating updated successfully');
      expect(response.body.ratingId).toBe(ratingId);
    });

    it('should return 400 for invalid update data', async () => {
      const ratingId = 'rating-1';
      const response = await request(app)
        .put(`/api/ratings/${ratingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({}); // Empty update

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/ratings/:ratingId', () => {
    it('should delete rating successfully', async () => {
      const ratingId = 'rating-1';
      const response = await request(app)
        .delete(`/api/ratings/${ratingId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(204);
    });
  });

  describe('GET /api/ratings/prompts/filter', () => {
    it('should filter prompts by rating successfully', async () => {
      const response = await request(app)
        .get('/api/ratings/prompts/filter')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          minRating: 4,
          sortByRating: true
        });

      expect(response.status).toBe(200);
      expect(response.body.prompts).toBeInstanceOf(Array);
      expect(response.body.total).toBe(1);
      expect(response.body.filters).toBeDefined();
    });
  });

  describe('POST /api/ratings/prompts/:promptId/runs', () => {
    it('should log run successfully', async () => {
      const response = await request(app)
        .post(`/api/ratings/prompts/${mockPromptId}/runs`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          provider: 'openai',
          model: 'gpt-4',
          success: true,
          outcomeNote: 'Successful execution'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Run logged successfully');
      expect(response.body.promptId).toBe(mockPromptId);
    });

    it('should return 400 for invalid run data', async () => {
      const response = await request(app)
        .post(`/api/ratings/prompts/${mockPromptId}/runs`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          provider: 'openai',
          // Missing required fields
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/ratings/prompts/:promptId/runs', () => {
    it('should get run history successfully', async () => {
      const response = await request(app)
        .get(`/api/ratings/prompts/${mockPromptId}/runs`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.promptId).toBe(mockPromptId);
      expect(response.body.runHistory).toBeInstanceOf(Array);
      expect(response.body.total).toBe(1);
    });
  });

  describe('GET /api/ratings/prompts/:promptId/full-analytics', () => {
    it('should get comprehensive prompt analytics successfully', async () => {
      const response = await request(app)
        .get(`/api/ratings/prompts/${mockPromptId}/full-analytics`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.promptId).toBe(mockPromptId);
      expect(response.body.analytics).toBeDefined();
      expect(response.body.analytics.ratings).toBeDefined();
      expect(response.body.analytics.runs).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/ratings/system/trends', () => {
    it('should get system rating trends successfully', async () => {
      const response = await request(app)
        .get('/api/ratings/system/trends')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: 30 });

      expect(response.status).toBe(200);
      expect(response.body.systemTrends).toBeDefined();
      expect(response.body.period).toBe('30 days');
    });

    it('should return 400 for invalid days parameter', async () => {
      const response = await request(app)
        .get('/api/ratings/system/trends')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: 500 }); // Too many days

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/ratings/prompts/:promptId/trends', () => {
    it('should get prompt rating trends successfully', async () => {
      const response = await request(app)
        .get(`/api/ratings/prompts/${mockPromptId}/trends`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: 7 });

      expect(response.status).toBe(200);
      expect(response.body.promptId).toBe(mockPromptId);
      expect(response.body.trends).toBeDefined();
      expect(response.body.period).toBe('7 days');
    });
  });

  describe('GET /api/ratings/system/top-rated', () => {
    it('should get top rated prompts successfully', async () => {
      const response = await request(app)
        .get('/api/ratings/system/top-rated')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 5, minRatingCount: 2 });

      expect(response.status).toBe(200);
      expect(response.body.topRatedPrompts).toBeInstanceOf(Array);
      expect(response.body.criteria).toBeDefined();
      expect(response.body.criteria.limit).toBe(5);
      expect(response.body.criteria.minRatingCount).toBe(2);
    });

    it('should return 400 for invalid limit', async () => {
      const response = await request(app)
        .get('/api/ratings/system/top-rated')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 200 }); // Too high

      expect(response.status).toBe(400);
    });
  });
});