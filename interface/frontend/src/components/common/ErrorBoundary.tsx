import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Alert, AlertTitle } from '@mui/material';
import { RefreshOutlined, BugReportOutlined } from '@mui/icons-material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error to monitoring service
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="400px"
          p={3}
        >
          <Alert severity="error" sx={{ mb: 3, maxWidth: 600 }}>
            <AlertTitle>Something went wrong</AlertTitle>
            <Typography variant="body2" sx={{ mb: 2 }}>
              An unexpected error occurred. This has been logged and our team has been notified.
            </Typography>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  <strong>Error:</strong> {this.state.error.message}
                </Typography>
                {this.state.errorInfo && (
                  <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mt: 1 }}>
                    <strong>Stack:</strong>
                    <pre style={{ fontSize: '0.7rem', overflow: 'auto', maxHeight: '200px' }}>
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </Typography>
                )}
              </Box>
            )}
          </Alert>

          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              startIcon={<RefreshOutlined />}
              onClick={this.handleRetry}
            >
              Try Again
            </Button>
            <Button
              variant="outlined"
              startIcon={<BugReportOutlined />}
              onClick={this.handleReload}
            >
              Reload Page
            </Button>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;