import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User, RegisterData, LoginCredentials, AuthResponse, UserPreferences, JWTPayload } from '../types/auth.js';
import { ValidationError, AuthenticationError, ConflictError, NotFoundError, ErrorCode } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import { RedisService } from './redis-service.js';

export class UserService {
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, string> = new Map();
  private usersByUsername: Map<string, string> = new Map();
  private redisService: RedisService;
  private readonly saltRounds = 12;
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshTokenExpiresIn: string;

  constructor(redisService: RedisService) {
    this.redisService = redisService;
    this.jwtSecret = process.env['JWT_SECRET'] || 'your-secret-key';
    this.jwtExpiresIn = process.env['JWT_EXPIRES_IN'] || '15m';
    this.refreshTokenExpiresIn = process.env['REFRESH_TOKEN_EXPIRES_IN'] || '7d';
    
    if (!process.env['JWT_SECRET']) {
      logger.warn('JWT_SECRET not set in environment variables, using default (not secure for production)');
    }

    // Initialize with default admin user if no users exist
    this.initializeDefaultUser();
  }

  private async initializeDefaultUser(): Promise<void> {
    try {
      // Check if any users exist
      if (this.users.size === 0) {
        const defaultAdmin: RegisterData = {
          username: 'admin',
          email: 'admin@promptlibrary.local',
          password: 'admin123',
          role: 'user' // Will be set to admin below
        };

        const adminUser = await this.createUser(defaultAdmin, true);
        adminUser.role = 'admin'; // Set as admin after creation
        this.users.set(adminUser.id, adminUser);
        
        logger.info('Default admin user created', { 
          username: adminUser.username, 
          email: adminUser.email 
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

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    const userId = this.usersByEmail.get(email.toLowerCase());
    if (!userId) {
      throw new AuthenticationError('Invalid credentials', ErrorCode.INVALID_CREDENTIALS);
    }

    const user = this.users.get(userId);
    if (!user) {
      throw new AuthenticationError('Invalid credentials', ErrorCode.INVALID_CREDENTIALS);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials', ErrorCode.INVALID_CREDENTIALS);
    }

    // Update last login
    user.lastLogin = new Date();
    user.updatedAt = new Date();

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

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const basePayload: Omit<JWTPayload, 'iat' | 'exp' | 'permissions'> = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    // Add a small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1));

    const accessToken = jwt.sign(basePayload, this.jwtSecret, { 
      expiresIn: this.jwtExpiresIn 
    });

    // Add different jti (JWT ID) to ensure tokens are unique
    const refreshPayload = {
      ...basePayload,
      jti: `${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    const refreshToken = jwt.sign(refreshPayload, this.jwtSecret, { 
      expiresIn: this.refreshTokenExpiresIn 
    });

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

    const value = parseInt(match[1]);
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

export async function initializeUserService(redisService: RedisService): Promise<UserService> {
  if (!userServiceInstance) {
    userServiceInstance = new UserService(redisService);
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