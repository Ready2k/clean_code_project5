import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
} from '@mui/material';
import {
  Person as OriginalIcon,
  AutoFixHigh as EnhancedIcon,
} from '@mui/icons-material';
import { PromptRecord } from '../../../types/prompts';

interface VersionSelectorProps {
  prompt: PromptRecord;
  selectedVersion: 'original' | 'enhanced' | 'original-no-adapt';
  onVersionChange: (version: 'original' | 'enhanced' | 'original-no-adapt') => void;
}

const VersionSelector: React.FC<VersionSelectorProps> = ({
  prompt,
  selectedVersion,
  onVersionChange,
}) => {
  const hasEnhancedVersion = prompt.prompt_structured && 
    Object.keys(prompt.prompt_structured).length > 0;

  const versions = [
    {
      id: 'original' as const,
      name: 'Adapted (Recommended)',
      description: 'Original prompt adapted for the target LLM',
      icon: <OriginalIcon fontSize="small" />,
      available: true,
    },
    {
      id: 'original-no-adapt' as const,
      name: 'Original (No Adaptation)',
      description: 'Raw original prompt without any adaptation',
      icon: <OriginalIcon fontSize="small" />,
      available: true,
    },
    {
      id: 'enhanced' as const,
      name: 'Enhanced (AI Structured)',
      description: 'AI-enhanced version with structured format',
      icon: <EnhancedIcon fontSize="small" />,
      available: hasEnhancedVersion,
    },
  ];

  const availableVersions = versions.filter(v => v.available);

  if (availableVersions.length <= 1) {
    return null; // Don't show selector if only one version available
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Prompt Version
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose which version of the prompt to render
      </Typography>

      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Version</InputLabel>
        <Select
          value={selectedVersion}
          onChange={(e) => onVersionChange(e.target.value as 'original' | 'enhanced')}
          label="Version"
        >
          {availableVersions.map((version) => (
            <MenuItem key={version.id} value={version.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {version.icon}
                <Box>
                  <Typography variant="body2">
                    {version.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {version.description}
                  </Typography>
                </Box>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Version Status */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {selectedVersion === 'original' && (
          <Chip
            label="Adapted Format"
            size="small"
            color="primary"
            variant="outlined"
            icon={<OriginalIcon />}
          />
        )}
        {selectedVersion === 'original-no-adapt' && (
          <Chip
            label="No Adaptation"
            size="small"
            color="warning"
            variant="outlined"
            icon={<OriginalIcon />}
          />
        )}
        {selectedVersion === 'enhanced' && (
          <Chip
            label="AI Enhanced"
            size="small"
            color="secondary"
            variant="outlined"
            icon={<EnhancedIcon />}
          />
        )}
      </Box>

      {/* Version Info Alert */}
      {selectedVersion === 'original' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Adapted Format:</strong> Original prompt adapted for optimal performance with the selected LLM.
          </Typography>
        </Alert>
      )}

      {selectedVersion === 'original-no-adapt' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>No Adaptation:</strong> Raw original prompt without any format adaptation. May not perform optimally with different LLMs.
          </Typography>
        </Alert>
      )}

      {selectedVersion === 'enhanced' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Enhanced Format:</strong> AI-structured version with system instructions, variables, and optimized formatting.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default VersionSelector;