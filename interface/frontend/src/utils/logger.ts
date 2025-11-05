/**
 * Centralized logging utility for the frontend application
 * Provides different log levels and can be configured for different environments
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

export interface LogConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  prefix?: string;
}

class Logger {
  private config: LogConfig;
  private context: string;

  constructor(context: string = 'App', config?: Partial<LogConfig>) {
    this.context = context;
    this.config = {
      level: this.getDefaultLogLevel(),
      enableConsole: true,
      enableRemote: false,
      prefix: '🔍',
      ...this.getGlobalConfig(),
      ...config,
    };
  }

  private getGlobalConfig(): Partial<LogConfig> {
    try {
      // Dynamically import config to avoid circular dependencies
      const { getLoggingConfig, DISABLE_ALL_LOGGING } = require('../config/logging');
      
      if (DISABLE_ALL_LOGGING) {
        return {
          level: LogLevel.ERROR,
          enableConsole: false,
          enableRemote: false,
        };
      }
      
      return getLoggingConfig();
    } catch (error) {
      // Fallback if config is not available
      return {};
    }
  }

  private getDefaultLogLevel(): LogLevel {
    // In development, show all logs
    if (import.meta.env?.DEV) {
      return LogLevel.TRACE;
    }
    
    // In production, only show errors and warnings by default
    if (import.meta.env?.PROD) {
      return LogLevel.WARN;
    }
    
    // Default to INFO for other environments
    return LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level;
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const prefix = this.config.prefix || '';
    const context = this.context ? `[${this.context}]` : '';
    
    let formattedMessage = `${prefix} ${timestamp} ${level} ${context} ${message}`;
    
    if (data) {
      formattedMessage += ` ${JSON.stringify(data)}`;
    }
    
    return formattedMessage;
  }

  private log(level: LogLevel, levelName: string, message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    if (this.config.enableConsole) {
      const formattedMessage = this.formatMessage(levelName, message, data);
      
      switch (level) {
        case LogLevel.ERROR:
          console.error(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.DEBUG:
        case LogLevel.TRACE:
          console.log(formattedMessage);
          break;
      }
    }

    // TODO: Implement remote logging if needed
    if (this.config.enableRemote) {
      // Send to remote logging service
    }
  }

  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, 'ERROR', message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, 'WARN', message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, 'INFO', message, data);
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, data);
  }

  trace(message: string, data?: any): void {
    this.log(LogLevel.TRACE, 'TRACE', message, data);
  }

  // Create a child logger with additional context
  child(context: string): Logger {
    return new Logger(`${this.context}:${context}`, this.config);
  }

  // Update configuration
  configure(config: Partial<LogConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Create default logger instances for different parts of the app
export const logger = new Logger('App');
export const enhancementLogger = new Logger('Enhancement');
export const apiLogger = new Logger('API');
export const wsLogger = new Logger('WebSocket');

// Export the Logger class for creating custom loggers
export { Logger };

// Convenience function to create a logger for a specific component
export const createLogger = (context: string, config?: Partial<LogConfig>): Logger => {
  return new Logger(context, config);
};

// Global logging controls (accessible from browser console)
if (typeof window !== 'undefined') {
  (window as any).PromptLibraryLogging = {
    setLevel: (level: LogLevel) => {
      logger.configure({ level });
      enhancementLogger.configure({ level });
      apiLogger.configure({ level });
      wsLogger.configure({ level });
      console.log(`Logging level set to: ${LogLevel[level]}`);
    },
    enableConsole: (enable: boolean) => {
      logger.configure({ enableConsole: enable });
      enhancementLogger.configure({ enableConsole: enable });
      apiLogger.configure({ enableConsole: enable });
      wsLogger.configure({ enableConsole: enable });
      console.log(`Console logging ${enable ? 'enabled' : 'disabled'}`);
    },
    LogLevel,
    // Quick access to common levels
    debug: () => (window as any).PromptLibraryLogging.setLevel(LogLevel.DEBUG),
    info: () => (window as any).PromptLibraryLogging.setLevel(LogLevel.INFO),
    warn: () => (window as any).PromptLibraryLogging.setLevel(LogLevel.WARN),
    error: () => (window as any).PromptLibraryLogging.setLevel(LogLevel.ERROR),
    silent: () => (window as any).PromptLibraryLogging.enableConsole(false),
  };
}