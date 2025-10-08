import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import { validateLogPath, getAllowedLogFiles } from '../utils/path-security.js';

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  category?: string;
  source?: string;
  requestId?: string;
  userId?: string;
  environment?: string;
  [key: string]: any;
}

export interface LogFile {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
  type: 'backend' | 'frontend' | 'system';
}

export interface LogStats {
  totalFiles: number;
  totalSize: number;
  oldestLog?: Date;
  newestLog?: Date;
  logCounts: {
    error: number;
    warn: number;
    info: number;
    debug: number;
  };
}

class LogReaderService {
  private logsDir: string;

  constructor() {
    this.logsDir = process.env['LOGS_DIR'] || path.resolve(process.cwd(), '../../logs');
  }

  /**
   * Get list of available log files
   */
  async getLogFiles(): Promise<LogFile[]> {
    try {
      const files = await fs.readdir(this.logsDir);
      const logFiles: LogFile[] = [];

      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(this.logsDir, file);
          const stats = await fs.stat(filePath);
          
          let type: 'backend' | 'frontend' | 'system' = 'system';
          if (file.startsWith('backend-')) {
            type = 'backend';
          } else if (file.startsWith('frontend')) {
            type = 'frontend';
          }

          logFiles.push({
            name: file,
            path: filePath,
            size: stats.size,
            lastModified: stats.mtime,
            type
          });
        }
      }

      return logFiles.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    } catch (error) {
      logger.error('Failed to get log files:', error);
      return [];
    }
  }

  /**
   * Read logs from a specific file
   */
  async readLogFile(
    filename: string,
    options: {
      limit?: number;
      offset?: number;
      level?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ logs: LogEntry[]; total: number }> {
    try {
      // Validate and secure the file path to prevent path traversal
      const filePath = validateLogPath(this.logsDir, filename);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return { logs: [], total: 0 };
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());
      
      let logs: LogEntry[] = [];
      
      for (const line of lines) {
        try {
          // Try to parse as JSON (structured logs)
          const logEntry = JSON.parse(line);
          
          // Normalize the log entry
          const normalizedEntry: LogEntry = {
            timestamp: logEntry['@timestamp'] || logEntry.timestamp || new Date().toISOString(),
            level: logEntry.level || 'info',
            message: logEntry.message || '',
            service: logEntry.service || 'unknown',
            category: logEntry.category || logEntry.type || 'system',
            source: logEntry.source || filename,
            requestId: logEntry.requestId,
            userId: logEntry.userId,
            environment: logEntry.environment,
            ...logEntry
          };

          logs.push(normalizedEntry);
        } catch {
          // If not JSON, treat as plain text log
          const timestamp = this.extractTimestamp(line) || new Date().toISOString();
          const level = this.extractLogLevel(line) || 'info';
          
          logs.push({
            timestamp,
            level,
            message: line,
            service: 'unknown',
            category: 'system',
            source: filename
          });
        }
      }

      // Apply filters
      logs = this.filterLogs(logs, options);

      // Sort by timestamp (newest first)
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const total = logs.length;
      const { limit = 100, offset = 0 } = options;
      
      // Apply pagination
      const paginatedLogs = logs.slice(offset, offset + limit);

      return { logs: paginatedLogs, total };
    } catch (error) {
      logger.error(`Failed to read log file ${filename}:`, error);
      return { logs: [], total: 0 };
    }
  }

  /**
   * Read logs from all files
   */
  async readAllLogs(options: {
    limit?: number;
    offset?: number;
    level?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    fileTypes?: ('backend' | 'frontend' | 'system')[];
  } = {}): Promise<{ logs: LogEntry[]; total: number }> {
    try {
      const logFiles = await this.getLogFiles();
      const { fileTypes } = options;
      
      // Filter files by type if specified
      const filteredFiles = fileTypes 
        ? logFiles.filter(file => fileTypes.includes(file.type))
        : logFiles;

      let allLogs: LogEntry[] = [];

      for (const file of filteredFiles) {
        const fileOptions: any = {};
        if (options.level) fileOptions.level = options.level;
        if (options.search) fileOptions.search = options.search;
        if (options.startDate) fileOptions.startDate = options.startDate;
        if (options.endDate) fileOptions.endDate = options.endDate;
        
        const { logs } = await this.readLogFile(file.name, fileOptions);
        allLogs.push(...logs);
      }

      // Sort by timestamp (newest first)
      allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const total = allLogs.length;
      const { limit = 100, offset = 0 } = options;
      
      // Apply pagination
      const paginatedLogs = allLogs.slice(offset, offset + limit);

      return { logs: paginatedLogs, total };
    } catch (error) {
      logger.error('Failed to read all logs:', error);
      return { logs: [], total: 0 };
    }
  }

  /**
   * List available log files safely
   */
  async listLogFiles(): Promise<string[]> {
    try {
      return await getAllowedLogFiles(this.logsDir);
    } catch (error) {
      logger.error('Failed to list log files:', error);
      return [];
    }
  }

  /**
   * Get log statistics
   */
  async getLogStats(): Promise<LogStats> {
    try {
      const logFiles = await this.getLogFiles();
      const { logs } = await this.readAllLogs({ limit: 10000 }); // Sample for stats

      const totalSize = logFiles.reduce((sum, file) => sum + file.size, 0);
      
      const timestamps = logs
        .map(log => new Date(log.timestamp))
        .filter(date => !isNaN(date.getTime()));

      const oldestLog = timestamps.length > 0 
        ? new Date(Math.min(...timestamps.map(d => d.getTime())))
        : undefined;
      
      const newestLog = timestamps.length > 0
        ? new Date(Math.max(...timestamps.map(d => d.getTime())))
        : undefined;

      const logCounts = {
        error: logs.filter(log => log.level === 'error').length,
        warn: logs.filter(log => log.level === 'warn' || log.level === 'warning').length,
        info: logs.filter(log => log.level === 'info').length,
        debug: logs.filter(log => log.level === 'debug').length
      };

      return {
        totalFiles: logFiles.length,
        totalSize,
        oldestLog: oldestLog || new Date(),
        newestLog: newestLog || new Date(),
        logCounts
      };
    } catch (error) {
      logger.error('Failed to get log stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        logCounts: { error: 0, warn: 0, info: 0, debug: 0 }
      };
    }
  }

  /**
   * Search logs across all files
   */
  async searchLogs(
    query: string,
    options: {
      limit?: number;
      level?: string;
      fileTypes?: ('backend' | 'frontend' | 'system')[];
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ logs: LogEntry[]; total: number }> {
    return this.readAllLogs({
      ...options,
      search: query
    });
  }

  /**
   * Get recent error logs
   */
  async getRecentErrors(limit = 50): Promise<LogEntry[]> {
    const { logs } = await this.readAllLogs({
      level: 'error',
      limit
    });
    return logs;
  }

  /**
   * Filter logs based on criteria
   */
  private filterLogs(logs: LogEntry[], options: {
    level?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
  }): LogEntry[] {
    let filtered = logs;

    // Filter by level
    if (options.level) {
      filtered = filtered.filter(log => 
        log.level.toLowerCase() === options.level!.toLowerCase()
      );
    }

    // Filter by search term
    if (options.search) {
      const searchTerm = options.search.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(searchTerm) ||
        log.service.toLowerCase().includes(searchTerm) ||
        (log.category && log.category.toLowerCase().includes(searchTerm))
      );
    }

    // Filter by date range
    if (options.startDate || options.endDate) {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp);
        if (options.startDate && logDate < options.startDate) return false;
        if (options.endDate && logDate > options.endDate) return false;
        return true;
      });
    }

    return filtered;
  }

  /**
   * Extract timestamp from plain text log line
   */
  private extractTimestamp(line: string): string | null {
    // Try to match common timestamp formats
    const patterns = [
      /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)/,
      /(\d{2}:\d{2}:\d{2})/,
      /\[([^\]]+)\]/
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        try {
          const timestamp = new Date(match[1]!);
          if (!isNaN(timestamp.getTime())) {
            return timestamp.toISOString();
          }
        } catch {
          // Continue to next pattern
        }
      }
    }

    return null;
  }

  /**
   * Extract log level from plain text log line
   */
  private extractLogLevel(line: string): string | null {
    const levelPatterns = [
      /\[(error|warn|warning|info|debug)\]/i,
      /\b(error|warn|warning|info|debug)\b/i
    ];

    for (const pattern of levelPatterns) {
      const match = line.match(pattern);
      if (match) {
        return match[1]!.toLowerCase();
      }
    }

    return null;
  }
}

// Singleton instance
let logReaderService: LogReaderService | null = null;

export const getLogReaderService = (): LogReaderService => {
  if (!logReaderService) {
    logReaderService = new LogReaderService();
  }
  return logReaderService;
};

export default LogReaderService;