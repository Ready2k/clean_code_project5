/**
 * Provider Analytics Dashboard Component
 * 
 * Comprehensive analytics dashboard for provider usage statistics,
 * performance metrics, and usage-based recommendations.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Switch,
  FormControlLabel,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Menu,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Speed as SpeedIcon,
  AttachMoney as AttachMoneyIcon,
  Assessment as AssessmentIcon,
  Lightbulb as LightbulbIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  BarChart as BarChartIcon,
  Timeline as TimelineIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Cell,
} from 'recharts';

interface AnalyticsDashboardData {
  overview: {
    totalProviders: number;
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    averageLatency: number;
    overallErrorRate: number;
  };
  topProviders: ProviderUsageStats[];
  topModels: ModelUsageStats[];
  usageTrends: TimeframeUsage[];
  recommendations: UsageRecommendation[];
  costBreakdown: {
    byProvider: Array<{ providerId: string; name: string; cost: number; percentage: number }>;
    byModel: Array<{ modelId: string; name: string; cost: number; percentage: number }>;
    byUser: Array<{ userId: string; username: string; cost: number; percentage: number }>;
  };
}

interface ProviderUsageStats {
  providerId: string;
  providerName: string;
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
  errorRate: number;
  successRate: number;
  lastUsed: Date;
}

interface ModelUsageStats {
  modelId: string;
  modelName: string;
  requests: number;
  tokens: number;
  cost: number;
  averageLatency: number;
  errorRate: number;
  lastUsed: Date;
}

interface TimeframeUsage {
  timestamp: Date;
  requests: number;
  tokens: number;
  cost: number;
  averageLatency: number;
  errors: number;
}

interface UsageRecommendation {
  type: 'cost_optimization' | 'performance_optimization' | 'model_suggestion' | 'usage_pattern';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  suggestedAction: string;
  potentialSavings?: number;
  affectedProviders: string[];
  confidence: number;
}

interface ProviderAnalyticsDashboardProps {
  onRefresh?: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export const ProviderAnalyticsDashboard: React.FC<ProviderAnalyticsDashboardProps> = ({
  onRefresh,
}) => {
  
  // Local state
  const [data, setData] = useState<AnalyticsDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [dateRange, setDateRange] = useState('30d');
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);

  // Fetch analytics data
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 30);
      }

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const response = await fetch(`/api/admin/usage-analytics/dashboard?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const result = await response.json();
      setData(result.data);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchAnalyticsData, 60000); // Refresh every minute
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh]);

  // Initial data fetch
  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange]);

  // Manual refresh
  const handleRefresh = () => {
    fetchAnalyticsData();
    onRefresh?.();
  };

  // Export data
  const handleExport = async (format: string) => {
    try {
      const params = new URLSearchParams({
        format,
      });

      const response = await fetch(`/api/admin/usage-analytics/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
    
    setExportMenuAnchor(null);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format number
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Get recommendation severity color
  const getRecommendationColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  // Get recommendation icon
  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'cost_optimization':
        return <AttachMoneyIcon />;
      case 'performance_optimization':
        return <SpeedIcon />;
      case 'model_suggestion':
        return <AssessmentIcon />;
      case 'usage_pattern':
        return <TimelineIcon />;
      default:
        return <LightbulbIcon />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
        <Button onClick={handleRefresh} sx={{ ml: 2 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert severity="info">
        No analytics data available.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Usage Analytics Dashboard
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={dateRange}
              label="Date Range"
              onChange={(e) => setDateRange(e.target.value)}
            >
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 90 days</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
            }
            label="Auto-refresh"
          />

          <Tooltip title="Export Data">
            <IconButton 
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
              color="primary"
            >
              <DownloadIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleExport('json')}>
          Export as JSON
        </MenuItem>
      </Menu>

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AssessmentIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Providers</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {data.overview.totalProviders}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active providers
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <BarChartIcon sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Requests</Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                {formatNumber(data.overview.totalRequests)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total requests
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TimelineIcon sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="h6">Tokens</Typography>
              </Box>
              <Typography variant="h4" color="info.main">
                {formatNumber(data.overview.totalTokens)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total tokens
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AttachMoneyIcon sx={{ mr: 1, color: 'warning.main' }} />
                <Typography variant="h6">Cost</Typography>
              </Box>
              <Typography variant="h4" color="warning.main">
                {formatCurrency(data.overview.totalCost)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total cost
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <SpeedIcon sx={{ mr: 1, color: 'secondary.main' }} />
                <Typography variant="h6">Latency</Typography>
              </Box>
              <Typography variant="h4" color="secondary.main">
                {data.overview.averageLatency.toFixed(0)}ms
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average latency
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={2}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ErrorIcon sx={{ mr: 1, color: 'error.main' }} />
                <Typography variant="h6">Error Rate</Typography>
              </Box>
              <Typography variant="h4" color="error.main">
                {data.overview.overallErrorRate.toFixed(1)}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Overall error rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Usage Trends Chart */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Usage Trends
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.usageTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <RechartsTooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="requests" 
                    stroke="#8884d8" 
                    name="Requests"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="cost" 
                    stroke="#82ca9d" 
                    name="Cost ($)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Cost Breakdown Pie Chart */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Cost by Provider
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.costBreakdown.byProvider}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cost"
                  >
                    {data.costBreakdown.byProvider.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => formatCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tables Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Top Providers */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Top Providers
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Provider</TableCell>
                      <TableCell align="right">Requests</TableCell>
                      <TableCell align="right">Cost</TableCell>
                      <TableCell align="right">Error Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.topProviders.slice(0, 5).map((provider) => (
                      <TableRow key={provider.providerId}>
                        <TableCell>{provider.providerName}</TableCell>
                        <TableCell align="right">
                          {formatNumber(provider.totalRequests)}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(provider.totalCost)}
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={`${provider.errorRate.toFixed(1)}%`}
                            color={provider.errorRate > 5 ? 'error' : 'success'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Models */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Top Models
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Model</TableCell>
                      <TableCell align="right">Requests</TableCell>
                      <TableCell align="right">Tokens</TableCell>
                      <TableCell align="right">Latency</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.topModels.slice(0, 5).map((model) => (
                      <TableRow key={model.modelId}>
                        <TableCell>{model.modelName}</TableCell>
                        <TableCell align="right">
                          {formatNumber(model.requests)}
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(model.tokens)}
                        </TableCell>
                        <TableCell align="right">
                          {model.averageLatency.toFixed(0)}ms
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recommendations */}
      {data.recommendations.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Usage Recommendations
            </Typography>
            <List>
              {data.recommendations.map((recommendation, index) => (
                <React.Fragment key={index}>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: `${getRecommendationColor(recommendation.priority)}.main` }}>
                        {getRecommendationIcon(recommendation.type)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1">
                            {recommendation.title}
                          </Typography>
                          <Chip
                            label={recommendation.priority}
                            color={getRecommendationColor(recommendation.priority) as any}
                            size="small"
                          />
                          <Chip
                            label={`${(recommendation.confidence * 100).toFixed(0)}% confidence`}
                            variant="outlined"
                            size="small"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" sx={{ mb: 1 }}>
                            {recommendation.description}
                          </Typography>
                          <Typography variant="body2" color="primary">
                            <strong>Suggested Action:</strong> {recommendation.suggestedAction}
                          </Typography>
                          {recommendation.potentialSavings && (
                            <Typography variant="body2" color="success.main">
                              <strong>Potential Savings:</strong> {formatCurrency(recommendation.potentialSavings)}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < data.recommendations.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default ProviderAnalyticsDashboard;