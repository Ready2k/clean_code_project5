import axios, { AxiosInstance, AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios';
import { store } from '../../store';
import { clearCredentials, refreshToken } from '../../store/slices/authSlice';
import { addNotification } from '../../store/slices/uiSlice';
import { AppError, ErrorType } from '../../types/errors';
import { globalRetryMechanism } from '../../utils/retryMechanism';
import { rateLimitTracker } from '../../utils/rateLimitTracker';
import { ErrorHandler } from '../../utils/errorHandler';

interface RequestConfig extends AxiosRequestConfig {
  skipRetry?: boolean;
  skipErrorHandling?: boolean;
  retryConfig?: {
    maxRetries?: number;
    baseDelay?: number;
  };
}

class APIClientClass {
  private client: AxiosInstance;
  private requestId = 0;

  constructor() {
    this.client = axios.create({
      baseURL: ((import.meta.env?.VITE_API_URL as string) || (import.meta.env?.VITE_API_BASE_URL as string) || 'http://localhost:8000') + '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestId}`;
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Check if endpoint is rate limited
        const endpoint = config.url || '';
        if (rateLimitTracker.isRateLimited(endpoint)) {
          const error = new AppError(
            ErrorType.RATE_LIMIT_ERROR,
            'Request blocked due to rate limiting',
            'RATE_LIMITED',
            { endpoint }
          );
          return Promise.reject(error);
        }
        
        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();
        
        // Add auth token
        const state = store.getState();
        const token = state.auth.token;
        
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add timestamp for performance tracking
        config.metadata = { startTime: Date.now() };
        
        return config;
      },
      (error) => {
        return Promise.reject(this.createAppError(error));
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log successful requests in development
        if (import.meta.env?.DEV) {
          const duration = Date.now() - (response.config.metadata?.startTime || 0);
          console.log(`API Success: ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`);
        }
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as RequestConfig;
        const appError = this.createAppError(error);
        
        // Log error details
        if (import.meta.env?.DEV) {
          console.error('API Error:', {
            url: error.config?.url,
            method: error.config?.method,
            status: error.response?.status,
            message: appError.message,
            requestId: error.config?.headers?.['X-Request-ID'],
            data: error.response?.data
          });
        }

        // Handle authentication errors with token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await store.dispatch(refreshToken()).unwrap();
            
            const state = store.getState();
            const newToken = state.auth.token;
            
            if (newToken) {
              originalRequest.headers!.Authorization = `Bearer ${newToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            await this.handleAuthenticationError();
            return Promise.reject(appError);
          }
        }

        // Track rate limits
        if (error.response?.status === 429) {
          const endpoint = error.config?.url || '';
          rateLimitTracker.setRateLimited(endpoint, 60000); // Block for 1 minute
        }

        // Handle errors with notifications (unless skipped)
        if (!originalRequest.skipErrorHandling) {
          this.handleErrorNotification(appError);
        }

        return Promise.reject(appError);
      }
    );
  }

  private createAppError(error: any): AppError {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return new AppError(
        ErrorType.TIMEOUT_ERROR,
        'Request timed out',
        'TIMEOUT',
        { originalError: error.message },
        true
      );
    }

    if (!error.response) {
      // Network error
      if (!navigator.onLine) {
        return new AppError(
          ErrorType.OFFLINE_ERROR,
          'You appear to be offline',
          'OFFLINE',
          { originalError: error.message },
          true
        );
      }

      return AppError.fromNetworkError(error);
    }

    // HTTP error response
    return AppError.fromResponse(error.response, error.response.data);
  }

  private async handleAuthenticationError() {
    store.dispatch(clearCredentials());
    store.dispatch(addNotification({
      id: `session-expired-${Date.now()}`,
      type: 'error',
      title: 'Session Expired',
      message: 'Please log in again.',
      timestamp: new Date().toISOString(),
      autoHide: true,
      duration: 5000,
    }));
    
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  private handleErrorNotification(error: AppError) {
    const message = ErrorHandler.getErrorMessage(error);
    const actionableMessage = ErrorHandler.getActionableMessage(error);

    let notificationType: 'error' | 'warning' | 'info' = 'error';
    
    switch (error.type) {
      case ErrorType.VALIDATION_ERROR:
      case ErrorType.NOT_FOUND_ERROR:
        notificationType = 'warning';
        break;
      case ErrorType.AUTHENTICATION_ERROR:
      case ErrorType.AUTHORIZATION_ERROR:
        notificationType = 'info';
        break;
    }

    // Ensure message is a string
    const messageStr = typeof message === 'string' ? message : String(message);
    const actionableStr = typeof actionableMessage === 'string' ? actionableMessage : String(actionableMessage);
    
    store.dispatch(addNotification({
      id: `api-error-${Date.now()}`,
      type: notificationType,
      title: this.getErrorTitle(error.type),
      message: `${messageStr} ${actionableStr}`.trim(),
      timestamp: new Date().toISOString(),
      autoHide: error.type !== ErrorType.AUTHENTICATION_ERROR,
      duration: 8000,
    }));
  }

  private getErrorTitle(errorType: ErrorType): string {
    const titles: Record<ErrorType, string> = {
      [ErrorType.NETWORK_ERROR]: 'Connection Error',
      [ErrorType.AUTHENTICATION_ERROR]: 'Authentication Required',
      [ErrorType.AUTHORIZATION_ERROR]: 'Access Denied',
      [ErrorType.VALIDATION_ERROR]: 'Invalid Input',
      [ErrorType.NOT_FOUND_ERROR]: 'Not Found',
      [ErrorType.SERVER_ERROR]: 'Server Error',
      [ErrorType.TIMEOUT_ERROR]: 'Request Timeout',
      [ErrorType.OFFLINE_ERROR]: 'Offline',
      [ErrorType.RATE_LIMIT_ERROR]: 'Rate Limited',
      [ErrorType.UNKNOWN_ERROR]: 'Unexpected Error'
    };

    return titles[errorType] || 'Error';
  }

  private async executeWithRetry<T>(
    operation: () => Promise<AxiosResponse<T>>,
    config?: RequestConfig
  ): Promise<AxiosResponse<T>> {
    if (config?.skipRetry) {
      return operation();
    }

    return globalRetryMechanism.execute(
      operation,
      `${config?.method || 'REQUEST'} ${config?.url || 'unknown'}`
    );
  }

  async get<T>(url: string, config?: RequestConfig): Promise<AxiosResponse<T>> {
    return this.executeWithRetry(
      () => this.client.get<T>(url, config),
      { ...config, method: 'GET', url }
    );
  }

  async post<T>(url: string, data?: any, config?: RequestConfig): Promise<AxiosResponse<T>> {
    return this.executeWithRetry(
      () => this.client.post<T>(url, data, config),
      { ...config, method: 'POST', url }
    );
  }

  async put<T>(url: string, data?: any, config?: RequestConfig): Promise<AxiosResponse<T>> {
    return this.executeWithRetry(
      () => this.client.put<T>(url, data, config),
      { ...config, method: 'PUT', url }
    );
  }

  async patch<T>(url: string, data?: any, config?: RequestConfig): Promise<AxiosResponse<T>> {
    return this.executeWithRetry(
      () => this.client.patch<T>(url, data, config),
      { ...config, method: 'PATCH', url }
    );
  }

  async delete<T>(url: string, config?: RequestConfig): Promise<AxiosResponse<T>> {
    return this.executeWithRetry(
      () => this.client.delete<T>(url, config),
      { ...config, method: 'DELETE', url }
    );
  }

  // Upload with progress tracking
  async upload<T>(
    url: string, 
    data: FormData, 
    onProgress?: (progress: number) => void,
    config?: RequestConfig
  ): Promise<AxiosResponse<T>> {
    const uploadConfig: RequestConfig = {
      ...config,
      headers: {
        ...config?.headers,
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
      // Don't retry uploads by default
      skipRetry: config?.skipRetry ?? true
    };

    return this.executeWithRetry(
      () => this.client.post<T>(url, data, uploadConfig),
      { ...uploadConfig, method: 'POST', url }
    );
  }

  // Health check endpoint
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health', { 
        timeout: 5000,
        skipRetry: true,
        skipErrorHandling: true
      } as RequestConfig);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get request statistics
  getStats() {
    return {
      requestId: this.requestId,
      baseURL: this.client.defaults.baseURL,
      timeout: this.client.defaults.timeout
    };
  }

  // Get the underlying axios instance for advanced usage
  getInstance(): AxiosInstance {
    return this.client;
  }
}

// Extend AxiosRequestConfig to include metadata
declare module 'axios' {
  interface AxiosRequestConfig {
    metadata?: {
      startTime: number;
    };
    _retry?: boolean;
  }
}

// Create and export singleton instance
const apiClient = new APIClientClass();
export default apiClient;