import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import {
  Psychology as AnthropicIcon,
  SmartToy as OpenAIIcon,
  Memory as MetaIcon,
  Computer as GenericIcon
} from '@mui/icons-material';

interface ModelBadgeProps {
  model?: string;
  provider?: string;
  type: 'tuned' | 'enhanced' | 'imported';
  size?: 'small' | 'medium';
}

const ModelBadge: React.FC<ModelBadgeProps> = ({ 
  model, 
  provider, 
  type, 
  size = 'small' 
}) => {
  if (!model && !provider) return null;

  const getProviderIcon = () => {
    switch (provider?.toLowerCase()) {
      case 'anthropic':
        return <AnthropicIcon fontSize="small" />;
      case 'openai':
        return <OpenAIIcon fontSize="small" />;
      case 'meta':
        return <MetaIcon fontSize="small" />;
      default:
        return <GenericIcon fontSize="small" />;
    }
  };

  const getProviderColor = () => {
    switch (provider?.toLowerCase()) {
      case 'anthropic':
        return '#D97706'; // Orange
      case 'openai':
        return '#10B981'; // Green
      case 'meta':
        return '#3B82F6'; // Blue
      default:
        return '#6B7280'; // Gray
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'tuned':
        return 'Tuned for';
      case 'enhanced':
        return 'Enhanced with';
      case 'imported':
        return 'Imported from';
      default:
        return '';
    }
  };

  const displayText = model || provider || 'Unknown';
  const tooltipText = `${getTypeLabel()} ${displayText}${provider && model !== provider ? ` (${provider})` : ''}`;

  return (
    <Tooltip title={tooltipText} arrow>
      <Chip
        icon={getProviderIcon()}
        label={displayText}
        size={size}
        variant="outlined"
        sx={{
          borderColor: getProviderColor(),
          color: getProviderColor(),
          '& .MuiChip-icon': {
            color: getProviderColor()
          },
          fontSize: size === 'small' ? '0.75rem' : '0.875rem'
        }}
      />
    </Tooltip>
  );
};

export default ModelBadge;