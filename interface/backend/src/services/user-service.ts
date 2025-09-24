import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User, RegisterData, LoginCredentials, AuthResponse, JWTPayload } from '../types/auth.js';
import { ValidationError, AuthenticationError, ConflictError, NotFoundError, ErrorCode } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import { RedisService } from './redis-service.js';
import fs from 'fs/promises';
import path from 'path';
import * as YAML from 'yaml';

export class UserService {
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, string> = new Map();
  private usersByUsername: Map<string, string> = new Map();
  private redisService: RedisService;
  private readonly saltRounds = 12;
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;
  private readonly storageDir: string;

  constructor(redisService: RedisService, storageDir?: string) {
    this.redisService = redisService;
    this.jwtSecret = process.env['JWT_SECRET'] || 'your-secret-key';
    this.jwtExpiresIn = process.env['JWT_EXPIRES_IN'] || '15m';
    this.refreshTokenExpiresIn = process.env['REFRESH_TOKEN_EXPIRES_IN'] || '7d';
    this.storageDir = storageDir || path.resolve(process.cwd(), 'data/users');
    
    if (!process.env['JWT_SECRET']) {
      logger.warn('JWT_SECRET not set in environment variables, using default (not secure for production)');
    }

    // Initialize storage and load users
    this.initializeStorage();
  }

  /**
   * Initialize storage and load users from files
   */
  private async initializeStorage(): Promise<void> {
    try {
      // Create storage directory if it doesn't exist
      await fs.mkdir(this.storageDir, { recursive: true });
      
      // Load existing users from files
      await this.loadUsersFromFiles();
      
      // Initialize with default admin user if no users exist
      await this.initializeDefaultUser();
    } catch (error) {
      logger.error('Failed to initialize user storage:', error);
    }
  }

  /**
   * Save a user to file
   */
  private async saveUserToFile(user: User): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, `${user.id}.yaml`);
      const yamlContent = YAML.stringify(user);
      await fs.writeFile(filePath, yamlContent, 'utf-8');
      logger.debug('User saved to file', { userId: user.id, filePath });
    } catch (error) {
      logger.error('Failed to save user to file', { userId: user.id, error });
      throw error;
    }
  }

  /**
   * Load users from files
   */
  private async loadUsersFromFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir);
      const yamlFiles = files.filter(file => file.endsWith('.yaml'));
      
      logger.info('Loading users from files', { fileCount: yamlFiles.length });
      
      for (const file of yamlFiles) {
        try {
          const filePath = path.join(this.storageDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const user = YAML.parse(content) as User;
          
          // Validate that the user has required fields
          if (user.id && user.username && user.email && user.passwordHash) {
            // Convert date strings back to Date objects
            user.createdAt = new Date(user.createdAt);
            user.updatedAt = new Date(user.updatedAt);
            if (user.lastLogin) {
              user.lastLogin = new Date(user.lastLogin);
            }
            
            this.users.set(user.id, user);
            this.usersByEmail.set(user.email.toLowerCase(), user.id);
            this.usersByUsername.set(user.username.toLowerCase(), user.id);
            
            logger.debug('Loaded user from file', { userId: user.id, username: user.username });
          } else {
            logger.warn('Invalid user structure in file', { 
              file, 
              hasId: !!user.id, 
              hasUsername: !!user.username, 
              hasEmail: !!user.email,
              hasPasswordHash: !!user.passwordHash
            });
          }
        } catch (error) {
          logger.error('Failed to load user from file', { file, error });
        }
      }
      
      logger.info('Finished loading users from files', { 
        totalLoaded: this.users.size 
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('No existing users directory found, starting with empty collection');
      } else {
        logger.error('Failed to load users from files', { error });
        throw error;
      }
    }
  }

  /**
   * Delete user file
   */
  private async deleteUserFile(userId: string): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, `${userId}.yaml`);
      await fs.unlink(filePath);
      logger.debug('User file deleted', { userId, filePath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('User file not found, nothing to delete', { userId });
      } else {
        logger.error('Failed to delete user file', { userId, error });
        throw error;
      }
    }
  }

  private async initializeDefaultUser(): Promise<void> {
    try {
      // Check if admin user exists
      const existingAdmin = await this.getUserByUsername('admin');
      
      if (!existingAdmin) {
        logger.info('No admin user found, creating default admin user');
        
        const defaultAdmin: RegisterData = {
          username: 'admin',
          email: 'admin@example.com',
          password: 'admin123456',
          role: 'user' // Will be set to admin below
        };

        const adminUser = await this.createUser(defaultAdmin, true);
        adminUser.role = 'admin'; // Set as admin after creation
        this.users.set(adminUser.id, adminUser);
        
        // Save the updated admin user with admin role
        await this.saveUserToFile(adminUser);
        
        logger.info('Default admin user created successfully', { 
          id: adminUser.id,
          username: adminUser.username, 
          email: adminUser.email,
          role: adminUser.role,
          totalUsers: this.users.size
        });
      } else {
        // Ensure existing admin user has admin role
        if (existingAdmin.role !== 'admin') {
          logger.info('Upgrading existing admin user to admin role');
          existingAdmin.role = 'admin';
          existingAdmin.updatedAt = new Date();
          this.users.set(existingAdmin.id, existingAdmin);
          await this.saveUserToFile(existingAdmin);
        }
        
        logger.info('Admin user already exists', {
          adminId: existingAdmin.id,
          role: existingAdmin.role,
          totalUsers: this.users.size
        });
      }
    } catch (error) {
      logger.error('Failed to initialize default user:', error);
    }
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    await this.validateRegistrationData(data);

    const user = await this.createUser(data);
    const tokens = await this.generateTokens(user);

    logger.info('User registered successfully', { 
      userId: user.id, 
      username: user.username, 
      email: user.email 
    });

    return {
      user: this.sanitizeUser(user),
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.parseExpiresIn(this.jwtExpiresIn)
    };
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { email, password } = credentials;

    logger.info('Login attempt', { 
      email, 
      passwordLength: password?.length,
      totalUsers: this.users.size,
      emailsInIndex: Array.from(this.usersByEmail.keys())
    });

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const userId = this.usersByEmail.get(email.toLowerCase());
    if (!userId) {
      logger.warn('User not found by email', { 
        email: email.toLowerCase(),
        availableEmails: Array.from(this.usersByEmail.keys())
      });
      throw new AuthenticationError('Invalid credentials', ErrorCode.INVALID_CREDENTIALS);
    }

    const user = this.users.get(userId);
    if (!user) {
      logger.warn('User not found by ID', { userId });
      throw new AuthenticationError('Invalid credentials', ErrorCode.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      logger.warn('Invalid password', { userId: user.id, email: user.email });
      throw new AuthenticationError('Invalid credentials', ErrorCode.INVALID_CREDENTIALS);
    }

    // Update last login
    user.lastLogin = new Date();
    user.updatedAt = new Date();

    // Save updated user to file
    try {
      await this.saveUserToFile(user);
    } catch (error) {
      logger.warn('Failed to save user login update to file', { userId: user.id, error });
    }

    const tokens = await this.generateTokens(user);

    logger.info('User logged in successfully', { 
      userId: user.id, 
      username: user.username, 
      email: user.email 
    });

    return {
      user: this.sanitizeUser(user),
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: this.parseExpiresIn(this.jwtExpiresIn)
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    if (!refreshToken) {
      throw new ValidationError('Refresh token is required');
    }

    // Check if refresh token is blacklisted
    const isBlacklisted = await this.redisService.get(`blacklist:${refreshToken}`);
    if (isBlacklisted) {
      throw new AuthenticationError('Invalid refresh token', ErrorCode.TOKEN_INVALID);
    }

    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret) as JWTPayload;
      const user = this.users.get(decoded.userId);
      
      if (!user) {
        throw new AuthenticationError('User not found', ErrorCode.TOKEN_INVALID);
      }

      // Blacklist the old refresh token
      await this.redisService.setex(
        `blacklist:${refreshToken}`, 
        this.parseExpiresIn(this.refreshTokenExpiresIn), 
        'true'
      );

      const tokens = await this.generateTokens(user);

      logger.info('Token refreshed successfully', { 
        userId: user.id, 
        username: user.username 
      });

      return {
        user: this.sanitizeUser(user),
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: this.parseExpiresIn(this.jwtExpiresIn)
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid refresh token', ErrorCode.TOKEN_INVALID);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Refresh token expired', ErrorCode.TOKEN_EXPIRED);
      }
      throw error;
    }
  }

  async logout(refreshToken: string): Promise<void> {
    if (refreshToken) {
      // Blacklist the refresh token
      await this.redisService.setex(
        `blacklist:${refreshToken}`, 
        this.parseExpiresIn(this.refreshTokenExpiresIn), 
        'true'
      );
    }

    logger.info('User logged out successfully');
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const userId = this.usersByEmail.get(email.toLowerCase());
    return userId ? this.users.get(userId) || null : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const userId = this.usersByUsername.get(username.toLowerCase());
    return userId ? this.users.get(userId) || null : null;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Validate email uniqueness if being updated
    if (updates.email && updates.email !== user.email) {
      const existingUser = await this.getUserByEmail(updates.email);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictError('Email already in use');
      }
    }

    // Validate username uniqueness if being updated
    if (updates.username && updates.username !== user.username) {
      const existingUser = await this.getUserByUsername(updates.username);
      if (existingUser && existingUser.id !== id) {
        throw new ConflictError('Username already in use');
      }
    }

    // Update indexes if email or username changed
    if (updates.email && updates.email !== user.email) {
      this.usersByEmail.delete(user.email.toLowerCase());
      this.usersByEmail.set(updates.email.toLowerCase(), id);
    }

    if (updates.username && updates.username !== user.username) {
      this.usersByUsername.delete(user.username.toLowerCase());
      this.usersByUsername.set(updates.username.toLowerCase(), id);
    }

    // Update user
    const updatedUser = {
      ...user,
      ...updates,
      id, // Ensure ID cannot be changed
      updatedAt: new Date()
    };

    this.users.set(id, updatedUser);

    // Save updated user to file
    await this.saveUserToFile(updatedUser);

    logger.info('User updated successfully', { 
      userId: id, 
      updatedFields: Object.keys(updates) 
    });

    return updatedUser;
  }

  async updateUserPassword(id: string, newPassword: string): Promise<void> {
    const user = this.users.get(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long');
    }

    const passwordHash = await bcrypt.hash(newPassword, this.saltRounds);
    
    const updatedUser = {
      ...user,
      passwordHash,
      updatedAt: new Date()
    };

    this.users.set(id, updatedUser);

    // Save updated user to file
    await this.saveUserToFile(updatedUser);

    logger.info('User password updated successfully', { userId: id });
  }

  async deleteUser(id: string): Promise<void> {
    const user = this.users.get(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Remove from indexes
    this.usersByEmail.delete(user.email.toLowerCase());
    this.usersByUsername.delete(user.username.toLowerCase());
    
    // Remove user
    this.users.delete(id);

    // Delete user file
    await this.deleteUserFile(id);

    logger.info('User deleted successfully', { 
      userId: id, 
      username: user.username, 
      email: user.email 
    });
  }

  private async createUser(data: RegisterData, skipValidation = false): Promise<User> {
    if (!skipValidation) {
      await this.validateRegistrationData(data);
    }

    const passwordHash = await bcrypt.hash(data.password, this.saltRounds);
    const now = new Date();

    const user: User = {
      id: uuidv4(),
      username: data.username,
      email: data.email.toLowerCase(),
      role: data.role || 'user',
      passwordHash,
      createdAt: now,
      updatedAt: now,
      preferences: {
        theme: 'light',
        language: 'en',
        notifications: {
          email: true,
          browser: true,
          enhancement: true,
          system: true
        }
      }
    };

    // Add to storage and indexes
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user.id);
    this.usersByUsername.set(user.username.toLowerCase(), user.id);

    // Save user to file
    await this.saveUserToFile(user);

    return user;
  }

  private async validateRegistrationData(data: RegisterData): Promise<void> {
    const { username, email, password } = data;

    if (!username || username.length < 3) {
      throw new ValidationError('Username must be at least 3 characters long', 'username');
    }

    if (!email || !this.isValidEmail(email)) {
      throw new ValidationError('Valid email address is required', 'email');
    }

    if (!password || password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters long', 'password');
    }

    // Check for existing email
    const existingUserByEmail = await this.getUserByEmail(email);
    if (existingUserByEmail) {
      throw new ConflictError('Email already in use');
    }

    // Check for existing username
    const existingUserByUsername = await this.getUserByUsername(username);
    if (existingUserByUsername) {
      throw new ConflictError('Username already in use');
    }
  }

  /**
   * Get permissions for a user role
   */
  private getPermissionsForRole(role: string): string[] {
    switch (role) {
      case 'admin':
        return [
          'read:prompts',
          'write:prompts',
          'delete:prompts',
          'enhance:prompts',
          'rate:prompts',
          'export:prompts',
          'admin:users',
          'system:config',
          'view:system'
        ];
      case 'user':
        return [
          'read:prompts',
          'write:prompts',
          'delete:prompts',
          'enhance:prompts',
          'rate:prompts',
          'export:prompts'
        ];
      case 'viewer':
        return [
          'read:prompts',
          'rate:prompts'
        ];
      default:
        return ['read:prompts'];
    }
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const permissions = this.getPermissionsForRole(user.role);
    
    const basePayload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions
    };

    // Add a small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1));

    const accessToken = jwt.sign(basePayload, this.jwtSecret, { 
      expiresIn: this.jwtExpiresIn 
    } as jwt.SignOptions);

    // Add different jti (JWT ID) to ensure tokens are unique
    const refreshPayload = {
      ...basePayload,
      jti: `${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    const refreshToken = jwt.sign(refreshPayload, this.jwtSecret, { 
      expiresIn: this.refreshTokenExpiresIn 
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private parseExpiresIn(expiresIn: string): number {
    // Convert JWT expiration string to seconds
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default 15 minutes

    const value = parseInt(match[1] || '0');
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: return 900;
    }
  }
}

// Singleton instance
let userServiceInstance: UserService | null = null;

export async function initializeUserService(redisService: RedisService, storageDir?: string): Promise<UserService> {
  if (!userServiceInstance) {
    userServiceInstance = new UserService(redisService, storageDir);
    logger.info('User service initialized');
  }
  return userServiceInstance;
}

export function getUserService(): UserService {
  if (!userServiceInstance) {
    throw new Error('User service not initialized. Call initializeUserService first.');
  }
  return userServiceInstance;
}