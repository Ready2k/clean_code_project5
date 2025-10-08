import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Box,
  IconButton,
  Rating,
  Button,
  Collapse,
  Divider,
  Grid,
  Tooltip,
  Badge,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  PlayArrow as RenderIcon,
  AutoFixHigh as EnhanceIcon,
  Share as ShareIcon,
  GetApp as ExportIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Speed as QuickRenderIcon,
  Star as StarIcon,
  SmartToy as AIIcon,
} from '@mui/icons-material';
import { PromptRecord } from '../../types/prompts';
import { formatDistanceToNow } from 'date-fns';
import ModelBadge from './ModelBadge';

interface VariantInfo {
  id: string;
  title: string;
  provider: string;
  model: string;
  rating: number;
  ratingCount: number;
  isEnhanced?: boolean;
}

interface EnhancedPromptCardProps {
  prompt: PromptRecord;
  variants?: PromptRecord[];
  onView?: (prompt: PromptRecord) => void;
  onEdit?: (prompt: PromptRecord) => void;
  onDelete?: (prompt: PromptRecord) => void;
  onRender?: (prompt: PromptRecord) => void;
  onQuickRender?: (prompt: PromptRecord, variant?: PromptRecord) => void;
  onEnhance?: (prompt: PromptRecord) => void;
  onShare?: (prompt: PromptRecord) => void;
  onExport?: (prompt: PromptRecord) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
}

export const EnhancedPromptCard: React.FC<EnhancedPromptCardProps> = ({
  prompt,
  variants = [],
  onView,
  onEdit,
  onDelete,
  onRender,
  onQuickRender,
  onEnhance,
  onShare,
  onExport,
  selectionMode = false,
  selected = false,
  onSelectionChange,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showVariants, setShowVariants] = useState(false);
  const [quickRenderAnchor, setQuickRenderAnchor] = useState<null | HTMLElement>(null);
  
  const open = Boolean(anchorEl);
  const quickRenderOpen = Boolean(quickRenderAnchor);

  // Process variants to extract useful information
  const variantInfo: VariantInfo[] = variants.map(variant => {
    const providerTag = variant.metadata.tags?.find(tag => 
      tag.includes('openai-') || tag.includes('anthropic-') || tag.includes('meta-')
    );
    const isEnhanced = variant.metadata.tags?.includes('enhanced') || 
                      variant.metadata.title?.includes('Enhanced');
    
    return {
      id: variant.id,
      title: variant.metadata.title,
      provider: (variant.metadata as any)?.tuned_for_provider || 'unknown',
      model: (variant.metadata as any)?.preferred_model || 'unknown',
      rating: variant.averageRating || 0,
      ratingCount: variant.ratings?.length || 0,
      isEnhanced,
    };
  });

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleQuickRenderClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (variants.length === 0) {
      // No variants, render original directly
      onQuickRender?.(prompt);
    } else {
      // Show variant selector
      setQuickRenderAnchor(event.currentTarget);
    }
  };

  const handleQuickRenderClose = () => {
    setQuickRenderAnchor(null);
  };

  const handleQuickRenderVariant = (variant?: PromptRecord) => {
    handleQuickRenderClose();
    onQuickRender?.(prompt, variant);
  };

  const handleCardClick = () => {
    if (selectionMode) {
      onSelectionChange?.(!selected);
    } else {
      onView?.(prompt);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'draft':
        return 'warning';
      case 'archived':
        return 'default';
      case 'deprecated':
        return 'error';
      default:
        return 'default';
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
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

  const originalProvider = (prompt.metadata as any)?.tuned_for_provider;
  const originalModel = (prompt.metadata as any)?.preferred_model;

  return (
    <Card
      sx={{
        height: 'fit-content',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        border: selected ? 2 : 1,
        borderColor: selected ? 'primary.main' : 'divider',
        backgroundColor: selected ? 'action.selected' : 'background.paper',
        '&:hover': {
          transform: selectionMode ? 'none' : 'translateY(-2px)',
          boxShadow: (theme) => theme.shadows[4],
        },
      }}
      onClick={handleCardClick}
    >
      <CardContent sx={{ pb: 1 }}>
        {/* Header with title, status, and actions */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Box flex={1}>
            <Typography
              variant="h6"
              component="h3"
              sx={{
                fontWeight: 600,
                lineHeight: 1.2,
                mb: 0.5,
              }}
            >
              {truncateText(prompt.metadata.title, 50)}
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Chip
                label={prompt.status}
                size="small"
                color={getStatusColor(prompt.status) as any}
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary">
                v{prompt.version}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                •
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatDistanceToNow(new Date(prompt.updatedAt), { addSuffix: true })}
              </Typography>
            </Box>
          </Box>
          {!selectionMode && (
            <IconButton
              size="small"
              onClick={handleMenuClick}
              sx={{ ml: 0.5 }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* Rating */}
        <Box display="flex" alignItems="center" gap={1} mb={2}>
          <Rating
            value={prompt.averageRating || 0}
            precision={0.1}
            size="small"
            readOnly
          />
          <Typography variant="body2" color="text.secondary">
            ({prompt.ratings?.length || 0} ratings)
          </Typography>
        </Box>

        {/* Summary */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ 
            mb: 2, 
            minHeight: '2.5em', 
            lineHeight: 1.25,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}
        >
          {truncateText(prompt.metadata.summary, 100)}
        </Typography>

        {/* Original Model Information */}
        {originalProvider && originalModel && (
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <Typography variant="body2" color="text.secondary">
              🎯 Originally tuned for:
            </Typography>
            <ModelBadge
              model={originalModel}
              provider={originalProvider}
              type="tuned"
              size="small"
            />
          </Box>
        )}

        {/* Variants Section */}
        {variants.length > 0 && (
          <Box>
            <Box 
              display="flex" 
              alignItems="center" 
              justifyContent="space-between"
              sx={{ 
                cursor: 'pointer',
                p: 1,
                borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover' }
              }}
              onClick={(e) => {
                e.stopPropagation();
                setShowVariants(!showVariants);
              }}
            >
              <Box display="flex" alignItems="center" gap={1}>
                <Badge badgeContent={variants.length} color="primary">
                  <AIIcon fontSize="small" />
                </Badge>
                <Typography variant="body2" fontWeight={500}>
                  {variants.length} variant{variants.length > 1 ? 's' : ''} available
                </Typography>
              </Box>
              {showVariants ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>

            <Collapse in={showVariants}>
              <Box sx={{ mt: 1, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                {variantInfo.map((variant, index) => (
                  <Box key={variant.id}>
                    <Box sx={{ py: 1 }}>
                      {/* First row: Model name and actions */}
                      <Box 
                        display="flex" 
                        alignItems="center" 
                        justifyContent="space-between"
                        sx={{ mb: 0.5 }}
                      >
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2" sx={{ flexShrink: 0 }}>
                            {getProviderIcon(variant.provider)}
                          </Typography>
                          <Typography 
                            variant="body2" 
                            fontWeight={500}
                            sx={{ flexShrink: 0 }}
                          >
                            {variant.model}
                          </Typography>
                          {variant.isEnhanced && (
                            <Chip 
                              label="Enhanced" 
                              size="small" 
                              color="secondary" 
                              variant="outlined"
                              sx={{ height: 16, fontSize: '0.6rem' }}
                            />
                          )}
                        </Box>
                        <Box display="flex" gap={0.5}>
                          <Tooltip title="Use this variant">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                const variantPrompt = variants.find(v => v.id === variant.id);
                                if (variantPrompt) onQuickRender?.(prompt, variantPrompt);
                              }}
                              sx={{ width: 24, height: 24 }}
                            >
                              <RenderIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View details">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                const variantPrompt = variants.find(v => v.id === variant.id);
                                if (variantPrompt) onView?.(variantPrompt);
                              }}
                              sx={{ width: 24, height: 24 }}
                            >
                              <ViewIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                      
                      {/* Second row: Rating */}
                      <Box display="flex" alignItems="center" gap={0.5}>
                        <Rating
                          value={variant.rating}
                          precision={0.1}
                          size="small"
                          readOnly
                          sx={{ fontSize: '0.7rem' }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                          ({variant.ratingCount})
                        </Typography>
                      </Box>
                    </Box>
                    {index < variantInfo.length - 1 && <Divider />}
                  </Box>
                ))}
              </Box>
            </Collapse>
          </Box>
        )}

        {/* Tags */}
        <Box display="flex" flexWrap="wrap" gap={0.5} mt={2}>
          {prompt.metadata.tags.slice(0, 3).map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem', height: 24 }}
            />
          ))}
          {prompt.metadata.tags.length > 3 && (
            <Chip
              label={`+${prompt.metadata.tags.length - 3}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem', height: 24 }}
            />
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, pt: 0, minHeight: 48 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
          <Typography 
            variant="caption" 
            color="text.secondary"
            sx={{ 
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '120px'
            }}
          >
            by {prompt.metadata.owner}
          </Typography>
          <Box display="flex" gap={0.5} sx={{ flexShrink: 0 }}>
            <Tooltip title="Quick Render">
              <IconButton
                size="small"
                color="primary"
                onClick={handleQuickRenderClick}
                sx={{ 
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' },
                  width: 32,
                  height: 32
                }}
              >
                <QuickRenderIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Enhance with AI">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onEnhance?.(prompt);
                }}
                sx={{ width: 32, height: 32 }}
              >
                <EnhanceIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onExport?.(prompt);
                }}
                sx={{ width: 32, height: 32 }}
              >
                <ExportIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardActions>

      {/* Quick Render Menu */}
      <Menu
        anchorEl={quickRenderAnchor}
        open={quickRenderOpen}
        onClose={handleQuickRenderClose}
        onClick={(e) => e.stopPropagation()}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => handleQuickRenderVariant()}>
          <ListItemIcon>
            <Typography variant="body2">🎯</Typography>
          </ListItemIcon>
          <ListItemText>
            Original ({originalModel || 'Default'})
          </ListItemText>
        </MenuItem>
        {variantInfo.map((variant) => (
          <MenuItem 
            key={variant.id}
            onClick={() => {
              const variantPrompt = variants.find(v => v.id === variant.id);
              handleQuickRenderVariant(variantPrompt);
            }}
          >
            <ListItemIcon>
              <Typography variant="body2">{getProviderIcon(variant.provider)}</Typography>
            </ListItemIcon>
            <ListItemText>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2">{variant.model}</Typography>
                {variant.isEnhanced && (
                  <Chip 
                    label="Enhanced" 
                    size="small" 
                    color="secondary" 
                    variant="outlined"
                    sx={{ height: 16, fontSize: '0.6rem' }}
                  />
                )}
                <Box display="flex" alignItems="center" gap={0.5}>
                  <StarIcon sx={{ fontSize: '0.8rem', color: 'gold' }} />
                  <Typography variant="caption">
                    {variant.rating.toFixed(1)}
                  </Typography>
                </Box>
              </Box>
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onView?.(prompt);
          }}
        >
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Details</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onEdit?.(prompt);
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onRender?.(prompt);
          }}
        >
          <ListItemIcon>
            <RenderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Advanced Render</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onEnhance?.(prompt);
          }}
        >
          <ListItemIcon>
            <EnhanceIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Enhance</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onShare?.(prompt);
          }}
        >
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onExport?.(prompt);
          }}
        >
          <ListItemIcon>
            <ExportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onDelete?.(prompt);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  );
};