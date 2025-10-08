import { Request, Response } from 'express';
import Joi from 'joi';
import { getUserService } from '../services/user-service.js';
import { RegisterData } from '../types/auth.js';
import { ValidationError, NotFoundError } from '../types/errors.js';
import { logger } from '../utils/logger.js';

// Validation schemas
const createUserSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('admin', 'user', 'viewer').required(),
  status: Joi.string().valid('active', 'inactive').optional().default('active')
});

const updateUserSchema = Joi.object({
  username: Joi.string().min(3).max(50).optional(),
  email: Joi.string().email().optional(),
  role: Joi.string().valid('admin', 'user', 'viewer').optional(),
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

const updateRoleSchema = Joi.object({
  role: Joi.string().valid('admin', 'user', 'viewer').required()
});

const resetPasswordSchema = Joi.object({
  newPassword: Joi.string().min(6).required()
});

export const getUsers = async (req: Request, res: Response): Promise<void> => {
  const userService = getUserService();
  const users = await userService.getAllUsers();

  // Remove password hashes from response
  const sanitizedUsers = users.map(user => {
    const { passwordHash, ...sanitizedUser } = user;
    return sanitizedUser;
  });

  logger.info('Users retrieved by admin', { 
    adminId: req.user?.userId,
    userCount: users.length,
    ip: req.ip 
  });

  res.json({
    success: true,
    data: sanitizedUsers,
    timestamp: new Date().toISOString()
  });
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  const { error, value } = createUserSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0]?.message || 'Validation error', error.details[0]?.path?.[0] as string || 'unknown');
  }

  const userData: RegisterData = {
    username: value.username,
    email: value.email,
    password: value.password,
    role: value.role,
    status: value.status
  };
  const userService = getUserService();
  
  // Create user without generating tokens (admin creation)
  const user = await userService.register(userData);

  logger.info('User created by admin', { 
    adminId: req.user?.userId,
    createdUserId: user.user.id,
    createdUserEmail: user.user.email,
    role: user.user.role,
    ip: req.ip 
  });

  res.status(201).json({
    success: true,
    data: user.user, // Only return user data, not tokens
    timestamp: new Date().toISOString()
  });
};

export const getUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  
  if (!id) {
    throw new ValidationError('User ID is required');
  }

  const userService = getUserService();
  const user = await userService.getUserById(id);
  
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Remove password hash from response
  const { passwordHash, ...sanitizedUser } = user;

  logger.info('User retrieved by admin', { 
    adminId: req.user?.userId,
    retrievedUserId: id,
    ip: req.ip 
  });

  res.json({
    success: true,
    data: sanitizedUser,
    timestamp: new Date().toISOString()
  });
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  
  if (!id) {
    throw new ValidationError('User ID is required');
  }

  const { error, value } = updateUserSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0]?.message || 'Validation error', error.details[0]?.path?.[0] as string || 'unknown');
  }

  const userService = getUserService();
  const updatedUser = await userService.updateUser(id, value);

  logger.info('User updated by admin', { 
    adminId: req.user?.userId,
    updatedUserId: id,
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

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  
  if (!id) {
    throw new ValidationError('User ID is required');
  }

  // Prevent admin from deleting themselves
  if (req.user?.userId === id) {
    throw new ValidationError('Cannot delete your own account');
  }

  const userService = getUserService();
  await userService.deleteUser(id);

  logger.info('User deleted by admin', { 
    adminId: req.user?.userId,
    deletedUserId: id,
    ip: req.ip 
  });

  res.json({
    success: true,
    message: 'User deleted successfully',
    timestamp: new Date().toISOString()
  });
};

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  
  if (!id) {
    throw new ValidationError('User ID is required');
  }

  const { error, value } = updateRoleSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0]?.message || 'Validation error', error.details[0]?.path?.[0] as string || 'unknown');
  }

  // Prevent admin from changing their own role
  if (req.user?.userId === id) {
    throw new ValidationError('Cannot change your own role');
  }

  const userService = getUserService();
  const updatedUser = await userService.updateUser(id, { role: value.role });

  logger.info('User role updated by admin', { 
    adminId: req.user?.userId,
    updatedUserId: id,
    newRole: value.role,
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

export const updateUserStatus = async (req: Request, res: Response): Promise<void> => {
  // Removed placeholder implementation - add back if user status management is needed
  const { id } = req.params;
  
  if (!id) {
    throw new ValidationError('User ID is required');
  }

  // Return not implemented for now
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED', 
      message: 'User status management not implemented'
    }
  });
};

export const resetUserPassword = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  
  if (!id) {
    throw new ValidationError('User ID is required');
  }

  const { error, value } = resetPasswordSchema.validate(req.body);
  if (error) {
    throw new ValidationError(error.details[0]?.message || 'Validation error', error.details[0]?.path?.[0] as string || 'unknown');
  }

  const userService = getUserService();
  await userService.updateUserPassword(id, value.newPassword);

  logger.info('User password reset by admin', { 
    adminId: req.user?.userId,
    targetUserId: id,
    ip: req.ip 
  });

  res.json({
    success: true,
    message: 'Password reset successfully',
    timestamp: new Date().toISOString()
  });
};

// Removed unused admin monitoring endpoints:
// - getAuditLogs: No frontend or tests use this endpoint
// - getSystemUsage: No frontend or tests use this endpoint  
// - getSystemErrors: No frontend or tests use this endpoint
// These were placeholder implementations that should be added back if needed