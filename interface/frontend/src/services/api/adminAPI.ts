import apiClient from './client';
import { User } from '../../types/auth';

export const adminAPI = {
  async getUsers(): Promise<User[]> {
    const response = await apiClient.get('/admin/users');
    return (response.data as any).data || response.data;
  },

  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    role: 'admin' | 'user' | 'viewer';
    status: 'active' | 'inactive';
  }): Promise<User> {
    const response = await apiClient.post('/admin/users', userData);
    return (response.data as any).data || response.data;
  },

  async updateUser(id: string, data: {
    username?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'user' | 'viewer';
    status?: 'active' | 'inactive';
  }): Promise<User> {
    const response = await apiClient.put(`/admin/users/${id}`, data);
    return (response.data as any).data || response.data;
  },

  async deleteUser(id: string): Promise<void> {
    await apiClient.delete(`/admin/users/${id}`);
  },

  async toggleUserStatus(id: string): Promise<User> {
    const response = await apiClient.patch(`/admin/users/${id}/toggle-status`);
    return (response.data as any).data || response.data;
  },
};