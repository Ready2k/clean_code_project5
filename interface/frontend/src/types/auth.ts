export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  status?: 'active' | 'inactive';
  createdAt: string;
  lastLogin: string;
  preferences: UserPreferences;
  permissions?: string[];
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  defaultProvider: string;
  notifications: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  enhancement: boolean;
  system: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}