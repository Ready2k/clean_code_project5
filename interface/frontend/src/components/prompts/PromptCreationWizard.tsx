import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { CreatePromptRequest, HumanPrompt } from '../../types/prompts';

interface PromptCreationWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePromptRequest) => Promise<void>;
  isLoading?: boolean;
}

interface FormData {
  metadata: {
    title: string;
    summary: string;
    tags: string[];
    category?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
  };
  humanPrompt: HumanPrompt;
}

const initialFormData: FormData = {
  metadata: {
    title: '',
    summary: '',
    tags: [],
  },
  humanPrompt: {
    goal: '',
    audience: '',
    steps: [''],
    output_expectations: {
      format: '',
      fields: [],
    },
  },
};

const steps = [
  {
    label: 'Basic Information',
    description: 'Set up the basic metadata for your prompt',
  },
  {
    label: 'Prompt Content',
    description: 'Define the core content and structure',
  },
  {
    label: 'Review & Create',
    description: 'Review your prompt and create it',
  },
];

export const PromptCreationWizard: React.FC<PromptCreationWizardProps> = ({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}) => {
  const [activeStep, setActiveStep] = React.useState(0);
  const [formData, setFormData] = React.useState<FormData>(initialFormData);
  const [tagInput, setTagInput] = React.useState('');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setFormData(initialFormData);
    setTagInput('');
    setErrors({});
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!formData.metadata.title.trim()) {
        newErrors.title = 'Title is required';
      }
      if (!formData.metadata.summary.trim()) {
        newErrors.summary = 'Summary is required';
      }
    } else if (step === 1) {
      if (!formData.humanPrompt.goal.trim()) {
        newErrors.goal = 'Goal is required';
      } else if (formData.humanPrompt.goal.trim().length < 10) {
        newErrors.goal = 'Goal must be at least 10 characters long';
      }
      if (!formData.humanPrompt.audience.trim()) {
        newErrors.audience = 'Audience is required';
      } else if (formData.humanPrompt.audience.trim().length < 5) {
        newErrors.audience = 'Audience must be at least 5 characters long';
      }
      if (!formData.humanPrompt.output_expectations.format.trim()) {
        newErrors.outputExpectations = 'Output format is required';
      }
      const validSteps = formData.humanPrompt.steps.filter(step => step.trim().length > 0);
      if (validSteps.length === 0) {
        newErrors.steps = 'At least one step is required';
      } else if (validSteps.some(step => step.trim().length < 1)) {
        newErrors.steps = 'Each step must have at least 1 character';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    // Validate all steps before submission
    const step0Valid = validateStep(0);
    const step1Valid = validateStep(1);
    
    if (step0Valid && step1Valid) {
      try {
        // Clean up the data before submitting
        const cleanedData: CreatePromptRequest = {
          metadata: {
            title: formData.metadata.title.trim(),
            summary: formData.metadata.summary.trim(),
            tags: formData.metadata.tags,
          },
          humanPrompt: {
            goal: formData.humanPrompt.goal.trim(),
            audience: formData.humanPrompt.audience.trim(),
            steps: formData.humanPrompt.steps.filter(step => step.trim()),
            output_expectations: {
              format: formData.humanPrompt.output_expectations.format.trim(),
              fields: formData.humanPrompt.output_expectations.fields.filter(field => field.trim()),
            },
          },
        };
        
        await onSubmit(cleanedData);
        handleClose();
      } catch (error) {
        console.error('Failed to create prompt:', error);
      }
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.metadata.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          tags: [...prev.metadata.tags, tagInput.trim()],
        },
      }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        tags: prev.metadata.tags.filter(tag => tag !== tagToRemove),
      },
    }));
  };

  const addStep = () => {
    setFormData(prev => ({
      ...prev,
      humanPrompt: {
        ...prev.humanPrompt,
        steps: [...prev.humanPrompt.steps, ''],
      },
    }));
  };

  const updateStep = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      humanPrompt: {
        ...prev.humanPrompt,
        steps: prev.humanPrompt.steps.map((step, i) => i === index ? value : step),
      },
    }));
  };

  const removeStep = (index: number) => {
    if (formData.humanPrompt.steps.length > 1) {
      setFormData(prev => ({
        ...prev,
        humanPrompt: {
          ...prev.humanPrompt,
          steps: prev.humanPrompt.steps.filter((_, i) => i !== index),
        },
      }));
    }
  };



  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box display="flex" flexDirection="column" gap={3}>
            <TextField
              label="Title"
              value={formData.metadata.title}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                metadata: { ...prev.metadata, title: e.target.value }
              }))}
              error={!!errors.title}
              helperText={errors.title}
              fullWidth
              required
            />

            <TextField
              label="Summary"
              value={formData.metadata.summary}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                metadata: { ...prev.metadata, summary: e.target.value }
              }))}
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
                {formData.metadata.tags.map((tag) => (
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
              <InputLabel>Category (Optional)</InputLabel>
              <Select
                value={formData.metadata.category || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  metadata: { ...prev.metadata, category: e.target.value }
                }))}
                label="Category (Optional)"
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
              <InputLabel>Difficulty (Optional)</InputLabel>
              <Select
                value={formData.metadata.difficulty || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  metadata: { ...prev.metadata, difficulty: e.target.value as any }
                }))}
                label="Difficulty (Optional)"
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="beginner">Beginner</MenuItem>
                <MenuItem value="intermediate">Intermediate</MenuItem>
                <MenuItem value="advanced">Advanced</MenuItem>
              </Select>
            </FormControl>
          </Box>
        );

      case 1:
        return (
          <Box display="flex" flexDirection="column" gap={3}>
            <TextField
              label="Goal"
              value={formData.humanPrompt.goal}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                humanPrompt: { ...prev.humanPrompt, goal: e.target.value }
              }))}
              error={!!errors.goal}
              helperText={errors.goal || "What is the main objective of this prompt? (minimum 10 characters)"}
              multiline
              rows={2}
              fullWidth
              required
            />

            <TextField
              label="Audience"
              value={formData.humanPrompt.audience}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                humanPrompt: { ...prev.humanPrompt, audience: e.target.value }
              }))}
              error={!!errors.audience}
              helperText={errors.audience || "Who is the target audience for this prompt? (minimum 5 characters)"}
              fullWidth
              required
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Steps {errors.steps && <Typography component="span" color="error" variant="caption">({errors.steps})</Typography>}
              </Typography>
              {formData.humanPrompt.steps.map((step, index) => (
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
                    disabled={formData.humanPrompt.steps.length === 1}
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
              value={formData.humanPrompt.output_expectations.format}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                humanPrompt: { 
                  ...prev.humanPrompt, 
                  output_expectations: {
                    ...prev.humanPrompt.output_expectations,
                    format: e.target.value
                  }
                }
              }))}
              error={!!errors.outputExpectations}
              helperText={errors.outputExpectations || "Describe the expected output format (e.g., 'JSON response', 'Structured feedback', 'Markdown report')"}
              multiline
              rows={2}
              fullWidth
              required
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Output Fields (Optional)
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Specify the key fields or sections that should be included in the output
              </Typography>
              {formData.humanPrompt.output_expectations.fields.map((field, index) => (
                <Box key={index} display="flex" gap={1} mb={1}>
                  <TextField
                    placeholder={`Field ${index + 1} (e.g., 'summary', 'recommendations')`}
                    value={field}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      humanPrompt: {
                        ...prev.humanPrompt,
                        output_expectations: {
                          ...prev.humanPrompt.output_expectations,
                          fields: prev.humanPrompt.output_expectations.fields.map((f, i) => i === index ? e.target.value : f)
                        }
                      }
                    }))}
                    fullWidth
                    size="small"
                  />
                  <IconButton
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      humanPrompt: {
                        ...prev.humanPrompt,
                        output_expectations: {
                          ...prev.humanPrompt.output_expectations,
                          fields: prev.humanPrompt.output_expectations.fields.filter((_, i) => i !== index)
                        }
                      }
                    }))}
                    size="small"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              ))}
              <Button
                startIcon={<AddIcon />}
                onClick={() => setFormData(prev => ({
                  ...prev,
                  humanPrompt: {
                    ...prev.humanPrompt,
                    output_expectations: {
                      ...prev.humanPrompt.output_expectations,
                      fields: [...prev.humanPrompt.output_expectations.fields, '']
                    }
                  }
                }))}
                variant="outlined"
                size="small"
              >
                Add Field
              </Button>
            </Box>


          </Box>
        );

      case 2:
        return (
          <Box display="flex" flexDirection="column" gap={2}>
            <Alert severity="info">
              Review your prompt details below and click "Create Prompt" to save it.
            </Alert>

            <Box>
              <Typography variant="h6" gutterBottom>
                {formData.metadata.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {formData.metadata.summary}
              </Typography>
              <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
                {formData.metadata.tags.map((tag) => (
                  <Chip key={tag} label={tag} size="small" />
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Goal
              </Typography>
              <Typography variant="body2" paragraph>
                {formData.humanPrompt.goal}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Audience
              </Typography>
              <Typography variant="body2" paragraph>
                {formData.humanPrompt.audience}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Steps
              </Typography>
              <Box component="ol" sx={{ pl: 2 }}>
                {formData.humanPrompt.steps.filter(step => step.trim()).map((step, index) => (
                  <Typography key={index} component="li" variant="body2">
                    {step}
                  </Typography>
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Output Expectations
              </Typography>
              <Typography variant="body2" paragraph>
                <strong>Format:</strong> {formData.humanPrompt.output_expectations.format}
              </Typography>
              {formData.humanPrompt.output_expectations.fields.length > 0 && (
                <Box>
                  <Typography variant="body2" gutterBottom>
                    <strong>Required Fields:</strong>
                  </Typography>
                  <Box component="ul" sx={{ pl: 2, mt: 0 }}>
                    {formData.humanPrompt.output_expectations.fields.filter(field => field.trim()).map((field, index) => (
                      <Typography key={index} component="li" variant="body2">
                        {field}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          Create New Prompt
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.label}>
              <StepLabel>
                <Typography variant="h6">{step.label}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {step.description}
                </Typography>
              </StepLabel>
              <StepContent>
                {renderStepContent(index)}
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={isLoading}>
            Back
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button onClick={handleNext} variant="contained" disabled={isLoading}>
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : null}
          >
            {isLoading ? 'Creating...' : 'Create Prompt'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};