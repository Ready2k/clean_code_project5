import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Star, TrendingUp, Assessment, People } from '@mui/icons-material';

interface RatingAnalyticsData {
  promptId: string;
  totalRatings: number;
  averageScore: number;
  scoreDistribution: Record<number, number>;
  ratingTrends: Array<{
    date: string;
    averageScore: number;
    count: number;
  }>;
  recentRatings: Array<{
    id: string;
    userId: string;
    username: string;
    score: number;
    note?: string;
    createdAt: string;
  }>;
  topRatedVersions: Array<{
    version: number;
    averageScore: number;
    totalRatings: number;
  }>;
}

interface RatingAnalyticsProps {
  data: RatingAnalyticsData;
  loading?: boolean;
}

const COLORS = ['#f44336', '#ff9800', '#ffeb3b', '#4caf50', '#2196f3'];

export const RatingAnalytics: React.FC<RatingAnalyticsProps> = ({
  data,
  loading = false,
}) => {
  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Rating Analytics
        </Typography>
        <LinearProgress />
      </Paper>
    );
  }

  // Prepare score distribution data for charts
  const scoreDistributionData = [1, 2, 3, 4, 5].map(score => ({
    score: `${score} Star${score > 1 ? 's' : ''}`,
    count: data.scoreDistribution[score] || 0,
    percentage: data.totalRatings > 0 
      ? Math.round(((data.scoreDistribution[score] || 0) / data.totalRatings) * 100)
      : 0,
  }));

  // Prepare pie chart data
  const pieData = scoreDistributionData
    .filter(item => item.count > 0)
    .map((item, index) => ({
      name: item.score,
      value: item.count,
      color: COLORS[index],
    }));

  // Prepare trend data for line chart
  const trendData = data.ratingTrends.map(trend => ({
    date: new Date(trend.date).toLocaleDateString(),
    averageScore: Math.round(trend.averageScore * 100) / 100,
    count: trend.count,
  }));

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return 'success';
    if (score >= 3.5) return 'warning';
    if (score >= 2.5) return 'info';
    return 'error';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 4.5) return '🌟';
    if (score >= 3.5) return '⭐';
    if (score >= 2.5) return '✨';
    return '💫';
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Assessment />
        Rating Analytics
      </Typography>

      <Grid container spacing={3}>
        {/* Summary Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Star color="primary" />
                <Typography variant="h6">
                  {data.averageScore.toFixed(1)}
                </Typography>
                <Chip
                  label={getScoreIcon(data.averageScore)}
                  size="small"
                  color={getScoreColor(data.averageScore) as any}
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Average Rating
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <People color="primary" />
                <Typography variant="h6">
                  {data.totalRatings}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Total Ratings
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp color="primary" />
                <Typography variant="h6">
                  {data.ratingTrends.length > 0 
                    ? data.ratingTrends[data.ratingTrends.length - 1]?.count || 0
                    : 0
                  }
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Recent Activity
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Star color="primary" />
                <Typography variant="h6">
                  {data.topRatedVersions.length > 0 
                    ? `v${data.topRatedVersions[0]?.version || 'N/A'}`
                    : 'N/A'
                  }
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Top Rated Version
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Score Distribution Bar Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Score Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreDistributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="score" />
                <YAxis />
                <Tooltip 
                  formatter={(value) => [
                    `${value} ratings (${scoreDistributionData.find(d => d.count === value)?.percentage}%)`,
                    'Count'
                  ]}
                />
                <Bar dataKey="count" fill="#2196f3" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Score Distribution Pie Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Rating Breakdown
            </Typography>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percentage }) => `${name}: ${value} (${percentage}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
                <Typography variant="body2" color="text.secondary">
                  No rating data available
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Rating Trends */}
        {trendData.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Rating Trends Over Time
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" domain={[0, 5]} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'averageScore' ? `${value}/5` : value,
                      name === 'averageScore' ? 'Average Score' : 'Rating Count'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="averageScore" 
                    stroke="#2196f3" 
                    strokeWidth={2}
                    dot={{ fill: '#2196f3' }}
                    yAxisId="left"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#4caf50" 
                    strokeWidth={2}
                    dot={{ fill: '#4caf50' }}
                    yAxisId="right"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        )}

        {/* Version Performance */}
        {data.topRatedVersions.length > 0 && (
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Version Performance
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {data.topRatedVersions.slice(0, 5).map((version, index) => (
                  <Box key={version.version} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                      label={`v${version.version}`}
                      size="small"
                      color={index === 0 ? 'primary' : 'default'}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">
                          {version.averageScore.toFixed(1)}/5
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {version.totalRatings} ratings
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={(version.averageScore / 5) * 100}
                        color={getScoreColor(version.averageScore) as any}
                      />
                    </Box>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Ratings
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {data.recentRatings.slice(0, 5).map((rating) => (
                <Box
                  key={rating.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                  }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight="medium">
                      {rating.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(rating.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${rating.score}/5`}
                    size="small"
                    color={getScoreColor(rating.score) as any}
                  />
                </Box>
              ))}
              {data.recentRatings.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No recent ratings
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};