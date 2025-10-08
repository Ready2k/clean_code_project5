import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Create as CreateIcon,
  Edit as EditIcon,
  AutoFixHigh as EnhanceIcon,
  PlayArrow as RenderIcon,
  Star as RateIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  SmartToy as AIIcon,
} from '@mui/icons-material';
import { formatDistanceToNow, format } from 'date-fns';
import { promptsAPI } from '../../services/api/promptsAPI';

interface HistoryEntry {
  version: number;
  message: string;
  author: string;
  timestamp: string;
  changes: {
    action: string;
    details: any;
    fieldsChanged?: string[];
  };
  enhancement_model?: string;
  enhancement_provider?: string;
}

interface VersionHistoryProps {
  promptId: string;
}

const getActionIcon = (action: string) => {
  switch (action) {
    case 'create':
      return <CreateIcon color="success" />;
    case 'update':
      return <EditIcon color="primary" />;
    case 'enhance':
      return <EnhanceIcon color="secondary" />;
    case 'render':
      return <RenderIcon color="info" />;
    case 'rate':
      return <RateIcon color="warning" />;
    case 'delete':
      return <DeleteIcon color="error" />;
    default:
      return <EditIcon color="primary" />;
  }
};

const getActionColor = (action: string): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
  switch (action) {
    case 'create':
      return 'success';
    case 'update':
      return 'primary';
    case 'enhance':
      return 'secondary';
    case 'render':
      return 'info';
    case 'rate':
      return 'warning';
    case 'delete':
      return 'error';
    default:
      return 'default';
  }
};

const formatDetails = (details: any, action: string): string => {
  try {
    if (!details) {
      return 'No details available';
    }

    if (typeof details === 'string') {
      return details;
    }

    if (Array.isArray(details)) {
      return details.filter(item => item && typeof item === 'string').join(', ') || 'No details available';
    }

    if (typeof details === 'object' && details !== null) {
      switch (action) {
        case 'enhance':
          return `Task: ${details.taskType || 'unknown'}, Questions: ${details.questionsGenerated || 0}, Confidence: ${Math.round((details.confidence || 0) * 100)}%`;
        case 'render':
          return `Provider: ${details.provider || 'unknown'}, Version: ${details.version || 'unknown'}, Variables: ${details.variablesUsed?.length || 0}`;
        case 'rate':
          return `Score: ${details.score || 'N/A'}/5, Total ratings: ${details.totalRatings || 0}, Average: ${details.averageRating?.toFixed(1) || 'N/A'}`;
        case 'update':
          if (Array.isArray(details.fieldsChanged) && details.fieldsChanged.length > 0) {
            return `Changed: ${details.fieldsChanged.join(', ')}`;
          }
          return 'Updated';
        case 'create':
          return details.details || 'Prompt created';
        case 'delete':
          return `Deleted (version ${details.finalVersion || 'unknown'})`;
        default:
          try {
            return JSON.stringify(details);
          } catch {
            return 'Details available but cannot be displayed';
          }
      }
    }

    return 'No details available';
  } catch (error) {
    console.warn('Error formatting history details:', error);
    return 'Error displaying details';
  }
};

export const VersionHistory: React.FC<VersionHistoryProps> = ({ promptId }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const historyData = await promptsAPI.getPromptHistory(promptId);
        setHistory(historyData || []);
      } catch (err) {
        console.error('Failed to fetch prompt history:', err);
        setError('Failed to load version history');
      } finally {
        setLoading(false);
      }
    };

    if (promptId) {
      fetchHistory();
    }
  }, [promptId]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (history.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="body2" color="text.secondary">
          No version history available for this prompt.
        </Typography>
      </Box>
    );
  }

  // Filter out malformed entries and sort history by timestamp (newest first)
  const validHistory = history.filter(entry => 
    entry && 
    entry.message && 
    entry.timestamp && 
    entry.changes && 
    typeof entry.changes === 'object'
  );
  
  const sortedHistory = [...validHistory].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {history.length} {history.length === 1 ? 'entry' : 'entries'} in version history
      </Typography>

      <List sx={{ width: '100%' }}>
        {sortedHistory.map((entry, index) => {
          // Defensive programming: ensure entry has required structure
          const action = entry.changes?.action || 'unknown';
          const details = entry.changes?.details;
          
          return (
          <React.Fragment key={`${entry.version}-${entry.timestamp}-${index}`}>
            <ListItem alignItems="flex-start" sx={{ px: 0 }}>
              <ListItemIcon sx={{ minWidth: 40, mt: 1 }}>
                {getActionIcon(action)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography variant="subtitle2" component="span">
                      {entry.message || 'Unknown action'}
                    </Typography>
                    <Chip 
                      label={action.toUpperCase()} 
                      size="small" 
                      color={getActionColor(action)}
                      variant="outlined"
                    />
                    {entry.enhancement_model && (
                      <Chip 
                        icon={<AIIcon />}
                        label={`${entry.enhancement_model} (${entry.enhancement_provider})`}
                        size="small" 
                        color="secondary"
                        variant="outlined"
                      />
                    )}
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 1 }}>
                    <Box display="flex" alignItems="center" gap={2} mb={1}>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          {entry.author || 'Unknown'}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <ScheduleIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          {entry.timestamp ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true }) : 'Unknown time'}
                        </Typography>
                      </Box>
                      {entry.timestamp && (
                        <Typography variant="caption" color="text.secondary">
                          ({format(new Date(entry.timestamp), 'MMM d, yyyy HH:mm')})
                        </Typography>
                      )}
                    </Box>
                    
                    {details && (
                      <Paper variant="outlined" sx={{ p: 1.5, mt: 1, bgcolor: 'grey.50' }}>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                          Details:
                        </Typography>
                        <Typography variant="body2">
                          {formatDetails(details, action)}
                        </Typography>
                        
                        {/* Show additional details for complex changes */}
                        {action === 'update' && Array.isArray(details) && details.length > 0 && (
                          <Accordion sx={{ mt: 1, boxShadow: 'none' }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 'auto', p: 0 }}>
                              <Typography variant="caption">
                                View detailed changes ({details.length})
                              </Typography>
                            </AccordionSummary>
                            <AccordionDetails sx={{ p: 0, pt: 1 }}>
                              <List dense>
                                {details.map((change: string, changeIndex: number) => (
                                  <ListItem key={changeIndex} sx={{ py: 0.25, px: 0 }}>
                                    <Typography variant="caption">
                                      • {change}
                                    </Typography>
                                  </ListItem>
                                ))}
                              </List>
                            </AccordionDetails>
                          </Accordion>
                        )}
                      </Paper>
                    )}
                  </Box>
                }
              />
            </ListItem>
            {index < sortedHistory.length - 1 && <Divider variant="inset" component="li" />}
          </React.Fragment>
          );
        })}
      </List>
    </Box>
  );
};

export default VersionHistory;