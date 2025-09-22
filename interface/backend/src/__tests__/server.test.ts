import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import './setup.js';
import { app } from '../index.js';

describe('Backend API Foundation', () => {
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        uptime: expect.any(Number),
        version: expect.any(String),
        timestamp: expect.any(String)
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      expect(response.body).toMatchObject({
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('Route GET /api/unknown-route not found')
        },
        timestamp: expect.any(String)
      });
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid JSON in request body'
        }
      });
    });
  });

  describe('Authentication Middleware', () => {
    it('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/prompts')
        .expect(401);

      expect(response.body).toMatchObject({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Access token required'
        }
      });
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .get('/api/prompts')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid token'
        }
      });
    });
  });

  describe('API Route Structure', () => {
    it('should have auth routes', async () => {
      await request(app)
        .post('/api/auth/login')
        .expect(501); // Not implemented yet
    });

    it('should have prompt routes (protected)', async () => {
      await request(app)
        .get('/api/prompts')
        .expect(401); // Authentication required
    });

    it('should have connection routes (protected)', async () => {
      await request(app)
        .get('/api/connections')
        .expect(401); // Authentication required
    });

    it('should have system routes (protected)', async () => {
      await request(app)
        .get('/api/system/status')
        .expect(401); // Authentication required
    });

    it('should have admin routes (protected)', async () => {
      await request(app)
        .get('/api/admin/users')
        .expect(401); // Authentication required
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });

  describe('CORS Configuration', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});