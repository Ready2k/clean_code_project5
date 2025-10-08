import React from 'react';
import { Card, CardContent, Typography, Box, Button } from '@mui/material';
import { RefreshOutlined, ErrorOutlineOutlined } from '@mui/icons-material';
import { PromptRecord } from '../../types/prompts';
import { PromptCard } from './PromptCard';
import { AsyncErrorBoundary } from '../common/AsyncErrorBoundary';
import { LoadingSkeleton } from '../common/LoadingSpinner';
import { useAsyncOperation } from '../../hooks/useErrorHandling';
import { ErrorDisplay } from '../common/ErrorDisplay';

interface PromptCardWithErrorHandlingProps {
  prompt: PromptRecord;
  onView?: (prompt: PromptRecord) => void;
  onEdit?: (prompt: PromptRecord) => void;
  onDelete?: (prompt: PromptRecord) => void;
  onRender?: (prompt: PromptRecord) => void;
  onEnhance?: (prompt: PromptRecord) => void;
  onShare?: (prompt: PromptRecord) => void;
  onExport?: (prompt: PromptRecord) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  loading?: boolean;
}

// Error fallback component for prompt card
function PromptCardErrorFallback({ 
  error, 
  resetErrorBoundary 
}: { 
  error: Error; 
  resetErrorBoundary: () => void; 
}) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <ErrorOutlineOutlined color="error" sx={{ fontSize: 48, mb: 2 }} />
        <Typography variant="h6" color="error" gutterBottom>
          Failed to load prompt
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
          {error.message || 'An error occurred while loading this prompt card.'}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshOutlined />}
          onClick={resetErrorBoundary}
        >
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

// Loading skeleton for prompt card
function PromptCardSkeleton() {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <LoadingSkeleton variant="text" width="80%" height={24} />
        <LoadingSkeleton variant="text" lines={2} height={16} />
        <Box display="flex" gap={1} mt={2}>
          <LoadingSkeleton variant="rectangular" width={60} height={24} />
          <LoadingSkeleton variant="rectangular" width={80} height={24} />
          <LoadingSkeleton variant="rectangular" width={70} height={24} />
        </Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
          <LoadingSkeleton variant="text" width={100} height={20} />
          <LoadingSkeleton variant="circular" width={40} height={40} />
        </Box>
      </CardContent>
    </Card>
  );
}

export const PromptCardWithErrorHandling: React.FC<PromptCardWithErrorHandlingProps> = ({
  prompt,
  loading = false,
  onView,
  onEdit,
  onDelete,
  onRender,
  onEnhance,
  onShare,
  onExport,
  selectionMode,
  selected,
  onSelectionChange,
}) => {
  // Enhanced action handlers with error handling
  const {
    loading: actionLoading,
    hasError: actionError,
    error: actionErrorData,
    executeWithErrorHandling,
    clearError
  } = useAsyncOperation(async () => {}, [], { immediate: false });

  const handleActionWithErrorHandling = async (
    action: ((prompt: PromptRecord) => void | Promise<void>) | undefined,
    actionName: string
  ) => {
    if (!action) return;

    await executeWithErrorHandling(async () => {
      await action(prompt);
    });
  };

  const wrappedHandlers = {
    onView: onView ? () => handleActionWithErrorHandling(onView, 'view') : undefined,
    onEdit: onEdit ? () => handleActionWithErrorHandling(onEdit, 'edit') : undefined,
    onDelete: onDelete ? () => handleActionWithErrorHandling(onDelete, 'delete') : undefined,
    onRender: onRender ? () => handleActionWithErrorHandling(onRender, 'render') : undefined,
    onEnhance: onEnhance ? () => handleActionWithErrorHandling(onEnhance, 'enhance') : undefined,
    onShare: onShare ? () => handleActionWithErrorHandling(onShare, 'share') : undefined,
    onExport: onExport ? () => handleActionWithErrorHandling(onExport, 'export') : undefined,
  };

  // Show loading skeleton
  if (loading) {
    return <PromptCardSkeleton />;
  }

  // Show action error if any
  if (actionError && actionErrorData) {
    return (
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1 }}>
          <ErrorDisplay
            error={actionErrorData}
            onRetry={() => clearError()}
            onDismiss={() => clearError()}
            compact
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <AsyncErrorBoundary
      fallback={PromptCardErrorFallback}
      onError={(error, errorInfo) => {
        console.error('PromptCard Error:', error, errorInfo);
      }}
    >
      <PromptCard
        prompt={prompt}
        {...wrappedHandlers}
        selectionMode={selectionMode}
        selected={selected}
        onSelectionChange={onSelectionChange}
      />
    </AsyncErrorBoundary>
  );
};

export default PromptCardWithErrorHandling;