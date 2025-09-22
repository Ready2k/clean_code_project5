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
import { removeNotification, clearRateLimitNotifications } from '../../store/slices/uiSlice';

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
          minWidth: 350,
          maxWidth: 500,
          minHeight: 100,
          py: 2,
          px: 2,
          '& .MuiAlert-message': {
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            paddingTop: 0,
            paddingBottom: 0
          },
          '& .MuiAlert-action': {
            alignItems: 'flex-start',
            paddingTop: 1,
            paddingLeft: 1
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
        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: 60 }}>
          <AlertTitle sx={{ mb: 1, lineHeight: 1.2 }}>{notification.title}</AlertTitle>
          <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.3 }}>
            {notification.message}
          </Typography>
          
          {notification.actions && notification.actions.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
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
              mt: 'auto',
              opacity: 0.9,
              fontSize: '0.8rem',
              alignSelf: 'flex-end',
              lineHeight: 1.2,
              pb: 0.5
            }}
          >
            {new Date(notification.timestamp).toLocaleTimeString()}
          </Typography>
        </Box>
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

  const handleClearRateLimits = () => {
    dispatch(clearRateLimitNotifications());
  };

  const rateLimitNotifications = notifications.filter(n => 
    n.title === 'Rate Limited' || n.message.includes('Rate Limited') || n.message.includes('Too many requests')
  );

  // Auto-clear old rate limit notifications (older than 30 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const oldRateLimits = notifications.filter(n => 
        (n.title === 'Rate Limited' || n.message.includes('Rate Limited')) &&
        now - new Date(n.timestamp).getTime() > 30000
      );
      
      if (oldRateLimits.length > 0) {
        dispatch(clearRateLimitNotifications());
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(timer);
  }, [notifications, dispatch]);

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
      {rateLimitNotifications.length > 1 && (
        <Button
          variant="contained"
          color="error"
          size="small"
          onClick={handleClearRateLimits}
          sx={{ mb: 1, alignSelf: 'flex-end' }}
        >
          Clear All Rate Limits ({rateLimitNotifications.length})
        </Button>
      )}
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