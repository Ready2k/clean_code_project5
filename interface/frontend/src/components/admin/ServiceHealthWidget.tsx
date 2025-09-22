import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Grid,
} from '@mui/material';
import { SystemStatus } from '../../types/system';

interface ServiceHealthWidgetProps {
  status: SystemStatus | null;
}

export const ServiceHealthWidget: React.FC<ServiceHealthWidgetProps> = ({ status }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up':
        return 'success';
      case 'degraded':
        return 'warning';
      case 'down':
        return 'error';
      default:
        return 'default';
    }
  };

  if (!status) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6">Service Health</Typography>
          <Typography variant="body2" color="text.secondary">
            No service data available
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2 }}>Service Health</Typography>
        <Grid container spacing={2}>
          {Object.entries(status.services).map(([serviceName, service]) => (
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
                <Typography variant="caption" color="text.secondary">
                  Last checked: {new Date(service.lastChecked).toLocaleTimeString()}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};