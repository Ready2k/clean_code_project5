import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Container,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  CloudUpload as CloudUploadIcon,
  Star as StarIcon,
  Speed as SpeedIcon,
  People as PeopleIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../hooks/redux';
import { fetchSystemStatus, fetchSystemStats } from '../store/slices/systemSlice';
import { fetchPrompts } from '../store/slices/promptsSlice';
import { fetchConnections, testConnection } from '../store/slices/connectionsSlice';
import { fetchUsers } from '../store/slices/adminSlice';

// Dashboard components
import {
  StatCard,

  QuickActions,
  ConnectionStatusWidget,
} from '../components/dashboard';

// Real-time components
import { RealTimeSystemStatus } from '../components/common/RealTimeSystemStatus';
import { RealTimeActivityFeed } from '../components/common/RealTimeActivityFeed';

export const DashboardPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useAppDispatch();

  // Redux state
  const { status: systemStatus, stats: systemStats, isLoading: systemLoading } = useAppSelector(
    (state) => state.system
  );
  const { items: prompts, pagination } = useAppSelector((state) => state.prompts);
  const { items: connections, testResults, isLoading: connectionsLoading } = useAppSelector(
    (state) => state.connections
  );
  const { users } = useAppSelector((state) => state.admin);

  // Load dashboard data
  useEffect(() => {
    dispatch(fetchSystemStatus());
    dispatch(fetchSystemStats());
    dispatch(fetchUsers());
    dispatch(fetchPrompts({ limit: 10 })); // Get recent prompts for activity
    dispatch(fetchConnections());
  }, [dispatch]);

  // Calculate statistics
  const totalPrompts = systemStats?.services?.prompts?.total || pagination?.total || 0;
  const activeConnections = (connections || []).filter(conn => conn.status === 'active').length;
  const totalRatings = systemStats?.services?.prompts?.totalRatings || 0;
  const averageRating = totalRatings > 0 && totalPrompts > 0 
    ? totalRatings / totalPrompts 
    : 0;

  const handleTestConnection = (connectionId: string) => {
    dispatch(testConnection(connectionId));
  };

  return (
    <Box sx={{ py: 1 }}>
      <Box mb={2}>
        <Typography variant="h4" component="h1" sx={{ mb: 0.5 }}>
          Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Welcome to your Prompt Library management interface
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={2} mb={2}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Prompts"
            value={totalPrompts}
            subtitle={systemStats?.services?.connections ? `${systemStats.services.connections.active} active` : undefined}
            icon={<DescriptionIcon />}
            color="primary"
            isLoading={systemLoading}
            trend={
              0
                ? {
                    value: 0,
                    label: 'vs last week',
                    direction: 'up' as const,
                  }
                : undefined
            }
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Connections"
            value={activeConnections}
            subtitle={`${(connections || []).length} total configured`}
            icon={<CloudUploadIcon />}
            color="secondary"
            isLoading={connectionsLoading}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Average Rating"
            value={averageRating.toFixed(1)}
            subtitle="Based on user feedback"
            icon={<StarIcon />}
            color="warning"
            isLoading={systemLoading}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="System Status"
            value={systemStatus?.status?.toUpperCase() || 'UNKNOWN'}
            subtitle={systemStatus ? `${Math.floor(systemStatus.uptime / 3600)}h uptime` : undefined}
            icon={<SpeedIcon />}
            color={
              systemStatus?.status === 'healthy'
                ? 'success'
                : systemStatus?.status === 'degraded'
                ? 'warning'
                : 'error'
            }
            isLoading={systemLoading}
          />
        </Grid>
      </Grid>

      {/* Additional Stats Row (Desktop) */}
      {!isMobile && (
        <Grid container spacing={2} mb={2}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Active Users"
              value={(users || []).filter(u => (u.status || 'active') === 'active').length}
              subtitle={`${(users || []).length} total users`}
              icon={<PeopleIcon />}
              color="info"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Storage Used"
              value={`${systemStats?.system?.disk?.usage?.toFixed(1) || 0}%`}
              subtitle={`${((systemStats?.system?.disk?.used || 0) / 1024 / 1024).toFixed(0)}MB used`}
              icon={<StorageIcon />}
              color={
                (systemStats?.system?.disk?.usage || 0) > 80
                  ? 'error'
                  : (systemStats?.system?.disk?.usage || 0) > 60
                  ? 'warning'
                  : 'success'
              }
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Avg Response Time"
              value={`${systemStats?.performance?.averageResponseTime || 0}ms`}
              subtitle="API performance"
              icon={<SpeedIcon />}
              color="primary"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Error Rate"
              value={`${systemStats?.performance?.errorRate || 0}%`}
              subtitle="Last 24 hours"
              icon={<SpeedIcon />}
              color={
                (systemStats?.performance?.errorRate || 0) > 5
                  ? 'error'
                  : (systemStats?.performance?.errorRate || 0) > 2
                  ? 'warning'
                  : 'success'
              }
            />
          </Grid>
        </Grid>
      )}

      {/* Main Content Grid */}
      <Grid container spacing={2}>
        {/* Left Column */}
        <Grid item xs={12} lg={8}>
          <Grid container spacing={2}>
            {/* Quick Actions */}
            <Grid item xs={12}>
              <QuickActions />
            </Grid>

            {/* Real-time System Health */}
            <Grid item xs={12} md={6}>
              <RealTimeSystemStatus />
            </Grid>

            {/* Connection Status */}
            <Grid item xs={12} md={6}>
              <ConnectionStatusWidget
                connections={connections}
                testResults={testResults}
                isLoading={connectionsLoading}
                onTestConnection={handleTestConnection}
              />
            </Grid>
          </Grid>
        </Grid>

        {/* Right Column - Real-time Activity Feed */}
        <Grid item xs={12} lg={4}>
          <RealTimeActivityFeed />
        </Grid>
      </Grid>
    </Box>
  );
};