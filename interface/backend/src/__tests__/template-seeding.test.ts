/**
 * Template Seeding Tests
 * 
 * Tests for the template seeding service and CLI functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool } from 'pg';
import { TemplateSeedingService } from '../services/template-seeding-service';
import { TemplateRepository } from '../repositories/template-repository';
import { VersionManagementRepository } from '../repositories/version-management-repository';
import { AnalyticsDataRepository } from '../repositories/analytics-data-repository';
import { DEFAULT_TEMPLATES } from '../data/default-templates';

// Mock dependencies
vi.mock('pg');
vi.mock('../repositories/template-repository');
vi.mock('../repositories/version-management-repository');
vi.mock('../repositories/analytics-data-repository');

describe('TemplateSeedingService', () => {
  let seedingService: TemplateSeedingService;
  let mockDb: any;
  let mockTemplateRepo: any;
  let mockVersionRepo: any;
  let mockAnalyticsRepo: any;
  let mockClient: any;

  beforeEach(() => {
    // Setup mocks
    mockClient = {
      query: vi.fn(),
      release: vi.fn()
    };

    mockDb = {
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn()
    };

    mockTemplateRepo = {
      create: vi.fn(),
      update: vi.fn(),
      getByKey: vi.fn(),
      list: vi.fn()
    };

    mockVersionRepo = {
      createVersion: vi.fn()
    };

    mockAnalyticsRepo = {
      recordMetric: vi.fn()
    };

    seedingService = new TemplateSeedingService(
      mockTemplateRepo,
      mockVersionRepo,
      mockAnalyticsRepo,
      mockDb
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('seedDefaultTemplates', () => {
    it('should seed templates successfully in dry run mode', async () => {
      // Setup
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'system-user-id' }]
      });

      mockTemplateRepo.getByKey.mockResolvedValue(null);

      // Execute
      const result = await seedingService.seedDefaultTemplates({
        dryRun: true,
        validateTemplates: true
      });

      // Verify
      expect(result.success).toBe(true);
      expect(result.templatesSeeded).toBe(DEFAULT_TEMPLATES.length);
      expect(result.errors).toHaveLength(0);
      expect(result.seedingId).toMatch(/^seed-\d+$/);

      // Verify no actual database operations in dry run
      expect(mockTemplateRepo.create).not.toHaveBeenCalled();
      expect(mockVersionRepo.createVersion).not.toHaveBeenCalled();
    });

    it('should seed templates successfully with all options', async () => {
      // Setup
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'system-user-id' }]
      });

      mockTemplateRepo.getByKey.mockResolvedValue(null);
      mockTemplateRepo.create.mockResolvedValue({ id: 'template-id' });

      // Execute
      const result = await seedingService.seedDefaultTemplates({
        overwriteExisting: false,
        validateTemplates: true,
        createVersions: true,
        initializeMetrics: true,
        dryRun: false
      });

      // Verify
      expect(result.success).toBe(true);
      expect(result.templatesSeeded).toBe(DEFAULT_TEMPLATES.length);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockTemplateRepo.create).toHaveBeenCalledTimes(DEFAULT_TEMPLATES.length);
    });

    it('should handle existing templates without overwrite', async () => {
      // Setup
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'system-user-id' }]
      });

      mockTemplateRepo.getByKey.mockResolvedValue({
        id: 'existing-template-id',
        key: 'main_enhancement_prompt'
      });

      // Execute
      const result = await seedingService.seedDefaultTemplates({
        overwriteExisting: false
      });

      // Verify
      expect(result.success).toBe(true);
      expect(result.templatesSeeded).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('already exists');
    });

    it('should overwrite existing templates when requested', async () => {
      // Setup
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'system-user-id' }]
      });

      mockTemplateRepo.getByKey.mockResolvedValue({
        id: 'existing-template-id',
        key: 'main_enhancement_prompt'
      });

      // Execute
      const result = await seedingService.seedDefaultTemplates({
        overwriteExisting: true
      });

      // Verify
      expect(result.success).toBe(true);
      expect(mockTemplateRepo.update).toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      // Setup - create invalid template
      const originalTemplates = [...DEFAULT_TEMPLATES];
      DEFAULT_TEMPLATES.length = 0;
      DEFAULT_TEMPLATES.push({
        category: 'invalid' as any,
        key: '',
        name: '',
        description: '',
        content: '',
        variables: [],
        metadata: {}
      });

      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'system-user-id' }]
      });

      // Execute
      const result = await seedingService.seedDefaultTemplates({
        validateTemplates: true
      });

      // Verify
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Restore original templates
      DEFAULT_TEMPLATES.length = 0;
      DEFAULT_TEMPLATES.push(...originalTemplates);
    });

    it('should rollback on database error', async () => {
      // Setup
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'system-user-id' }]
      });
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      mockTemplateRepo.getByKey.mockResolvedValue(null);

      // Execute
      const result = await seedingService.seedDefaultTemplates({
        dryRun: false
      });

      // Verify
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('rollbackSeeding', () => {
    it('should rollback seeded templates successfully', async () => {
      // Setup
      const seedingId = 'seed-1234567890';
      
      mockTemplateRepo.list.mockResolvedValue([
        {
          id: 'template-1',
          key: 'main_enhancement_prompt',
          metadata: { seeding_id: seedingId }
        },
        {
          id: 'template-2',
          key: 'system_enhancement_prompt',
          metadata: { seeding_id: seedingId }
        }
      ]);

      mockClient.query.mockResolvedValue({ rows: [] });

      // Execute
      const result = await seedingService.rollbackSeeding(seedingId);

      // Verify
      expect(result.success).toBe(true);
      expect(result.templatesRemoved).toBe(2);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should handle rollback errors gracefully', async () => {
      // Setup
      const seedingId = 'seed-1234567890';
      
      mockTemplateRepo.list.mockResolvedValue([
        {
          id: 'template-1',
          key: 'main_enhancement_prompt',
          metadata: { seeding_id: seedingId }
        }
      ]);

      mockClient.query.mockRejectedValueOnce(new Error('Delete failed'));

      // Execute
      const result = await seedingService.rollbackSeeding(seedingId);

      // Verify
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getSeedingStatus', () => {
    it('should return correct seeding status', async () => {
      // Setup
      mockTemplateRepo.list.mockResolvedValue([
        {
          id: 'template-1',
          key: 'main_enhancement_prompt',
          metadata: { seeded_at: '2024-01-01T12:00:00.000Z' }
        },
        {
          id: 'template-2',
          key: 'system_enhancement_prompt',
          metadata: { seeded_at: '2024-01-01T12:30:00.000Z' }
        }
      ]);

      // Execute
      const status = await seedingService.getSeedingStatus();

      // Verify
      expect(status.totalDefaultTemplates).toBe(DEFAULT_TEMPLATES.length);
      expect(status.seededTemplates).toBe(2);
      expect(status.missingTemplates.length).toBe(DEFAULT_TEMPLATES.length - 2);
      expect(status.lastSeedingDate).toEqual(new Date('2024-01-01T12:30:00.000Z'));
    });

    it('should handle no seeded templates', async () => {
      // Setup
      mockTemplateRepo.list.mockResolvedValue([]);

      // Execute
      const status = await seedingService.getSeedingStatus();

      // Verify
      expect(status.totalDefaultTemplates).toBe(DEFAULT_TEMPLATES.length);
      expect(status.seededTemplates).toBe(0);
      expect(status.missingTemplates.length).toBe(DEFAULT_TEMPLATES.length);
      expect(status.lastSeedingDate).toBeUndefined();
    });
  });
});

describe('Template Validation', () => {
  it('should validate all default templates', () => {
    for (const template of DEFAULT_TEMPLATES) {
      // Basic structure validation
      expect(template.key).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.content).toBeTruthy();
      expect(template.category).toBeTruthy();
      expect(Array.isArray(template.variables)).toBe(true);
      expect(typeof template.metadata).toBe('object');

      // Content validation
      expect(template.content.length).toBeGreaterThan(10);
      expect(template.content.length).toBeLessThan(10000);

      // Variable validation
      for (const variable of template.variables) {
        expect(variable.name).toBeTruthy();
        expect(variable.type).toBeTruthy();
        expect(variable.description).toBeTruthy();
        expect(typeof variable.required).toBe('boolean');
      }

      // Security validation
      expect(template.content).not.toMatch(/<script/i);
      expect(template.content).not.toMatch(/javascript:/i);
      expect(template.content).not.toMatch(/eval\(/i);
    }
  });

  it('should have valid template categories', () => {
    const validCategories = ['enhancement', 'question_generation', 'mock_responses', 'system_prompts', 'custom'];
    
    for (const template of DEFAULT_TEMPLATES) {
      expect(validCategories).toContain(template.category);
    }
  });

  it('should have unique template keys within categories', () => {
    const keysByCategory = new Map<string, Set<string>>();
    
    for (const template of DEFAULT_TEMPLATES) {
      if (!keysByCategory.has(template.category)) {
        keysByCategory.set(template.category, new Set());
      }
      
      const keys = keysByCategory.get(template.category)!;
      expect(keys.has(template.key)).toBe(false);
      keys.add(template.key);
    }
  });
});