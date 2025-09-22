export enum ErrorCode {
  // Authentication errors
  AUTHENTICATION_REQUIRED = 'AUTHENTICATION_REQUIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',
  
  // System errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // File/Storage errors
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',
  STORAGE_ERROR = 'STORAGE_ERROR'
}

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
    field?: string;
  };
  timestamp: string;
  requestId?: string;
  path?: string;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: any;
  public readonly field?: string;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    isOperational = true,
    details?: any,
    field?: string
  ) {
    super(message);
    
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    if (field !== undefined) {
      this.field = field;
    }

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, field?: string, details?: any) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, true, details, field);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', code: ErrorCode = ErrorCode.AUTHENTICATION_REQUIRED) {
    super(message, 401, code);
  }
}

export class PermissionError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, ErrorCode.PERMISSION_DENIED);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, ErrorCode.NOT_FOUND);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, ErrorCode.ALREADY_EXISTS);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, ErrorCode.INTERNAL_SERVER_ERROR, false);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503, ErrorCode.SERVICE_UNAVAILABLE);
  }
}