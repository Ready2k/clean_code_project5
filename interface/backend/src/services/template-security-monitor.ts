import { EventEmitter } from 'events';
import { templateAuditService } from './template-audit.js';
import { SecurityViolationType } from './template-security.js';

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: SecurityAlertType;
  message: string;
  userId?: string;
  templateId?: string;
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export enum SecurityAlertType {
  MULTIPLE_FAILED_VALIDATIONS = 'MULTIPLE_FAILED_VALIDATIONS',
  SUSPICIOUS_TEMPLATE_USAGE = 'SUSPICIOUS_TEMPLATE_USAGE',
  REPEATED_SECURITY_VIOLATIONS = 'REPEATED_SECURITY_VIOLATIONS',
  UNUSUAL_ACCESS_PATTERN = 'UNUSUAL_ACCESS_PATTERN',
  TEMPLATE_INJECTION_ATTEMPT = 'TEMPLATE_INJECTION_ATTEMPT',
  PRIVILEGE_ESCALATION_ATTEMPT = 'PRIVILEGE_ESCALATION_ATTEMPT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

export interface SecurityThreshold {
  type: SecurityAlertType;
  count: number;
  timeWindowMs: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class TemplateSecurityMonitor extends EventEmitter {
  private alerts: Map<string, SecurityAlert> = new Map();
  private userViolationCounts: Map<string, { count: number; lastViolation: Date }> = new Map();
  private templateViolationCounts: Map<string, { count: number; lastViolation: Date }> = new Map();
  
  private readonly thresholds: SecurityThreshold[] = [
    {
      type: SecurityAlertType.MULTIPLE_FAILED_VALIDATIONS,
      count: 5,
      timeWindowMs: 5 * 60 * 1000, // 5 minutes
      severity: 'MEDIUM'
    },
    {
      type: SecurityAlertType.REPEATED_SECURITY_VIOLATIONS,
      count: 3,
      timeWindowMs: 10 * 60 * 1000, // 10 minutes
      severity: 'HIGH'
    },
    {
      type: SecurityAlertType.TEMPLATE_INJECTION_ATTEMPT,
      count: 1,
      timeWindowMs: 60 * 1000, // 1 minute
      severity: 'CRITICAL'
    },
    {
      type: SecurityAlertType.RATE_LIMIT_EXCEEDED,
      count: 10,
      timeWindowMs: 60 * 1000, // 1 minute
      severity: 'MEDIUM'
    }
  ];

  constructor() {
    super();
    this.startCleanupTimer();
  }

  /**
   * Record a security violation and check for alert conditions
   */
  async recordSecurityViolation(
    userId: string,
    templateId: string | undefined,
    violationType: SecurityViolationType,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    details: Record<string, any> = {}
  ): Promise<void> {
    const now = new Date();

    // Update user violation count
    const userViolations = this.userViolationCounts.get(userId) || { count: 0, lastViolation: new Date(0) };
    userViolations.count++;
    userViolations.lastViolation = now;
    this.userViolationCounts.set(userId, userViolations);

    // Update template violation count if template is specified
    if (templateId) {
      const templateViolations = this.templateViolationCounts.get(templateId) || { count: 0, lastViolation: new Date(0) };
      templateViolations.count++;
      templateViolations.lastViolation = now;
      this.templateViolationCounts.set(templateId, templateViolations);
    }

    // Check for alert conditions
    await this.checkAlertConditions(userId, templateId, violationType, severity, details);

    // Log the violation
    await templateAuditService.logOperation({
      userId,
      userRole: 'unknown',
      operation: 'SECURITY_VIOLATION_RECORDED',
      templateId,
      details: {
        violationType,
        severity,
        ...details
      },
      success: false,
      errorMessage: `Security violation: ${violationType}`
    });
  }

  /**
   * Record suspicious template usage
   */
  async recordSuspiciousUsage(
    userId: string,
    templateId: string,
    suspiciousPatterns: string[],
    context: Record<string, any> = {}
  ): Promise<void> {
    await this.createAlert({
      type: SecurityAlertType.SUSPICIOUS_TEMPLATE_USAGE,
      severity: 'HIGH',
      message: `Suspicious template usage detected: ${suspiciousPatterns.join(', ')}`,
      userId,
      templateId,
      details: {
        suspiciousPatterns,
        context: this.sanitizeContext(context)
      }
    });
  }

  /**
   * Record unusual access patterns
   */
  async recordUnusualAccess(
    userId: string,
    pattern: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.createAlert({
      type: SecurityAlertType.UNUSUAL_ACCESS_PATTERN,
      severity: 'MEDIUM',
      message: `Unusual access pattern detected: ${pattern}`,
      userId,
      details
    });
  }

  /**
   * Record rate limit violations
   */
  async recordRateLimitViolation(
    userId: string,
    endpoint: string,
    requestCount: number,
    timeWindow: number
  ): Promise<void> {
    await this.createAlert({
      type: SecurityAlertType.RATE_LIMIT_EXCEEDED,
      severity: 'MEDIUM',
      message: `Rate limit exceeded: ${requestCount} requests in ${timeWindow}ms`,
      userId,
      details: {
        endpoint,
        requestCount,
        timeWindow
      }
    });
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get alerts for a specific user
   */
  getUserAlerts(userId: string): SecurityAlert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.userId === userId);
  }

  /**
   * Get alerts for a specific template
   */
  getTemplateAlerts(templateId: string): SecurityAlert[] {
    return Array.from(this.alerts.values()).filter(alert => alert.templateId === templateId);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string, resolvedBy: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.resolved) {
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    // Log alert resolution
    await templateAuditService.logOperation({
      userId: resolvedBy,
      userRole: 'admin',
      operation: 'SECURITY_ALERT_RESOLVED',
      details: {
        alertId,
        alertType: alert.type,
        originalSeverity: alert.severity
      },
      success: true
    });

    this.emit('alertResolved', alert);
    return true;
  }

  /**
   * Get security statistics
   */
  getSecurityStatistics(): {
    totalAlerts: number;
    activeAlerts: number;
    alertsBySeverity: Record<string, number>;
    alertsByType: Record<string, number>;
    topViolatingUsers: Array<{ userId: string; violationCount: number }>;
    topViolatingTemplates: Array<{ templateId: string; violationCount: number }>;
  } {
    const alerts = Array.from(this.alerts.values());
    
    const alertsBySeverity: Record<string, number> = {};
    const alertsByType: Record<string, number> = {};
    
    for (const alert of alerts) {
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
    }

    const topViolatingUsers = Array.from(this.userViolationCounts.entries())
      .map(([userId, data]) => ({ userId, violationCount: data.count }))
      .sort((a, b) => b.violationCount - a.violationCount)
      .slice(0, 10);

    const topViolatingTemplates = Array.from(this.templateViolationCounts.entries())
      .map(([templateId, data]) => ({ templateId, violationCount: data.count }))
      .sort((a, b) => b.violationCount - a.violationCount)
      .slice(0, 10);

    return {
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter(a => !a.resolved).length,
      alertsBySeverity,
      alertsByType,
      topViolatingUsers,
      topViolatingTemplates
    };
  }

  private async checkAlertConditions(
    userId: string,
    templateId: string | undefined,
    violationType: SecurityViolationType,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    details: Record<string, any>
  ): Promise<void> {
    const now = new Date();

    // Check for critical violations that should trigger immediate alerts
    if (severity === 'CRITICAL' || violationType === SecurityViolationType.CODE_INJECTION) {
      await this.createAlert({
        type: SecurityAlertType.TEMPLATE_INJECTION_ATTEMPT,
        severity: 'CRITICAL',
        message: `Critical security violation: ${violationType}`,
        userId,
        templateId,
        details: { violationType, ...details }
      });
      return;
    }

    // Check user violation thresholds
    const userViolations = this.userViolationCounts.get(userId);
    if (userViolations) {
      const timeWindow = 10 * 60 * 1000; // 10 minutes
      if (now.getTime() - userViolations.lastViolation.getTime() < timeWindow && userViolations.count >= 3) {
        await this.createAlert({
          type: SecurityAlertType.REPEATED_SECURITY_VIOLATIONS,
          severity: 'HIGH',
          message: `User has ${userViolations.count} security violations in the last 10 minutes`,
          userId,
          templateId,
          details: { violationCount: userViolations.count, violationType, ...details }
        });
      }
    }

    // Check template violation thresholds
    if (templateId) {
      const templateViolations = this.templateViolationCounts.get(templateId);
      if (templateViolations) {
        const timeWindow = 5 * 60 * 1000; // 5 minutes
        if (now.getTime() - templateViolations.lastViolation.getTime() < timeWindow && templateViolations.count >= 5) {
          await this.createAlert({
            type: SecurityAlertType.MULTIPLE_FAILED_VALIDATIONS,
            severity: 'MEDIUM',
            message: `Template has ${templateViolations.count} security violations in the last 5 minutes`,
            userId,
            templateId,
            details: { violationCount: templateViolations.count, violationType, ...details }
          });
        }
      }
    }
  }

  private async createAlert(alertData: {
    type: SecurityAlertType;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
    userId?: string;
    templateId?: string;
    details: Record<string, any>;
  }): Promise<SecurityAlert> {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      resolved: false,
      ...alertData
    };

    this.alerts.set(alert.id, alert);

    // Log alert creation
    await templateAuditService.logOperation({
      userId: alertData.userId || 'system',
      userRole: 'system',
      operation: 'SECURITY_ALERT_CREATED',
      templateId: alertData.templateId,
      details: {
        alertId: alert.id,
        alertType: alert.type,
        severity: alert.severity,
        message: alert.message
      },
      success: true
    });

    // Emit alert event for real-time notifications
    this.emit('securityAlert', alert);

    // Log to console for immediate visibility
    console.warn(`[SECURITY_ALERT][${alert.severity}] ${alert.message}`, {
      alertId: alert.id,
      userId: alert.userId,
      templateId: alert.templateId,
      type: alert.type
    });

    return alert;
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        // Truncate and sanitize sensitive data
        let sanitizedValue = value.substring(0, 100);
        sanitizedValue = sanitizedValue.replace(/password\s*[:=]\s*['"]\w+['"]/gi, 'password=***');
        sanitizedValue = sanitizedValue.replace(/api[_-]?key\s*[:=]\s*['"]\w+['"]/gi, 'api_key=***');
        sanitized[key] = sanitizedValue;
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = '[Object]';
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  private startCleanupTimer(): void {
    // Clean up old violation counts and resolved alerts every hour
    setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000); // 1 hour
  }

  private cleanupOldData(): void {
    const now = new Date();
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up old user violation counts
    for (const [userId, data] of this.userViolationCounts.entries()) {
      if (now.getTime() - data.lastViolation.getTime() > cleanupThreshold) {
        this.userViolationCounts.delete(userId);
      }
    }

    // Clean up old template violation counts
    for (const [templateId, data] of this.templateViolationCounts.entries()) {
      if (now.getTime() - data.lastViolation.getTime() > cleanupThreshold) {
        this.templateViolationCounts.delete(templateId);
      }
    }

    // Clean up old resolved alerts (keep for 7 days)
    const alertCleanupThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days
    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.resolvedAt && 
          now.getTime() - alert.resolvedAt.getTime() > alertCleanupThreshold) {
        this.alerts.delete(alertId);
      }
    }
  }
}

// Singleton instance for application use
export const templateSecurityMonitor = new TemplateSecurityMonitor();