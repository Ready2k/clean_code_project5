/**
 * Logging configuration for the application
 * This file allows easy control of logging behavior across environments
 */

import { LogLevel, LogConfig } from '../utils/logger';

// Environment-based logging configuration
export const getLoggingConfig = (): Partial<LogConfig> => {
  const isDev = import.meta.env?.DEV;
  const isProd = import.meta.env?.PROD;
  
  if (isDev) {
    return {
      level: LogLevel.DEBUG, // Show debug and above in development
      enableConsole: true,
      enableRemote: false,
      prefix: '🔍',
    };
  }
  
  if (isProd) {
    return {
      level: LogLevel.WARN, // Only warnings and errors in production
      enableConsole: false, // Disable console logging in production
      enableRemote: true, // Enable remote logging in production (when implemented)
      prefix: '',
    };
  }
  
  // Default configuration for other environments
  return {
    level: LogLevel.INFO,
    enableConsole: true,
    enableRemote: false,
    prefix: '📝',
  };
};

// Feature-specific logging levels (can override global config)
export const featureLoggingConfig = {
  enhancement: {
    level: LogLevel.DEBUG, // Always show debug logs for enhancement workflow
  },
  api: {
    level: LogLevel.INFO, // Show API request/response info
  },
  websocket: {
    level: LogLevel.INFO, // Show WebSocket connection info
  },
  auth: {
    level: LogLevel.WARN, // Only show auth warnings/errors for security
  },
};

// Quick toggle to disable all logging (useful for debugging)
export const DISABLE_ALL_LOGGING = false;