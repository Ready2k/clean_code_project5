import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  IconButton,
  Tooltip,
  Chip,
  Alert,
  Button,
  Collapse,
  Divider,
  Checkbox,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Cloud as OpenAIIcon,
  Storage as BedrockIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { RenderResult } from '../../../types/prompts';
import RenderProgressIndicator from './RenderProgressIndicator';

interface RenderPreviewProps {
  render: RenderResult;
  compareMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: () => void;
  onCopy: (content: string) => void;
  onDownload: (content: string, filename: string) => void;
  onRerender: () => void;
  onSaveVariant?: (render: RenderResult) => void;
  originalPrompt?: any;
}

const RenderPreview: React.FC<RenderPreviewProps> = ({
  render,
  compareMode = false,
  isSelected = false,
  onToggleSelection,
  onCopy,
  onDownload,
  onRerender,
  onSaveVariant,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Helper function to determine provider from model name
  const getProviderFromModel = (model: string): string => {
    const lowerModel = model.toLowerCase();
    if (lowerModel.includes('gpt') || lowerModel.includes('openai')) {
      return 'openai';
    } else if (lowerModel.includes('claude') || lowerModel.includes('anthropic')) {
      return 'anthropic';
    } else if (lowerModel.includes('llama') || lowerModel.includes('meta')) {
      return 'meta';
    } else if (lowerModel.includes('gemini') || lowerModel.includes('google')) {
      return 'google';
    }
    // Default fallback
    return 'unknown';
  };

  // Determine if this render can be saved as a variant
  const canSaveAsVariant = () => {
    // Don't allow saving if it's a preview/no-adaptation
    if (render.isPreview || render.connectionId === 'no-adaptation') {
      return false;
    }
    
    // Don't allow saving if no adaptation occurred (would be identical to original)
    if (!render.payload?.response || render.payload.response.includes('[MOCK RESPONSE]')) {
      return false;
    }
    
    // Must have successful real LLM response
    return render.success && render.payload?.response && !render.payload.response.includes('[MOCK');
  };
  const [showMetadata, setShowMetadata] = useState(false);

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return <OpenAIIcon fontSize="small" />;
      case 'bedrock':
      case 'aws':
        return <BedrockIcon fontSize="small" />;
      case 'anthropic':
        return <BedrockIcon fontSize="small" />; // Using storage icon for now
      case 'meta':
      case 'llama':
        return <BedrockIcon fontSize="small" />; // Using storage icon for now
      default:
        return <BedrockIcon fontSize="small" />;
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return '#10a37f';
      case 'bedrock':
      case 'aws':
        return '#ff9900';
      case 'anthropic':
        return '#d97706';
      case 'meta':
      case 'llama':
        return '#1877f2';
      default:
        return '#6b7280';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return timestamp ? new Date(timestamp).toLocaleString() : 'Unknown date';
    } catch (error) {
      return 'Invalid date';
    }
  };

  const generateFilename = () => {
    const timestamp = new Date(render.createdAt).toISOString().slice(0, 19).replace(/:/g, '-');
    return `prompt-${render.provider}-${render.model}-${timestamp}.txt`;
  };

  const handleCopy = () => {
    const content = typeof render.payload === 'string' ? render.payload : (render.payload.response || render.payload.formatted_prompt);
    onCopy(content);
  };

  const handleDownload = () => {
    const content = typeof render.payload === 'string' ? render.payload : (render.payload.response || render.payload.formatted_prompt);
    onDownload(content, generateFilename());
  };

  const handleSaveVariant = () => {
    setSaveDialogOpen(true);
  };

  const confirmSaveVariant = () => {
    if (onSaveVariant) {
      onSaveVariant(render);
    }
    setSaveDialogOpen(false);
  };

  return (
    <Card
      sx={{
        border: compareMode && isSelected ? 2 : 1,
        borderColor: compareMode && isSelected ? 'primary.main' : 'divider',
        position: 'relative',
      }}
    >
      {compareMode && (
        <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={isSelected}
                onChange={onToggleSelection}
                size="small"
              />
            }
            label=""
            sx={{ m: 0 }}
          />
        </Box>
      )}

      <CardContent>
        {/* Show progress indicator if this render is in progress */}
        <RenderProgressIndicator
          promptId={render.promptId}
          connectionId={render.connectionId}
          provider={render.provider}
          compact={true}
        />
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {getProviderIcon(render.provider)}
          <Typography variant="h6" sx={{ ml: 1, mr: 2 }}>
            {render.provider.toUpperCase()}
          </Typography>
          <Chip
            label={render.model}
            size="small"
            sx={{
              backgroundColor: getProviderColor(render.provider),
              color: 'white',
              mr: 1,
            }}
          />
          {render.success ? (
            <Chip
              icon={<SuccessIcon />}
              label="Success"
              color="success"
              size="small"
            />
          ) : (
            <Chip
              icon={<ErrorIcon />}
              label="Error"
              color="error"
              size="small"
            />
          )}
        </Box>

        {!render.success && render.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {render.error}
          </Alert>
        )}

        {render.success && (
          <>
            <Box
              className="render-text-container"
              sx={{
                backgroundColor: '#f8f9fa',
                color: '#212529',
                border: '1px solid #dee2e6',
                borderRadius: 2,
                p: 2,
                fontFamily: '"SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: '13px',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: expanded ? 'none' : '400px',
                overflow: expanded ? 'visible' : 'auto',
                position: 'relative',
                '&::-webkit-scrollbar': {
                  width: '8px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: '#f1f3f4',
                  borderRadius: '4px',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: '#c1c1c1',
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: '#a8a8a8',
                  },
                },
                // Firefox scrollbar styling
                scrollbarWidth: 'thin',
                scrollbarColor: '#c1c1c1 #f1f3f4',
              }}
            >
              {(() => {
                const content = typeof render.payload === 'string' ? render.payload : (render.payload.response || render.payload.formatted_prompt);
                return content || 'No content available';
              })()}
              {!expanded && (typeof render.payload === 'string' ? render.payload.length : (render.payload.response || render.payload.formatted_prompt).length) > 1000 && (
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: '60px',
                    background: 'linear-gradient(transparent, rgba(248, 249, 250, 0.95))',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    pb: 1,
                  }}
                >
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setExpanded(true)}
                    endIcon={<ExpandMoreIcon />}
                    sx={{
                      backgroundColor: '#ffffff',
                      '&:hover': {
                        backgroundColor: '#f8f9fa',
                      },
                    }}
                  >
                    Show More
                  </Button>
                </Box>
              )}
            </Box>

            {expanded && (typeof render.payload === 'string' ? render.payload.length : (render.payload.response || render.payload.formatted_prompt).length) > 1000 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setExpanded(false)}
                  endIcon={<ExpandLessIcon />}
                  sx={{
                    backgroundColor: '#ffffff',
                    '&:hover': {
                      backgroundColor: '#f8f9fa',
                    },
                  }}
                >
                  Show Less
                </Button>
              </Box>
            )}
          </>
        )}

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Rendered: {formatTimestamp(render.createdAt)}
          </Typography>
          <Button
            size="small"
            onClick={() => setShowMetadata(!showMetadata)}
            endIcon={showMetadata ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            Metadata
          </Button>
        </Box>

        <Collapse in={showMetadata}>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="caption">
              <strong>Model:</strong> {render.targetModel || render.model}
            </Typography>
            {render.variables && Object.keys(render.variables).length > 0 && (
              <Box>
                <Typography variant="caption" display="block">
                  <strong>Variables:</strong>
                </Typography>
                <Box sx={{ pl: 1 }}>
                  {Object.entries(render.variables).map(([key, value]) => (
                    <Typography key={key} variant="caption" display="block">
                      {key}: {JSON.stringify(value)}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
            <Typography variant="caption">
              <strong>Render ID:</strong> {render.id}
            </Typography>
          </Box>
        </Collapse>
      </CardContent>

      <CardActions sx={{ justifyContent: 'space-between' }}>
        <Box>
          <Tooltip title="Copy to clipboard">
            <span>
              <IconButton onClick={handleCopy} disabled={!render.success}>
                <CopyIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Download as file">
            <span>
              <IconButton onClick={handleDownload} disabled={!render.success}>
                <DownloadIcon />
              </IconButton>
            </span>
          </Tooltip>
          {canSaveAsVariant() && (
            <Tooltip title="Save as variant">
              <span>
                <IconButton onClick={handleSaveVariant} color="primary">
                  <SaveIcon />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
        <Tooltip title="Re-render with same settings">
          <IconButton onClick={onRerender}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </CardActions>

      {/* Save Variant Confirmation Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
        <DialogTitle>Save as Variant</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Save this adapted prompt as a variant of the original prompt?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            This will create a new variant tagged as <strong>{render.targetModel ? getProviderFromModel(render.targetModel) + '-' + render.targetModel : `${render.provider}-${render.model}`}</strong> that can be reused later.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmSaveVariant} variant="contained" color="primary">
            Save Variant
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default RenderPreview;