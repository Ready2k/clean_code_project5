import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { MockRedisService } from '../services/mock-redis-service.js';
import { UserService } from '../services/user-service.js';
import express from 'express';
import cors from 'cors';
import { authRoutes } from '../routes/auth.js';
import { errorHandler } from '../middleware/error-handler.js';

describe('Authentication System', () => {
  let app: express.Application;
  let redisService: MockRedisService;
  let userService: UserService;

  beforeEach(async () => {
    // Create test app
    app = express();
    app.use(cors());
    app.use(express.json());
    
    // Initialize services for testing
    redisService = new MockRedisService();
    await redisService.connect();
    userService = new UserService(redisService);
    
    // Mock the service getters
    vi.doMock('../services/user-service.js', () => ({
      getUserService: () => userService
    }));
    
    // Set up routes
    app.use('/api/auth', authRoutes);
    app.use(errorHandler);
    
    // Clear any existing data
    await redisService.flushall();
  });

  afterEach(async () => {
    // Clean up
    if (redisService) {
      await redisService.flushall();
      await redisService.disconnect();
    }
    vi.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        role: 'user'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.role).toBe(userData.role);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.passwordHash).toBeUndefined();
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with short password', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with duplicate email', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Try to register with same email
      const duplicateUser = {
        username: 'testuser2',
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser)
        .expect(409);

      expect(response.body.error.code).toBe('ALREADY_EXISTS');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);
    });

    it('should login successfully with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(credentials.email);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.user.passwordHash).toBeUndefined();
    });

    it('should reject login with invalid email', async () => {
      const credentials = {
        email: 'wrong@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with invalid password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login to get refresh token
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      refreshToken = registerResponse.body.data.refreshToken;
    });

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.refreshToken).not.toBe(refreshToken); // Should be new token
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error.code).toBe('TOKEN_INVALID');
    });

    it('should reject blacklisted refresh token', async () => {
      // Use the refresh token once
      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Try to use the same token again (should be blacklisted)
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(response.body.error.code).toBe('TOKEN_INVALID');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;

    beforeEach(async () => {
      // Register and login to get auth token
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = registerResponse.body.data.token;
    });

    it('should get current user successfully', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('test@example.com');
      expect(response.body.data.username).toBe('testuser');
      expect(response.body.data.passwordHash).toBeUndefined();
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error.code).toBe('TOKEN_INVALID');
    });
  });

  describe('PUT /api/auth/me', () => {
    let authToken: string;

    beforeEach(async () => {
      // Register and login to get auth token
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = registerResponse.body.data.token;
    });

    it('should update user profile successfully', async () => {
      const updates = {
        username: 'updateduser',
        preferences: {
          theme: 'dark',
          language: 'es'
        }
      };

      const response = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('updateduser');
      expect(response.body.data.preferences.theme).toBe('dark');
      expect(response.body.data.preferences.language).toBe('es');
    });

    it('should reject invalid updates', async () => {
      const updates = {
        username: 'ab' // Too short
      };

      const response = await request(app)
        .put('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updates)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/auth/me/password', () => {
    let authToken: string;

    beforeEach(async () => {
      // Register and login to get auth token
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = registerResponse.body.data.token;
    });

    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'password123',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123'
      };

      const response = await request(app)
        .put('/api/auth/me/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');

      // Verify new password works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'newpassword123'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it('should reject password change with wrong current password', async () => {
      const passwordData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
        confirmPassword: 'newpassword123'
      };

      const response = await request(app)
        .put('/api/auth/me/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.field).toBe('currentPassword');
    });

    it('should reject password change with mismatched confirmation', async () => {
      const passwordData = {
        currentPassword: 'password123',
        newPassword: 'newpassword123',
        confirmPassword: 'differentpassword'
      };

      const response = await request(app)
        .put('/api/auth/me/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/logout', () => {
    let authToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login to get tokens
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      authToken = registerResponse.body.data.token;
      refreshToken = registerResponse.body.data.refreshToken;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');

      // Verify refresh token is blacklisted
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      expect(refreshResponse.body.error.code).toBe('TOKEN_INVALID');
    });
  });
});