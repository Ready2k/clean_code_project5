import { useState, useCallback, useEffect } from 'react';
import { AppError, ErrorState, ErrorType } from '../types/errors';
import { ErrorHandler } from '../utils/errorHandler';
import { useRetry } from '../utils/retryMechanism';

interface UseErrorHandlingOptions {
  showNotifications?: boolean;
  autoRetry?: boolean;
  maxRetries?: number;
  onError?: (error: AppError) => void;
}

export function useErrorHandling(options: UseErrorHandlingOptions = {}) {
  const {
    showNotifications = true,
    autoRetry = false,
    maxRetries = 3,
    onError
  } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null,
    isRetrying: false,
    retryCount: 0
  });

  const { execute } = useRetry({ maxRetries });

  const handleError = useCallback((error: Error | AppError) => {
    const appError = error instanceof AppError ? error : new AppError(
      ErrorType.UNKNOWN_ERROR,
      error.message || 'An unexpected error occurred'
    );

    setErrorState({
      hasError: true,
      error: appError,
      isRetrying: false,
      retryCount: 0
    });

    if (showNotifications) {
      ErrorHandler.handle(appError);
    }

    if (onError) {
      onError(appError);
    }
  }, [showNotifications, onError]);

  const clearError = useCallback(() => {
    setErrorState({
      hasError: false,
      error: null,
      isRetrying: false,
      retryCount: 0
    });
  }, []);

  const retry = useCallback(async (operation?: () => Promise<any>) => {
    if (!errorState.error || !operation) {
      return;
    }

    setErrorState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1
    }));

    try {
      const result = await execute(operation, `retry-${errorState.retryCount + 1}`);
      clearError();
      return result;
    } catch (error) {
      handleError(error as AppError);
      throw error;
    } finally {
      setErrorState(prev => ({
        ...prev,
        isRetrying: false
      }));
    }
  }, [errorState.error, errorState.retryCount, execute, clearError, handleError]);

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T | null> => {
    try {
      clearError();
      
      if (autoRetry) {
        return await execute(operation, context);
      } else {
        return await operation();
      }
    } catch (error) {
      handleError(error as AppError);
      return null;
    }
  }, [autoRetry, execute, clearError, handleError]);

  return {
    ...errorState,
    handleError,
    clearError,
    retry,
    executeWithErrorHandling,
    isRetryable: errorState.error ? ErrorHandler.isRetryable(errorState.error) : false
  };
}

interface UseAsyncOperationOptions extends UseErrorHandlingOptions {
  immediate?: boolean;
}

export function useAsyncOperation<T>(
  operation: () => Promise<T>,
  dependencies: any[] = [],
  options: UseAsyncOperationOptions = {}
) {
  const { immediate = false, ...errorOptions } = options;
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  
  const {
    hasError,
    error,
    isRetrying,
    retryCount,
    clearError,
    retry,
    executeWithErrorHandling
  } = useErrorHandling(errorOptions);

  const execute = useCallback(async (): Promise<T | null> => {
    setLoading(true);
    
    try {
      const result = await executeWithErrorHandling(operation);
      if (result !== null) {
        setData(result);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [operation, executeWithErrorHandling]);

  const retryOperation = useCallback(async () => {
    setLoading(true);
    
    try {
      const result = await retry(operation);
      if (result !== null) {
        setData(result);
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [retry, operation]);

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    clearError();
  }, [clearError]);

  // Execute immediately if requested
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, ...dependencies]);

  return {
    loading,
    data,
    hasError,
    error,
    isRetrying,
    retryCount,
    execute,
    retry: retryOperation,
    reset,
    clearError,
    isRetryable: error ? ErrorHandler.isRetryable(error) : false
  };
}

export function useLoadingState(initialState = false) {
  const [loading, setLoading] = useState(initialState);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setGlobalLoading = useCallback((isLoading: boolean) => {
    setLoading(isLoading);
  }, []);

  const setNamedLoading = useCallback((name: string, isLoading: boolean) => {
    setLoadingStates(prev => ({
      ...prev,
      [name]: isLoading
    }));
  }, []);

  const isAnyLoading = useCallback(() => {
    return loading || Object.values(loadingStates).some(Boolean);
  }, [loading, loadingStates]);

  const isNamedLoading = useCallback((name: string) => {
    return loadingStates[name] || false;
  }, [loadingStates]);

  const withLoading = useCallback(async <T>(
    operation: () => Promise<T>,
    name?: string
  ): Promise<T> => {
    const setLoadingFn = name ? 
      (isLoading: boolean) => setNamedLoading(name, isLoading) :
      setGlobalLoading;

    setLoadingFn(true);
    try {
      return await operation();
    } finally {
      setLoadingFn(false);
    }
  }, [setGlobalLoading, setNamedLoading]);

  return {
    loading,
    loadingStates,
    setLoading: setGlobalLoading,
    setNamedLoading,
    isAnyLoading,
    isNamedLoading,
    withLoading
  };
}