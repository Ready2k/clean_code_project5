import React from 'react';
import { Box, Button, Typography, Alert } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { login } from '../../store/slices/authSlice';

export const QuickLogin: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isLoading, error } = useAppSelector((state) => state.auth);

  const handleQuickLogin = async () => {
    try {
      await dispatch(login({
        email: 'admin@example.com',
        password: 'admin123456'
      })).unwrap();
    } catch (error) {
      console.error('Quick login failed:', error);
    }
  };

  return (
    <Box sx={{ mt: 2, p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Development Quick Login
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Button
        variant="outlined"
        size="small"
        onClick={handleQuickLogin}
        disabled={isLoading}
        fullWidth
      >
        {isLoading ? 'Logging in...' : 'Login as Admin (admin@promptlibrary.local)'}
      </Button>
      
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Default credentials: admin@example.com / admin123456
      </Typography>
    </Box>
  );
};