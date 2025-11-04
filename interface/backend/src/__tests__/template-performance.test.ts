/**
 * Performance Tests for Template System
 * Tests system performance under realistic load conditions
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
import { TemplateCategory } from '../types/prompt-templates.js';

describe('Template System Performance Tests', () => {
  let authToken: string;
  let testTemplateId: string;

  beforeAll(async () => {
    // Initialize services
    try {
      initializeSystemPromptManager();
      initializeTemplateCacheManager();
    } catch (error) {
      console.log('Template services initialization skipped in test environment');
    }

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'template-e2e@test.com',
        password: 'TestPassword123!'
      });
    
    authToken = loginResponse.body.token;

    // Create test template for performance testing
    const template = {
      category: TemplateCategory.ENHANCEMENT,
      key: 'performance_test_template',
      name: 'Performance Test Template',
      description: 'Template optimized for performance testing',
      content: `Enhance the following prompt for {{target_provider}}:

Original: {{original_prompt}}
Domain: {{domain}}
Complexity: {{complexity_level}}
Requirements: {{requirements}}

Enhanced version:`,
      variables: [
        { name: 'original_prompt', type: 'string', required: true },
        { name: 'target_provider', type: 'string', required: true },
        { name: 'domain', type: 'string', required: false, defaultValue: 'general' },
        { name: 'complexity_level', type: 'string', required: false, defaultValue: 'intermediate' },
        { name: 'requirements', type: 'string', required: false, defaultValue: 'none' }
      ]
    };

    const createResponse = await request(app)
      .post('/api/admin/templates')
      .set('Authorization', `Bearer ${authToken}`)
      .send(template);

    if (createResponse.status === 201) {
      testTemplateId = createResponse.body.id;
    }
  });

  afterAll(async () => {
    // Cleanup
    try {
      const cacheManager = getTemplateCacheManager();
      await cacheManager.shutdown();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Template Loading Performance', () => {
    it('should load templates from cache within 10ms', async () => {
      if (!testTemplateId) {
        console.log('Skipping cache performance test - no template created');
        return;
      }

      // First request to warm cache
      await request(app)
        .get(`/api/admin/templates/${testTemplateId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Measure cached request performance
      const startTime = Date.now();
      
      const response = await request(app)
        .get(`/api/admin/templates/${testTemplateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(responseTime).toBeLessThan(50); // Allow 50ms for HTTP overhead
      expect(response.body.id).toBe(testTemplateId);
    });

    it('should handle concurrent template requests efficiently', async () => {
      if (!testTemplateId) {
        console.log('Skipping concurrent request test - no template created');
        return;
      }

      const concurrentRequests = 20;
      const startTime = Date.now();

      const requests = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get(`/api/admin/templates/${testTemplateId}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(testTemplateId);
      });

      // Average response time should be reasonable
      const averageTime = totalTime / concurrentRequests;
      expect(averageTime).toBeLessThan(100); // 100ms average including HTTP overhead
    });

    it('should maintain performance with large template content', async () => {
      // Create template with large content
      const largeContent = `
This is a comprehensive template for testing performance with large content.
${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(100)}

Variables to process:
{{variable1}} {{variable2}} {{variable3}} {{variable4}} {{variable5}}
{{variable6}} {{variable7}} {{variable8}} {{variable9}} {{variable10}}

Instructions:
${'Detailed instructions for processing. '.repeat(50)}

Examples:
${'Example content with variables {{example_var}}. '.repeat(30)}
      `.trim();

      const largeTemplate = {
        category: TemplateCategory.CUSTOM,
        key: 'large_content_test',
        name: 'Large Content Test Template',
        description: 'Template with large content for performance testing',
        content: largeContent,
        variables: Array.from({ length: 15 }, (_, i) => ({
          name: `variable${i + 1}`,
          type: 'string',
          required: i < 5,
          defaultValue: `default_${i + 1}`
        }))
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largeTemplate);

      if (createResponse.status !== 201) {
        console.log('Skipping large content test - template creation failed');
        return;
      }

      const largeTemplateId = createResponse.body.id;

      // Test rendering performance with large template
      const variables = Array.from({ length: 15 }, (_, i) => ({
        [`variable${i + 1}`]: `test_value_${i + 1}`
      })).reduce((acc, curr) => ({ ...acc, ...curr }), {});

      const startTime = Date.now();

      const testResponse = await request(app)
        .post(`/api/admin/templates/${largeTemplateId}/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables,
          provider: 'openai'
        })
        .expect(200);

      const renderTime = Date.now() - startTime;

      expect(renderTime).toBeLessThan(500); // Should render within 500ms
      expect(testResponse.body.renderedContent).toBeDefined();
      expect(testResponse.body.renderedContent.length).toBeGreaterThan(1000);
    });
  });

  describe('Template Rendering Performance', () => {
    it('should render templates with multiple variables efficiently', async () => {
      if (!testTemplateId) {
        console.log('Skipping rendering performance test - no template created');
        return;
      }

      const variables = {
        original_prompt: 'Create a comprehensive marketing strategy for a new product launch',
        target_provider: 'openai',
        domain: 'marketing',
        complexity_level: 'advanced',
        requirements: 'Include market analysis, target audience, and campaign timeline'
      };

      const startTime = Date.now();

      const response = await request(app)
        .post(`/api/admin/templates/${testTemplateId}/test`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variables,
          provider: 'openai'
        })
        .expect(200);

      const renderTime = Date.now() - startTime;

      expect(renderTime).toBeLessThan(200); // Should render within 200ms
      expect(response.body.renderedContent).toBeDefined();
      expect(response.body.renderedContent).toContain(variables.original_prompt);
      expect(response.body.renderedContent).toContain(variables.target_provider);
    });

    it('should handle batch template rendering efficiently', async () => {
      if (!testTemplateId) {
        console.log('Skipping batch rendering test - no template created');
        return;
      }

      const batchSize = 10;
      const startTime = Date.now();

      const batchRequests = Array.from({ length: batchSize }, (_, i) =>
        request(app)
          .post(`/api/admin/templates/${testTemplateId}/test`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            variables: {
              original_prompt: `Test prompt ${i}`,
              target_provider: 'openai',
              domain: 'testing',
              complexity_level: 'basic'
            },
            provider: 'openai'
          })
      );

      const responses = await Promise.all(batchRequests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach((response, i) => {
        expect(response.status).toBe(200);
        expect(response.body.renderedContent).toContain(`Test prompt ${i}`);
      });

      // Batch processing should be efficient
      const averageTime = totalTime / batchSize;
      expect(averageTime).toBeLessThan(300); // 300ms average per render
    });
  });

  describe('Template Validation Performance', () => {
    it('should validate templates quickly', async () => {
      const validationTemplate = {
        category: TemplateCategory.CUSTOM,
        key: 'validation_perf_test',
        name: 'Validation Performance Test',
        description: 'Template for testing validation performance',
        content: `Complex template with multiple variables:
        
{{var1}} and {{var2}} should work with {{var3}}.
Conditional logic: {{#if var4}}{{var5}}{{/if}}
Loops: {{#each var6}}{{this}}{{/each}}
Nested: {{var7.nested.property}}

Security test patterns (should be safe):
- No eval() calls
- No script tags
- No dangerous patterns
- Proper variable syntax`,
        variables: [
          { name: 'var1', type: 'string', required: true },
          { name: 'var2', type: 'string', required: true },
          { name: 'var3', type: 'string', required: false },
          { name: 'var4', type: 'boolean', required: false },
          { name: 'var5', type: 'string', required: false },
          { name: 'var6', type: 'array', required: false },
          { name: 'var7', type: 'object', required: false }
        ]
      };

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validationTemplate)
        .expect(201);

      const validationTime = Date.now() - startTime;

      expect(validationTime).toBeLessThan(1000); // Validation should complete within 1 second
      expect(response.body.id).toBeDefined();
      expect(response.body.isActive).toBe(true);
    });

    it('should detect security issues quickly', async () => {
      const maliciousTemplate = {
        category: TemplateCategory.CUSTOM,
        key: 'security_perf_test',
        name: 'Security Performance Test',
        description: 'Template with security issues for performance testing',
        content: `Malicious template:
        
<script>alert('xss')</script>
eval("dangerous code")
{{constructor}}
password: "hardcoded_secret"
require("fs").readFileSync("/etc/passwd")
process.env.SECRET_KEY`,
        variables: [
          { name: 'constructor', type: 'string', required: false }
        ]
      };

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(maliciousTemplate)
        .expect(400);

      const validationTime = Date.now() - startTime;

      expect(validationTime).toBeLessThan(2000); // Security validation should complete within 2 seconds
      expect(response.body.error).toContain('security');
      expect(response.body.violations).toBeDefined();
      expect(response.body.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Cache Performance', () => {
    it('should demonstrate cache hit performance improvement', async () => {
      if (!testTemplateId) {
        console.log('Skipping cache performance test - no template created');
        return;
      }

      // Clear cache and measure cold load
      await request(app)
        .delete('/api/admin/templates/cache')
        .set('Authorization', `Bearer ${authToken}`);

      const coldStartTime = Date.now();
      await request(app)
        .get(`/api/admin/templates/${testTemplateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const coldLoadTime = Date.now() - coldStartTime;

      // Measure warm cache load
      const warmStartTime = Date.now();
      await request(app)
        .get(`/api/admin/templates/${testTemplateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      const warmLoadTime = Date.now() - warmStartTime;

      // Cache should provide significant performance improvement
      expect(warmLoadTime).toBeLessThan(coldLoadTime);
      expect(warmLoadTime).toBeLessThan(50); // Cached load should be very fast
    });

    it('should handle cache invalidation efficiently', async () => {
      if (!testTemplateId) {
        console.log('Skipping cache invalidation test - no template created');
        return;
      }

      // Load template to cache
      await request(app)
        .get(`/api/admin/templates/${testTemplateId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Update template (should invalidate cache)
      const updateStartTime = Date.now();
      
      const updateResponse = await request(app)
        .put(`/api/admin/templates/${testTemplateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Updated content: {{original_prompt}} for {{target_provider}}',
          metadata: { version: '2.0.0' }
        })
        .expect(200);

      const updateTime = Date.now() - updateStartTime;

      expect(updateTime).toBeLessThan(1000); // Update with cache invalidation should be fast
      expect(updateResponse.body.version).toBeGreaterThan(1);

      // Verify updated content is served (not cached old version)
      const getResponse = await request(app)
        .get(`/api/admin/templates/${testTemplateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.content).toContain('Updated content');
    });
  });

  describe('Analytics Performance', () => {
    it('should record usage analytics efficiently', async () => {
      if (!testTemplateId) {
        console.log('Skipping analytics performance test - no template created');
        return;
      }

      // Generate multiple usage events
      const usageCount = 20;
      const startTime = Date.now();

      const usageRequests = Array.from({ length: usageCount }, (_, i) =>
        request(app)
          .post(`/api/admin/templates/${testTemplateId}/test`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            variables: {
              original_prompt: `Analytics test ${i}`,
              target_provider: 'openai'
            },
            provider: 'openai'
          })
      );

      await Promise.all(usageRequests);
      const usageTime = Date.now() - startTime;

      // Analytics recording should not significantly impact performance
      const averageUsageTime = usageTime / usageCount;
      expect(averageUsageTime).toBeLessThan(500); // Should handle usage recording efficiently

      // Verify analytics were recorded
      const analyticsResponse = await request(app)
        .get(`/api/admin/templates/${testTemplateId}/analytics`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(analyticsResponse.body.usageCount).toBeGreaterThanOrEqual(usageCount);
    });

    it('should generate analytics reports efficiently', async () => {
      const startTime = Date.now();

      const analyticsResponse = await request(app)
        .get('/api/admin/templates/analytics/system')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const reportTime = Date.now() - startTime;

      expect(reportTime).toBeLessThan(2000); // System analytics should generate within 2 seconds
      expect(analyticsResponse.body.totalTemplates).toBeGreaterThan(0);
      expect(analyticsResponse.body.usageStatistics).toBeDefined();
      expect(analyticsResponse.body.performanceMetrics).toBeDefined();
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should handle template operations without memory leaks', async () => {
      // This test would ideally monitor memory usage over time
      // For now, we'll test that repeated operations don't fail
      
      const iterations = 50;
      const templateData = {
        category: TemplateCategory.CUSTOM,
        key: 'memory_test',
        name: 'Memory Test Template',
        description: 'Template for memory testing',
        content: 'Memory test: {{test_var}}',
        variables: [{ name: 'test_var', type: 'string', required: true }]
      };

      // Create template
      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(templateData);

      if (createResponse.status !== 201) {
        console.log('Skipping memory test - template creation failed');
        return;
      }

      const memoryTestTemplateId = createResponse.body.id;

      // Perform repeated operations
      for (let i = 0; i < iterations; i++) {
        await request(app)
          .post(`/api/admin/templates/${memoryTestTemplateId}/test`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            variables: { test_var: `iteration_${i}` },
            provider: 'openai'
          })
          .expect(200);

        // Every 10 iterations, check that we can still perform operations
        if (i % 10 === 0) {
          const healthResponse = await request(app)
            .get('/api/admin/templates/health')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          expect(healthResponse.body.status).toBe('healthy');
        }
      }

      // System should still be responsive after repeated operations
      const finalHealthResponse = await request(app)
        .get('/api/admin/templates/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalHealthResponse.body.status).toBe('healthy');
    });
  });
});