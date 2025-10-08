import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  TextField,
  Slider,
  Chip,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Cloud as OpenAIIcon,
  Storage as BedrockIcon,
} from '@mui/icons-material';
import { LLMConnection } from '../../../types/connections';

interface ProviderSelectorProps {
  connections: LLMConnection[];
  selectedConnections: string[];
  onSelectionChange: (connections: string[]) => void;
  renderOptions: Record<string, any>;
  onOptionsChange: (options: Record<string, any>) => void;
  originalProvider?: string;
  originalModel?: string;
}

const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  connections,
  selectedConnections,
  onSelectionChange,
  renderOptions,
  onOptionsChange,
  originalProvider,
  originalModel,
}) => {
  const handleConnectionToggle = (connectionId: string) => {
    const newSelection = selectedConnections.includes(connectionId)
      ? selectedConnections.filter(id => id !== connectionId)
      : [...selectedConnections, connectionId];
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedConnections.length === connections.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(connections.map(c => c.id));
    }
  };

  const handleOptionChange = (key: string, value: any) => {
    onOptionsChange({
      ...renderOptions,
      [key]: value,
    });
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'openai':
        return <OpenAIIcon fontSize="small" />;
      case 'bedrock':
        return <BedrockIcon fontSize="small" />;
      default:
        return null;
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'openai':
        return '#10a37f';
      case 'bedrock':
        return '#ff9900';
      default:
        return '#666';
    }
  };

  // Check if user is cross-rendering (selecting different providers than original)
  const selectedProviders = selectedConnections
    .map(id => connections.find(c => c.id === id)?.provider)
    .filter(Boolean);
  
  const isCrossRendering = originalProvider && 
    selectedProviders.some(provider => provider !== originalProvider);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Adaptation Connection
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose which LLM connection to use for generating the adapted prompt
      </Typography>

      {selectedConnections.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Adaptation Connection:</strong> Using {selectedConnections.length} connection(s) to generate 
            the {originalModel || originalProvider} optimized prompt.
          </Typography>
        </Alert>
      )}

      {connections.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No active connections available. Please configure LLM connections first.
        </Typography>
      ) : (
        <>
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={selectedConnections.length === connections.length}
                  indeterminate={
                    selectedConnections.length > 0 && selectedConnections.length < connections.length
                  }
                  onChange={handleSelectAll}
                />
              }
              label={`Select All (${selectedConnections.length}/${connections.length})`}
            />
          </Box>

          <Box sx={{ mb: 3 }}>
            {connections.map((connection) => (
              <Box
                key={connection.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 1,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  backgroundColor: selectedConnections.includes(connection.id) 
                    ? 'action.selected' 
                    : 'transparent',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
                onClick={() => handleConnectionToggle(connection.id)}
              >
                <Checkbox
                  checked={selectedConnections.includes(connection.id)}
                  onChange={() => handleConnectionToggle(connection.id)}
                  sx={{ mr: 1 }}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  {getProviderIcon(connection.provider)}
                  <Typography variant="body2" sx={{ ml: 1, fontWeight: 'medium' }}>
                    {connection.name}
                  </Typography>
                  <Chip
                    label={connection.provider.toUpperCase()}
                    size="small"
                    sx={{
                      ml: 1,
                      backgroundColor: getProviderColor(connection.provider),
                      color: 'white',
                      fontSize: '0.7rem',
                    }}
                  />
                  {originalProvider && connection.provider === originalProvider && (
                    <Chip
                      label="Same Provider"
                      size="small"
                      variant="outlined"
                      sx={{
                        ml: 1,
                        borderColor: '#4caf50',
                        color: '#4caf50',
                        fontSize: '0.65rem',
                        height: 20,
                      }}
                    />
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {connection.config.defaultModel}
                </Typography>
              </Box>
            ))}
          </Box>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Advanced Options</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="body2" gutterBottom>
                    Temperature: {renderOptions.temperature}
                  </Typography>
                  <Slider
                    value={renderOptions.temperature || 0.7}
                    onChange={(_, value) => handleOptionChange('temperature', value)}
                    min={0}
                    max={2}
                    step={0.1}
                    marks={[
                      { value: 0, label: '0' },
                      { value: 1, label: '1' },
                      { value: 2, label: '2' },
                    ]}
                    valueLabelDisplay="auto"
                  />
                </Box>

                <TextField
                  label="Max Tokens"
                  type="number"
                  value={renderOptions.maxTokens || 2000}
                  onChange={(e) => handleOptionChange('maxTokens', parseInt(e.target.value))}
                  inputProps={{ min: 1, max: 8000 }}
                  size="small"
                />

                <FormControl size="small">
                  <InputLabel>Model Override</InputLabel>
                  <Select
                    value={renderOptions.modelOverride || ''}
                    onChange={(e) => handleOptionChange('modelOverride', e.target.value)}
                    label="Model Override"
                  >
                    <MenuItem value="">
                      <em>Use default model</em>
                    </MenuItem>
                    {/* Get unique models from selected connections */}
                    {Array.from(
                      new Set(
                        connections
                          .filter(c => selectedConnections.includes(c.id))
                          .flatMap(c => c.config.models || [])
                      )
                    ).map((model) => (
                      <MenuItem key={model} value={model}>
                        {model}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Switch
                      checked={renderOptions.includeSystemMessage || false}
                      onChange={(e) => handleOptionChange('includeSystemMessage', e.target.checked)}
                    />
                  }
                  label="Include System Message"
                />
              </Box>
            </AccordionDetails>
          </Accordion>
        </>
      )}
    </Box>
  );
};

export default ProviderSelector;