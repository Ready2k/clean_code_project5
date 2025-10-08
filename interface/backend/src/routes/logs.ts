import { Router } from 'express';
import { logger } from '../utils/logger.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateLogEntry, validateBatchLogEntries } from '../middleware/log-validation.js';
import { rateLimitSingleLog, rateLimitBatchLogs } from '../middleware/log-rate-limit.js';

const router = Router();

// Endpoint to receive single frontend log entry (now secured)
router.post('/frontend', authenticateToken, rateLimitSingleLog, validateLogEntry, (req, res) => {
  try {
    const logEntry = req.body;
    
    // Validate log entry structure
    if (!logEntry.timestamp || !logEntry.level || !logEntry.message) {
      return res.status(400).json({ 
        error: 'Invalid log entry format',
        required: ['timestamp', 'level', 'message']
      });
    }

    // Log to backend with frontend prefix
    const level = logEntry.level.toLowerCase();
    const message = `[FRONTEND] ${logEntry.message}`;
    const meta = {
      ...logEntry,
      source: 'frontend',
      originalLevel: logEntry.level
    };

    // Route to appropriate log level
    switch (level) {
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
});

// Endpoint to receive batch of frontend log entries (now secured)
router.post('/frontend/batch', authenticateToken, rateLimitBatchLogs, validateBatchLogEntries, (req, res) => {
  try {
    const { logs } = req.body; // Updated to match validation middleware expectation
    
    if (!Array.isArray(logs)) {
      return res.status(400).json({ 
        error: 'Expected logs array in request body' 
      });
    }

    let processed = 0;
    let errors = 0;

    logs.forEach((logEntry, index) => {
      try {
        // Validation is already done by middleware, so we can trust the structure

        // Log to backend with frontend prefix
        const level = logEntry.level.toLowerCase();
        const message = `[FRONTEND] ${logEntry.message}`;
        const meta = {
          ...logEntry,
          source: 'frontend',
          originalLevel: logEntry.level,
          batchIndex: index
        };

        // Route to appropriate log level
        switch (level) {
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
});

// Endpoint to retrieve recent logs (admin only)
router.get('/recent', authenticateToken, (_req, res) => {
  try {
    // This would require implementing log retrieval from files
    // For now, return a placeholder response
    return res.status(200).json({
      message: 'Log retrieval not implemented yet',
      suggestion: 'Use file system tools to access log files in ./logs/ directory'
    });
  } catch (error) {
    logger.error('Failed to retrieve recent logs:', error);
    return res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

export default router;