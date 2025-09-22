
import {
  Alert,
  Box,
  Typography,
  Button,
  Slide,
  Snackbar
} from '@mui/material';
import {
  WifiOffOutlined,
  RefreshOutlined,
  SignalWifiOffOutlined
} from '@mui/icons-material';
import { useOfflineContext } from '../../contexts/OfflineContext';

interface OfflineIndicatorProps {
  variant?: 'banner' | 'snackbar' | 'inline';
  showRetry?: boolean;
  onRetry?: () => void;
}

export function OfflineIndicator({ 
  variant = 'banner', 
  showRetry = true,
  onRetry 
}: OfflineIndicatorProps) {
  const { isOffline, lastOnlineAt, checkConnectivity } = useOfflineContext();

  const handleRetry = async () => {
    const isOnline = await checkConnectivity();
    if (isOnline && onRetry) {
      onRetry();
    }
  };

  const getOfflineMessage = () => {
    if (lastOnlineAt) {
      const timeSince = new Date().getTime() - lastOnlineAt.getTime();
      const minutes = Math.floor(timeSince / 60000);
      
      if (minutes < 1) {
        return 'Connection lost just now';
      } else if (minutes < 60) {
        return `Offline for ${minutes} minute${minutes > 1 ? 's' : ''}`;
      } else {
        const hours = Math.floor(minutes / 60);
        return `Offline for ${hours} hour${hours > 1 ? 's' : ''}`;
      }
    }
    
    return 'You appear to be offline';
  };

  if (!isOffline) {
    return null;
  }

  const content = (
    <Alert 
      severity="warning" 
      icon={<WifiOffOutlined />}
      action={
        showRetry ? (
          <Button
            color="inherit"
            size="small"
            startIcon={<RefreshOutlined />}
            onClick={handleRetry}
          >
            Retry
          </Button>
        ) : undefined
      }
    >
      <Typography variant="body2" component="div">
        <strong>Offline Mode</strong>
      </Typography>
      <Typography variant="caption" component="div">
        {getOfflineMessage()}. Some features may be limited.
      </Typography>
    </Alert>
  );

  switch (variant) {
    case 'snackbar':
      return (
        <Snackbar
          open={isOffline}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          {content}
        </Snackbar>
      );

    case 'inline':
      return (
        <Box sx={{ mb: 2 }}>
          {content}
        </Box>
      );

    case 'banner':
    default:
      return (
        <Slide direction="down" in={isOffline} mountOnEnter unmountOnExit>
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              '& .MuiAlert-root': {
                borderRadius: 0,
                mb: 0
              }
            }}
          >
            {content}
          </Box>
        </Slide>
      );
  }
}

interface OfflineStatusProps {
  compact?: boolean;
}

export function OfflineStatus({ compact = false }: OfflineStatusProps) {
  const { isOffline } = useOfflineContext();

  if (compact) {
    return (
      <Box
        display="flex"
        alignItems="center"
        gap={0.5}
        color={isOffline ? 'error.main' : 'success.main'}
      >
        {isOffline ? <SignalWifiOffOutlined fontSize="small" /> : null}
        <Typography variant="caption">
          {isOffline ? 'Offline' : 'Online'}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      alignItems="center"
      gap={1}
      p={1}
      borderRadius={1}
      bgcolor={isOffline ? 'error.light' : 'success.light'}
      color={isOffline ? 'error.contrastText' : 'success.contrastText'}
    >
      {isOffline ? <WifiOffOutlined /> : null}
      <Box>
        <Typography variant="body2" fontWeight="medium">
          {isOffline ? 'Offline' : 'Online'}
        </Typography>
        <Typography variant="caption">
          {isOffline 
            ? 'Limited functionality available' 
            : 'All features available'
          }
        </Typography>
      </Box>
    </Box>
  );
}

export default OfflineIndicator;