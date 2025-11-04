/**
 * User Acceptance Testing Scenarios for Template System
 * Tests real-world user workflows and validates business requirements
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { TemplateCategory } from '../types/prompt-templates.js';

describe('User Acceptance Testing - Template Management Workflows', () => {
  let adminToken: string;
  let userToken: string;
  let testTemplateId: string;

  beforeAll(async () => {
    // Setup admin user
    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'uat-admin',
        email: 'uat-admin@test.com',
        password: 'AdminPassword123!',
        role: 'admin'
      });

    if (adminResponse.status === 201) {
      adminToken = adminResponse.body.token;
    } else {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'uat-admin@test.com',
          password: 'AdminPassword123!'
        });
      adminToken = loginResponse.body.token;
    }

    // Setup regular user
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'uat-user',
        email: 'uat-user@test.com',
        password: 'UserPassword123!'
      });

    if (userResponse.status === 201) {
      userToken = userResponse.body.token;
    } else {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'uat-user@test.com',
          password: 'UserPassword123!'
        });
      userToken = loginResponse.body.token;
    }
  });

  describe('UAT-001: Admin Template Management Workflow', () => {
    it('should allow admin to create, edit, and manage templates through complete workflow', async () => {
      // Step 1: Admin accesses template management interface
      const templatesListResponse = await request(app)
        .get('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(templatesListResponse.body.templates).toBeDefined();
      expect(Array.isArray(templatesListResponse.body.templates)).toBe(true);

      // Step 2: Admin creates a new enhancement template
      const newTemplate = {
        category: TemplateCategory.ENHANCEMENT,
        key: 'uat_enhancement_template',
        name: 'UAT Enhancement Template',
        description: 'Template created during user acceptance testing for enhancement workflows',
        content: `You are an expert prompt engineer. Please enhance the following prompt:

ORIGINAL PROMPT:
{{original_prompt}}

ENHANCEMENT CONTEXT:
- Target Provider: {{target_provider}}
- Domain: {{domain}}
- User Experience Level: {{experience_level}}
- Specific Requirements: {{requirements}}

Please provide an enhanced version that:
1. Improves clarity and specificity
2. Adds appropriate structure and formatting
3. Includes relevant variables for customization
4. Optimizes for the specified provider
5. Considers the user's experience level

ENHANCED PROMPT:`,
        variables: [
          {
            name: 'original_prompt',
            type: 'string',
            description: 'The original prompt text to be enhanced',
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
            description: 'Domain or subject area (e.g., marketing, technical, creative)',
            required: false,
            defaultValue: 'general'
          },
          {
            name: 'experience_level',
            type: 'string',
            description: 'User experience level (beginner, intermediate, advanced)',
            required: false,
            defaultValue: 'intermediate'
          },
          {
            name: 'requirements',
            type: 'string',
            description: 'Specific requirements or constraints',
            required: false,
            defaultValue: 'None specified'
          }
        ],
        metadata: {
          version: '1.0.0',
          author: 'UAT Admin',
          tags: ['enhancement', 'uat', 'production-ready'],
          category: 'enhancement'
        }
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTemplate)
        .expect(201);

      testTemplateId = createResponse.body.id;
      expect(createResponse.body.name).toBe('UAT Enhancement Template');
      expect(createResponse.body.isActive).toBe(true);
      expect(createResponse.body.variables).toHaveLength(5);

      // Step 3: Admin validates the template
      const validationResponse = await request(app)
        .post(`/api/admin/templates/${testTemplateId}/validate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          provider: 'openai'
        })
        .expect(200);

      expect(validationResponse.body.isValid).toBe(true);
      expect(validationResponse.body.errors).toHaveLength(0);

      // Step 4: Admin tests the template with realistic data
      const testData = {
        variables: {
          original_prompt: 'Write a blog post about artificial intelligence',
          target_provider: 'openai',
          domain: 'technology',
          experience_level: 'intermediate',
          requirements: 'Should be engaging and informative for a general audience'
        },
        provider: 'openai'
      };

      const testResponse = await request(app)
        .post(`/api/admin/templates/${testTemplateId}/test`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testData)
        .expect(200);

      expect(testResponse.body.renderedContent).toBeDefined();
      expect(testResponse.body.renderedContent).toContain('Write a blog post about artificial intelligence');
      expect(testResponse.body.renderedContent).toContain('technology');
      expect(testResponse.body.renderedContent).toContain('intermediate');

      // Step 5: Admin updates the template based on testing
      const updateData = {
        content: newTemplate.content + '\n\nNote: Ensure the enhanced prompt follows best practices for the target provider.',
        metadata: {
          ...newTemplate.metadata,
          version: '1.1.0',
          lastUpdated: new Date().toISOString()
        }
      };

      const updateResponse = await request(app)
        .put(`/api/admin/templates/${testTemplateId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.version).toBeGreaterThan(1);
      expect(updateResponse.body.content).toContain('best practices');

      // Step 6: Admin reviews template history
      const historyResponse = await request(app)
        .get(`/api/admin/templates/${testTemplateId}/history`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(historyResponse.body.versions).toHaveLength(2);
      expect(historyResponse.body.versions[0].version).toBe(1);
      expect(historyResponse.body.versions[1].version).toBe(2);

      // Step 7: Admin activates template for production use
      const activateResponse = await request(app)
        .patch(`/api/admin/templates/${testTemplateId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(activateResponse.body.isActive).toBe(true);
    });

    it('should allow admin to manage template categories and organization', async () => {
      // Test category-based template organization
      const categoryResponse = await request(app)
        .get('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ category: TemplateCategory.ENHANCEMENT })
        .expect(200);

      expect(categoryResponse.body.templates).toBeDefined();
      expect(categoryResponse.body.templates.every((t: any) => 
        t.category === TemplateCategory.ENHANCEMENT
      )).toBe(true);

      // Test template search functionality
      const searchResponse = await request(app)
        .get('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ search: 'UAT' })
        .expect(200);

      expect(searchResponse.body.templates.some((t: any) => 
        t.name.includes('UAT')
      )).toBe(true);

      // Test template filtering by tags
      const tagResponse = await request(app)
        .get('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ tags: 'uat,production-ready' })
        .expect(200);

      expect(searchResponse.body.templates.length).toBeGreaterThan(0);
    });
  });

  describe('UAT-002: Template Customization and Optimization Workflow', () => {
    it('should allow admin to customize templates for different use cases', async () => {
      // Create a question generation template for different task types
      const questionTemplate = {
        category: TemplateCategory.QUESTION_GENERATION,
        key: 'uat_question_generator',
        name: 'UAT Question Generator Template',
        description: 'Customizable template for generating contextual questions',
        content: `Generate {{question_count}} relevant questions for the following context:

TASK TYPE: {{task_type}}
CONTEXT: {{context}}
USER INPUT: {{user_input}}

REQUIREMENTS:
- Questions should be specific to {{task_type}} tasks
- Consider user experience level: {{experience_level}}
- Focus on gathering {{focus_area}} information
- Questions should be {{question_style}}

Generated Questions:`,
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
            description: 'Type of task (analysis, generation, transformation, etc.)',
            required: true
          },
          {
            name: 'context',
            type: 'string',
            description: 'Context or background information',
            required: true
          },
          {
            name: 'user_input',
            type: 'string',
            description: 'User input or initial prompt',
            required: true
          },
          {
            name: 'experience_level',
            type: 'string',
            description: 'User experience level',
            required: false,
            defaultValue: 'intermediate'
          },
          {
            name: 'focus_area',
            type: 'string',
            description: 'Area to focus questions on',
            required: false,
            defaultValue: 'practical'
          },
          {
            name: 'question_style',
            type: 'string',
            description: 'Style of questions (open-ended, specific, multiple-choice)',
            required: false,
            defaultValue: 'open-ended'
          }
        ]
      };

      const createResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(questionTemplate)
        .expect(201);

      const questionTemplateId = createResponse.body.id;

      // Test template customization for different scenarios
      const testScenarios = [
        {
          name: 'Data Analysis Scenario',
          variables: {
            question_count: 4,
            task_type: 'data analysis',
            context: 'Customer satisfaction survey data',
            user_input: 'Analyze customer feedback trends',
            experience_level: 'advanced',
            focus_area: 'statistical',
            question_style: 'specific'
          }
        },
        {
          name: 'Creative Writing Scenario',
          variables: {
            question_count: 3,
            task_type: 'creative writing',
            context: 'Short story development',
            user_input: 'Write a science fiction story',
            experience_level: 'beginner',
            focus_area: 'creative',
            question_style: 'open-ended'
          }
        },
        {
          name: 'Technical Documentation Scenario',
          variables: {
            question_count: 5,
            task_type: 'documentation',
            context: 'API documentation project',
            user_input: 'Document REST API endpoints',
            experience_level: 'intermediate',
            focus_area: 'technical',
            question_style: 'specific'
          }
        }
      ];

      for (const scenario of testScenarios) {
        const testResponse = await request(app)
          .post(`/api/admin/templates/${questionTemplateId}/test`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            variables: scenario.variables,
            provider: 'openai'
          })
          .expect(200);

        expect(testResponse.body.renderedContent).toContain(scenario.variables.task_type);
        expect(testResponse.body.renderedContent).toContain(scenario.variables.context);
        expect(testResponse.body.renderedContent).toContain(scenario.variables.user_input);
      }
    });

    it('should support A/B testing of template variations', async () => {
      // Create two variations of the same template for A/B testing
      const templateVariationA = {
        category: TemplateCategory.ENHANCEMENT,
        key: 'uat_ab_test_a',
        name: 'UAT A/B Test Template - Variation A',
        description: 'Variation A for A/B testing - formal tone',
        content: `Please enhance the following prompt with a formal, professional approach:

Original: {{original_prompt}}
Target: {{target_provider}}

Enhanced version (formal):`,
        variables: [
          { name: 'original_prompt', type: 'string', required: true },
          { name: 'target_provider', type: 'string', required: true }
        ],
        metadata: {
          abTestGroup: 'A',
          testName: 'tone_comparison'
        }
      };

      const templateVariationB = {
        category: TemplateCategory.ENHANCEMENT,
        key: 'uat_ab_test_b',
        name: 'UAT A/B Test Template - Variation B',
        description: 'Variation B for A/B testing - conversational tone',
        content: `Let's enhance this prompt with a friendly, conversational approach:

Original: {{original_prompt}}
Target: {{target_provider}}

Enhanced version (conversational):`,
        variables: [
          { name: 'original_prompt', type: 'string', required: true },
          { name: 'target_provider', type: 'string', required: true }
        ],
        metadata: {
          abTestGroup: 'B',
          testName: 'tone_comparison'
        }
      };

      const variationAResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(templateVariationA)
        .expect(201);

      const variationBResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(templateVariationB)
        .expect(201);

      // Test both variations with the same input
      const testInput = {
        variables: {
          original_prompt: 'Create a marketing email for our new product',
          target_provider: 'openai'
        },
        provider: 'openai'
      };

      const testA = await request(app)
        .post(`/api/admin/templates/${variationAResponse.body.id}/test`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testInput)
        .expect(200);

      const testB = await request(app)
        .post(`/api/admin/templates/${variationBResponse.body.id}/test`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(testInput)
        .expect(200);

      expect(testA.body.renderedContent).toContain('formal');
      expect(testB.body.renderedContent).toContain('conversational');
    });
  });

  describe('UAT-003: End-User Template Usage Workflow', () => {
    it('should allow users to benefit from customized templates through existing interfaces', async () => {
      // Test that enhancement requests use the customized templates
      const enhancementRequest = {
        humanPrompt: {
          goal: 'Create a comprehensive product review',
          audience: 'Potential customers researching products',
          steps: [
            'Research product specifications and features',
            'Analyze user reviews and feedback',
            'Compare with similar products',
            'Evaluate pros and cons objectively',
            'Provide clear recommendation with rating'
          ],
          output_expectations: {
            format: 'Structured review with clear sections',
            fields: ['summary', 'features', 'pros', 'cons', 'rating', 'recommendation']
          }
        },
        metadata: {
          title: 'Product Review Generator',
          summary: 'Generates comprehensive product reviews',
          tags: ['review', 'product', 'analysis'],
          owner: 'uat-user'
        }
      };

      const enhanceResponse = await request(app)
        .post('/api/prompts/enhance')
        .set('Authorization', `Bearer ${userToken}`)
        .send(enhancementRequest)
        .expect(200);

      expect(enhanceResponse.body.structuredPrompt).toBeDefined();
      expect(enhanceResponse.body.confidence).toBeGreaterThan(0);
      expect(enhanceResponse.body.rationale).toBeDefined();
      
      // Verify that custom template was used
      if (enhanceResponse.body.templateUsed) {
        expect(enhanceResponse.body.templateUsed.category).toBe(TemplateCategory.ENHANCEMENT);
      }
    });

    it('should provide improved question generation through customized templates', async () => {
      const questionRequest = {
        taskType: 'analysis',
        context: 'Market research project for new product launch',
        userInput: 'Analyze target market and competition',
        variables: [
          { key: 'target_market', type: 'string', required: true },
          { key: 'product_category', type: 'string', required: true },
          { key: 'budget_range', type: 'number', required: false },
          { key: 'timeline', type: 'string', required: true }
        ]
      };

      const questionResponse = await request(app)
        .post('/api/prompts/questions/generate')
        .set('Authorization', `Bearer ${userToken}`)
        .send(questionRequest)
        .expect(200);

      expect(questionResponse.body.questions).toBeDefined();
      expect(questionResponse.body.questions.length).toBeGreaterThan(0);
      
      // Questions should be relevant to the context
      const questionsText = questionResponse.body.questions.map((q: any) => q.text).join(' ');
      expect(questionsText.toLowerCase()).toMatch(/market|target|competition|analysis/);
    });

    it('should maintain backward compatibility with existing user workflows', async () => {
      // Test that existing API endpoints still work as expected
      const legacyEnhancementRequest = {
        humanPrompt: {
          goal: 'Summarize research findings',
          audience: 'Research team',
          steps: ['Collect data', 'Analyze results', 'Create summary'],
          output_expectations: {
            format: 'Executive summary',
            fields: ['key_findings', 'recommendations']
          }
        }
      };

      const legacyResponse = await request(app)
        .post('/api/prompts/enhance')
        .set('Authorization', `Bearer ${userToken}`)
        .send(legacyEnhancementRequest)
        .expect(200);

      // Should work exactly as before, just with improved templates
      expect(legacyResponse.body.structuredPrompt).toBeDefined();
      expect(legacyResponse.body.confidence).toBeGreaterThan(0);
    });
  });

  describe('UAT-004: Template Performance and Analytics Workflow', () => {
    it('should provide meaningful analytics for template usage and performance', async () => {
      // Generate some usage data by using templates
      const usageRequests = Array.from({ length: 5 }, (_, i) => 
        request(app)
          .post('/api/prompts/enhance')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            humanPrompt: {
              goal: `Test goal ${i}`,
              audience: 'Test audience',
              steps: ['Test step'],
              output_expectations: { format: 'text', fields: ['result'] }
            }
          })
      );

      await Promise.all(usageRequests);

      // Check template analytics
      if (testTemplateId) {
        const analyticsResponse = await request(app)
          .get(`/api/admin/templates/${testTemplateId}/analytics`)
          .set('Authorization', `Bearer ${adminToken}`)
          .query({ timeRange: '24h' })
          .expect(200);

        expect(analyticsResponse.body.usageCount).toBeGreaterThanOrEqual(0);
        expect(analyticsResponse.body.performanceMetrics).toBeDefined();
      }

      // Check system-wide analytics
      const systemAnalyticsResponse = await request(app)
        .get('/api/admin/templates/analytics/system')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(systemAnalyticsResponse.body.totalTemplates).toBeGreaterThan(0);
      expect(systemAnalyticsResponse.body.activeTemplates).toBeGreaterThan(0);
      expect(systemAnalyticsResponse.body.usageStatistics).toBeDefined();
    });

    it('should identify top-performing templates and optimization opportunities', async () => {
      const performanceResponse = await request(app)
        .get('/api/admin/templates/analytics/performance')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ 
          timeRange: '7d',
          sortBy: 'usage',
          limit: 10
        })
        .expect(200);

      expect(performanceResponse.body.topTemplates).toBeDefined();
      expect(Array.isArray(performanceResponse.body.topTemplates)).toBe(true);
      
      if (performanceResponse.body.topTemplates.length > 0) {
        expect(performanceResponse.body.topTemplates[0]).toHaveProperty('usageCount');
        expect(performanceResponse.body.topTemplates[0]).toHaveProperty('averageResponseTime');
        expect(performanceResponse.body.topTemplates[0]).toHaveProperty('successRate');
      }

      // Check for optimization recommendations
      expect(performanceResponse.body.recommendations).toBeDefined();
    });
  });

  describe('UAT-005: Template Security and Compliance Workflow', () => {
    it('should prevent creation of insecure templates and provide clear feedback', async () => {
      const insecureTemplate = {
        category: TemplateCategory.CUSTOM,
        key: 'uat_security_test',
        name: 'UAT Security Test Template',
        description: 'Template to test security validation',
        content: 'Hello {{name}}, <script>alert("security test")</script>',
        variables: [{ name: 'name', type: 'string', required: true }]
      };

      const securityResponse = await request(app)
        .post('/api/admin/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(insecureTemplate)
        .expect(400);

      expect(securityResponse.body.error).toContain('security');
      expect(securityResponse.body.violations).toBeDefined();
      expect(securityResponse.body.violations.length).toBeGreaterThan(0);
      expect(securityResponse.body.suggestions).toBeDefined();
    });

    it('should provide security audit trail and compliance reporting', async () => {
      const auditResponse = await request(app)
        .get('/api/admin/security/audit')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ timeRange: '24h' })
        .expect(200);

      expect(auditResponse.body.events).toBeDefined();
      expect(Array.isArray(auditResponse.body.events)).toBe(true);

      const complianceResponse = await request(app)
        .get('/api/admin/security/compliance')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(complianceResponse.body.status).toBeDefined();
      expect(complianceResponse.body.checks).toBeDefined();
    });
  });

  describe('UAT-006: Template Import/Export and Backup Workflow', () => {
    it('should allow admin to export templates for backup and sharing', async () => {
      if (!testTemplateId) {
        console.log('Skipping export test - no template available');
        return;
      }

      const exportResponse = await request(app)
        .post(`/api/admin/templates/${testTemplateId}/export`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          format: 'json',
          includeHistory: true,
          includeAnalytics: false
        })
        .expect(200);

      expect(exportResponse.body.template).toBeDefined();
      expect(exportResponse.body.template.id).toBe(testTemplateId);
      expect(exportResponse.body.history).toBeDefined();
    });

    it('should allow admin to import templates from backup', async () => {
      const importTemplate = {
        category: TemplateCategory.CUSTOM,
        key: 'uat_import_test',
        name: 'UAT Import Test Template',
        description: 'Template for testing import functionality',
        content: 'Imported template: {{message}}',
        variables: [{ name: 'message', type: 'string', required: true }],
        metadata: {
          version: '1.0.0',
          imported: true
        }
      };

      const importResponse = await request(app)
        .post('/api/admin/templates/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          templates: [importTemplate],
          conflictResolution: 'create_new'
        })
        .expect(200);

      expect(importResponse.body.imported).toBeDefined();
      expect(importResponse.body.imported.length).toBe(1);
      expect(importResponse.body.imported[0].name).toBe('UAT Import Test Template');
    });
  });

  describe('UAT-007: User Feedback and Improvement Workflow', () => {
    it('should collect and process user feedback on template effectiveness', async () => {
      // Simulate user feedback on template usage
      const feedbackData = {
        templateId: testTemplateId,
        rating: 4,
        feedback: 'Template works well but could use more specific examples',
        category: 'improvement_suggestion',
        userId: 'uat-user'
      };

      const feedbackResponse = await request(app)
        .post('/api/admin/templates/feedback')
        .set('Authorization', `Bearer ${userToken}`)
        .send(feedbackData);

      // Should accept feedback (may return 200 or 201)
      expect([200, 201]).toContain(feedbackResponse.status);

      // Admin should be able to view feedback
      const viewFeedbackResponse = await request(app)
        .get(`/api/admin/templates/${testTemplateId}/feedback`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(viewFeedbackResponse.body.feedback).toBeDefined();
    });

    it('should provide template improvement recommendations based on usage patterns', async () => {
      const recommendationsResponse = await request(app)
        .get('/api/admin/templates/recommendations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(recommendationsResponse.body.recommendations).toBeDefined();
      expect(Array.isArray(recommendationsResponse.body.recommendations)).toBe(true);
    });
  });
});