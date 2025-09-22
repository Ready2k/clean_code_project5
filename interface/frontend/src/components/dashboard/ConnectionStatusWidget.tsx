import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Cloud as CloudIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { LLMConnection, ConnectionTestResult } from '../../types/connections';

interface ConnectionStatusWidgetProps {
  connections: LLMConnection[];
  testResults: Record<string, ConnectionTestResult>;
  isLoading: boolean;
  onTestConnection?: (connectionId: string) => void;
}

export const ConnectionStatusWidget: React.FC<ConnectionStatusWidgetProps> = ({
  connections,
  testResults,
  isLoading,
  onTestConnection,
}) => {


  const getStatusChip = (connection: LLMConnection) => {
    const testResult = testResults[connection.id];
    
    if (testResult) {
      return (
        <Chip
          label={testResult.success ? 'Connected' : 'Failed'}
          color={testResult.success ? 'success' : 'error'}
          size="small"
          variant="outlined"
        />
      );
    }
    
    const statusColors = {
      active: 'success',
      error: 'error',
      inactive: 'warning',
    } as const;
    
    return (
      <Chip
        label={connection.status.charAt(0).toUpperCase() + connection.status.slice(1)}
        color={statusColors[connection.status] || 'default'}
        size="small"
        variant="outlined"
      />
    );
  };

  const getLatencyInfo = (connection: LLMConnection) => {
    const testResult = testResults[connection.id];
    if (testResult?.latency) {
      return `${testResult.latency}ms`;
    }
    return connection.lastTested ? 'Last tested' : 'Not tested';
  };

  const getProviderIcon = (_provider: string) => {
    // You could customize icons based on provider
    return <CloudIcon />;
  };

  const activeConnections = connections.filter(conn => conn.status === 'active').length;
  const totalConnections = connections.length;

  return (
    <Card>
      <CardHeader
        title="Provider Connections"
        subheader={`${activeConnections}/${totalConnections} active`}
        action={
          <Chip
            label={`${totalConnections} total`}
            size="small"
            variant="outlined"
          />
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress />
          </Box>
        ) : connections.length > 0 ? (
          <List disablePadding>
            {connections.slice(0, 5).map((connection) => (
              <ListItem key={connection.id} disableGutters>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {getProviderIcon(connection.provider)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2" fontWeight="medium">
                        {connection.name}
                      </Typography>
                      <Chip
                        label={connection.provider.toUpperCase()}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem', height: 20 }}
                      />
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" color="textSecondary">
                      {getLatencyInfo(connection)}
                    </Typography>
                  }
                />
                <ListItemSecondaryAction>
                  <Box display="flex" alignItems="center" gap={1}>
                    {getStatusChip(connection)}
                    {onTestConnection && (
                      <Tooltip title="Test connection">
                        <IconButton
                          size="small"
                          onClick={() => onTestConnection(connection.id)}
                        >
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        ) : (
          <Box textAlign="center" py={2}>
            <Typography color="textSecondary" variant="body2">
              No connections configured
            </Typography>
            <Typography color="textSecondary" variant="caption">
              Add a provider connection to get started
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};