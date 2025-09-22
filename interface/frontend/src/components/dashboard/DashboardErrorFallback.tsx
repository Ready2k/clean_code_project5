import React from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  Alert,
  Container 
} from '@mui/material';
import { Refresh as RefreshIcon, Home as HomeIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface DashboardErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

export const DashboardErrorFallback: React.FC<DashboardErrorFallbackProps> = ({ 
  error, 
  resetError 
}) => {
  const navigate = useNavigate();

  const handleRefresh = () => {
    if (resetError) {
      resetError();
    } else {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom color="error">
            Dashboard Error
          </Typography>
          
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Something went wrong while loading the dashboard. This might be due to:
          </Typography>
          
          <Box sx={{ mb: 3 }}>
            <Alert severity="info" sx={{ textAlign: 'left', mb: 2 }}>
              <Typography variant="body2">
                • Backend services are still starting up
              </Typography>
              <Typography variant="body2">
                • Network connectivity issues
              </Typography>
              <Typography variant="body2">
                • Missing or invalid authentication
              </Typography>
            </Alert>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
              <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {error.message}
              </Typography>
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
            >
              Try Again
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<HomeIcon />}
              onClick={handleGoHome}
            >
              Go Home
            </Button>
          </Box>
          
          <Typography variant="caption" color="text.secondary" sx={{ mt: 3, display: 'block' }}>
            If this problem persists, please check the browser console for more details.
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
};