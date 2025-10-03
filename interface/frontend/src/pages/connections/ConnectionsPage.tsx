import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Tooltip,
  CircularProgress,
  Fab
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  fetchConnections,
  deleteConnection,
  testConnection,
  clearError
} from '../../store/slices/connectionsSlice';
import { LLMConnection } from '../../types/connections';
import { ConnectionForm } from '../../components/connections/ConnectionForm';
import { ConnectionTestDialog } from '../../components/connections/ConnectionTestDialog';

export const ConnectionsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { items: connections, isLoading, error, testResults } = useAppSelector(
    (state) => state.connections
  );
  
  // Initialize WebSocket for real-time updates
  useWebSocket();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<LLMConnection | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info'>('info');

  useEffect(() => {
    dispatch(fetchConnections());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      setSnackbarMessage(error);
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleCreateConnection = () => {
    setSelectedConnection(null);
    setCreateDialogOpen(true);
  };

  const handleEditConnection = (connection: LLMConnection) => {
    setSelectedConnection(connection);
    setEditDialogOpen(true);
  };

  const handleDeleteConnection = (connection: LLMConnection) => {
    setSelectedConnection(connection);
    setDeleteDialogOpen(true);
  };

  const handleTestConnection = (connection: LLMConnection) => {
    setSelectedConnection(connection);
    setTestDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedConnection) {
      try {
        await dispatch(deleteConnection(selectedConnection.id)).unwrap();
        setSnackbarMessage('Connection deleted successfully');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
      } catch (error) {
        setSnackbarMessage('Failed to delete connection');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    }
    setDeleteDialogOpen(false);
    setSelectedConnection(null);
  };

  const handleTestConnectionAction = async (connectionId: string) => {
    try {
      await dispatch(testConnection(connectionId)).unwrap();
      setSnackbarMessage('Connection test completed');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      setSnackbarMessage('Connection test failed');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleTestAllConnections = async () => {
    try {
      // Test all connections in parallel
      const testPromises = (connections || []).map(connection => 
        dispatch(testConnection(connection.id))
      );
      
      await Promise.allSettled(testPromises);
      
      setSnackbarMessage('All connection tests completed');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      setSnackbarMessage('Some connection tests failed');
      setSnackbarSeverity('info');
      setSnackbarOpen(true);
    }
  };

  const getStatusIcon = (status: LLMConnection['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircleIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'inactive':
        return <WarningIcon color="warning" />;
      default:
        return <WarningIcon color="warning" />;
    }
  };

  const getStatusColor = (status: LLMConnection['status']) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'error':
        return 'error';
      case 'inactive':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatLastTested = (lastTested?: string) => {
    if (!lastTested) return 'Never tested';
    const date = new Date(lastTested);
    return date.toLocaleString();
  };

  const getTestResultInfo = (connectionId: string) => {
    const result = testResults[connectionId];
    if (!result) return null;

    return (
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" color="textSecondary">
          Last test: {formatLastTested(result.testedAt)}
        </Typography>
        {result.latency && (
          <Typography variant="caption" color="textSecondary" sx={{ ml: 2 }}>
            Latency: {result.latency}ms
          </Typography>
        )}
        {result.error && (
          <Typography variant="caption" color="error" sx={{ display: 'block' }}>
            Error: {result.error}
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1400, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          LLM Connections
        </Typography>
        <Box>
          <Tooltip title="Refresh connections">
            <IconButton
              onClick={() => dispatch(fetchConnections())}
              disabled={isLoading}
              sx={{ mr: 1 }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {(connections || []).length > 0 && (
            <Button
              variant="outlined"
              startIcon={<TestIcon />}
              onClick={handleTestAllConnections}
              disabled={isLoading}
              sx={{ mr: 1 }}
            >
              Test All
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateConnection}
            disabled={isLoading}
          >
            Add Connection
          </Button>
        </Box>
      </Box>

      {isLoading && (connections || []).length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (connections || []).length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 4 }}>
          <CardContent>
            <Typography variant="h6" color="textSecondary" gutterBottom>
              No connections configured
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Add your first LLM connection to get started with prompt enhancement and rendering.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateConnection}
            >
              Add Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={4} sx={{ justifyContent: 'flex-start' }}>
          {(connections || []).map((connection) => (
            <Grid item xs={12} sm={12} md={10} lg={8} xl={6} key={connection.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  transition: 'all 0.2s ease-in-out',
                  minWidth: 400,
                  maxWidth: 600,
                  mx: 'auto',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                  }
                }}
              >
                <CardContent sx={{ flexGrow: 1, p: 4 }}>
                  {/* Header with provider logo and status */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <Box 
                        sx={{ 
                          width: 56, 
                          height: 56, 
                          borderRadius: 3, 
                          bgcolor: connection.provider === 'openai' ? '#10a37f' : 
                                   connection.provider === 'bedrock' ? '#ff9900' : 'primary.main',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mr: 3,
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '1.5rem',
                          boxShadow: 2
                        }}
                      >
                        {connection.provider === 'openai' ? '🤖' :
                         connection.provider === 'bedrock' ? '☁️' : '🔗'}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography 
                          variant="h5" 
                          sx={{ 
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mb: 0.5
                          }}
                        >
                          {connection.name}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                          {connection.provider.toUpperCase()}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ ml: 2 }}>
                      {getStatusIcon(connection.status)}
                    </Box>
                  </Box>

                  {/* Status Badge */}
                  <Box sx={{ mb: 4 }}>
                    <Chip
                      label={connection.status.toUpperCase()}
                      size="medium"
                      color={getStatusColor(connection.status) as any}
                      variant="filled"
                      sx={{ fontWeight: 600, px: 2, py: 0.5 }}
                    />
                  </Box>

                  {/* Connection Details */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                        Created:
                      </Typography>
                      <Typography variant="body1" fontWeight={600}>
                        {new Date(connection.createdAt).toLocaleDateString()}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                        Last tested:
                      </Typography>
                      <Typography variant="body1" fontWeight={600}>
                        {formatLastTested(connection.lastTested)}
                      </Typography>
                    </Box>

                    {connection.provider === 'openai' && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                          Default model:
                        </Typography>
                        <Chip 
                          label={(connection.config as any).defaultModel} 
                          size="medium" 
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>
                    )}

                    {connection.provider === 'bedrock' && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
                          Region:
                        </Typography>
                        <Chip 
                          label={(connection.config as any).region} 
                          size="medium" 
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      </Box>
                    )}
                  </Box>

                  {/* Test Results */}
                  {getTestResultInfo(connection.id) && (
                    <Box sx={{ mt: 3, p: 3, bgcolor: 'background.default', borderRadius: 2 }}>
                      {getTestResultInfo(connection.id)}
                    </Box>
                  )}
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between', px: 4, pb: 4, pt: 2 }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<TestIcon />}
                    onClick={() => handleTestConnectionAction(connection.id)}
                    disabled={isLoading}
                    sx={{ minWidth: 120, py: 1.5 }}
                  >
                    Test
                  </Button>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="View test details">
                      <IconButton
                        size="medium"
                        onClick={() => handleTestConnection(connection)}
                        disabled={!testResults[connection.id]}
                        sx={{ 
                          bgcolor: testResults[connection.id] ? 'action.hover' : 'transparent',
                          '&:hover': { bgcolor: 'action.selected' },
                          width: 44,
                          height: 44
                        }}
                      >
                        <CheckCircleIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit connection">
                      <IconButton
                        size="medium"
                        onClick={() => handleEditConnection(connection)}
                        sx={{ 
                          '&:hover': { bgcolor: 'action.selected' },
                          width: 44,
                          height: 44
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete connection">
                      <IconButton
                        size="medium"
                        onClick={() => handleDeleteConnection(connection)}
                        color="error"
                        sx={{ 
                          '&:hover': { bgcolor: 'error.light', color: 'error.contrastText' },
                          width: 44,
                          height: 44
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Connection Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add New Connection</DialogTitle>
        <DialogContent>
          <ConnectionForm
            onSuccess={() => {
              setCreateDialogOpen(false);
              setSnackbarMessage('Connection created successfully');
              setSnackbarSeverity('success');
              setSnackbarOpen(true);
            }}
            onCancel={() => setCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Connection Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Connection</DialogTitle>
        <DialogContent>
          <ConnectionForm
            connection={selectedConnection}
            onSuccess={() => {
              setEditDialogOpen(false);
              setSnackbarMessage('Connection updated successfully');
              setSnackbarSeverity('success');
              setSnackbarOpen(true);
            }}
            onCancel={() => setEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Connection</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the connection "{selectedConnection?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Results Dialog */}
      {selectedConnection && (
        <ConnectionTestDialog
          open={testDialogOpen}
          onClose={() => setTestDialogOpen(false)}
          connection={selectedConnection}
          testResult={testResults[selectedConnection.id]}
        />
      )}

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* Floating Action Button for mobile */}
      <Fab
        color="primary"
        aria-label="add connection"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: { xs: 'flex', sm: 'none' }
        }}
        onClick={handleCreateConnection}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};