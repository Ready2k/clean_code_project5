import React from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Download as DownloadIcon,
  GetApp as GetAppIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { removeExportProgress, clearCompletedExports } from '../../../store/slices/exportSlice';

interface ExportProgressTrackerProps {
  compact?: boolean;
}

const ExportProgressTracker: React.FC<ExportProgressTrackerProps> = ({ compact = false }) => {
  const dispatch = useAppDispatch();
  const { activeExports } = useAppSelector((state) => state.export);
  const [expanded, setExpanded] = React.useState(!compact);

  const activeExportsList = Object.values(activeExports);
  const activeCount = activeExportsList.filter(exp => 
    exp.status === 'preparing' || exp.status === 'processing'
  ).length;
  const completedCount = activeExportsList.filter(exp => exp.status === 'completed').length;
  const failedCount = activeExportsList.filter(exp => exp.status === 'failed').length;

  if (activeExportsList.length === 0) {
    return null;
  }

  const handleRemoveExport = (exportId: string) => {
    dispatch(removeExportProgress(exportId));
  };

  const handleClearCompleted = () => {
    dispatch(clearCompletedExports());
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'preparing':
      case 'processing':
        return <ScheduleIcon color="primary" />;
      default:
        return <ScheduleIcon />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'preparing':
      case 'processing':
        return 'primary';
      default:
        return 'default';
    }
  };

  return (
    <Paper sx={{ mb: 2 }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: compact ? 'pointer' : 'default'
        }}
        onClick={compact ? () => setExpanded(!expanded) : undefined}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="subtitle1">
            Export Progress
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {activeCount > 0 && (
              <Chip
                label={`${activeCount} active`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            {completedCount > 0 && (
              <Chip
                label={`${completedCount} completed`}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
            {failedCount > 0 && (
              <Chip
                label={`${failedCount} failed`}
                size="small"
                color="error"
                variant="outlined"
              />
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {(completedCount > 0 || failedCount > 0) && (
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleClearCompleted();
              }}
              title="Clear completed exports"
            >
              <CloseIcon />
            </IconButton>
          )}
          {compact && (
            <IconButton size="small">
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Export List */}
      <Collapse in={expanded}>
        <List dense>
          {activeExportsList.map((exportItem) => (
            <ListItem
              key={exportItem.id}
              secondaryAction={
                (exportItem.status === 'completed' || exportItem.status === 'failed') && (
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => handleRemoveExport(exportItem.id)}
                  >
                    <CloseIcon />
                  </IconButton>
                )
              }
            >
              <ListItemIcon>
                {exportItem.type === 'bulk' ? <GetAppIcon /> : <DownloadIcon />}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2">
                      {exportItem.type === 'bulk' ? 'Bulk Export' : 'Single Export'}
                    </Typography>
                    <Chip
                      icon={getStatusIcon(exportItem.status)}
                      label={exportItem.status}
                      size="small"
                      color={getStatusColor(exportItem.status) as any}
                      sx={{ textTransform: 'capitalize' }}
                    />
                    {exportItem.filename && (
                      <Typography variant="caption" color="text.secondary">
                        {exportItem.filename}
                      </Typography>
                    )}
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {exportItem.message}
                    </Typography>
                    {(exportItem.status === 'preparing' || exportItem.status === 'processing') && (
                      <Box sx={{ mt: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={exportItem.progress}
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {exportItem.progress}% complete
                        </Typography>
                      </Box>
                    )}
                    {exportItem.error && (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {exportItem.error}
                      </Alert>
                    )}
                    {exportItem.size && exportItem.status === 'completed' && (
                      <Typography variant="caption" color="text.secondary">
                        Size: {(exportItem.size / 1024).toFixed(2)} KB
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </Collapse>
    </Paper>
  );
};

export default ExportProgressTracker;