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
  Divider
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  Preview as PreviewIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import {
  closeExportDialog,
  updateExportOptions,
  previewExport,
  exportPrompt,
  fetchFormats
} from '../../../store/slices/exportSlice';

interface ExportDialogProps {
  promptId?: string;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ promptId }) => {
  const dispatch = useAppDispatch();
  const {
    exportDialogOpen,
    currentExportOptions,
    formats,
    templates,
    currentPreview,
    isLoadingPreview,
    isLoadingFormats,
    activeExports,
    error
  } = useAppSelector((state) => state.export);

  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (exportDialogOpen && formats.length === 0) {
      dispatch(fetchFormats());
    }
  }, [exportDialogOpen, formats.length, dispatch]);

  const handleClose = () => {
    dispatch(closeExportDialog());
    setVariableValues({});
  };

  const handleOptionChange = (field: string, value: any) => {
    dispatch(updateExportOptions({ [field]: value }));
  };

  const handleVariableChange = (key: string, value: string) => {
    const newValues = { ...variableValues, [key]: value };
    setVariableValues(newValues);
    dispatch(updateExportOptions({ variableValues: newValues }));
  };

  const handlePreview = () => {
    if (promptId) {
      dispatch(previewExport({ promptId, options: currentExportOptions }));
    }
  };

  const handleExport = () => {
    if (promptId) {
      dispatch(exportPrompt({ promptId, options: currentExportOptions }));
    }
  };

  const getActiveExport = () => {
    return Object.values(activeExports).find(exp => 
      exp.type === 'single' && exp.status !== 'completed' && exp.status !== 'failed'
    );
  };

  const activeExport = getActiveExport();

  return (
    <Dialog
      open={exportDialogOpen}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '600px' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Export Prompt</Typography>
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

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Format Selection */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Export Format
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Format</InputLabel>
              <Select
                value={currentExportOptions.format}
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

          {/* Template Selection */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Export Template
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Template</InputLabel>
              <Select
                value={currentExportOptions.template}
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

          {/* Basic Options */}
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Include Options
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={currentExportOptions.includeMetadata}
                    onChange={(e) => handleOptionChange('includeMetadata', e.target.checked)}
                  />
                }
                label="Include metadata (title, tags, owner, etc.)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={currentExportOptions.includeHistory}
                    onChange={(e) => handleOptionChange('includeHistory', e.target.checked)}
                  />
                }
                label="Include version history"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={currentExportOptions.includeRatings}
                    onChange={(e) => handleOptionChange('includeRatings', e.target.checked)}
                  />
                }
                label="Include user ratings and reviews"
              />
            </Box>
          </Box>

          {/* Variable Substitution */}
          <Box>
            <FormControlLabel
              control={
                <Checkbox
                  checked={currentExportOptions.substituteVariables}
                  onChange={(e) => handleOptionChange('substituteVariables', e.target.checked)}
                />
              }
              label="Substitute variable values in export"
            />
            
            {currentExportOptions.substituteVariables && (
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography>Variable Values</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Enter values for variables that will be substituted in the exported prompt.
                    </Typography>
                    
                    {/* Example variables - in real implementation, these would come from the prompt */}
                    <TextField
                      label="input_data"
                      value={variableValues.input_data || ''}
                      onChange={(e) => handleVariableChange('input_data', e.target.value)}
                      placeholder="Enter value for input_data variable"
                      fullWidth
                    />
                    <TextField
                      label="context"
                      value={variableValues.context || ''}
                      onChange={(e) => handleVariableChange('context', e.target.value)}
                      placeholder="Enter value for context variable"
                      fullWidth
                      multiline
                      rows={2}
                    />
                  </Box>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>

          {/* Preview Section */}
          {currentPreview && 'preview' in currentPreview && (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Export Preview
              </Typography>
              <Paper sx={{ p: 2, bgcolor: '#ffffff', border: '1px solid #cccccc' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography variant="body2" sx={{ color: '#000000' }}>
                      <strong>Filename:</strong> {currentPreview.filename}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#000000' }}>
                      <strong>Size:</strong> {(currentPreview.size / 1024).toFixed(2)} KB
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#000000' }}>
                      <strong>Format:</strong> {currentPreview.format.toUpperCase()}
                    </Typography>
                  </Box>
                  <Chip 
                    label={currentPreview.template} 
                    size="small" 
                    color="primary" 
                  />
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="subtitle2" gutterBottom>
                  Content Preview:
                </Typography>
                <Box
                  component="pre"
                  sx={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    border: '1px solid #cccccc',
                    p: 1,
                    borderRadius: 1,
                    overflow: 'auto',
                    maxHeight: '200px',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {currentPreview.preview}
                  {currentPreview.truncated && (
                    <Typography variant="caption" color="text.secondary">
                      ... (truncated)
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button
          onClick={handlePreview}
          startIcon={<PreviewIcon />}
          disabled={!promptId || isLoadingPreview}
        >
          {isLoadingPreview ? 'Loading...' : 'Preview'}
        </Button>
        
        <Button
          onClick={handleExport}
          variant="contained"
          startIcon={<DownloadIcon />}
          disabled={!promptId || !!activeExport}
        >
          {activeExport ? 'Exporting...' : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportDialog;