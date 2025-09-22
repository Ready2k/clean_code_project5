import apiClient from './client';
import { User, LoginCredentials, AuthResponse } from '../../types/auth';

export const authAPI = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async refreshToken(): Promise<AuthResponse> {
    const response = await apiClient.post('/auth/refresh');
    return response.data;
  },

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  async register(userData: {
    username: string;
    email: string;
    password: string;
    role: 'user' | 'viewer';
  }): Promise<AuthResponse> {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  async updateProfile(profileData: {
    username: string;
    email: string;
  }): Promise<User> {
    const response = await apiClient.put('/auth/profile', profileData);
    return response.data;
  },

  async updatePreferences(preferences: User['preferences']): Promise<User> {
    const response = await apiClient.put('/auth/preferences', preferences);
    return response.data;
  },

  async changePassword(passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> {
    await apiClient.put('/auth/password', passwordData);
  },

  async requestPasswordReset(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await apiClient.post('/auth/reset-password', { token, password: newPassword });
  },
};