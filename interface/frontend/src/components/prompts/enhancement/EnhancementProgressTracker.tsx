import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as PendingIcon,
  Error as ErrorIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { fetchEnhancementStatus, cancelEnhancement } from '../../../store/slices/enhancementSlice';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { EnhancementProgress } from '../../../types/enhancement';

interface EnhancementProgressTrackerProps {
  job: EnhancementProgress | null;
  onProgressUpdate: (progress: EnhancementProgress) => void;
}

export const EnhancementProgressTracker: React.FC<EnhancementProgressTrackerProps> = ({
  job,
  onProgressUpdate,
}) => {
  console.log('🔍 EnhancementProgressTracker: Component rendering', { 
    jobId: job?.jobId, 
    status: job?.status,
    hasResult: !!job?.result 
  });
  
  const dispatch = useAppDispatch();
  const { error, jobs } = useAppSelector((state) => state.enhancement);
  const [, setIsPolling] = React.useState(false);
  
  // Initialize WebSocket for real-time updates
  useWebSocket();

  const stages = [
    {
      key: 'pending',
      label: 'Queued',
      description: 'Enhancement job is queued for processing',
    },
    {
      key: 'analyzing',
      label: 'Analyzing',
      description: 'AI is analyzing your prompt structure and content',
    },
    {
      key: 'enhancing',
      label: 'Enhancing',
      description: 'AI is generating improvements and suggestions',
    },
    {
      key: 'generating_questions',
      label: 'Generating Questions',
      description: 'AI needs additional information to complete enhancement',
    },
    {
      key: 'completed',
      label: 'Complete',
      description: 'Enhancement has been completed successfully',
    },
  ];

  // Listen for real-time updates from WebSocket and update parent component
  React.useEffect(() => {
    if (!job) return;

    const currentJob = jobs[job.jobId];
    console.log('🔄 EnhancementProgressTracker: Job update check', { 
      jobId: job.jobId,
      hasCurrentJob: !!currentJob,
      currentJobStatus: currentJob?.status,
      jobChanged: currentJob !== job
    });
    
    if (currentJob && currentJob !== job) {
      console.log('📤 EnhancementProgressTracker: Sending progress update to parent', {
        status: currentJob.status,
        hasResult: !!currentJob.result
      });
      onProgressUpdate(currentJob);
    }
  }, [jobs, job, onProgressUpdate]);

  // Fallback polling for status updates (in case WebSocket fails)
  React.useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed' || !job.promptId) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    const interval = setInterval(async () => {
      try {
        const result = await dispatch(fetchEnhancementStatus({
          promptId: job.promptId,
          jobId: job.jobId,
        })).unwrap();

        console.log('📤 EnhancementProgressTracker: Sending polling result to parent', {
          status: result.status,
          hasResult: !!result.result
        });
        onProgressUpdate(result);

        // Stop polling if job is complete or failed
        if (result.status === 'completed' || result.status === 'failed') {
          setIsPolling(false);
        }
      } catch (error) {
        console.error('Failed to fetch enhancement status:', error);
        setIsPolling(false);
      }
    }, 5000); // Poll every 5 seconds (less frequent since we have WebSocket)

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [job, dispatch, onProgressUpdate]);

  const handleCancel = async () => {
    if (!job || !job.promptId) return;

    try {
      await dispatch(cancelEnhancement({
        promptId: job.promptId,
        jobId: job.jobId,
      })).unwrap();
    } catch (error) {
      console.error('Failed to cancel enhancement:', error);
    }
  };

  const getStageIcon = (stageKey: string) => {
    if (!job) return <PendingIcon color="disabled" />;

    const currentStageIndex = stages.findIndex(s => s.key === job.status);
    const stageIndex = stages.findIndex(s => s.key === stageKey);

    if (job.status === 'failed') {
      return stageIndex <= currentStageIndex ? <ErrorIcon color="error" /> : <PendingIcon color="disabled" />;
    }

    if (stageIndex < currentStageIndex || (stageIndex === currentStageIndex && job.status === 'completed')) {
      return <CheckIcon color="success" />;
    }

    if (stageIndex === currentStageIndex) {
      return <CircularProgress size={24} />;
    }

    return <PendingIcon color="disabled" />;
  };

  const getStageColor = (stageKey: string) => {
    if (!job) return 'text.disabled';

    const currentStageIndex = stages.findIndex(s => s.key === job.status);
    const stageIndex = stages.findIndex(s => s.key === stageKey);

    if (job.status === 'failed') {
      return stageIndex <= currentStageIndex ? 'error.main' : 'text.disabled';
    }

    if (stageIndex < currentStageIndex || (stageIndex === currentStageIndex && job.status === 'completed')) {
      return 'success.main';
    }

    if (stageIndex === currentStageIndex) {
      return 'primary.main';
    }

    return 'text.disabled';
  };

  if (!job) {
    return (
      <Alert severity="warning">
        No enhancement job found. Please start a new enhancement.
      </Alert>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Enhancement Progress
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Job ID: {job.jobId}
          </Typography>
        </Box>

        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="body2" color="text.secondary">
              {job.message}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {job.progress}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={job.progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        <List>
          {stages.map((stage) => (
            <ListItem key={stage.key} sx={{ py: 1 }}>
              <ListItemIcon>
                {getStageIcon(stage.key)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography 
                    variant="subtitle2" 
                    sx={{ color: getStageColor(stage.key) }}
                  >
                    {stage.label}
                  </Typography>
                }
                secondary={
                  <Typography variant="body2" color="text.secondary">
                    {stage.description}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      {job.status === 'failed' && (
        <Alert severity="error">
          <Typography variant="subtitle2" gutterBottom>
            Enhancement Failed
          </Typography>
          <Typography variant="body2">
            {job.error || 'An unknown error occurred during enhancement.'}
          </Typography>
        </Alert>
      )}

      {job.status === 'generating_questions' && job.result?.questions && (
        <Alert severity="info">
          <Typography variant="subtitle2" gutterBottom>
            Additional Information Needed
          </Typography>
          <Typography variant="body2">
            The AI has generated {job.result.questions.length} questions to improve the enhancement. 
            Please provide answers in the next step.
          </Typography>
        </Alert>
      )}

      {job.status === 'completed' && (
        <Alert severity="success">
          <Typography variant="subtitle2" gutterBottom>
            Enhancement Complete!
          </Typography>
          <Typography variant="body2">
            Your prompt has been successfully enhanced. Review the results in the next step.
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert severity="error">
          {error}
        </Alert>
      )}

      <Box display="flex" justifyContent="flex-end" gap={2}>
        {(job.status === 'pending' || job.status === 'analyzing' || job.status === 'enhancing') && (
          <Button
            variant="outlined"
            color="error"
            onClick={handleCancel}
            startIcon={<CancelIcon />}
          >
            Cancel Enhancement
          </Button>
        )}
      </Box>
    </Box>
  );
};