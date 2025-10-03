/**
 * Provider Template Library Component
 * 
 * Template gallery with preview functionality, custom template creation,
 * and template application with parameter customization.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Fab,
  Menu,
  Badge,
  Avatar,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  GetApp as DownloadIcon,
  CloudSync as CloudSyncIcon,
  Computer as ComputerIcon,
  Person as PersonIcon,
  MoreVert as MoreVertIcon,
  Close as CloseIcon,
  PlayArrow as ApplyIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Code as CodeIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';

import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
} from '../../../store/slices/providersSlice';
import {
  ProviderTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ApplyTemplateRequest,
  AuthMethod,
  ProviderTemplateConfig,
  ModelTemplateConfig,
} from '../../../types/providers';

interface ProviderTemplateLibraryProps {
  onTemplateApplied?: (providerId: string) => void;
}

interface TemplateFormData {
  name: string;
  description: string;
  providerConfig: ProviderTemplateConfig;
  defaultModels: ModelTemplateConfig[];
}

export const ProviderTemplateLibrary: React.FC<ProviderTemplateLibraryProps> = ({
  onTemplateApplied,
}) => {
  const dispatch = useAppDispatch();
  const { templates, loading, error } = useAppSelector((state) => state.providers);

  // Local state
  const [selectedTemplate, setSelectedTemplate] = useState<ProviderTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [filterType, setFilterType] = useState<'all' | 'system' | 'custom'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStep, setActiveStep] = useState(0);

  // Form for template creation/editing
  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<TemplateFormData>({
    mode: 'onChange',
    defaultValues: {
      name: '',
      description: '',
      providerConfig: {
        name: '',
        description: '',
        apiEndpoint: '',
        authMethod: 'api_key',
        authConfig: {
          type: 'api_key',
          fields: {},
        },
      },
      defaultModels: [],
    },
  });

  const watchedValues = watch();

  // Load templates on mount
  useEffect(() => {
    dispatch(fetchTemplates());
  }, [dispatch]);

  // Filter templates
  const filteredTemplates = (templates || []).filter(template => {
    const matchesType = filterType === 'all' || 
      (filterType === 'system' && template.isSystem) ||
      (filterType === 'custom' && !template.isSystem);
    
    const matchesSearch = !searchTerm || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesType && matchesSearch;
  });

  // Handle template actions
  const handlePreviewTemplate = (template: ProviderTemplate) => {
    setSelectedTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleEditTemplate = (template: ProviderTemplate) => {
    setSelectedTemplate(template);
    reset({
      name: template.name,
      description: template.description || '',
      providerConfig: template.providerConfig,
      defaultModels: template.defaultModels,
    });
    setIsEditOpen(true);
    handleMenuClose();
  };

  const handleDeleteTemplate = async (template: ProviderTemplate) => {
    if (template.isSystem) {
      alert('Cannot delete system templates');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete template "${template.name}"?`)) {
      await dispatch(deleteTemplate(template.id));
    }
    handleMenuClose();
  };

  const handleApplyTemplate = (template: ProviderTemplate) => {
    setSelectedTemplate(template);
    setIsApplyOpen(true);
    handleMenuClose();
  };

  // Handle menu
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, template: ProviderTemplate) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedTemplate(template);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTemplate(null);
  };

  // Handle form submission
  const onSubmitCreate = async (data: TemplateFormData) => {
    try {
      await dispatch(createTemplate(data)).unwrap();
      setIsCreateOpen(false);
      reset();
      setActiveStep(0);
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  };

  const onSubmitEdit = async (data: TemplateFormData) => {
    if (!selectedTemplate) return;
    
    try {
      await dispatch(updateTemplate({ id: selectedTemplate.id, data })).unwrap();
      setIsEditOpen(false);
      setSelectedTemplate(null);
      reset();
    } catch (error) {
      console.error('Failed to update template:', error);
    }
  };

  // Handle template application
  const handleTemplateApplication = async (customizations: any) => {
    if (!selectedTemplate) return;
    
    try {
      const request: ApplyTemplateRequest = {
        templateId: selectedTemplate.id,
        customizations,
      };
      
      const result = await dispatch(applyTemplate(request)).unwrap();
      setIsApplyOpen(false);
      setSelectedTemplate(null);
      
      if (onTemplateApplied) {
        onTemplateApplied(result.id);
      }
    } catch (error) {
      console.error('Failed to apply template:', error);
    }
  };

  // Get auth method info
  const getAuthMethodInfo = (method: AuthMethod) => {
    switch (method) {
      case 'api_key':
        return { label: 'API Key', icon: <SecurityIcon />, color: 'primary' };
      case 'oauth2':
        return { label: 'OAuth 2.0', icon: <SecurityIcon />, color: 'secondary' };
      case 'aws_iam':
        return { label: 'AWS IAM', icon: <SecurityIcon />, color: 'warning' };
      case 'custom':
        return { label: 'Custom', icon: <SettingsIcon />, color: 'info' };
      default:
        return { label: method, icon: <SettingsIcon />, color: 'default' };
    }
  };

  // Render template card
  const renderTemplateCard = (template: ProviderTemplate) => {
    const authInfo = getAuthMethodInfo(template.providerConfig.authMethod);
    
    return (
      <Card
        key={template.id}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          '&:hover': {
            boxShadow: 4,
          },
        }}
        onClick={() => handlePreviewTemplate(template)}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ bgcolor: template.isSystem ? 'info.main' : 'primary.main' }}>
                {template.isSystem ? <ComputerIcon /> : <PersonIcon />}
              </Avatar>
              <Box>
                <Typography variant="h6" noWrap>
                  {template.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {template.isSystem && (
                    <Chip label="System" size="small" color="info" />
                  )}
                  <Chip
                    label={authInfo.label}
                    size="small"
                    color={authInfo.color as any}
                    variant="outlined"
                  />
                </Box>
              </Box>
            </Box>
            
            <IconButton
              size="small"
              onClick={(e) => handleMenuOpen(e, template)}
            >
              <MoreVertIcon />
            </IconButton>
          </Box>

          {/* Description */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {template.description || 'No description available'}
          </Typography>

          {/* Provider Info */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              API Endpoint:
            </Typography>
            <Typography variant="body2" noWrap>
              {template.providerConfig.apiEndpoint}
            </Typography>
          </Box>

          {/* Models */}
          <Box>
            <Typography variant="caption" color="text.secondary">
              Default Models ({template.defaultModels.length}):
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              {template.defaultModels.slice(0, 3).map((model, index) => (
                <Chip
                  key={index}
                  label={model.name}
                  size="small"
                  variant="outlined"
                />
              ))}
              {template.defaultModels.length > 3 && (
                <Chip
                  label={`+${template.defaultModels.length - 3} more`}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
              )}
            </Box>
          </Box>
        </CardContent>

        <CardActions>
          <Button
            size="small"
            startIcon={<VisibilityIcon />}
            onClick={(e) => {
              e.stopPropagation();
              handlePreviewTemplate(template);
            }}
          >
            Preview
          </Button>
          <Button
            size="small"
            startIcon={<ApplyIcon />}
            onClick={(e) => {
              e.stopPropagation();
              handleApplyTemplate(template);
            }}
          >
            Apply
          </Button>
        </CardActions>
      </Card>
    );
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">Provider Templates</Typography>
          <Typography variant="body2" color="text.secondary">
            Pre-configured templates for quick provider setup
          </Typography>
        </Box>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setIsCreateOpen(true)}
        >
          Create Template
        </Button>
      </Box>

      {/* Error Alert */}
      {error.templates && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error.templates}
        </Alert>
      )}

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                fullWidth
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  label="Type"
                >
                  <MenuItem value="all">All Templates</MenuItem>
                  <MenuItem value="system">System Templates</MenuItem>
                  <MenuItem value="custom">Custom Templates</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={4}>
              <Typography variant="body2" color="text.secondary">
                {filteredTemplates.length} templates found
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Templates Grid */}
      {loading.templates ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          {filteredTemplates.map((template) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
              {renderTemplateCard(template)}
            </Grid>
          ))}
        </Grid>
      )}

      {/* Empty State */}
      {!loading.templates && filteredTemplates.length === 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No templates found. {filterType !== 'all' && 'Try changing the filter or '}
          Create your first template to get started.
        </Alert>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => selectedTemplate && handlePreviewTemplate(selectedTemplate)}>
          <ListItemIcon>
            <VisibilityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Preview</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => selectedTemplate && handleApplyTemplate(selectedTemplate)}>
          <ListItemIcon>
            <ApplyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Apply Template</ListItemText>
        </MenuItem>

        {selectedTemplate && !selectedTemplate.isSystem && (
          <>
            <Divider />
            <MenuItem onClick={() => selectedTemplate && handleEditTemplate(selectedTemplate)}>
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Edit Template</ListItemText>
            </MenuItem>

            <MenuItem
              onClick={() => selectedTemplate && handleDeleteTemplate(selectedTemplate)}
              sx={{ color: 'error.main' }}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText>Delete Template</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Template Preview Dialog */}
      <Dialog
        open={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Template Preview</Typography>
            <IconButton onClick={() => setIsPreviewOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {selectedTemplate && (
            <Box>
              {/* Template Info */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {selectedTemplate.name}
                    {selectedTemplate.isSystem && (
                      <Chip label="System" size="small" color="info" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {selectedTemplate.description}
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        API Endpoint:
                      </Typography>
                      <Typography variant="body2">
                        {selectedTemplate.providerConfig.apiEndpoint}
                      </Typography>
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <Typography variant="caption" color="text.secondary">
                        Authentication:
                      </Typography>
                      <Typography variant="body2">
                        {getAuthMethodInfo(selectedTemplate.providerConfig.authMethod).label}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Default Models */}
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Default Models ({selectedTemplate.defaultModels.length})
                  </Typography>
                  
                  <List>
                    {selectedTemplate.defaultModels.map((model, index) => (
                      <ListItem key={index} divider={index < selectedTemplate.defaultModels.length - 1}>
                        <ListItemIcon>
                          <MemoryIcon />
                        </ListItemIcon>
                        <ListItemText
                          primary={model.name}
                          secondary={
                            <Box>
                              <Typography variant="body2" component="span">
                                {model.identifier} • {model.contextLength.toLocaleString()} tokens
                              </Typography>
                              {model.isDefault && (
                                <Chip label="Default" size="small" color="primary" sx={{ ml: 1 }} />
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setIsPreviewOpen(false)}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setIsPreviewOpen(false);
              if (selectedTemplate) {
                handleApplyTemplate(selectedTemplate);
              }
            }}
          >
            Apply Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Template Dialog */}
      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { minHeight: '70vh' } }}
      >
        <DialogTitle>Create New Template</DialogTitle>
        
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical" sx={{ mt: 2 }}>
            <Step>
              <StepLabel>Basic Information</StepLabel>
              <StepContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="name"
                      control={control}
                      rules={{ required: 'Name is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Template Name"
                          fullWidth
                          error={!!errors.name}
                          helperText={errors.name?.message}
                        />
                      )}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Controller
                      name="description"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Description"
                          fullWidth
                          multiline
                          rows={3}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={() => setActiveStep(1)}
                    disabled={!watchedValues.name}
                  >
                    Next
                  </Button>
                </Box>
              </StepContent>
            </Step>

            <Step>
              <StepLabel>Provider Configuration</StepLabel>
              <StepContent>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="providerConfig.name"
                      control={control}
                      rules={{ required: 'Provider name is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Provider Name"
                          fullWidth
                          error={!!errors.providerConfig?.name}
                          helperText={errors.providerConfig?.name?.message}
                        />
                      )}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="providerConfig.apiEndpoint"
                      control={control}
                      rules={{ required: 'API endpoint is required' }}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="API Endpoint"
                          fullWidth
                          error={!!errors.providerConfig?.apiEndpoint}
                          helperText={errors.providerConfig?.apiEndpoint?.message}
                        />
                      )}
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Controller
                      name="providerConfig.authMethod"
                      control={control}
                      render={({ field }) => (
                        <FormControl fullWidth>
                          <InputLabel>Authentication Method</InputLabel>
                          <Select {...field} label="Authentication Method">
                            <MenuItem value="api_key">API Key</MenuItem>
                            <MenuItem value="oauth2">OAuth 2.0</MenuItem>
                            <MenuItem value="aws_iam">AWS IAM</MenuItem>
                            <MenuItem value="custom">Custom</MenuItem>
                          </Select>
                        </FormControl>
                      )}
                    />
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button onClick={() => setActiveStep(0)}>
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => setActiveStep(2)}
                    disabled={!watchedValues.providerConfig.name || !watchedValues.providerConfig.apiEndpoint}
                  >
                    Next
                  </Button>
                </Box>
              </StepContent>
            </Step>

            <Step>
              <StepLabel>Default Models</StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Define default models that will be created when this template is applied.
                </Typography>
                
                {/* Model configuration would go here */}
                <Alert severity="info">
                  Model configuration interface would be implemented here.
                </Alert>
                
                <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                  <Button onClick={() => setActiveStep(1)}>
                    Back
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSubmit(onSubmitCreate)}
                    disabled={!isValid}
                  >
                    Create Template
                  </Button>
                </Box>
              </StepContent>
            </Step>
          </Stepper>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => {
            setIsCreateOpen(false);
            setActiveStep(0);
            reset();
          }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Apply Template Dialog */}
      <Dialog
        open={isApplyOpen}
        onClose={() => setIsApplyOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Apply Template</DialogTitle>
        
        <DialogContent>
          {selectedTemplate && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {selectedTemplate.name}
              </Typography>
              
              <Alert severity="info" sx={{ mb: 3 }}>
                This will create a new provider based on the template configuration.
                You can customize the settings before applying.
              </Alert>
              
              {/* Customization form would go here */}
              <Typography variant="body2" color="text.secondary">
                Template customization interface would be implemented here.
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setIsApplyOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => handleTemplateApplication({})}
          >
            Apply Template
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="create template"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
        onClick={() => setIsCreateOpen(true)}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default ProviderTemplateLibrary;