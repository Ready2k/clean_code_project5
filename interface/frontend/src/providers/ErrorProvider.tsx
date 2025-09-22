import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import { Snackbar, Alert, AlertTitle, Box, Button } from '@mui/material';
import { RefreshOutlined } from '@mui/icons-material';
import { APIError, AppError, ErrorType } from '../types/errors';
import { ErrorHandler } from '../utils/errorHandler';
import { OfflineIndicator } from '../components/common/OfflineIndicator';
import { useOfflineContext } from '../contexts/OfflineContext';

interface ErrorContextType {
  showError: (error: AppError | Error) => void;
  clearError: () => void;
  currentError: APIError | null;
  isOffline: boolean;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

interface ErrorProviderProps {
  children: React.ReactNode;
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const [currentError, setCurrentError] = useState<APIError | null>(null);
  const [errorQueue, setErrorQueue] = useState<APIError[]>([]);
  const { isOffline } = useOfflineContext();

  const showError = useCallback((error: AppError | Error) => {
    const apiError = ErrorHandler.handle(error);
    
    // Don't show duplicate errors
    if (currentError?.message === apiError.message && 
        currentError?.type === apiError.type) {
      return;
    }

    // If there's already an error showing, queue this one
    if (currentError) {
      setErrorQueue(prev => [...prev, apiError]);
    } else {
      setCurrentError(apiError);
    }
  }, [currentError]);

  const clearError = useCallback(() => {
    setCurrentError(null);
    
    // Show next error in queue if any
    setErrorQueue(prev => {
      if (prev.length > 0) {
        const [nextError, ...rest] = prev;
        setCurrentError(nextError);
        return rest;
      }
      return prev;
    });
  }, []);

  const handleRetry = useCallback(() => {
    // This would trigger a retry of the last failed operation
    // Implementation depends on how you want to handle retries globally
    clearError();
    window.location.reload(); // Simple fallback
  }, [clearError]);

  // Auto-clear certain errors after a timeout
  useEffect(() => {
    if (!currentError) return;

    const autoClearTypes = [
      ErrorType.NETWORK_ERROR,
      ErrorType.TIMEOUT_ERROR,
      ErrorType.RATE_LIMIT_ERROR
    ];

    if (autoClearTypes.includes(currentError.type)) {
      const timer = setTimeout(() => {
        clearError();
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [currentError, clearError]);

  // Listen for global error events
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      const error = new AppError(
        ErrorType.UNKNOWN_ERROR,
        event.message || 'An unexpected error occurred',
        'GLOBAL_ERROR',
        { filename: event.filename, lineno: event.lineno, colno: event.colno }
      );
      showError(error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? 
        event.reason : 
        new Error(String(event.reason));
      
      const appError = new AppError(
        ErrorType.UNKNOWN_ERROR,
        error.message || 'Unhandled promise rejection',
        'UNHANDLED_REJECTION',
        { reason: event.reason }
      );
      
      showError(appError);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [showError]);

  const getSeverity = (errorType: ErrorType) => {
    switch (errorType) {
      case ErrorType.VALIDATION_ERROR:
      case ErrorType.NOT_FOUND_ERROR:
        return 'warning';
      case ErrorType.AUTHENTICATION_ERROR:
      case ErrorType.AUTHORIZATION_ERROR:
        return 'info';
      default:
        return 'error';
    }
  };

  const contextValue: ErrorContextType = {
    showError,
    clearError,
    currentError,
    isOffline
  };

  return (
    <ErrorContext.Provider value={contextValue}>
      {children}
      
      {/* Offline Indicator */}
      <OfflineIndicator variant="banner" />
      
      {/* Error Snackbar */}
      <Snackbar
        open={!!currentError}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: isOffline ? 8 : 0 }} // Offset if offline banner is showing
      >
        <Alert
          severity={currentError ? getSeverity(currentError.type) : 'error'}
          onClose={clearError}
          action={
            currentError && ErrorHandler.isRetryable(currentError) ? (
              <Button
                color="inherit"
                size="small"
                startIcon={<RefreshOutlined />}
                onClick={handleRetry}
              >
                Retry
              </Button>
            ) : undefined
          }
          sx={{ minWidth: 400 }}
        >
          {currentError && (
            <Box>
              <AlertTitle>
                {getErrorTitle(currentError.type)}
              </AlertTitle>
              {ErrorHandler.getErrorMessage(currentError)}
              
              {errorQueue.length > 0 && (
                <Box sx={{ mt: 1, fontSize: '0.875rem', opacity: 0.8 }}>
                  +{errorQueue.length} more error{errorQueue.length > 1 ? 's' : ''}
                </Box>
              )}
            </Box>
          )}
        </Alert>
      </Snackbar>
    </ErrorContext.Provider>
  );
}

function getErrorTitle(errorType: ErrorType): string {
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

export function useError() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

export default ErrorProvider;