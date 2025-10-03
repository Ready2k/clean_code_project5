import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError, PermissionError, ErrorCode } from '../types/errors.js';
import { JWTPayload, Permission, ROLE_PERMISSIONS } from '../types/auth.js';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authenticateToken = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    throw new AuthenticationError('Access token required', ErrorCode.AUTHENTICATION_REQUIRED);
  }

  try {
    const jwtSecret = process.env['JWT_SECRET'] || 'your-secret-key';
    
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
    // Add user permissions based on role
    decoded.permissions = ROLE_PERMISSIONS[decoded.role] || [];
    
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token', ErrorCode.TOKEN_INVALID);
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token expired', ErrorCode.TOKEN_EXPIRED);
    }
    throw new AuthenticationError('Authentication failed', ErrorCode.TOKEN_INVALID);
  }
};

export const requirePermission = (permission: Permission) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    if (!req.user.permissions.includes(permission)) {
      throw new PermissionError(`Permission required: ${permission}`);
    }

    next();
  };
};

export const requireRole = (roles: string | string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthenticationError('Authentication required');
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      throw new PermissionError(`Role required: ${allowedRoles.join(' or ')}`);
    }

    next();
  };
};

export const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const jwtSecret = process.env['JWT_SECRET'];
    if (!jwtSecret) {
      return next();
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    decoded.permissions = ROLE_PERMISSIONS[decoded.role] || [];
    req.user = decoded;
  } catch (error) {
    // Ignore token errors for optional auth
  }

  next();
};

export const validateAdminAccess = (req: Request): void => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }

  if (req.user.role !== 'admin') {
    throw new PermissionError('Admin access required');
  }
};