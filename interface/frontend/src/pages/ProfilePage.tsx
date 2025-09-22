import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Grid,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Avatar,
  IconButton,
} from '@mui/material';
import { Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { useForm } from 'react-hook-form';

import { useAppSelector, useAppDispatch } from '../hooks/redux';
import { updateProfile, updatePreferences, changePassword } from '../store/slices/authSlice';
import { UserPreferences } from '../types/auth';

interface ProfileFormData {
  username: string;
  email: string;
}

interface PreferencesFormData extends UserPreferences {}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const ProfilePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user, isLoading, error } = useAppSelector((state) => state.auth);
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingPreferences, setIsEditingPreferences] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const profileForm = useForm<ProfileFormData>({
    defaultValues: {
      username: user?.username || '',
      email: user?.email || '',
    },
  });

  const preferencesForm = useForm<PreferencesFormData>({
    defaultValues: user?.preferences || {
      theme: 'auto',
      language: 'en',
      defaultProvider: '',
      notifications: {
        email: true,
        push: true,
        enhancement: true,
        system: true,
      },
    },
  });

  const passwordForm = useForm<PasswordFormData>();

  const onUpdateProfile = async (data: ProfileFormData) => {
    try {
      await dispatch(updateProfile(data)).unwrap();
      setSuccess('Profile updated successfully');
      setIsEditingProfile(false);
    } catch (error) {
      // Error handled by slice
    }
  };

  const onUpdatePreferences = async (data: PreferencesFormData) => {
    try {
      await dispatch(updatePreferences(data)).unwrap();
      setSuccess('Preferences updated successfully');
      setIsEditingPreferences(false);
    } catch (error) {
      // Error handled by slice
    }
  };

  const onChangePassword = async (data: PasswordFormData) => {
    try {
      await dispatch(changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      })).unwrap();
      setSuccess('Password changed successfully');
      setIsChangingPassword(false);
      passwordForm.reset();
    } catch (error) {
      // Error handled by slice
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Profile Settings
      </Typography>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Profile Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Avatar sx={{ width: 64, height: 64, mr: 2 }}>
              {user.username.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">{user.username}</Typography>
              <Typography variant="body2" color="text.secondary">
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)} • Member since {new Date(user.createdAt).toLocaleDateString()}
              </Typography>
            </Box>
            <IconButton
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              color="primary"
            >
              {isEditingProfile ? <CancelIcon /> : <EditIcon />}
            </IconButton>
          </Box>

          <Box component="form" onSubmit={profileForm.handleSubmit(onUpdateProfile)}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Username"
                  disabled={!isEditingProfile}
                  error={!!profileForm.formState.errors.username}
                  helperText={profileForm.formState.errors.username?.message}
                  {...profileForm.register('username', {
                    required: 'Username is required',
                    minLength: {
                      value: 3,
                      message: 'Username must be at least 3 characters',
                    },
                  })}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  disabled={!isEditingProfile}
                  error={!!profileForm.formState.errors.email}
                  helperText={profileForm.formState.errors.email?.message}
                  {...profileForm.register('email', {
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address',
                    },
                  })}
                />
              </Grid>
            </Grid>

            {isEditingProfile && (
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={isLoading}
                >
                  Save Changes
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setIsEditingProfile(false);
                    profileForm.reset();
                  }}
                >
                  Cancel
                </Button>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Preferences</Typography>
            <IconButton
              onClick={() => setIsEditingPreferences(!isEditingPreferences)}
              color="primary"
            >
              {isEditingPreferences ? <CancelIcon /> : <EditIcon />}
            </IconButton>
          </Box>

          <Box component="form" onSubmit={preferencesForm.handleSubmit(onUpdatePreferences)}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Theme"
                  disabled={!isEditingPreferences}
                  {...preferencesForm.register('theme')}
                >
                  <MenuItem value="light">Light</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                  <MenuItem value="auto">Auto</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="Language"
                  disabled={!isEditingPreferences}
                  {...preferencesForm.register('language')}
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="es">Spanish</MenuItem>
                  <MenuItem value="fr">French</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Default Provider"
                  disabled={!isEditingPreferences}
                  {...preferencesForm.register('defaultProvider')}
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle1" gutterBottom>
              Notifications
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      disabled={!isEditingPreferences}
                      {...preferencesForm.register('notifications.email')}
                    />
                  }
                  label="Email Notifications"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      disabled={!isEditingPreferences}
                      {...preferencesForm.register('notifications.push')}
                    />
                  }
                  label="Push Notifications"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      disabled={!isEditingPreferences}
                      {...preferencesForm.register('notifications.enhancement')}
                    />
                  }
                  label="Enhancement Notifications"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      disabled={!isEditingPreferences}
                      {...preferencesForm.register('notifications.system')}
                    />
                  }
                  label="System Notifications"
                />
              </Grid>
            </Grid>

            {isEditingPreferences && (
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={isLoading}
                >
                  Save Preferences
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setIsEditingPreferences(false);
                    preferencesForm.reset();
                  }}
                >
                  Cancel
                </Button>
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Change Password</Typography>
            <Button
              variant="outlined"
              onClick={() => setIsChangingPassword(!isChangingPassword)}
            >
              {isChangingPassword ? 'Cancel' : 'Change Password'}
            </Button>
          </Box>

          {isChangingPassword && (
            <Box component="form" onSubmit={passwordForm.handleSubmit(onChangePassword)}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="password"
                    label="Current Password"
                    error={!!passwordForm.formState.errors.currentPassword}
                    helperText={passwordForm.formState.errors.currentPassword?.message}
                    {...passwordForm.register('currentPassword', {
                      required: 'Current password is required',
                    })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="password"
                    label="New Password"
                    error={!!passwordForm.formState.errors.newPassword}
                    helperText={passwordForm.formState.errors.newPassword?.message}
                    {...passwordForm.register('newPassword', {
                      required: 'New password is required',
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
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="password"
                    label="Confirm New Password"
                    error={!!passwordForm.formState.errors.confirmPassword}
                    helperText={passwordForm.formState.errors.confirmPassword?.message}
                    {...passwordForm.register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: (value) =>
                        value === passwordForm.watch('newPassword') || 'Passwords do not match',
                    })}
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isLoading}
                >
                  Change Password
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setIsChangingPassword(false);
                    passwordForm.reset();
                  }}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};