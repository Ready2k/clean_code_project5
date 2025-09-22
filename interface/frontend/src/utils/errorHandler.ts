import { AppError, ErrorType, APIError } from '../types/errors';

export class ErrorHandler {
  private static errorListeners: ((error: APIError) => void)[] = [];

  static addErrorListener(listener: (error: APIError) => void) {
    this.errorListeners.push(listener);
  }

  static removeErrorListener(listener: (error: APIError) => void) {
    const index = this.errorListeners.indexOf(listener);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  static handle(error: AppError | Error): APIError {
    let apiError: APIError;

    if (error instanceof AppError) {
      apiError = error.toAPIError();
    } else {
      apiError = {
        type: ErrorType.UNKNOWN_ERROR,
        message: error.message || 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        retryable: false
      };
    }

    // Log error
    console.error('Error handled:', apiError);

    // Notify listeners
    this.errorListeners.forEach(listener => {
      try {
        listener(apiError);
      } catch (e) {
        console.error('Error in error listener:', e);
      }
    });

    // Handle specific error types
    this.handleSpecificError(apiError);

    return apiError;
  }

  private static handleSpecificError(error: APIError) {
    switch (error.type) {
      case ErrorType.AUTHENTICATION_ERROR:
        // Redirect to login or refresh token
        this.handleAuthenticationError();
        break;
      
      case ErrorType.AUTHORIZATION_ERROR:
        // Show permission denied message
        this.showPermissionDenied();
        break;
      
      case ErrorType.OFFLINE_ERROR:
        // Show offline message
        this.showOfflineMessage();
        break;
      
      case ErrorType.RATE_LIMIT_ERROR:
        // Show rate limit message
        this.showRateLimitMessage();
        break;
    }
  }

  private static handleAuthenticationError() {
    // Clear stored tokens
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    
    // Redirect to login if not already there
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  private static showPermissionDenied() {
    // This could trigger a global notification
    console.warn('Permission denied - user lacks required permissions');
  }

  private static showOfflineMessage() {
    // This could trigger a global offline indicator
    console.warn('Application is offline');
  }

  private static showRateLimitMessage() {
    // This could trigger a global rate limit notification
    console.warn('Rate limit exceeded - please try again later');
  }

  static getErrorMessage(error: APIError): string {
    const errorMessages: Record<ErrorType, string> = {
      [ErrorType.NETWORK_ERROR]: 'Unable to connect to the server. Please check your internet connection.',
      [ErrorType.AUTHENTICATION_ERROR]: 'Your session has expired. Please log in again.',
      [ErrorType.AUTHORIZATION_ERROR]: 'You don\'t have permission to perform this action.',
      [ErrorType.VALIDATION_ERROR]: 'Please check your input and try again.',
      [ErrorType.NOT_FOUND_ERROR]: 'The requested resource was not found.',
      [ErrorType.SERVER_ERROR]: 'A server error occurred. Please try again later.',
      [ErrorType.TIMEOUT_ERROR]: 'The request timed out. Please try again.',
      [ErrorType.OFFLINE_ERROR]: 'You appear to be offline. Please check your connection.',
      [ErrorType.RATE_LIMIT_ERROR]: 'Too many requests. Please wait a moment before trying again.',
      [ErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
    };

    return error.message || errorMessages[error.type] || errorMessages[ErrorType.UNKNOWN_ERROR];
  }

  static getActionableMessage(error: APIError): string {
    const actionableMessages: Record<ErrorType, string> = {
      [ErrorType.NETWORK_ERROR]: 'Check your internet connection and try again.',
      [ErrorType.AUTHENTICATION_ERROR]: 'Please log in again to continue.',
      [ErrorType.AUTHORIZATION_ERROR]: 'Contact your administrator for access.',
      [ErrorType.VALIDATION_ERROR]: 'Please correct the highlighted fields.',
      [ErrorType.NOT_FOUND_ERROR]: 'The item may have been deleted or moved.',
      [ErrorType.SERVER_ERROR]: 'Our team has been notified. Please try again in a few minutes.',
      [ErrorType.TIMEOUT_ERROR]: 'Try again with a stable internet connection.',
      [ErrorType.OFFLINE_ERROR]: 'Reconnect to the internet to continue.',
      [ErrorType.RATE_LIMIT_ERROR]: 'Wait a few minutes before making more requests.',
      [ErrorType.UNKNOWN_ERROR]: 'Refresh the page or contact support if the problem persists.'
    };

    return actionableMessages[error.type] || actionableMessages[ErrorType.UNKNOWN_ERROR];
  }

  static isRetryable(error: APIError): boolean {
    return error.retryable || false;
  }
}