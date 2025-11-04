import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  Typography,
  Alert,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  Close as CloseIcon,
  Upload as UploadIcon,
  Link as LinkIcon,
  Code as CodeIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useAppDispatch } from '../../../hooks/redux';
import { fetchPrompts } from '../../../store/slices/promptsSlice';
import { promptsAPI } from '../../../services/api/promptsAPI';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ImportOptions {
  sourceProvider?: string;
  conflictResolution: 'skip' | 'overwrite' | 'create_new' | 'prompt';
  defaultTags: string[];
  autoEnhance: boolean;
  slugPrefix?: string;
  validateBeforeImport: boolean;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
  detectedProvider?: string;
  confidence?: number;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  // Form states
  const [contentInput, setContentInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tagInput, setTagInput] = useState('');
  
  const [options, setOptions] = useState<ImportOptions>({
    conflictResolution: 'create_new',
    defaultTags: [],
    autoEnhance: false,
    validateBeforeImport: true
  });

  const [supportedFormats, setSupportedFormats] = useState<any[]>([]);

  React.useEffect(() => {
    if (open) {
      loadSupportedFormats();
    }
  }, [open]);

  const loadSupportedFormats = async () => {
    try {
      const response = await promptsAPI.getSupportedImportFormats();
      setSupportedFormats(response.data);
    } catch (error) {
      console.error('Failed to load supported formats:', error);
    }
  };

  const handleClose = () => {
    setActiveTab(0);
    setContentInput('');
    setUrlInput('');
    setSelectedFile(null);
    setTagInput('');
    setOptions({
      conflictResolution: 'create_new',
      defaultTags: [],
      autoEnhance: false,
      validateBeforeImport: true
    });
    setError(null);
    setSuccess(null);
    setValidation(null);
    onClose();
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setError(null);
    setSuccess(null);
    setValidation(null);
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !options.defaultTags.includes(tagInput.trim())) {
      setOptions(prev => ({
        ...prev,
        defaultTags: [...prev.defaultTags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setOptions(prev => ({
      ...prev,
      defaultTags: prev.defaultTags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const validateContent = async (content: string) => {
    try {
      const response = await promptsAPI.validateImportContent({
        content,
        sourceProvider: options.sourceProvider
      });
      setValidation(response.data);
      return response.data.isValid;
    } catch (error) {
      setError('Failed to validate content');
      return false;
    }
  };

  const handleImportFromContent = async () => {
    if (!contentInput.trim()) {
      setError('Please enter content to import');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate first if enabled
      if (options.validateBeforeImport) {
        const isValid = await validateContent(contentInput);
        if (!isValid) {
          setIsLoading(false);
          return;
        }
      }

      const response = await promptsAPI.importFromContent({
        content: contentInput,
        ...options
      });

      if (response.data) {
        setSuccess(`Successfully imported prompt: ${response.data.metadata.title}`);
        dispatch(fetchPrompts({}));
        setTimeout(handleClose, 2000);
      } else {
        setSuccess('Prompt was skipped due to conflict resolution settings');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to import prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const convertGitHubUrl = (url: string): string => {
    // Check if it's a GitHub blob URL
    const githubBlobRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/;
    const match = url.match(githubBlobRegex);
    
    if (match) {
      const [, owner, repo, branch, path] = match;
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    }
    
    // Return original URL if not a GitHub blob URL
    return url;
  };

  const handleImportFromUrl = async () => {
    if (!urlInput.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Convert GitHub URLs to raw URLs automatically
      const convertedUrl = convertGitHubUrl(urlInput);
      
      const response = await promptsAPI.importFromUrl({
        url: convertedUrl,
        ...options
      });

      if (response.data) {
        setSuccess(`Successfully imported prompt: ${response.data.metadata.title}`);
        dispatch(fetchPrompts({}));
        setTimeout(handleClose, 2000);
      } else {
        setSuccess('Prompt was skipped due to conflict resolution settings');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to import prompt from URL');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportFromFile = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('sourceProvider', options.sourceProvider || '');
      formData.append('conflictResolution', options.conflictResolution);
      formData.append('defaultTags', JSON.stringify(options.defaultTags));
      formData.append('autoEnhance', options.autoEnhance.toString());
      formData.append('slugPrefix', options.slugPrefix || '');
      formData.append('validateBeforeImport', options.validateBeforeImport.toString());

      const response = await promptsAPI.importFromFile(formData);

      if (response.data) {
        setSuccess(`Successfully imported prompt: ${response.data.metadata.title}`);
        dispatch(fetchPrompts({}));
        setTimeout(handleClose, 2000);
      } else {
        setSuccess('Prompt was skipped due to conflict resolution settings');
      }
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to import prompt from file');
    } finally {
      setIsLoading(false);
    }
  };

  const renderContentTab = () => (
    <Box sx={{ mt: 2 }}>
      <TextField
        fullWidth
        multiline
        rows={12}
        label="Prompt Content (JSON/Markdown)"
        value={contentInput}
        onChange={(e) => setContentInput(e.target.value)}
        placeholder="Paste your prompt JSON or Markdown here..."
        sx={{ mb: 2 }}
      />
      
      {validation && (
        <Box sx={{ mb: 2 }}>
          <Alert 
            severity={validation.isValid ? 'success' : 'error'}
            icon={validation.isValid ? <CheckIcon /> : <ErrorIcon />}
          >
            <Typography variant="body2">
              {validation.isValid ? 'Content is valid' : 'Content validation failed'}
            </Typography>
            {validation.detectedProvider && (
              <Typography variant="caption" display="block">
                Detected format: {validation.detectedProvider} (confidence: {Math.round((validation.confidence || 0) * 100)}%)
              </Typography>
            )}
          </Alert>
          
          {validation.errors.length > 0 && (
            <List dense>
              {validation.errors.map((error, index) => (
                <ListItem key={index}>
                  <ListItemIcon><ErrorIcon color="error" fontSize="small" /></ListItemIcon>
                  <ListItemText primary={error} />
                </ListItem>
              ))}
            </List>
          )}
          
          {validation.suggestions.length > 0 && (
            <List dense>
              {validation.suggestions.map((suggestion, index) => (
                <ListItem key={index}>
                  <ListItemIcon><InfoIcon color="info" fontSize="small" /></ListItemIcon>
                  <ListItemText primary={suggestion} />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}
    </Box>
  );

  const renderUrlTab = () => {
    const convertedUrl = convertGitHubUrl(urlInput);
    const isConverted = convertedUrl !== urlInput;
    
    return (
      <Box sx={{ mt: 2 }}>
        <TextField
          fullWidth
          label="URL"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://github.com/user/repo/blob/main/prompt.md"
          sx={{ mb: 2 }}
          helperText="Enter a URL to a prompt file (GitHub URLs will be auto-converted to raw URLs)"
        />
        
        {isConverted && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>GitHub URL detected!</strong> Will be converted to:
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem', mt: 1 }}>
              {convertedUrl}
            </Typography>
          </Alert>
        )}
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Supported sources: GitHub files (auto-converted), raw URLs, and other publicly accessible prompt files.
            Supports JSON, Markdown, YAML, and text formats.
          </Typography>
        </Alert>
      </Box>
    );
  };

  const renderFileTab = () => (
    <Box sx={{ mt: 2 }}>
      <input
        accept=".json,.yaml,.yml,.txt,.md,.markdown"
        style={{ display: 'none' }}
        id="file-upload"
        type="file"
        onChange={handleFileSelect}
      />
      <label htmlFor="file-upload">
        <Button
          variant="outlined"
          component="span"
          startIcon={<UploadIcon />}
          fullWidth
          sx={{ mb: 2, py: 2 }}
        >
          {selectedFile ? selectedFile.name : 'Choose File'}
        </Button>
      </label>
      
      {selectedFile && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
          </Typography>
        </Alert>
      )}
      
      <Alert severity="info">
        <Typography variant="body2">
          Supported file types: JSON (.json), YAML (.yaml, .yml), Markdown (.md, .markdown), and text files (.txt)
        </Typography>
      </Alert>
    </Box>
  );

  const renderOptions = () => (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Import Options
      </Typography>
      
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Source Provider (Optional)</InputLabel>
        <Select
          value={options.sourceProvider || ''}
          onChange={(e) => setOptions(prev => ({ ...prev, sourceProvider: e.target.value || undefined }))}
        >
          <MenuItem value="">Auto-detect</MenuItem>
          <MenuItem value="openai">OpenAI</MenuItem>
          <MenuItem value="anthropic">Anthropic Claude</MenuItem>
          <MenuItem value="meta">Meta Llama</MenuItem>
          <MenuItem value="markdown">Markdown</MenuItem>
          <MenuItem value="internal">Internal Format</MenuItem>
        </Select>
      </FormControl>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Conflict Resolution</InputLabel>
        <Select
          value={options.conflictResolution}
          onChange={(e) => setOptions(prev => ({ ...prev, conflictResolution: e.target.value as any }))}
        >
          <MenuItem value="create_new">Create New (Recommended)</MenuItem>
          <MenuItem value="skip">Skip if Exists</MenuItem>
          <MenuItem value="overwrite">Overwrite Existing</MenuItem>
        </Select>
      </FormControl>

      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          label="Add Tags"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
          placeholder="Enter tag and press Enter"
          sx={{ mb: 1 }}
        />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {options.defaultTags.map((tag) => (
            <Chip
              key={tag}
              label={tag}
              onDelete={() => handleRemoveTag(tag)}
              size="small"
            />
          ))}
        </Box>
      </Box>

      <TextField
        fullWidth
        label="Slug Prefix (Optional)"
        value={options.slugPrefix || ''}
        onChange={(e) => setOptions(prev => ({ ...prev, slugPrefix: e.target.value || undefined }))}
        sx={{ mb: 2 }}
        helperText="Add a prefix to the generated slug (e.g., 'imported')"
      />

      <FormControlLabel
        control={
          <Switch
            checked={options.autoEnhance}
            onChange={(e) => setOptions(prev => ({ ...prev, autoEnhance: e.target.checked }))}
          />
        }
        label="Auto-enhance after import"
        sx={{ mb: 1 }}
      />

      <FormControlLabel
        control={
          <Switch
            checked={options.validateBeforeImport}
            onChange={(e) => setOptions(prev => ({ ...prev, validateBeforeImport: e.target.checked }))}
          />
        }
        label="Validate before import"
      />
    </Box>
  );

  const renderSupportedFormats = () => (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Supported Formats
      </Typography>
      
      {supportedFormats.map((format) => (
        <Paper key={format.provider} sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            {format.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {format.description}
          </Typography>
          <Typography variant="caption" display="block" gutterBottom>
            File extensions: {format.fileExtensions.join(', ')}
          </Typography>
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" display="block" gutterBottom>
              Example format:
            </Typography>
            <Paper sx={{ p: 1, bgcolor: 'grey.100', fontFamily: 'monospace', fontSize: '0.75rem' }}>
              <pre>{JSON.stringify(format.example, null, 2)}</pre>
            </Paper>
          </Box>
        </Paper>
      ))}
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { height: '90vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          Import Prompts
          <Button
            onClick={handleClose}
            sx={{ minWidth: 'auto', p: 1 }}
          >
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab icon={<CodeIcon />} label="Content" />
          <Tab icon={<LinkIcon />} label="URL" />
          <Tab icon={<UploadIcon />} label="File" />
          <Tab icon={<InfoIcon />} label="Formats" />
        </Tabs>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {success}
          </Alert>
        )}

        {activeTab === 0 && renderContentTab()}
        {activeTab === 1 && renderUrlTab()}
        {activeTab === 2 && renderFileTab()}
        {activeTab === 3 && renderSupportedFormats()}

        {activeTab < 3 && renderOptions()}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isLoading}>
          Cancel
        </Button>
        {activeTab < 3 && (
          <Button
            variant="contained"
            onClick={
              activeTab === 0 ? handleImportFromContent :
              activeTab === 1 ? handleImportFromUrl :
              handleImportFromFile
            }
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={20} /> : undefined}
          >
            {isLoading ? 'Importing...' : 'Import'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ImportDialog;