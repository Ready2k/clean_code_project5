import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Typography,
  Collapse,
  IconButton
} from '@mui/material';
import {
  RefreshOutlined,
  ExpandMoreOutlined,
  ExpandLessOutlined,
  WifiOffOutlined,
  ErrorOutlineOutlined,
  WarningOutlined,
  InfoOutlined
} from '@mui/icons-material';
import { APIError, ErrorType } from '../../types/errors';
import { ErrorHandler } from '../../utils/errorHandler';

interface ErrorDisplayProps {
  error: APIError;
  onRetry?: () => void;
  onDismiss?: () => void;
  showDetails?: boolean;
  compact?: boolean;
}

export function ErrorDisplay({ 
  error, 
  onRetry, 
  onDismiss, 
  showDetails = false,
  compact = false 
}: ErrorDisplayProps) {
  const [expanded, setExpanded] = React.useState(false);

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

  const getIcon = (errorType: ErrorType) => {
    switch (errorType) {
      case ErrorType.OFFLINE_ERROR:
        return <WifiOffOutlined />;
      case ErrorType.VALIDATION_ERROR:
        return <WarningOutlined />;
      case ErrorType.AUTHENTICATION_ERROR:
      case ErrorType.AUTHORIZATION_ERROR:
        return <InfoOutlined />;
      default:
        return <ErrorOutlineOutlined />;
    }
  };

  const message = ErrorHandler.getErrorMessage(error);
  const actionableMessage = ErrorHandler.getActionableMessage(error);
  const isRetryable = ErrorHandler.isRetryable(error);

  if (compact) {
    return (
      <Alert 
        severity={getSeverity(error.type)}
        action={
          <Box display="flex" gap={1}>
            {isRetryable && onRetry && (
              <Button size="small" onClick={onRetry}>
                Retry
              </Button>
            )}
            {onDismiss && (
              <Button size="small" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </Box>
        }
      >
        {message}
      </Alert>
    );
  }

  return (
    <Alert 
      severity={getSeverity(error.type)}
      icon={getIcon(error.type)}
      action={
        <Box display="flex" alignItems="center" gap={1}>
          {showDetails && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              aria-label="toggle details"
            >
              {expanded ? <ExpandLessOutlined /> : <ExpandMoreOutlined />}
            </IconButton>
          )}
          {isRetryable && onRetry && (
            <Button
              size="small"
              startIcon={<RefreshOutlined />}
              onClick={onRetry}
              variant="outlined"
            >
              Retry
            </Button>
          )}
          {onDismiss && (
            <Button size="small" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </Box>
      }
    >
      <AlertTitle>{getErrorTitle(error.type)}</AlertTitle>
      <Typography variant="body2" sx={{ mb: 1 }}>
        {message}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {actionableMessage}
      </Typography>

      {showDetails && (
        <Collapse in={expanded}>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
            <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace' }}>
              <strong>Error Type:</strong> {error.type}
            </Typography>
            {error.code && (
              <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace' }}>
                <strong>Code:</strong> {error.code}
              </Typography>
            )}
            <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace' }}>
              <strong>Timestamp:</strong> {new Date(error.timestamp).toLocaleString()}
            </Typography>
            {error.requestId && (
              <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace' }}>
                <strong>Request ID:</strong> {error.requestId}
              </Typography>
            )}
            {error.details && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" component="div" sx={{ fontFamily: 'monospace' }}>
                  <strong>Details:</strong>
                </Typography>
                <pre style={{ fontSize: '0.7rem', overflow: 'auto', maxHeight: '100px' }}>
                  {JSON.stringify(error.details, null, 2)}
                </pre>
              </Box>
            )}
          </Box>
        </Collapse>
      )}
    </Alert>
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

interface ErrorBannerProps {
  error: APIError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ error, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
      <ErrorDisplay 
        error={error} 
        onRetry={onRetry} 
        onDismiss={onDismiss} 
        compact 
      />
    </Box>
  );
}

export default ErrorDisplay;