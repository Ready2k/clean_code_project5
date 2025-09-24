import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { authRoutes } from './routes/auth.js';
import { promptRoutes } from './routes/prompts.js';
import { connectionRoutes } from './routes/connections.js';
import { systemRoutes } from './routes/system.js';
import { adminRoutes } from './routes/admin.js';
import { ratingRoutes } from './routes/ratings.js';
import { exportRoutes } from './routes/export.js';
import { importRoutes } from './routes/import.js';
import { authenticateToken } from './middleware/auth.js';
import { recordMetrics, trackAPIUsage, trackSecurityEvents } from './middleware/metrics.js';
import { initializePromptLibraryService, getPromptLibraryService } from './services/prompt-library-service.js';
import { getEnhancementWorkflowService } from './services/enhancement-workflow-service.js';
import { initializeConnectionManagementService, getConnectionManagementService } from './services/connection-management-service.js';
import { initializeRedisService, getRedisService } from './services/redis-service.js';
import { initializeUserService } from './services/user-service.js';
import { initializeRatingService, getRatingService } from './services/rating-service.js';
import { initializeExportService, getExportService } from './services/export-service.js';
import { initializeAPIDocumentationService, getAPIDocumentationService } from './services/api-documentation-service.js';
import { initializeSystemMonitoringService, getSystemMonitoringService } from './services/system-monitoring-service.js';
import { webSocketService } from './services/websocket-service.js';

// Load environment variables from parent directory
dotenv.config({ path: '../.env' });

// Initialize encryption service after environment variables are loaded
import { EncryptionService } from './services/encryption-service.js';
const masterKey = process.env['ENCRYPTION_KEY'];
if (masterKey) {
  EncryptionService.initialize(masterKey);
} else {
  logger.warn('No ENCRYPTION_KEY environment variable found. Using random key for development.');
  EncryptionService.initialize();
}

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env['PORT'] || 8000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env['FRONTEND_URL'] || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting - more generous for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env['NODE_ENV'] === 'production' ? 100 : 500, // Higher limit for development
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks in development
    if (process.env['NODE_ENV'] !== 'production' && req.path === '/api/health') {
      return true;
    }
    return false;
  }
});

app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging and metrics
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.headers['x-request-id']
  });
  next();
});

// Metrics recording middleware
app.use('/api', recordMetrics);
app.use('/api', trackAPIUsage);
app.use('/api', trackSecurityEvents);

// Health check endpoint (no auth required)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env['npm_package_version'] || '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/prompts', authenticateToken, promptRoutes);
app.use('/api/connections', authenticateToken, connectionRoutes);
app.use('/api/system', authenticateToken, systemRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/api/ratings', authenticateToken, ratingRoutes);
app.use('/api/export', authenticateToken, exportRoutes);
app.use('/api/import', authenticateToken, importRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    },
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize services
async function initializeServices() {
  try {
    logger.info('Initializing services...');

    // Initialize Redis service first (required by user service)
    await initializeRedisService();

    // Initialize user service
    const redisService = getRedisService();
    await initializeUserService(redisService);

    // Initialize prompt library service
    await initializePromptLibraryService({
      storageDir: process.env['PROMPT_STORAGE_DIR'] || './data/prompts'
    });

    // Initialize connection management service
    await initializeConnectionManagementService({
      storageDir: process.env['CONNECTION_STORAGE_DIR'] || './data/connections'
    });

    // Initialize rating service
    await initializeRatingService({
      storageDir: process.env['RATING_STORAGE_DIR'] || './data'
    });

    // Initialize export service
    await initializeExportService({
      tempDir: process.env['EXPORT_TEMP_DIR'] || './temp/exports'
    });

    // Sync ratings from rating service to prompt library service
    // This must happen after both services are initialized
    try {
      const promptLibraryService = getPromptLibraryService();
      await promptLibraryService.syncRatingsFromRatingService();
      logger.info('Successfully synced ratings from rating service to prompt library');
    } catch (error) {
      logger.warn('Failed to sync ratings during startup', { error });
    }

    // Initialize API documentation service
    await initializeAPIDocumentationService();

    // Initialize system monitoring service
    await initializeSystemMonitoringService();

    // Connect WebSocket service to system monitoring
    const systemMonitoringService = getSystemMonitoringService();
    systemMonitoringService.setWebSocketService(webSocketService);

    logger.info('Services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Initialize WebSocket service
webSocketService.initialize(io);

// Set up real-time enhancement progress updates
const enhancementService = getEnhancementWorkflowService();
enhancementService.on('progress', (progress) => {
  io.to(`user:${progress.promptId}`).emit('enhancement:progress', progress);
});

// Make io and webSocketService available to routes
app.set('io', io);
app.set('webSocketService', webSocketService);

// Graceful shutdown
async function gracefulShutdown() {
  logger.info('Starting graceful shutdown...');

  try {
    // Close server
    server.close();

    // Shutdown services
    const promptLibraryService = getPromptLibraryService();
    await promptLibraryService.shutdown();

    const connectionService = getConnectionManagementService();
    await connectionService.shutdown();

    const redisService = getRedisService();
    await redisService.disconnect();

    const ratingService = getRatingService();
    await ratingService.shutdown();

    const exportService = getExportService();
    await exportService.shutdown();

    const apiDocService = getAPIDocumentationService();
    await apiDocService.shutdown();

    const systemMonitoringService = getSystemMonitoringService();
    await systemMonitoringService.shutdown();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
async function startServer() {
  try {
    await initializeServices();

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        environment: process.env['NODE_ENV'] || 'development',
        port: PORT
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { app, io };