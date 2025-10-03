/**
 * Admin Dashboard Component
 * 
 * This component contains the original admin dashboard functionality
 * that was previously in AdminPage.tsx. It's been extracted to allow
 * for proper routing in the admin section.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Tooltip,
  Grid,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Switch,
  FormControlLabel,
  LinearProgress,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  Pagination,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircle as ActivateIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Storage as StorageIcon,
  Assignment as LogsIcon,
  Backup as BackupIcon,
  CleaningServices as CleanupIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Memory as MemoryIcon,
  Speed as SpeedIcon,
  Computer as ComputerIcon,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';

import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { 
  fetchUsers, 
  createUser, 
  updateUser, 
  deleteUser, 
  toggleUserStatus 
} from '../../store/slices/adminSlice';
import { User } from '../../types/auth';
import { systemAPI, SystemConfig as APISystemConfig } from '../../services/api/systemAPI';

interface UserFormData {
  username: string;
  email: string;
  password?: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'active' | 'inactive';
}

interface SystemStatus {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    api: ServiceStatus;
    database: ServiceStatus;
    storage: ServiceStatus;
    llm: ServiceStatus;
    redis: ServiceStatus;
  };
  uptime: number;
  version: string;
  timestamp: string;
}

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  lastChecked: string;
  details?: any;
}

interface SystemStats {
  system: {
    uptime: number;
    memory: {
      total: number;
      used: number;
      free: number;
      usage: number;
    };
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    disk: {
      total: number;
      used: number;
      free: number;
      usage: number;
    };
  };
  application: {
    version: string;
    environment: string;
    nodeVersion: string;
    processId: number;
    startTime: string;
  };
  services: {
    prompts: {
      total: number;
      totalRatings: number;
    };
    connections: {
      total: number;
      active: number;
      inactive: number;
      error: number;
      byProvider: Record<string, number>;
    };
    redis: {
      connected: boolean;
      memoryUsage?: number;
      keyCount?: number;
    };
  };
  performance: {
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

interface SystemEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  category: 'system' | 'service' | 'security' | 'performance';
  message: string;
  details?: any;
  source: string;
}

interface SystemLog {
  timestamp: string;
  level: string;
  message: string;
  category: string;
  source: string;
  details?: any;
}

export const AdminDashboard: React.FC = () => {
  const dispatch = useAppDispatch();
  const { users, isLoading, error } = useAppSelector((state) => state.admin);
  
  // Tab management
  const [activeTab, setActiveTab] = useState(0);
  
  // User management state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<User | null>(null);

  // System monitoring state
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [systemConfig, setSystemConfig] = useState<APISystemConfig | null>(null);
  const [systemEvents, setSystemEvents] = useState<SystemEvent[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [isLoadingSystem, setIsLoadingSystem] = useState(false);
  const [systemError, setSystemError] = useState<string | null>(null);
  
  // Logs filtering
  const [logLevel, setLogLevel] = useState<string>('');
  const [logCategory, setLogCategory] = useState<string>('');
  const [logsPage, setLogsPage] = useState(1);
  const [logsPerPage] = useState(50);
  
  // Backup and maintenance
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [backupResult, setBackupResult] = useState<any>(null);
  const [cleanupResult, setCleanupResult] = useState<any>(null);

  const createForm = useForm<UserFormData>();
  const editForm = useForm<UserFormData>();

  useEffect(() => {
    dispatch(fetchUsers());
    loadSystemData();
  }, [dispatch]);

  useEffect(() => {
    // Auto-refresh system data every 2 minutes (reduced frequency)
    const interval = setInterval(() => {
      if (activeTab === 0 && !isLoadingSystem) { // Only refresh if on system status tab and not already loading
        loadSystemData();
      }
    }, 120000); // 2 minutes instead of 30 seconds

    return () => clearInterval(interval);
  }, [activeTab, isLoadingSystem]);

  // System data loading functions with debouncing
  const [lastLoadTime, setLastLoadTime] = useState<number>(0);
  
  const loadSystemData = async () => {
    // Debounce: don't allow calls more frequent than every 10 seconds
    const now = Date.now();
    if (now - lastLoadTime < 10000) {
      console.log('Skipping system data load due to debouncing');
      return;
    }
    
    setLastLoadTime(now);
    setIsLoadingSystem(true);
    setSystemError(null);
    
    try {
      const [status, stats, config, events, logs] = await Promise.all([
        systemAPI.getSystemStatus(),
        systemAPI.getSystemStats(),
        systemAPI.getSystemConfig(),
        systemAPI.getSystemEvents({ limit: 100 }),
        systemAPI.getSystemLogs({ limit: 100 })
      ]);
      
      setSystemStatus(status);
      setSystemStats(stats);
      setSystemConfig(config);
      setSystemEvents(events.events || []);
      setSystemLogs(logs.logs || []);
    } catch (error) {
      setSystemError('Failed to load system data');
      console.error('Failed to load system data:', error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingSystem(false);
    }
  };

  const handleRefreshSystemData = () => {
    loadSystemData();
  };

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    setBackupResult(null);
    
    try {
      const result = await systemAPI.createBackup();
      setBackupResult(result);
    } catch (error) {
      setBackupResult({ error: 'Failed to create backup' });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  const handleCleanupSystem = async () => {
    setIsCleaningUp(true);
    setCleanupResult(null);
    
    try {
      const result = await systemAPI.cleanupSystem();
      setCleanupResult(result);
    } catch (error) {
      setCleanupResult({ error: 'Failed to cleanup system' });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleUpdateSystemConfig = async (updates: Partial<APISystemConfig>) => {
    try {
      const result = await systemAPI.updateSystemConfig(updates);
      setSystemConfig(result.config);
    } catch (error) {
      console.error('Failed to update system config:', error);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleCreateUser = async (data: UserFormData) => {
    try {
      if (!data.password) {
        return; // Password is required for creation
      }
      await dispatch(createUser({
        username: data.username,
        email: data.email,
        password: data.password,
        role: data.role,
        status: data.status,
      })).unwrap();
      setIsCreateDialogOpen(false);
      createForm.reset();
    } catch (error) {
      // Error handled by slice
    }
  };

  const handleEditUser = async (data: UserFormData) => {
    if (!selectedUser) return;
    
    try {
      await dispatch(updateUser({ 
        id: selectedUser.id, 
        data: { ...data, password: data.password || undefined } 
      })).unwrap();
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      editForm.reset();
    } catch (error) {
      // Error handled by slice
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    
    try {
      await dispatch(deleteUser(deleteConfirmUser.id)).unwrap();
      setDeleteConfirmUser(null);
    } catch (error) {
      // Error handled by slice
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      await dispatch(toggleUserStatus(user.id)).unwrap();
    } catch (error) {
      // Error handled by slice
    }
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    editForm.reset({
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status || 'active',
    });
    setIsEditDialogOpen(true);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'error';
      case 'user': return 'primary';
      case 'viewer': return 'default';
      default: return 'default';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
      case 'active':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'down':
      case 'error':
      case 'inactive':
        return 'error';
      default:
        return 'default';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'error':
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'info':
        return <InfoIcon color="info" />;
      default:
        return <SuccessIcon color="success" />;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          System Administration
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefreshSystemData}
          disabled={isLoadingSystem}
        >
          Refresh
        </Button>
      </Box>

      {(error || systemError) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || systemError}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab icon={<DashboardIcon />} label="System Status" />
          <Tab icon={<PeopleIcon />} label="User Management" />
          <Tab icon={<SettingsIcon />} label="Configuration" />
          <Tab icon={<LogsIcon />} label="Logs & Events" />
          <Tab icon={<StorageIcon />} label="Maintenance" />
        </Tabs>
      </Box>

      {/* System Status Tab */}
      {activeTab === 0 && (
        <Box>
          {isLoadingSystem && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
            </Box>
          )}
          
          <Grid container spacing={3}>
            {/* System Overview */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <DashboardIcon color="primary" />
                    <Typography variant="h6">System Overview</Typography>
                  </Box>
                  
                  {systemStatus ? (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Chip
                          label={systemStatus.status.toUpperCase()}
                          color={getStatusColor(systemStatus.status) as any}
                          icon={systemStatus.status === 'healthy' ? <SuccessIcon /> : 
                                systemStatus.status === 'degraded' ? <WarningIcon /> : <ErrorIcon />}
                        />
                        <Typography variant="body2" color="text.secondary">
                          Uptime: {formatUptime(systemStatus.uptime)}
                        </Typography>
                      </Box>
                      
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Version: {systemStatus.version}
                      </Typography>
                      
                      <Typography variant="body2" color="text.secondary">
                        Last Check: {new Date(systemStatus.timestamp).toLocaleString()}
                      </Typography>
                    </>
                  ) : (
                    <Typography color="text.secondary">Loading system status...</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Service Status */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <ComputerIcon color="primary" />
                    <Typography variant="h6">Services</Typography>
                  </Box>
                  
                  {systemStatus?.services ? (
                    <List dense>
                      {Object.entries(systemStatus.services).map(([serviceName, service]) => (
                        <ListItem key={serviceName} disableGutters>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            {serviceName === 'api' && <ComputerIcon />}
                            {serviceName === 'database' && <StorageIcon />}
                            {serviceName === 'storage' && <StorageIcon />}
                            {serviceName === 'llm' && <ComputerIcon />}
                            {serviceName === 'redis' && <MemoryIcon />}
                          </ListItemIcon>
                          <ListItemText
                            primary={serviceName.toUpperCase()}
                            secondary={
                              service.responseTime
                                ? `${service.responseTime}ms`
                                : service.error || 'Running'
                            }
                          />
                          <Chip
                            size="small"
                            label={service.status}
                            color={getStatusColor(service.status) as any}
                            icon={service.status === 'up' ? <SuccessIcon /> : 
                                  service.status === 'degraded' ? <WarningIcon /> : <ErrorIcon />}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary">Loading services...</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* System Stats */}
            {systemStats && (
              <>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <MemoryIcon color="primary" />
                        <Typography variant="h6">Memory</Typography>
                      </Box>
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">Usage</Typography>
                          <Typography variant="body2">
                            {systemStats.system.memory.usage.toFixed(1)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={systemStats.system.memory.usage}
                          color={systemStats.system.memory.usage > 80 ? 'error' : 
                                 systemStats.system.memory.usage > 60 ? 'warning' : 'primary'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {formatBytes(systemStats.system.memory.used)} / {formatBytes(systemStats.system.memory.total)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <SpeedIcon color="primary" />
                        <Typography variant="h6">CPU</Typography>
                      </Box>
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">Usage</Typography>
                          <Typography variant="body2">
                            {systemStats.system.cpu.usage.toFixed(1)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={systemStats.system.cpu.usage}
                          color={systemStats.system.cpu.usage > 80 ? 'error' : 
                                 systemStats.system.cpu.usage > 60 ? 'warning' : 'primary'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Load: {systemStats.system.cpu.loadAverage[0]?.toFixed(2) || 'N/A'}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <StorageIcon color="primary" />
                        <Typography variant="h6">Disk</Typography>
                      </Box>
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">Usage</Typography>
                          <Typography variant="body2">
                            {systemStats.system.disk.usage.toFixed(1)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={systemStats.system.disk.usage}
                          color={systemStats.system.disk.usage > 80 ? 'error' : 
                                 systemStats.system.disk.usage > 60 ? 'warning' : 'primary'}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {formatBytes(systemStats.system.disk.used)} / {formatBytes(systemStats.system.disk.total)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}

            {/* Recent Events */}
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <InfoIcon color="primary" />
                    <Typography variant="h6">Recent Events</Typography>
                  </Box>
                  
                  {systemEvents.length > 0 ? (
                    <List dense>
                      {systemEvents.slice(0, 5).map((event) => (
                        <ListItem key={event.id} divider>
                          <ListItemIcon>
                            {getEventIcon(event.type)}
                          </ListItemIcon>
                          <ListItemText
                            primary={event.message}
                            secondary={`${event.category} • ${new Date(event.timestamp).toLocaleString()}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary">No recent events</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* User Management Tab */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">User Management</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsCreateDialogOpen(true)}
            >
              Add User
            </Button>
          </Box>

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.username}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.role}
                          color={getRoleColor(user.role) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.status || 'active'}
                          color={user.status === 'active' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit User">
                          <IconButton
                            size="small"
                            onClick={() => openEditDialog(user)}
                          >
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={user.status === 'active' ? 'Deactivate' : 'Activate'}>
                          <IconButton
                            size="small"
                            onClick={() => handleToggleUserStatus(user)}
                          >
                            {user.status === 'active' ? <BlockIcon /> : <ActivateIcon />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete User">
                          <IconButton
                            size="small"
                            onClick={() => setDeleteConfirmUser(user)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Configuration Tab */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 3 }}>System Configuration</Typography>
          
          {systemConfig ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Feature Settings</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={systemConfig.features?.enableEnhancement || false}
                            onChange={(e) => handleUpdateSystemConfig({
                              features: { ...systemConfig.features, enableEnhancement: e.target.checked }
                            })}
                          />
                        }
                        label="Enable Prompt Enhancement"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={systemConfig.features?.enableRating || false}
                            onChange={(e) => handleUpdateSystemConfig({
                              features: { ...systemConfig.features, enableRating: e.target.checked }
                            })}
                          />
                        }
                        label="Enable Prompt Rating"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={systemConfig.features?.enableExport || false}
                            onChange={(e) => handleUpdateSystemConfig({
                              features: { ...systemConfig.features, enableExport: e.target.checked }
                            })}
                          />
                        }
                        label="Enable Export Features"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={systemConfig.features?.enableMetrics || false}
                            onChange={(e) => handleUpdateSystemConfig({
                              features: { ...systemConfig.features, enableMetrics: e.target.checked }
                            })}
                          />
                        }
                        label="Enable Metrics Collection"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Security Settings</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        label="JWT Expires In"
                        value={systemConfig.security?.jwtExpiresIn || '1h'}
                        onChange={(e) => handleUpdateSystemConfig({
                          security: { ...systemConfig.security, jwtExpiresIn: e.target.value }
                        })}
                        size="small"
                        helperText="e.g., 1h, 30m, 7d"
                      />
                      <TextField
                        label="Max Login Attempts"
                        type="number"
                        value={systemConfig.security?.maxLoginAttempts || 5}
                        onChange={(e) => handleUpdateSystemConfig({
                          security: { ...systemConfig.security, maxLoginAttempts: parseInt(e.target.value) }
                        })}
                        size="small"
                      />
                      <TextField
                        label="Password Min Length"
                        type="number"
                        value={systemConfig.security?.passwordMinLength || 8}
                        onChange={(e) => handleUpdateSystemConfig({
                          security: { ...systemConfig.security, passwordMinLength: parseInt(e.target.value) }
                        })}
                        size="small"
                      />
                      <TextField
                        label="Lockout Duration (minutes)"
                        type="number"
                        value={systemConfig.security?.lockoutDuration ? systemConfig.security.lockoutDuration / 60000 : 15}
                        onChange={(e) => handleUpdateSystemConfig({
                          security: { ...systemConfig.security, lockoutDuration: parseInt(e.target.value) * 60000 }
                        })}
                        size="small"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Performance Settings</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          label="Request Timeout (ms)"
                          type="number"
                          value={systemConfig.performance?.requestTimeout || 30000}
                          onChange={(e) => handleUpdateSystemConfig({
                            performance: { ...systemConfig.performance, requestTimeout: parseInt(e.target.value) }
                          })}
                          size="small"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          label="Max Concurrent Requests"
                          type="number"
                          value={systemConfig.performance?.maxConcurrentRequests || 100}
                          onChange={(e) => handleUpdateSystemConfig({
                            performance: { ...systemConfig.performance, maxConcurrentRequests: parseInt(e.target.value) }
                          })}
                          size="small"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          label="Rate Limit Window (ms)"
                          type="number"
                          value={systemConfig.performance?.rateLimitWindow || 60000}
                          onChange={(e) => handleUpdateSystemConfig({
                            performance: { ...systemConfig.performance, rateLimitWindow: parseInt(e.target.value) }
                          })}
                          size="small"
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} sm={6} md={3}>
                        <TextField
                          label="Rate Limit Max"
                          type="number"
                          value={systemConfig.performance?.rateLimitMax || 100}
                          onChange={(e) => handleUpdateSystemConfig({
                            performance: { ...systemConfig.performance, rateLimitMax: parseInt(e.target.value) }
                          })}
                          size="small"
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Typography color="text.secondary">Loading configuration...</Typography>
          )}
        </Box>
      )}

      {/* Logs & Events Tab */}
      {activeTab === 3 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">System Logs & Events</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Level</InputLabel>
                <Select
                  value={logLevel}
                  label="Level"
                  onChange={(e) => setLogLevel(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                  <MenuItem value="warning">Warning</MenuItem>
                  <MenuItem value="info">Info</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={logCategory}
                  label="Category"
                  onChange={(e) => setLogCategory(e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="system">System</MenuItem>
                  <MenuItem value="security">Security</MenuItem>
                  <MenuItem value="performance">Performance</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Recent Events</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {systemEvents.length > 0 ? (
                <List>
                  {systemEvents.map((event) => (
                    <ListItem key={event.id} divider>
                      <ListItemIcon>
                        {getEventIcon(event.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={event.message}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              {event.category} • {event.source} • {new Date(event.timestamp).toLocaleString()}
                            </Typography>
                            {event.details && (
                              <Typography variant="caption" color="text.secondary">
                                {JSON.stringify(event.details)}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary">No events found</Typography>
              )}
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">System Logs</Typography>
            </AccordionSummary>
            <AccordionDetails>
              {systemLogs.length > 0 ? (
                <>
                  <List>
                    {systemLogs
                      .filter(log => !logLevel || log.level === logLevel)
                      .filter(log => !logCategory || log.category === logCategory)
                      .slice((logsPage - 1) * logsPerPage, logsPage * logsPerPage)
                      .map((log, index) => (
                        <ListItem key={index} divider>
                          <ListItemText
                            primary={log.message}
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  {log.level.toUpperCase()} • {log.category} • {log.source} • {new Date(log.timestamp).toLocaleString()}
                                </Typography>
                                {log.details && (
                                  <Typography variant="caption" color="text.secondary">
                                    {JSON.stringify(log.details)}
                                  </Typography>
                                )}
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                  </List>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <Pagination
                      count={Math.ceil(systemLogs.length / logsPerPage)}
                      page={logsPage}
                      onChange={(_, page) => setLogsPage(page)}
                    />
                  </Box>
                </>
              ) : (
                <Typography color="text.secondary">No logs found</Typography>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* Maintenance Tab */}
      {activeTab === 4 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 3 }}>System Maintenance</Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <BackupIcon color="primary" />
                    <Typography variant="h6">Backup Management</Typography>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Create a backup of the system data including prompts, users, and configuration.
                  </Typography>
                  
                  <Button
                    variant="contained"
                    startIcon={<BackupIcon />}
                    onClick={handleCreateBackup}
                    disabled={isCreatingBackup}
                    sx={{ mb: 2 }}
                  >
                    {isCreatingBackup ? 'Creating Backup...' : 'Create Backup'}
                  </Button>
                  
                  {backupResult && (
                    <Alert severity={backupResult.error ? 'error' : 'success'}>
                      {backupResult.error || `Backup created: ${backupResult.filename}`}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <CleanupIcon color="primary" />
                    <Typography variant="h6">System Cleanup</Typography>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Clean up temporary files, logs, and optimize database performance.
                  </Typography>
                  
                  <Button
                    variant="outlined"
                    startIcon={<CleanupIcon />}
                    onClick={handleCleanupSystem}
                    disabled={isCleaningUp}
                    sx={{ mb: 2 }}
                  >
                    {isCleaningUp ? 'Cleaning Up...' : 'Run Cleanup'}
                  </Button>
                  
                  {cleanupResult && (
                    <Alert severity={cleanupResult.error ? 'error' : 'success'}>
                      {cleanupResult.error || `Cleanup completed: ${cleanupResult.summary}`}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onClose={() => setIsCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={createForm.handleSubmit(handleCreateUser)} sx={{ mt: 1 }}>
            <TextField
              {...createForm.register('username', { required: 'Username is required' })}
              label="Username"
              fullWidth
              margin="normal"
              error={!!createForm.formState.errors.username}
              helperText={createForm.formState.errors.username?.message}
            />
            <TextField
              {...createForm.register('email', { 
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
              })}
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              error={!!createForm.formState.errors.email}
              helperText={createForm.formState.errors.email?.message}
            />
            <TextField
              {...createForm.register('password', { 
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters'
                }
              })}
              label="Password"
              type="password"
              fullWidth
              margin="normal"
              error={!!createForm.formState.errors.password}
              helperText={createForm.formState.errors.password?.message}
            />
            <TextField
              {...createForm.register('role', { required: 'Role is required' })}
              select
              label="Role"
              fullWidth
              margin="normal"
              defaultValue="user"
              error={!!createForm.formState.errors.role}
              helperText={createForm.formState.errors.role?.message}
            >
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="viewer">Viewer</MenuItem>
            </TextField>
            <TextField
              {...createForm.register('status')}
              select
              label="Status"
              fullWidth
              margin="normal"
              defaultValue="active"
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={createForm.handleSubmit(handleCreateUser)}
            variant="contained"
            disabled={isLoading}
          >
            Create User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onClose={() => setIsEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={editForm.handleSubmit(handleEditUser)} sx={{ mt: 1 }}>
            <TextField
              {...editForm.register('username', { required: 'Username is required' })}
              label="Username"
              fullWidth
              margin="normal"
              error={!!editForm.formState.errors.username}
              helperText={editForm.formState.errors.username?.message}
            />
            <TextField
              {...editForm.register('email', { 
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
              })}
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              error={!!editForm.formState.errors.email}
              helperText={editForm.formState.errors.email?.message}
            />
            <TextField
              {...editForm.register('password')}
              label="Password (leave blank to keep current)"
              type="password"
              fullWidth
              margin="normal"
              helperText="Leave blank to keep current password"
            />
            <TextField
              {...editForm.register('role', { required: 'Role is required' })}
              select
              label="Role"
              fullWidth
              margin="normal"
              error={!!editForm.formState.errors.role}
              helperText={editForm.formState.errors.role?.message}
            >
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="viewer">Viewer</MenuItem>
            </TextField>
            <TextField
              {...editForm.register('status')}
              select
              label="Status"
              fullWidth
              margin="normal"
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={editForm.handleSubmit(handleEditUser)}
            variant="contained"
            disabled={isLoading}
          >
            Update User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmUser} onClose={() => setDeleteConfirmUser(null)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user "{deleteConfirmUser?.username}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmUser(null)}>Cancel</Button>
          <Button 
            onClick={handleDeleteUser}
            color="error"
            variant="contained"
            disabled={isLoading}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminDashboard;