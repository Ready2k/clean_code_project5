/**
 * Repository layer exports
 * Provides data access layer for the customizable prompt template system
 */

export { TemplateRepository } from './template-repository.js';
export { VersionManagementRepository } from './version-management-repository.js';
export { AnalyticsDataRepository } from './analytics-data-repository.js';

// Re-export types from version management repository
export type { DiffResult, DiffChange } from './version-management-repository.js';