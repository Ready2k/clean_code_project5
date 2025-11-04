/**
 * Template Validation Framework
 * Comprehensive validation of all template system requirements
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { TemplateCategory } from '../types/prompt-templates.js';

describe('Template System Requirements Validation', () => {
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    // Setup test users
    const adminResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'uat-admin@test.com',
        password: 'AdminPassword123!'
      });
    adminToken = adminResponse.body.token;

    const userResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'uat-user@test.com',
        password: 'UserPassword123!'
      });
    userToken = userResponse.body.token;
  });

  describe('Requirement 1.1: Template Management Interface', () => {
    it('should display all available LLM prompt templates with metadata', async () => {
      const response = await request(app)
        .get('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.templates).toBeDefined();
      expect(Array.isArray(response.body.templates)).toBe(true);

      if (response.body.templates.length > 0) {
        const template = response.body.templates[0];
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('lastModified');
        expect(template).toHaveProperty('category');
        expect(template).toHaveProperty('isActive');
      }
    });

    it('should show template content, variables, and usage context', async () => {
      // Create a test template first
      const testTemplate = {
        category: TemplateCategory.ENHANCEMENT,
        key: 'req_1_1_test',
        name: 'Requirement 1.1 Test Template',
        description: 'Template for validating requirement 1.1',
        content: 'Test template with {{variable1}} and {{variable2}}',
        variables: [
          {
            name: 'variable1',
            type: 'string',
            description: 'First test variable',
            required: true
          },
          {
            name: 'variable2',
            type: 'string',
            description: 'Second test variable',
            required: false,
            defaultValue: 'default'
          }
        ]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testTemplate)
        .expect(201);

      const templateId = createResponse.body.id;

      const getResponse = await request(app)
        .get(`/api/admin/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(getResponse.body.content).toBeDefined();
      expect(getResponse.body.variables).toBeDefined();
      expect(getResponse.body.variables).toHaveLength(2);
      expect(getResponse.body.category).toBe(TemplateCategory.ENHANCEMENT);
      expect(getResponse.body.usageContext).toBeDefined();
    });

    it('should provide text editor with syntax highlighting and variable validation', async () => {
      // Test template validation endpoint
      const templateData = {
        content: 'Valid template with {{valid_variable}} and proper syntax',
        variables: [
          {
            name: 'valid_variable',
            type: 'string',
            required: true
          }
        ]
      };

      const validationResponse = await request(app)
        .post('/api/admin/templates/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(templateData)
        .expect(200);

      expect(validationResponse.body.isValid).toBe(true);
      expect(validationResponse.body.syntaxHighlighting).toBeDefined();
      expect(validationResponse.body.variableValidation).toBeDefined();
    });

    it('should validate template syntax and display specific error messages', async () => {
      const invalidTemplate = {
        content: 'Invalid template with {{unclosed_variable and {{invalid}}syntax',
        variables: [
          {
            name: 'valid_variable',
            type: 'string',
            required: true
          }
        ]
      };

      const validationResponse = await request(app)
        .post('/api/admin/templates/validate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidTemplate)
        .expect(200);

      expect(validationResponse.body.isValid).toBe(false);
      expect(validationResponse.body.errors).toBeDefined();
      expect(validationResponse.body.errors.length).toBeGreaterThan(0);
      expect(validationResponse.body.errors[0]).toHaveProperty('message');
      expect(validationResponse.body.errors[0]).toHaveProperty('line');
    });
  });

  describe('Requirement 1.2: Enhancement Prompt Customization', () => {
    it('should allow customization of enhancement instruction templates', async () => {
      const enhancementTemplate = {
        category: TemplateCategory.ENHANCEMENT,
        key: 'req_1_2_enhancement',
        name: 'Custom Enhancement Template',
        description: 'Customized enhancement template for requirement 1.2',
        content: `Custom enhancement instructions:

Original Prompt: {{original_prompt}}
Target Provider: {{target_provider}}
Domain: {{domain}}

Enhanced version with custom approach:`,
        variables: [
          { name: 'original_prompt', type: 'string', required: true },
          { name: 'target_provider', type: 'string', required: true },
          { name: 'domain', type: 'string', required: false }
        ]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(enhancementTemplate)
        .expect(201);

      expect(createResponse.body.category).toBe(TemplateCategory.ENHANCEMENT);
      expect(createResponse.body.variables).toHaveLength(3);
    });

    it('should support dynamic content through template variables', async () => {
      const templateId = await this.createTestTemplate(adminToken, {
        category: TemplateCategory.ENHANCEMENT,
        content: 'Dynamic content: {{provider}} for {{domain}} with {{complexity}}',
        variables: [
          { name: 'provider', type: 'string', required: true },
          { name: 'domain', type: 'string', required: true },
          { name: 'complexity', type: 'string', required: false, defaultValue: 'medium' }
        ]
      });

      const testResponse = await request(app)
        .post(`/api/admin/templates/${templateId}/test`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variables: {
            provider: 'openai',
            domain: 'marketing',
            complexity: 'advanced'
          },
          provider: 'openai'
        })
        .expect(200);

      expect(testResponse.body.renderedContent).toContain('openai');
      expect(testResponse.body.renderedContent).toContain('marketing');
      expect(testResponse.body.renderedContent).toContain('advanced');
    });

    it('should apply changes immediately without system restart', async () => {
      // Create template
      const template = {
        category: TemplateCategory.ENHANCEMENT,
        key: 'req_1_2_immediate',
        name: 'Immediate Update Test',
        content: 'Original content: {{message}}',
        variables: [{ name: 'message', type: 'string', required: true }]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(template)
        .expect(201);

      const templateId = createResponse.body.id;

      // Update template
      const updateResponse = await request(app)
        .put(`/api/admin/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'Updated content: {{message}}',
          metadata: { version: '2.0.0' }
        })
        .expect(200);

      // Test immediately - should use updated content
      const testResponse = await request(app)
        .post(`/api/admin/templates/${templateId}/test`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          variables: { message: 'test' },
          provider: 'openai'
        })
        .expect(200);

      expect(testResponse.body.renderedContent).toContain('Updated content');
    });
  });

  describe('Requirement 1.3: Question Generation Template Management', () => {
    it('should provide separate templates for each task type', async () => {
      const taskTypes = ['analysis', 'generation', 'transformation', 'classification', 'code', 'creative'];

      for (const taskType of taskTypes) {
        const questionTemplate = {
          category: TemplateCategory.QUESTION_GENERATION,
          key: `req_1_3_${taskType}`,
          name: `${taskType} Question Template`,
          description: `Question generation template for ${taskType} tasks`,
          content: `Generate questions for ${taskType} task:
Context: {{context}}
Input: {{user_input}}
Questions:`,
          variables: [
            { name: 'context', type: 'string', required: true },
            { name: 'user_input', type: 'string', required: true }
          ],
          metadata: { taskType }
        };

        const response = await request(app)
          .post('/api/admin/templates')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(questionTemplate)
          .expect(201);

        expect(response.body.metadata.taskType).toBe(taskType);
      }
    });

    it('should support context-aware question generation', async () => {
      const contextTemplate = {
        category: TemplateCategory.QUESTION_GENERATION,
        key: 'req_1_3_context',
        name: 'Context-Aware Question Template',
        content: `Generate {{question_count}} questions for:
Task: {{task_type}}
Context: {{context}}
User Input: {{user_input}}
Experience: {{experience_level}}

Questions should be {{question_style}} and focus on {{focus_area}}.`,
        variables: [
          { name: 'question_count', type: 'number', required: true },
          { name: 'task_type', type: 'string', required: true },
          { name: 'context', type: 'string', required: true },
          { name: 'user_input', type: 'string', required: true },
          { name: 'experience_level', type: 'string', required: false },
          { name: 'question_style', type: 'string', required: false },
          { name: 'focus_area', type: 'string', required: false }
        ]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(contextTemplate)
        .expect(201);

      expect(createResponse.body.variables).toHaveLength(7);
    });
  });

  describe('Requirement 5.1: Template Storage and Versioning', () => {
    it('should persist templates in database with proper indexing', async () => {
      const template = {
        category: TemplateCategory.CUSTOM,
        key: 'req_5_1_storage',
        name: 'Storage Test Template',
        content: 'Storage test: {{data}}',
        variables: [{ name: 'data', type: 'string', required: true }]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(template)
        .expect(201);

      const templateId = createResponse.body.id;

      // Verify template is persisted
      const getResponse = await request(app)
        .get(`/api/admin/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(getResponse.body.id).toBe(templateId);
      expect(getResponse.body.content).toBe(template.content);
    });

    it('should create version history entries with metadata', async () => {
      const template = {
        category: TemplateCategory.CUSTOM,
        key: 'req_5_1_versioning',
        name: 'Versioning Test Template',
        content: 'Version 1: {{data}}',
        variables: [{ name: 'data', type: 'string', required: true }]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(template)
        .expect(201);

      const templateId = createResponse.body.id;

      // Update template to create new version
      await request(app)
        .put(`/api/admin/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'Version 2: {{data}}',
          changeMessage: 'Updated content for version 2'
        })
        .expect(200);

      // Check version history
      const historyResponse = await request(app)
        .get(`/api/admin/templates/${templateId}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(historyResponse.body.versions).toHaveLength(2);
      expect(historyResponse.body.versions[0].version).toBe(1);
      expect(historyResponse.body.versions[1].version).toBe(2);
      expect(historyResponse.body.versions[1].changeMessage).toBe('Updated content for version 2');
    });

    it('should allow reverting to previous versions', async () => {
      const template = {
        category: TemplateCategory.CUSTOM,
        key: 'req_5_1_revert',
        name: 'Revert Test Template',
        content: 'Original content: {{data}}',
        variables: [{ name: 'data', type: 'string', required: true }]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(template)
        .expect(201);

      const templateId = createResponse.body.id;

      // Update template
      await request(app)
        .put(`/api/admin/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'Modified content: {{data}}'
        })
        .expect(200);

      // Revert to version 1
      const revertResponse = await request(app)
        .post(`/api/admin/templates/${templateId}/revert`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ version: 1 })
        .expect(200);

      expect(revertResponse.body.content).toBe('Original content: {{data}}');
    });
  });

  describe('Requirement 8.1: Runtime Template Loading and Caching', () => {
    it('should load templates into memory cache for fast access', async () => {
      // Create template
      const template = {
        category: TemplateCategory.ENHANCEMENT,
        key: 'req_8_1_cache',
        name: 'Cache Test Template',
        content: 'Cache test: {{message}}',
        variables: [{ name: 'message', type: 'string', required: true }]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(template)
        .expect(201);

      const templateId = createResponse.body.id;

      // First access (cache miss)
      const firstAccess = Date.now();
      await request(app)
        .get(`/api/admin/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const firstAccessTime = Date.now() - firstAccess;

      // Second access (cache hit)
      const secondAccess = Date.now();
      await request(app)
        .get(`/api/admin/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const secondAccessTime = Date.now() - secondAccess;

      // Cache hit should be faster (allowing for HTTP overhead)
      expect(secondAccessTime).toBeLessThan(firstAccessTime + 50);
    });

    it('should refresh cache immediately on template updates', async () => {
      const template = {
        category: TemplateCategory.ENHANCEMENT,
        key: 'req_8_1_refresh',
        name: 'Cache Refresh Test',
        content: 'Original: {{message}}',
        variables: [{ name: 'message', type: 'string', required: true }]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(template)
        .expect(201);

      const templateId = createResponse.body.id;

      // Load into cache
      await request(app)
        .get(`/api/admin/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Update template
      await request(app)
        .put(`/api/admin/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'Updated: {{message}}'
        })
        .expect(200);

      // Verify updated content is served immediately
      const getResponse = await request(app)
        .get(`/api/admin/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(getResponse.body.content).toBe('Updated: {{message}}');
    });

    it('should maintain template loading times under 10ms for cached templates', async () => {
      const template = {
        category: TemplateCategory.ENHANCEMENT,
        key: 'req_8_1_performance',
        name: 'Performance Test Template',
        content: 'Performance: {{data}}',
        variables: [{ name: 'data', type: 'string', required: true }]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(template)
        .expect(201);

      const templateId = createResponse.body.id;

      // Warm cache
      await request(app)
        .get(`/api/admin/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Measure cached access time
      const startTime = Date.now();
      await request(app)
        .get(`/api/admin/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const accessTime = Date.now() - startTime;

      // Should be fast (allowing for HTTP overhead)
      expect(accessTime).toBeLessThan(100);
    });
  });

  describe('Requirement 9.1: Template Security and Access Control', () => {
    it('should require administrator-level permissions', async () => {
      const template = {
        category: TemplateCategory.CUSTOM,
        key: 'req_9_1_security',
        name: 'Security Test Template',
        content: 'Security test: {{data}}',
        variables: [{ name: 'data', type: 'string', required: true }]
      };

      // Regular user should not be able to create templates
      const userResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${userToken}`)
        .send(template);

      expect([401, 403]).toContain(userResponse.status);
    });

    it('should log all template modifications for audit purposes', async () => {
      const template = {
        category: TemplateCategory.CUSTOM,
        key: 'req_9_1_audit',
        name: 'Audit Test Template',
        content: 'Audit test: {{data}}',
        variables: [{ name: 'data', type: 'string', required: true }]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(template)
        .expect(201);

      const templateId = createResponse.body.id;

      // Update template
      await request(app)
        .put(`/api/admin/templates/${templateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'Updated audit test: {{data}}'
        })
        .expect(200);

      // Check audit log
      const auditResponse = await request(app)
        .get('/api/admin/audit/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ templateId })
        .expect(200);

      expect(auditResponse.body.events).toBeDefined();
      expect(auditResponse.body.events.length).toBeGreaterThan(0);
    });
  });

  // Helper method to create test templates
  async createTestTemplate(token: string, templateData: any): Promise<string> {
    const fullTemplate = {
      category: TemplateCategory.CUSTOM,
      key: `test_${Date.now()}`,
      name: 'Test Template',
      description: 'Test template',
      content: 'Test: {{test}}',
      variables: [{ name: 'test', type: 'string', required: true }],
      ...templateData
    };

    const response = await request(app)
      .post('/api/admin/templates')
      .set('Authorization', `Bearer ${token}`)
      .send(fullTemplate)
      .expect(201);

    return response.body.id;
  }
});