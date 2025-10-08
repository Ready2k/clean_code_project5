import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  TextField,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Alert,
  LinearProgress,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  Preview as PreviewIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import {
  closeBulkExportDialog,
  updateBulkExportOptions,
  previewBulkExport,
  bulkExportPrompts,
  fetchFormats,
  removeFromSelection
} from '../../../store/slices/exportSlice';

const BulkExportDialog: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    bulkExportDialogOpen,
    currentBulkExportOptions,
    formats,
    templates,
    currentPreview,
    isLoadingPreview,
    isLoadingFormats,
    activeExports,
    selectedPromptIds,
    error
  } = useAppSelector((state) => state.export);

  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [customFilename, setCustomFilename] = useState('');

  useEffect(() => {
    if (bulkExportDialogOpen && formats.length === 0) {
      dispatch(fetchFormats());
    }
  }, [bulkExportDialogOpen, formats.length, dispatch]);

  useEffect(() => {
    // Update bulk export options when selected prompts change
    dispatch(updateBulkExportOptions({ promptIds: selectedPromptIds }));
  }, [selectedPromptIds, dispatch]);

  const handleClose = () => {
    dispatch(closeBulkExportDialog());
    setVariableValues({});
    setCustomFilename('');
  };

  const handleOptionChange = (field: string, value: any) => {
    dispatch(updateBulkExportOptions({ [field]: value }));
  };

  const handleVariableChange = (key: string, value: string) => {
    const newValues = { ...variableValues, [key]: value };
    setVariableValues(newValues);
    dispatch(updateBulkExportOptions({ variableValues: newValues }));
  };

  const handleFilenameChange = (filename: string) => {
    setCustomFilename(filename);
    dispatch(updateBulkExportOptions({ filename: filename || undefined }));
  };

  const handleRemovePrompt = (promptId: string) => {
    dispatch(removeFromSelection(promptId));
  };

  const handlePreview = () => {
    dispatch(previewBulkExport(currentBulkExportOptions));
  };

  const handleExport = () => {
    dispatch(bulkExportPrompts(currentBulkExportOptions));
  };

  const getActiveExport = () => {
    return Object.values(activeExports).find(exp => 
      exp.type === 'bulk' && exp.status !== 'completed' && exp.status !== 'failed'
    );
  };

  const activeExport = getActiveExport();
  const bulkPreview = currentPreview && 'totalPrompts' in currentPreview ? currentPreview : null;

  return (
    <Dialog
      open={bulkExportDialogOpen}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '700px' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Bulk Export ({selectedPromptIds.length} prompts)
          </Typography>
          <Button
            onClick={handleClose}
            size="small"
            startIcon={<CloseIcon />}
          >
            Close
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {activeExport && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Export Progress: {activeExport.message}
            </Typography>
            <LinearProgress 
              variant="determinate" 
              value={activeExport.progress} 
              sx={{ mb: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              {activeExport.progress}% complete
            </Typography>
          </Paper>
        )}

        <Box sx={{ display: 'flex', gap: 3 }}>
          {/* Left Column - Configuration */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Format Selection */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Export Format
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Format</InputLabel>
                <Select
                  value={currentBulkExportOptions.format}
                  label="Format"
                  onChange={(e) => handleOptionChange('format', e.target.value)}
                  disabled={isLoadingFormats}
                >
                  {formats.map((format) => (
                    <MenuItem key={format.id} value={format.id}>
                      <Box>
                        <Typography variant="body2">{format.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Archive Format */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Archive Format
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Archive Format</InputLabel>
                <Select
                  value={currentBulkExportOptions.archiveFormat}
                  label="Archive Format"
                  onChange={(e) => handleOptionChange('archiveFormat', e.target.value)}
                >
                  <MenuItem value="zip">
                    <Box>
                      <Typography variant="body2">ZIP</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Standard ZIP archive format
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="tar">
                    <Box>
                      <Typography variant="body2">TAR</Typography>
                      <Typography variant="caption" color="text.secondary">
                        TAR archive format
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Template Selection */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Export Template
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Template</InputLabel>
                <Select
                  value={currentBulkExportOptions.template}
                  label="Template"
                  onChange={(e) => handleOptionChange('template', e.target.value)}
                >
                  {templates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      <Box>
                        <Typography variant="body2">{template.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {template.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Custom Filename */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Custom Filename (Optional)
              </Typography>
              <TextField
                fullWidth
                value={customFilename}
                onChange={(e) => handleFilenameChange(e.target.value)}
                placeholder={`prompts_export_${new Date().toISOString().split('T')[0]}.${currentBulkExportOptions.archiveFormat}`}
                helperText="Leave empty for auto-generated filename"
              />
            </Box>

            {/* Include Options */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Include Options
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={currentBulkExportOptions.includeMetadata}
                      onChange={(e) => handleOptionChange('includeMetadata', e.target.checked)}
                    />
                  }
                  label="Include metadata"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={currentBulkExportOptions.includeHistory}
                      onChange={(e) => handleOptionChange('includeHistory', e.target.checked)}
                    />
                  }
                  label="Include version history"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={currentBulkExportOptions.includeRatings}
                      onChange={(e) => handleOptionChange('includeRatings', e.target.checked)}
                    />
                  }
                  label="Include user ratings"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={currentBulkExportOptions.substituteVariables}
                      onChange={(e) => handleOptionChange('substituteVariables', e.target.checked)}
                    />
                  }
                  label="Substitute variable values"
                />
              </Box>
            </Box>

            {/* Variable Substitution */}
            {currentBulkExportOptions.substituteVariables && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Variable Values</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      These values will be applied to all prompts in the export.
                    </Typography>
                    
                    <TextField
                      label="input_data"
                      value={variableValues.input_data || ''}
                      onChange={(e) => handleVariableChange('input_data', e.target.value)}
                      placeholder="Global value for input_data variable"
                      fullWidth
                    />
                    <TextField
                      label="context"
                      value={variableValues.context || ''}
                      onChange={(e) => handleVariableChange('context', e.target.value)}
                      placeholder="Global value for context variable"
                      fullWidth
                      multiline
                      rows={2}
                    />
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>

          {/* Right Column - Selected Prompts & Preview */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Selected Prompts */}
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Selected Prompts ({selectedPromptIds.length})
              </Typography>
              <Paper sx={{ maxHeight: '300px', overflow: 'auto' }}>
                <List dense>
                  {selectedPromptIds.map((promptId) => (
                    <ListItem
                      key={promptId}
                      secondaryAction={
                        <IconButton
                          edge="end"
                          onClick={() => handleRemovePrompt(promptId)}
                          size="small"
                        >
                          <RemoveIcon />
                        </IconButton>
                      }
                    >
                      <ListItemIcon>
                        <CheckCircleIcon color="success" />
                      </ListItemIcon>
                      <ListItemText
                        primary={promptId}
                        secondary="Ready for export"
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Box>

            {/* Preview Section */}
            {bulkPreview && (
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Export Preview
                </Typography>
                <Paper sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #cccccc' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box>
                      <Typography variant="body2" sx={{ color: '#000000' }}>
                        <strong>Filename:</strong> {bulkPreview.filename}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#000000' }}>
                        <strong>Estimated Size:</strong> {(bulkPreview.estimatedSize / 1024).toFixed(2)} KB
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#000000' }}>
                        <strong>Format:</strong> {bulkPreview.format.toUpperCase()}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Chip 
                        label={`${bulkPreview.validPrompts} valid`}
                        size="small" 
                        color="success" 
                        sx={{ mr: 1 }}
                      />
                      {bulkPreview.invalidPrompts > 0 && (
                        <Chip 
                          label={`${bulkPreview.invalidPrompts} invalid`}
                          size="small" 
                          color="error" 
                        />
                      )}
                    </Box>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle2" gutterBottom>
                    Prompts to Export:
                  </Typography>
                  <Box sx={{ maxHeight: '200px', overflow: 'auto' }}>
                    {bulkPreview.prompts.map((prompt) => (
                      <Box
                        key={prompt.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          py: 0.5,
                          px: 1,
                          borderRadius: 1,
                          bgcolor: prompt.error ? 'error.light' : 'success.light',
                          mb: 0.5
                        }}
                      >
                        {prompt.error ? (
                          <ErrorIcon color="error" fontSize="small" />
                        ) : (
                          <CheckCircleIcon color="success" fontSize="small" />
                        )}
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {prompt.title}
                        </Typography>
                        {prompt.estimatedSize && (
                          <Typography variant="caption" color="text.secondary">
                            {(prompt.estimatedSize / 1024).toFixed(1)} KB
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Paper>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={handlePreview}
          startIcon={<PreviewIcon />}
          disabled={selectedPromptIds.length === 0 || isLoadingPreview}
        >
          {isLoadingPreview ? 'Loading...' : 'Preview'}
        </Button>
        
        <Button
          onClick={handleExport}
          variant="contained"
          startIcon={<DownloadIcon />}
          disabled={selectedPromptIds.length === 0 || !!activeExport}
        >
          {activeExport ? 'Exporting...' : `Export ${selectedPromptIds.length} Prompts`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkExportDialog;