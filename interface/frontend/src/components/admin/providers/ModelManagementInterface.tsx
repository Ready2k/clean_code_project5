/**
 * Model Management Interface Component
 * 
 * Comprehensive interface for managing models within providers,
 * including bulk operations, capability configuration, and testing.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Checkbox,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Alert,
  CircularProgress,
  LinearProgress,
  Pagination,
  FormControlLabel,
  Switch,
  Divider,
  Fab,
  Badge,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
  MoreVert as MoreVertIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  Visibility as VisibilityIcon,
  ContentCopy as CopyIcon,
  Download as ExportIcon,
  Upload as ImportIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';

import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import {
  fetchModels,
  fetchProviderModels,
  createModel,
  updateModel,
  deleteModel,
  bulkDeleteModels,
  testModel,
  setModelFilters,
  clearModelFilters,
  setModelPagination,
} from '../../../store/slices/providersSlice';
import {
  Model,
  ModelStatus,
  CreateModelRequest,
  UpdateModelRequest,
  ModelFormData,
  ModelFilters,
} from '../../../types/providers';

interface ModelManagementInterfaceProps {
  providerId?: string;
  showProviderColumn?: boolean;
}

export const ModelManagementInterface: React.FC<ModelManagementInterfaceProps> = ({
  providerId,
  showProviderColumn = false,
}) => {
  const dispatch = useAppDispatch();
  const {
    models,
    providers,
    filters,
    pagination,
    loading,
    error,
    testResults,
  } = useAppSelector((state) => state.providers);

  // Local state
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [testingModels, setTestingModels] = useState<Set<string>>(new Set());

  // Form for model creation/editing
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<ModelFormData>({
    mode: 'onChange',
    defaultValues: {
      identifier: '',
      name: '',
      description: '',
      contextLength: 4096,
      capabilities: {
        supportsSystemMessages: true,
        maxContextLength: 4096,
        supportedRoles: ['system', 'user', 'assistant'],
        supportsStreaming: false,
        supportsTools: false,
        supportsFunctionCalling: false,
      },
      isDefault: false,
    },
  });

  // Load models on mount
  useEffect(() => {
    if (providerId) {
      dispatch(fetchProviderModels(providerId));
    } else {
      dispatch(fetchModels({
        ...filters.models,
        search: searchTerm || undefined,
        page: pagination.models.page,
        limit: pagination.models.limit,
      }));
    }
  }, [dispatch, providerId, filters.models, searchTerm, pagination.models]);

  // Filter models based on provider if specified
  const filteredModels = providerId 
    ? models.filter(model => model.providerId === providerId)
    : models;

  // Handle model selection
  const handleSelectModel = (modelId: string, selected: boolean) => {
    setSelectedModels(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(modelId);
      } else {
        newSet.delete(modelId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedModels(new Set(filteredModels.map(m => m.id)));
    } else {
      setSelectedModels(new Set());
    }
  };

  // Handle menu actions
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, model: Model) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedModel(model);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedModel(null);
  };

  // Handle model actions
  const handleEditModel = (model: Model) => {
    reset({
      identifier: model.identifier,
      name: model.name,
      description: model.description || '',
      contextLength: model.contextLength,
      capabilities: model.capabilities,
      pricingInfo: model.pricingInfo,
      isDefault: model.isDefault,
    });
    setSelectedModel(model);
    setIsEditDialogOpen(true);
    handleMenuClose();
  };

  const handleTestModel = async (model: Model) => {
    setTestingModels(prev => new Set(prev).add(model.id));
    try {
      await dispatch(testModel(model.id));
    } finally {
      setTestingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(model.id);
        return newSet;
      });
    }
    handleMenuClose();
  };

  const handleDeleteModel = async (model: Model) => {
    if (window.confirm(`Are you sure you want to delete model "${model.name}"?`)) {
      await dispatch(deleteModel(model.id));
    }
    handleMenuClose();
  };

  // Handle bulk operations
  const handleBulkDelete = async () => {
    if (selectedModels.size === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedModels.size} models?`)) {
      await dispatch(bulkDeleteModels(Array.from(selectedModels)));
      setSelectedModels(new Set());
    }
    setIsBulkDialogOpen(false);
  };

  // Handle form submission
  const onSubmitCreate = async (data: ModelFormData) => {
    if (!providerId) return;
    
    try {
      await dispatch(createModel({ providerId, data })).unwrap();
      setIsCreateDialogOpen(false);
      reset();
    } catch (error) {
      console.error('Failed to create model:', error);
    }
  };

  const onSubmitEdit = async (data: ModelFormData) => {
    if (!selectedModel) return;
    
    try {
      await dispatch(updateModel({ id: selectedModel.id, data })).unwrap();
      setIsEditDialogOpen(false);
      setSelectedModel(null);
      reset();
    } catch (error) {
      console.error('Failed to update model:', error);
    }
  };

  // Get status info
  const getStatusInfo = (status: ModelStatus) => {
    switch (status) {
      case 'active':
        return { color: 'success' as const, icon: <CheckCircleIcon fontSize="small" /> };
      case 'inactive':
        return { color: 'default' as const, icon: <ErrorIcon fontSize="small" /> };
      case 'deprecated':
        return { color: 'warning' as const, icon: <WarningIcon fontSize="small" /> };
      default:
        return { color: 'default' as const, icon: <WarningIcon fontSize="small" /> };
    }
  };

  // Get test result info
  const getTestResultInfo = (model: Model) => {
    const result = testResults.models[model.id];
    if (!result) {
      return { color: 'default' as const, text: 'Not tested', icon: null };
    }

    if (result.success) {
      return {
        color: 'success' as const,
        text: `${result.latency}ms`,
        icon: <CheckCircleIcon fontSize="small" />,
      };
    } else {
      return {
        color: 'error' as const,
        text: 'Failed',
        icon: <ErrorIcon fontSize="small" />,
      };
    }
  };

  // Format capabilities
  const formatCapabilities = (capabilities: any) => {
    const caps = [];
    if (capabilities.supportsSystemMessages) caps.push('System');
    if (capabilities.supportsStreaming) caps.push('Streaming');
    if (capabilities.supportsTools) caps.push('Tools');
    if (capabilities.supportsFunctionCalling) caps.push('Functions');
    return caps;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5">
            {providerId ? 'Provider Models' : 'All Models'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage AI models and their capabilities
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          {selectedModels.size > 0 && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setIsBulkDialogOpen(true)}
            >
              Delete Selected ({selectedModels.size})
            </Button>
          )}
          
          {providerId && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setIsCreateDialogOpen(true)}
            >
              Add Model
            </Button>
          )}
        </Box>
      </Box>

      {/* Error Alert */}
      {error.models && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error.models}
        </Alert>
      )}

      {/* Loading Indicator */}
      {loading.models && (
        <LinearProgress sx={{ mb: 2 }} />
      )}

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              placeholder="Search models..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              size="small"
              sx={{ minWidth: 300 }}
            />
            
            <Button
              variant={showFilters ? 'contained' : 'outlined'}
              startIcon={<FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
              size="small"
            >
              Filters
            </Button>

            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => {
                if (providerId) {
                  dispatch(fetchProviderModels(providerId));
                } else {
                  dispatch(fetchModels());
                }
              }}
              size="small"
            >
              Refresh
            </Button>
          </Box>

          {/* Filters Panel */}
          {showFilters && (
            <Box sx={{ mt: 3, pt: 3, borderTop: 1, borderColor: 'divider' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filters.models.status?.[0] || ''}
                      onChange={(e) => dispatch(setModelFilters({ 
                        status: e.target.value ? [e.target.value as ModelStatus] : undefined 
                      }))}
                    >
                      <MenuItem value="">All</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                      <MenuItem value="deprecated">Deprecated</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={filters.models.isDefault || false}
                        onChange={(e) => dispatch(setModelFilters({ 
                          isDefault: e.target.checked || undefined 
                        }))}
                      />
                    }
                    label="Default Models Only"
                  />
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Models Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedModels.size > 0 && selectedModels.size < filteredModels.length}
                    checked={filteredModels.length > 0 && selectedModels.size === filteredModels.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                <TableCell>Model</TableCell>
                {showProviderColumn && <TableCell>Provider</TableCell>}
                <TableCell>Status</TableCell>
                <TableCell>Context Length</TableCell>
                <TableCell>Capabilities</TableCell>
                <TableCell>Last Test</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredModels.map((model) => {
                const isSelected = selectedModels.has(model.id);
                const statusInfo = getStatusInfo(model.status);
                const testInfo = getTestResultInfo(model);
                const isTesting = testingModels.has(model.id);
                const capabilities = formatCapabilities(model.capabilities);
                const provider = providers.find(p => p.id === model.providerId);

                return (
                  <TableRow
                    key={model.id}
                    hover
                    selected={isSelected}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => handleSelectModel(model.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {model.name}
                          {model.isDefault && (
                            <Chip label="Default" size="small" color="primary" sx={{ ml: 1 }} />
                          )}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {model.identifier}
                        </Typography>
                        {model.description && (
                          <Typography variant="caption" color="text.secondary">
                            {model.description}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>

                    {showProviderColumn && (
                      <TableCell>
                        <Typography variant="body2">
                          {provider?.name || 'Unknown'}
                        </Typography>
                      </TableCell>
                    )}

                    <TableCell>
                      <Chip
                        icon={statusInfo.icon}
                        label={model.status}
                        color={statusInfo.color}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MemoryIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {model.contextLength.toLocaleString()}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {capabilities.map((cap) => (
                          <Chip
                            key={cap}
                            label={cap}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </TableCell>

                    <TableCell>
                      {testInfo.icon && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {testInfo.icon}
                          <Typography variant="body2" color={`${testInfo.color}.main`}>
                            {testInfo.text}
                          </Typography>
                        </Box>
                      )}
                    </TableCell>

                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Tooltip title="Test Model">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTestModel(model);
                            }}
                            disabled={isTesting}
                          >
                            {isTesting ? (
                              <CircularProgress size={16} />
                            ) : (
                              <TestIcon />
                            )}
                          </IconButton>
                        </Tooltip>

                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, model)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {filteredModels.length} models
          </Typography>
          
          <Pagination
            count={Math.ceil(pagination.models.total / pagination.models.limit)}
            page={pagination.models.page}
            onChange={(_, page) => dispatch(setModelPagination({ page }))}
            color="primary"
          />
        </Box>
      </Card>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => selectedModel && handleEditModel(selectedModel)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Model</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => selectedModel && handleTestModel(selectedModel)}>
          <ListItemIcon>
            <TestIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Test Model</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={() => selectedModel && handleDeleteModel(selectedModel)}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete Model</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create Model Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Add New Model</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <Controller
                name="identifier"
                control={control}
                rules={{ required: 'Identifier is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Model Identifier"
                    fullWidth
                    error={!!errors.identifier}
                    helperText={errors.identifier?.message}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Controller
                name="name"
                control={control}
                rules={{ required: 'Name is required' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Display Name"
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
                    rows={2}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Controller
                name="contextLength"
                control={control}
                rules={{ required: 'Context length is required', min: 1 }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Context Length"
                    type="number"
                    fullWidth
                    error={!!errors.contextLength}
                    helperText={errors.contextLength?.message}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <FormControlLabel
                control={
                  <Controller
                    name="isDefault"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                }
                label="Default Model"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmitCreate)}
            variant="contained"
            disabled={!isValid}
          >
            Create Model
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Model Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Model</DialogTitle>
        <DialogContent>
          {/* Similar form fields as create dialog */}
          <Typography variant="body2" color="text.secondary">
            Edit model form would go here (similar to create form)
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmitEdit)}
            variant="contained"
            disabled={!isValid}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog
        open={isBulkDialogOpen}
        onClose={() => setIsBulkDialogOpen(false)}
      >
        <DialogTitle>Delete Models</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedModels.size} selected models?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsBulkDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkDelete}
            variant="contained"
            color="error"
          >
            Delete Models
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      {providerId && (
        <Fab
          color="primary"
          aria-label="add model"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
          }}
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
};

export default ModelManagementInterface;