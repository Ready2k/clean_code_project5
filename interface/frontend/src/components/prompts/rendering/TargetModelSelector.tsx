import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Psychology as AnthropicIcon,
  SmartToy as OpenAIIcon,
  Memory as MetaIcon,
  Microsoft as MicrosoftIcon,
  Cloud as CloudIcon,
} from '@mui/icons-material';
import ModelBadge from '../ModelBadge';
import { providersAPI } from '../../../services/api/providersAPI';

interface TargetModelSelectorProps {
  originalProvider?: string;
  originalModel?: string;
  selectedProvider: string;
  selectedModel: string;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  existingVariants?: string[];
}

const TargetModelSelector: React.FC<TargetModelSelectorProps> = ({
  originalProvider,
  originalModel,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  existingVariants = [],
}) => {
  const [providers, setProviders] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch providers on component mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoading(true);
        const response = await providersAPI.getProviders({ status: ['active'] });
        
        // Deduplicate providers - prefer "-basic" versions over system providers
        const deduplicatedProviders = [];
        const providersByName = new Map();
        
        // Group providers by name
        response.providers.forEach(provider => {
          if (!providersByName.has(provider.name)) {
            providersByName.set(provider.name, []);
          }
          providersByName.get(provider.name).push(provider);
        });
        
        // Select the best provider for each name (prefer -basic versions)
        providersByName.forEach(providerList => {
          if (providerList.length === 1) {
            deduplicatedProviders.push(providerList[0]);
          } else {
            // Prefer -basic version, fallback to first non-system provider
            const basicProvider = providerList.find(p => p.identifier.includes('-basic'));
            const nonSystemProvider = providerList.find(p => !p.isSystem);
            const selectedProvider = basicProvider || nonSystemProvider || providerList[0];
            deduplicatedProviders.push(selectedProvider);
          }
        });
        
        const providersWithModels = await Promise.all(
          deduplicatedProviders.map(async (provider) => {
            try {
              const modelsResponse = await providersAPI.getModels({ 
                providerId: provider.id,
                status: ['active']
              });
              // Create mapping for backend compatibility
              const backendIdentifier = provider.identifier.replace('-basic', '');
              
              return {
                id: provider.identifier, // Frontend identifier (deduplicated)
                backendId: backendIdentifier, // Backend identifier (for API calls)
                name: provider.name,
                icon: getProviderIcon(provider.name),
                models: modelsResponse.models.map(model => ({
                  id: model.identifier,
                  name: model.name
                }))
              };
            } catch (error) {
              console.warn(`Failed to fetch models for provider ${provider.name}:`, error);
              // Create mapping for backend compatibility
              const backendIdentifier = provider.identifier.replace('-basic', '');
              
              return {
                id: provider.identifier, // Frontend identifier (deduplicated)
                backendId: backendIdentifier, // Backend identifier (for API calls)
                name: provider.name,
                icon: getProviderIcon(provider.name),
                models: []
              };
            }
          })
        );
        setProviders(providersWithModels);
        setError(null);
      } catch (error) {
        console.error('Failed to fetch providers:', error);
        setError('Failed to load providers');
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, []);

  // Helper function to get provider icon
  const getProviderIcon = (providerName: string) => {
    const name = providerName.toLowerCase();
    if (name.includes('anthropic') || name.includes('claude')) {
      return <AnthropicIcon fontSize="small" />;
    } else if (name.includes('openai') || name.includes('gpt')) {
      return <OpenAIIcon fontSize="small" />;
    } else if (name.includes('meta') || name.includes('llama')) {
      return <MetaIcon fontSize="small" />;
    } else if (name.includes('microsoft') || name.includes('copilot')) {
      return <MicrosoftIcon fontSize="small" />;
    } else {
      return <CloudIcon fontSize="small" />;
    }
  };

  const selectedProviderData = providers.find(p => p.id === selectedProvider);
  const availableModels = selectedProviderData?.models || [];
  
  const isOriginalTarget = originalProvider === selectedProvider && 
    (originalModel === selectedModel || (!originalModel && selectedProvider === originalProvider));
  
  const variantTag = `${selectedProvider}-${selectedModel}`;
  const hasExistingVariant = existingVariants.includes(variantTag);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Target Model Selection
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose which model you want this prompt optimized for
      </Typography>

      {originalProvider && originalModel && (
        <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Original prompt tuned for:
          </Typography>
          <ModelBadge
            model={originalModel}
            provider={originalProvider}
            type="tuned"
            size="small"
          />
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Provider</InputLabel>
          <Select
            value={selectedProvider}
            onChange={(e) => {
              onProviderChange(e.target.value);
              // Reset model when provider changes
              const newProvider = providers.find(p => p.id === e.target.value);
              if (newProvider && newProvider.models.length > 0) {
                onModelChange(newProvider.models[0].id);
              }
            }}
            label="Provider"
          >
            {providers.map((provider) => (
              <MenuItem key={provider.id} value={provider.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {provider.icon}
                  {provider.name}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Model</InputLabel>
          <Select
            value={selectedModel}
            onChange={(e) => onModelChange(e.target.value)}
            label="Model"
            disabled={!selectedProvider}
          >
            {availableModels.map((model) => (
              <MenuItem key={model.id} value={model.id}>
                {model.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Status Indicators */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {isOriginalTarget && (
          <Chip
            label="Original Format"
            size="small"
            color="success"
            variant="outlined"
          />
        )}
        {hasExistingVariant && !isOriginalTarget && (
          <Chip
            label="Variant Available"
            size="small"
            color="info"
            variant="outlined"
          />
        )}
        {!hasExistingVariant && !isOriginalTarget && (
          <Chip
            label="Will Adapt"
            size="small"
            color="warning"
            variant="outlined"
          />
        )}
      </Box>

      {/* Adaptation Alert */}
      {!isOriginalTarget && (
        <Alert 
          severity={hasExistingVariant ? "info" : "warning"} 
          sx={{ mb: 2 }}
        >
          {hasExistingVariant ? (
            <Typography variant="body2">
              <strong>Existing Variant:</strong> A {selectedProvider} {selectedModel} optimized version already exists and will be shown.
            </Typography>
          ) : (
            <Typography variant="body2">
              <strong>Adaptation Required:</strong> This prompt will be converted from {originalProvider || 'original'} format to work optimally with {selectedProvider} {selectedModel}.
            </Typography>
          )}
        </Alert>
      )}
    </Box>
  );
};

export default TargetModelSelector;