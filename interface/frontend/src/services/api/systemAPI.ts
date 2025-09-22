import apiClient from './client';
import { SystemStatus, SystemStats } from '../../types/system';

export interface SystemConfig {
  logging: {
    level: string;
    enableFileLogging: boolean;
    maxLogFiles: number;
    maxLogSize: string;
  };
  performance: {
    requestTimeout: number;
    maxConcurrentRequests: number;
    rateLimitWindow: number;
    rateLimitMax: number;
  };
  storage: {
    dataDirectory: string;
    backupDirectory: string;
    maxBackups: number;
    autoBackupInterval: number;
  };
  security: {
    jwtExpiresIn: string;
    refreshTokenExpiresIn: string;
    passwordMinLength: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
  };
  features: {
    enableEnhancement: boolean;
    enableRating: boolean;
    enableExport: boolean;
    enableMetrics: boolean;
  };
}

export interface SystemEvent {
  id: string;
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'critical';
  category: 'system' | 'service' | 'security' | 'performance';
  message: string;
  details?: any;
  source: string;
}

export interface SystemLog {
  timestamp: string;
  level: string;
  message: string;
  category: string;
  source: string;
  details?: any;
}

export interface SystemMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  services: {
    [serviceName: string]: {
      status: 'up' | 'down' | 'degraded';
      responseTime?: number;
      errorCount: number;
    };
  };
}

export const systemAPI = {
  async getSystemStatus(): Promise<SystemStatus> {
    const response = await apiClient.get('/system/status');
    return response.data;
  },

  async getSystemStats(): Promise<SystemStats> {
    const response = await apiClient.get('/system/stats');
    return response.data;
  },

  async getSystemHealth(): Promise<any> {
    const response = await apiClient.get('/system/health');
    return response.data;
  },

  async getSystemConfig(): Promise<SystemConfig> {
    const response = await apiClient.get('/system/config');
    return response.data;
  },

  async updateSystemConfig(updates: Partial<SystemConfig>): Promise<{ message: string; config: SystemConfig }> {
    const response = await apiClient.put('/system/config', updates);
    return response.data;
  },

  async getSystemLogs(params?: {
    level?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: SystemLog[]; total: number }> {
    const response = await apiClient.get('/system/logs', { params });
    return response.data;
  },

  async getSystemEvents(params?: {
    type?: string;
    category?: string;
    limit?: number;
  }): Promise<{ events: SystemEvent[]; count: number; timestamp: string }> {
    const response = await apiClient.get('/system/events', { params });
    return response.data;
  },

  async getSystemMetrics(params?: {
    limit?: number;
  }): Promise<{ metrics: SystemMetrics[]; count: number; timestamp: string }> {
    const response = await apiClient.get('/system/metrics', { params });
    return response.data;
  },

  async createBackup(): Promise<{
    message: string;
    backup: {
      id: string;
      path: string;
      size: number;
      createdAt: string;
    };
  }> {
    const response = await apiClient.post('/system/backup');
    return response.data;
  },

  async cleanupSystem(): Promise<{
    message: string;
    results: {
      logsCleared: number;
      tempFilesRemoved: number;
      oldMetricsRemoved: number;
      oldEventsRemoved: number;
    };
  }> {
    const response = await apiClient.post('/system/cleanup');
    return response.data;
  },
};