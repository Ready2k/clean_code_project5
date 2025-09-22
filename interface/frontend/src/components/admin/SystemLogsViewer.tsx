import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Pagination,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';
import { SystemEvent, SystemLog } from '../../services/api/systemAPI';

interface SystemLogsViewerProps {
  events: SystemEvent[];
  logs: SystemLog[];
  isLoadingEvents: boolean;
  isLoadingLogs: boolean;
  onRefresh: () => void;
  onExportLogs?: () => void;
}

export const SystemLogsViewer: React.FC<SystemLogsViewerProps> = ({
  events,
  logs,
  isLoadingEvents,
  isLoadingLogs,
  onRefresh,
  onExportLogs,
}) => {
  const [logLevel, setLogLevel] = useState<string>('');
  const [logCategory, setLogCategory] = useState<string>('');
  const [logsPage, setLogsPage] = useState(1);
  const logsPerPage = 50;

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

  const getStatusColor = (level: string) => {
    switch (level) {
      case 'error':
      case 'critical':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  const filteredLogs = logs
    .filter(log => !logLevel || log.level === logLevel)
    .filter(log => !logCategory || log.category === logCategory);

  const paginatedLogs = filteredLogs.slice(
    (logsPage - 1) * logsPerPage,
    logsPage * logsPerPage
  );

  return (
    <Box>
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
                onClick={onRefresh}
                disabled={isLoadingLogs || isLoadingEvents}
                fullWidth
              >
                Refresh Logs
              </Button>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={onExportLogs}
                disabled={isLoadingLogs}
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
          {isLoadingEvents ? (
            <Typography variant="body2" color="text.secondary">
              Loading events...
            </Typography>
          ) : events.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No events available
            </Typography>
          ) : (
            <List>
              {events.slice(0, 10).map((event) => (
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
          )}
        </CardContent>
      </Card>

      {/* System Logs */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>System Logs</Typography>
          {isLoadingLogs ? (
            <Typography variant="body2" color="text.secondary">
              Loading logs...
            </Typography>
          ) : filteredLogs.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No logs available
            </Typography>
          ) : (
            <>
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
                    {paginatedLogs.map((log, index) => (
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
                  count={Math.ceil(filteredLogs.length / logsPerPage)}
                  page={logsPage}
                  onChange={(_, page) => setLogsPage(page)}
                />
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};