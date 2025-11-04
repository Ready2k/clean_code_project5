/**
 * Template Seeding Service
 * 
 * Service for seeding default templates into the database with validation and rollback capabilities
 */

import { Pool } from 'pg';
import { DEFAULT_TEMPLATES } from '../data/default-templates';
import { TemplateRepository } from '../repositories/template-repository';
import { VersionManagementRepository } from '../repositories/version-management-repository';
import { AnalyticsDataRepository } from '../repositories/analytics-data-repository';
import { TemplateInfo, CreateTemplateRequest, TemplateCategory } from '../types/prompt-templates';

export interface SeedingResult {
  success: boolean;
  templatesSeeded: number;
  errors: string[];
  warnings: string[];
  seedingId: string;
}

export interface SeedingOptions {
  overwriteExisting?: boolean;
  validateTemplates?: boolean;
  createVersions?: boolean;
  initializeMetrics?: boolean;
  dryRun?: boolean;
}

export interface RollbackResult {
  success: boolean;
  templatesRemoved: number;
  errors: string[];
}

export class TemplateSeedingService {
  private templateRepository: TemplateRepository;
  private versionRepository: VersionManagementRepository;
  private analyticsRepository: AnalyticsDataRepository;
  private db: Pool;

  constructor(
    templateRepository: TemplateRepository,
    versionRepository: VersionManagementRepository,
    analyticsRepository: AnalyticsDataRepository,
    db: Pool
  ) {
    this.templateRepository = templateRepository;
    this.versionRepository = versionRepository;
    this.analyticsRepository = analyticsRepository;
    this.db = db;
  }

  /**
   * Seed default templates into the database
   */
  async seedDefaultTemplates(options: SeedingOptions = {}): Promise<SeedingResult> {
    const {
      overwriteExisting = false,
      validateTemplates = true,
      createVersions = true,
      initializeMetrics = true,
      dryRun = false
    } = options;

    const seedingId = `seed-${Date.now()}`;
    const errors: string[] = [];
    const warnings: string[] = [];
    let templatesSeeded = 0;

    try {
      // Start transaction for atomic operation
      const client = await this.db.connect();
      
      try {
        if (!dryRun) {
          await client.query('BEGIN');
        }

        // Get system user for template ownership
        const systemUserId = await this.getOrCreateSystemUser(client, dryRun);

        // Process each default template
        for (const defaultTemplate of DEFAULT_TEMPLATES) {
          try {
            // Validate template if requested
            if (validateTemplates) {
              const validation = this.validateTemplate(defaultTemplate);
              if (!validation.isValid) {
                errors.push(`Template ${defaultTemplate.key}: ${validation.errors.join(', ')}`);
                continue;
              }
              if (validation.warnings.length > 0) {
                warnings.push(`Template ${defaultTemplate.key}: ${validation.warnings.join(', ')}`);
              }
            }

            // Check if template already exists
            const existing = await this.templateRepository.findByCategoryAndKey(
              defaultTemplate.category,
              defaultTemplate.key
            );

            if (existing && !overwriteExisting) {
              warnings.push(`Template ${defaultTemplate.key} already exists, skipping`);
              continue;
            }

            // Prepare template data
            const templateData: CreateTemplateRequest = {
              category: defaultTemplate.category,
              key: defaultTemplate.key,
              name: defaultTemplate.name,
              description: defaultTemplate.description,
              content: defaultTemplate.content,
              variables: defaultTemplate.variables,
              metadata: {
                ...defaultTemplate.metadata,
                seeding_id: seedingId,
                seeded_at: new Date().toISOString()
              },
              isActive: true,
              isDefault: true
            };

            let templateId: string;

            if (existing && overwriteExisting) {
              // Update existing template
              if (!dryRun) {
                await this.templateRepository.update(existing.id, {
                  name: templateData.name,
                  description: templateData.description,
                  content: templateData.content,
                  variables: templateData.variables,
                  metadata: templateData.metadata,
                  changeMessage: `Updated by seeding service (${seedingId})`
                });
                templateId = existing.id;
              } else {
                templateId = existing.id;
              }
              warnings.push(`Updated existing template: ${defaultTemplate.key}`);
            } else {
              // Create new template
              if (!dryRun) {
                const created = await this.templateRepository.create(templateData, systemUserId);
                templateId = created.id;
              } else {
                templateId = `dry-run-${defaultTemplate.key}`;
              }
            }

            // Create initial version if requested
            if (createVersions && !dryRun) {
              await this.versionRepository.createVersion(
                templateId,
                templateData.content!,
                templateData.variables!,
                templateData.metadata!,
                `Initial version created by seeding service (${seedingId})`,
                systemUserId
              );
            }

            // Initialize metrics if requested
            if (initializeMetrics && !dryRun) {
              await this.initializeTemplateMetrics(templateId);
            }

            templatesSeeded++;

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to seed template ${defaultTemplate.key}: ${errorMessage}`);
          }
        }

        if (!dryRun) {
          await client.query('COMMIT');
        }

      } catch (error) {
        if (!dryRun) {
          await client.query('ROLLBACK');
        }
        throw error;
      } finally {
        client.release();
      }

      return {
        success: errors.length === 0,
        templatesSeeded,
        errors,
        warnings,
        seedingId
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Seeding operation failed: ${errorMessage}`);
      
      return {
        success: false,
        templatesSeeded: 0,
        errors,
        warnings,
        seedingId
      };
    }
  }

  /**
   * Rollback seeded templates
   */
  async rollbackSeeding(seedingId: string): Promise<RollbackResult> {
    const errors: string[] = [];
    let templatesRemoved = 0;

    try {
      const client = await this.db.connect();
      
      try {
        await client.query('BEGIN');

        // Find templates with the seeding ID
        const result = await this.templateRepository.findMany({
          isDefault: true
        });
        const templates = result.templates;

        const seededTemplates = templates.filter(template => 
          template.metadata?.seeding_id === seedingId
        );

        // Remove each seeded template
        for (const template of seededTemplates) {
          try {
            // Remove analytics data
            await client.query(
              'DELETE FROM prompt_template_usage WHERE template_id = $1',
              [template.id]
            );
            await client.query(
              'DELETE FROM prompt_template_metrics WHERE template_id = $1',
              [template.id]
            );

            // Remove versions
            await client.query(
              'DELETE FROM prompt_template_versions WHERE template_id = $1',
              [template.id]
            );

            // Remove template
            await client.query(
              'DELETE FROM prompt_templates WHERE id = $1',
              [template.id]
            );

            templatesRemoved++;

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            errors.push(`Failed to remove template ${template.key}: ${errorMessage}`);
          }
        }

        await client.query('COMMIT');

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      return {
        success: errors.length === 0,
        templatesRemoved,
        errors
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Rollback operation failed: ${errorMessage}`);
      
      return {
        success: false,
        templatesRemoved: 0,
        errors
      };
    }
  }

  /**
   * Validate a template before seeding
   */
  private validateTemplate(template: any): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!template.key || template.key.trim().length === 0) {
      errors.push('Template key is required');
    }

    if (!template.name || template.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!template.content || template.content.trim().length === 0) {
      errors.push('Template content is required');
    }

    if (!template.category || !Object.values(TemplateCategory).includes(template.category)) {
      errors.push('Valid template category is required');
    }

    // Content validation
    if (template.content && template.content.length < 10) {
      warnings.push('Template content is very short');
    }

    if (template.content && template.content.length > 10000) {
      warnings.push('Template content is very long');
    }

    // Variable validation
    if (template.variables && Array.isArray(template.variables)) {
      for (const variable of template.variables) {
        if (!variable.name || !variable.type || !variable.description) {
          errors.push(`Invalid variable definition: ${JSON.stringify(variable)}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get or create system user for template ownership
   */
  private async getOrCreateSystemUser(client: any, dryRun: boolean): Promise<string> {
    if (dryRun) {
      return 'dry-run-system-user';
    }

    // Try to find existing system user
    const result = await client.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1',
      ['system', 'system@promptlibrary.com']
    );

    if (result.rows.length > 0) {
      return result.rows[0].id;
    }

    // Create system user if it doesn't exist
    const createResult = await client.query(
      `INSERT INTO users (username, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (username) DO NOTHING
       RETURNING id`,
      ['system', 'system@promptlibrary.com', 'system-hash', 'admin']
    );

    if (createResult.rows.length > 0) {
      return createResult.rows[0].id;
    }

    // If still no user, get any admin user
    const adminResult = await client.query(
      'SELECT id FROM users WHERE role = $1 LIMIT 1',
      ['admin']
    );

    if (adminResult.rows.length > 0) {
      return adminResult.rows[0].id;
    }

    throw new Error('No admin user found and unable to create system user');
  }

  /**
   * Initialize metrics for a template
   */
  private async initializeTemplateMetrics(templateId: string): Promise<void> {
    const metrics = [
      { type: 'usage_count', value: 0 },
      { type: 'success_rate', value: 1.0 },
      { type: 'avg_render_time', value: 0 },
      { type: 'cache_hit_rate', value: 0 }
    ];

    // Record initial performance metrics
    await this.analyticsRepository.recordPerformanceMetrics(templateId, {
      renderTime: 0,
      cacheHit: false,
      variableCount: 0,
      contentLength: 0,
      timestamp: new Date()
    });
  }

  /**
   * Get seeding status and statistics
   */
  async getSeedingStatus(): Promise<{
    totalDefaultTemplates: number;
    seededTemplates: number;
    missingTemplates: string[];
    lastSeedingDate?: Date;
  }> {
    const totalDefaultTemplates = DEFAULT_TEMPLATES.length;
    
    const result = await this.templateRepository.findMany({
      isDefault: true
    });
    const seededTemplates = result.templates;

    const seededKeys = new Set(seededTemplates.map(t => t.key));
    const missingTemplates = DEFAULT_TEMPLATES
      .filter(t => !seededKeys.has(t.key))
      .map(t => t.key);

    // Find last seeding date
    let lastSeedingDate: Date | undefined;
    for (const template of seededTemplates) {
      if (template.metadata?.seeded_at) {
        const seedDate = new Date(template.metadata.seeded_at);
        if (!lastSeedingDate || seedDate > lastSeedingDate) {
          lastSeedingDate = seedDate;
        }
      }
    }

    return {
      totalDefaultTemplates,
      seededTemplates: seededTemplates.length,
      missingTemplates,
      lastSeedingDate
    };
  }
}