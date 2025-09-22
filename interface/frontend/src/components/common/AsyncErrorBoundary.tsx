import React, { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Box, Typography, Button, Alert, AlertTitle } from '@mui/material';
import { RefreshOutlined, ReportProblemOutlined } from '@mui/icons-material';

interface AsyncErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

function AsyncErrorFallback({ error, resetErrorBoundary }: AsyncErrorFallbackProps) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      p={3}
      minHeight="200px"
    >
      <Alert severity="error" sx={{ mb: 2, maxWidth: 500 }}>
        <AlertTitle>Failed to load content</AlertTitle>
        <Typography variant="body2">
          {error.message || 'An error occurred while loading this content.'}
        </Typography>
      </Alert>
      
      <Button
        variant="contained"
        startIcon={<RefreshOutlined />}
        onClick={resetErrorBoundary}
        size="small"
      >
        Retry
      </Button>
    </Box>
  );
}

interface AsyncErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
  fallback?: React.ComponentType<AsyncErrorFallbackProps>;
}

export function AsyncErrorBoundary({ 
  children, 
  onError, 
  fallback = AsyncErrorFallback 
}: AsyncErrorBoundaryProps) {
  return (
    <ErrorBoundary
      FallbackComponent={fallback}
      onError={onError}
      onReset={() => {
        // Reset any state that needs to be cleared
        window.location.reload();
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

export default AsyncErrorBoundary;