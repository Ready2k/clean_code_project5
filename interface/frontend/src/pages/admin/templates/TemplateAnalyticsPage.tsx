/**
 * Template Analytics Page Component
 * 
 * Comprehensive analytics dashboard for monitoring template usage, performance,
 * and effectiveness with real-time metrics and visualizations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAppSelector } from '../../../hooks/redux';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Tooltip,
  IconButton,
  Button,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Speed as SpeedIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  People as UsersIcon,
  Timeline as TimelineIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
} from '@mui/icons-material';

// Types
interface UsageStats {
  templateId: string;
  totalUsage: number;
  uniqueUsers: number;
  averageRenderTime: number;
  successRate: number;
  timeRange: TimeRange;
  usageByProvider: Record<string, number>;
  usageByTaskType: Record<string, number>;
}

interface PerformanceMetrics {
  templateId: string;
  averageRenderTime: number;
  p95RenderTime: number;
  cacheHitRate: number;
  errorRate: number;
  timeRange: TimeRange;
}

interface TimeRange {
  start: Date;
  end: Date;
}

interface UsageReport {
  templateId: string;
  timeRange: TimeRange;
  totalUsage: number;
  uniqueUsers: number;
  usageByDay: Array<{ date: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  usageByProvider: Record<string, number>;
  usageByTaskType: Record<string, number>;
}

interface TemplateRanking {
  templateId: string;
  name: string;
  category: string;
  score: number;
  metrics: {
    usage: number;
    performance: number;
    successRate: number;
  };
}

interface AnalyticsSummary {
  totalTemplates: number;
  activeTemplates: number;
  totalUsage: number;
  averagePerformance: number;
  topPerformingTemplates: TemplateRanking[];
  recentActivity: Array<{
    templateId: string;
    templateName: string;
    action: string;
    timestamp: Date;
    userId?: string;
  }>;
}

const TIME_RANGES = [
  { value: '1h', label: 'Last Hour' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
];

export const TemplateAnalyticsPage: React.FC = () => {
  const { templateId } = useParams<{ templateId?: string }>();
  const { token } = useAppSelector((state) => state.auth);
  
  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [refreshing, setRefreshing] = useState(false);
  
  // Analytics data
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [usageReport, setUsageReport] = useState<UsageReport | null>(null);
  const [rankings, setRankings] = useState<TemplateRanking[]>([]);

  // Load analytics data
  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check authentication
      if (!token) {
        setError('Authentication required');
        return;
      }

      if (templateId && templateId !== 'overview') {
        // Load specific template analytics
        const [statsResponse, metricsResponse, reportResponse] = await Promise.all([
          fetch(`http://localhost:8000/api/admin/prompt-templates/${templateId}/analytics/usage?timeRange=${timeRange}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          }),
          fetch(`http://localhost:8000/api/admin/prompt-templates/${templateId}/analytics/performance?timeRange=${timeRange}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          }),
          fetch(`http://localhost:8000/api/admin/prompt-templates/${templateId}/analytics/usage?timeRange=${timeRange}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          }),
        ]);

        if (!statsResponse.ok || !metricsResponse.ok || !reportResponse.ok) {
          throw new Error('Failed to load template analytics');
        }

        const [stats, metrics, report] = await Promise.all([
          statsResponse.json(),
          metricsResponse.json(),
          reportResponse.json(),
        ]);

        setUsageStats(stats);
        setPerformanceMetrics(metrics);
        setUsageReport(report);
      } else {
        // Load overview analytics
        const [summaryResponse, rankingsResponse] = await Promise.all([
          fetch(`http://localhost:8000/api/admin/prompt-templates/analytics/dashboard?timeRange=${timeRange}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          }),
          fetch(`http://localhost:8000/api/admin/prompt-templates/analytics/ranking?timeRange=${timeRange}&limit=10`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          }),
        ]);

        if (!summaryResponse.ok || !rankingsResponse.ok) {
          throw new Error('Failed to load analytics overview');
        }

        const [summaryData, rankingsData] = await Promise.all([
          summaryResponse.json(),
          rankingsResponse.json(),
        ]);

        setSummary(summaryData);
        setRankings(rankingsData.rankings || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [templateId, timeRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const handleExport = async () => {
    try {
      const endpoint = templateId && templateId !== 'overview'
        ? `/api/admin/prompt-templates/${templateId}/analytics/export`
        : '/api/admin/prompt-templates/analytics/export';
      
      const response = await fetch(`${endpoint}?timeRange=${timeRange}`);
      if (!response.ok) {
        throw new Error('Failed to export analytics');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `template-analytics-${timeRange}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export analytics');
    }
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num == null || isNaN(num)) return '0';
    return new Intl.NumberFormat().format(num);
  };

  const formatPercentage = (num: number | null | undefined) => {
    if (num == null || isNaN(num)) return '0.0%';
    return `${(num * 100).toFixed(1)}%`;
  };

  const formatDuration = (ms: number | null | undefined) => {
    if (ms == null || isNaN(ms)) return '0.0ms';
    return `${ms.toFixed(1)}ms`;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const isOverview = !templateId || templateId === 'overview';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h2">
          {isOverview ? 'Analytics Overview' : 'Template Analytics'}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value)}
            >
              {TIME_RANGES.map(range => (
                <MenuItem key={range.value} value={range.value}>
                  {range.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            size="small"
          >
            Export
          </Button>
        </Stack>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Refresh Progress */}
      {refreshing && <LinearProgress sx={{ mb: 2 }} />}

      {/* Overview Analytics */}
      {isOverview && summary && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Total Templates
                      </Typography>
                      <Typography variant="h4">
                        {formatNumber(summary.totalTemplates)}
                      </Typography>
                    </Box>
                    <TimelineIcon color="primary" sx={{ fontSize: 40 }} />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Active Templates
                      </Typography>
                      <Typography variant="h4">
                        {formatNumber(summary.activeTemplates)}
                      </Typography>
                    </Box>
                    <SuccessIcon color="success" sx={{ fontSize: 40 }} />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Total Usage
                      </Typography>
                      <Typography variant="h4">
                        {formatNumber(summary.totalUsage)}
                      </Typography>
                    </Box>
                    <TrendingUpIcon color="primary" sx={{ fontSize: 40 }} />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Avg Performance
                      </Typography>
                      <Typography variant="h4">
                        {formatDuration(summary.averagePerformance)}
                      </Typography>
                    </Box>
                    <SpeedIcon color="info" sx={{ fontSize: 40 }} />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Top Performing Templates */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Top Performing Templates
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Template</TableCell>
                          <TableCell>Category</TableCell>
                          <TableCell>Score</TableCell>
                          <TableCell>Usage</TableCell>
                          <TableCell>Performance</TableCell>
                          <TableCell>Success Rate</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rankings.map((template, index) => (
                          <TableRow key={template.templateId}>
                            <TableCell>
                              <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography variant="body2" fontWeight="medium">
                                  #{index + 1}
                                </Typography>
                                <Typography variant="body2">
                                  {template.name}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Chip label={template.category} size="small" />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight="medium">
                                {template.score != null && !isNaN(template.score) ? template.score.toFixed(1) : '0.0'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {formatNumber(template.metrics?.usage)}
                            </TableCell>
                            <TableCell>
                              {formatDuration(template.metrics?.performance)}
                            </TableCell>
                            <TableCell>
                              {formatPercentage(template.metrics?.successRate)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Recent Activity
                  </Typography>
                  <Stack spacing={1}>
                    {(summary?.recentActivity || []).map((activity, index) => (
                      <Box key={index} sx={{ p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="body2" fontWeight="medium">
                          {activity?.templateName || 'Unknown'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {activity?.action || 'Unknown'} • {activity?.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Unknown time'}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}

      {/* Specific Template Analytics */}
      {!isOverview && usageStats && performanceMetrics && usageReport && (
        <>
          {/* Usage Statistics */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Total Usage
                      </Typography>
                      <Typography variant="h4">
                        {formatNumber(usageStats.totalUsage)}
                      </Typography>
                    </Box>
                    <TrendingUpIcon color="primary" sx={{ fontSize: 40 }} />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Unique Users
                      </Typography>
                      <Typography variant="h4">
                        {formatNumber(usageStats.uniqueUsers)}
                      </Typography>
                    </Box>
                    <UsersIcon color="info" sx={{ fontSize: 40 }} />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Avg Render Time
                      </Typography>
                      <Typography variant="h4">
                        {formatDuration(usageStats.averageRenderTime)}
                      </Typography>
                    </Box>
                    <SpeedIcon color="warning" sx={{ fontSize: 40 }} />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="text.secondary" gutterBottom>
                        Success Rate
                      </Typography>
                      <Typography variant="h4">
                        {formatPercentage(usageStats.successRate)}
                      </Typography>
                    </Box>
                    <SuccessIcon color="success" sx={{ fontSize: 40 }} />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Detailed Analytics */}
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Usage by Provider
                  </Typography>
                  <Stack spacing={1}>
                    {Object.entries(usageStats?.usageByProvider || {}).map(([provider, count]) => (
                      <Box key={provider}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2">{provider}</Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {formatNumber(count)}
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={usageStats?.totalUsage ? (count / usageStats.totalUsage) * 100 : 0}
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Performance Metrics
                  </Typography>
                  <Stack spacing={2}>
                    <Box>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Average Render Time</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {formatDuration(performanceMetrics.averageRenderTime)}
                        </Typography>
                      </Stack>
                    </Box>
                    <Box>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">95th Percentile</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {formatDuration(performanceMetrics.p95RenderTime)}
                        </Typography>
                      </Stack>
                    </Box>
                    <Box>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Cache Hit Rate</Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {formatPercentage(performanceMetrics.cacheHitRate)}
                        </Typography>
                      </Stack>
                    </Box>
                    <Box>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Error Rate</Typography>
                        <Typography variant="body2" fontWeight="medium" color={(performanceMetrics?.errorRate || 0) > 0.05 ? 'error.main' : 'text.primary'}>
                          {formatPercentage(performanceMetrics?.errorRate)}
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Usage Trends
                  </Typography>
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell>Usage Count</TableCell>
                          <TableCell>Trend</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {usageReport.usageByDay.slice(-7).map((day, index, array) => {
                          const prevDay = array[index - 1];
                          const trend = prevDay ? day.count - prevDay.count : 0;
                          
                          return (
                            <TableRow key={day.date}>
                              <TableCell>
                                {new Date(day.date).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                {formatNumber(day.count)}
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                  {trend > 0 ? (
                                    <TrendingUpIcon color="success" fontSize="small" />
                                  ) : trend < 0 ? (
                                    <TrendingDownIcon color="error" fontSize="small" />
                                  ) : null}
                                  <Typography variant="body2" color={trend > 0 ? 'success.main' : trend < 0 ? 'error.main' : 'text.secondary'}>
                                    {trend > 0 ? '+' : ''}{trend}
                                  </Typography>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};