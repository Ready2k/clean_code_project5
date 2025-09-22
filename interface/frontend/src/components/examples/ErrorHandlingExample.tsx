import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Grid,
  Divider
} from '@mui/material';
import {
  ErrorOutlineOutlined,
  WifiOffOutlined,
  AccessTimeOutlined,
  SecurityOutlined
} from '@mui/icons-material';

import { useErrorHandling, useAsyncOperation, useLoadingState } from '../../hooks/useErrorHandling';
import { useError } from '../../providers/ErrorProvider';
import { AppError, ErrorType } from '../../types/errors';
import { ErrorDisplay } from '../../components/common/ErrorDisplay';
import { LoadingSpinner, LoadingOverlay } from '../../components/common/LoadingSpinner';
import { AsyncErrorBoundary } from '../../components/common/AsyncErrorBoundary';

// Simulate different types of errors for demonstration
const simulateError = (type: ErrorType): Promise<string> => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      switch (type) {
        case ErrorType.NETWORK_ERROR:
          reject(new AppError(ErrorType.NETWORK_ERROR, 'Failed to connect to server', 'NETWORK_ERROR', {}, true));
          break;
        case ErrorType.TIMEOUT_ERROR:
          reject(new AppError(ErrorType.TIMEOUT_ERROR, 'Request timed out', 'TIMEOUT', {}, true));
          break;
        case ErrorType.AUTHENTICATION_ERROR:
          reject(new AppError(ErrorType.AUTHENTICATION_ERROR, 'Authentication required', 401));
          break;
        case ErrorType.VALIDATION_ERROR:
          reject(new AppError(ErrorType.VALIDATION_ERROR, 'Invalid input provided', 422, { field: 'email' }));
          break;
        case ErrorType.SERVER_ERROR:
          reject(new AppError(ErrorType.SERVER_ERROR, 'Internal server error', 500, {}, true));
          break;
        default:
          reject(new Error('Unknown error occurred'));
      }
    }, 1000);
  });
};

const simulateSuccess = (): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('Operation completed successfully!');
    }, 1500);
  });
};

export function ErrorHandlingExample() {
  const { showError } = useError();
  const { loading, withLoading } = useLoadingState();
  
  // Example 1: Basic error handling
  const {
    hasError: basicError,
    error: basicErrorData,
    clearError: clearBasicError,
    executeWithErrorHandling
  } = useErrorHandling();

  // Example 2: Async operation with retry
  const {
    loading: asyncLoading,
    data: asyncData,
    hasError: asyncError,
    error: asyncErrorData,
    retry: retryAsync,
    execute: executeAsync,
    clearError: clearAsyncError
  } = useAsyncOperation(() => simulateSuccess(), [], { autoRetry: false });

  // Example 3: Component that throws errors
  const [shouldThrow, setShouldThrow] = useState(false);

  const ThrowingComponent = () => {
    if (shouldThrow) {
      throw new Error('Component error for testing');
    }
    return <Typography>Component rendered successfully!</Typography>;
  };

  const handleBasicError = async (errorType: ErrorType) => {
    await executeWithErrorHandling(() => simulateError(errorType));
  };

  const handleGlobalError = (errorType: ErrorType) => {
    const error = new AppError(errorType, `Global ${errorType} error`, errorType);
    showError(error);
  };

  const handleAsyncOperation = () => {
    executeAsync();
  };

  const handleLoadingOperation = async () => {
    await withLoading(async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
    });
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Error Handling & Loading States Demo
      </Typography>
      
      <Grid container spacing={3}>
        {/* Basic Error Handling */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Error Handling
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Test different error types with local error handling
              </Typography>
              
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ErrorOutlineOutlined />}
                  onClick={() => handleBasicError(ErrorType.NETWORK_ERROR)}
                >
                  Network Error
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AccessTimeOutlined />}
                  onClick={() => handleBasicError(ErrorType.TIMEOUT_ERROR)}
                >
                  Timeout
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SecurityOutlined />}
                  onClick={() => handleBasicError(ErrorType.AUTHENTICATION_ERROR)}
                >
                  Auth Error
                </Button>
              </Box>

              {basicError && basicErrorData && (
                <ErrorDisplay
                  error={basicErrorData}
                  onRetry={() => handleBasicError(basicErrorData.type)}
                  onDismiss={clearBasicError}
                  showDetails
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Global Error Handling */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Global Error Handling
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Test global error notifications
              </Typography>
              
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleGlobalError(ErrorType.SERVER_ERROR)}
                >
                  Server Error
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleGlobalError(ErrorType.VALIDATION_ERROR)}
                >
                  Validation Error
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<WifiOffOutlined />}
                  onClick={() => handleGlobalError(ErrorType.OFFLINE_ERROR)}
                >
                  Offline Error
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Async Operations */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Async Operations with Retry
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Test async operations with loading states and retry functionality
              </Typography>
              
              <Box display="flex" gap={1} mb={2}>
                <Button
                  variant="contained"
                  onClick={handleAsyncOperation}
                  disabled={asyncLoading}
                >
                  {asyncLoading ? 'Loading...' : 'Start Operation'}
                </Button>
                {asyncError && (
                  <Button
                    variant="outlined"
                    onClick={retryAsync}
                    disabled={asyncLoading}
                  >
                    Retry
                  </Button>
                )}
              </Box>

              {asyncLoading && <LoadingSpinner message="Processing async operation..." />}
              
              {asyncData && (
                <Typography color="success.main" variant="body2">
                  ✓ {asyncData}
                </Typography>
              )}

              {asyncError && asyncErrorData && (
                <ErrorDisplay
                  error={asyncErrorData}
                  onRetry={retryAsync}
                  onDismiss={clearAsyncError}
                  compact
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Loading States */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Loading States
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Test different loading indicators
              </Typography>
              
              <Button
                variant="contained"
                onClick={handleLoadingOperation}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Start Loading'}
              </Button>

              <LoadingOverlay loading={loading}>
                <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
                  <Typography>
                    This content is overlaid with loading state
                  </Typography>
                </Box>
              </LoadingOverlay>
            </CardContent>
          </Card>
        </Grid>

        {/* Error Boundary Test */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Error Boundary Test
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Test React error boundaries with component errors
              </Typography>
              
              <Box display="flex" gap={1} mb={2}>
                <Button
                  variant={shouldThrow ? "contained" : "outlined"}
                  color={shouldThrow ? "error" : "primary"}
                  onClick={() => setShouldThrow(!shouldThrow)}
                >
                  {shouldThrow ? 'Stop Throwing' : 'Throw Error'}
                </Button>
              </Box>

              <Divider sx={{ my: 2 }} />

              <AsyncErrorBoundary>
                <ThrowingComponent />
              </AsyncErrorBoundary>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default ErrorHandlingExample;