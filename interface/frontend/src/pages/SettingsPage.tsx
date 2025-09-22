import React from 'react';
import { Box, Typography, Container, Grid, Paper } from '@mui/material';
import { AccessibilitySettings } from '../components/common/AccessibilitySettings';

export const SettingsPage: React.FC = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 3 }}>
        <Typography 
          variant="h4" 
          component="h1" 
          gutterBottom
          id="settings-page-title"
        >
          Settings
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" component="h2" gutterBottom>
                Accessibility & Display
              </Typography>
              <AccessibilitySettings />
            </Paper>
            
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" component="h2" gutterBottom>
                General Settings
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Additional settings will be implemented in future tasks.
              </Typography>
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" component="h2" gutterBottom>
                Quick Actions
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Keyboard shortcuts and accessibility features are available throughout the application.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};