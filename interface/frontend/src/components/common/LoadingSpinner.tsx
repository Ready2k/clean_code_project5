import React from 'react';
import { 
  Box, 
  CircularProgress, 
  Typography, 
  Skeleton,
  LinearProgress
} from '@mui/material';

interface LoadingSpinnerProps {
  size?: number | string;
  message?: string;
  variant?: 'circular' | 'linear';
  fullScreen?: boolean;
}

export function LoadingSpinner({ 
  size = 40, 
  message, 
  variant = 'circular',
  fullScreen = false 
}: LoadingSpinnerProps) {
  const content = (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={2}
    >
      {variant === 'circular' ? (
        <CircularProgress size={size} />
      ) : (
        <Box sx={{ width: '100%', maxWidth: 300 }}>
          <LinearProgress />
        </Box>
      )}
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );

  if (fullScreen) {
    return (
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        display="flex"
        alignItems="center"
        justifyContent="center"
        bgcolor="rgba(255, 255, 255, 0.8)"
        zIndex={9999}
      >
        {content}
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="200px"
      p={2}
    >
      {content}
    </Box>
  );
}

interface LoadingSkeletonProps {
  variant?: 'text' | 'rectangular' | 'circular';
  width?: number | string;
  height?: number | string;
  lines?: number;
}

export function LoadingSkeleton({ 
  variant = 'text', 
  width = '100%', 
  height = 20,
  lines = 1 
}: LoadingSkeletonProps) {
  if (lines > 1) {
    return (
      <Box>
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton
            key={index}
            variant={variant}
            width={index === lines - 1 ? '60%' : width}
            height={height}
            sx={{ mb: 0.5 }}
          />
        ))}
      </Box>
    );
  }

  return (
    <Skeleton
      variant={variant}
      width={width}
      height={height}
    />
  );
}

interface LoadingOverlayProps {
  loading: boolean;
  children: React.ReactNode;
  message?: string;
}

export function LoadingOverlay({ loading, children, message }: LoadingOverlayProps) {
  return (
    <Box position="relative">
      {children}
      {loading && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bgcolor="rgba(255, 255, 255, 0.8)"
          zIndex={1}
        >
          <LoadingSpinner message={message} />
        </Box>
      )}
    </Box>
  );
}

export default LoadingSpinner;