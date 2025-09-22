import React, { useEffect } from 'react';
import {
  Snackbar,
  Alert,
  AlertTitle,
  Button,
  Box,
  IconButton,
  Typography,
  Slide,
  SlideProps
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { removeNotification } from '../../store/slices/uiSlice';

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="left" />;
}

interface NotificationItemProps {
  notification: {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: string;
    autoHide?: boolean;
    duration?: number;
    actions?: Array<{
      label: string;
      action: () => void;
    }>;
  };
  onClose: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onClose }) => {

  useEffect(() => {
    if (notification.autoHide) {
      const timer = setTimeout(() => {
        onClose(notification.id);
      }, notification.duration || 5000);

      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  const handleClose = () => {
    onClose(notification.id);
  };

  const handleActionClick = (action: () => void) => {
    action();
    handleClose();
  };

  return (
    <Snackbar
      open={true}
      TransitionComponent={SlideTransition}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      sx={{ 
        position: 'relative',
        '& .MuiSnackbar-root': {
          position: 'relative',
          transform: 'none',
          left: 'auto',
          right: 'auto',
          top: 'auto',
          bottom: 'auto'
        }
      }}
    >
      <Alert
        severity={notification.type}
        variant="filled"
        sx={{ 
          minWidth: 300,
          maxWidth: 500,
          '& .MuiAlert-message': {
            width: '100%'
          }
        }}
        action={
          <IconButton
            size="small"
            aria-label="close"
            color="inherit"
            onClick={handleClose}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        <AlertTitle>{notification.title}</AlertTitle>
        <Typography variant="body2" sx={{ mb: notification.actions ? 1 : 0 }}>
          {notification.message}
        </Typography>
        
        {notification.actions && notification.actions.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            {notification.actions.map((action, index) => (
              <Button
                key={index}
                size="small"
                variant="outlined"
                color="inherit"
                onClick={() => handleActionClick(action.action)}
                sx={{
                  borderColor: 'currentColor',
                  color: 'inherit',
                  '&:hover': {
                    borderColor: 'currentColor',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                {action.label}
              </Button>
            ))}
          </Box>
        )}
        
        <Typography 
          variant="caption" 
          sx={{ 
            display: 'block', 
            mt: 0.5, 
            opacity: 0.8,
            fontSize: '0.7rem'
          }}
        >
          {new Date(notification.timestamp).toLocaleTimeString()}
        </Typography>
      </Alert>
    </Snackbar>
  );
};

export const NotificationCenter: React.FC = () => {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector((state) => state.ui.notifications);

  const handleClose = (id: string) => {
    dispatch(removeNotification(id));
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
          width: 4,
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(0,0,0,0.2)',
          borderRadius: 2,
        },
      }}
    >
      {notifications.slice(-5).map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onClose={handleClose}
        />
      ))}
    </Box>
  );
};

export default NotificationCenter;