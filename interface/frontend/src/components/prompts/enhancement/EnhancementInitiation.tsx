import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Button,
  Alert,
  CircularProgress,
  Paper,
  Divider,
} from '@mui/material';
import {
  AutoFixHigh as EnhanceIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import { startEnhancement } from '../../../store/slices/enhancementSlice';
import { PromptRecord } from '../../../types/prompts';
import { EnhancementStartRequest } from '../../../types/enhancement';

interface EnhancementInitiationProps {
  prompt: PromptRecord | null;
  onEnhancementStarted: (jobId: string, promptId: string) => void;
}

export const EnhancementInitiation: React.FC<EnhancementInitiationProps> = ({
  prompt,
  onEnhancementStarted,
}) => {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.enhancement);
  
  const [targetProvider, setTargetProvider] = React.useState<string>('');
  const [preserveStyle, setPreserveStyle] = React.useState(false);

  const availableProviders = [
    { value: 'openai', label: 'OpenAI (GPT-4, GPT-3.5)' },
    { value: 'anthropic', label: 'Anthropic (Claude)' },
    { value: 'meta', label: 'Meta (Llama)' },
  ];

  const handleStartEnhancement = async () => {
    if (!prompt) return;

    const options: EnhancementStartRequest = {
      preserve_style: preserveStyle,
    };

    if (targetProvider) {
      options.target_provider = targetProvider;
    }

    try {
      const result = await dispatch(startEnhancement({
        promptId: prompt.id,
        options,
      })).unwrap();

      onEnhancementStarted(result.jobId, prompt.id);
    } catch (error) {
      console.error('Failed to start enhancement:', error);
    }
  };

  if (!prompt) return null;

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Alert severity="info">
        AI enhancement will analyze your prompt and suggest improvements to make it more effective, 
        clear, and structured. The process may generate questions to gather additional context.
      </Alert>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Current Prompt Overview
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>Goal:</strong> {prompt.humanPrompt.goal}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>Audience:</strong> {prompt.humanPrompt.audience}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Steps:</strong> {prompt.humanPrompt.steps.length} defined
        </Typography>
      </Paper>

      <Divider />

      <Typography variant="h6" gutterBottom>
        Enhancement Options
      </Typography>

      <FormControl fullWidth>
        <InputLabel>Target Provider (Optional)</InputLabel>
        <Select
          value={targetProvider}
          onChange={(e) => setTargetProvider(e.target.value)}
          label="Target Provider (Optional)"
        >
          <MenuItem value="">
            <em>Auto-detect best provider</em>
          </MenuItem>
          {availableProviders.map((provider) => (
            <MenuItem key={provider.value} value={provider.value}>
              {provider.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControlLabel
        control={
          <Switch
            checked={preserveStyle}
            onChange={(e) => setPreserveStyle(e.target.checked)}
          />
        }
        label="Preserve original writing style"
      />

      <Box>
        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>What to expect:</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" component="ul" sx={{ pl: 2 }}>
          <li>Analysis of prompt structure and clarity</li>
          <li>Suggestions for improved goal definition</li>
          <li>Enhanced step-by-step instructions</li>
          <li>Better output expectations</li>
          <li>Optimized variable definitions</li>
          <li>Provider-specific formatting (if selected)</li>
        </Typography>
      </Box>

      {error && (
        <Alert severity="error">
          {error}
        </Alert>
      )}

      <Box display="flex" justifyContent="flex-end" gap={2}>
        <Button
          variant="contained"
          onClick={handleStartEnhancement}
          disabled={isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : <EnhanceIcon />}
          size="large"
        >
          {isLoading ? 'Starting Enhancement...' : 'Start AI Enhancement'}
        </Button>
      </Box>
    </Box>
  );
};