import path from 'path';
import { ValidationError } from '../types/errors.js';

/**
 * Validates and sanitizes log filenames to prevent path traversal attacks
 */
export function validateLogFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    throw new ValidationError('Filename must be a non-empty string');
  }

  // Check for path traversal attempts before sanitization
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new ValidationError('Path traversal attempts are not allowed');
  }

  // Remove control characters and null bytes
  const sanitized = filename
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .trim();

  if (!sanitized) {
    throw new ValidationError('Invalid filename after sanitization');
  }

  // Only allow alphanumeric characters, hyphens, underscores, dots, and common log extensions
  const allowedPattern = /^[a-zA-Z0-9_.-]+\.(log|txt)$/;
  if (!allowedPattern.test(sanitized)) {
    throw new ValidationError('Invalid log filename format. Only alphanumeric characters, hyphens, underscores, and .log/.txt extensions are allowed');
  }

  // Additional length check
  if (sanitized.length > 100) {
    throw new ValidationError('Filename too long (max 100 characters)');
  }

  return sanitized;
}

/**
 * Validates that the resolved file path is within the allowed logs directory
 */
export function validateLogPath(logsDir: string, filename: string): string {
  const sanitizedFilename = validateLogFilename(filename);
  
  // Resolve both paths to absolute paths
  const normalizedLogsDir = path.resolve(logsDir);
  const requestedPath = path.resolve(path.join(logsDir, sanitizedFilename));
  
  // Ensure the resolved path is within the logs directory
  if (!requestedPath.startsWith(normalizedLogsDir + path.sep) && requestedPath !== normalizedLogsDir) {
    throw new ValidationError('Access denied: Path outside logs directory');
  }
  
  return requestedPath;
}

/**
 * Get list of allowed log files in the logs directory
 */
export async function getAllowedLogFiles(logsDir: string): Promise<string[]> {
  try {
    const fs = await import('fs/promises');
    const files = await fs.readdir(logsDir);
    
    // Filter to only include valid log files
    return files.filter(file => {
      try {
        validateLogFilename(file);
        return true;
      } catch {
        return false;
      }
    });
  } catch (error) {
    // If directory doesn't exist or can't be read, return empty array
    return [];
  }
}