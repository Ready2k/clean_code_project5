import { promises as fs } from 'fs';
import path from 'path';

export interface TemplateAuditEvent {
  id: string;
  timestamp: Date;
  userId: string;
  userRole: string;
  operation: string;
  templateId?: string;
  templateCategory?: string;
  templateKey?: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export interface TemplateAuditQuery {
  userId?: string;
  operation?: string;
  templateId?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export class TemplateAuditService {
  private auditLogPath: string;
  private maxLogSize: number;
  private maxLogFiles: number;

  constructor(
    auditLogPath: string = 'logs/template-audit.log',
    maxLogSize: number = 10 * 1024 * 1024, // 10MB
    maxLogFiles: number = 10
  ) {
    this.auditLogPath = auditLogPath;
    this.maxLogSize = maxLogSize;
    this.maxLogFiles = maxLogFiles;
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory(): Promise<void> {
    const logDir = path.dirname(this.auditLogPath);
    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create audit log directory:', error);
    }
  }

  /**
   * Log a template operation for audit purposes
   */
  async logOperation(event: Omit<TemplateAuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const auditEvent: TemplateAuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event
    };

    try {
      await this.writeAuditLog(auditEvent);
      
      // Also log to console for immediate visibility
      const logLevel = auditEvent.success ? 'INFO' : 'ERROR';
      console.log(`[TEMPLATE_AUDIT][${logLevel}] ${JSON.stringify(auditEvent)}`);
      
      // Check if log rotation is needed
      await this.rotateLogsIfNeeded();
    } catch (error) {
      console.error('Failed to write template audit log:', error);
    }
  }

  /**
   * Query audit logs with filtering
   */
  async queryAuditLogs(query: TemplateAuditQuery): Promise<TemplateAuditEvent[]> {
    try {
      const logContent = await fs.readFile(this.auditLogPath, 'utf-8');
      const lines = logContent.split('\n').filter(line => line.trim());
      
      let events: TemplateAuditEvent[] = [];
      
      for (const line of lines) {
        try {
          const event = JSON.parse(line) as TemplateAuditEvent;
          if (this.matchesQuery(event, query)) {
            events.push(event);
          }
        } catch (parseError) {
          // Skip malformed log entries
          continue;
        }
      }

      // Sort by timestamp (newest first)
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 100;
      
      return events.slice(offset, offset + limit);
    } catch (error) {
      console.error('Failed to query audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit statistics for monitoring
   */
  async getAuditStatistics(timeRange: { start: Date; end: Date }): Promise<{
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    operationsByType: Record<string, number>;
    operationsByUser: Record<string, number>;
  }> {
    const events = await this.queryAuditLogs({
      startDate: timeRange.start,
      endDate: timeRange.end
    });

    const stats = {
      totalOperations: events.length,
      successfulOperations: events.filter(e => e.success).length,
      failedOperations: events.filter(e => !e.success).length,
      operationsByType: {} as Record<string, number>,
      operationsByUser: {} as Record<string, number>
    };

    for (const event of events) {
      // Count by operation type
      stats.operationsByType[event.operation] = (stats.operationsByType[event.operation] || 0) + 1;
      
      // Count by user
      stats.operationsByUser[event.userId] = (stats.operationsByUser[event.userId] || 0) + 1;
    }

    return stats;
  }

  private async writeAuditLog(event: TemplateAuditEvent): Promise<void> {
    const logLine = JSON.stringify(event) + '\n';
    await fs.appendFile(this.auditLogPath, logLine, 'utf-8');
  }

  private matchesQuery(event: TemplateAuditEvent, query: TemplateAuditQuery): boolean {
    if (query.userId && event.userId !== query.userId) return false;
    if (query.operation && event.operation !== query.operation) return false;
    if (query.templateId && event.templateId !== query.templateId) return false;
    if (query.success !== undefined && event.success !== query.success) return false;
    
    const eventTime = new Date(event.timestamp).getTime();
    if (query.startDate && eventTime < query.startDate.getTime()) return false;
    if (query.endDate && eventTime > query.endDate.getTime()) return false;
    
    return true;
  }

  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async rotateLogsIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.auditLogPath);
      
      if (stats.size > this.maxLogSize) {
        await this.rotateLogs();
      }
    } catch (error) {
      // File doesn't exist yet, no rotation needed
    }
  }

  private async rotateLogs(): Promise<void> {
    try {
      // Move current log to timestamped backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${this.auditLogPath}.${timestamp}`;
      
      await fs.rename(this.auditLogPath, backupPath);
      
      // Clean up old log files
      await this.cleanupOldLogs();
      
      console.log(`Template audit log rotated to: ${backupPath}`);
    } catch (error) {
      console.error('Failed to rotate audit logs:', error);
    }
  }

  private async cleanupOldLogs(): Promise<void> {
    try {
      const logDir = path.dirname(this.auditLogPath);
      const logBaseName = path.basename(this.auditLogPath);
      
      const files = await fs.readdir(logDir);
      const logFiles = files
        .filter(file => file.startsWith(logBaseName) && file !== logBaseName)
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          stat: null as any
        }));

      // Get file stats for sorting by creation time
      for (const logFile of logFiles) {
        try {
          logFile.stat = await fs.stat(logFile.path);
        } catch (error) {
          // Skip files we can't stat
        }
      }

      // Sort by creation time (oldest first) and remove excess files
      const validLogFiles = logFiles.filter(f => f.stat);
      validLogFiles.sort((a, b) => a.stat.ctime.getTime() - b.stat.ctime.getTime());

      if (validLogFiles.length > this.maxLogFiles) {
        const filesToDelete = validLogFiles.slice(0, validLogFiles.length - this.maxLogFiles);
        
        for (const fileToDelete of filesToDelete) {
          try {
            await fs.unlink(fileToDelete.path);
            console.log(`Deleted old audit log: ${fileToDelete.name}`);
          } catch (error) {
            console.error(`Failed to delete old audit log ${fileToDelete.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error);
    }
  }
}

// Singleton instance for application use
export const templateAuditService = new TemplateAuditService();