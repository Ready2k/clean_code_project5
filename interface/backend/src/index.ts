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
import { providerRoutes } from './routes/providers.js';
import { modelRoutes } from './routes/models.js';
import { templateRoutes } from './routes/templates.js';
import healthMonitoringRoutes from './routes/health-monitoring.js';
import usageAnalyticsRoutes from './routes/usage-analytics.js';
import migrationUtilitiesRoutes from './routes/migration-utilities.js';
import { migrationRoutes } from './routes/migration.js';
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
import { getWebSocketService } from './services/websocket-service.js';
import { initializeDatabaseService } from './services/database-service.js';
import { getMigrationService } from './services/migration-service.js';
import { initializeRegistryMonitoring } from './services/registry-monitoring-service.js';
import { initializeHealthMonitoring } from './services/provider-health-monitoring-service.js';
import { initializeUsageAnalytics } from './services/provider-usage-analytics-service.js';
import { getProviderMigrationUtilitiesService } from './services/provider-migration-utilities-service.js';

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

// Dynamic provider management routes (admin only)
app.use('/api/admin/providers', authenticateToken, providerRoutes);
app.use('/api/admin/models', authenticateToken, modelRoutes);
app.use('/api/admin/provider-templates', authenticateToken, templateRoutes);
app.use('/api/admin/health-monitoring', authenticateToken, healthMonitoringRoutes);
app.use('/api/admin/usage-analytics', authenticateToken, usageAnalyticsRoutes);
app.use('/api/admin/migration-utilities', authenticateToken, migrationUtilitiesRoutes);
app.use('/api/admin/migration', authenticateToken, migrationRoutes);

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

    // Initialize database service if DATABASE_URL is provided
    if (process.env['DATABASE_URL']) {
      const dbUrl = new URL(process.env['DATABASE_URL']);
      await initializeDatabaseService({
        host: dbUrl.hostname,
        port: parseInt(dbUrl.port) || 5432,
        database: dbUrl.pathname.slice(1), // Remove leading slash
        user: dbUrl.username,
        password: dbUrl.password,
        ssl: process.env['NODE_ENV'] === 'production'
      });

      // Run database migrations
      const migrationService = getMigrationService();
      await migrationService.initialize();
      await migrationService.migrate();
      logger.info('Database migrations completed successfully');
    } else {
      logger.info('No DATABASE_URL provided, skipping database initialization');
    }

    // Initialize Redis service first (required by user service)
    await initializeRedisService();

    // Initialize user service
    const redisService = getRedisService();
    await initializeUserService(redisService);

    // Initialize WebSocket service (after Redis is initialized)
    const webSocketService = getWebSocketService();
    webSocketService.initialize(io);

    // Initialize prompt library service
    await initializePromptLibraryService(webSocketService, {
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

    // Initialize enhancement workflow service
    getEnhancementWorkflowService(webSocketService);

    // Set up real-time enhancement progress updates
    const enhancementService = getEnhancementWorkflowService(webSocketService);
    enhancementService.on('progress', (progress) => {
      io.to(`user:${progress.promptId}`).emit('enhancement:progress', progress);
    });

    // Connect WebSocket service to system monitoring
    const systemMonitoringService = getSystemMonitoringService();
    systemMonitoringService.setWebSocketService(webSocketService);

    // Make io and webSocketService available to routes
    app.set('io', io);
    app.set('webSocketService', webSocketService);

    // Initialize registry monitoring service (after all other services)
    await initializeRegistryMonitoring({
      refreshInterval: parseInt(process.env['REGISTRY_REFRESH_INTERVAL'] || '300000'), // 5 minutes
      healthCheckInterval: parseInt(process.env['REGISTRY_HEALTH_CHECK_INTERVAL'] || '300000'), // 5 minutes
      enableAutoRefresh: process.env['REGISTRY_AUTO_REFRESH'] !== 'false',
      enableHealthMonitoring: process.env['REGISTRY_HEALTH_MONITORING'] !== 'false'
    });

    // Initialize provider health monitoring service
    await initializeHealthMonitoring({
      healthCheckInterval: parseInt(process.env['HEALTH_CHECK_INTERVAL'] || '300000'), // 5 minutes
      performanceMetricsInterval: parseInt(process.env['METRICS_INTERVAL'] || '60000'), // 1 minute
      alertThresholds: {
        responseTimeMs: parseInt(process.env['ALERT_RESPONSE_TIME_MS'] || '5000'),
        errorRatePercent: parseInt(process.env['ALERT_ERROR_RATE_PERCENT'] || '10'),
        uptimePercent: parseInt(process.env['ALERT_UPTIME_PERCENT'] || '95')
      },
      retentionDays: parseInt(process.env['HEALTH_DATA_RETENTION_DAYS'] || '30'),
      enableAlerting: process.env['ENABLE_HEALTH_ALERTING'] !== 'false',
      enableMetricsCollection: process.env['ENABLE_METRICS_COLLECTION'] !== 'false'
    });

    // Initialize provider usage analytics service
    await initializeUsageAnalytics({
      aggregationInterval: parseInt(process.env['ANALYTICS_AGGREGATION_INTERVAL'] || '300000'), // 5 minutes
      retentionDays: parseInt(process.env['ANALYTICS_RETENTION_DAYS'] || '90'), // 90 days
      enableRecommendations: process.env['ENABLE_USAGE_RECOMMENDATIONS'] !== 'false',
      enableRealTimeTracking: process.env['ENABLE_REALTIME_TRACKING'] !== 'false'
    });

    // Initialize provider migration utilities service
    const migrationUtilitiesService = getProviderMigrationUtilitiesService({
      batchSize: parseInt(process.env['MIGRATION_BATCH_SIZE'] || '10'),
      validateBeforeMigration: process.env['MIGRATION_VALIDATE_BEFORE'] !== 'false',
      createBackup: process.env['MIGRATION_CREATE_BACKUP'] !== 'false',
      enableRollback: process.env['MIGRATION_ENABLE_ROLLBACK'] !== 'false',
      dryRun: process.env['MIGRATION_DRY_RUN'] === 'true'
    });
    
    // Initialize migration database tables
    await migrationUtilitiesService.initializeTables();

    logger.info('Services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

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

    // Shutdown health monitoring service
    try {
      const { getProviderHealthMonitoringService } = await import('./services/provider-health-monitoring-service.js');
      const healthMonitoringService = getProviderHealthMonitoringService();
      await healthMonitoringService.stop();
    } catch (error) {
      logger.debug('Health monitoring service not initialized or already shut down');
    }

    // Shutdown usage analytics service
    try {
      const { getProviderUsageAnalyticsService } = await import('./services/provider-usage-analytics-service.js');
      const usageAnalyticsService = getProviderUsageAnalyticsService();
      await usageAnalyticsService.stop();
    } catch (error) {
      logger.debug('Usage analytics service not initialized or already shut down');
    }

    // Shutdown database service if initialized
    try {
      const { shutdownDatabaseService } = await import('./services/database-service.js');
      await shutdownDatabaseService();
    } catch (error) {
      // Database service might not be initialized
      logger.debug('Database service not initialized or already shut down');
    }

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