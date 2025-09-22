import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  LinearProgress,
  Grid,
  Tooltip,
  IconButton,
  Collapse,
  Alert
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,

  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Circle as CircleIcon
} from '@mui/icons-material';
import { useAppSelector } from '../../hooks/redux';
import { useWebSocket } from '../../hooks/useWebSocket';

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  lastCheck?: string;
}

interface SystemStatusData {
  status: 'healthy' | 'degraded' | 'down';
  services: Record<string, ServiceStatus>;
  timestamp: string;
}

export const RealTimeSystemStatus: React.FC = () => {
  const { addEventListener } = useWebSocket();
  const systemState = useAppSelector((state) => state.system);
  const [realtimeStatus, setRealtimeStatus] = useState<SystemStatusData | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    // Listen for real-time system status updates
    const unsubscribe = addEventListener('system:status:update', (statusUpdate) => {
      setRealtimeStatus(statusUpdate);
      setLastUpdate(new Date().toLocaleTimeString());
    });

    return unsubscribe;
  }, [addEventListener]);

  // Use real-time status if available, otherwise fall back to Redux state
  const currentStatus = realtimeStatus || (systemState.status ? {
    status: systemState.status.status,
    services: systemState.status.services || {},
    timestamp: systemState.lastUpdated || new Date().toISOString()
  } : null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return <CheckCircleIcon color="success" />;
      case 'degraded':
        return <WarningIcon color="warning" />;
      case 'down':
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <CircleIcon color="disabled" />;
    }
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
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

  const formatResponseTime = (responseTime?: number): string => {
    if (!responseTime) return 'N/A';
    if (responseTime < 1000) return `${responseTime}ms`;
    return `${(responseTime / 1000).toFixed(1)}s`;
  };

  const getOverallHealthScore = (): number => {
    if (!currentStatus?.services) return 0;
    
    const services = Object.values(currentStatus.services);
    if (services.length === 0) return 0;
    
    const healthyServices = services.filter(service => service.status === 'up').length;
    return (healthyServices / services.length) * 100;
  };

  if (!currentStatus) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircleIcon color="disabled" />
            <Typography variant="h6">System Status</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Status information unavailable
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const healthScore = getOverallHealthScore();

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getStatusIcon(currentStatus.status)}
            <Typography variant="h6">System Status</Typography>
            <Chip
              label={currentStatus.status.toUpperCase()}
              color={getStatusColor(currentStatus.status)}
              size="small"
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {lastUpdate && (
              <Tooltip title={`Last updated: ${lastUpdate}`}>
                <Typography variant="caption" color="text.secondary">
                  Live
                </Typography>
              </Tooltip>
            )}
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              aria-label="expand"
            >
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        {/* Health Score */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2">System Health</Typography>
            <Typography variant="body2" color="text.secondary">
              {healthScore.toFixed(0)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={healthScore}
            color={healthScore > 80 ? 'success' : healthScore > 60 ? 'warning' : 'error'}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>

        {/* Service Status Summary */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: expanded ? 2 : 0 }}>
          {Object.entries(currentStatus.services).map(([serviceName, service]) => (
            <Tooltip
              key={serviceName}
              title={`${serviceName}: ${service.status} ${service.responseTime ? `(${formatResponseTime(service.responseTime)})` : ''}`}
            >
              <Chip
                icon={getStatusIcon(service.status)}
                label={serviceName}
                color={getStatusColor(service.status)}
                size="small"
                variant="outlined"
              />
            </Tooltip>
          ))}
        </Box>

        {/* Detailed Service Information */}
        <Collapse in={expanded}>
          <Grid container spacing={2}>
            {Object.entries(currentStatus.services).map(([serviceName, service]) => (
              <Grid item xs={12} sm={6} key={serviceName}>
                <Box
                  sx={{
                    p: 2,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    backgroundColor: service.status === 'up' ? 'success.light' : 
                                   service.status === 'degraded' ? 'warning.light' : 'error.light',
                    opacity: 0.1
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    {getStatusIcon(service.status)}
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {serviceName}
                    </Typography>
                    <Chip
                      label={service.status}
                      color={getStatusColor(service.status)}
                      size="small"
                    />
                  </Box>
                  
                  {service.responseTime && (
                    <Typography variant="body2" color="text.secondary">
                      Response Time: {formatResponseTime(service.responseTime)}
                    </Typography>
                  )}
                  
                  {service.lastCheck && (
                    <Typography variant="caption" color="text.secondary">
                      Last Check: {new Date(service.lastCheck).toLocaleTimeString()}
                    </Typography>
                  )}
                  
                  {service.error && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      <Typography variant="caption">
                        {service.error}
                      </Typography>
                    </Alert>
                  )}
                </Box>
              </Grid>
            ))}
          </Grid>
          
          <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              Last Updated: {new Date(currentStatus.timestamp).toLocaleString()}
            </Typography>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default RealTimeSystemStatus;