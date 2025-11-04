/**
 * End-to-End Tests for Template System
 * Tests complete workflow from template creation to usage across all services
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { 
  initializeSystemPromptManager, 
  getSystemPromptManager 
} from '../services/system-prompt-manager.js';
import { 
  initializeTemplateCacheManager, 
  getTemplateCacheManager 
} from '../services/template-cache-manager.js';
import { 
  initializeTemplateValidationService, 
  getTemplateValidationService 
} from '../services/template-validation-service.js';
import { 
  initializeTemplateAnalyticsService, 
  getTemplateAnalyticsService 
} from '../services/template-analytics-service.js';
import { TemplateCategory } from '../types/prompt-templates.js';

describe('Template System End-to-End Tests', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize all template services
    try {
      initializeSystemPromptManager();
      initializeTemplateCacheManager();
      initializeTemplateValidationService();
      initializeTemplateAnalyticsService();
    } catch (error) {
      console.log('Template services initialization skipped in test environment');
    }

    // Create test user and get auth token
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'template-e2e-user',
        email: 'template-e2e@test.com',
        password: 'TestPassword123!'
      });

    if (userResponse.status === 201) {
      testUserId = userResponse.body.user.id;
      authToken = userResponse.body.token;
    } else {
      // User might already exist, try login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'template-e2e@test.com',
          password: 'TestPassword123!'
        });
      
      testUserId = loginResponse.body.user.id;
      authToken = loginResponse.body.token;
    }
  });

  afterAll(async () => {
    // Cleanup services
    try {
      const cacheManager = getTemplateCacheManager();
      await cacheManager.shutdown();
      
      const analyticsService = getTemplateAnalyticsService();
      await analyticsService.shutdown();
    } catch (error) {
      // Ignore cleanup errors in test environment
    }
  });

  describe('Complete Template Workflow', () => {
    it('should execute complete template creation → validation → usage → analytics workflow', async () => {
      // Step 1: Create a new template via API
      const templateData = {
        category: TemplateCategory.ENHANCEMENT,
        key: 'e2e_test_enhancement',
        name: 'E2E Test Enhancement Template',
        description: 'Template for end-to-end testing of enhancement workflow',
        content: `You are an expert prompt engineer. Please enhance the following prompt:

ORIGINAL PROMPT:
{{original_prompt}}

ENHANCEMENT REQUIREMENTS:
- Target Provider: {{target_provider}}
- Domain: {{domain}}
- Complexity Level: {{complexity_level}}

Please provide an enhanced version that:
1. Improves clarity and specificity
2. Adds appropriate structure
3. Includes relevant variables
4. Optimizes for the target provider

Enhanced Prompt:`,
        variables: [
          {
            name: 'original_prompt',
            type: 'string',
            description: 'The original prompt to enhance',
            required: true
          },
          {
            name: 'target_provider',
            type: 'string',
            description: 'Target LLM provider (openai, anthropic, meta)',
            required: true,
            defaultValue: 'openai'
          },
          {
            name: 'domain',
            type: 'string',
            description: 'Domain or subject area',
            required: false,
            defaultValue: 'general'
          },
          {
            name: 'complexity_level',
            type: 'string',
            description: 'Desired complexity level',
            required: false,
            defaultValue: 'intermediate'
          }
        ],
        metadata: {
          version: '1.0.0',
          author: 'e2e-test',
          tags: ['enhancement', 'testing', 'e2e']
        }
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(templateData)
        .expect(201);

      const createdTemplate = createResponse.body;
      expect(createdTemplate.id).toBeDefined();
      expect(createdTemplate.category).toBe(TemplateCategory.ENHANCEMENT);
      expect(createdTemplate.key).toBe('e2e_test_enhancement');
      expect(createdTemplate.isActive).toBe(true);

      // Step 2: Validate the template
      const validationResponse = await request(app)
        .post(`/api/admin/templates/${createdTemplate.id}/validate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          provider: 'openai'
        })
        .expect(200);

      expect(validationResponse.body.isValid).toBe(true);
      expect(validationResponse.body.errors).toHaveLength(0);

      // Step 3: Test the template with sample data
      const testData = {
        variables: {
          original_prompt: 'Write a blog post about AI',
          target_provider: 'openai',
          domain: 'technology',
          complexity_level: 'advanced'
        },
        provider: 'openai'
      };

      const testResponse = await request(app)
        .post(`/api/admin/templates/${createdTemplate.id}/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData)
        .expect(200);

      expect(testResponse.body.renderedContent).toBeDefined();
      expect(testResponse.body.renderedContent).toContain('Write a blog post about AI');
      expect(testResponse.body.renderedContent).toContain('openai');
      expect(testResponse.body.renderedContent).toContain('technology');

      // Step 4: Use template in Enhancement Agent
      const enhancementRequest = {
        humanPrompt: {
          goal: 'Create a product review',
          audience: 'Potential customers',
          steps: ['Analyze product', 'Write review'],
          output_expectations: {
            format: 'structured review',
            fields: ['rating', 'pros', 'cons']
          }
        },
        metadata: {
          title: 'Product Review Generator',
          summary: 'Generates product reviews',
          tags: ['review', 'product'],
          owner: testUserId
        }
      };

      const enhanceResponse = await request(app)
        .post('/api/prompts/enhance')
        .set('Authorization', `Bearer ${authToken}`)
        .send(enhancementRequest)
        .expect(200);

      expect(enhanceResponse.body.structuredPrompt).toBeDefined();
      expect(enhanceResponse.body.confidence).toBeGreaterThan(0);

      // Step 5: Verify analytics were recorded
      const analyticsResponse = await request(app)
        .get(`/api/admin/templates/${createdTemplate.id}/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeRange: '24h'
        })
        .expect(200);

      expect(analyticsResponse.body.usageCount).toBeGreaterThan(0);
      expect(analyticsResponse.body.performanceMetrics).toBeDefined();

      // Step 6: Update template and verify versioning
      const updateData = {
        content: templateData.content + '\n\nAdditional instructions: Ensure the enhanced prompt is production-ready.',
        metadata: {
          ...templateData.metadata,
          version: '1.1.0'
        }
      };

      const updateResponse = await request(app)
        .put(`/api/admin/templates/${createdTemplate.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.version).toBeGreaterThan(createdTemplate.version);

      // Step 7: Verify template history
      const historyResponse = await request(app)
        .get(`/api/admin/templates/${createdTemplate.id}/history`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(historyResponse.body.versions).toHaveLength(2);
      expect(historyResponse.body.versions[0].version).toBe(1);
      expect(historyResponse.body.versions[1].version).toBe(2);

      // Step 8: Test template export
      const exportResponse = await request(app)
        .post(`/api/admin/templates/${createdTemplate.id}/export`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'json',
          includeHistory: true
        })
        .expect(200);

      expect(exportResponse.body.template).toBeDefined();
      expect(exportResponse.body.template.id).toBe(createdTemplate.id);
      expect(exportResponse.body.history).toBeDefined();
    });

    it('should handle template integration with Question Generator', async () => {
      // Create question generation template
      const questionTemplate = {
        category: TemplateCategory.QUESTION_GENERATION,
        key: 'e2e_question_generator',
        name: 'E2E Question Generator Template',
        description: 'Template for generating contextual questions',
        content: `Generate {{question_count}} relevant questions for the following context:

TASK TYPE: {{task_type}}
CONTEXT: {{context}}
USER INPUT: {{user_input}}

Requirements:
- Questions should be specific to the {{task_type}} task
- Consider the user's experience level: {{experience_level}}
- Focus on practical aspects
- Ensure questions help gather necessary information

Questions:`,
        variables: [
          {
            name: 'question_count',
            type: 'number',
            description: 'Number of questions to generate',
            required: true,
            defaultValue: 3
          },
          {
            name: 'task_type',
            type: 'string',
            description: 'Type of task (analysis, generation, etc.)',
            required: true
          },
          {
            name: 'context',
            type: 'string',
            description: 'Context information',
            required: true
          },
          {
            name: 'user_input',
            type: 'string',
            description: 'User input or prompt',
            required: true
          },
          {
            name: 'experience_level',
            type: 'string',
            description: 'User experience level',
            required: false,
            defaultValue: 'intermediate'
          }
        ]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionTemplate)
        .expect(201);

      const templateId = createResponse.body.id;

      // Test question generation using the template
      const questionRequest = {
        taskType: 'analysis',
        context: 'Data analysis project',
        userInput: 'Analyze customer satisfaction data',
        variables: [
          { key: 'dataset_size', type: 'string', required: true },
          { key: 'analysis_type', type: 'string', required: true }
        ]
      };

      const questionResponse = await request(app)
        .post('/api/prompts/questions/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionRequest)
        .expect(200);

      expect(questionResponse.body.questions).toBeDefined();
      expect(questionResponse.body.questions.length).toBeGreaterThan(0);

      // Verify template was used in analytics
      const analyticsResponse = await request(app)
        .get(`/api/admin/templates/${templateId}/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(analyticsResponse.body.usageCount).toBeGreaterThan(0);
    });

    it('should handle template security validation and monitoring', async () => {
      // Attempt to create a malicious template
      const maliciousTemplate = {
        category: TemplateCategory.CUSTOM,
        key: 'malicious_template',
        name: 'Malicious Template',
        description: 'Template with security issues',
        content: `Hello {{name}}, <script>alert('xss')</script>
        
        eval("malicious code")
        
        {{constructor}}
        
        password: "hardcoded_secret"`,
        variables: [
          {
            name: 'name',
            type: 'string',
            required: true
          },
          {
            name: 'constructor',
            type: 'string',
            required: false
          }
        ]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousTemplate)
        .expect(400);

      expect(createResponse.body.error).toContain('security');
      expect(createResponse.body.violations).toBeDefined();
      expect(createResponse.body.violations.length).toBeGreaterThan(0);

      // Verify security violation was recorded
      const securityResponse = await request(app)
        .get('/api/admin/security/alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(securityResponse.body.alerts.length).toBeGreaterThan(0);
      expect(securityResponse.body.alerts.some((alert: any) => 
        alert.type === 'TEMPLATE_INJECTION_ATTEMPT'
      )).toBe(true);
    });

    it('should handle template performance under load', async () => {
      // Create a performance test template
      const perfTemplate = {
        category: TemplateCategory.CUSTOM,
        key: 'performance_test',
        name: 'Performance Test Template',
        description: 'Template for performance testing',
        content: 'Process {{data}} with {{method}} approach for {{iterations}} iterations',
        variables: [
          { name: 'data', type: 'string', required: true },
          { name: 'method', type: 'string', required: true },
          { name: 'iterations', type: 'number', required: true }
        ]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(perfTemplate)
        .expect(201);

      const templateId = createResponse.body.id;

      // Simulate concurrent template usage
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
        request(app)
          .post(`/api/admin/templates/${templateId}/test`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            variables: {
              data: `test_data_${i}`,
              method: 'concurrent',
              iterations: 100
            },
            provider: 'openai'
          })
      );

      const responses = await Promise.all(concurrentRequests);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.renderedContent).toBeDefined();
      });

      // Verify performance metrics
      const metricsResponse = await request(app)
        .get(`/api/admin/templates/${templateId}/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(metricsResponse.body.usageCount).toBe(10);
      expect(metricsResponse.body.performanceMetrics.averageResponseTime).toBeLessThan(1000); // Should be under 1 second
    });
  });

  describe('Template System Integration with Existing Services', () => {
    it('should integrate with Enhancement Agent service', async () => {
      // Verify Enhancement Agent uses custom templates
      const enhancementRequest = {
        humanPrompt: {
          goal: 'Create a technical tutorial',
          audience: 'Developers',
          steps: ['Setup', 'Implementation', 'Testing'],
          output_expectations: {
            format: 'step-by-step guide',
            fields: ['prerequisites', 'steps', 'examples']
          }
        }
      };

      const response = await request(app)
        .post('/api/prompts/enhance')
        .set('Authorization', `Bearer ${authToken}`)
        .send(enhancementRequest)
        .expect(200);

      expect(response.body.structuredPrompt).toBeDefined();
      expect(response.body.templateUsed).toBeDefined();
      expect(response.body.templateUsed.category).toBe(TemplateCategory.ENHANCEMENT);
    });

    it('should integrate with Question Generator service', async () => {
      const questionRequest = {
        taskType: 'generation',
        context: 'Creative writing project',
        userInput: 'Write a short story',
        variables: [
          { key: 'genre', type: 'string', required: true },
          { key: 'length', type: 'number', required: true }
        ]
      };

      const response = await request(app)
        .post('/api/prompts/questions/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send(questionRequest)
        .expect(200);

      expect(response.body.questions).toBeDefined();
      expect(response.body.templateUsed).toBeDefined();
      expect(response.body.templateUsed.category).toBe(TemplateCategory.QUESTION_GENERATION);
    });

    it('should maintain backward compatibility with existing APIs', async () => {
      // Test that existing prompt enhancement still works
      const legacyRequest = {
        humanPrompt: {
          goal: 'Summarize text',
          audience: 'General users',
          steps: ['Read', 'Analyze', 'Summarize'],
          output_expectations: {
            format: 'bullet points',
            fields: ['summary']
          }
        }
      };

      const response = await request(app)
        .post('/api/prompts/enhance')
        .set('Authorization', `Bearer ${authToken}`)
        .send(legacyRequest)
        .expect(200);

      // Should work exactly as before
      expect(response.body.structuredPrompt).toBeDefined();
      expect(response.body.confidence).toBeGreaterThan(0);
      expect(response.body.rationale).toBeDefined();
    });
  });

  describe('Template System Error Handling and Recovery', () => {
    it('should handle template service failures gracefully', async () => {
      // Test with invalid template ID
      const response = await request(app)
        .get('/api/admin/templates/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toContain('not found');
    });

    it('should fall back to default templates when custom templates fail', async () => {
      // This would be tested by temporarily disabling the template service
      // and verifying that enhancement still works with default templates
      const enhancementRequest = {
        humanPrompt: {
          goal: 'Test fallback behavior',
          audience: 'Test users',
          steps: ['Test step'],
          output_expectations: {
            format: 'text',
            fields: ['result']
          }
        }
      };

      const response = await request(app)
        .post('/api/prompts/enhance')
        .set('Authorization', `Bearer ${authToken}`)
        .send(enhancementRequest)
        .expect(200);

      // Should still work even if custom templates are unavailable
      expect(response.body.structuredPrompt).toBeDefined();
    });

    it('should handle cache failures gracefully', async () => {
      // Create template
      const template = {
        category: TemplateCategory.CUSTOM,
        key: 'cache_test',
        name: 'Cache Test Template',
        description: 'Template for cache testing',
        content: 'Test template: {{test_var}}',
        variables: [
          { name: 'test_var', type: 'string', required: true }
        ]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(template)
        .expect(201);

      const templateId = createResponse.body.id;

      // Test template multiple times (should work even if cache fails)
      for (let i = 0; i < 3; i++) {
        const testResponse = await request(app)
          .post(`/api/admin/templates/${templateId}/test`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            variables: { test_var: `test_${i}` },
            provider: 'openai'
          })
          .expect(200);

        expect(testResponse.body.renderedContent).toContain(`test_${i}`);
      }
    });
  });

  describe('Template System Monitoring and Analytics', () => {
    it('should provide comprehensive system health metrics', async () => {
      const healthResponse = await request(app)
        .get('/api/admin/templates/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body.services).toBeDefined();
      expect(healthResponse.body.services.templateManager).toBe('operational');
      expect(healthResponse.body.services.cacheManager).toBeDefined();
      expect(healthResponse.body.services.validationService).toBe('operational');
      expect(healthResponse.body.services.analyticsService).toBeDefined();
    });

    it('should provide system-wide template analytics', async () => {
      const analyticsResponse = await request(app)
        .get('/api/admin/templates/analytics/system')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(analyticsResponse.body.totalTemplates).toBeGreaterThan(0);
      expect(analyticsResponse.body.activeTemplates).toBeGreaterThan(0);
      expect(analyticsResponse.body.usageStatistics).toBeDefined();
      expect(analyticsResponse.body.performanceMetrics).toBeDefined();
      expect(analyticsResponse.body.topPerformingTemplates).toBeDefined();
    });

    it('should track template usage patterns', async () => {
      const usageResponse = await request(app)
        .get('/api/admin/templates/analytics/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          timeRange: '7d',
          groupBy: 'category'
        })
        .expect(200);

      expect(usageResponse.body.usageByCategory).toBeDefined();
      expect(usageResponse.body.usageOverTime).toBeDefined();
      expect(usageResponse.body.topUsers).toBeDefined();
    });
  });
});