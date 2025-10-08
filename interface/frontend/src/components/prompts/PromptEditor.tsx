import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Tab,
  Tabs,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { PromptRecord, UpdatePromptRequest, Variable } from '../../types/prompts';
import { CollaborativeEditingIndicator } from '../common/CollaborativeEditingIndicator';
import { useWebSocket } from '../../hooks/useWebSocket';

interface PromptEditorProps {
  open: boolean;
  prompt: PromptRecord | null;
  onClose: () => void;
  onSave: (id: string, data: UpdatePromptRequest) => Promise<void>;
  isLoading?: boolean;
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
      id={`editor-tabpanel-${index}`}
      aria-labelledby={`editor-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  open,
  prompt,
  onClose,
  onSave,
  isLoading = false,
}) => {
  const [tabValue, setTabValue] = React.useState(0);
  const [formData, setFormData] = React.useState<UpdatePromptRequest>({});
  const [tagInput, setTagInput] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  
  const { notifyPromptUpdate } = useWebSocket();

  React.useEffect(() => {
    if (prompt) {
      setFormData({
        metadata: { ...prompt.metadata },
        humanPrompt: { ...prompt.humanPrompt },
        variables: [...prompt.variables],
      });
      setHasChanges(false);
      setErrors({});
      setTabValue(0);
    }
  }, [prompt]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleClose = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        setIsEditing(false);
        onClose();
      }
    } else {
      setIsEditing(false);
      onClose();
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.metadata?.title && !formData.metadata.title.trim()) {
      newErrors.title = 'Title cannot be empty';
    }
    if (formData.metadata?.summary && !formData.metadata.summary.trim()) {
      newErrors.summary = 'Summary cannot be empty';
    }
    if (formData.humanPrompt?.goal && !formData.humanPrompt.goal.trim()) {
      newErrors.goal = 'Goal cannot be empty';
    }
    if (formData.humanPrompt?.audience && !formData.humanPrompt.audience.trim()) {
      newErrors.audience = 'Audience cannot be empty';
    }
    if (formData.humanPrompt?.output_expectations && !formData.humanPrompt.output_expectations.format.trim()) {
      newErrors.outputExpectations = 'Output format cannot be empty';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!prompt || !validateForm()) return;

    try {
      // Clean up the data before saving
      const cleanedData: UpdatePromptRequest = {
        ...formData,
        humanPrompt: formData.humanPrompt ? {
          ...formData.humanPrompt,
          steps: formData.humanPrompt.steps?.filter(step => step.trim()) || [],
          examples: formData.humanPrompt.examples?.filter(example => example.trim()) || [],
        } : undefined,
      };

      await onSave(prompt.id, cleanedData);
      
      // Notify other users of the update
      notifyPromptUpdate(prompt.id, cleanedData);
      
      setHasChanges(false);
      setIsEditing(false);
      onClose();
    } catch (error) {
      console.error('Failed to save prompt:', error);
    }
  };

  const updateMetadata = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [field]: value,
      },
    }));
    setHasChanges(true);
    
    // Start editing if not already
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const updateHumanPrompt = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      humanPrompt: {
        ...prev.humanPrompt,
        [field]: value,
      },
    }));
    setHasChanges(true);
    
    // Start editing if not already
    if (!isEditing) {
      setIsEditing(true);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.metadata?.tags?.includes(tagInput.trim())) {
      updateMetadata('tags', [...(formData.metadata?.tags || []), tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateMetadata('tags', formData.metadata?.tags?.filter(tag => tag !== tagToRemove) || []);
  };

  const addStep = () => {
    updateHumanPrompt('steps', [...(formData.humanPrompt?.steps || []), '']);
  };

  const updateStep = (index: number, value: string) => {
    const steps = [...(formData.humanPrompt?.steps || [])];
    steps[index] = value;
    updateHumanPrompt('steps', steps);
  };

  const removeStep = (index: number) => {
    const steps = formData.humanPrompt?.steps?.filter((_, i) => i !== index) || [];
    updateHumanPrompt('steps', steps);
  };

  const addExample = () => {
    updateHumanPrompt('examples', [...(formData.humanPrompt?.examples || []), '']);
  };

  const updateExample = (index: number, value: string) => {
    const examples = [...(formData.humanPrompt?.examples || [])];
    examples[index] = value;
    updateHumanPrompt('examples', examples);
  };

  const removeExample = (index: number) => {
    const examples = formData.humanPrompt?.examples?.filter((_, i) => i !== index) || [];
    updateHumanPrompt('examples', examples);
  };

  const addVariable = () => {
    const newVariable: Variable = {
      name: '',
      description: '',
      type: 'string',
      required: false,
    };
    setFormData(prev => ({
      ...prev,
      variables: [...(prev.variables || []), newVariable],
    }));
    setHasChanges(true);
  };

  const updateVariable = (index: number, field: keyof Variable, value: any) => {
    const variables = [...(formData.variables || [])];
    variables[index] = { ...variables[index], [field]: value };
    setFormData(prev => ({ ...prev, variables }));
    setHasChanges(true);
  };

  const removeVariable = (index: number) => {
    const variables = formData.variables?.filter((_, i) => i !== index) || [];
    setFormData(prev => ({ ...prev, variables }));
    setHasChanges(true);
  };

  if (!prompt) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5" component="h2">
              Edit Prompt
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {prompt.metadata.title} (v{prompt.version})
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            {hasChanges && (
              <Typography variant="caption" color="warning.main" sx={{ mr: 1 }}>
                Unsaved changes
              </Typography>
            )}
            <IconButton onClick={handleClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
        
        {/* Collaborative Editing Indicator */}
        {prompt && (
          <Box sx={{ mt: 2 }}>
            <CollaborativeEditingIndicator
              promptId={prompt.id}
              isEditing={isEditing}
              onStartEditing={() => setIsEditing(true)}
              onStopEditing={() => setIsEditing(false)}
            />
          </Box>
        )}
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} sx={{ px: 3 }}>
            <Tab label="Metadata" />
            <Tab label="Content" />
            <Tab label="Variables" />
            <Tab label="Preview" />
          </Tabs>
        </Box>

        <Box sx={{ px: 3, height: 'calc(100% - 48px)', overflow: 'auto' }}>
          {/* Metadata Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box display="flex" flexDirection="column" gap={3}>
              <TextField
                label="Title"
                value={formData.metadata?.title || ''}
                onChange={(e) => updateMetadata('title', e.target.value)}
                error={!!errors.title}
                helperText={errors.title}
                fullWidth
                required
              />

              <TextField
                label="Summary"
                value={formData.metadata?.summary || ''}
                onChange={(e) => updateMetadata('summary', e.target.value)}
                error={!!errors.summary}
                helperText={errors.summary}
                multiline
                rows={3}
                fullWidth
                required
              />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Tags
                </Typography>
                <Box display="flex" gap={1} mb={1}>
                  <TextField
                    placeholder="Add a tag"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    size="small"
                  />
                  <Button onClick={addTag} variant="outlined" size="small">
                    Add
                  </Button>
                </Box>
                <Box display="flex" flexWrap="wrap" gap={0.5}>
                  {formData.metadata?.tags?.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      onDelete={() => removeTag(tag)}
                      size="small"
                    />
                  ))}
                </Box>
              </Box>

              <FormControl>
                <InputLabel>Category</InputLabel>
                <Select
                  value={formData.metadata?.category || ''}
                  onChange={(e) => updateMetadata('category', e.target.value)}
                  label="Category"
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="creative">Creative</MenuItem>
                  <MenuItem value="analytical">Analytical</MenuItem>
                  <MenuItem value="technical">Technical</MenuItem>
                  <MenuItem value="educational">Educational</MenuItem>
                  <MenuItem value="business">Business</MenuItem>
                </Select>
              </FormControl>

              <FormControl>
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={formData.metadata?.difficulty || ''}
                  onChange={(e) => updateMetadata('difficulty', e.target.value)}
                  label="Difficulty"
                >
                  <MenuItem value="">None</MenuItem>
                  <MenuItem value="beginner">Beginner</MenuItem>
                  <MenuItem value="intermediate">Intermediate</MenuItem>
                  <MenuItem value="advanced">Advanced</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </TabPanel>

          {/* Content Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box display="flex" flexDirection="column" gap={3}>
              <TextField
                label="Goal"
                value={formData.humanPrompt?.goal || ''}
                onChange={(e) => updateHumanPrompt('goal', e.target.value)}
                error={!!errors.goal}
                helperText={errors.goal || "What is the main objective of this prompt?"}
                multiline
                rows={2}
                fullWidth
                required
              />

              <TextField
                label="Audience"
                value={formData.humanPrompt?.audience || ''}
                onChange={(e) => updateHumanPrompt('audience', e.target.value)}
                error={!!errors.audience}
                helperText={errors.audience || "Who is the target audience for this prompt?"}
                fullWidth
                required
              />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Steps
                </Typography>
                {formData.humanPrompt?.steps?.map((step, index) => (
                  <Box key={index} display="flex" gap={1} mb={1}>
                    <TextField
                      placeholder={`Step ${index + 1}`}
                      value={step}
                      onChange={(e) => updateStep(index, e.target.value)}
                      fullWidth
                      size="small"
                    />
                    <IconButton
                      onClick={() => removeStep(index)}
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={addStep}
                  variant="outlined"
                  size="small"
                >
                  Add Step
                </Button>
              </Box>

              <TextField
                label="Output Format"
                value={formData.humanPrompt?.output_expectations?.format || ''}
                onChange={(e) => updateHumanPrompt('output_expectations', {
                  ...formData.humanPrompt?.output_expectations,
                  format: e.target.value,
                  fields: formData.humanPrompt?.output_expectations?.fields || []
                })}
                error={!!errors.outputExpectations}
                helperText={errors.outputExpectations || "Describe the expected output format"}
                multiline
                rows={3}
                fullWidth
                required
              />

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Examples (Optional)
                </Typography>
                {formData.humanPrompt?.examples?.map((example, index) => (
                  <Box key={index} display="flex" gap={1} mb={1}>
                    <TextField
                      placeholder={`Example ${index + 1}`}
                      value={example}
                      onChange={(e) => updateExample(index, e.target.value)}
                      fullWidth
                      size="small"
                      multiline
                      rows={2}
                    />
                    <IconButton
                      onClick={() => removeExample(index)}
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  startIcon={<AddIcon />}
                  onClick={addExample}
                  variant="outlined"
                  size="small"
                >
                  Add Example
                </Button>
              </Box>
            </Box>
          </TabPanel>

          {/* Variables Tab */}
          <TabPanel value={tabValue} index={2}>
            <Box display="flex" flexDirection="column" gap={2}>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Variables</Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={addVariable}
                  variant="outlined"
                  size="small"
                >
                  Add Variable
                </Button>
              </Box>

              {formData.variables?.map((variable, index) => (
                <Paper key={index} sx={{ p: 2 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="subtitle1">Variable {index + 1}</Typography>
                    <IconButton
                      onClick={() => removeVariable(index)}
                      size="small"
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>

                  <Box display="flex" flexDirection="column" gap={2}>
                    <TextField
                      label="Name"
                      value={variable.name}
                      onChange={(e) => updateVariable(index, 'name', e.target.value)}
                      size="small"
                      required
                    />

                    <TextField
                      label="Description"
                      value={variable.description}
                      onChange={(e) => updateVariable(index, 'description', e.target.value)}
                      multiline
                      rows={2}
                      size="small"
                      required
                    />

                    <Box display="flex" gap={2}>
                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Type</InputLabel>
                        <Select
                          value={variable.type}
                          onChange={(e) => updateVariable(index, 'type', e.target.value)}
                          label="Type"
                        >
                          <MenuItem value="string">String</MenuItem>
                          <MenuItem value="number">Number</MenuItem>
                          <MenuItem value="boolean">Boolean</MenuItem>
                          <MenuItem value="array">Array</MenuItem>
                          <MenuItem value="object">Object</MenuItem>
                        </Select>
                      </FormControl>

                      <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Required</InputLabel>
                        <Select
                          value={variable.required ? 'yes' : 'no'}
                          onChange={(e) => updateVariable(index, 'required', e.target.value === 'yes')}
                          label="Required"
                        >
                          <MenuItem value="yes">Yes</MenuItem>
                          <MenuItem value="no">No</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>

                    <TextField
                      label="Default Value (JSON)"
                      value={variable.defaultValue ? JSON.stringify(variable.defaultValue) : ''}
                      onChange={(e) => {
                        try {
                          const value = e.target.value ? JSON.parse(e.target.value) : undefined;
                          updateVariable(index, 'defaultValue', value);
                        } catch {
                          // Invalid JSON, ignore
                        }
                      }}
                      size="small"
                      placeholder="null"
                    />
                  </Box>
                </Paper>
              ))}

              {(!formData.variables || formData.variables.length === 0) && (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                  No variables defined. Click "Add Variable" to create one.
                </Typography>
              )}
            </Box>
          </TabPanel>

          {/* Preview Tab */}
          <TabPanel value={tabValue} index={3}>
            <Box display="flex" flexDirection="column" gap={2}>
              <Alert severity="info">
                This is a preview of how your prompt will appear to users.
              </Alert>

              <Paper sx={{ p: 2 }}>
                <Typography variant="h5" gutterBottom>
                  {formData.metadata?.title || 'Untitled Prompt'}
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  {formData.metadata?.summary || 'No summary provided'}
                </Typography>
                
                {formData.metadata?.tags && formData.metadata.tags.length > 0 && (
                  <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                    {formData.metadata.tags.map((tag) => (
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
                )}

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" gutterBottom>
                  Goal
                </Typography>
                <Typography variant="body1" paragraph>
                  {formData.humanPrompt?.goal || 'No goal specified'}
                </Typography>

                <Typography variant="h6" gutterBottom>
                  Audience
                </Typography>
                <Typography variant="body1" paragraph>
                  {formData.humanPrompt?.audience || 'No audience specified'}
                </Typography>

                <Typography variant="h6" gutterBottom>
                  Steps
                </Typography>
                <Box component="ol" sx={{ pl: 2 }}>
                  {formData.humanPrompt?.steps?.filter(step => step.trim()).map((step, index) => (
                    <Typography key={index} component="li" variant="body1" sx={{ mb: 0.5 }}>
                      {step}
                    </Typography>
                  )) || <Typography variant="body2" color="text.secondary">No steps defined</Typography>}
                </Box>

                <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                  Output Expectations
                </Typography>
                <Typography variant="body1">
                  {formData.humanPrompt?.output_expectations?.format || 'No output format specified'}
                </Typography>
              </Paper>
            </Box>
          </TabPanel>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={isLoading || !hasChanges}
          startIcon={isLoading ? <CircularProgress size={20} /> : <SaveIcon />}
        >
          {isLoading ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};