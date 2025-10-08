import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Cloud as OpenAIIcon,
  Storage as BedrockIcon,
} from '@mui/icons-material';
import { RenderResult } from '../../../types/prompts';

interface ComparisonViewProps {
  renders: RenderResult[];
  onCopy: (content: string) => void;
  onDownload: (content: string, filename: string) => void;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({
  renders,
  onCopy,
  onDownload,
}) => {
  const [layout, setLayout] = useState<'side-by-side' | 'stacked'>('side-by-side');
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('small');

  const successfulRenders = renders.filter(r => r.success);
  const failedRenders = renders.filter(r => !r.success);

  // Helper function to extract content from payload
  const getPayloadContent = (payload: any): string => {
    if (typeof payload === 'string') {
      return payload;
    }
    if (payload && typeof payload === 'object' && payload.formatted_prompt) {
      return payload.formatted_prompt;
    }
    return 'No content available';
  };

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

  const getFontSize = () => {
    switch (fontSize) {
      case 'small':
        return '0.75rem';
      case 'medium':
        return '0.875rem';
      case 'large':
        return '1rem';
      default:
        return '0.75rem';
    }
  };

  const generateComparisonFilename = () => {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const providers = successfulRenders.map(r => r.provider).join('-');
    return `prompt-comparison-${providers}-${timestamp}.txt`;
  };

  const handleDownloadComparison = () => {
    const content = successfulRenders
      .map((render) => {
        return [
          `=== ${render.provider.toUpperCase()} - ${render.model} ===`,
          `Rendered: ${new Date(render.createdAt).toLocaleString()}`,
          '',
          getPayloadContent(render.payload),
          '',
        ].join('\n');
      })
      .join('\n' + '='.repeat(50) + '\n\n');

    onDownload(content, generateComparisonFilename());
  };

  const handleCopyAll = () => {
    const content = successfulRenders
      .map(render => `${render.provider.toUpperCase()}: ${getPayloadContent(render.payload)}`)
      .join('\n\n---\n\n');
    onCopy(content);
  };

  if (renders.length === 0) {
    return (
      <Alert severity="info">
        Select renders to compare by enabling compare mode and checking the renders you want to compare.
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Comparison View ({renders.length} renders)
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Layout</InputLabel>
            <Select
              value={layout}
              onChange={(e) => setLayout(e.target.value as any)}
              label="Layout"
            >
              <MenuItem value="side-by-side">Side by Side</MenuItem>
              <MenuItem value="stacked">Stacked</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel>Font Size</InputLabel>
            <Select
              value={fontSize}
              onChange={(e) => setFontSize(e.target.value as any)}
              label="Font Size"
            >
              <MenuItem value="small">Small</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="large">Large</MenuItem>
            </Select>
          </FormControl>

          <Tooltip title="Copy all renders">
            <span>
              <IconButton onClick={handleCopyAll} disabled={successfulRenders.length === 0}>
                <CopyIcon />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Download comparison">
            <span>
              <IconButton onClick={handleDownloadComparison} disabled={successfulRenders.length === 0}>
                <DownloadIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {failedRenders.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {failedRenders.length} render(s) failed and are not shown in comparison.
        </Alert>
      )}

      {successfulRenders.length === 0 ? (
        <Alert severity="error">
          No successful renders to compare.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {successfulRenders.map((render, index) => (
            <Grid 
              item 
              xs={layout === 'side-by-side' ? 12 / Math.min(successfulRenders.length, 2) : 12}
              key={render.id}
            >
              <Card sx={{ height: '100%' }}>
                <CardContent>
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
                      }}
                    />
                  </Box>

                  <Box
                    sx={{
                      backgroundColor: '#f8f9fa',
                      color: '#212529',
                      border: '1px solid #dee2e6',
                      borderRadius: 2,
                      p: 2,
                      fontFamily: '"SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: getFontSize(),
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      minHeight: 200,
                      maxHeight: layout === 'side-by-side' ? 400 : 300,
                      overflow: 'auto',
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
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#c1c1c1 #f1f3f4',
                    }}
                  >
                    {getPayloadContent(render.payload)}
                  </Box>

                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(render.createdAt).toLocaleString()}
                    </Typography>
                    <Box>
                      <Tooltip title="Copy this render">
                        <IconButton 
                          size="small" 
                          onClick={() => onCopy(getPayloadContent(render.payload))}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Download this render">
                        <IconButton 
                          size="small" 
                          onClick={() => {
                            const timestamp = new Date(render.createdAt).toISOString().slice(0, 19).replace(/:/g, '-');
                            const filename = `prompt-${render.provider}-${render.model}-${timestamp}.txt`;
                            onDownload(getPayloadContent(render.payload), filename);
                          }}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Show differences if there are multiple renders */}
                  {successfulRenders.length > 1 && (
                    <>
                      <Divider sx={{ my: 1 }} />
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Length: {getPayloadContent(render.payload).length} characters
                        </Typography>
                        {index > 0 && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Difference from first: {getPayloadContent(render.payload).length - getPayloadContent(successfulRenders[0].payload).length > 0 ? '+' : ''}{getPayloadContent(render.payload).length - getPayloadContent(successfulRenders[0].payload).length} characters
                          </Typography>
                        )}
                      </Box>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {successfulRenders.length > 1 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Comparison Summary
          </Typography>
          <Card>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Length Comparison
                  </Typography>
                  {successfulRenders.map((render) => (
                    <Box key={render.id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        {render.provider.toUpperCase()} ({render.model})
                      </Typography>
                      <Typography variant="body2">
                        {getPayloadContent(render.payload).length} chars
                      </Typography>
                    </Box>
                  ))}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Render Times
                  </Typography>
                  {successfulRenders.map((render) => (
                    <Box key={render.id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">
                        {render.provider.toUpperCase()}
                      </Typography>
                      <Typography variant="body2">
                        {new Date(render.createdAt).toLocaleTimeString()}
                      </Typography>
                    </Box>
                  ))}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};

export default ComparisonView;