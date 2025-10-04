import React, { useState, useEffect } from 'react';
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
  TextField,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as ViewIcon,
  GetApp as GetAppIcon,
} from '@mui/icons-material';
import { SystemEvent, SystemLog, systemAPI } from '../../services/api/systemAPI';

interface LogFile {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  type: 'backend' | 'frontend' | 'system';
}

interface LogStats {
  totalFiles: number;
  totalSize: number;
  oldestLog?: string;
  newestLog?: string;
  logCounts: {
    error: number;
    warn: number;
    info: number;
    debug: number;
  };
}

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
  const [activeTab, setActiveTab] = useState(0);
  const [logLevel, setLogLevel] = useState<string>('');
  const [logCategory, setLogCategory] = useState<string>('');
  const [logsPage, setLogsPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLogFile, setSelectedLogFile] = useState<string>('');
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [logStats, setLogStats] = useState<LogStats | null>(null);
  const [recentErrors, setRecentErrors] = useState<SystemLog[]>([]);
  const [fileContent, setFileContent] = useState<{ logs: SystemLog[]; total: number } | null>(null);
  const [searchResults, setSearchResults] = useState<{ logs: SystemLog[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logsPerPage = 50;

  // Load log files and stats on component mount
  useEffect(() => {
    loadLogFiles();
    loadLogStats();
    loadRecentErrors();
  }, []);

  const loadLogFiles = async () => {
    try {
      setLoading(true);
      const response = await systemAPI.getLogFiles();
      setLogFiles(response.data);
    } catch (err) {
      setError('Failed to load log files');
      console.error('Failed to load log files:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLogStats = async () => {
    try {
      const response = await systemAPI.getLogStats();
      setLogStats(response.data);
    } catch (err) {
      console.error('Failed to load log stats:', err);
    }
  };

  const loadRecentErrors = async () => {
    try {
      const response = await systemAPI.getRecentErrors({ limit: 20 });
      setRecentErrors(response.data);
    } catch (err) {
      console.error('Failed to load recent errors:', err);
    }
  };

  const loadFileContent = async (filename: string) => {
    try {
      setLoading(true);
      const response = await systemAPI.getLogFileContent(filename, {
        level: logLevel || undefined,
        limit: logsPerPage,
        offset: (logsPage - 1) * logsPerPage
      });
      setFileContent(response.data);
    } catch (err) {
      setError(`Failed to load content for ${filename}`);
      console.error('Failed to load file content:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      const response = await systemAPI.searchLogs({
        query: searchQuery,
        level: logLevel || undefined,
        limit: 100
      });
      setSearchResults(response.data);
      setActiveTab(3); // Switch to search results tab
    } catch (err) {
      setError('Failed to search logs');
      console.error('Failed to search logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (filename: string) => {
    setSelectedLogFile(filename);
    setLogsPage(1);
    loadFileContent(filename);
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
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
    <Box sx={{ p: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Card sx={{ mb: 4 }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: 48,
              textTransform: 'none',
              fontSize: '0.95rem',
              fontWeight: 500
            }
          }}
        >
          <Tab label="System Events" />
          <Tab label="Log Files" />
          <Tab label="Statistics" />
          <Tab label="Search" />
          <Tab label="Recent Errors" />
        </Tabs>
      </Card>

      {/* Filters */}
      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ py: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>
            Filters & Actions
          </Typography>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Log Level</InputLabel>
                <Select
                  value={logLevel}
                  onChange={(e) => setLogLevel(e.target.value)}
                >
                  <MenuItem value="">All Levels</MenuItem>
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="warn">Warning</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                  <MenuItem value="debug">Debug</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Search Logs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={handleSearch} disabled={loading}>
                      <SearchIcon />
                    </IconButton>
                  )
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => {
                  onRefresh();
                  loadLogFiles();
                  loadLogStats();
                  loadRecentErrors();
                }}
                disabled={loading || isLoadingLogs || isLoadingEvents}
                fullWidth
              >
                Refresh All
              </Button>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={onExportLogs}
                disabled={loading || isLoadingLogs}
                fullWidth
              >
                Export Logs
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tab Content */}
      {activeTab === 0 && (
        <Card sx={{ minHeight: 400 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <InfoIcon color="primary" />
              Recent System Events
            </Typography>
            {isLoadingEvents ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : events.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No events available
              </Typography>
            ) : (
              <List sx={{ '& .MuiListItem-root': { py: 2 } }}>
                {events.slice(0, 10).map((event) => (
                  <React.Fragment key={event.id}>
                    <ListItem sx={{ px: 2 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {getEventIcon(event.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5 }}>
                            {event.message}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
                              {new Date(event.timestamp).toLocaleString()} • {event.category} • {event.source}
                            </Typography>
                            {event.details && (
                              <Typography variant="caption" color="text.secondary" sx={{ 
                                fontFamily: 'monospace',
                                backgroundColor: 'grey.100',
                                p: 0.5,
                                borderRadius: 0.5,
                                display: 'inline-block'
                              }}>
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
      )}

      {/* Log Files Tab */}
      {activeTab === 1 && (
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: 'fit-content' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <GetAppIcon color="primary" />
                  Available Log Files
                </Typography>
                {loading ? (
                  <Box display="flex" justifyContent="center" p={2}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <List sx={{ '& .MuiListItem-root': { py: 1.5, px: 2, borderRadius: 1, mb: 1 } }}>
                    {logFiles.map((file) => (
                      <ListItem
                        key={file.name}
                        button
                        selected={selectedLogFile === file.name}
                        onClick={() => handleFileSelect(file.name)}
                        sx={{
                          '&.Mui-selected': {
                            backgroundColor: 'primary.light',
                            color: 'primary.contrastText',
                            '&:hover': {
                              backgroundColor: 'primary.main',
                            }
                          }
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                              {file.name}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Typography variant="caption" display="block" sx={{ mb: 0.25 }}>
                                {formatFileSize(file.size)} • {file.type}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Modified: {new Date(file.lastModified).toLocaleString()}
                              </Typography>
                            </Box>
                          }
                        />
                        <Tooltip title="View file content">
                          <IconButton size="small" sx={{ ml: 1 }}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={8}>
            <Card sx={{ minHeight: 500 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ViewIcon color="primary" />
                  {selectedLogFile ? `Content: ${selectedLogFile}` : 'Select a log file to view content'}
                </Typography>
                {fileContent && (
                  <>
                    <TableContainer sx={{ maxHeight: 400, mb: 2 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.50' }}>Timestamp</TableCell>
                            <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.50' }}>Level</TableCell>
                            <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.50' }}>Service</TableCell>
                            <TableCell sx={{ fontWeight: 600, backgroundColor: 'grey.50' }}>Message</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {fileContent.logs.map((log, index) => (
                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { backgroundColor: 'grey.25' } }}>
                              <TableCell sx={{ py: 2 }}>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                  {new Date(log.timestamp).toLocaleString()}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ py: 2 }}>
                                <Chip 
                                  label={log.level} 
                                  color={getStatusColor(log.level) as any}
                                  size="small"
                                  sx={{ fontWeight: 500 }}
                                />
                              </TableCell>
                              <TableCell sx={{ py: 2 }}>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {log.source}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ py: 2 }}>
                                <Typography variant="body2" sx={{ 
                                  maxWidth: 500, 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  lineHeight: 1.4
                                }}>
                                  {log.message}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                      <Pagination
                        count={Math.ceil(fileContent.total / logsPerPage)}
                        page={logsPage}
                        onChange={(_, page) => {
                          setLogsPage(page);
                          if (selectedLogFile) {
                            loadFileContent(selectedLogFile);
                          }
                        }}
                      />
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Statistics Tab */}
      {activeTab === 2 && (
        <Grid container spacing={4}>
          {logStats && (
            <>
              <Grid item xs={12} md={3}>
                <Card sx={{ textAlign: 'center', p: 2 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>Total Files</Typography>
                    <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold' }}>
                      {logStats.totalFiles}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card sx={{ textAlign: 'center', p: 2 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>Total Size</Typography>
                    <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold' }}>
                      {formatFileSize(logStats.totalSize)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card sx={{ textAlign: 'center', p: 2 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>Error Count</Typography>
                    <Typography variant="h3" color="error" sx={{ fontWeight: 'bold' }}>
                      {logStats.logCounts.error}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={3}>
                <Card sx={{ textAlign: 'center', p: 2 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary' }}>Warning Count</Typography>
                    <Typography variant="h3" color="warning.main" sx={{ fontWeight: 'bold' }}>
                      {logStats.logCounts.warn}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12}>
                <Card sx={{ mt: 2 }}>
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h6" sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <InfoIcon color="primary" />
                      Log Level Distribution
                    </Typography>
                    <Grid container spacing={4}>
                      <Grid item xs={6} md={3}>
                        <Box textAlign="center" sx={{ p: 2, borderRadius: 2, backgroundColor: 'error.light', color: 'error.contrastText' }}>
                          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>{logStats.logCounts.error}</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>Errors</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Box textAlign="center" sx={{ p: 2, borderRadius: 2, backgroundColor: 'warning.light', color: 'warning.contrastText' }}>
                          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>{logStats.logCounts.warn}</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>Warnings</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Box textAlign="center" sx={{ p: 2, borderRadius: 2, backgroundColor: 'info.light', color: 'info.contrastText' }}>
                          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>{logStats.logCounts.info}</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>Info</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={6} md={3}>
                        <Box textAlign="center" sx={{ p: 2, borderRadius: 2, backgroundColor: 'grey.300', color: 'text.primary' }}>
                          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>{logStats.logCounts.debug}</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>Debug</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}
        </Grid>
      )}

      {/* Search Results Tab */}
      {activeTab === 3 && (
        <Card sx={{ minHeight: 400 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SearchIcon color="primary" />
              Search Results {searchResults && `(${searchResults.total} found)`}
            </Typography>
            {searchResults ? (
              searchResults.logs.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Level</TableCell>
                        <TableCell>Service</TableCell>
                        <TableCell>Message</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {searchResults.logs.map((log, index) => (
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
                          <TableCell>{log.source}</TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {log.message}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No results found for "{searchQuery}"
                </Typography>
              )
            ) : (
              <Typography variant="body2" color="text.secondary">
                Enter a search query and click search to find logs
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Errors Tab */}
      {activeTab === 4 && (
        <Card sx={{ minHeight: 400 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
              <ErrorIcon color="error" />
              Recent Error Logs
            </Typography>
            {recentErrors.length > 0 ? (
              <List sx={{ '& .MuiListItem-root': { py: 2, px: 2, borderRadius: 1, mb: 1, backgroundColor: 'error.light', color: 'error.contrastText' } }}>
                {recentErrors.map((error, index) => (
                  <React.Fragment key={index}>
                    <ListItem sx={{ backgroundColor: 'error.light', borderRadius: 1, mb: 2 }}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <ErrorIcon color="error" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body1" sx={{ fontWeight: 500, mb: 0.5, color: 'text.primary' }}>
                            {error.message}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" display="block" sx={{ mb: 0.5, color: 'text.secondary' }}>
                              {new Date(error.timestamp).toLocaleString()} • {error.source}
                            </Typography>
                            {error.details && (
                              <Typography variant="caption" sx={{ 
                                fontFamily: 'monospace',
                                backgroundColor: 'grey.100',
                                color: 'text.primary',
                                p: 0.5,
                                borderRadius: 0.5,
                                display: 'inline-block'
                              }}>
                                {JSON.stringify(error.details)}
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <SuccessIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" color="success.main" sx={{ mb: 1 }}>
                  No Recent Errors
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Your system is running smoothly!
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

    </Box>
  );
};