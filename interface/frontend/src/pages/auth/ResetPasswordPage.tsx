import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  Paper,
  Link,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';

import { authAPI } from '../../services/api/authAPI';

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>();

  const password = watch('password');

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setError('Invalid reset token');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      await authAPI.resetPassword(token, data.password);
      navigate('/login', { 
        state: { 
          message: 'Password reset successfully. Please sign in with your new password.' 
        } 
      });
    } catch (error: any) {
      setError(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <Container component="main" maxWidth="sm">
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              width: '100%',
              maxWidth: 400,
              borderRadius: 2,
              textAlign: 'center',
            }}
          >
            <Typography variant="h4" component="h1" gutterBottom color="error">
              Invalid Reset Link
            </Typography>
            <Typography variant="body1" sx={{ mb: 3 }}>
              This password reset link is invalid or has expired. 
              Please request a new password reset.
            </Typography>
            <Link component={RouterLink} to="/forgot-password" variant="body2">
              Request New Reset Link
            </Link>
          </Paper>
        </Box>
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            maxWidth: 400,
            borderRadius: 2,
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Set New Password
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Enter your new password below
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              label="New Password"
              type="password"
              id="password"
              autoComplete="new-password"
              autoFocus
              error={!!errors.password}
              helperText={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters',
                },
                pattern: {
                  value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
                  message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
                },
              })}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              label="Confirm New Password"
              type="password"
              id="confirmPassword"
              autoComplete="new-password"
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword?.message}
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (value) =>
                  value === password || 'Passwords do not match',
              })}
            />
            
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={isLoading}
            >
              {isLoading ? 'Resetting Password...' : 'Reset Password'}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to="/login" variant="body2">
                Back to Sign In
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};