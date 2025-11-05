/**
 * Template Testing Page Component
 * 
 * Provides comprehensive testing capabilities for prompt templates including
 * real-time validation, LLM provider testing, and performance analysis.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../hooks/redux';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as TestIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Speed as PerformanceIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  Code as CodeIcon,
  Timeline as TimelineIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';

// Types
interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
}

interface TemplateInfo {
  id: string;
  name: string;
  content: string;
  variables: TemplateVariable[];
  category: string;
}

interface TestResult {
  success: boolean;
  renderedContent: string;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
  performance?: {
    renderTime: number;
    variableSubstitutions: number;
  };
}

interface ValidationError {
  type: string;
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

interface ValidationWarning {
  type: string;
  message: string;
  suggestion?: string;
}

interface ProviderTestResult {
  provider: string;
  success: boolean;
  response?: string;
  error?: string;
  responseTime: number;
  tokenCount?: number;
}

interface PerformanceMetrics {
  averageRenderTime: number;
  minRenderTime: number;
  maxRenderTime: number;
  totalTests: number;
  successRate: number;
}

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'meta', label: 'Meta' },
];

export const TemplateTestingPage: React.FC = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { token } = useAppSelector((state) => state.auth);

  // State
  const [template, setTemplate] = useState<TemplateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  
  // Test data
  const [testVariables, setTestVariables] = useState<Record<string, any>>({});
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  
  // Provider testing
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [providerResults, setProviderResults] = useState<ProviderTestResult[]>([]);
  const [providerTesting, setProviderTesting] = useState(false);
  
  // Performance testing
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [performanceTesting, setPerformanceTesting] = useState(false);

  // Load template
  const loadTemplate = useCallback(async () => {
    if (!templateId || templateId === 'new') {
      // No template selected - this is valid for the testing overview
      setTemplate(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`http://localhost:8000/api/admin/prompt-templates/${templateId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to load template');
      }

      const data = await response.json();
      const template = data.data?.template || null;
      setTemplate(template);
      
      // Initialize test variables with default values
      const initialVariables: Record<string, any> = {};
      (template?.variables || []).forEach((variable: TemplateVariable) => {
        initialVariables[variable.name] = variable.defaultValue || '';
      });
      setTestVariables(initialVariables);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  // Test template rendering
  const handleTestTemplate = async () => {
    if (!template) return;

    try {
      setTesting(true);
      setError(null);

      const response = await fetch(`http://localhost:8000/api/admin/prompt-templates/${template.id}/test`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          variables: testVariables,
          context: {
            provider: selectedProvider,
            taskType: 'general'
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to test template');
      }

      const result = await response.json();
      setTestResult(result.data?.result || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test template');
    } finally {
      setTesting(false);
    }
  };

  // Test with LLM provider
  const handleProviderTest = async () => {
    if (!template || !testResult?.renderedContent) return;

    try {
      setProviderTesting(true);
      setError(null);

      const response = await fetch(`http://localhost:8000/api/admin/prompt-templates/${template.id}/test-compatibility`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          providers: [selectedProvider],
          testData: {
            variables: testVariables,
            context: {
              provider: selectedProvider,
              taskType: 'general'
            }
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to test with provider');
      }

      const result = await response.json();
      setProviderResults(prev => [result.data?.results || result, ...prev.slice(0, 4)]); // Keep last 5 results
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test with provider');
    } finally {
      setProviderTesting(false);
    }
  };

  // Run performance tests
  const handlePerformanceTest = async () => {
    if (!template) return;

    try {
      setPerformanceTesting(true);
      setError(null);

      const response = await fetch('http://localhost:8000/api/admin/prompt-templates/performance-test', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          templateId: template.id,
          variables: testVariables,
          iterations: 100,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to run performance test');
      }

      const result = await response.json();
      setPerformanceMetrics(result.data || result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run performance test');
    } finally {
      setPerformanceTesting(false);
    }
  };

  const handleVariableChange = (name: string, value: any) => {
    setTestVariables(prev => ({ ...prev, [name]: value }));
  };

  const getVariableInput = (variable: TemplateVariable) => {
    const value = testVariables[variable.name] || '';

    switch (variable.type) {
      case 'boolean':
        return (
          <FormControl fullWidth>
            <InputLabel>{variable.name}</InputLabel>
            <Select
              value={value.toString()}
              label={variable.name}
              onChange={(e) => handleVariableChange(variable.name, e.target.value === 'true')}
            >
              <MenuItem value="true">True</MenuItem>
              <MenuItem value="false">False</MenuItem>
            </Select>
          </FormControl>
        );
      
      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            label={variable.name}
            value={value}
            onChange={(e) => handleVariableChange(variable.name, parseFloat(e.target.value) || 0)}
            helperText={variable.description}
            required={variable.required}
          />
        );
      
      case 'array':
      case 'object':
        return (
          <TextField
            fullWidth
            multiline
            rows={3}
            label={variable.name}
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleVariableChange(variable.name, parsed);
              } catch {
                handleVariableChange(variable.name, e.target.value);
              }
            }}
            helperText={`${variable.description} (JSON format)`}
            required={variable.required}
          />
        );
      
      default:
        return (
          <TextField
            fullWidth
            multiline
            rows={2}
            label={variable.name}
            value={value}
            onChange={(e) => handleVariableChange(variable.name, e.target.value)}
            helperText={variable.description}
            required={variable.required}
          />
        );
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!template) {
    return (
      <Box>
        <Typography variant="h5" component="h2" gutterBottom>
          Template Testing
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Select a template to test its functionality and performance
        </Typography>
        
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Select Template to Test
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose a template from the list below or go to the Templates tab to create a new one.
            </Typography>
            
            <Stack spacing={2}>
              <Button
                variant="outlined"
                onClick={() => navigate('/admin/prompt-templates')}
                fullWidth
              >
                Browse All Templates
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate('/admin/prompt-templates/editor')}
                fullWidth
              >
                Create New Template
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" component="h2">
            Test Template: {template.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Category: {template.category}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => navigate(`/admin/prompt-templates/editor/${templateId}`)}
        >
          Edit Template
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Test Input Panel */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Test Variables
              </Typography>
              
              <Stack spacing={2}>
                {(template.variables || []).map((variable) => (
                  <Box key={variable.name}>
                    {getVariableInput(variable)}
                  </Box>
                ))}
                
                {(template.variables || []).length === 0 && (
                  <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                    This template has no variables to configure.
                  </Typography>
                )}
                
                <Button
                  variant="contained"
                  startIcon={<TestIcon />}
                  onClick={handleTestTemplate}
                  disabled={testing}
                  fullWidth
                >
                  {testing ? 'Testing...' : 'Test Template'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Results Panel */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
                  <Tab label="Rendered Output" />
                  <Tab label="Validation" />
                  <Tab label="Performance" />
                </Tabs>
              </Box>

              {/* Rendered Output Tab */}
              {activeTab === 0 && (
                <Box>
                  {testResult ? (
                    <Paper sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 400, overflow: 'auto' }}>
                      <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                        {testResult.renderedContent}
                      </Typography>
                    </Paper>
                  ) : (
                    <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                      Run a test to see the rendered output
                    </Typography>
                  )}
                  
                  {testResult && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Test with LLM Provider
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel>Provider</InputLabel>
                          <Select
                            value={selectedProvider}
                            label="Provider"
                            onChange={(e) => setSelectedProvider(e.target.value)}
                          >
                            {PROVIDERS.map(provider => (
                              <MenuItem key={provider.value} value={provider.value}>
                                {provider.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleProviderTest}
                          disabled={providerTesting}
                        >
                          {providerTesting ? 'Testing...' : 'Test'}
                        </Button>
                      </Stack>
                    </Box>
                  )}
                </Box>
              )}

              {/* Validation Tab */}
              {activeTab === 1 && (
                <Box>
                  {testResult ? (
                    <Stack spacing={2}>
                      {/* Success/Error Status */}
                      <Box display="flex" alignItems="center" gap={1}>
                        {testResult.success ? (
                          <SuccessIcon color="success" />
                        ) : (
                          <ErrorIcon color="error" />
                        )}
                        <Typography variant="subtitle2">
                          {testResult.success ? 'Template is valid' : 'Template has errors'}
                        </Typography>
                      </Box>

                      {/* Errors */}
                      {testResult.errors && (testResult.errors || []).length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" color="error" gutterBottom>
                            Errors
                          </Typography>
                          <List dense>
                            {(testResult.errors || []).map((error, index) => (
                              <ListItem key={index}>
                                <ListItemIcon>
                                  <ErrorIcon color="error" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText
                                  primary={error.message}
                                  secondary={error.suggestion}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      )}

                      {/* Warnings */}
                      {testResult.warnings && (testResult.warnings || []).length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" color="warning.main" gutterBottom>
                            Warnings
                          </Typography>
                          <List dense>
                            {(testResult.warnings || []).map((warning, index) => (
                              <ListItem key={index}>
                                <ListItemIcon>
                                  <WarningIcon color="warning" fontSize="small" />
                                </ListItemIcon>
                                <ListItemText
                                  primary={warning.message}
                                  secondary={warning.suggestion}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Box>
                      )}

                      {/* Performance Info */}
                      {testResult.performance && (
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Performance
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Typography variant="body2">
                                Render Time: {testResult.performance.renderTime}ms
                              </Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="body2">
                                Variables: {testResult.performance.variableSubstitutions}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      )}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                      Run a test to see validation results
                    </Typography>
                  )}
                </Box>
              )}

              {/* Performance Tab */}
              {activeTab === 2 && (
                <Box>
                  <Stack spacing={2}>
                    <Button
                      variant="outlined"
                      startIcon={<AssessmentIcon />}
                      onClick={handlePerformanceTest}
                      disabled={performanceTesting}
                    >
                      {performanceTesting ? 'Running Performance Test...' : 'Run Performance Test'}
                    </Button>

                    {performanceMetrics && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom>
                          Performance Metrics (100 iterations)
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="body2">
                              Average: {performanceMetrics.averageRenderTime.toFixed(2)}ms
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2">
                              Success Rate: {(performanceMetrics.successRate * 100).toFixed(1)}%
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2">
                              Min: {performanceMetrics.minRenderTime.toFixed(2)}ms
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2">
                              Max: {performanceMetrics.maxRenderTime.toFixed(2)}ms
                            </Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Provider Test Results */}
      {(providerResults || []).length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Provider Test Results
            </Typography>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Provider</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Response Time</TableCell>
                    <TableCell>Tokens</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(providerResults || []).map((result, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Chip label={result.provider} />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {result.success ? (
                            <SuccessIcon color="success" fontSize="small" />
                          ) : (
                            <ErrorIcon color="error" fontSize="small" />
                          )}
                          <Typography variant="body2">
                            {result.success ? 'Success' : 'Error'}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {result.responseTime}ms
                      </TableCell>
                      <TableCell>
                        {result.tokenCount || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Accordion>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="body2">View Response</Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                              <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                                {result.success ? result.response : result.error}
                              </Typography>
                            </Paper>
                          </AccordionDetails>
                        </Accordion>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};