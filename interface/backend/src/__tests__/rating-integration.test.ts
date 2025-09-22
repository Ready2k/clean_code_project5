import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import jwt from 'jsonwebtoken';

// Mock all the services to avoid initialization issues
vi.mock('../services/rating-service.js');
vi.mock('../services/prompt-library-service.js');
vi.mock('../services/redis-service.js');
vi.mock('../services/user-service.js');
vi.mock('../services/connection-management-service.js');

describe('Rating API Integration', () => {
  let authToken: string;
  const mockUserId = 'test-user-1';
  const mockPromptId = 'test-prompt-1';

  beforeAll(async () => {
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
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Rating Endpoints', () => {
    it('should have rating routes available', async () => {
      // Test that the rating routes are properly mounted
      const response = await request(app)
        .get('/api/ratings/system/stats')
        .set('Authorization', `Bearer ${authToken}`);

      // Should not be 404 (route exists)
      expect(response.status).not.toBe(404);
    });

    it('should require authentication for rating endpoints', async () => {
      const response = await request(app)
        .post(`/api/ratings/prompts/${mockPromptId}/rate`)
        .send({
          score: 5,
          note: 'Test rating'
        });

      expect(response.status).toBe(401);
    });

    it('should validate rating data', async () => {
      const response = await request(app)
        .post(`/api/ratings/prompts/${mockPromptId}/rate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          score: 6, // Invalid score
          note: 'Test rating'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('System Rating Stats', () => {
    it('should allow access to system stats with proper permissions', async () => {
      const response = await request(app)
        .get('/api/ratings/system/stats')
        .set('Authorization', `Bearer ${authToken}`);

      // Should not be forbidden (has view:system permission)
      expect(response.status).not.toBe(403);
    });
  });

  describe('Prompt Rating Endpoints', () => {
    it('should handle prompt rating requests', async () => {
      const response = await request(app)
        .get(`/api/ratings/prompts/${mockPromptId}/ratings`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should not be 404 (route exists)
      expect(response.status).not.toBe(404);
    });

    it('should handle analytics requests', async () => {
      const response = await request(app)
        .get(`/api/ratings/prompts/${mockPromptId}/analytics`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should not be 404 (route exists)
      expect(response.status).not.toBe(404);
    });
  });
});