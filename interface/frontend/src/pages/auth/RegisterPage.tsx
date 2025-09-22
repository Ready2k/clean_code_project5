import React from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  Paper,
  MenuItem,
  Link,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { useNavigate, Link as RouterLink } from 'react-router-dom';

import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { register as registerUser } from '../../store/slices/authSlice';

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'user' | 'viewer';
}

export const RegisterPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  
  const { isLoading, error } = useAppSelector((state) => state.auth);
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>();

  const password = watch('password');

  const onSubmit = async (data: RegisterFormData) => {
    try {
      const { confirmPassword, ...registerData } = data;
      await dispatch(registerUser(registerData)).unwrap();
      navigate('/dashboard');
    } catch (error) {
      // Error is handled by the slice
    }
  };

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
            maxWidth: 500,
            borderRadius: 2,
          }}
        >
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom>
              Create Account
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Join the Prompt Library platform
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
              id="username"
              label="Username"
              autoComplete="username"
              autoFocus
              error={!!errors.username}
              helperText={errors.username?.message}
              {...register('username', {
                required: 'Username is required',
                minLength: {
                  value: 3,
                  message: 'Username must be at least 3 characters',
                },
                pattern: {
                  value: /^[a-zA-Z0-9_-]+$/,
                  message: 'Username can only contain letters, numbers, hyphens, and underscores',
                },
              })}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              type="email"
              autoComplete="email"
              error={!!errors.email}
              helperText={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              })}
            />

            <TextField
              margin="normal"
              required
              fullWidth
              select
              id="role"
              label="Role"
              defaultValue="user"
              error={!!errors.role}
              helperText={errors.role?.message || 'Select your intended role'}
              {...register('role', {
                required: 'Role is required',
              })}
            >
              <MenuItem value="user">User - Can create and manage prompts</MenuItem>
              <MenuItem value="viewer">Viewer - Can view and use prompts</MenuItem>
            </TextField>
            
            <TextField
              margin="normal"
              required
              fullWidth
              label="Password"
              type="password"
              id="password"
              autoComplete="new-password"
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
              label="Confirm Password"
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
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Link component={RouterLink} to="/login" variant="body2">
                Already have an account? Sign in
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};