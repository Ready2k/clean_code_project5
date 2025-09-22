import winston from 'winston';
import path from 'path';

const logLevel = process.env['LOG_LEVEL'] || 'info';
const nodeEnv = process.env['NODE_ENV'] || 'development';
const logsDir = process.env['LOGS_DIR'] || path.join(process.cwd(), 'logs');

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, requestId, userId, ...meta }) => {
    return JSON.stringify({
      '@timestamp': timestamp,
      level,
      message,
      service: service || 'prompt-library-backend',
      requestId,
      userId,
      environment: nodeEnv,
      version: process.env['APP_VERSION'] || '1.0.0',
      hostname: process.env['HOSTNAME'] || 'unknown',
      ...meta
    });
  })
);

// Custom format for development
const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}] ${requestId ? `[${requestId}] ` : ''}${message} ${metaStr}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  format: nodeEnv === 'production' ? structuredFormat : developmentFormat,
  defaultMeta: {
    service: 'prompt-library-backend',
    environment: nodeEnv,
    hostname: process.env['HOSTNAME'] || 'unknown'
  },
  transports: [
    // Console transport
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ]
});

// Add file transports in production
if (nodeEnv === 'production') {
  // Error logs
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    handleExceptions: true,
    handleRejections: true,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true
  }));

  // Combined logs
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    maxsize: 10485760, // 10MB
    maxFiles: 10,
    tailable: true
  }));

  // Audit logs for security events
  logger.add(new winston.transports.File({
    filename: path.join(logsDir, 'audit.log'),
    level: 'info',
    maxsize: 10485760, // 10MB
    maxFiles: 10,
    tailable: true,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }: any) => {
        if (meta['audit']) {
          return JSON.stringify({
            '@timestamp': timestamp,
            level,
            message,
            audit: true,
            ...meta
          });
        }
        return '';
      }),
      winston.format((info: any) => info !== null ? info : false)()
    )
  }));
}

// Performance logging
export const performanceLogger = winston.createLogger({
  level: 'info',
  format: structuredFormat,
  defaultMeta: { 
    service: 'prompt-library-performance',
    type: 'performance'
  },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'performance.log'),
      maxsize: 10485760,
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Security logging
export const securityLogger = winston.createLogger({
  level: 'info',
  format: structuredFormat,
  defaultMeta: { 
    service: 'prompt-library-security',
    type: 'security'
  },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'security.log'),
      maxsize: 10485760,
      maxFiles: 10,
      tailable: true
    })
  ]
});

// Helper functions for structured logging
export const logWithContext = (level: string, message: string, context: any = {}) => {
  logger.log(level, message, context);
};

export const logError = (error: Error, context: any = {}) => {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context
  });
};

export const logPerformance = (operation: string, duration: number, context: any = {}) => {
  performanceLogger.info(`${operation} completed`, {
    operation,
    duration,
    ...context
  });
};

export const logSecurity = (event: string, context: any = {}) => {
  securityLogger.warn(event, {
    event,
    audit: true,
    ...context
  });
};

// Create a stream object for Morgan HTTP request logging
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

export default logger;