import React from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Paper,
  Tabs,
  Tab,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,

  Grid,
  Card,
  CardContent,
  Rating,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Refresh as RestartIcon,
  Add as AddedIcon,
  Edit as ModifiedIcon,
  Remove as RemovedIcon,
  TrendingUp as ConfidenceIcon,
} from '@mui/icons-material';
import { PromptRecord } from '../../../types/prompts';
import { EnhancementProgress, EnhancementChange } from '../../../types/enhancement';

interface EnhancementResultsProps {
  prompt: PromptRecord | null;
  job: EnhancementProgress | null;
  onApprove: () => void;
  onRestart: () => void;
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
      id={`results-tabpanel-${index}`}
      aria-labelledby={`results-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export const EnhancementResults: React.FC<EnhancementResultsProps> = ({
  prompt,
  job,
  onApprove,
  onRestart,
}) => {
  const [tabValue, setTabValue] = React.useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (!result) {
    return (
      <Alert severity="info">
        No enhancement results to display.
      </Alert>
    );
  }

  const renderChangesList = () => {
    if (!result.changes || result.changes.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary">
          No specific changes detected.
        </Typography>
      );
    }

    return (
      <List>
        {result.changes.map((change, index) => (
          <ListItem key={index}>
            <ListItemIcon>
              {change.type === 'added' && <AddedIcon color="success" />}
              {change.type === 'modified' && <ModifiedIcon color="warning" />}
              {change.type === 'removed' && <RemovedIcon color="error" />}
            </ListItemIcon>
            <ListItemText
              primary={change.field}
              secondary={change.description}
            />
          </ListItem>
        ))}
      </List>
    );
  };

  const renderDiffView = (field: string, oldValue: any, newValue: any) => {
    if (typeof oldValue === 'string' && typeof newValue === 'string') {
      return (
        <Box>
          <Typography variant="subtitle2" color="error.main" gutterBottom>
            - Original:
          </Typography>
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.50', border: '1px solid', borderColor: 'error.200' }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#000000' }}>
              {oldValue}
            </Typography>
          </Paper>

          <Typography variant="subtitle2" color="success.main" gutterBottom>
            + Enhanced:
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#000000' }}>
              {newValue}
            </Typography>
          </Paper>
        </Box>
      );
    }

    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      return (
        <Box>
          <Typography variant="subtitle2" color="error.main" gutterBottom>
            - Original ({oldValue.length} items):
          </Typography>
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'error.50', border: '1px solid', borderColor: 'error.200' }}>
            <Box component="ol" sx={{ pl: 2, m: 0 }}>
              {oldValue.map((item, index) => (
                <Typography key={index} component="li" variant="body2" sx={{ mb: 0.5, color: '#000000' }}>
                  {item}
                </Typography>
              ))}
            </Box>
          </Paper>

          <Typography variant="subtitle2" color="success.main" gutterBottom>
            + Enhanced ({newValue.length} items):
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
            <Box component="ol" sx={{ pl: 2, m: 0 }}>
              {newValue.map((item, index) => (
                <Typography key={index} component="li" variant="body2" sx={{ mb: 0.5, color: '#000000' }}>
                  {item}
                </Typography>
              ))}
            </Box>
          </Paper>
        </Box>
      );
    }

    return (
      <Box>
        <Typography variant="body2" color="text.secondary">
          {JSON.stringify(oldValue)} → {JSON.stringify(newValue)}
        </Typography>
      </Box>
    );
  };

  if (!prompt || !job || !job.result) {
    return (
      <Alert severity="warning">
        No enhancement results available.
      </Alert>
    );
  }

  const { result } = job;

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Alert severity="success">
        <Box display="flex" alignItems="center" gap={1}>
          <ConfidenceIcon />
          <Typography variant="subtitle2">
            Enhancement completed with {Math.round(result.confidence * 100)}% confidence
          </Typography>
        </Box>
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              AI Enhancement Rationale
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {result.rationale}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Enhancement Summary
              </Typography>

              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <Typography variant="body2">Confidence:</Typography>
                <Rating
                  value={result.confidence * 5}
                  precision={0.1}
                  size="small"
                  readOnly
                />
                <Typography variant="caption" color="text.secondary">
                  ({Math.round(result.confidence * 100)}%)
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" gutterBottom>
                Changes: {(result as any).changes_made?.length || 0}
              </Typography>

              <Box display="flex" flexWrap="wrap" gap={0.5}>
                {((result as any).changes_made || []).map((change: string, index: number) => (
                  <Chip
                    key={index}
                    label="modified"
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{
                      color: '#000000',
                      borderColor: '#1976d2',
                      backgroundColor: '#ffffff',
                      '& .MuiChip-label': {
                        color: '#000000'
                      }
                    }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Changes Overview" />
            <Tab label="Side-by-Side Comparison" />
            <Tab label="Enhanced Prompt" />
          </Tabs>
        </Box>

        <Box sx={{ p: 3 }}>
          {/* Changes Overview Tab */}
          <TabPanel value={tabValue} index={0}>
            <Typography variant="h6" gutterBottom>
              Changes Made ({((result as any).changes_made || []).length})
            </Typography>

            {((result as any).changes_made || []).length > 0 ? (
              <List>
                {((result as any).changes_made || []).map((change: string, index: number) => (
                  <ListItem key={index} alignItems="flex-start">
                    <ListItemIcon>
                      <ModifiedIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography
                          variant="subtitle2"
                          sx={{ color: 'primary.main' }}
                        >
                          Enhancement Change
                        </Typography>
                      }
                      secondary={change}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No specific changes were made to the prompt structure.
              </Typography>
            )}
          </TabPanel>

          {/* Side-by-Side Comparison Tab */}
          <TabPanel value={tabValue} index={1}>
            <Typography variant="h6" gutterBottom>
              Before vs After Comparison
            </Typography>

            <Grid container spacing={2}>
              {/* Before Column */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: '#d32f2f' }}>
                  Before (Original)
                </Typography>
                <Paper sx={{ p: 2, bgcolor: '#fff3f3', border: '1px solid #ffcdd2', height: 'fit-content' }}>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Goal:
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#000000' }}>
                        {prompt?.humanPrompt?.goal || 'No goal specified'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Audience:
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#000000' }}>
                        {prompt?.humanPrompt?.audience || 'No audience specified'}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Steps ({prompt?.humanPrompt?.steps?.length || 0}):
                      </Typography>
                      <Box display="flex" flexDirection="column" gap={0.5}>
                        {(prompt?.humanPrompt?.steps || []).map((step: string, index: number) => (
                          <Typography key={index} variant="body2" sx={{ color: '#000000' }}>
                            {index + 1}. {step}
                          </Typography>
                        ))}
                      </Box>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Output Format:
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#000000' }}>
                        {prompt?.humanPrompt?.output_expectations?.format || 'Not specified'}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>

              {/* After Column */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold', color: '#2e7d32' }}>
                  After (Enhanced)
                </Typography>
                <Paper sx={{ p: 2, bgcolor: '#f3fff3', border: '1px solid #c8e6c9', height: 'fit-content' }}>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                        System Instructions ({((result as any).structuredPrompt?.system || []).length}):
                      </Typography>
                      <Box display="flex" flexDirection="column" gap={0.5}>
                        {((result as any).structuredPrompt?.system || []).map((instruction: string, index: number) => (
                          <Typography key={index} variant="body2" sx={{ color: '#000000' }}>
                            • {instruction}
                          </Typography>
                        ))}
                      </Box>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                        User Template:
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#000000', whiteSpace: 'pre-wrap' }}>
                        {((result as any).structuredPrompt?.user_template || 'No template generated').substring(0, 200)}
                        {((result as any).structuredPrompt?.user_template || '').length > 200 ? '...' : ''}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Capabilities ({((result as any).structuredPrompt?.capabilities || []).length}):
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {((result as any).structuredPrompt?.capabilities || []).map((capability: string, index: number) => (
                          <Chip key={index} label={capability} size="small" variant="outlined" />
                        ))}
                      </Box>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Rules ({((result as any).structuredPrompt?.rules || []).length}):
                      </Typography>
                      <Box display="flex" flexDirection="column" gap={0.5}>
                        {((result as any).structuredPrompt?.rules || []).map((rule: any, index: number) => (
                          <Typography key={index} variant="body2" sx={{ color: '#000000' }}>
                            • {rule.name}: {rule.description}
                          </Typography>
                        ))}
                      </Box>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Variables ({((result as any).structuredPrompt?.variables || []).length}):
                      </Typography>
                      <Box display="flex" flexWrap="wrap" gap={0.5}>
                        {((result as any).structuredPrompt?.variables || []).map((variable: string, index: number) => (
                          <Chip key={index} label={variable} size="small" color="primary" variant="outlined" />
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Enhanced Prompt Tab */}
          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" gutterBottom>
              Enhanced Prompt Preview
            </Typography>

            <Box display="flex" flexDirection="column" gap={3}>
              {((result as any).structuredPrompt?.system || []).length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    System Instructions ({((result as any).structuredPrompt.system || []).length})
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #cccccc' }}>
                    <Box display="flex" flexDirection="column" gap={1}>
                      {((result as any).structuredPrompt.system || []).map((instruction: string, index: number) => (
                        <Typography key={index} variant="body1" sx={{ color: '#000000' }}>
                          {instruction}
                        </Typography>
                      ))}
                    </Box>
                  </Paper>
                </Box>
              )}

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  User Template
                </Typography>
                <Paper sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #cccccc' }}>
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', color: '#000000' }}>
                    {(result as any).structuredPrompt?.user_template || 'No user template available'}
                  </Typography>
                </Paper>
              </Box>

              {((result as any).structuredPrompt?.capabilities || []).length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Capabilities ({((result as any).structuredPrompt.capabilities || []).length})
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #cccccc' }}>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {((result as any).structuredPrompt.capabilities || []).map((capability: string, index: number) => (
                        <Chip
                          key={index}
                          label={capability}
                          size="small"
                          variant="outlined"
                          sx={{
                            color: '#000000',
                            borderColor: '#000000',
                            backgroundColor: '#ffffff',
                            '& .MuiChip-label': {
                              color: '#000000'
                            }
                          }}
                        />
                      ))}
                    </Box>
                  </Paper>
                </Box>
              )}

              {((result as any).structuredPrompt?.rules || []).length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Rules ({((result as any).structuredPrompt.rules || []).length})
                  </Typography>
                  <Box display="flex" flexDirection="column" gap={1}>
                    {((result as any).structuredPrompt.rules || []).map((rule: any, index: number) => (
                      <Paper key={index} sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #cccccc' }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ color: '#000000' }}>
                          {rule.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#666666' }}>
                          {rule.description}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                </Box>
              )}

              {((result as any).structuredPrompt?.variables || []).length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Variables ({((result as any).structuredPrompt.variables || []).length})
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {((result as any).structuredPrompt.variables || []).map((variable: string, index: number) => (
                      <Chip
                        key={index}
                        label={variable}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{
                          color: '#000000',
                          borderColor: '#1976d2',
                          backgroundColor: '#ffffff',
                          '& .MuiChip-label': {
                            color: '#000000'
                          }
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </TabPanel>
        </Box>
      </Paper>

      <Box display="flex" justifyContent="space-between" gap={2}>
        <Button
          variant="outlined"
          onClick={onRestart}
          startIcon={<RestartIcon />}
        >
          Start New Enhancement
        </Button>

        <Button
          variant="contained"
          onClick={onApprove}
          startIcon={<ApproveIcon />}
          size="large"
        >
          Approve & Apply Enhancement
        </Button>
      </Box>
    </Box>
  );
};