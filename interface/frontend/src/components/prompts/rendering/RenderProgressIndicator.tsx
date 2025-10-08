import React from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Alert,
  Chip,
  Fade,
  Paper,
} from '@mui/material';
import {
  Schedule as PreparingIcon,
  PlayArrow as ExecutingIcon,
  Settings as ProcessingIcon,
  CheckCircle as CompletingIcon,
} from '@mui/icons-material';
import { useRenderProgress, RenderProgress } from '../../../hooks/useRenderProgress';

interface RenderProgressIndicatorProps {
  promptId?: string;
  connectionId?: string;
  provider?: string;
  compact?: boolean;
}

const getStatusIcon = (status: RenderProgress['status']) => {
  switch (status) {
    case 'preparing':
      return <PreparingIcon fontSize="small" />;
    case 'executing':
      return <ExecutingIcon fontSize="small" />;
    case 'processing':
      return <ProcessingIcon fontSize="small" />;
    case 'completing':
      return <CompletingIcon fontSize="small" />;
    default:
      return <ExecutingIcon fontSize="small" />;
  }
};

const getStatusColor = (status: RenderProgress['status']) => {
  switch (status) {
    case 'preparing':
      return 'info';
    case 'executing':
      return 'warning';
    case 'processing':
      return 'primary';
    case 'completing':
      return 'success';
    default:
      return 'primary';
  }
};

const getProgressValue = (status: RenderProgress['status']) => {
  switch (status) {
    case 'preparing':
      return 25;
    case 'executing':
      return 50;
    case 'processing':
      return 75;
    case 'completing':
      return 95;
    default:
      return 0;
  }
};

const RenderProgressIndicator: React.FC<RenderProgressIndicatorProps> = ({
  promptId,
  connectionId,
  provider,
  compact = false,
}) => {
  const { isRendering, progress, error } = useRenderProgress(promptId, connectionId);

  if (!isRendering && !error) {
    return null;
  }

  if (error) {
    return (
      <Fade in>
        <Alert 
          severity="error" 
          variant={compact ? "standard" : "filled"}
          sx={{ mb: compact ? 1 : 2 }}
        >
          <Typography variant="body2">
            Render failed: {error}
          </Typography>
        </Alert>
      </Fade>
    );
  }

  if (compact) {
    return (
      <Fade in>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Chip
            icon={progress ? getStatusIcon(progress.status) : <ExecutingIcon fontSize="small" />}
            label={progress?.message || 'Rendering...'}
            color={progress ? getStatusColor(progress.status) as any : 'primary'}
            size="small"
            variant="outlined"
          />
          <Box sx={{ flexGrow: 1, minWidth: 60 }}>
            <LinearProgress 
              variant="determinate" 
              value={progress ? getProgressValue(progress.status) : 0}
              sx={{ height: 4, borderRadius: 2 }}
            />
          </Box>
        </Box>
      </Fade>
    );
  }

  return (
    <Fade in>
      <Paper 
        elevation={2} 
        sx={{ 
          p: 2, 
          mb: 2, 
          backgroundColor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          {progress && getStatusIcon(progress.status)}
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Rendering with {provider || progress?.provider || 'LLM'}
          </Typography>
          <Chip
            label={progress?.status || 'processing'}
            color={progress ? getStatusColor(progress.status) as any : 'primary'}
            size="small"
          />
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {progress?.message || 'Processing your request...'}
        </Typography>
        
        <LinearProgress 
          variant="determinate" 
          value={progress ? getProgressValue(progress.status) : 0}
          sx={{ 
            height: 8, 
            borderRadius: 4,
            backgroundColor: 'action.hover',
          }}
        />
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {progress ? `${getProgressValue(progress.status)}%` : '0%'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {progress?.timestamp && new Date(progress.timestamp).toLocaleTimeString()}
          </Typography>
        </Box>
      </Paper>
    </Fade>
  );
};

export default RenderProgressIndicator;