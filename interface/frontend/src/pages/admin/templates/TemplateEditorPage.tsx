/**
 * Template Editor Page Component
 * 
 * Rich editor for creating and modifying prompt templates with syntax highlighting,
 * variable management, and real-time preview capabilities.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '../../../hooks/redux';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  IconButton,
  Chip,
  Stack,
  Grid,
  Divider,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Save as SaveIcon,
  Preview as PreviewIcon,
  History as HistoryIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
  Code as CodeIcon,
  PlayArrow as TestIcon,
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
  category: string;
  key: string;
  name: string;
  description: string;
  content: string;
  variables: TemplateVariable[];
  metadata: {
    complexity_level?: 'basic' | 'intermediate' | 'advanced';
    tags?: string[];
    provider_optimized?: string[];
  };
  isActive: boolean;
  isDefault: boolean;
  version: number;
}

interface TemplateVersion {
  id: string;
  versionNumber: number;
  content: string;
  changeMessage?: string;
  createdAt: Date;
  createdBy?: string;
}

const TEMPLATE_CATEGORIES = [
  { value: 'enhancement', label: 'Enhancement' },
  { value: 'question_generation', label: 'Question Generation' },
  { value: 'system_prompts', label: 'System Prompts' },
  { value: 'mock_responses', label: 'Mock Responses' },
  { value: 'custom', label: 'Custom' },
];

const VARIABLE_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'array', label: 'Array' },
  { value: 'object', label: 'Object' },
];

export const TemplateEditorPage: React.FC = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { token } = useAppSelector((state) => state.auth);
  const [searchParams] = useSearchParams();
  const isViewMode = searchParams.get('mode') === 'view';
  const isNewTemplate = templateId === 'new';

  // State
  const [template, setTemplate] = useState<TemplateInfo | null>(null);
  const [loading, setLoading] = useState(!isNewTemplate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [showVariableDialog, setShowVariableDialog] = useState(false);
  const [editingVariable, setEditingVariable] = useState<TemplateVariable | null>(null);
  const [variableForm, setVariableForm] = useState<TemplateVariable>({
    name: '',
    type: 'string',
    description: '',
    required: false,
    defaultValue: '',
  });

  // Initialize new template
  const initializeNewTemplate = useCallback(() => {
    setTemplate({
      id: '',
      category: 'custom',
      key: '',
      name: '',
      description: '',
      content: '',
      variables: [],
      metadata: {
        complexity_level: 'basic',
        tags: [],
        provider_optimized: [],
      },
      isActive: true,
      isDefault: false,
      version: 1,
    });
    setLoading(false);
  }, []);

  // Load template
  const loadTemplate = useCallback(async () => {
    if (isNewTemplate) {
      initializeNewTemplate();
      return;
    }

    // Check if templateId is valid and user is authenticated
    if (!templateId || !token) {
      setError('Invalid template ID or not authenticated');
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
      setTemplate(data.data?.template || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  }, [templateId, isNewTemplate, initializeNewTemplate]);

  // Load version history
  const loadVersions = useCallback(async () => {
    if (isNewTemplate) return;

    try {
      const response = await fetch(`http://localhost:8000/api/admin/prompt-templates/${templateId}/versions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to load version history');
      }

      const data = await response.json();
      setVersions(data.versions || []);
    } catch (err) {
      console.error('Failed to load versions:', err);
    }
  }, [templateId, isNewTemplate]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  useEffect(() => {
    if (showHistory) {
      loadVersions();
    }
  }, [showHistory, loadVersions]);

  // Handlers
  const handleSave = async () => {
    if (!template) return;

    try {
      setSaving(true);
      setError(null);

      const url = isNewTemplate 
        ? '/api/admin/prompt-templates'
        : `/api/admin/prompt-templates/${templateId}`;
      
      const method = isNewTemplate ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });

      if (!response.ok) {
        throw new Error('Failed to save template');
      }

      const savedTemplate = await response.json();
      
      if (isNewTemplate) {
        navigate(`/admin/prompt-templates/editor/${savedTemplate.data?.template?.id}`);
      } else {
        setTemplate(savedTemplate.data?.template || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!template) return;

    try {
      // For new templates, use the general preview endpoint
      // For existing templates, use the ID-specific endpoint
      const url = isNewTemplate 
        ? 'http://localhost:8000/api/admin/prompt-templates/preview'
        : `http://localhost:8000/api/admin/prompt-templates/${template.id}/preview`;

      const requestBody = isNewTemplate 
        ? {
            content: template.content,
            variables: template.variables.reduce((acc, v) => ({
              ...acc,
              [v.name]: v.defaultValue || `{{${v.name}}}`,
            }), {}),
            context: {
              provider: 'openai',
              taskType: 'general'
            }
          }
        : {
            variables: template.variables.reduce((acc, v) => ({
              ...acc,
              [v.name]: v.defaultValue || `{{${v.name}}}`,
            }), {}),
            context: {
              provider: 'openai',
              taskType: 'general'
            }
          };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Failed to generate preview');
      }

      const data = await response.json();
      setPreviewContent(data.data?.preview || data.renderedContent || '');
      setShowPreview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    }
  };

  const handleAddVariable = () => {
    setEditingVariable(null);
    setVariableForm({
      name: '',
      type: 'string',
      description: '',
      required: false,
      defaultValue: '',
    });
    setShowVariableDialog(true);
  };

  const handleEditVariable = (variable: TemplateVariable) => {
    setEditingVariable(variable);
    setVariableForm({ ...variable });
    setShowVariableDialog(true);
  };

  const handleSaveVariable = () => {
    if (!template) return;

    const updatedVariables = editingVariable
      ? (template.variables || []).map(v => v.name === editingVariable.name ? variableForm : v)
      : [...(template.variables || []), variableForm];

    setTemplate({
      ...template,
      variables: updatedVariables,
    });

    setShowVariableDialog(false);
  };

  const handleDeleteVariable = (variableName: string) => {
    if (!template) return;

    setTemplate({
      ...template,
      variables: template.variables.filter(v => v.name !== variableName),
    });
  };

  const handleRevertToVersion = async (versionId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/admin/prompt-templates/${templateId}/revert/${versionId}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ versionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to revert to version');
      }

      const revertedTemplate = await response.json();
      setTemplate(revertedTemplate.data?.template || null);
      setShowHistory(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert to version');
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
      <Alert severity="error">
        Template not found
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h2">
          {isNewTemplate ? 'Create Template' : isViewMode ? 'View Template' : 'Edit Template'}
        </Typography>
        <Stack direction="row" spacing={1}>
          {!isViewMode && (
            <>
              <Button
                variant="outlined"
                startIcon={<PreviewIcon />}
                onClick={handlePreview}
              >
                Preview
              </Button>
              <Button
                variant="outlined"
                startIcon={<TestIcon />}
                onClick={() => navigate(`/admin/prompt-templates/testing/${templateId}`)}
                disabled={isNewTemplate}
              >
                Test
              </Button>
              {!isNewTemplate && (
                <Button
                  variant="outlined"
                  startIcon={<HistoryIcon />}
                  onClick={() => setShowHistory(true)}
                >
                  History
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
          {isViewMode && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/admin/prompt-templates/editor/${templateId}`)}
            >
              Edit
            </Button>
          )}
        </Stack>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Editor Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab label="Basic Info" />
            <Tab label="Content" />
            <Tab label="Variables" />
            <Tab label="Metadata" />
          </Tabs>
        </Box>

        <CardContent>
          {/* Basic Info Tab */}
          {activeTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Template Name"
                  value={template.name}
                  onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                  disabled={isViewMode}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Template Key"
                  value={template.key}
                  onChange={(e) => setTemplate({ ...template, key: e.target.value })}
                  disabled={isViewMode}
                  required
                  helperText="Unique identifier for this template"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={template.category}
                    label="Category"
                    onChange={(e) => setTemplate({ ...template, category: e.target.value })}
                    disabled={isViewMode}
                  >
                    {TEMPLATE_CATEGORIES.map(cat => (
                      <MenuItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Complexity Level</InputLabel>
                  <Select
                    value={template.metadata?.complexity_level || 'basic'}
                    label="Complexity Level"
                    onChange={(e) => setTemplate({
                      ...template,
                      metadata: { ...(template.metadata || {}), complexity_level: e.target.value as any }
                    })}
                    disabled={isViewMode}
                  >
                    <MenuItem value="basic">Basic</MenuItem>
                    <MenuItem value="intermediate">Intermediate</MenuItem>
                    <MenuItem value="advanced">Advanced</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Description"
                  value={template.description}
                  onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                  disabled={isViewMode}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={template.isActive}
                      onChange={(e) => setTemplate({ ...template, isActive: e.target.checked })}
                      disabled={isViewMode}
                    />
                  }
                  label="Active"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={template.isDefault}
                      onChange={(e) => setTemplate({ ...template, isDefault: e.target.checked })}
                      disabled={isViewMode}
                    />
                  }
                  label="Default Template"
                />
              </Grid>
            </Grid>
          )}

          {/* Content Tab */}
          {activeTab === 1 && (
            <Box>
              <TextField
                fullWidth
                multiline
                rows={20}
                label="Template Content"
                value={template.content}
                onChange={(e) => setTemplate({ ...template, content: e.target.value })}
                disabled={isViewMode}
                placeholder="Enter your template content here. Use {{variable_name}} for variables."
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace',
                    fontSize: '14px',
                  }
                }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Use double braces for variables: {`{{variable_name}}`}
              </Typography>
            </Box>
          )}

          {/* Variables Tab */}
          {activeTab === 2 && (
            <Box>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Template Variables</Typography>
                {!isViewMode && (
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleAddVariable}
                  >
                    Add Variable
                  </Button>
                )}
              </Box>

              <List>
                {(template.variables || []).map((variable, index) => (
                  <ListItem key={variable.name} divider>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2">{variable.name}</Typography>
                          <Chip label={variable.type} size="small" />
                          {variable.required && (
                            <Chip label="Required" color="error" size="small" />
                          )}
                        </Stack>
                      }
                      secondary={variable.description}
                    />
                    {!isViewMode && (
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleEditVariable(variable)}
                          sx={{ mr: 1 }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          onClick={() => handleDeleteVariable(variable.name)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                ))}
              </List>

              {(template.variables || []).length === 0 && (
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
                  No variables defined. Add variables to make your template dynamic.
                </Typography>
              )}
            </Box>
          )}

          {/* Metadata Tab */}
          {activeTab === 3 && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Tags (comma-separated)"
                  value={template.metadata?.tags?.join(', ') || ''}
                  onChange={(e) => setTemplate({
                    ...template,
                    metadata: {
                      ...(template.metadata || {}),
                      tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                    }
                  })}
                  disabled={isViewMode}
                  helperText="Add tags to help categorize and search for this template"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Provider Optimized (comma-separated)"
                  value={template.metadata?.provider_optimized?.join(', ') || ''}
                  onChange={(e) => setTemplate({
                    ...template,
                    metadata: {
                      ...(template.metadata || {}),
                      provider_optimized: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                    }
                  })}
                  disabled={isViewMode}
                  helperText="List providers this template is optimized for (e.g., openai, anthropic, meta)"
                />
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Variable Dialog */}
      <Dialog
        open={showVariableDialog}
        onClose={() => setShowVariableDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingVariable ? 'Edit Variable' : 'Add Variable'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Variable Name"
                value={variableForm.name}
                onChange={(e) => setVariableForm({ ...variableForm, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={variableForm.type}
                  label="Type"
                  onChange={(e) => setVariableForm({ ...variableForm, type: e.target.value as any })}
                >
                  {VARIABLE_TYPES.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={variableForm.required}
                    onChange={(e) => setVariableForm({ ...variableForm, required: e.target.checked })}
                  />
                }
                label="Required"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description"
                value={variableForm.description}
                onChange={(e) => setVariableForm({ ...variableForm, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Default Value"
                value={variableForm.defaultValue || ''}
                onChange={(e) => setVariableForm({ ...variableForm, defaultValue: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVariableDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveVariable} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Template Preview
        </DialogTitle>
        <DialogContent>
          <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
            <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
              {previewContent}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPreview(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog
        open={showHistory}
        onClose={() => setShowHistory(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Version History
        </DialogTitle>
        <DialogContent>
          <List>
            {versions.map((version) => (
              <ListItem key={version.id} divider>
                <ListItemText
                  primary={`Version ${version.versionNumber}`}
                  secondary={
                    <Box>
                      <Typography variant="body2">
                        {new Date(version.createdAt).toLocaleString()}
                      </Typography>
                      {version.changeMessage && (
                        <Typography variant="body2" color="text.secondary">
                          {version.changeMessage}
                        </Typography>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Button
                    size="small"
                    onClick={() => handleRevertToVersion(version.id)}
                  >
                    Revert
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowHistory(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};