/**
 * Provider List Component
 * 
 * Displays a comprehensive list of providers with status indicators,
 * actions, and detailed information in a table format.
 */

import React, { useState } from 'react';
import {
  Box,
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
  Avatar,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Alert,
  Badge,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
  Visibility as ViewIcon,
  ContentCopy as CopyIcon,
  Download as ExportIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Cloud as CloudIcon,
  Computer as ComputerIcon,
} from '@mui/icons-material';

import { Provider, ProviderStatus, AuthMethod } from '../../../types/providers';
import { useAppDispatch } from '../../../hooks/redux';
import {
  testProvider,
  deleteProvider,
  setSelectedProvider,
} from '../../../store/slices/providersSlice';

interface ProviderListProps {
  providers: Provider[];
  loading: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export const ProviderList: React.FC<ProviderListProps> = ({
  providers = [],
  loading,
  pagination,
  onPageChange,
  onLimitChange,
}) => {
  const dispatch = useAppDispatch();
  
  // Local state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProvider, setSelectedProviderLocal] = useState<Provider | null>(null);
  const [testingProviders, setTestingProviders] = useState<Set<string>>(new Set());

  // Handle menu open/close
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, provider: Provider) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedProviderLocal(provider);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedProviderLocal(null);
  };

  // Handle provider actions
  const handleViewProvider = (provider: Provider) => {
    dispatch(setSelectedProvider(provider));
    handleMenuClose();
  };

  const handleEditProvider = (provider: Provider) => {
    // TODO: Open edit dialog
    console.log('Edit provider:', provider);
    handleMenuClose();
  };

  const handleTestProvider = async (provider: Provider) => {
    setTestingProviders(prev => new Set(prev).add(provider.id));
    try {
      await dispatch(testProvider(provider.id));
    } finally {
      setTestingProviders(prev => {
        const newSet = new Set(prev);
        newSet.delete(provider.id);
        return newSet;
      });
    }
    handleMenuClose();
  };

  const handleDeleteProvider = async (provider: Provider) => {
    if (window.confirm(`Are you sure you want to delete provider "${provider.name}"?`)) {
      await dispatch(deleteProvider(provider.id));
    }
    handleMenuClose();
  };

  const handleCopyProvider = (provider: Provider) => {
    // TODO: Implement provider duplication
    console.log('Copy provider:', provider);
    handleMenuClose();
  };

  const handleExportProvider = (provider: Provider) => {
    // TODO: Implement provider export
    console.log('Export provider:', provider);
    handleMenuClose();
  };

  // Get status color and icon
  const getStatusInfo = (status: ProviderStatus) => {
    switch (status) {
      case 'active':
        return { color: 'success' as const, icon: <CheckCircleIcon fontSize="small" /> };
      case 'inactive':
        return { color: 'default' as const, icon: <ErrorIcon fontSize="small" /> };
      case 'testing':
        return { color: 'info' as const, icon: <ScheduleIcon fontSize="small" /> };
      default:
        return { color: 'default' as const, icon: <WarningIcon fontSize="small" /> };
    }
  };

  // Get auth method info
  const getAuthMethodInfo = (method: AuthMethod) => {
    switch (method) {
      case 'api_key':
        return { label: 'API Key', color: 'primary' as const };
      case 'oauth2':
        return { label: 'OAuth 2.0', color: 'secondary' as const };
      case 'aws_iam':
        return { label: 'AWS IAM', color: 'warning' as const };
      case 'custom':
        return { label: 'Custom', color: 'info' as const };
      default:
        return { label: method, color: 'default' as const };
    }
  };

  // Get test result info
  const getTestResultInfo = (provider: Provider) => {
    if (!provider.testResult) {
      return { color: 'default' as const, text: 'Not tested', icon: null };
    }

    if (provider.testResult.success) {
      return {
        color: 'success' as const,
        text: `${provider.testResult.latency}ms`,
        icon: <CheckCircleIcon fontSize="small" />,
      };
    } else {
      return {
        color: 'error' as const,
        text: 'Failed',
        icon: <ErrorIcon fontSize="small" />,
      };
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading && (!providers || providers.length === 0)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!providers || providers.length === 0) {
    return (
      <Alert severity="info">
        No providers found. Create your first provider to get started.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Provider</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Auth Method</TableCell>
              <TableCell>Models</TableCell>
              <TableCell>Last Test</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(providers || []).map((provider) => {
              const statusInfo = getStatusInfo(provider.status);
              const authInfo = getAuthMethodInfo(provider.authMethod);
              const testInfo = getTestResultInfo(provider);
              const isTesting = testingProviders.has(provider.id);

              return (
                <TableRow
                  key={provider.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleViewProvider(provider)}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ width: 40, height: 40 }}>
                        {provider.isSystem ? (
                          <ComputerIcon />
                        ) : (
                          <CloudIcon />
                        )}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {provider.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {provider.identifier}
                        </Typography>
                        {provider.description && (
                          <Typography variant="caption" color="text.secondary">
                            {provider.description}
                          </Typography>
                        )}
                      </Box>
                      {provider.isSystem && (
                        <Chip
                          label="System"
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Chip
                      icon={statusInfo.icon}
                      label={provider.status}
                      color={statusInfo.color}
                      size="small"
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>

                  <TableCell>
                    <Chip
                      label={authInfo.label}
                      color={authInfo.color}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">
                      {/* TODO: Get actual model count */}
                      - models
                    </Typography>
                  </TableCell>

                  <TableCell>
                    {provider.lastTested ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {testInfo.icon}
                        <Box>
                          <Typography variant="body2" color={`${testInfo.color}.main`}>
                            {testInfo.text}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(provider.lastTested)}
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Never tested
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(provider.createdAt)}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {/* Test Button */}
                      <Tooltip title="Test Provider">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestProvider(provider);
                          }}
                          disabled={isTesting}
                        >
                          {isTesting ? (
                            <CircularProgress size={16} />
                          ) : (
                            <TestIcon />
                          )}
                        </IconButton>
                      </Tooltip>

                      {/* More Actions Menu */}
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(e, provider)}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Rows per page:
          </Typography>
          <FormControl size="small" sx={{ minWidth: 80 }}>
            <Select
              value={pagination.limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            {((pagination.page - 1) * pagination.limit) + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </Typography>
        </Box>

        <Pagination
          count={Math.ceil(pagination.total / pagination.limit)}
          page={pagination.page}
          onChange={(_, page) => onPageChange(page)}
          color="primary"
        />
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={handleMenuClose}
      >
        <MenuItem onClick={() => selectedProvider && handleViewProvider(selectedProvider)}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => selectedProvider && handleEditProvider(selectedProvider)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Provider</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => selectedProvider && handleTestProvider(selectedProvider)}>
          <ListItemIcon>
            <TestIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Test Connection</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => selectedProvider && handleCopyProvider(selectedProvider)}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => selectedProvider && handleExportProvider(selectedProvider)}>
          <ListItemIcon>
            <ExportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export</ListItemText>
        </MenuItem>

        {selectedProvider && !selectedProvider.isSystem && (
          <MenuItem
            onClick={() => selectedProvider && handleDeleteProvider(selectedProvider)}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};

export default ProviderList;