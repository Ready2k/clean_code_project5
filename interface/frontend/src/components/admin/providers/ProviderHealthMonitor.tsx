/**
 * Provider Health Monitor Component
 * 
 * Real-time monitoring dashboard for provider health status,
 * performance metrics, and availability tracking.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  Refresh as RefreshIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';

import { Provider, ProviderHealth } from '../../../types/providers';
import { useAppDispatch } from '../../../hooks/redux';
import { fetchProviderHealth } from '../../../store/slices/providersSlice';

interface ProviderHealthMonitorProps {
  providers: Provider[];
  health: Record<string, ProviderHealth>;
  loading: boolean;
}

export const ProviderHealthMonitor: React.FC<ProviderHealthMonitorProps> = ({
  providers = [],
  health = {},
  loading,
}) => {
  const dispatch = useAppDispatch();
  
  // Local state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [notifications, setNotifications] = useState(true);

  // Auto-refresh health data
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        providers.forEach(provider => {
          dispatch(fetchProviderHealth(provider.id));
        });
      }, 30000); // Refresh every 30 seconds

      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh, providers, dispatch]);

  // Manual refresh
  const handleRefresh = () => {
    providers.forEach(provider => {
      dispatch(fetchProviderHealth(provider.id));
    });
  };

  // Get health status info
  const getHealthStatusInfo = (status: 'healthy' | 'degraded' | 'down') => {
    switch (status) {
      case 'healthy':
        return {
          color: 'success' as const,
          icon: <CheckCircleIcon />,
          label: 'Healthy',
          description: 'All systems operational',
        };
      case 'degraded':
        return {
          color: 'warning' as const,
          icon: <WarningIcon />,
          label: 'Degraded',
          description: 'Performance issues detected',
        };
      case 'down':
        return {
          color: 'error' as const,
          icon: <ErrorIcon />,
          label: 'Down',
          description: 'Service unavailable',
        };
      default:
        return {
          color: 'default' as const,
          icon: <WarningIcon />,
          label: 'Unknown',
          description: 'Status unknown',
        };
    }
  };

  // Calculate overall health statistics
  const healthStats = React.useMemo(() => {
    const healthArray = Object.values(health);
    const total = healthArray.length;
    const healthy = healthArray.filter(h => h.status === 'healthy').length;
    const degraded = healthArray.filter(h => h.status === 'degraded').length;
    const down = healthArray.filter(h => h.status === 'down').length;
    
    const averageResponseTime = healthArray
      .filter(h => h.responseTime)
      .reduce((sum, h) => sum + (h.responseTime || 0), 0) / 
      (healthArray.filter(h => h.responseTime).length || 1);

    const averageUptime = healthArray
      .reduce((sum, h) => sum + h.uptime, 0) / (total || 1);

    return {
      total,
      healthy,
      degraded,
      down,
      healthyPercentage: total > 0 ? (healthy / total) * 100 : 0,
      averageResponseTime,
      averageUptime,
    };
  }, [health]);

  // Format uptime
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Format response time
  const formatResponseTime = (ms: number) => {
    return `${ms.toFixed(0)}ms`;
  };

  // Get provider with health data
  const providersWithHealth = (providers || []).map(provider => ({
    ...provider,
    health: health[provider.id],
  }));

  // Sort by health status (unhealthy first)
  const sortedProviders = providersWithHealth.sort((a, b) => {
    const statusOrder = { down: 0, degraded: 1, healthy: 2 };
    const aStatus = a.health?.status || 'down';
    const bStatus = b.health?.status || 'down';
    return statusOrder[aStatus] - statusOrder[bStatus];
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Health Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CheckCircleIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Overall Health</Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                {healthStats.healthyPercentage.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {healthStats.healthy}/{healthStats.total} providers healthy
              </Typography>
              <LinearProgress
                variant="determinate"
                value={healthStats.healthyPercentage}
                color="success"
                sx={{ mt: 1, height: 6, borderRadius: 3 }}
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SpeedIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Avg Response</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {formatResponseTime(healthStats.averageResponseTime)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average response time
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TimelineIcon sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="h6">Avg Uptime</Typography>
              </Box>
              <Typography variant="h4" color="info.main">
                {formatUptime(healthStats.averageUptime)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average uptime
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <WarningIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">Issues</Typography>
              </Box>
              <Typography variant="h4" color="warning.main">
                {healthStats.degraded + healthStats.down}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Providers with issues
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                }
                label="Auto-refresh (30s)"
              />
              
              <FormControlLabel
                control={
                  <Switch
                    checked={notifications}
                    onChange={(e) => setNotifications(e.target.checked)}
                  />
                }
                label="Notifications"
              />
            </Box>

            <Tooltip title="Refresh Now">
              <IconButton onClick={handleRefresh} color="primary">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* Provider Health List */}
      <Grid container spacing={3}>
        {(sortedProviders || []).map((provider) => {
          const healthData = provider.health;
          const statusInfo = getHealthStatusInfo(healthData?.status || 'down');
          
          return (
            <Grid item xs={12} md={6} lg={4} key={provider.id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  {/* Provider Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ mr: 2, bgcolor: `${statusInfo.color}.main` }}>
                      {statusInfo.icon}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" noWrap>
                        {provider.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {provider.identifier}
                      </Typography>
                    </Box>
                    <Chip
                      label={statusInfo.label}
                      color={statusInfo.color}
                      size="small"
                    />
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Health Metrics */}
                  {healthData ? (
                    <Box>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              Response Time
                            </Typography>
                            <Typography variant="h6" color="primary">
                              {healthData.responseTime 
                                ? formatResponseTime(healthData.responseTime)
                                : 'N/A'
                              }
                            </Typography>
                          </Box>
                        </Grid>
                        
                        <Grid item xs={6}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              Uptime
                            </Typography>
                            <Typography variant="h6" color="success.main">
                              {formatUptime(healthData.uptime)}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Last Check
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <AccessTimeIcon sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {new Date(healthData.lastCheck).toLocaleString()}
                          </Typography>
                        </Box>
                      </Box>

                      {healthData.error && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                          <Typography variant="body2">
                            {healthData.error}
                          </Typography>
                        </Alert>
                      )}
                    </Box>
                  ) : (
                    <Alert severity="info">
                      No health data available. Click refresh to check status.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* No Providers Message */}
      {providers.length === 0 && (
        <Alert severity="info">
          No providers configured. Add providers to monitor their health status.
        </Alert>
      )}
    </Box>
  );
};

export default ProviderHealthMonitor;