// Error handling types

export interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, any>;
  suggestions?: string[];
  retryable: boolean;
}

export class PromptLibraryError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'PromptLibraryError';
  }
}

export class ValidationError extends PromptLibraryError {
  constructor(message: string, details?: Record<string, any>) {
    super('VALIDATION_ERROR', message, details, false);
    this.name = 'ValidationError';
  }
}

export class StorageError extends PromptLibraryError {
  constructor(message: string, details?: Record<string, any>, retryable: boolean = true) {
    super('STORAGE_ERROR', message, details, retryable);
    this.name = 'StorageError';
  }
}

export class EnhancementError extends PromptLibraryError {
  constructor(message: string, details?: Record<string, any>, retryable: boolean = true) {
    super('ENHANCEMENT_ERROR', message, details, retryable);
    this.name = 'EnhancementError';
  }
}

export class ProviderError extends PromptLibraryError {
  constructor(message: string, details?: Record<string, any>, retryable: boolean = false) {
    super('PROVIDER_ERROR', message, details, retryable);
    this.name = 'ProviderError';
  }
}