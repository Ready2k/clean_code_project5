import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress,
  TablePagination
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  History as HistoryIcon,
  GetApp as GetAppIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import {
  closeHistoryDialog,
  fetchExportHistory
} from '../../../store/slices/exportSlice';
import { exportAPI } from '../../../services/api/exportAPI';

const ExportHistoryDialog: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    historyDialogOpen,
    exportHistory,
    isLoadingHistory,
    error
  } = useAppSelector((state) => state.export);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [typeFilter, setTypeFilter] = useState<'all' | 'single' | 'bulk'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed' | 'expired'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (historyDialogOpen) {
      loadHistory();
    }
  }, [historyDialogOpen, page, rowsPerPage, typeFilter, statusFilter]);

  const loadHistory = () => {
    const filters: any = {
      limit: rowsPerPage,
      offset: page * rowsPerPage
    };

    if (typeFilter !== 'all') {
      filters.type = typeFilter;
    }
    if (statusFilter !== 'all') {
      filters.status = statusFilter;
    }

    dispatch(fetchExportHistory(filters));
  };

  const handleClose = () => {
    dispatch(closeHistoryDialog());
    setPage(0);
    setTypeFilter('all');
    setStatusFilter('all');
    setSearchTerm('');
  };

  const handleDownload = async (exportId: string, filename: string) => {
    try {
      const blob = await exportAPI.downloadFromHistory(exportId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download export:', error);
    }
  };

  const handleDelete = async (exportId: string) => {
    try {
      await exportAPI.deleteExportHistory(exportId);
      loadHistory(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete export:', error);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return dateString ? new Date(dateString).toLocaleString() : 'Unknown date';
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'expired':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'bulk' ? <GetAppIcon /> : <DownloadIcon />;
  };

  const filteredHistory = exportHistory.filter(item =>
    searchTerm === '' || 
    item.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.promptId && item.promptId.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <Dialog
      open={historyDialogOpen}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '700px' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon />
            <Typography variant="h6">Export History</Typography>
          </Box>
          <Button
            onClick={handleClose}
            size="small"
            startIcon={<CloseIcon />}
          >
            Close
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search exports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
              sx={{ minWidth: 200 }}
            />

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                label="Type"
                onChange={(e) => setTypeFilter(e.target.value as any)}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="single">Single</MenuItem>
                <MenuItem value="bulk">Bulk</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="expired">Expired</MenuItem>
              </Select>
            </FormControl>

            <Button
              startIcon={<FilterIcon />}
              onClick={loadHistory}
              variant="outlined"
              size="small"
            >
              Refresh
            </Button>
          </Box>
        </Paper>

        {/* Export History Table */}
        {isLoadingHistory ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredHistory.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <HistoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Export History
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your export history will appear here once you start exporting prompts
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Filename</TableCell>
                  <TableCell>Format</TableCell>
                  <TableCell>Size</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Downloads</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>Expires</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredHistory.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getTypeIcon(item.type)}
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {item.type}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {item.filename}
                      </Typography>
                      {item.promptId && (
                        <Typography variant="caption" color="text.secondary">
                          Prompt: {item.promptId}
                        </Typography>
                      )}
                      {item.promptIds && (
                        <Typography variant="caption" color="text.secondary">
                          {item.promptIds.length} prompts
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.format.toUpperCase()}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatFileSize(item.size)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.status}
                        size="small"
                        color={getStatusColor(item.status) as any}
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {item.downloadCount}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(item.createdAt)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        by {item.createdBy}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {item.expiresAt ? (
                        <Typography variant="body2" color={
                          new Date(item.expiresAt) < new Date() ? 'error.main' : 'text.primary'
                        }>
                          {formatDate(item.expiresAt)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Never
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        {item.status === 'completed' && (
                          <Tooltip title="Download">
                            <IconButton
                              size="small"
                              onClick={() => handleDownload(item.id, item.filename)}
                            >
                              <DownloadIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(item.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <TablePagination
              component="div"
              count={-1} // Unknown total, server-side pagination
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </TableContainer>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Export history is automatically cleaned up after 30 days
        </Typography>
      </DialogActions>
    </Dialog>
  );
};

export default ExportHistoryDialog;