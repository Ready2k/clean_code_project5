export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  OFFLINE_ERROR = 'OFFLINE_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface APIError {
  type: ErrorType;
  message: string;
  code?: string | number;
  details?: any;
  timestamp: string;
  requestId?: string;
  retryable?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ErrorState {
  hasError: boolean;
  error: APIError | null;
  isRetrying: boolean;
  retryCount: number;
  lastRetryAt?: string;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: ErrorType[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryableErrors: [
    ErrorType.NETWORK_ERROR,
    ErrorType.TIMEOUT_ERROR,
    ErrorType.SERVER_ERROR,
    ErrorType.RATE_LIMIT_ERROR
  ]
};

export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly code?: string | number;
  public readonly details?: any;
  public readonly timestamp: string;
  public readonly retryable: boolean;

  constructor(
    type: ErrorType,
    message: string,
    code?: string | number,
    details?: any,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.retryable = retryable;
  }

  toAPIError(): APIError {
    return {
      type: this.type,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      retryable: this.retryable
    };
  }

  static fromResponse(response: Response, data?: any): AppError {
    let type: ErrorType;
    let retryable = false;

    switch (response.status) {
      case 401:
        type = ErrorType.AUTHENTICATION_ERROR;
        break;
      case 403:
        type = ErrorType.AUTHORIZATION_ERROR;
        break;
      case 404:
        type = ErrorType.NOT_FOUND_ERROR;
        break;
      case 422:
        type = ErrorType.VALIDATION_ERROR;
        break;
      case 429:
        type = ErrorType.RATE_LIMIT_ERROR;
        retryable = true;
        break;
      case 408:
        type = ErrorType.TIMEOUT_ERROR;
        retryable = true;
        break;
      default:
        if (response.status >= 500) {
          type = ErrorType.SERVER_ERROR;
          retryable = true;
        } else {
          type = ErrorType.UNKNOWN_ERROR;
        }
    }

    const message = data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`;
    
    return new AppError(type, message, response.status, data, retryable);
  }

  static fromNetworkError(error: Error): AppError {
    if (error.name === 'AbortError') {
      return new AppError(ErrorType.TIMEOUT_ERROR, 'Request timed out', 'TIMEOUT', error, true);
    }
    
    return new AppError(
      ErrorType.NETWORK_ERROR,
      'Network connection failed',
      'NETWORK_ERROR',
      error,
      true
    );
  }
}