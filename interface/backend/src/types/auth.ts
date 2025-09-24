export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  status: 'active' | 'inactive';
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  defaultProvider?: string;
  notifications: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  browser: boolean;
  enhancement: boolean;
  system: boolean;
}

export interface JWTPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role?: 'user' | 'viewer';
  status?: 'active' | 'inactive';
}

export interface AuthResponse {
  user: Omit<User, 'passwordHash'>;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export enum Permission {
  READ_PROMPTS = 'read:prompts',
  WRITE_PROMPTS = 'write:prompts',
  DELETE_PROMPTS = 'delete:prompts',
  ENHANCE_PROMPTS = 'enhance:prompts',
  MANAGE_CONNECTIONS = 'manage:connections',
  RATE_PROMPTS = 'rate:prompts',
  EXPORT_PROMPTS = 'export:prompts',
  ADMIN_USERS = 'admin:users',
  SYSTEM_CONFIG = 'system:config',
  VIEW_SYSTEM = 'view:system'
}

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    Permission.READ_PROMPTS,
    Permission.WRITE_PROMPTS,
    Permission.DELETE_PROMPTS,
    Permission.ENHANCE_PROMPTS,
    Permission.MANAGE_CONNECTIONS,
    Permission.RATE_PROMPTS,
    Permission.EXPORT_PROMPTS,
    Permission.ADMIN_USERS,
    Permission.SYSTEM_CONFIG,
    Permission.VIEW_SYSTEM
  ],
  user: [
    Permission.READ_PROMPTS,
    Permission.WRITE_PROMPTS,
    Permission.ENHANCE_PROMPTS,
    Permission.MANAGE_CONNECTIONS,
    Permission.RATE_PROMPTS,
    Permission.EXPORT_PROMPTS,
    Permission.VIEW_SYSTEM
  ],
  viewer: [
    Permission.READ_PROMPTS,
    Permission.RATE_PROMPTS,
    Permission.VIEW_SYSTEM
  ]
};

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}