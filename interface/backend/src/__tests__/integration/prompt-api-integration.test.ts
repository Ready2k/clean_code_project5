import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index';
import { UserService } from '../../services/user-service';
import { PromptLibraryService } from '../../services/prompt-library-service';

describe('Prompt API Integration Tests', () => {
  let server: any;
  let authToken: string;
  let testUser: any;
  let testPrompt: any;

  beforeAll(async () => {
    server = app.listen(0);
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    // Create test user and login
    testUser = await UserService.createUser({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      role: 'user',
    });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });
    
    authToken = loginResponse.body.token;

    // Create test prompt
    testPrompt = {
      metadata: {
        title: 'Test Prompt',
        summary: 'A test prompt for integration testing',
        tags: ['test', 'integration'],
      },
      humanPrompt: {
        goal: 'Test the prompt API',
        audience: 'Developers',
        steps: ['Step 1', 'Step 2'],
        outputExpectations: 'Successful API response',
      },
      variables: [],
    };
  });

  describe('GET /api/prompts', () => {
    it('should return list of prompts', async () => {
      const response = await request(app)
        .get('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('prompts');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.prompts)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/prompts?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 5);
    });

    it('should support filtering by tags', async () => {
      const response = await request(app)
        .get('/api/prompts?tags=test,integration')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('prompts');
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/prompts?search=test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('prompts');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/prompts')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/prompts', () => {
    it('should create a new prompt', async () => {
      const response = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testPrompt)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.metadata.title).toBe('Test Prompt');
      expect(response.body.metadata.owner).toBe(testUser.username);
    });

    it('should validate required fields', async () => {
      const invalidPrompt = {
        metadata: {
          // missing title
          summary: 'Invalid prompt',
        },
      };

      const response = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPrompt)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('title');
    });

    it('should sanitize input data', async () => {
      const maliciousPrompt = {
        ...testPrompt,
        metadata: {
          ...testPrompt.metadata,
          title: '<script>alert("xss")</script>Malicious Title',
        },
      };

      const response = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousPrompt)
        .expect(201);

      expect(response.body.metadata.title).not.toContain('<script>');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/prompts')
        .send(testPrompt)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/prompts/:id', () => {
    let promptId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testPrompt);
      
      promptId = createResponse.body.id;
    });

    it('should return specific prompt', async () => {
      const response = await request(app)
        .get(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(promptId);
      expect(response.body.metadata.title).toBe('Test Prompt');
    });

    it('should return 404 for non-existent prompt', async () => {
      const response = await request(app)
        .get('/api/prompts/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/prompts/${promptId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/prompts/:id', () => {
    let promptId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testPrompt);
      
      promptId = createResponse.body.id;
    });

    it('should update existing prompt', async () => {
      const updatedPrompt = {
        metadata: {
          title: 'Updated Test Prompt',
          summary: 'Updated summary',
          tags: ['updated', 'test'],
        },
      };

      const response = await request(app)
        .put(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedPrompt)
        .expect(200);

      expect(response.body.metadata.title).toBe('Updated Test Prompt');
      expect(response.body.metadata.tags).toContain('updated');
    });

    it('should preserve ownership', async () => {
      const updatedPrompt = {
        metadata: {
          title: 'Updated Test Prompt',
          owner: 'different-user', // Should be ignored
        },
      };

      const response = await request(app)
        .put(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedPrompt)
        .expect(200);

      expect(response.body.metadata.owner).toBe(testUser.username);
    });

    it('should return 404 for non-existent prompt', async () => {
      const response = await request(app)
        .put('/api/prompts/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ metadata: { title: 'Updated' } })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put(`/api/prompts/${promptId}`)
        .send({ metadata: { title: 'Updated' } })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/prompts/:id', () => {
    let promptId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testPrompt);
      
      promptId = createResponse.body.id;
    });

    it('should delete existing prompt', async () => {
      const response = await request(app)
        .delete(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify prompt is deleted
      await request(app)
        .get(`/api/prompts/${promptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent prompt', async () => {
      const response = await request(app)
        .delete('/api/prompts/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete(`/api/prompts/${promptId}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/prompts/:id/enhance', () => {
    let promptId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testPrompt);
      
      promptId = createResponse.body.id;
    });

    it('should enhance prompt with AI', async () => {
      const enhanceOptions = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
      };

      const response = await request(app)
        .post(`/api/prompts/${promptId}/enhance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(enhanceOptions)
        .expect(200);

      expect(response.body).toHaveProperty('enhanced', true);
      expect(response.body).toHaveProperty('result');
      expect(response.body).toHaveProperty('rationale');
    });

    it('should handle enhancement errors gracefully', async () => {
      const enhanceOptions = {
        provider: 'invalid-provider',
      };

      const response = await request(app)
        .post(`/api/prompts/${promptId}/enhance`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(enhanceOptions)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/prompts/${promptId}/enhance`)
        .send({ provider: 'openai' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/prompts/:id/render/:provider', () => {
    let promptId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testPrompt);
      
      promptId = createResponse.body.id;
    });

    it('should render prompt for specific provider', async () => {
      const renderOptions = {
        model: 'gpt-3.5-turbo',
        variables: {},
      };

      const response = await request(app)
        .post(`/api/prompts/${promptId}/render/openai`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(renderOptions)
        .expect(200);

      expect(response.body).toHaveProperty('provider', 'openai');
      expect(response.body).toHaveProperty('rendered');
    });

    it('should handle invalid provider', async () => {
      const response = await request(app)
        .post(`/api/prompts/${promptId}/render/invalid-provider`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/prompts/${promptId}/render/openai`)
        .send({})
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/prompts/:id/rate', () => {
    let promptId: string;

    beforeEach(async () => {
      const createResponse = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testPrompt);
      
      promptId = createResponse.body.id;
    });

    it('should submit rating for prompt', async () => {
      const rating = {
        score: 5,
        note: 'Excellent prompt!',
      };

      const response = await request(app)
        .post(`/api/prompts/${promptId}/rate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(rating)
        .expect(201);

      expect(response.body).toHaveProperty('message');
    });

    it('should validate rating score', async () => {
      const invalidRating = {
        score: 6, // Invalid score (should be 1-5)
      };

      const response = await request(app)
        .post(`/api/prompts/${promptId}/rate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRating)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/prompts/${promptId}/rate`)
        .send({ score: 5 })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests', async () => {
      const promises = [];
      
      // Create multiple concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .get('/api/prompts')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should handle large prompt data', async () => {
      const largePrompt = {
        ...testPrompt,
        humanPrompt: {
          ...testPrompt.humanPrompt,
          steps: Array(1000).fill('Large step with lots of content'),
        },
      };

      const response = await request(app)
        .post('/api/prompts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largePrompt)
        .expect(201);

      expect(response.body).toHaveProperty('id');
    });
  });
});