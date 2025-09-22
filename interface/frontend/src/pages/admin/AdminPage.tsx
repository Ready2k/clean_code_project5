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

export const AdminPage: React.FC = () => {
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
    // Auto-refresh system data every 30 seconds
    const interval = setInterval(() => {
      if (activeTab === 0) { // Only refresh if on system status tab
        loadSystemData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [activeTab]);

  // System data loading functions
  const loadSystemData = async () => {
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
      console.error('Failed to load system data:', error);
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

      {/* Tab Content */}
      {activeTab === 0 && (
        <Box>
          {/* System Status Overview */}
          {systemStatus && (
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <DashboardIcon sx={{ mr: 1 }} />
                      <Typography variant="h6">System Status</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Chip 
                        label={systemStatus.status.toUpperCase()} 
                        color={getStatusColor(systemStatus.status) as any}
                        sx={{ mr: 2 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        Version: {systemStatus.version}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Uptime: {formatUptime(systemStatus.uptime)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <SpeedIcon sx={{ mr: 1 }} />
                      <Typography variant="h6">Performance</Typography>
                    </Box>
                    {systemStats && (
                      <Box>
                        <Typography variant="body2">
                          Requests/min: {systemStats.performance.requestsPerMinute}
                        </Typography>
                        <Typography variant="body2">
                          Avg Response: {systemStats.performance.averageResponseTime.toFixed(2)}ms
                        </Typography>
                        <Typography variant="body2">
                          Error Rate: {systemStats.performance.errorRate.toFixed(2)}%
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Services Status */}
          {systemStatus && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Service Health</Typography>
                <Grid container spacing={2}>
                  {Object.entries(systemStatus.services).map(([serviceName, service]) => (
                    <Grid item xs={12} sm={6} md={4} key={serviceName}>
                      <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ textTransform: 'capitalize', mr: 1 }}>
                            {serviceName}
                          </Typography>
                          <Chip 
                            label={service.status} 
                            color={getStatusColor(service.status) as any}
                            size="small"
                          />
                        </Box>
                        {service.responseTime && (
                          <Typography variant="body2" color="text.secondary">
                            Response: {service.responseTime}ms
                          </Typography>
                        )}
                        {service.error && (
                          <Typography variant="body2" color="error">
                            Error: {service.error}
                          </Typography>
                        )}
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          )}

          {/* System Resources */}
          {systemStats && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <MemoryIcon sx={{ mr: 1 }} />
                      <Typography variant="h6">Memory Usage</Typography>
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={systemStats.system.memory.usage} 
                        color={systemStats.system.memory.usage > 80 ? 'error' : 'primary'}
                      />
                    </Box>
                    <Typography variant="body2">
                      {formatBytes(systemStats.system.memory.used)} / {formatBytes(systemStats.system.memory.total)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {systemStats.system.memory.usage.toFixed(1)}% used
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <ComputerIcon sx={{ mr: 1 }} />
                      <Typography variant="h6">CPU Usage</Typography>
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={systemStats.system.cpu.usage} 
                        color={systemStats.system.cpu.usage > 80 ? 'error' : 'primary'}
                      />
                    </Box>
                    <Typography variant="body2">
                      {systemStats.system.cpu.usage.toFixed(1)}% used
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Load: {systemStats.system.cpu.loadAverage[0].toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <StorageIcon sx={{ mr: 1 }} />
                      <Typography variant="h6">Disk Usage</Typography>
                    </Box>
                    <Box sx={{ mb: 1 }}>
                      <LinearProgress 
                        variant="determinate" 
                        value={systemStats.system.disk.usage} 
                        color={systemStats.system.disk.usage > 80 ? 'error' : 'primary'}
                      />
                    </Box>
                    <Typography variant="body2">
                      {formatBytes(systemStats.system.disk.used)} / {formatBytes(systemStats.system.disk.total)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {systemStats.system.disk.usage.toFixed(1)}% used
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Box>
      )}

      {/* User Management Tab */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5">User Management</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsCreateDialogOpen(true)}
            >
              Create User
            </Button>
          </Box>

          {/* User Statistics */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary">
                    {users.filter(u => u.role === 'admin').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Administrators
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary">
                    {users.filter(u => u.role === 'user').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Users
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="primary">
                    {users.filter(u => u.role === 'viewer').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Viewers
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" color="success.main">
                    {users.filter(u => (u.status || 'active') === 'active').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Users
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Users Table */}
          <Card>
            <CardContent>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Username</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Last Login</TableCell>
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
                            color={getStatusColor(user.status || 'active') as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
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
                          <Tooltip title={user.status === 'active' ? 'Deactivate User' : 'Activate User'}>
                            <IconButton
                              size="small"
                              onClick={() => handleToggleUserStatus(user)}
                              color={user.status === 'active' ? 'warning' : 'success'}
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
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Configuration Tab */}
      {activeTab === 2 && systemConfig && (
        <Box>
          <Typography variant="h5" sx={{ mb: 3 }}>System Configuration</Typography>
          
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Logging Configuration</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Log Level</InputLabel>
                    <Select
                      value={systemConfig.logging.level}
                      onChange={(e) => handleUpdateSystemConfig({
                        logging: { ...systemConfig.logging, level: e.target.value }
                      })}
                    >
                      <MenuItem value="debug">Debug</MenuItem>
                      <MenuItem value="info">Info</MenuItem>
                      <MenuItem value="warn">Warning</MenuItem>
                      <MenuItem value="error">Error</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={systemConfig.logging.enableFileLogging}
                        onChange={(e) => handleUpdateSystemConfig({
                          logging: { ...systemConfig.logging, enableFileLogging: e.target.checked }
                        })}
                      />
                    }
                    label="Enable File Logging"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Max Log Files"
                    type="number"
                    value={systemConfig.logging.maxLogFiles}
                    onChange={(e) => handleUpdateSystemConfig({
                      logging: { ...systemConfig.logging, maxLogFiles: parseInt(e.target.value) }
                    })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Max Log Size"
                    value={systemConfig.logging.maxLogSize}
                    onChange={(e) => handleUpdateSystemConfig({
                      logging: { ...systemConfig.logging, maxLogSize: e.target.value }
                    })}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Performance Settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Request Timeout (ms)"
                    type="number"
                    value={systemConfig.performance.requestTimeout}
                    onChange={(e) => handleUpdateSystemConfig({
                      performance: { ...systemConfig.performance, requestTimeout: parseInt(e.target.value) }
                    })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Max Concurrent Requests"
                    type="number"
                    value={systemConfig.performance.maxConcurrentRequests}
                    onChange={(e) => handleUpdateSystemConfig({
                      performance: { ...systemConfig.performance, maxConcurrentRequests: parseInt(e.target.value) }
                    })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Rate Limit Window (ms)"
                    type="number"
                    value={systemConfig.performance.rateLimitWindow}
                    onChange={(e) => handleUpdateSystemConfig({
                      performance: { ...systemConfig.performance, rateLimitWindow: parseInt(e.target.value) }
                    })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Rate Limit Max Requests"
                    type="number"
                    value={systemConfig.performance.rateLimitMax}
                    onChange={(e) => handleUpdateSystemConfig({
                      performance: { ...systemConfig.performance, rateLimitMax: parseInt(e.target.value) }
                    })}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Security Settings</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="JWT Expires In"
                    value={systemConfig.security.jwtExpiresIn}
                    onChange={(e) => handleUpdateSystemConfig({
                      security: { ...systemConfig.security, jwtExpiresIn: e.target.value }
                    })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Refresh Token Expires In"
                    value={systemConfig.security.refreshTokenExpiresIn}
                    onChange={(e) => handleUpdateSystemConfig({
                      security: { ...systemConfig.security, refreshTokenExpiresIn: e.target.value }
                    })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Password Min Length"
                    type="number"
                    value={systemConfig.security.passwordMinLength}
                    onChange={(e) => handleUpdateSystemConfig({
                      security: { ...systemConfig.security, passwordMinLength: parseInt(e.target.value) }
                    })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Max Login Attempts"
                    type="number"
                    value={systemConfig.security.maxLoginAttempts}
                    onChange={(e) => handleUpdateSystemConfig({
                      security: { ...systemConfig.security, maxLoginAttempts: parseInt(e.target.value) }
                    })}
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Feature Toggles</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={systemConfig.features.enableEnhancement}
                        onChange={(e) => handleUpdateSystemConfig({
                          features: { ...systemConfig.features, enableEnhancement: e.target.checked }
                        })}
                      />
                    }
                    label="Enable Enhancement"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={systemConfig.features.enableRating}
                        onChange={(e) => handleUpdateSystemConfig({
                          features: { ...systemConfig.features, enableRating: e.target.checked }
                        })}
                      />
                    }
                    label="Enable Rating"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={systemConfig.features.enableExport}
                        onChange={(e) => handleUpdateSystemConfig({
                          features: { ...systemConfig.features, enableExport: e.target.checked }
                        })}
                      />
                    }
                    label="Enable Export"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={systemConfig.features.enableMetrics}
                        onChange={(e) => handleUpdateSystemConfig({
                          features: { ...systemConfig.features, enableMetrics: e.target.checked }
                        })}
                      />
                    }
                    label="Enable Metrics"
                  />
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {/* Logs & Events Tab */}
      {activeTab === 3 && (
        <Box>
          <Typography variant="h5" sx={{ mb: 3 }}>System Logs & Events</Typography>
          
          {/* Filters */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Log Level</InputLabel>
                    <Select
                      value={logLevel}
                      onChange={(e) => setLogLevel(e.target.value)}
                    >
                      <MenuItem value="">All Levels</MenuItem>
                      <MenuItem value="info">Info</MenuItem>
                      <MenuItem value="warning">Warning</MenuItem>
                      <MenuItem value="error">Error</MenuItem>
                      <MenuItem value="critical">Critical</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={logCategory}
                      onChange={(e) => setLogCategory(e.target.value)}
                    >
                      <MenuItem value="">All Categories</MenuItem>
                      <MenuItem value="system">System</MenuItem>
                      <MenuItem value="service">Service</MenuItem>
                      <MenuItem value="security">Security</MenuItem>
                      <MenuItem value="performance">Performance</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={loadSystemData}
                    fullWidth
                  >
                    Refresh Logs
                  </Button>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    fullWidth
                  >
                    Export Logs
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* System Events */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Recent System Events</Typography>
              <List>
                {systemEvents.slice(0, 10).map((event) => (
                  <React.Fragment key={event.id}>
                    <ListItem>
                      <ListItemIcon>
                        {getEventIcon(event.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={event.message}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              {new Date(event.timestamp).toLocaleString()} • {event.category} • {event.source}
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
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>

          {/* System Logs */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>System Logs</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Level</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Message</TableCell>
                      <TableCell>Source</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {systemLogs
                      .filter(log => !logLevel || log.level === logLevel)
                      .filter(log => !logCategory || log.category === logCategory)
                      .slice((logsPage - 1) * logsPerPage, logsPage * logsPerPage)
                      .map((log, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant="body2">
                              {new Date(log.timestamp).toLocaleString()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={log.level} 
                              color={getStatusColor(log.level) as any}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{log.category}</TableCell>
                          <TableCell>{log.message}</TableCell>
                          <TableCell>{log.source}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                <Pagination
                  count={Math.ceil(systemLogs.length / logsPerPage)}
                  page={logsPage}
                  onChange={(_, page) => setLogsPage(page)}
                />
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Maintenance Tab */}
      {activeTab === 4 && (
        <Box>
          <Typography variant="h5" sx={{ mb: 3 }}>System Maintenance</Typography>
          
          <Grid container spacing={3}>
            {/* Backup Section */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BackupIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">System Backup</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Create a complete backup of system configuration and data.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={isCreatingBackup ? <CircularProgress size={20} /> : <BackupIcon />}
                    onClick={handleCreateBackup}
                    disabled={isCreatingBackup}
                    fullWidth
                  >
                    {isCreatingBackup ? 'Creating Backup...' : 'Create Backup'}
                  </Button>
                  
                  {backupResult && (
                    <Alert 
                      severity={backupResult.error ? 'error' : 'success'} 
                      sx={{ mt: 2 }}
                    >
                      {backupResult.error || `Backup created successfully: ${backupResult.backup?.id}`}
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Cleanup Section */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <CleanupIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">System Cleanup</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Clean up temporary files, old logs, and cached data.
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={isCleaningUp ? <CircularProgress size={20} /> : <CleanupIcon />}
                    onClick={handleCleanupSystem}
                    disabled={isCleaningUp}
                    fullWidth
                  >
                    {isCleaningUp ? 'Cleaning Up...' : 'Cleanup System'}
                  </Button>
                  
                  {cleanupResult && (
                    <Alert 
                      severity={cleanupResult.error ? 'error' : 'success'} 
                      sx={{ mt: 2 }}
                    >
                      {cleanupResult.error || 
                        `Cleanup completed: ${cleanupResult.results?.tempFilesRemoved || 0} temp files, ${cleanupResult.results?.oldMetricsRemoved || 0} old metrics removed`
                      }
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Storage Information */}
            {systemStats && (
              <Grid item xs={12}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Storage Information</Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="primary">
                            {systemStats.services.prompts.total}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Total Prompts
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="primary">
                            {systemStats.services.prompts.totalRatings}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Total Ratings
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h4" color="primary">
                            {systemStats.services.connections.total}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            LLM Connections
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* Create User Dialog */}
      <Dialog 
        open={isCreateDialogOpen} 
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New User</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Username"
              error={!!createForm.formState.errors.username}
              helperText={createForm.formState.errors.username?.message}
              {...createForm.register('username', {
                required: 'Username is required',
                minLength: {
                  value: 3,
                  message: 'Username must be at least 3 characters',
                },
              })}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Email"
              type="email"
              error={!!createForm.formState.errors.email}
              helperText={createForm.formState.errors.email?.message}
              {...createForm.register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              })}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Password"
              type="password"
              error={!!createForm.formState.errors.password}
              helperText={createForm.formState.errors.password?.message}
              {...createForm.register('password', {
                required: 'Password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters',
                },
              })}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              select
              label="Role"
              defaultValue="user"
              {...createForm.register('role', {
                required: 'Role is required',
              })}
            >
              <MenuItem value="admin">Administrator</MenuItem>
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="viewer">Viewer</MenuItem>
            </TextField>
            <TextField
              margin="normal"
              required
              fullWidth
              select
              label="Status"
              defaultValue="active"
              {...createForm.register('status', {
                required: 'Status is required',
              })}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>
            Cancel
          </Button>
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
      <Dialog 
        open={isEditDialogOpen} 
        onClose={() => setIsEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="Username"
              error={!!editForm.formState.errors.username}
              helperText={editForm.formState.errors.username?.message}
              {...editForm.register('username', {
                required: 'Username is required',
                minLength: {
                  value: 3,
                  message: 'Username must be at least 3 characters',
                },
              })}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label="Email"
              type="email"
              error={!!editForm.formState.errors.email}
              helperText={editForm.formState.errors.email?.message}
              {...editForm.register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              })}
            />
            <TextField
              margin="normal"
              fullWidth
              label="New Password"
              type="password"
              helperText="Leave blank to keep current password"
              error={!!editForm.formState.errors.password}
              {...editForm.register('password', {
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters',
                },
              })}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              select
              label="Role"
              {...editForm.register('role', {
                required: 'Role is required',
              })}
            >
              <MenuItem value="admin">Administrator</MenuItem>
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="viewer">Viewer</MenuItem>
            </TextField>
            <TextField
              margin="normal"
              required
              fullWidth
              select
              label="Status"
              {...editForm.register('status', {
                required: 'Status is required',
              })}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>
            Cancel
          </Button>
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
      <Dialog
        open={!!deleteConfirmUser}
        onClose={() => setDeleteConfirmUser(null)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user "{deleteConfirmUser?.username}"? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmUser(null)}>
            Cancel
          </Button>
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