import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../types/errors.js';

/**
 * Validate log entry structure and content
 */
export const validateLogEntry = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const logEntry = req.body;

    // Check if body exists
    if (!logEntry || typeof logEntry !== 'object') {
      throw new ValidationError('Request body must be a valid JSON object');
    }

    // Required fields validation
    if (!logEntry.timestamp || !logEntry.level || !logEntry.message) {
      throw new ValidationError('Missing required fields: timestamp, level, message');
    }

    // Validate timestamp
    if (typeof logEntry.timestamp !== 'string' || isNaN(Date.parse(logEntry.timestamp))) {
      throw new ValidationError('Invalid timestamp format');
    }

    // Validate log level
    const validLevels = ['error', 'warn', 'info', 'debug'];
    if (typeof logEntry.level !== 'string' || !validLevels.includes(logEntry.level.toLowerCase())) {
      throw new ValidationError('Invalid log level. Must be one of: error, warn, info, debug');
    }

    // Validate message length and content
    if (typeof logEntry.message !== 'string') {
      throw new ValidationError('Message must be a string');
    }

    if (logEntry.message.length > 2000) {
      throw new ValidationError('Log message too long (max 2000 characters)');
    }

    // Sanitize message - remove potentially dangerous characters
    logEntry.message = logEntry.message
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .substring(0, 2000); // Ensure length limit

    // Validate optional fields
    if (logEntry.source && typeof logEntry.source !== 'string') {
      throw new ValidationError('Source must be a string');
    }

    if (logEntry.category && typeof logEntry.category !== 'string') {
      throw new ValidationError('Category must be a string');
    }

    // Limit source and category length
    if (logEntry.source && logEntry.source.length > 100) {
      logEntry.source = logEntry.source.substring(0, 100);
    }

    if (logEntry.category && logEntry.category.length > 100) {
      logEntry.category = logEntry.category.substring(0, 100);
    }

    // Validate metadata if present
    if (logEntry.metadata && typeof logEntry.metadata !== 'object') {
      throw new ValidationError('Metadata must be an object');
    }

    // Limit metadata size
    if (logEntry.metadata) {
      const metadataString = JSON.stringify(logEntry.metadata);
      if (metadataString.length > 1000) {
        throw new ValidationError('Metadata too large (max 1000 characters when serialized)');
      }
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to validate log entry'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
};

/**
 * Validate batch log entries
 */
export const validateBatchLogEntries = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { logs } = req.body;

    if (!Array.isArray(logs)) {
      throw new ValidationError('Logs must be an array');
    }

    if (logs.length === 0) {
      throw new ValidationError('Logs array cannot be empty');
    }

    if (logs.length > 50) {
      throw new ValidationError('Too many log entries in batch (max 50)');
    }

    // Validate each log entry
    for (let i = 0; i < logs.length; i++) {
      const logEntry = logs[i];
      
      // Create a mock request object for individual validation
      const mockReq = { body: logEntry } as Request;
      const mockRes = {
        status: () => mockRes,
        json: (data: any) => {
          throw new ValidationError(`Invalid log entry at index ${i}: ${data.error?.message || 'Unknown error'}`);
        }
      } as Response;

      validateLogEntry(mockReq, mockRes, () => {});
    }

    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to validate batch log entries'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
};