/**
 * Provider Management Dashboard Page
 * 
 * This page provides a comprehensive dashboard for managing dynamic providers,
 * including provider list, statistics, health monitoring, and quick actions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  LinearProgress,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Fab,
  Badge,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Dashboard as DashboardIcon,
  Storage as StorageIcon,
  Speed as SpeedIcon,
  MonitorHeart as HealthIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Settings as SettingsIcon,
  Timeline as TimelineIcon,
  CloudSync as CloudSyncIcon,
} from '@mui/icons-material';

import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  fetchProviders,
  fetchSystemStats,
  fetchAllProviderHealth,
  refreshRegistry,
  setProviderFilters,
  clearProviderFilters,
  setProviderPagination,
} from '../../store/slices/providersSlice';
import { ProviderStatus, AuthMethod } from '../../types/providers';

// Import components
import {
  ProviderStatsCards,
  ProviderList,
  ProviderHealthMonitor,
  ProviderFiltersPanel,
  ProviderConfigurationDialog,
  ModelManagementInterface,
  ProviderTemplateLibrary,
} from '../../components/admin/providers';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`provider-tabpanel-${index}`}
      aria-labelledby={`provider-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const ProviderManagementPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    providers,
    systemStats,
    providerHealth,
    filters,
    pagination,
    loading,
    error,
  } = useAppSelector((state) => state.providers);

  // Local state
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Auto-refresh interval
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, [dispatch]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastRefresh > 120000) { // 2 minutes
        loadDashboardData(true);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [lastRefresh]);

  // Load dashboard data
  const loadDashboardData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    
    try {
      await Promise.all([
        dispatch(fetchProviders({
          ...filters.providers,
          search: searchTerm || undefined,
          page: pagination.providers.page,
          limit: pagination.providers.limit,
        })),
        dispatch(fetchSystemStats()),
        dispatch(fetchAllProviderHealth()),
      ]);
      setLastRefresh(Date.now());
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [dispatch, filters.providers, searchTerm, pagination.providers]);

  // Handle search
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    dispatch(setProviderFilters({ search: term || undefined }));
  }, [dispatch]);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: any) => {
    dispatch(setProviderFilters(newFilters));
  }, [dispatch]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(refreshRegistry());
      await loadDashboardData(true);
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, loadDashboardData]);

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Calculate health statistics
  const healthStats = React.useMemo(() => {
    const healthArray = Object.values(providerHealth);
    const total = healthArray.length;
    const healthy = healthArray.filter(h => h.status === 'healthy').length;
    const degraded = healthArray.filter(h => h.status === 'degraded').length;
    const down = healthArray.filter(h => h.status === 'down').length;
    
    return { total, healthy, degraded, down };
  }, [providerHealth]);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'healthy':
        return 'success';
      case 'inactive':
      case 'degraded':
        return 'warning';
      case 'testing':
        return 'info';
      case 'down':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ mb: 1 }}>
            Provider Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage AI providers, models, and configurations
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Tooltip title="Refresh Registry">
            <IconButton
              onClick={handleRefresh}
              disabled={refreshing}
              color="primary"
            >
              {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setIsCreateDialogOpen(true)}
            size="large"
          >
            Add Provider
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error.providers && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error.providers}
        </Alert>
      )}

      {/* Loading Indicator */}
      {loading.providers && (
        <LinearProgress sx={{ mb: 2 }} />
      )}

      {/* Quick Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <StorageIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Total Providers</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {systemStats?.totalProviders || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {systemStats?.activeProviders || 0} active, {systemStats?.inactiveProviders || 0} inactive
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DashboardIcon sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="h6">Total Models</Typography>
              </Box>
              <Typography variant="h4" color="info.main">
                {systemStats?.totalModels || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {systemStats?.activeModels || 0} active models
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <HealthIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Health Status</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Badge badgeContent={healthStats.healthy} color="success">
                  <CheckCircleIcon color="success" />
                </Badge>
                <Badge badgeContent={healthStats.degraded} color="warning">
                  <WarningIcon color="warning" />
                </Badge>
                <Badge badgeContent={healthStats.down} color="error">
                  <ErrorIcon color="error" />
                </Badge>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {healthStats.healthy}/{healthStats.total} healthy
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TimelineIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">Templates</Typography>
              </Box>
              <Typography variant="h4" color="warning.main">
                {systemStats?.totalTemplates || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {systemStats?.systemTemplates || 0} system, {systemStats?.customTemplates || 0} custom
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search providers..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 300 }}
            />
            
            <Button
              variant={showFilters ? 'contained' : 'outlined'}
              startIcon={<FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </Button>

            {Object.keys(filters.providers).length > 0 && (
              <Button
                variant="text"
                onClick={() => dispatch(clearProviderFilters())}
                size="small"
              >
                Clear Filters
              </Button>
            )}

            {/* Active Filter Chips */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {filters.providers.status?.map((status) => (
                <Chip
                  key={status}
                  label={`Status: ${status}`}
                  color={getStatusColor(status) as any}
                  size="small"
                  onDelete={() => {
                    const newStatus = filters.providers.status?.filter(s => s !== status);
                    handleFilterChange({ status: newStatus?.length ? newStatus : undefined });
                  }}
                />
              ))}
              
              {filters.providers.authMethod?.map((method) => (
                <Chip
                  key={method}
                  label={`Auth: ${method}`}
                  size="small"
                  onDelete={() => {
                    const newMethods = filters.providers.authMethod?.filter(m => m !== method);
                    handleFilterChange({ authMethod: newMethods?.length ? newMethods : undefined });
                  }}
                />
              ))}
              
              {filters.providers.isSystem !== undefined && (
                <Chip
                  label={`${filters.providers.isSystem ? 'System' : 'Custom'} Providers`}
                  size="small"
                  onDelete={() => handleFilterChange({ isSystem: undefined })}
                />
              )}
            </Box>
          </Box>

          {/* Filters Panel */}
          {showFilters && (
            <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
              <ProviderFiltersPanel
                filters={filters.providers}
                onChange={handleFilterChange}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab
              icon={<StorageIcon />}
              label="Providers"
              id="provider-tab-0"
              aria-controls="provider-tabpanel-0"
            />
            <Tab
              icon={<DashboardIcon />}
              label="Models"
              id="provider-tab-1"
              aria-controls="provider-tabpanel-1"
            />
            <Tab
              icon={<TimelineIcon />}
              label="Templates"
              id="provider-tab-2"
              aria-controls="provider-tabpanel-2"
            />
            <Tab
              icon={<HealthIcon />}
              label="Health Monitor"
              id="provider-tab-3"
              aria-controls="provider-tabpanel-3"
            />
            <Tab
              icon={<SpeedIcon />}
              label="Performance"
              id="provider-tab-4"
              aria-controls="provider-tabpanel-4"
            />
          </Tabs>
        </Box>

        {/* Providers Tab */}
        <TabPanel value={activeTab} index={0}>
          <ProviderList
            providers={providers}
            loading={loading.providers}
            pagination={pagination.providers}
            onPageChange={(page: number) => dispatch(setProviderPagination({ page }))}
            onLimitChange={(limit: number) => dispatch(setProviderPagination({ limit }))}
          />
        </TabPanel>

        {/* Models Tab */}
        <TabPanel value={activeTab} index={1}>
          <ModelManagementInterface
            showProviderColumn={true}
          />
        </TabPanel>

        {/* Templates Tab */}
        <TabPanel value={activeTab} index={2}>
          <ProviderTemplateLibrary
            onTemplateApplied={(providerId) => {
              // Refresh providers list when template is applied
              loadDashboardData();
            }}
          />
        </TabPanel>

        {/* Health Monitor Tab */}
        <TabPanel value={activeTab} index={3}>
          <ProviderHealthMonitor
            providers={providers}
            health={providerHealth}
            loading={loading.providers}
          />
        </TabPanel>

        {/* Performance Tab */}
        <TabPanel value={activeTab} index={4}>
          <ProviderStatsCards
            providers={providers}
            systemStats={systemStats}
            loading={loading.systemStats}
          />
        </TabPanel>
      </Card>

      {/* Floating Action Button for Quick Add */}
      <Fab
        color="primary"
        aria-label="add provider"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
        onClick={() => setIsCreateDialogOpen(true)}
      >
        <AddIcon />
      </Fab>

      {/* Provider Configuration Dialog */}
      <ProviderConfigurationDialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        mode="create"
      />
    </Box>
  );
};

export default ProviderManagementPage;