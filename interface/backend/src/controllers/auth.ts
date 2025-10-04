import { Request, Response } from 'express';
import Joi from 'joi';
import { getUserService } from '../services/user-service.js';
import { LoginCredentials, RegisterData, RefreshTokenRequest } from '../types/auth.js';
import { ValidationError } from '../types/errors.js';
import { logger } from '../utils/logger.js';

const maskEmailForLogs = (email?: string): string | undefined => {
  if (!email) {
    return undefined;
  }

  const [localPart, domain] = email.split('@');
  if (!domain || !localPart) {
    if (!localPart) {
      return undefined;
    }
    return localPart.length <= 1 ? '*' : `${localPart[0]}***`;
  }

  if (localPart.length <= 1) {
    return `*@${domain}`;
  }

  if (localPart.length === 2) {
    return `${localPart[0]}*@${domain}`;
  }

  return `${localPart[0]}***${localPart.slice(-1)}@${domain}`;
};

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('user', 'viewer').optional()
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const updateProfileSchema = Joi.object({
  username: Joi.string().min(3).max(50).optional(),
  email: Joi.string().email().optional(),
  preferences: Joi.object({
    theme: Joi.string().valid('light', 'dark', 'auto').optional(),
    language: Joi.string().optional(),
    defaultProvider: Joi.string().optional(),
    notifications: Joi.object({
      email: Joi.boolean().optional(),
      browser: Joi.boolean().optional(),
      enhancement: Joi.boolean().optional(),
      system: Joi.boolean().optional()
    }).optional()
  }).optional()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

export const login = async (req: Request, res: Response): Promise<void> => {
  // Debug logging
  const maskedEmail = maskEmailForLogs(typeof req.body?.email === 'string' ? req.body.email : undefined);
  const hasPassword = typeof req.body?.password === 'string' && req.body.password.length > 0;

  logger.info('Login attempt', {
    email: maskedEmail,
    hasPassword,
    headers: req.headers['content-type']
  });

  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    logger.error('Login validation error', {
      error: error.details[0]?.message || 'Validation error',
      field: error.details[0]?.path?.[0] || 'unknown',
      email: maskedEmail,
      hasPassword
    });
    throw new ValidationError(error.details[0]?.message || 'Validation error', error.details[0]?.path?.[0] as string || 'unknown');
  }

  const credentials: LoginCredentials = value;
  const userService = getUserService();
  
  const authResponse = await userService.login(credentials);

  logger.info('User login successful', {
    userId: authResponse.user.id,
    email: maskEmailForLogs(authResponse.user.email),
    ip: req.ip
  });

  res.json({
    success: true,
    data: authResponse,
    timestamp: new Date().toISOString()
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0]?.message || 'Validation error', error.details[0]?.path?.[0] as string || 'unknown');
  }

  const registerData: RegisterData = value;
  const userService = getUserService();
  
  const authResponse = await userService.register(registerData);

  logger.info('User registration successful', {
    userId: authResponse.user.id,
    email: maskEmailForLogs(authResponse.user.email),
    ip: req.ip
  });

  res.status(201).json({
    success: true,
    data: authResponse,
    timestamp: new Date().toISOString()
  });
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = refreshTokenSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0]?.message || 'Validation error', error.details[0]?.path?.[0] as string || 'unknown');
  }

  const { refreshToken }: RefreshTokenRequest = value;
  const userService = getUserService();
  
  const authResponse = await userService.refreshToken(refreshToken);

  logger.info('Token refresh successful', { 
    userId: authResponse.user.id,
    ip: req.ip 
  });

  res.json({
    success: true,
    data: authResponse,
    timestamp: new Date().toISOString()
  });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.body.refreshToken;
  const userService = getUserService();
  
  await userService.logout(refreshToken);

  logger.info('User logout successful', { 
    userId: req.user?.userId,
    ip: req.ip 
  });

  res.json({
    success: true,
    message: 'Logged out successfully',
    timestamp: new Date().toISOString()
  });
};

export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const userService = getUserService();
  const user = await userService.getUserById(req.user.userId);
  
  if (!user) {
    throw new ValidationError('User not found');
  }

  // Remove password hash from response
  const { passwordHash, ...sanitizedUser } = user;

  res.json({
    success: true,
    data: sanitizedUser,
    timestamp: new Date().toISOString()
  });
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const { error, value } = updateProfileSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0]?.message || 'Validation error', error.details[0]?.path?.[0] as string || 'unknown');
  }

  const userService = getUserService();
  const updatedUser = await userService.updateUser(req.user.userId, value);

  logger.info('User profile updated', { 
    userId: req.user.userId,
    updatedFields: Object.keys(value),
    ip: req.ip 
  });

  // Remove password hash from response
  const { passwordHash, ...sanitizedUser } = updatedUser;

  res.json({
    success: true,
    data: sanitizedUser,
    timestamp: new Date().toISOString()
  });
};

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new ValidationError('User not authenticated');
  }

  const { error, value } = changePasswordSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0]?.message || 'Validation error', error.details[0]?.path?.[0] as string || 'unknown');
  }

  const { currentPassword, newPassword } = value;
  const userService = getUserService();
  
  // Verify current password
  const user = await userService.getUserById(req.user.userId);
  if (!user) {
    throw new ValidationError('User not found');
  }

  const bcrypt = await import('bcrypt');
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentPasswordValid) {
    throw new ValidationError('Current password is incorrect', 'currentPassword');
  }

  await userService.updateUserPassword(req.user.userId, newPassword);

  logger.info('User password changed', { 
    userId: req.user.userId,
    ip: req.ip 
  });

  res.json({
    success: true,
    message: 'Password changed successfully',
    timestamp: new Date().toISOString()
  });
};