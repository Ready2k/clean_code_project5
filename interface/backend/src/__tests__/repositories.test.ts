import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateRepository } from '../repositories/template-repository.js';
import { VersionManagementRepository } from '../repositories/version-management-repository.js';
import { AnalyticsDataRepository } from '../repositories/analytics-data-repository.js';
import { TemplateCategory } from '../types/prompt-templates.js';

// Mock the database service
vi.mock('../services/database-service.js', () => ({
  getDatabaseService: vi.fn(() => ({
    query: vi.fn(),
    transaction: vi.fn()
  }))
}));

describe('Repository Classes', () => {
  let templateRepo: TemplateRepository;
  let versionRepo: VersionManagementRepository;
  let analyticsRepo: AnalyticsDataRepository;

  beforeEach(() => {
    templateRepo = new TemplateRepository();
    versionRepo = new VersionManagementRepository();
    analyticsRepo = new AnalyticsDataRepository();
  });

  describe('TemplateRepository', () => {
    it('should be instantiable', () => {
      expect(templateRepo).toBeInstanceOf(TemplateRepository);
    });

    it('should have all required methods', () => {
      expect(typeof templateRepo.create).toBe('function');
      expect(typeof templateRepo.findById).toBe('function');
      expect(typeof templateRepo.findByCategoryAndKey).toBe('function');
      expect(typeof templateRepo.findMany).toBe('function');
      expect(typeof templateRepo.update).toBe('function');
      expect(typeof templateRepo.softDelete).toBe('function');
      expect(typeof templateRepo.archive).toBe('function');
      expect(typeof templateRepo.restore).toBe('function');
      expect(typeof templateRepo.findByCategory).toBe('function');
      expect(typeof templateRepo.findDefaultsByCategory).toBe('function');
      expect(typeof templateRepo.executeInTransaction).toBe('function');
    });
  });

  describe('VersionManagementRepository', () => {
    it('should be instantiable', () => {
      expect(versionRepo).toBeInstanceOf(VersionManagementRepository);
    });

    it('should have all required methods', () => {
      expect(typeof versionRepo.createVersion).toBe('function');
      expect(typeof versionRepo.getVersionHistory).toBe('function');
      expect(typeof versionRepo.getVersion).toBe('function');
      expect(typeof versionRepo.getLatestVersion).toBe('function');
      expect(typeof versionRepo.calculateDiff).toBe('function');
      expect(typeof versionRepo.rollbackToVersion).toBe('function');
      expect(typeof versionRepo.compareVersions).toBe('function');
      expect(typeof versionRepo.mergeVersions).toBe('function');
      expect(typeof versionRepo.cleanupOldVersions).toBe('function');
    });
  });

  describe('AnalyticsDataRepository', () => {
    it('should be instantiable', () => {
      expect(analyticsRepo).toBeInstanceOf(AnalyticsDataRepository);
    });

    it('should have all required methods', () => {
      expect(typeof analyticsRepo.recordUsage).toBe('function');
      expect(typeof analyticsRepo.recordPerformanceMetrics).toBe('function');
      expect(typeof analyticsRepo.getUsageStats).toBe('function');
      expect(typeof analyticsRepo.getPerformanceMetrics).toBe('function');
      expect(typeof analyticsRepo.generateUsageReport).toBe('function');
      expect(typeof analyticsRepo.generatePerformanceReport).toBe('function');
      expect(typeof analyticsRepo.getTopPerformingTemplates).toBe('function');
      expect(typeof analyticsRepo.cleanupOldData).toBe('function');
      expect(typeof analyticsRepo.archiveOldData).toBe('function');
    });
  });
});