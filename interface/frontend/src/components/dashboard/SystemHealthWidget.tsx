import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Storage as StorageIcon,
  Cloud as CloudIcon,
  Api as ApiIcon,
  Dataset as DatabaseIcon,
} from '@mui/icons-material';
import { SystemStatus } from '../../types/system';

interface SystemHealthWidgetProps {
  status: SystemStatus | null;
  isLoading: boolean;
}

export const SystemHealthWidget: React.FC<SystemHealthWidgetProps> = ({
  status,
  isLoading,
}) => {
  const getStatusIcon = (serviceStatus: string) => {
    switch (serviceStatus) {
      case 'up':
        return <CheckCircleIcon color="success" />;
      case 'degraded':
        return <WarningIcon color="warning" />;
      case 'down':
        return <ErrorIcon color="error" />;
      default:
        return <ErrorIcon color="disabled" />;
    }
  };

  const getServiceIcon = (serviceName: string) => {
    switch (serviceName) {
      case 'api':
        return <ApiIcon />;
      case 'database':
        return <DatabaseIcon />;
      case 'storage':
        return <StorageIcon />;
      case 'llm':
        return <CloudIcon />;
      default:
        return <CheckCircleIcon />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'down':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatUptime = (uptime: number) => {
    const days = Math.floor(uptime / (24 * 60 * 60));
    const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((uptime % (60 * 60)) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  return (
    <Card>
      <CardHeader
        title="System Health"
        action={
          status && (
            <Chip
              label={status.status.toUpperCase()}
              color={getStatusColor(status.status) as any}
              variant="outlined"
            />
          )
        }
      />
      <CardContent>
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress />
          </Box>
        ) : status ? (
          <>
            <Box mb={2}>
              <Typography variant="body2" color="textSecondary">
                Uptime: {formatUptime(status.uptime)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Version: {status.version}
              </Typography>
            </Box>
            
            <List dense>
              {Object.entries(status.services).map(([serviceName, serviceStatus]) => (
                <ListItem key={serviceName} disableGutters>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {getServiceIcon(serviceName)}
                  </ListItemIcon>
                  <ListItemText
                    primary={serviceName.toUpperCase()}
                    secondary={
                      serviceStatus.responseTime
                        ? `${serviceStatus.responseTime}ms`
                        : serviceStatus.error || 'No additional info'
                    }
                  />
                  <Box ml={1}>
                    {getStatusIcon(serviceStatus.status)}
                  </Box>
                </ListItem>
              ))}
            </List>
          </>
        ) : (
          <Typography color="textSecondary">
            Unable to load system status
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};