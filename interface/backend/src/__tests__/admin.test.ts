import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { initializeRedisService, getRedisService } from '../services/redis-service.js';
import { initializeUserService, getUserService } from '../services/user-service.js';

describe('Admin User Management', () => {
  let redisService: any;
  let userService: any;
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    // Initialize services for testing
    redisService = await initializeRedisService();
    userService = await initializeUserService(redisService);
    
    // Clear any existing data
    await redisService.flushall();

    // Create admin user
    const adminData = {
      username: 'admin',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'admin'
    };

    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send(adminData);

    adminToken = adminResponse.body.data.token;

    // Create regular user
    const userData = {
      username: 'user',
      email: 'user@example.com',
      password: 'user123',
      role: 'user'
    };

    const userResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);

    userToken = userResponse.body.data.token;
  });

  afterEach(async () => {
    // Clean up
    if (redisService) {
      await redisService.flushall();
      await redisService.disconnect();
    }
  });

  describe('GET /api/admin/users', () => {
    it('should get all users as admin', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(2); // admin + user
      
      // Check that password hashes are not included
      response.body.data.forEach((user: any) => {
        expect(user.passwordHash).toBeUndefined();
      });
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });

    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .expect(401);

      expect(response.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  describe('POST /api/admin/users', () => {
    it('should create a new user as admin', async () => {
      const newUserData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        role: 'user'
      };

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUserData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe(newUserData.username);
      expect(response.body.data.email).toBe(newUserData.email);
      expect(response.body.data.role).toBe(newUserData.role);
      expect(response.body.data.passwordHash).toBeUndefined();
    });

    it('should create an admin user', async () => {
      const newAdminData = {
        username: 'newadmin',
        email: 'newadmin@example.com',
        password: 'password123',
        role: 'admin'
      };

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newAdminData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('admin');
    });

    it('should reject invalid user data', async () => {
      const invalidUserData = {
        username: 'ab', // Too short
        email: 'invalid-email',
        password: '123', // Too short
        role: 'invalid-role'
      };

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidUserData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject non-admin users', async () => {
      const newUserData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        role: 'user'
      };

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send(newUserData)
        .expect(403);

      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('GET /api/admin/users/:id', () => {
    let testUserId: string;

    beforeEach(async () => {
      // Get the user ID from the users list
      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      testUserId = usersResponse.body.data.find((u: any) => u.username === 'user').id;
    });

    it('should get a specific user as admin', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUserId);
      expect(response.body.data.username).toBe('user');
      expect(response.body.data.passwordHash).toBeUndefined();
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/api/admin/users/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .get(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('PUT /api/admin/users/:id', () => {
    let testUserId: string;

    beforeEach(async () => {
      // Get the user ID from the users list
      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      testUserId = usersResponse.body.data.find((u: any) => u.username === 'user').id;
    });

    it('should update a user as admin', async () => {
      const updates = {
        username: 'updateduser',
        email: 'updated@example.com',
        preferences: {
          theme: 'dark'
        }
      };

      const response = await request(app)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.username).toBe('updateduser');
      expect(response.body.data.email).toBe('updated@example.com');
      expect(response.body.data.preferences.theme).toBe('dark');
    });

    it('should reject invalid updates', async () => {
      const updates = {
        username: 'ab', // Too short
        email: 'invalid-email'
      };

      const response = await request(app)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject non-admin users', async () => {
      const updates = {
        username: 'updateduser'
      };

      const response = await request(app)
        .put(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updates)
        .expect(403);

      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });
  });

  describe('PUT /api/admin/users/:id/role', () => {
    let testUserId: string;

    beforeEach(async () => {
      // Get the user ID from the users list
      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      testUserId = usersResponse.body.data.find((u: any) => u.username === 'user').id;
    });

    it('should update user role as admin', async () => {
      const roleUpdate = {
        role: 'admin'
      };

      const response = await request(app)
        .put(`/api/admin/users/${testUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(roleUpdate)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.role).toBe('admin');
    });

    it('should reject invalid role', async () => {
      const roleUpdate = {
        role: 'invalid-role'
      };

      const response = await request(app)
        .put(`/api/admin/users/${testUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(roleUpdate)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should prevent admin from changing their own role', async () => {
      // Get admin user ID
      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      const adminUserId = usersResponse.body.data.find((u: any) => u.username === 'admin').id;

      const roleUpdate = {
        role: 'user'
      };

      const response = await request(app)
        .put(`/api/admin/users/${adminUserId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(roleUpdate)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Cannot change your own role');
    });
  });

  describe('POST /api/admin/users/:id/reset-password', () => {
    let testUserId: string;

    beforeEach(async () => {
      // Get the user ID from the users list
      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      testUserId = usersResponse.body.data.find((u: any) => u.username === 'user').id;
    });

    it('should reset user password as admin', async () => {
      const passwordReset = {
        newPassword: 'newpassword123'
      };

      const response = await request(app)
        .post(`/api/admin/users/${testUserId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(passwordReset)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password reset successfully');

      // Verify new password works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'newpassword123'
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it('should reject short password', async () => {
      const passwordReset = {
        newPassword: '123'
      };

      const response = await request(app)
        .post(`/api/admin/users/${testUserId}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(passwordReset)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    let testUserId: string;

    beforeEach(async () => {
      // Create a user to delete
      const newUserData = {
        username: 'deleteme',
        email: 'deleteme@example.com',
        password: 'password123',
        role: 'user'
      };

      const createResponse = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newUserData);

      testUserId = createResponse.body.data.id;
    });

    it('should delete a user as admin', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User deleted successfully');

      // Verify user is deleted
      const getUserResponse = await request(app)
        .get(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(getUserResponse.body.error.code).toBe('NOT_FOUND');
    });

    it('should prevent admin from deleting themselves', async () => {
      // Get admin user ID
      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      const adminUserId = usersResponse.body.data.find((u: any) => u.username === 'admin').id;

      const response = await request(app)
        .delete(`/api/admin/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Cannot delete your own account');
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${testUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('PERMISSION_DENIED');
    });
  });
});