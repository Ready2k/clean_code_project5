import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockRedisService } from '../services/mock-redis-service.js';
import { UserService } from '../services/user-service.js';
import { ValidationError, AuthenticationError, ConflictError } from '../types/errors.js';

describe('Authentication Integration Tests', () => {
  let redisService: MockRedisService;
  let userService: UserService;

  beforeEach(async () => {
    redisService = new MockRedisService();
    await redisService.connect();
    userService = new UserService(redisService);
    await redisService.flushall();
  });

  afterEach(async () => {
    if (redisService) {
      await redisService.flushall();
      await redisService.disconnect();
    }
  });

  describe('Complete Authentication Flow', () => {
    it('should complete full registration and login flow', async () => {
      // Register user
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        role: 'user' as const
      };

      const registerResult = await userService.register(userData);
      
      expect(registerResult.user.username).toBe(userData.username);
      expect(registerResult.user.email).toBe(userData.email);
      expect(registerResult.token).toBeDefined();
      expect(registerResult.refreshToken).toBeDefined();

      // Login with same credentials
      const loginResult = await userService.login({
        email: userData.email,
        password: userData.password
      });

      expect(loginResult.user.id).toBe(registerResult.user.id);
      expect(loginResult.token).toBeDefined();
      expect(loginResult.refreshToken).toBeDefined();
      expect(loginResult.refreshToken).not.toBe(registerResult.refreshToken);
    });

    it('should handle token refresh flow', async () => {
      // Register user
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const registerResult = await userService.register(userData);
      const originalRefreshToken = registerResult.refreshToken;

      // Refresh token
      const refreshResult = await userService.refreshToken(originalRefreshToken);
      
      expect(refreshResult.user.id).toBe(registerResult.user.id);
      expect(refreshResult.token).toBeDefined();
      expect(refreshResult.refreshToken).toBeDefined();
      expect(refreshResult.refreshToken).not.toBe(originalRefreshToken);

      // Original refresh token should be blacklisted
      await expect(userService.refreshToken(originalRefreshToken))
        .rejects.toThrow(AuthenticationError);
    });

    it('should handle logout flow', async () => {
      // Register user
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const registerResult = await userService.register(userData);
      const refreshToken = registerResult.refreshToken;

      // Logout
      await userService.logout(refreshToken);

      // Refresh token should be blacklisted
      await expect(userService.refreshToken(refreshToken))
        .rejects.toThrow(AuthenticationError);
    });

    it('should handle user profile updates', async () => {
      // Register user
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const registerResult = await userService.register(userData);
      const userId = registerResult.user.id;

      // Update profile
      const updates = {
        username: 'updateduser',
        preferences: {
          theme: 'dark' as const,
          language: 'es',
          notifications: {
            email: false,
            browser: true,
            enhancement: true,
            system: false
          }
        }
      };

      const updatedUser = await userService.updateUser(userId, updates);
      
      expect(updatedUser.username).toBe('updateduser');
      expect(updatedUser.preferences.theme).toBe('dark');
      expect(updatedUser.preferences.language).toBe('es');

      // Verify user can still login with new username
      const user = await userService.getUserByUsername('updateduser');
      expect(user).toBeDefined();
      expect(user!.id).toBe(userId);
    });

    it('should handle password changes', async () => {
      // Register user
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const registerResult = await userService.register(userData);
      const userId = registerResult.user.id;

      // Change password
      const newPassword = 'newpassword456';
      await userService.updateUserPassword(userId, newPassword);

      // Old password should not work
      await expect(userService.login({
        email: userData.email,
        password: userData.password
      })).rejects.toThrow(AuthenticationError);

      // New password should work
      const loginResult = await userService.login({
        email: userData.email,
        password: newPassword
      });

      expect(loginResult.user.id).toBe(userId);
    });
  });

  describe('User Management', () => {
    it('should create and manage multiple users', async () => {
      // Create multiple users
      const users = [
        { username: 'user1', email: 'user1@example.com', password: 'password123', role: 'user' as const },
        { username: 'user2', email: 'user2@example.com', password: 'password123', role: 'admin' as const },
        { username: 'user3', email: 'user3@example.com', password: 'password123', role: 'viewer' as const }
      ];

      const createdUsers = [];
      for (const userData of users) {
        const result = await userService.register(userData);
        createdUsers.push(result.user);
      }

      // Get all users
      const allUsers = await userService.getAllUsers();
      expect(allUsers.length).toBeGreaterThanOrEqual(3);

      // Verify each user can be retrieved
      for (const user of createdUsers) {
        const retrievedUser = await userService.getUserById(user.id);
        expect(retrievedUser).toBeDefined();
        expect(retrievedUser!.id).toBe(user.id);
      }
    });

    it('should prevent duplicate registrations', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      // First registration should succeed
      await userService.register(userData);

      // Duplicate email should fail
      await expect(userService.register({
        username: 'differentuser',
        email: 'test@example.com',
        password: 'password123'
      })).rejects.toThrow(ConflictError);

      // Duplicate username should fail
      await expect(userService.register({
        username: 'testuser',
        email: 'different@example.com',
        password: 'password123'
      })).rejects.toThrow(ConflictError);
    });

    it('should validate user input properly', async () => {
      // Invalid email
      await expect(userService.register({
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123'
      })).rejects.toThrow(ValidationError);

      // Short username
      await expect(userService.register({
        username: 'ab',
        email: 'test@example.com',
        password: 'password123'
      })).rejects.toThrow(ValidationError);

      // Short password
      await expect(userService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: '123'
      })).rejects.toThrow(ValidationError);
    });

    it('should handle user deletion', async () => {
      // Create user
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const registerResult = await userService.register(userData);
      const userId = registerResult.user.id;

      // Verify user exists
      let user = await userService.getUserById(userId);
      expect(user).toBeDefined();

      // Delete user
      await userService.deleteUser(userId);

      // Verify user is deleted
      user = await userService.getUserById(userId);
      expect(user).toBeNull();

      // Verify user cannot be found by email or username
      const userByEmail = await userService.getUserByEmail(userData.email);
      expect(userByEmail).toBeNull();

      const userByUsername = await userService.getUserByUsername(userData.username);
      expect(userByUsername).toBeNull();
    });
  });

  describe('Security Features', () => {
    it('should properly hash passwords', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      await userService.register(userData);
      const user = await userService.getUserByEmail(userData.email);

      expect(user).toBeDefined();
      expect(user!.passwordHash).toBeDefined();
      expect(user!.passwordHash).not.toBe(userData.password);
      expect(user!.passwordHash.length).toBeGreaterThan(50); // bcrypt hashes are long
    });

    it('should blacklist refresh tokens properly', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const registerResult = await userService.register(userData);
      const refreshToken = registerResult.refreshToken;

      // Token should work initially
      const refreshResult = await userService.refreshToken(refreshToken);
      expect(refreshResult.token).toBeDefined();

      // Original token should now be blacklisted
      await expect(userService.refreshToken(refreshToken))
        .rejects.toThrow(AuthenticationError);
    });

    it('should handle concurrent operations safely', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const registerResult = await userService.register(userData);
      const userId = registerResult.user.id;

      // Simulate concurrent updates
      const updates1 = { username: 'updated1' };
      const updates2 = { username: 'updated2' };

      const [result1, result2] = await Promise.allSettled([
        userService.updateUser(userId, updates1),
        userService.updateUser(userId, updates2)
      ]);

      // Both operations should complete (last one wins)
      expect(result1.status).toBe('fulfilled');
      expect(result2.status).toBe('fulfilled');

      // Final state should be consistent
      const finalUser = await userService.getUserById(userId);
      expect(finalUser).toBeDefined();
      expect(['updated1', 'updated2']).toContain(finalUser!.username);
    });
  });
});