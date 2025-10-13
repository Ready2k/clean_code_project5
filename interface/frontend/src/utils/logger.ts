/**
 * Frontend logging utility
 * Provides structured logging for the frontend application
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  environment: string;
  url?: string;
  userAgent?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: any;
}

class FrontendLogger {
  private logLevel: LogLevel;
  private service: string;
  private environment: string;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 100;

  constructor() {
    this.logLevel = this.getLogLevel();
    this.service = 'prompt-library-frontend';
    this.environment = import.meta.env.MODE || 'development';
    
    // Send logs to backend periodically in production
    if (this.environment === 'production') {
      setInterval(() => this.flushLogs(), 30000); // Every 30 seconds
    }
  }

  private getLogLevel(): LogLevel {
    const level = import.meta.env.VITE_LOG_LEVEL || 'info';
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private createLogEntry(level: string, message: string, meta: any = {}): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      environment: this.environment,
      url: typeof window !== 'undefined' ? window.location.href : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      ...meta
    };
  }

  private log(level: LogLevel, levelName: string, message: string, meta: any = {}) {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(levelName, message, meta);
    
    // Console output for development
    if (this.environment === 'development') {
      const consoleMethod = level === LogLevel.ERROR ? 'error' : 
                           level === LogLevel.WARN ? 'warn' : 'log';
      console[consoleMethod](`[${entry.timestamp}] [${levelName}] ${message}`, meta);
    }

    // Buffer for production logging
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift(); // Remove oldest entry
    }

    // Send critical errors immediately
    if (level === LogLevel.ERROR && this.environment === 'production') {
      this.sendLogEntry(entry);
    }
  }

  private async sendLogEntry(entry: LogEntry) {
    try {
      await fetch('/api/v1/logs/frontend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry)
      });
    } catch (error) {
      // Fallback to console if backend is unavailable
      console.error('Failed to send log to backend:', error);
    }
  }

  private async flushLogs() {
    if (this.logBuffer.length === 0) return;

    try {
      await fetch('/api/v1/logs/frontend/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.logBuffer)
      });
      this.logBuffer = []; // Clear buffer after successful send
    } catch (error) {
      console.error('Failed to flush logs to backend:', error);
    }
  }

  debug(message: string, meta?: any) {
    this.log(LogLevel.DEBUG, 'debug', message, meta);
  }

  info(message: string, meta?: any) {
    this.log(LogLevel.INFO, 'info', message, meta);
  }

  warn(message: string, meta?: any) {
    this.log(LogLevel.WARN, 'warn', message, meta);
  }

  error(message: string, meta?: any) {
    this.log(LogLevel.ERROR, 'error', message, meta);
  }

  // Performance logging
  performance(operation: string, duration: number, meta?: any) {
    this.info(`Performance: ${operation}`, {
      type: 'performance',
      operation,
      duration,
      ...meta
    });
  }

  // User action logging
  userAction(action: string, meta?: any) {
    this.info(`User action: ${action}`, {
      type: 'user_action',
      action,
      ...meta
    });
  }

  // API call logging
  apiCall(method: string, url: string, duration: number, status: number, meta?: any) {
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    const levelName = status >= 400 ? 'error' : 'info';
    
    this.log(level, levelName, `API ${method} ${url}`, {
      type: 'api_call',
      method,
      url,
      duration,
      status,
      ...meta
    });
  }
}

// Create singleton instance
export const logger = new FrontendLogger();

// Export convenience functions
export const logDebug = (message: string, meta?: any) => logger.debug(message, meta);
export const logInfo = (message: string, meta?: any) => logger.info(message, meta);
export const logWarn = (message: string, meta?: any) => logger.warn(message, meta);
export const logError = (message: string, meta?: any) => logger.error(message, meta);
export const logPerformance = (operation: string, duration: number, meta?: any) => 
  logger.performance(operation, duration, meta);
export const logUserAction = (action: string, meta?: any) => logger.userAction(action, meta);
export const logApiCall = (method: string, url: string, duration: number, status: number, meta?: any) =>
  logger.apiCall(method, url, duration, status, meta);

export default logger;