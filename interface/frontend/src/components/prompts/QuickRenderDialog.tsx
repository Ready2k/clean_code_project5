import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Chip,
  Rating,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  PlayArrow as RenderIcon,
  Settings as AdvancedIcon,
  Star as StarIcon,
  AutoFixHigh as EnhanceIcon,
} from '@mui/icons-material';
import { PromptRecord } from '../../types/prompts';
import ModelBadge from './ModelBadge';

interface QuickRenderDialogProps {
  open: boolean;
  prompt: PromptRecord | null;
  variants?: PromptRecord[];
  selectedVariant?: PromptRecord;
  onClose: () => void;
  onRender: (prompt: PromptRecord, variant?: PromptRecord, variables?: Record<string, any>) => void;
  onAdvancedRender?: (prompt: PromptRecord) => void;
  isLoading?: boolean;
}

export const QuickRenderDialog: React.FC<QuickRenderDialogProps> = ({
  open,
  prompt,
  variants = [],
  selectedVariant,
  onClose,
  onRender,
  onAdvancedRender,
  isLoading = false,
}) => {
  const [selectedOption, setSelectedOption] = useState<string>('original');
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [lastUsedVariables, setLastUsedVariables] = useState<Record<string, any>>({});

  // Reset state when dialog opens/closes or prompt changes
  useEffect(() => {
    if (open && prompt) {
      // Initialize variables with defaults
      const defaultVariables: Record<string, any> = {};
      (prompt.variables || []).forEach((variable) => {
        if (variable.defaultValue !== undefined) {
          defaultVariables[variable.name] = variable.defaultValue;
        }
      });
      
      // Load last used variables from localStorage
      const storageKey = `quickRender_${prompt.id}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsedStored = JSON.parse(stored);
          setLastUsedVariables(parsedStored);
          setVariables({ ...defaultVariables, ...parsedStored });
        } catch {
          setVariables(defaultVariables);
        }
      } else {
        setVariables(defaultVariables);
      }

      // Set initial selection
      if (selectedVariant) {
        setSelectedOption(selectedVariant.id);
      } else {
        setSelectedOption('original');
      }
    }
  }, [open, prompt, selectedVariant]);

  const handleVariableChange = (name: string, value: any) => {
    setVariables(prev => ({ ...prev, [name]: value }));
  };

  const handleRender = () => {
    if (!prompt) return;

    // Save variables to localStorage for next time
    const storageKey = `quickRender_${prompt.id}`;
    localStorage.setItem(storageKey, JSON.stringify(variables));

    // Find selected variant
    const variant = selectedOption === 'original' ? undefined : 
                   variants.find(v => v.id === selectedOption);

    onRender(prompt, variant, variables);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return '🤖';
      case 'anthropic':
        return '🧠';
      case 'meta':
        return '🦙';
      default:
        return '🤖';
    }
  };

  const getVariantInfo = (variant: PromptRecord) => {
    const provider = (variant.metadata as any)?.tuned_for_provider || 'unknown';
    const model = (variant.metadata as any)?.preferred_model || 'unknown';
    const isEnhanced = variant.metadata.tags?.includes('enhanced') || 
                      variant.metadata.title?.includes('Enhanced');
    
    return { provider, model, isEnhanced };
  };

  const originalProvider = (prompt?.metadata as any)?.tuned_for_provider;
  const originalModel = (prompt?.metadata as any)?.preferred_model;

  // Check if all required variables are filled
  const requiredVariables = prompt?.variables?.filter(v => v.required) || [];
  const missingRequired = requiredVariables.filter(v => 
    !variables[v.name] || variables[v.name] === ''
  );
  const canRender = missingRequired.length === 0;

  if (!prompt) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">
              Quick Render: {prompt.metadata.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select an LLM variant and render instantly
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" gap={3}>
          {/* LLM Selection */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Select LLM Version
            </Typography>
            <RadioGroup
              value={selectedOption}
              onChange={(e) => setSelectedOption(e.target.value)}
            >
              {/* Original Option */}
              <FormControlLabel
                value="original"
                control={<Radio />}
                label={
                  <Box display="flex" alignItems="center" gap={2} py={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2">🎯</Typography>
                      <Typography variant="body1" fontWeight={500}>
                        Original
                      </Typography>
                      {originalProvider && originalModel && (
                        <ModelBadge
                          model={originalModel}
                          provider={originalProvider}
                          type="tuned"
                          size="small"
                        />
                      )}
                    </Box>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Rating
                        value={prompt.averageRating || 0}
                        precision={0.1}
                        size="small"
                        readOnly
                      />
                      <Typography variant="caption" color="text.secondary">
                        ({prompt.ratings?.length || 0})
                      </Typography>
                    </Box>
                  </Box>
                }
                sx={{ 
                  border: 1, 
                  borderColor: 'divider', 
                  borderRadius: 1, 
                  m: 0, 
                  mb: 1,
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              />

              {/* Variant Options */}
              {variants.map((variant) => {
                const { provider, model, isEnhanced } = getVariantInfo(variant);
                return (
                  <FormControlLabel
                    key={variant.id}
                    value={variant.id}
                    control={<Radio />}
                    label={
                      <Box display="flex" alignItems="center" gap={2} py={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2">
                            {getProviderIcon(provider)}
                          </Typography>
                          <Typography variant="body1" fontWeight={500}>
                            {model}
                          </Typography>
                          {isEnhanced && (
                            <Chip 
                              label="Enhanced" 
                              size="small" 
                              color="secondary" 
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Rating
                            value={variant.averageRating || 0}
                            precision={0.1}
                            size="small"
                            readOnly
                          />
                          <Typography variant="caption" color="text.secondary">
                            ({variant.ratings?.length || 0})
                          </Typography>
                        </Box>
                      </Box>
                    }
                    sx={{ 
                      border: 1, 
                      borderColor: 'divider', 
                      borderRadius: 1, 
                      m: 0, 
                      mb: 1,
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  />
                );
              })}
            </RadioGroup>
          </Box>

          {/* Variables Section */}
          {prompt.variables && prompt.variables.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="h6" gutterBottom>
                  Variables
                  {Object.keys(lastUsedVariables).length > 0 && (
                    <Chip 
                      label="Auto-filled from last use" 
                      size="small" 
                      color="info" 
                      variant="outlined"
                      sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                    />
                  )}
                </Typography>
                <Box display="flex" flexDirection="column" gap={2}>
                  {prompt.variables.map((variable) => (
                    <Box key={variable.name}>
                      <TextField
                        fullWidth
                        label={variable.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        value={variables[variable.name] || ''}
                        onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                        required={variable.required}
                        helperText={variable.description}
                        placeholder={variable.defaultValue?.toString() || ''}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            </>
          )}

          {/* Validation Messages */}
          {!canRender && (
            <Alert severity="warning">
              Please fill in all required variables: {missingRequired.map(v => v.name).join(', ')}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 1 }}>
        <Button onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button
          variant="outlined"
          startIcon={<AdvancedIcon />}
          onClick={() => {
            onClose();
            onAdvancedRender?.(prompt);
          }}
          disabled={isLoading}
        >
          Advanced Options
        </Button>
        <Button
          variant="contained"
          startIcon={isLoading ? <CircularProgress size={16} /> : <RenderIcon />}
          onClick={handleRender}
          disabled={!canRender || isLoading}
        >
          {isLoading ? 'Rendering...' : 'Render Now'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};