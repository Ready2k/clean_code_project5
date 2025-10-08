import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
} from '@mui/material';
import {
  Close as CloseIcon,
} from '@mui/icons-material';
import { PromptRecord } from '../../types/prompts';
import MultiProviderRenderer from './MultiProviderRenderer';

interface MultiProviderRendererDialogProps {
  open: boolean;
  prompt: PromptRecord | null;
  onClose: () => void;
}

const MultiProviderRendererDialog: React.FC<MultiProviderRendererDialogProps> = ({
  open,
  prompt,
  onClose,
}) => {
  if (!prompt) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { height: '95vh', maxHeight: '95vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Multi-Provider Rendering - {prompt.metadata.title}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        <MultiProviderRenderer prompt={prompt} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
};

export default MultiProviderRendererDialog;