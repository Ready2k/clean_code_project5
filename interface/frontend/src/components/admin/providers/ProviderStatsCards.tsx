/**
 * Provider Statistics Cards Component
 * 
 * Displays comprehensive statistics and analytics for providers,
 * including usage metrics, performance data, and trends.
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Speed as SpeedIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Timeline as TimelineIcon,
  Storage as StorageIcon,
  CloudSync as CloudSyncIcon,
} from '@mui/icons-material';

import { Provider, SystemProviderStats } from '../../../types/providers';

interface ProviderStatsCardsProps {
  providers: Provider[];
  systemStats: SystemProviderStats | null;
  loading: boolean;
}

export const ProviderStatsCards: React.FC<ProviderStatsCardsProps> = ({
  providers = [],
  systemStats,
  loading,
}) => {
  // Calculate provider statistics
  const providerStats = React.useMemo(() => {
    const safeProviders = providers || [];
    const activeProviders = safeProviders.filter(p => p.status === 'active');
    const systemProviders = safeProviders.filter(p => p.isSystem);
    const customProviders = safeProviders.filter(p => !p.isSystem);
    const recentlyTested = safeProviders.filter(p => {
      if (!p.lastTested) return false;
      const testDate = new Date(p.lastTested);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return testDate > dayAgo;
    });

    return {
      total: providers.length,
      active: activeProviders.length,
      system: systemProviders.length,
      custom: customProviders.length,
      recentlyTested: recentlyTested.length,
      testSuccessRate: recentlyTested.length > 0 
        ? (recentlyTested.filter(p => p.testResult?.success).length / recentlyTested.length) * 100
        : 0,
    };
  }, [providers]);

  // Get provider performance data
  const performanceData = React.useMemo(() => {
    const testedProviders = providers.filter(p => p.testResult);
    
    if (testedProviders.length === 0) {
      return {
        averageLatency: 0,
        successRate: 0,
        errorRate: 0,
        fastestProvider: null,
        slowestProvider: null,
      };
    }

    const latencies = testedProviders
      .filter(p => p.testResult?.latency)
      .map(p => p.testResult!.latency!);
    
    const successCount = testedProviders.filter(p => p.testResult?.success).length;
    const averageLatency = latencies.length > 0 
      ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      : 0;
    
    const successRate = (successCount / testedProviders.length) * 100;
    const errorRate = 100 - successRate;

    const fastestProvider = testedProviders.reduce((fastest, current) => {
      if (!fastest.testResult?.latency || !current.testResult?.latency) return fastest;
      return current.testResult.latency < fastest.testResult.latency ? current : fastest;
    }, testedProviders[0]);

    const slowestProvider = testedProviders.reduce((slowest, current) => {
      if (!slowest.testResult?.latency || !current.testResult?.latency) return slowest;
      return current.testResult.latency > slowest.testResult.latency ? current : slowest;
    }, testedProviders[0]);

    return {
      averageLatency,
      successRate,
      errorRate,
      fastestProvider: fastestProvider?.testResult?.latency ? fastestProvider : null,
      slowestProvider: slowestProvider?.testResult?.latency ? slowestProvider : null,
    };
  }, [providers]);

  // Format numbers
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatLatency = (ms: number) => {
    return `${ms.toFixed(0)}ms`;
  };

  const formatPercentage = (percent: number) => {
    return `${percent.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {/* Provider Overview */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <StorageIcon sx={{ mr: 2, color: 'primary.main' }} />
              <Typography variant="h6">Provider Overview</Typography>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {providerStats.total}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Providers
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {providerStats.active}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Providers
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main">
                    {providerStats.system}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    System Providers
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {providerStats.custom}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Custom Providers
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Test Success Rate (24h)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={providerStats.testSuccessRate}
                  color={providerStats.testSuccessRate > 80 ? 'success' : 'warning'}
                  sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {formatPercentage(providerStats.testSuccessRate)}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Performance Metrics */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <SpeedIcon sx={{ mr: 2, color: 'success.main' }} />
              <Typography variant="h6">Performance Metrics</Typography>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Average Latency
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {formatLatency(performanceData.averageLatency)}
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" color="success.main">
                    {formatPercentage(performanceData.successRate)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Success Rate
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={6}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h5" color="error.main">
                    {formatPercentage(performanceData.errorRate)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Error Rate
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Performance Leaders */}
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Performance Leaders
              </Typography>
              
              {performanceData.fastestProvider && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TrendingUpIcon color="success" sx={{ mr: 1, fontSize: 20 }} />
                  <Typography variant="body2">
                    Fastest: {performanceData.fastestProvider.name} 
                    ({formatLatency(performanceData.fastestProvider.testResult!.latency!)})
                  </Typography>
                </Box>
              )}
              
              {performanceData.slowestProvider && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <TrendingDownIcon color="warning" sx={{ mr: 1, fontSize: 20 }} />
                  <Typography variant="body2">
                    Slowest: {performanceData.slowestProvider.name} 
                    ({formatLatency(performanceData.slowestProvider.testResult!.latency!)})
                  </Typography>
                </Box>
              )}
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* System Statistics */}
      {systemStats && (
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <TimelineIcon sx={{ mr: 2, color: 'info.main' }} />
                <Typography variant="h6">System Statistics</Typography>
              </Box>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary">
                      {systemStats.totalModels}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Models
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {systemStats.activeModels}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Models
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="warning.main">
                      {systemStats.totalTemplates}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Templates
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={6}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="info.main">
                      {systemStats.systemTemplates}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      System Templates
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Last Updated
                </Typography>
                <Typography variant="body2">
                  {new Date(systemStats.lastUpdated).toLocaleString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Recent Activity */}
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <CloudSyncIcon sx={{ mr: 2, color: 'warning.main' }} />
              <Typography variant="h6">Recent Activity</Typography>
            </Box>
            
            <List dense>
              {providers
                .filter(p => p.lastTested)
                .sort((a, b) => new Date(b.lastTested!).getTime() - new Date(a.lastTested!).getTime())
                .slice(0, 5)
                .map((provider) => (
                  <ListItem key={provider.id} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        {provider.testResult?.success ? (
                          <CheckCircleIcon color="success" fontSize="small" />
                        ) : (
                          <ErrorIcon color="error" fontSize="small" />
                        )}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={provider.name}
                      secondary={
                        <Box>
                          <Typography variant="body2" component="span">
                            Tested {new Date(provider.lastTested!).toLocaleString()}
                          </Typography>
                          {provider.testResult?.latency && (
                            <Chip
                              label={formatLatency(provider.testResult.latency)}
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              
              {providers.filter(p => p.lastTested).length === 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  No recent test activity. Run provider tests to see activity here.
                </Alert>
              )}
            </List>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default ProviderStatsCards;