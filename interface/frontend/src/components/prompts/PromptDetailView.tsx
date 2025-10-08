import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Rating,
  Tab,
  Tabs,
  Paper,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  PlayArrow as RenderIcon,
  AutoFixHigh as EnhanceIcon,
  Share as ShareIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { PromptRecord } from '../../types/prompts';
import { formatDistanceToNow, format } from 'date-fns';
import { RatingWidget, RatingHistory, RatingAnalytics } from './rating';
import { promptsAPI } from '../../services/api/promptsAPI';
import ModelBadge from './ModelBadge';
import VersionHistory from './VersionHistory';

interface PromptDetailViewProps {
  open: boolean;
  prompt: PromptRecord | null;
  onClose: () => void;
  onEdit?: (prompt: PromptRecord) => void;
  onRender?: (prompt: PromptRecord) => void;
  onEnhance?: (prompt: PromptRecord) => void;
  onShare?: (prompt: PromptRecord) => void;
  onRate?: (promptId: string, rating: { score: number; note?: string }) => void;
}

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
      id={`prompt-tabpanel-${index}`}
      aria-labelledby={`prompt-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export const PromptDetailView: React.FC<PromptDetailViewProps> = ({
  open,
  prompt,
  onClose,
  onEdit,
  onRender,
  onEnhance,
  onShare,
  onRate,
}) => {
  const [tabValue, setTabValue] = React.useState(0);

  const [currentUserRating, setCurrentUserRating] = React.useState<any>(null);
  const [ratingHistory, setRatingHistory] = React.useState<any[]>([]);
  const [ratingAnalytics, setRatingAnalytics] = React.useState<any>(null);
  const [ratingPage, setRatingPage] = React.useState(1);
  const [ratingFilters, setRatingFilters] = React.useState<any>({});
  const [loadingRatings, setLoadingRatings] = React.useState(false);

  React.useEffect(() => {
    if (prompt) {
      // Reset tab when prompt changes
      setTabValue(0);

      setRatingPage(1);
      setRatingFilters({});
      
      // Load rating data
      loadRatingData();
    }
  }, [prompt]);

  const loadRatingData = async () => {
    if (!prompt) return;
    
    setLoadingRatings(true);
    try {
      // Load user's current rating
      const userRatingResponse = await promptsAPI.getUserRating(prompt.id);
      setCurrentUserRating(userRatingResponse.userRating);
      
      // Load rating analytics
      const analyticsResponse = await promptsAPI.getPromptRatingAnalytics(prompt.id);
      setRatingAnalytics(analyticsResponse.analytics);
      
      // Load rating history
      await loadRatingHistory();
    } catch (error) {
      console.error('Failed to load rating data:', error);
    } finally {
      setLoadingRatings(false);
    }
  };

  const loadRatingHistory = async () => {
    if (!prompt) return;
    
    try {
      const response = await promptsAPI.getPromptRatings(prompt.id, {
        ...ratingFilters,
        limit: 10,
        offset: (ratingPage - 1) * 10,
      });
      setRatingHistory(response.ratings || []);
    } catch (error) {
      console.error('Failed to load rating history:', error);
    }
  };

  React.useEffect(() => {
    if (prompt) {
      loadRatingHistory();
    }
  }, [ratingPage, ratingFilters]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleRatingSubmit = async (rating: { score: number; note?: string }) => {
    if (!prompt) return;
    
    try {
      await promptsAPI.ratePrompt(prompt.id, rating);
      // Reload rating data after successful submission
      await loadRatingData();
      // Also call the parent callback if provided
      onRate?.(prompt.id, rating);
    } catch (error) {
      console.error('Failed to submit rating:', error);
      throw error;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'draft':
        return 'warning';
      case 'archived':
        return 'default';
      case 'deprecated':
        return 'error';
      default:
        return 'default';
    }
  };

  if (!prompt) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box flex={1}>
            <Typography variant="h5" component="h2" gutterBottom>
              {prompt.metadata.title}
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Chip
                label={prompt.status}
                size="small"
                color={getStatusColor(prompt.status) as any}
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary">
                Version {prompt.version}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                •
              </Typography>
              <Typography variant="body2" color="text.secondary">
                by {prompt.metadata.owner}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                •
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatDistanceToNow(new Date(prompt.updatedAt), { addSuffix: true })}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Rating
                value={prompt.averageRating || 0}
                precision={0.1}
                size="small"
                readOnly
              />
              <Typography variant="body2" color="text.secondary">
                ({prompt.ratings?.length || 0} ratings)
              </Typography>
            </Box>
          </Box>
          <Box display="flex" gap={1}>
            <Tooltip title="Edit">
              <IconButton onClick={() => onEdit?.(prompt)} size="small">
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Render">
              <IconButton onClick={() => onRender?.(prompt)} size="small">
                <RenderIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Enhance">
              <IconButton onClick={() => onEnhance?.(prompt)} size="small">
                <EnhanceIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Share">
              <IconButton onClick={() => onShare?.(prompt)} size="small">
                <ShareIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} sx={{ px: 3 }}>
            <Tab label="Details" />
            <Tab label="Content" />
            <Tab label="Variables" />
            <Tab label="Ratings" />
            <Tab label="Analytics" />
            <Tab label="History" />
          </Tabs>
        </Box>

        <Box sx={{ px: 3, height: 'calc(100% - 48px)', overflow: 'auto' }}>
          {/* Details Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box display="flex" flexDirection="column" gap={3}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  Summary
                </Typography>
                <Typography variant="body1" paragraph>
                  {prompt.metadata.summary}
                </Typography>
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>
                  Tags
                </Typography>
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                  {(prompt.metadata.tags || []).map((tag) => (
                    <Chip 
                      key={tag} 
                      label={tag} 
                      size="small" 
                      variant="outlined"
                      sx={{
                        color: '#000000',
                        borderColor: '#cccccc',
                        backgroundColor: '#ffffff',
                        '& .MuiChip-label': {
                          color: '#000000'
                        }
                      }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Model Information */}
              {((prompt.metadata as any)?.preferred_model || (prompt.metadata as any)?.tuned_for_provider) && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Model Information
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {(prompt.metadata as any)?.preferred_model && (
                      <ModelBadge
                        model={(prompt.metadata as any).preferred_model}
                        provider={(prompt.metadata as any)?.tuned_for_provider}
                        type="tuned"
                        size="medium"
                      />
                    )}
                    {prompt.history?.some(h => (h as any)?.enhancement_model) && (
                      <ModelBadge
                        model={prompt.history.find(h => (h as any)?.enhancement_model)?.enhancement_model as any}
                        provider={prompt.history.find(h => (h as any)?.enhancement_provider)?.enhancement_provider as any}
                        type="enhanced"
                        size="medium"
                      />
                    )}
                  </Box>
                </Box>
              )}

              {prompt.metadata.category && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Category
                  </Typography>
                  <Chip 
                    label={prompt.metadata.category} 
                    variant="outlined"
                    sx={{
                      color: '#000000',
                      borderColor: '#cccccc',
                      backgroundColor: '#ffffff',
                      '& .MuiChip-label': {
                        color: '#000000'
                      }
                    }}
                  />
                </Box>
              )}

              {prompt.metadata.difficulty && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Difficulty
                  </Typography>
                  <Chip 
                    label={prompt.metadata.difficulty} 
                    variant="outlined"
                    sx={{
                      color: '#000000',
                      borderColor: '#cccccc',
                      backgroundColor: '#ffffff',
                      '& .MuiChip-label': {
                        color: '#000000'
                      }
                    }}
                  />
                </Box>
              )}

              <Box>
                <Typography variant="h6" gutterBottom>
                  Metadata
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Created: {(() => {
                    try {
                      return prompt.createdAt ? format(new Date(prompt.createdAt), 'PPpp') : 'Unknown date';
                    } catch (error) {
                      return 'Invalid date';
                    }
                  })()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Updated: {(() => {
                    try {
                      return prompt.updatedAt ? format(new Date(prompt.updatedAt), 'PPpp') : 'Unknown date';
                    } catch (error) {
                      return 'Invalid date';
                    }
                  })()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ID: {prompt.id}
                </Typography>
              </Box>
            </Box>
          </TabPanel>

          {/* Content Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box display="flex" flexDirection="column" gap={3}>
              <Box>
                <Typography variant="h6" gutterBottom>
                  Goal
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                  <Typography variant="body1">
                    {prompt.humanPrompt.goal}
                  </Typography>
                </Paper>
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>
                  Audience
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                  <Typography variant="body1">
                    {prompt.humanPrompt.audience}
                  </Typography>
                </Paper>
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>
                  Steps
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                  <Box component="ol" sx={{ pl: 2, m: 0 }}>
                    {prompt.humanPrompt.steps.map((step, index) => (
                      <Typography key={index} component="li" variant="body1" sx={{ mb: 1 }}>
                        {step}
                      </Typography>
                    ))}
                  </Box>
                </Paper>
              </Box>

              <Box>
                <Typography variant="h6" gutterBottom>
                  Output Expectations
                </Typography>
                <Paper sx={{ p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                  <Typography variant="body1">
                    {prompt.humanPrompt.output_expectations.format}
                  </Typography>
                </Paper>
              </Box>

              {prompt.humanPrompt.examples && prompt.humanPrompt.examples.length > 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Examples
                  </Typography>
                  {prompt.humanPrompt.examples.map((example, index) => (
                    <Paper key={index} sx={{ p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider', mb: 1 }}>
                      <Typography variant="body1">
                        {example}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}

              {prompt.structuredPrompt && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Structured Prompt
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'background.default', border: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      System Message:
                    </Typography>
                    <Typography variant="body2" paragraph>
                      {prompt.structuredPrompt.systemMessage}
                    </Typography>
                    <Typography variant="subtitle2" gutterBottom>
                      User Message:
                    </Typography>
                    <Typography variant="body2">
                      {prompt.structuredPrompt.userMessage}
                    </Typography>
                  </Paper>
                </Box>
              )}
            </Box>
          </TabPanel>

          {/* Variables Tab */}
          <TabPanel value={tabValue} index={2}>
            {prompt.variables.length > 0 ? (
              <Box display="flex" flexDirection="column" gap={2}>
                {prompt.variables.map((variable, index) => (
                  <Paper key={index} sx={{ p: 2 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                      <Typography variant="h6">
                        {variable.name}
                        {variable.required && (
                          <Chip label="Required" size="small" color="error" sx={{ ml: 1 }} />
                        )}
                      </Typography>
                      <Chip 
                        label={variable.type} 
                        size="small" 
                        variant="outlined"
                        sx={{
                          color: '#000000',
                          borderColor: '#cccccc',
                          backgroundColor: '#ffffff',
                          '& .MuiChip-label': {
                            color: '#000000'
                          }
                        }}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      {variable.description}
                    </Typography>
                    {variable.defaultValue && (
                      <Typography variant="body2">
                        <strong>Default:</strong> {JSON.stringify(variable.defaultValue)}
                      </Typography>
                    )}
                  </Paper>
                ))}
              </Box>
            ) : (
              <Typography variant="body1" color="text.secondary">
                No variables defined for this prompt.
              </Typography>
            )}
          </TabPanel>

          {/* Ratings Tab */}
          <TabPanel value={tabValue} index={3}>
            <Box display="flex" flexDirection="column" gap={3}>
              {/* Rating Widget */}
              <RatingWidget
                currentUserRating={currentUserRating}
                onSubmitRating={handleRatingSubmit}
              />

              {/* Rating History */}
              <RatingHistory
                ratings={ratingHistory}
                totalRatings={prompt.ratings?.length || 0}
                currentPage={ratingPage}
                pageSize={10}
                onPageChange={setRatingPage}
                onFiltersChange={setRatingFilters}
                loading={loadingRatings}
              />
            </Box>
          </TabPanel>

          {/* Analytics Tab */}
          <TabPanel value={tabValue} index={4}>
            {ratingAnalytics ? (
              <RatingAnalytics
                data={ratingAnalytics}
                loading={loadingRatings}
              />
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  {loadingRatings ? 'Loading analytics...' : 'No analytics data available'}
                </Typography>
              </Box>
            )}
          </TabPanel>

          {/* History Tab */}
          <TabPanel value={tabValue} index={5}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <HistoryIcon />
              <Typography variant="h6">
                Version History
              </Typography>
            </Box>
            {prompt && <VersionHistory promptId={prompt.id} />}
          </TabPanel>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};