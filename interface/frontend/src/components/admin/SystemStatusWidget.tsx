import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Grid,
  LinearProgress,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Computer as ComputerIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { SystemStatus, SystemStats } from '../../types/system';

interface SystemStatusWidgetProps {
  status: SystemStatus | null;
  stats: SystemStats | null;
  isLoading: boolean;
}

export const SystemStatusWidget: React.FC<SystemStatusWidgetProps> = ({
  status,
  stats,
  isLoading,
}) => {
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
        return 'success';
      case 'degraded':
        return 'warning';
      case 'down':
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <LinearProgress />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading system status...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={3}>
      {/* System Status Overview */}
      {status && (
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DashboardIcon sx={{ mr: 1 }} />
                <Typography variant="h6">System Status</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Chip 
                  label={status.status.toUpperCase()} 
                  color={getStatusColor(status.status) as any}
                  sx={{ mr: 2 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Version: {status.version}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Uptime: {formatUptime(status.uptime)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      )}
      
      {/* Performance Metrics */}
      {stats && (
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SpeedIcon sx={{ mr: 1 }} />
                <Typography variant="h6">Performance</Typography>
              </Box>
              <Typography variant="body2">
                Requests/min: {stats.performance.requestsPerMinute}
              </Typography>
              <Typography variant="body2">
                Avg Response: {stats.performance.averageResponseTime.toFixed(2)}ms
              </Typography>
              <Typography variant="body2">
                Error Rate: {stats.performance.errorRate.toFixed(2)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* System Resources */}
      {stats && (
        <>
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
                    value={stats.system.memory.usage} 
                    color={stats.system.memory.usage > 80 ? 'error' : 'primary'}
                  />
                </Box>
                <Typography variant="body2">
                  {formatBytes(stats.system.memory.used)} / {formatBytes(stats.system.memory.total)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.system.memory.usage.toFixed(1)}% used
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
                    value={stats.system.cpu.usage} 
                    color={stats.system.cpu.usage > 80 ? 'error' : 'primary'}
                  />
                </Box>
                <Typography variant="body2">
                  {stats.system.cpu.usage.toFixed(1)}% used
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Load: {stats.system.cpu.loadAverage[0].toFixed(2)}
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
                    value={stats.system.disk.usage} 
                    color={stats.system.disk.usage > 80 ? 'error' : 'primary'}
                  />
                </Box>
                <Typography variant="body2">
                  {formatBytes(stats.system.disk.used)} / {formatBytes(stats.system.disk.total)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.system.disk.usage.toFixed(1)}% used
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </>
      )}
    </Grid>
  );
};