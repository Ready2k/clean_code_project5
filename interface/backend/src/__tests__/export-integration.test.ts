import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { initializeExportService, getExportService } from '../services/export-service.js';
import { initializePromptLibraryService, getPromptLibraryService } from '../services/prompt-library-service.js';
import { initializeUserService } from '../services/user-service.js';
import { initializeRedisService, getRedisService } from '../services/redis-service.js';
import jwt from 'jsonwebtoken';

// Mock logger
vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Export API Integration Tests', () => {
  let authToken: string;
  let testPromptId: string;

  beforeEach(async () => {
    // Initialize services
    await initializeRedisService();
    const redisService = getRedisService();
    await initializeUserService(redisService);
    await initializePromptLibraryService();
    await initializeExportService();

    // Create test user and get auth token
    const testUser = {
      userId: 'test-user-123',
      username: 'testuser',
      email: 'test@example.com',
      role: 'user',
      permissions: ['read:prompts', 'write:prompts', 'export:prompts']
    };

    authToken = jwt.sign(testUser, process.env['JWT_SECRET'] || 'test-secret', {
      expiresIn: '1h'
    });

    // Create a test prompt
    const promptLibraryService = getPromptLibraryService();
    const testPrompt = await promptLibraryService.createPrompt({
      metadata: {
        title: 'Test Export Prompt',
        summary: 'A prompt for testing export functionality',
        tags: ['test', 'export']
      },
      humanPrompt: {
        goal: 'Test the export API endpoints',
        audience: 'Developers',
        steps: ['Create test data', 'Call export API', 'Verify results'],
        output_expectations: {
          format: 'JSON response',
          fields: ['status', 'data']
        }
      },
      owner: testUser.userId
    });

    testPromptId = testPrompt.id;
  });

  afterEach(async () => {
    // Cleanup services
    const exportService = getExportService();
    await exportService.shutdown();
    
    const promptLibraryService = getPromptLibraryService();
    await promptLibraryService.shutdown();
    
    const redisService = getRedisService();
    await redisService.disconnect();
  });

  describe('GET /api/export/formats', () => {
    it('should return supported export formats', async () => {
      const response = await request(app)
        .get('/api/export/formats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.formats).toBeDefined();
      expect(response.body.formats).toHaveLength(5);
      expect(response.body.total).toBe(5);
      expect(response.body.templates).toEqual(['minimal', 'full', 'provider-ready']);
      expect(response.body.archiveFormats).toEqual(['zip', 'tar']);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/export/formats')
        .expect(401);
    });
  });

  describe('GET /api/export/documentation', () => {
    it('should return API documentation', async () => {
      const response = await request(app)
        .get('/api/export/documentation')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.overview).toBeDefined();
      expect(response.body.endpoints).toBeDefined();
      expect(response.body.formats).toBeDefined();
      expect(response.body.templates).toBeDefined();
      expect(response.body.examples).toBeDefined();
    });
  });

  describe('POST /api/export/prompt/:id', () => {
    it('should export prompt as JSON', async () => {
      const response = await request(app)
        .post(`/api/export/prompt/${testPromptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'json',
          includeMetadata: true
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['x-export-format']).toBe('json');

      const exportedData = JSON.parse(response.text);
      expect(exportedData.id).toBe(testPromptId);
      expect(exportedData.metadata.title).toBe('Test Export Prompt');
    });

    it('should export prompt as YAML', async () => {
      const response = await request(app)
        .post(`/api/export/prompt/${testPromptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'yaml',
          includeMetadata: true
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('application/x-yaml; charset=utf-8');
      expect(response.text).toContain(`id: ${testPromptId}`);
      expect(response.text).toContain('title: Test Export Prompt');
    });

    it('should export prompt in OpenAI format', async () => {
      const response = await request(app)
        .post(`/api/export/prompt/${testPromptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'openai',
          includeMetadata: true
        })
        .expect(200);

      const exportedData = JSON.parse(response.text);
      expect(exportedData.provider).toBe('openai');
      expect(exportedData.request).toBeDefined();
    });

    it('should use minimal template', async () => {
      const response = await request(app)
        .post(`/api/export/prompt/${testPromptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'json',
          template: 'minimal'
        })
        .expect(200);

      const exportedData = JSON.parse(response.text);
      expect(exportedData.title).toBe('Test Export Prompt');
      expect(exportedData.goal).toBeDefined();
      expect(exportedData.metadata).toBeUndefined();
    });

    it('should validate export format', async () => {
      await request(app)
        .post(`/api/export/prompt/${testPromptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'invalid-format'
        })
        .expect(400);
    });

    it('should require valid prompt ID', async () => {
      await request(app)
        .post('/api/export/prompt/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'json'
        })
        .expect(404);
    });

    it('should require export permission', async () => {
      // Create token without export permission
      const limitedUser = {
        userId: 'limited-user',
        username: 'limited',
        email: 'limited@example.com',
        role: 'viewer',
        permissions: ['read:prompts']
      };

      const limitedToken = jwt.sign(limitedUser, process.env['JWT_SECRET'] || 'test-secret', {
        expiresIn: '1h'
      });

      await request(app)
        .post(`/api/export/prompt/${testPromptId}`)
        .set('Authorization', `Bearer ${limitedToken}`)
        .send({
          format: 'json'
        })
        .expect(403);
    });
  });

  describe('POST /api/export/prompt/:id/preview', () => {
    it('should return export preview', async () => {
      const response = await request(app)
        .post(`/api/export/prompt/${testPromptId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'json',
          includeMetadata: true
        })
        .expect(200);

      expect(response.body.promptId).toBe(testPromptId);
      expect(response.body.format).toBe('json');
      expect(response.body.filename).toBeDefined();
      expect(response.body.size).toBeGreaterThan(0);
      expect(response.body.preview).toBeDefined();
      expect(response.body.mimeType).toBe('application/json');
    });

    it('should truncate long previews', async () => {
      const response = await request(app)
        .post(`/api/export/prompt/${testPromptId}/preview`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'json',
          includeMetadata: true,
          includeHistory: true
        })
        .expect(200);

      expect(response.body.preview.length).toBeLessThanOrEqual(2000);
      if (response.body.size > 2000) {
        expect(response.body.truncated).toBe(true);
      }
    });
  });

  describe('POST /api/export/bulk', () => {
    let secondPromptId: string;

    beforeEach(async () => {
      // Create a second test prompt
      const promptLibraryService = getPromptLibraryService();
      const secondPrompt = await promptLibraryService.createPrompt({
        metadata: {
          title: 'Second Test Prompt',
          summary: 'Another prompt for bulk export testing',
          tags: ['test', 'bulk']
        },
        humanPrompt: {
          goal: 'Test bulk export functionality',
          audience: 'Developers',
          steps: ['Create multiple prompts', 'Export them together'],
          output_expectations: {
            format: 'Archive',
            fields: ['multiple files']
          }
        },
        owner: 'test-user-123'
      });

      secondPromptId = secondPrompt.id;
    });

    it('should create bulk export archive', async () => {
      const response = await request(app)
        .post('/api/export/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          promptIds: [testPromptId, secondPromptId],
          format: 'json',
          archiveFormat: 'zip'
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('application/zip');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['x-export-count']).toBe('2');
      expect(response.headers['x-archive-format']).toBe('zip');
    });

    it('should use custom filename', async () => {
      const response = await request(app)
        .post('/api/export/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          promptIds: [testPromptId],
          format: 'json',
          filename: 'custom_export.zip'
        })
        .expect(200);

      expect(response.headers['content-disposition']).toContain('custom_export.zip');
    });

    it('should validate prompt IDs array', async () => {
      await request(app)
        .post('/api/export/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          promptIds: [],
          format: 'json'
        })
        .expect(400);
    });

    it('should require promptIds field', async () => {
      await request(app)
        .post('/api/export/bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'json'
        })
        .expect(400);
    });
  });

  describe('POST /api/export/bulk/preview', () => {
    let secondPromptId: string;

    beforeEach(async () => {
      const promptLibraryService = getPromptLibraryService();
      const secondPrompt = await promptLibraryService.createPrompt({
        metadata: {
          title: 'Second Test Prompt',
          summary: 'Another prompt for bulk export testing',
          tags: ['test', 'bulk']
        },
        humanPrompt: {
          goal: 'Test bulk export functionality',
          audience: 'Developers',
          steps: ['Create multiple prompts', 'Export them together'],
          output_expectations: {
            format: 'Archive',
            fields: ['multiple files']
          }
        },
        owner: 'test-user-123'
      });

      secondPromptId = secondPrompt.id;
    });

    it('should return bulk export preview', async () => {
      const response = await request(app)
        .post('/api/export/bulk/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          promptIds: [testPromptId, secondPromptId],
          format: 'json',
          archiveFormat: 'zip'
        })
        .expect(200);

      expect(response.body.totalPrompts).toBe(2);
      expect(response.body.validPrompts).toBe(2);
      expect(response.body.invalidPrompts).toBe(0);
      expect(response.body.format).toBe('json');
      expect(response.body.archiveFormat).toBe('zip');
      expect(response.body.prompts).toHaveLength(2);
      expect(response.body.estimatedSize).toBeGreaterThan(0);
    });

    it('should handle invalid prompt IDs', async () => {
      const response = await request(app)
        .post('/api/export/bulk/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          promptIds: [testPromptId, 'invalid-id'],
          format: 'json'
        })
        .expect(200);

      expect(response.body.totalPrompts).toBe(2);
      expect(response.body.validPrompts).toBe(1);
      expect(response.body.invalidPrompts).toBe(1);
      
      const invalidPrompt = response.body.prompts.find((p: any) => p.id === 'invalid-id');
      expect(invalidPrompt.error).toBeDefined();
    });
  });

  describe('GET /api/export/templates', () => {
    it('should return available templates', async () => {
      const response = await request(app)
        .get('/api/export/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.templates).toHaveLength(3);
      expect(response.body.total).toBe(3);
      expect(response.body.default).toBe('full');

      const templateIds = response.body.templates.map((t: any) => t.id);
      expect(templateIds).toEqual(['minimal', 'full', 'provider-ready']);
    });
  });

  describe('GET /api/export/examples/:format', () => {
    it('should return JSON format example', async () => {
      const response = await request(app)
        .get('/api/export/examples/json')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.format).toBe('json');
      expect(response.body.example).toBeDefined();
      expect(response.body.description).toContain('JSON');
    });

    it('should return YAML format example', async () => {
      const response = await request(app)
        .get('/api/export/examples/yaml')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.format).toBe('yaml');
      expect(response.body.example).toContain('id: example-prompt-123');
    });

    it('should return OpenAI format example', async () => {
      const response = await request(app)
        .get('/api/export/examples/openai')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.format).toBe('openai');
      expect(response.body.example.provider).toBe('openai');
      expect(response.body.example.request.messages).toBeDefined();
    });

    it('should validate format parameter', async () => {
      await request(app)
        .get('/api/export/examples/invalid-format')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Error handling', () => {
    it('should handle service unavailable errors', async () => {
      // Shutdown export service to simulate unavailability
      const exportService = getExportService();
      await exportService.shutdown();

      await request(app)
        .post(`/api/export/prompt/${testPromptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'json'
        })
        .expect(503);
    });

    it('should handle malformed request body', async () => {
      await request(app)
        .post(`/api/export/prompt/${testPromptId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send('invalid json')
        .expect(400);
    });
  });
});