import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UserService } from '../services/user-service.js';
import { MockRedisService } from '../services/mock-redis-service.js';
import { ValidationError, AuthenticationError, ConflictError, NotFoundError } from '../types/errors.js';

describe('User Service', () => {
  let userService: UserService;
  let redisService: MockRedisService;

  beforeEach(async () => {
    redisService = new MockRedisService();
    await redisService.connect();
    await redisService.flushall();
    
    userService = new UserService(redisService);
  });

  afterEach(async () => {
    if (redisService) {
      await redisService.flushall();
      await redisService.disconnect();
    }
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        role: 'user' as const
      };

      const result = await userService.register(userData);

      expect(result.user.username).toBe(userData.username);
      expect(result.user.email).toBe(userData.email);
      expect(result.user.role).toBe(userData.role);
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBeGreaterThan(0);
      expect(result.user.passwordHash).toBeUndefined();
    });

    it('should hash password during registration', async () => {
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
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123'
      };

      await expect(userService.register(userData)).rejects.toThrow(ValidationError);
    });

    it('should reject registration with short username', async () => {
      const userData = {
        username: 'ab',
        email: 'test@example.com',
        password: 'password123'
      };

      await expect(userService.register(userData)).rejects.toThrow(ValidationError);
    });

    it('should reject registration with short password', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: '123'
      };

      await expect(userService.register(userData)).rejects.toThrow(ValidationError);
    });

    it('should reject duplicate email', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      await userService.register(userData);

      const duplicateUser = {
        username: 'testuser2',
        email: 'test@example.com',
        password: 'password123'
      };

      await expect(userService.register(duplicateUser)).rejects.toThrow(ConflictError);
    });

    it('should reject duplicate username', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      await userService.register(userData);

      const duplicateUser = {
        username: 'testuser',
        email: 'test2@example.com',
        password: 'password123'
      };

      await expect(userService.register(duplicateUser)).rejects.toThrow(ConflictError);
    });

    it('should set default preferences', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const result = await userService.register(userData);

      expect(result.user.preferences).toBeDefined();
      expect(result.user.preferences.theme).toBe('light');
      expect(result.user.preferences.language).toBe('en');
      expect(result.user.preferences.notifications).toBeDefined();
    });
  });

  describe('User Login', () => {
    beforeEach(async () => {
      // Create a test user
      await userService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });
    });

    it('should login successfully with valid credentials', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const result = await userService.login(credentials);

      expect(result.user.email).toBe(credentials.email);
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.passwordHash).toBeUndefined();
    });

    it('should update last login timestamp', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123'
      };

      const beforeLogin = new Date();
      await userService.login(credentials);
      
      const user = await userService.getUserByEmail(credentials.email);
      expect(user!.lastLogin).toBeDefined();
      expect(user!.lastLogin!.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
    });

    it('should reject login with invalid email', async () => {
      const credentials = {
        email: 'wrong@example.com',
        password: 'password123'
      };

      await expect(userService.login(credentials)).rejects.toThrow(AuthenticationError);
    });

    it('should reject login with invalid password', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      await expect(userService.login(credentials)).rejects.toThrow(AuthenticationError);
    });

    it('should reject login with missing credentials', async () => {
      const credentials = {
        email: '',
        password: 'password123'
      };

      await expect(userService.login(credentials)).rejects.toThrow(ValidationError);
    });
  });

  describe('Token Refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const result = await userService.register(userData);
      refreshToken = result.refreshToken;
    });

    it('should refresh token successfully', async () => {
      const result = await userService.refreshToken(refreshToken);

      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(refreshToken); // Should be new token
    });

    it('should blacklist old refresh token', async () => {
      await userService.refreshToken(refreshToken);

      // Try to use the same token again
      await expect(userService.refreshToken(refreshToken)).rejects.toThrow(AuthenticationError);
    });

    it('should reject invalid refresh token', async () => {
      await expect(userService.refreshToken('invalid-token')).rejects.toThrow(AuthenticationError);
    });

    it('should reject empty refresh token', async () => {
      await expect(userService.refreshToken('')).rejects.toThrow(ValidationError);
    });
  });

  describe('User Logout', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const result = await userService.register(userData);
      refreshToken = result.refreshToken;
    });

    it('should logout successfully', async () => {
      await expect(userService.logout(refreshToken)).resolves.not.toThrow();
    });

    it('should blacklist refresh token on logout', async () => {
      await userService.logout(refreshToken);

      // Try to use the token after logout
      await expect(userService.refreshToken(refreshToken)).rejects.toThrow(AuthenticationError);
    });

    it('should handle logout without refresh token', async () => {
      await expect(userService.logout('')).resolves.not.toThrow();
    });
  });

  describe('User Retrieval', () => {
    let userId: string;

    beforeEach(async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const result = await userService.register(userData);
      userId = result.user.id;
    });

    it('should get user by ID', async () => {
      const user = await userService.getUserById(userId);

      expect(user).toBeDefined();
      expect(user!.id).toBe(userId);
      expect(user!.username).toBe('testuser');
      expect(user!.email).toBe('test@example.com');
    });

    it('should get user by email', async () => {
      const user = await userService.getUserByEmail('test@example.com');

      expect(user).toBeDefined();
      expect(user!.id).toBe(userId);
      expect(user!.email).toBe('test@example.com');
    });

    it('should get user by username', async () => {
      const user = await userService.getUserByUsername('testuser');

      expect(user).toBeDefined();
      expect(user!.id).toBe(userId);
      expect(user!.username).toBe('testuser');
    });

    it('should return null for non-existent user', async () => {
      const user = await userService.getUserById('non-existent-id');
      expect(user).toBeNull();
    });

    it('should get all users', async () => {
      // Register another user
      await userService.register({
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'password123'
      });

      const users = await userService.getAllUsers();
      expect(users.length).toBeGreaterThanOrEqual(2); // Including default admin
    });
  });

  describe('User Updates', () => {
    let userId: string;

    beforeEach(async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const result = await userService.register(userData);
      userId = result.user.id;
    });

    it('should update user successfully', async () => {
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
      expect(updatedUser.preferences.notifications.email).toBe(false);
    });

    it('should reject update with duplicate email', async () => {
      // Create another user
      await userService.register({
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'password123'
      });

      const updates = {
        email: 'test2@example.com'
      };

      await expect(userService.updateUser(userId, updates)).rejects.toThrow(ConflictError);
    });

    it('should reject update with duplicate username', async () => {
      // Create another user
      await userService.register({
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'password123'
      });

      const updates = {
        username: 'testuser2'
      };

      await expect(userService.updateUser(userId, updates)).rejects.toThrow(ConflictError);
    });

    it('should reject update for non-existent user', async () => {
      const updates = {
        username: 'updateduser'
      };

      await expect(userService.updateUser('non-existent-id', updates)).rejects.toThrow(NotFoundError);
    });

    it('should update password successfully', async () => {
      const newPassword = 'newpassword123';
      
      await userService.updateUserPassword(userId, newPassword);

      // Verify new password works
      const loginResult = await userService.login({
        email: 'test@example.com',
        password: newPassword
      });

      expect(loginResult.user.id).toBe(userId);
    });

    it('should reject short password', async () => {
      await expect(userService.updateUserPassword(userId, '123')).rejects.toThrow(ValidationError);
    });

    it('should reject password update for non-existent user', async () => {
      await expect(userService.updateUserPassword('non-existent-id', 'newpassword123')).rejects.toThrow(NotFoundError);
    });
  });

  describe('User Deletion', () => {
    let userId: string;

    beforeEach(async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const result = await userService.register(userData);
      userId = result.user.id;
    });

    it('should delete user successfully', async () => {
      await userService.deleteUser(userId);

      const user = await userService.getUserById(userId);
      expect(user).toBeNull();

      const userByEmail = await userService.getUserByEmail('test@example.com');
      expect(userByEmail).toBeNull();

      const userByUsername = await userService.getUserByUsername('testuser');
      expect(userByUsername).toBeNull();
    });

    it('should reject deletion of non-existent user', async () => {
      await expect(userService.deleteUser('non-existent-id')).rejects.toThrow(NotFoundError);
    });
  });
});