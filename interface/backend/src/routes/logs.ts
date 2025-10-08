import { Router } from 'express';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  rateLimitBatchLogs,
  rateLimitSingleLog,
  validateBatchLogEntries,
  validateLogEntry
} from '../middleware/log-ingestion.js';

const router = Router();

type LogLevel = 'error' | 'warn' | 'warning' | 'info' | 'debug' | 'trace' | 'fatal';

interface FrontendLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

const normalizeLogLevel = (level: LogLevel): 'error' | 'warn' | 'info' | 'debug' => {
  switch (level) {
    case 'warning':
      return 'warn';
    case 'trace':
      return 'debug';
    case 'fatal':
      return 'error';
    default:
      return level;
  }
};

// Endpoint to receive single frontend log entry
router.post(
  '/frontend',
  authenticateToken,
  rateLimitSingleLog,
  validateLogEntry,
  (req, res) => {
    try {
      const logEntry = req.body as FrontendLogEntry;

      // Validate log entry structure
      if (!logEntry.timestamp || !logEntry.level || !logEntry.message) {
        return res.status(400).json({
          error: 'Invalid log entry format',
          required: ['timestamp', 'level', 'message']
        });
      }

      // Log to backend with frontend prefix
      const normalizedLevel = normalizeLogLevel(logEntry.level.toLowerCase() as LogLevel);
      const message = `[FRONTEND] ${logEntry.message}`;
      const meta = {
        ...logEntry,
        source: 'frontend',
        originalLevel: logEntry.level
      };

      // Route to appropriate log level
      switch (normalizedLevel) {
        case 'error':
          logger.error(message, meta);
          break;
        case 'warn':
          logger.warn(message, meta);
          break;
        case 'debug':
          logger.debug(message, meta);
          break;
        default:
          logger.info(message, meta);
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Failed to process frontend log entry:', error);
      return res.status(500).json({ error: 'Failed to process log entry' });
    }
  }
);

// Endpoint to receive batch of frontend log entries
router.post(
  '/frontend/batch',
  authenticateToken,
  rateLimitBatchLogs,
  validateBatchLogEntries,
  (req, res) => {
    try {
      const logEntries = req.body as FrontendLogEntry[];

      let processed = 0;
      let errors = 0;

      logEntries.forEach((logEntry, index) => {
        try {
          // Validate log entry structure (defensive, should already be validated)
          if (!logEntry.timestamp || !logEntry.level || !logEntry.message) {
            errors++;
            return;
          }

          // Log to backend with frontend prefix
          const normalizedLevel = normalizeLogLevel(logEntry.level.toLowerCase() as LogLevel);
          const message = `[FRONTEND] ${logEntry.message}`;
          const meta = {
            ...logEntry,
            source: 'frontend',
            originalLevel: logEntry.level,
            batchIndex: index
          };

          // Route to appropriate log level
          switch (normalizedLevel) {
            case 'error':
              logger.error(message, meta);
              break;
            case 'warn':
              logger.warn(message, meta);
              break;
            case 'debug':
              logger.debug(message, meta);
              break;
            default:
              logger.info(message, meta);
          }

          processed++;
        } catch (error) {
          errors++;
          logger.error(`Failed to process frontend log entry at index ${index}:`, error);
        }
      });

      return res.status(200).json({
        success: true,
        processed,
        errors,
        total: logEntries.length
      });
    } catch (error) {
      logger.error('Failed to process frontend log batch:', error);
      return res.status(500).json({ error: 'Failed to process log batch' });
    }
  }
);

// Removed unused log retrieval endpoint - add back if needed:
// GET /recent - was placeholder implementation with no frontend usage

export default router;