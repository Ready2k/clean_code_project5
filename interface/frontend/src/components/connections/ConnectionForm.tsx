import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  Divider,
  IconButton,
  InputAdornment,
  Chip,
  Autocomplete,
  Grid,
  Card,
  CardContent,
  CircularProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { SecureInput } from './SecureInput';
import { useAppDispatch } from '../../hooks/redux';
import { createConnection, updateConnection } from '../../store/slices/connectionsSlice';
import { LLMConnection, CreateConnectionRequest, UpdateConnectionRequest } from '../../types/connections';

interface ConnectionFormProps {
  connection?: LLMConnection | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const OPENAI_MODELS = [
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4-turbo-preview',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-16k',
  'text-davinci-003',
  'text-davinci-002'
];

const BEDROCK_MODELS = [
  'anthropic.claude-3-sonnet-20240229-v1:0',
  'anthropic.claude-3-haiku-20240307-v1:0',
  'anthropic.claude-v2:1',
  'anthropic.claude-v2',
  'anthropic.claude-instant-v1',
  'amazon.titan-text-express-v1',
  'amazon.titan-text-lite-v1',
  'ai21.j2-ultra-v1',
  'ai21.j2-mid-v1',
  'cohere.command-text-v14',
  'cohere.command-light-text-v14',
  'meta.llama2-13b-chat-v1',
  'meta.llama2-70b-chat-v1'
];

const AWS_REGIONS = [
  'us-east-1',
  'us-west-2',
  'eu-west-1',
  'eu-central-1',
  'ap-southeast-1',
  'ap-northeast-1'
];

export const ConnectionForm: React.FC<ConnectionFormProps> = ({
  connection,
  onSuccess,
  onCancel
}) => {
  const dispatch = useAppDispatch();
  const isEditing = !!connection;

  const [formData, setFormData] = useState({
    name: '',
    provider: 'openai' as 'openai' | 'bedrock',
    // OpenAI fields
    apiKey: '',
    organizationId: '',
    baseUrl: '',
    // Bedrock fields
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1',
    // Common fields
    models: [] as string[],
    defaultModel: ''
  });


  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (connection) {
      const config = connection.config as any;
      setFormData({
        name: connection.name,
        provider: connection.provider,
        apiKey: config.apiKey || '',
        organizationId: config.organizationId || '',
        baseUrl: config.baseUrl || '',
        accessKeyId: config.accessKeyId || '',
        secretAccessKey: config.secretAccessKey || '',
        region: config.region || 'us-east-1',
        models: config.models || [],
        defaultModel: config.defaultModel || ''
      });
    } else {
      // Set default models when provider changes
      const defaultModels = formData.provider === 'openai' ? OPENAI_MODELS : BEDROCK_MODELS;
      setFormData(prev => ({
        ...prev,
        models: defaultModels,
        defaultModel: defaultModels[0]
      }));
    }
  }, [connection, formData.provider]);

  const handleProviderChange = (provider: 'openai' | 'bedrock') => {
    const defaultModels = provider === 'openai' ? OPENAI_MODELS : BEDROCK_MODELS;
    setFormData(prev => ({
      ...prev,
      provider,
      models: defaultModels,
      defaultModel: defaultModels[0],
      // Clear provider-specific fields
      apiKey: '',
      organizationId: '',
      baseUrl: '',
      accessKeyId: '',
      secretAccessKey: '',
      region: 'us-east-1'
    }));
    setErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Connection name is required';
    }

    if (formData.provider === 'openai') {
      if (!formData.apiKey.trim()) {
        newErrors.apiKey = 'API key is required';
      }
    } else if (formData.provider === 'bedrock') {
      if (!formData.accessKeyId.trim()) {
        newErrors.accessKeyId = 'Access Key ID is required';
      }
      if (!formData.secretAccessKey.trim()) {
        newErrors.secretAccessKey = 'Secret Access Key is required';
      }
      if (!formData.region) {
        newErrors.region = 'Region is required';
      }
    }

    if (formData.models.length === 0) {
      newErrors.models = 'At least one model must be selected';
    }

    if (!formData.defaultModel) {
      newErrors.defaultModel = 'Default model is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const config = formData.provider === 'openai' 
        ? {
            apiKey: formData.apiKey,
            organizationId: formData.organizationId || undefined,
            baseUrl: formData.baseUrl || undefined,
            models: formData.models,
            defaultModel: formData.defaultModel
          }
        : {
            accessKeyId: formData.accessKeyId,
            secretAccessKey: formData.secretAccessKey,
            region: formData.region,
            models: formData.models,
            defaultModel: formData.defaultModel
          };

      if (isEditing && connection) {
        const updateData: UpdateConnectionRequest = {
          name: formData.name,
          config
        };
        await dispatch(updateConnection({ id: connection.id, data: updateData })).unwrap();
      } else {
        const createData: CreateConnectionRequest = {
          name: formData.name,
          provider: formData.provider,
          config
        };
        await dispatch(createConnection(createData)).unwrap();
      }

      onSuccess();
    } catch (error: any) {
      setErrors({ submit: error.message || 'Failed to save connection' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableModels = formData.provider === 'openai' ? OPENAI_MODELS : BEDROCK_MODELS;

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      {errors.submit && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errors.submit}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              
              <TextField
                fullWidth
                label="Connection Name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                error={!!errors.name}
                helperText={errors.name}
                margin="normal"
                required
              />

              <FormControl fullWidth margin="normal" disabled={isEditing}>
                <InputLabel>Provider</InputLabel>
                <Select
                  value={formData.provider}
                  label="Provider"
                  onChange={(e) => handleProviderChange(e.target.value as 'openai' | 'bedrock')}
                >
                  <MenuItem value="openai">OpenAI</MenuItem>
                  <MenuItem value="bedrock">AWS Bedrock</MenuItem>
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>

        {/* Provider Configuration */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {formData.provider === 'openai' ? 'OpenAI Configuration' : 'AWS Bedrock Configuration'}
              </Typography>

              {formData.provider === 'openai' ? (
                <>
                  <SecureInput
                    label="API Key"
                    value={formData.apiKey}
                    onChange={(value) => setFormData(prev => ({ ...prev, apiKey: value }))}
                    error={errors.apiKey}
                    helperText="Your OpenAI API key"
                    required
                    placeholder="sk-..."
                  />

                  <TextField
                    fullWidth
                    label="Organization ID (Optional)"
                    value={formData.organizationId}
                    onChange={(e) => setFormData(prev => ({ ...prev, organizationId: e.target.value }))}
                    margin="normal"
                    helperText="Optional: Your OpenAI organization ID"
                  />

                  <TextField
                    fullWidth
                    label="Base URL (Optional)"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData(prev => ({ ...prev, baseUrl: e.target.value }))}
                    margin="normal"
                    helperText="Optional: Custom API base URL"
                  />
                </>
              ) : (
                <>
                  <TextField
                    fullWidth
                    label="Access Key ID"
                    value={formData.accessKeyId}
                    onChange={(e) => setFormData(prev => ({ ...prev, accessKeyId: e.target.value }))}
                    error={!!errors.accessKeyId}
                    helperText={errors.accessKeyId || 'Your AWS Access Key ID'}
                    margin="normal"
                    required
                  />

                  <SecureInput
                    label="Secret Access Key"
                    value={formData.secretAccessKey}
                    onChange={(value) => setFormData(prev => ({ ...prev, secretAccessKey: value }))}
                    error={errors.secretAccessKey}
                    helperText="Your AWS Secret Access Key"
                    required
                  />

                  <FormControl fullWidth margin="normal">
                    <InputLabel>Region</InputLabel>
                    <Select
                      value={formData.region}
                      label="Region"
                      onChange={(e) => setFormData(prev => ({ ...prev, region: e.target.value }))}
                      error={!!errors.region}
                    >
                      {AWS_REGIONS.map((region) => (
                        <MenuItem key={region} value={region}>
                          {region}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Model Configuration */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Model Configuration
              </Typography>

              <Autocomplete
                multiple
                options={availableModels}
                value={formData.models}
                onChange={(_, newValue) => {
                  setFormData(prev => ({ 
                    ...prev, 
                    models: newValue,
                    defaultModel: newValue.includes(prev.defaultModel) ? prev.defaultModel : newValue[0] || ''
                  }));
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      {...getTagProps({ index })}
                      key={option}
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Available Models"
                    error={!!errors.models}
                    helperText={errors.models || 'Select the models you want to use'}
                    margin="normal"
                  />
                )}
              />

              <FormControl fullWidth margin="normal">
                <InputLabel>Default Model</InputLabel>
                <Select
                  value={formData.defaultModel}
                  label="Default Model"
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultModel: e.target.value }))}
                  error={!!errors.defaultModel}
                >
                  {formData.models.map((model) => (
                    <MenuItem key={model} value={model}>
                      {model}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
        <Button onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={20} /> : null}
        >
          {isSubmitting ? 'Saving...' : isEditing ? 'Update Connection' : 'Create Connection'}
        </Button>
      </Box>
    </Box>
  );
};