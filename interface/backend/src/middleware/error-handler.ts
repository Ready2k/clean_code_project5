import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode, ErrorResponse } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = uuidv4();
  
  // Log the error
  logger.error('Request error', {
    requestId,
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Handle known AppError instances
  if (error instanceof AppError) {
    const errorResponse: ErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
        ...(error.field && { field: error.field })
      },
      timestamp: new Date().toISOString(),
      requestId,
      path: req.path
    };

    res.status(error.statusCode).json(errorResponse);
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    const errorResponse: ErrorResponse = {
      error: {
        code: ErrorCode.TOKEN_INVALID,
        message: 'Invalid token'
      },
      timestamp: new Date().toISOString(),
      requestId,
      path: req.path
    };

    res.status(401).json(errorResponse);
    return;
  }

  if (error.name === 'TokenExpiredError') {
    const errorResponse: ErrorResponse = {
      error: {
        code: ErrorCode.TOKEN_EXPIRED,
        message: 'Token has expired'
      },
      timestamp: new Date().toISOString(),
      requestId,
      path: req.path
    };

    res.status(401).json(errorResponse);
    return;
  }

  // Handle validation errors (Joi)
  if (error.name === 'ValidationError') {
    const errorResponse: ErrorResponse = {
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details: (error as any).details
      },
      timestamp: new Date().toISOString(),
      requestId,
      path: req.path
    };

    res.status(400).json(errorResponse);
    return;
  }

  // Handle database errors
  if (error.message.includes('database') || error.message.includes('connection')) {
    const errorResponse: ErrorResponse = {
      error: {
        code: ErrorCode.DATABASE_ERROR,
        message: 'Database operation failed'
      },
      timestamp: new Date().toISOString(),
      requestId,
      path: req.path
    };

    res.status(500).json(errorResponse);
    return;
  }

  // Handle syntax errors in JSON
  if (error instanceof SyntaxError && 'body' in error) {
    const errorResponse: ErrorResponse = {
      error: {
        code: ErrorCode.INVALID_INPUT,
        message: 'Invalid JSON in request body'
      },
      timestamp: new Date().toISOString(),
      requestId,
      path: req.path
    };

    res.status(400).json(errorResponse);
    return;
  }

  // Default error response for unknown errors
  const errorResponse: ErrorResponse = {
    error: {
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      message: process.env['NODE_ENV'] === 'production' 
        ? 'An unexpected error occurred' 
        : error.message
    },
    timestamp: new Date().toISOString(),
    requestId,
    path: req.path
  };

  res.status(500).json(errorResponse);
};

// Async error wrapper to catch async errors in route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};