export interface SystemStatus {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    api: ServiceStatus;
    database: ServiceStatus;
    storage: ServiceStatus;
    llm: ServiceStatus;
    redis: ServiceStatus;
  };
  uptime: number;
  version: string;
  timestamp: string;
}

export interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  lastChecked: string;
  details?: any;
}

export interface SystemStats {
  system: {
    uptime: number;
    memory: {
      total: number;
      used: number;
      free: number;
      usage: number;
    };
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    disk: {
      total: number;
      used: number;
      free: number;
      usage: number;
    };
  };
  application: {
    version: string;
    environment: string;
    nodeVersion: string;
    processId: number;
    startTime: string;
  };
  services: {
    prompts: {
      total: number;
      totalRatings: number;
    };
    connections: {
      total: number;
      active: number;
      inactive: number;
      error: number;
      byProvider: Record<string, number>;
    };
    redis: {
      connected: boolean;
      memoryUsage?: number;
      keyCount?: number;
    };
  };
  performance: {
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
  };
}