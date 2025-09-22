import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Speed as SpeedIcon,
  Schedule as ScheduleIcon,
  Memory as MemoryIcon,
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';
import { useAppDispatch } from '../../hooks/redux';
import { testConnection } from '../../store/slices/connectionsSlice';
import { LLMConnection, ConnectionTestResult } from '../../types/connections';

interface ConnectionTestDialogProps {
  open: boolean;
  onClose: () => void;
  connection: LLMConnection;
  testResult?: ConnectionTestResult;
}

export const ConnectionTestDialog: React.FC<ConnectionTestDialogProps> = ({
  open,
  onClose,
  connection,
  testResult
}) => {
  const dispatch = useAppDispatch();
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [currentTestResult, setCurrentTestResult] = useState<ConnectionTestResult | undefined>(testResult);

  useEffect(() => {
    setCurrentTestResult(testResult);
  }, [testResult]);

  const handleRunTest = async () => {
    setIsRunningTest(true);
    try {
      const result = await dispatch(testConnection(connection.id)).unwrap();
      setCurrentTestResult(result.result);
    } catch (error) {
      // Error handling is done in the slice
    } finally {
      setIsRunningTest(false);
    }
  };

  const formatLatency = (latency?: number) => {
    if (!latency) return 'N/A';
    if (latency < 1000) return `${latency}ms`;
    return `${(latency / 1000).toFixed(2)}s`;
  };

  const getLatencyColor = (latency?: number) => {
    if (!latency) return 'default';
    if (latency < 500) return 'success';
    if (latency < 2000) return 'warning';
    return 'error';
  };

  const getStatusInfo = () => {
    if (!currentTestResult) {
      return {
        icon: <ScheduleIcon color="disabled" />,
        text: 'Not tested',
        color: 'default' as const
      };
    }

    if (currentTestResult.success) {
      return {
        icon: <CheckCircleIcon color="success" />,
        text: 'Connection successful',
        color: 'success' as const
      };
    } else {
      return {
        icon: <ErrorIcon color="error" />,
        text: 'Connection failed',
        color: 'error' as const
      };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h6" component="span">
            Connection Test: {connection.name}
          </Typography>
          <Chip
            label={connection.provider.toUpperCase()}
            size="small"
            variant="outlined"
          />
        </Box>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={3}>
          {/* Connection Status */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  {statusInfo.icon}
                  <Typography variant="h6">
                    {statusInfo.text}
                  </Typography>
                  <Chip
                    label={connection.status.toUpperCase()}
                    size="small"
                    color={statusInfo.color}
                    variant="filled"
                  />
                </Box>

                {currentTestResult && (
                  <Typography variant="body2" color="textSecondary">
                    Last tested: {new Date(currentTestResult.testedAt).toLocaleString()}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Test Metrics */}
          {currentTestResult && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Test Metrics
                  </Typography>
                  
                  <List>
                    <ListItem>
                      <ListItemIcon>
                        <SpeedIcon />
                      </ListItemIcon>
                      <ListItemText
                        primary="Response Time"
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2">
                              {formatLatency(currentTestResult.latency)}
                            </Typography>
                            {currentTestResult.latency && (
                              <Chip
                                label={
                                  currentTestResult.latency < 500 ? 'Fast' :
                                  currentTestResult.latency < 2000 ? 'Moderate' : 'Slow'
                                }
                                size="small"
                                color={getLatencyColor(currentTestResult.latency)}
                                variant="outlined"
                              />
                            )}
                          </Box>
                        }
                      />
                    </ListItem>

                    {currentTestResult.availableModels && (
                      <ListItem>
                        <ListItemIcon>
                          <MemoryIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary="Available Models"
                          secondary={`${currentTestResult.availableModels.length} models detected`}
                        />
                      </ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Available Models */}
          {currentTestResult?.availableModels && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Available Models
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {currentTestResult.availableModels.map((model) => (
                      <Chip
                        key={model}
                        label={model}
                        size="small"
                        variant="outlined"
                        color={model === (connection.config as any).defaultModel ? 'primary' : 'default'}
                      />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Error Details */}
          {currentTestResult?.error && (
            <Grid item xs={12}>
              <Alert severity="error">
                <Typography variant="subtitle2" gutterBottom>
                  Error Details
                </Typography>
                <Typography variant="body2">
                  {currentTestResult.error}
                </Typography>
              </Alert>
            </Grid>
          )}

          {/* Connection Configuration */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Connection Configuration
                </Typography>
                
                <List dense>
                  <ListItem>
                    <ListItemText
                      primary="Provider"
                      secondary={connection.provider.toUpperCase()}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText
                      primary="Default Model"
                      secondary={(connection.config as any).defaultModel}
                    />
                  </ListItem>

                  {connection.provider === 'bedrock' && (
                    <ListItem>
                      <ListItemText
                        primary="Region"
                        secondary={(connection.config as any).region}
                      />
                    </ListItem>
                  )}

                  {connection.provider === 'openai' && (connection.config as any).baseUrl && (
                    <ListItem>
                      <ListItemText
                        primary="Base URL"
                        secondary={(connection.config as any).baseUrl}
                      />
                    </ListItem>
                  )}

                  <ListItem>
                    <ListItemText
                      primary="Created"
                      secondary={new Date(connection.createdAt).toLocaleString()}
                    />
                  </ListItem>

                  <ListItem>
                    <ListItemText
                      primary="Last Updated"
                      secondary={new Date(connection.updatedAt).toLocaleString()}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Test Instructions */}
          {!currentTestResult && (
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="subtitle2" gutterBottom>
                  Connection Testing
                </Typography>
                <Typography variant="body2">
                  Click "Run Test" to verify that the connection is working properly. 
                  This will check authentication, measure response time, and discover available models.
                </Typography>
              </Alert>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>
          Close
        </Button>
        <Button
          variant="contained"
          onClick={handleRunTest}
          disabled={isRunningTest}
          startIcon={
            isRunningTest ? (
              <CircularProgress size={20} />
            ) : (
              <PlayArrowIcon />
            )
          }
        >
          {isRunningTest ? 'Testing...' : 'Run Test'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};