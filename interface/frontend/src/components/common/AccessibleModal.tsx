import React, { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Box,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useFocusManagement } from '../../hooks/useFocusManagement';

interface AccessibleModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  disableEscapeKeyDown?: boolean;
  ariaDescribedBy?: string;
}

export const AccessibleModal: React.FC<AccessibleModalProps> = ({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
  disableEscapeKeyDown = false,
  ariaDescribedBy,
}) => {
  const { containerRef } = useFocusManagement(open, {
    trapFocus: true,
    restoreFocus: true,
    autoFocus: true,
  });

  // Announce modal opening to screen readers
  useEffect(() => {
    if (open) {
      const announcement = `Dialog opened: ${title}`;
      const ariaLiveRegion = document.createElement('div');
      ariaLiveRegion.setAttribute('aria-live', 'polite');
      ariaLiveRegion.setAttribute('aria-atomic', 'true');
      ariaLiveRegion.style.position = 'absolute';
      ariaLiveRegion.style.left = '-10000px';
      ariaLiveRegion.style.width = '1px';
      ariaLiveRegion.style.height = '1px';
      ariaLiveRegion.style.overflow = 'hidden';
      ariaLiveRegion.textContent = announcement;
      
      document.body.appendChild(ariaLiveRegion);
      
      setTimeout(() => {
        document.body.removeChild(ariaLiveRegion);
      }, 1000);
    }
  }, [open, title]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
      disableEscapeKeyDown={disableEscapeKeyDown}
      aria-labelledby="modal-title"
      aria-describedby={ariaDescribedBy}
      PaperProps={{
        ref: containerRef,
        role: 'dialog',
        'aria-modal': true,
      }}
    >
      <DialogTitle
        id="modal-title"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pr: 1,
        }}
      >
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        <IconButton
          aria-label="Close dialog"
          onClick={onClose}
          size="small"
          sx={{
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          '&:focus': {
            outline: 'none',
          },
        }}
      >
        <Box
          id={ariaDescribedBy}
          sx={{
            '& > *:first-of-type': {
              mt: 0,
            },
          }}
        >
          {children}
        </Box>
      </DialogContent>

      {actions && (
        <DialogActions
          sx={{
            px: 3,
            py: 2,
          }}
        >
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default AccessibleModal;