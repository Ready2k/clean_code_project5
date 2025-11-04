import { Request, Response, NextFunction } from 'express';
import { AuthenticationError, PermissionError } from '../types/errors.js';
import { Permission } from '../types/auth.js';

/**
 * Template-specific authentication middleware
 * Provides granular access control for template management operations
 */

export const requireTemplateRead = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required for template access');
  }

  if (!req.user.permissions.includes(Permission.READ_TEMPLATES)) {
    throw new PermissionError('Permission required: read templates');
  }

  next();
};

export const requireTemplateWrite = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required for template modification');
  }

  if (!req.user.permissions.includes(Permission.WRITE_TEMPLATES)) {
    throw new PermissionError('Permission required: write templates');
  }

  next();
};

export const requireTemplateDelete = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required for template deletion');
  }

  if (!req.user.permissions.includes(Permission.DELETE_TEMPLATES)) {
    throw new PermissionError('Permission required: delete templates');
  }

  next();
};

export const requireTemplateTest = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required for template testing');
  }

  if (!req.user.permissions.includes(Permission.TEST_TEMPLATES)) {
    throw new PermissionError('Permission required: test templates');
  }

  next();
};

export const requireTemplateVersionManagement = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required for template version management');
  }

  if (!req.user.permissions.includes(Permission.MANAGE_TEMPLATE_VERSIONS)) {
    throw new PermissionError('Permission required: manage template versions');
  }

  next();
};

export const requireTemplateAnalytics = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required for template analytics');
  }

  if (!req.user.permissions.includes(Permission.VIEW_TEMPLATE_ANALYTICS)) {
    throw new PermissionError('Permission required: view template analytics');
  }

  next();
};

/**
 * Validates template ownership or admin access
 * Allows users to modify their own templates or admins to modify any template
 */
export const validateTemplateOwnership = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }

  // Admins can access any template
  if (req.user.role === 'admin') {
    return next();
  }

  // For non-admins, check if they have write permissions and are accessing their own templates
  if (!req.user.permissions.includes(Permission.WRITE_TEMPLATES)) {
    throw new PermissionError('Insufficient permissions for template modification');
  }

  // Template ownership validation will be handled in the service layer
  // where we can access the template data
  next();
};

/**
 * Audit logging middleware for template operations
 * Logs all template-related actions for security monitoring
 */
export const auditTemplateOperation = (operation: string) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user) {
      // Log the operation with user context
      console.log(`[TEMPLATE_AUDIT] ${new Date().toISOString()} - User: ${req.user.userId} (${req.user.role}) - Operation: ${operation} - IP: ${req.ip} - UserAgent: ${req.get('User-Agent')}`);
      
      // Add audit context to request for downstream logging
      req.auditContext = {
        operation,
        userId: req.user.userId,
        userRole: req.user.role,
        timestamp: new Date(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };
    }
    
    next();
  };
};

/**
 * Rate limiting for template operations to prevent abuse
 */
export const templateRateLimit = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next();
    }

    const key = `${req.user.userId}:${req.route?.path || req.path}`;
    const now = Date.now();
    const userRequests = requests.get(key);

    if (!userRequests || now > userRequests.resetTime) {
      requests.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (userRequests.count >= maxRequests) {
      throw new PermissionError(`Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs / 1000} seconds.`);
    }

    userRequests.count++;
    next();
  };
};

// Extend Request interface to include audit context
declare global {
  namespace Express {
    interface Request {
      auditContext?: {
        operation: string;
        userId: string;
        userRole: string;
        timestamp: Date;
        ip?: string;
        userAgent?: string;
      };
    }
  }
}