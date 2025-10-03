/**
 * Template Storage Service
 * 
 * Handles database operations for provider templates including CRUD operations,
 * template instantiation and customization logic, and system template management.
 */

import { getDatabaseService } from './database-service.js';
import { logger } from '../utils/logger.js';
import { AppError, ValidationError, NotFoundError } from '../types/errors.js';
import { 
  ProviderTemplate, 
  ProviderTemplateRecord,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  CreateProviderRequest
} from '../types/dynamic-providers.js';

/**
 * Template storage service for database operations
 */
export class TemplateStorageService {
  /**
   * Create a new provider template
   */
  async createTemplate(request: CreateTemplateRequest, createdBy?: string): Promise<ProviderTemplate> {
    const db = getDatabaseService();

    try {
      // Check if template with same name already exists
      const existing = await this.getTemplateByName(request.name);
      if (existing) {
        throw new ValidationError(`Template with name '${request.name}' already exists`);
      }

      const result = await db.query<ProviderTemplateRecord>(`
        INSERT INTO provider_templates (
          name, description, provider_config, default_models, is_system, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        request.name,
        request.description || null,
        JSON.stringify(request.providerConfig),
        JSON.stringify(request.defaultModels),
        false, // User-created templates are not system templates
        createdBy || null
      ]);

      const template = this.mapRecordToTemplate(result.rows[0]!);

      logger.info('Template created successfully', {
        templateId: template.id,
        name: template.name,
        createdBy
      });

      return template;

    } catch (error) {
      logger.error('Failed to create template:', error);
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to create template',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(id: string): Promise<ProviderTemplate> {
    const db = getDatabaseService();

    try {
      const result = await db.query<ProviderTemplateRecord>(`
        SELECT * FROM provider_templates WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError(`Template with ID ${id} not found`);
      }

      return this.mapRecordToTemplate(result.rows[0]!);

    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Failed to get template:', error);
      throw new AppError(
        'Failed to retrieve template',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get template by name
   */
  async getTemplateByName(name: string): Promise<ProviderTemplate | null> {
    const db = getDatabaseService();

    try {
      const result = await db.query<ProviderTemplateRecord>(`
        SELECT * FROM provider_templates WHERE name = $1
      `, [name]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRecordToTemplate(result.rows[0]!);

    } catch (error) {
      logger.error('Failed to get template by name:', error);
      throw new AppError(
        'Failed to retrieve template',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get all templates with optional filtering
   */
  async getTemplates(options: {
    isSystem?: boolean;
    search?: string;
    sortBy?: 'name' | 'created_at' | 'updated_at';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  } = {}): Promise<{
    templates: ProviderTemplate[];
    total: number;
  }> {
    const db = getDatabaseService();

    try {
      // Build WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (options.isSystem !== undefined) {
        conditions.push(`is_system = $${paramIndex}`);
        params.push(options.isSystem);
        paramIndex++;
      }

      if (options.search) {
        conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
        params.push(`%${options.search}%`);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Build ORDER BY clause
      const sortBy = options.sortBy || 'created_at';
      const sortOrder = options.sortOrder || 'desc';
      const orderClause = `ORDER BY ${sortBy} ${sortOrder}`;

      // Build LIMIT and OFFSET
      let limitClause = '';
      if (options.limit) {
        limitClause = `LIMIT $${paramIndex}`;
        params.push(options.limit);
        paramIndex++;

        if (options.page && options.page > 1) {
          limitClause += ` OFFSET $${paramIndex}`;
          params.push((options.page - 1) * options.limit);
          paramIndex++;
        }
      }

      // Get total count
      const countQuery = `SELECT COUNT(*) as count FROM provider_templates ${whereClause}`;
      const countParams = params.slice(0, paramIndex - (options.limit ? (options.page ? 2 : 1) : 0));
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      // Get templates
      const query = `SELECT * FROM provider_templates ${whereClause} ${orderClause} ${limitClause}`;
      const result = await db.query<ProviderTemplateRecord>(query, params);

      const templates = result.rows.map(record => this.mapRecordToTemplate(record));

      logger.debug('Retrieved templates', {
        total,
        returned: templates.length,
        filters: options
      });

      return { templates, total };

    } catch (error) {
      logger.error('Failed to get templates:', error);
      throw new AppError(
        'Failed to retrieve templates',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Update template
   */
  async updateTemplate(id: string, request: UpdateTemplateRequest): Promise<ProviderTemplate> {
    const db = getDatabaseService();

    try {
      // Check if template exists
      const existingTemplate = await this.getTemplate(id);

      // Check if it's a system template
      if (existingTemplate.isSystem) {
        throw new ValidationError('Cannot update system template');
      }

      // Check if name is being changed and if it conflicts
      if (request.name && request.name !== existingTemplate.name) {
        const existing = await this.getTemplateByName(request.name);
        if (existing && existing.id !== id) {
          throw new ValidationError(`Template with name '${request.name}' already exists`);
        }
      }

      // Build update query dynamically
      const updates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (request.name !== undefined) {
        updates.push(`name = $${paramIndex}`);
        params.push(request.name);
        paramIndex++;
      }

      if (request.description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        params.push(request.description || null);
        paramIndex++;
      }

      if (request.providerConfig !== undefined) {
        updates.push(`provider_config = $${paramIndex}`);
        params.push(JSON.stringify(request.providerConfig));
        paramIndex++;
      }

      if (request.defaultModels !== undefined) {
        updates.push(`default_models = $${paramIndex}`);
        params.push(JSON.stringify(request.defaultModels));
        paramIndex++;
      }

      if (updates.length === 0) {
        throw new ValidationError('No fields to update');
      }

      // Add updated_at
      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      // Add ID parameter
      params.push(id);
      const idParam = paramIndex;

      const query = `
        UPDATE provider_templates 
        SET ${updates.join(', ')}
        WHERE id = $${idParam}
        RETURNING *
      `;

      const result = await db.query<ProviderTemplateRecord>(query, params);

      if (result.rows.length === 0) {
        throw new NotFoundError(`Template with ID ${id} not found`);
      }

      const template = this.mapRecordToTemplate(result.rows[0]!);

      logger.info('Template updated successfully', {
        templateId: id,
        updatedFields: Object.keys(request)
      });

      return template;

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to update template:', error);
      throw new AppError(
        'Failed to update template',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string): Promise<void> {
    const db = getDatabaseService();

    try {
      // Check if template exists
      const template = await this.getTemplate(id);

      // Check if it's a system template
      if (template.isSystem) {
        throw new ValidationError('Cannot delete system template');
      }

      // Delete the template
      const result = await db.query(`
        DELETE FROM provider_templates WHERE id = $1
      `, [id]);

      if (result.rowCount === 0) {
        throw new NotFoundError(`Template with ID ${id} not found`);
      }

      logger.info('Template deleted successfully', {
        templateId: id,
        name: template.name
      });

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to delete template:', error);
      throw new AppError(
        'Failed to delete template',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get system templates
   */
  async getSystemTemplates(): Promise<ProviderTemplate[]> {
    const result = await this.getTemplates({ isSystem: true });
    return result.templates;
  }

  /**
   * Get user templates
   */
  async getUserTemplates(): Promise<ProviderTemplate[]> {
    const result = await this.getTemplates({ isSystem: false });
    return result.templates;
  }

  /**
   * Instantiate template to create provider configuration
   */
  instantiateTemplate(
    template: ProviderTemplate,
    customizations?: {
      name?: string;
      description?: string;
      authConfig?: Record<string, any>;
      selectedModels?: string[];
    }
  ): CreateProviderRequest {
    try {
      const config = template.providerConfig;
      
      // Create base provider request from template
      const providerRequest: CreateProviderRequest = {
        identifier: this.generateProviderIdentifier(customizations?.name || config.name),
        name: customizations?.name || config.name,
        apiEndpoint: config.apiEndpoint,
        authMethod: config.authMethod,
        authConfig: { ...config.authConfig },
        capabilities: { ...config.capabilities } as any
      };

      // Add description if available
      const description = customizations?.description ?? config.description;
      if (description) {
        providerRequest.description = description;
      }

      // Apply auth config customizations
      if (customizations?.authConfig) {
        // Merge customizations into auth config fields
        if (providerRequest.authConfig.fields) {
          Object.keys(customizations.authConfig).forEach(key => {
            if (providerRequest.authConfig.fields[key]) {
              // Update field default value
              providerRequest.authConfig.fields[key].default = customizations.authConfig![key];
            }
          });
        }
      }

      logger.info('Template instantiated', {
        templateId: template.id,
        templateName: template.name,
        providerName: providerRequest.name
      });

      return providerRequest;

    } catch (error) {
      logger.error('Failed to instantiate template:', error);
      throw new AppError(
        'Failed to instantiate template',
        500,
        'TEMPLATE_INSTANTIATION_ERROR' as any
      );
    }
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(): Promise<{
    total: number;
    system: number;
    user: number;
    mostUsed?: {
      templateId: string;
      name: string;
      usageCount: number;
    };
  }> {
    const db = getDatabaseService();

    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_system = true) as system,
          COUNT(*) FILTER (WHERE is_system = false) as user
        FROM provider_templates
      `);

      // Get most used template (based on providers created with similar names)
      const usageResult = await db.query(`
        SELECT 
          pt.id,
          pt.name,
          COUNT(p.id) as usage_count
        FROM provider_templates pt
        LEFT JOIN providers p ON LOWER(p.name) LIKE LOWER('%' || pt.name || '%')
        WHERE NOT pt.is_system
        GROUP BY pt.id, pt.name
        ORDER BY usage_count DESC
        LIMIT 1
      `);

      const row = result.rows[0];
      const mostUsed = usageResult.rows.length > 0 ? {
        templateId: usageResult.rows[0].id,
        name: usageResult.rows[0].name,
        usageCount: parseInt(usageResult.rows[0].usage_count)
      } : undefined;

      return {
        total: parseInt(row.total),
        system: parseInt(row.system),
        user: parseInt(row.user),
        ...(mostUsed && { mostUsed })
      };

    } catch (error) {
      logger.error('Failed to get template stats:', error);
      throw new AppError(
        'Failed to retrieve template statistics',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Check if template name is available
   */
  async isNameAvailable(name: string, excludeId?: string): Promise<boolean> {
    const db = getDatabaseService();

    try {
      let query = 'SELECT COUNT(*) as count FROM provider_templates WHERE name = $1';
      const params: any[] = [name];

      if (excludeId) {
        query += ' AND id != $2';
        params.push(excludeId);
      }

      const result = await db.query(query, params);
      const count = parseInt(result.rows[0].count);

      return count === 0;

    } catch (error) {
      logger.error('Failed to check template name availability:', error);
      throw new AppError(
        'Failed to check template name availability',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Clone template (create a copy)
   */
  async cloneTemplate(id: string, newName: string, createdBy?: string): Promise<ProviderTemplate> {
    try {
      const originalTemplate = await this.getTemplate(id);

      // Check if new name is available
      const nameAvailable = await this.isNameAvailable(newName);
      if (!nameAvailable) {
        throw new ValidationError(`Template with name '${newName}' already exists`);
      }

      const cloneRequest: CreateTemplateRequest = {
        name: newName,
        description: `Copy of ${originalTemplate.name}`,
        providerConfig: originalTemplate.providerConfig,
        defaultModels: originalTemplate.defaultModels
      };

      const clonedTemplate = await this.createTemplate(cloneRequest, createdBy);

      logger.info('Template cloned successfully', {
        originalId: id,
        clonedId: clonedTemplate.id,
        newName
      });

      return clonedTemplate;

    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Failed to clone template:', error);
      throw new AppError(
        'Failed to clone template',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Generate unique provider identifier from name
   */
  private generateProviderIdentifier(name: string): string {
    // Convert to lowercase, replace spaces and special chars with hyphens
    let identifier = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Add timestamp suffix to ensure uniqueness
    const timestamp = Date.now().toString().slice(-6);
    identifier = `${identifier}-${timestamp}`;

    return identifier;
  }

  /**
   * Map database record to ProviderTemplate object
   */
  private mapRecordToTemplate(record: ProviderTemplateRecord): ProviderTemplate {
    const template: ProviderTemplate = {
      id: record.id,
      name: record.name,
      providerConfig: typeof record.provider_config === 'string' 
        ? JSON.parse(record.provider_config) 
        : record.provider_config,
      defaultModels: typeof record.default_models === 'string' 
        ? JSON.parse(record.default_models) 
        : record.default_models,
      isSystem: record.is_system,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };

    if (record.description) {
      template.description = record.description;
    }

    if (record.created_by) {
      template.createdBy = record.created_by;
    }

    return template;
  }
}

// Singleton instance
let templateStorageService: TemplateStorageService | null = null;

/**
 * Get the template storage service instance
 */
export function getTemplateStorageService(): TemplateStorageService {
  if (!templateStorageService) {
    templateStorageService = new TemplateStorageService();
  }
  return templateStorageService;
}