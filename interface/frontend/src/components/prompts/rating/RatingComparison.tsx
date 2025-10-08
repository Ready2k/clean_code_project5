import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Rating,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  TextField,
  LinearProgress,
} from '@mui/material';
import {
  Compare as CompareIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface PromptRatingData {
  promptId: string;
  title: string;
  averageScore: number;
  totalRatings: number;
  scoreDistribution: Record<number, number>;
  tags: string[];
  category?: string;
  owner: string;
  createdAt: string;
}

interface RatingComparisonProps {
  availablePrompts: PromptRatingData[];
  onLoadPromptData: (promptId: string) => Promise<PromptRatingData>;
}

export const RatingComparison: React.FC<RatingComparisonProps> = ({
  availablePrompts,
  onLoadPromptData,
}) => {
  const [selectedPrompts, setSelectedPrompts] = useState<PromptRatingData[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAddPrompt = async (prompt: PromptRatingData) => {
    if (selectedPrompts.find(p => p.promptId === prompt.promptId)) {
      return; // Already selected
    }

    setLoading(true);
    try {
      const fullData = await onLoadPromptData(prompt.promptId);
      setSelectedPrompts(prev => [...prev, fullData]);
      setAddDialogOpen(false);
    } catch (error) {
      console.error('Failed to load prompt data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePrompt = (promptId: string) => {
    setSelectedPrompts(prev => prev.filter(p => p.promptId !== promptId));
  };

  // Prepare radar chart data
  const radarData = [
    { metric: 'Average Score', fullMark: 5 },
    { metric: 'Total Ratings', fullMark: selectedPrompts.length > 0 ? Math.max(...selectedPrompts.map(p => p.totalRatings), 100) : 100 },
    { metric: '5-Star %', fullMark: 100 },
    { metric: '4-Star %', fullMark: 100 },
    { metric: 'Engagement', fullMark: 100 },
  ].map(item => {
    const dataPoint: any = { metric: item.metric, fullMark: item.fullMark };
    
    (selectedPrompts || []).forEach(prompt => {
      const total = prompt.totalRatings;
      let value = 0;
      
      switch (item.metric) {
        case 'Average Score':
          value = prompt.averageScore;
          break;
        case 'Total Ratings':
          value = prompt.totalRatings;
          break;
        case '5-Star %':
          value = total > 0 ? ((prompt.scoreDistribution[5] || 0) / total) * 100 : 0;
          break;
        case '4-Star %':
          value = total > 0 ? ((prompt.scoreDistribution[4] || 0) / total) * 100 : 0;
          break;
        case 'Engagement':
          // Calculate engagement as a combination of rating frequency and recency
          const daysSinceCreation = Math.max(1, 
            (Date.now() - new Date(prompt.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          value = Math.min(100, (prompt.totalRatings / daysSinceCreation) * 10);
          break;
      }
      
      dataPoint[prompt.title] = value;
    });
    
    return dataPoint;
  });

  // Prepare bar chart data for score distribution
  const distributionData = [1, 2, 3, 4, 5].map(score => {
    const dataPoint: any = { score: `${score}★` };
    
    (selectedPrompts || []).forEach(prompt => {
      const count = prompt.scoreDistribution[score] || 0;
      const percentage = prompt.totalRatings > 0 ? (count / prompt.totalRatings) * 100 : 0;
      dataPoint[prompt.title] = Math.round(percentage * 10) / 10;
    });
    
    return dataPoint;
  });

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return 'success';
    if (score >= 3.5) return 'warning';
    if (score >= 2.5) return 'info';
    return 'error';
  };

  const colors = ['#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4'];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CompareIcon />
          Rating Comparison
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setAddDialogOpen(true)}
          disabled={selectedPrompts.length >= 6} // Limit to 6 prompts for readability
        >
          Add Prompt
        </Button>
      </Box>

      {selectedPrompts.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No Prompts Selected
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Add prompts to compare their ratings and performance metrics.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddDialogOpen(true)}
          >
            Add First Prompt
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {/* Selected Prompts Overview */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Selected Prompts ({selectedPrompts.length})
              </Typography>
              <Grid container spacing={2}>
                {selectedPrompts.map((prompt, index) => (
                  <Grid item xs={12} sm={6} md={4} key={prompt.promptId}>
                    <Card variant="outlined">
                      <CardContent sx={{ pb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="subtitle2" noWrap sx={{ flex: 1, mr: 1 }}>
                            {prompt.title}
                          </Typography>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => handleRemovePrompt(prompt.promptId)}
                            sx={{ minWidth: 'auto', p: 0.5 }}
                          >
                            <RemoveIcon fontSize="small" />
                          </Button>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Rating value={prompt.averageScore} precision={0.1} size="small" readOnly />
                          <Typography variant="body2">
                            {prompt.averageScore.toFixed(1)}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {prompt.totalRatings} ratings • by {prompt.owner}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          <Chip
                            label={`Color ${index + 1}`}
                            size="small"
                            sx={{ bgcolor: colors[index % colors.length], color: 'white' }}
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>

          {/* Radar Chart Comparison */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Performance Radar
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 'dataMax']} />
                  {selectedPrompts.map((prompt, index) => (
                    <Radar
                      key={prompt.promptId}
                      name={prompt.title}
                      dataKey={prompt.title}
                      stroke={colors[index % colors.length]}
                      fill={colors[index % colors.length]}
                      fillOpacity={0.1}
                      strokeWidth={2}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Score Distribution Comparison */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Score Distribution (%)
              </Typography>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={distributionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="score" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                  <Legend />
                  {selectedPrompts.map((prompt, index) => (
                    <Bar
                      key={prompt.promptId}
                      dataKey={prompt.title}
                      fill={colors[index % colors.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>

          {/* Detailed Metrics Table */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Detailed Metrics
              </Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>
                        Metric
                      </th>
                      {selectedPrompts.map(prompt => (
                        <th key={prompt.promptId} style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #ddd' }}>
                          {prompt.title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>
                        Average Rating
                      </td>
                      {selectedPrompts.map(prompt => (
                        <td key={prompt.promptId} style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #eee' }}>
                          <Chip
                            label={prompt.averageScore.toFixed(1)}
                            size="small"
                            color={getScoreColor(prompt.averageScore) as any}
                          />
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>
                        Total Ratings
                      </td>
                      {selectedPrompts.map(prompt => (
                        <td key={prompt.promptId} style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #eee' }}>
                          {prompt.totalRatings}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>
                        5-Star Ratings
                      </td>
                      {selectedPrompts.map(prompt => (
                        <td key={prompt.promptId} style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #eee' }}>
                          {prompt.scoreDistribution[5] || 0} ({prompt.totalRatings > 0 ? Math.round(((prompt.scoreDistribution[5] || 0) / prompt.totalRatings) * 100) : 0}%)
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ padding: '8px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>
                        1-Star Ratings
                      </td>
                      {selectedPrompts.map(prompt => (
                        <td key={prompt.promptId} style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #eee' }}>
                          {prompt.scoreDistribution[1] || 0} ({prompt.totalRatings > 0 ? Math.round(((prompt.scoreDistribution[1] || 0) / prompt.totalRatings) * 100) : 0}%)
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Add Prompt Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add Prompt to Comparison</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={availablePrompts.filter(p => !selectedPrompts.find(sp => sp.promptId === p.promptId))}
            getOptionLabel={(option) => option.title}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2">{option.title}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Rating value={option.averageScore} precision={0.1} size="small" readOnly />
                    <Typography variant="caption" color="text.secondary">
                      ({option.totalRatings} ratings)
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    by {option.owner} • {option.tags.slice(0, 3).join(', ')}
                  </Typography>
                </Box>
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search prompts"
                placeholder="Type to search by title, owner, or tags..."
                fullWidth
                margin="normal"
              />
            )}
            onChange={(_, value) => {
              if (value) {
                handleAddPrompt(value);
              }
            }}
            loading={loading}
          />
          {loading && <LinearProgress sx={{ mt: 2 }} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};