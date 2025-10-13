import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Box,
  IconButton,
  Rating,
  Checkbox,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
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
} from '@mui/icons-material';
import { PromptRecord } from '../../types/prompts';
import { formatDistanceToNow } from 'date-fns';
import ModelBadge from './ModelBadge';

interface PromptCardProps {
  prompt: PromptRecord;
  onView?: (prompt: PromptRecord) => void;
  onEdit?: (prompt: PromptRecord) => void;
  onDelete?: (prompt: PromptRecord) => void;
  onRender?: (prompt: PromptRecord) => void;
  onEnhance?: (prompt: PromptRecord) => void;
  onShare?: (prompt: PromptRecord) => void;
  onExport?: (prompt: PromptRecord) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
}

export const PromptCard: React.FC<PromptCardProps> = ({
  prompt,
  onView,
  onEdit,
  onDelete,
  onRender,
  onEnhance,
  onShare,
  onExport,
  selectionMode = false,
  selected = false,
  onSelectionChange,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCardClick = () => {
    if (selectionMode) {
      onSelectionChange?.(!selected);
    } else {
      onView?.(prompt);
    }
  };

  const handleCheckboxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    onSelectionChange?.(event.target.checked);
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

  return (
    <Card
      sx={{
        height: '100%',
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
      <CardContent sx={{ flexGrow: 1, pb: 1 }}>
        {/* Header with title and status */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
          <Box display="flex" alignItems="flex-start" gap={1} flex={1}>
            {selectionMode && (
              <Checkbox
                checked={selected}
                onChange={handleCheckboxChange}
                size="small"
                sx={{ mt: -0.5 }}
              />
            )}
            <Typography
              variant="h6"
              component="h3"
              sx={{
                fontWeight: 600,
                lineHeight: 1.2,
                flex: 1,
                mr: 1,
              }}
            >
              {truncateText(prompt.metadata.title, 50)}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            <Chip
              label={prompt.status}
              size="small"
              color={getStatusColor(prompt.status) as any}
              variant="outlined"
            />
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
        </Box>

        {/* Summary */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, minHeight: '2.5em', lineHeight: 1.25 }}
        >
          {truncateText(prompt.metadata.summary, 120)}
        </Typography>

        {/* Model Information */}
        <Box display="flex" flexWrap="wrap" gap={0.5} mb={1}>
          {(prompt.metadata as any)?.preferred_model && (
            <ModelBadge
              model={(prompt.metadata as any).preferred_model}
              provider={(prompt.metadata as any)?.tuned_for_provider}
              type="tuned"
              size="small"
            />
          )}
          {prompt.history?.some(h => (h as any)?.enhancement_model) && (
            <ModelBadge
              model={prompt.history.find(h => (h as any)?.enhancement_model)?.enhancement_model as any}
              provider={prompt.history.find(h => (h as any)?.enhancement_provider)?.enhancement_provider as any}
              type="enhanced"
              size="small"
            />
          )}
        </Box>

        {/* Tags */}
        <Box display="flex" flexWrap="wrap" gap={0.5} mb={2}>
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

        {/* Rating and metadata */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
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
          <Typography variant="caption" color="text.secondary">
            v{prompt.version}
          </Typography>
        </Box>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
          <Typography variant="caption" color="text.secondary">
            {formatDistanceToNow(new Date(prompt.metadata.updated_at), { addSuffix: true })}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            by {prompt.metadata.owner}
          </Typography>
        </Box>
      </CardActions>

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
          <ListItemText>Render</ListItemText>
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