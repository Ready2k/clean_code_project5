import { PoolClient } from 'pg';
import { getDatabaseService } from '../services/database-service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../types/errors.js';
import {
  TemplateInfo,
  TemplateCategory,
  TemplateFilters,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateVariable,
  TemplateMetadata
} from '../types/prompt-templates.js';

/**
 * Repository for template data access operations
 * Implements optimized queries with proper indexing, transaction support,
 * and soft delete functionality
 */
export class TemplateRepository {
  private db = getDatabaseService();

  /**
   * Create a new template
   */
  async create(
    template: CreateTemplateRequest,
    userId?: string
  ): Promise<TemplateInfo> {
    return this.db.transaction(async (client) => {
      // Check for existing template with same category/key
      const existingQuery = `
        SELECT id FROM prompt_templates 
        WHERE category = $1 AND key = $2 AND is_active = true
      `;
      const existing = await client.query(existingQuery, [template.category, template.key]);
      
      if (existing.rows.length > 0) {
        throw new AppError(
          `Template with key '${template.key}' already exists in category '${template.category}'`,
          409,
          'TEMPLATE_EXISTS' as any
        );
      }

      // Insert new template
      const insertQuery = `
        INSERT INTO prompt_templates (
          category, key, name, description, content, variables, metadata,
          is_active, is_default, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
        RETURNING *
      `;

      const values = [
        template.category,
        template.key,
        template.name,
        template.description,
        template.content,
        JSON.stringify(template.variables || []),
        JSON.stringify(template.metadata || {}),
        template.isActive ?? true,
        template.isDefault ?? false,
        userId
      ];

      const result = await client.query(insertQuery, values);
      const row = result.rows[0];

      logger.info('Template created successfully', {
        templateId: row.id,
        category: template.category,
        key: template.key,
        userId
      });

      return this.mapRowToTemplateInfo(row);
    });
  }

  /**
   * Get template by ID
   */
  async findById(id: string): Promise<TemplateInfo | null> {
    const query = `
      SELECT t.*, 
             COALESCE(u.usage_count, 0) as usage_count,
             COALESCE(v.max_version, 0) as version
      FROM prompt_templates t
      LEFT JOIN (
        SELECT template_id, COUNT(*) as usage_count
        FROM prompt_template_usage
        GROUP BY template_id
      ) u ON t.id = u.template_id
      LEFT JOIN (
        SELECT template_id, MAX(version_number) as max_version
        FROM prompt_template_versions
        GROUP BY template_id
      ) v ON t.id = v.template_id
      WHERE t.id = $1 AND t.is_active = true
    `;

    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTemplateInfo(result.rows[0]);
  }

  /**
   * Get template by category and key
   */
  async findByCategoryAndKey(
    category: TemplateCategory,
    key: string
  ): Promise<TemplateInfo | null> {
    const query = `
      SELECT t.*, 
             COALESCE(u.usage_count, 0) as usage_count,
             COALESCE(v.max_version, 0) as version
      FROM prompt_templates t
      LEFT JOIN (
        SELECT template_id, COUNT(*) as usage_count
        FROM prompt_template_usage
        GROUP BY template_id
      ) u ON t.id = u.template_id
      LEFT JOIN (
        SELECT template_id, MAX(version_number) as max_version
        FROM prompt_template_versions
        GROUP BY template_id
      ) v ON t.id = v.template_id
      WHERE t.category = $1 AND t.key = $2 AND t.is_active = true
    `;

    const result = await this.db.query(query, [category, key]);
    
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToTemplateInfo(result.rows[0]);
  }

  /**
   * List templates with filtering and pagination
   */
  async findMany(filters: TemplateFilters = {}): Promise<{
    templates: TemplateInfo[];
    total: number;
    hasMore: boolean;
  }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE conditions
    if (filters.category) {
      conditions.push(`t.category = $${paramIndex++}`);
      params.push(filters.category);
    }

    if (filters.isActive !== undefined) {
      conditions.push(`t.is_active = $${paramIndex++}`);
      params.push(filters.isActive);
    }

    if (filters.isDefault !== undefined) {
      conditions.push(`t.is_default = $${paramIndex++}`);
      params.push(filters.isDefault);
    }

    if (filters.search) {
      conditions.push(`(
        t.name ILIKE $${paramIndex} OR 
        t.description ILIKE $${paramIndex} OR 
        t.content ILIKE $${paramIndex}
      )`);
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters.tags && filters.tags.length > 0) {
      conditions.push(`t.metadata->>'tags' ?| $${paramIndex++}`);
      params.push(filters.tags);
    }

    if (filters.provider) {
      conditions.push(`t.metadata->'provider_optimized' ? $${paramIndex++}`);
      params.push(filters.provider);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query for total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM prompt_templates t
      ${whereClause}
    `;

    // Main query with pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const query = `
      SELECT t.*, 
             COALESCE(u.usage_count, 0) as usage_count,
             COALESCE(v.max_version, 0) as version
      FROM prompt_templates t
      LEFT JOIN (
        SELECT template_id, COUNT(*) as usage_count
        FROM prompt_template_usage
        GROUP BY template_id
      ) u ON t.id = u.template_id
      LEFT JOIN (
        SELECT template_id, MAX(version_number) as max_version
        FROM prompt_template_versions
        GROUP BY template_id
      ) v ON t.id = v.template_id
      ${whereClause}
      ORDER BY t.updated_at DESC, t.name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(limit, offset);

    const [countResult, templatesResult] = await Promise.all([
      this.db.query(countQuery, params.slice(0, -2)),
      this.db.query(query, params)
    ]);

    const total = parseInt(countResult.rows[0].total);
    const templates = templatesResult.rows.map(row => this.mapRowToTemplateInfo(row));

    return {
      templates,
      total,
      hasMore: offset + templates.length < total
    };
  }

  /**
   * Update template
   */
  async update(
    id: string,
    updates: UpdateTemplateRequest,
    userId?: string
  ): Promise<TemplateInfo> {
    return this.db.transaction(async (client) => {
      // Check if template exists
      const existingQuery = `SELECT * FROM prompt_templates WHERE id = $1 AND is_active = true`;
      const existing = await client.query(existingQuery, [id]);
      
      if (existing.rows.length === 0) {
        throw new AppError(
          `Template with ID '${id}' not found`,
          404,
          'TEMPLATE_NOT_FOUND' as any
        );
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        params.push(updates.name);
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        params.push(updates.description);
      }

      if (updates.content !== undefined) {
        updateFields.push(`content = $${paramIndex++}`);
        params.push(updates.content);
      }

      if (updates.variables !== undefined) {
        updateFields.push(`variables = $${paramIndex++}`);
        params.push(JSON.stringify(updates.variables));
      }

      if (updates.metadata !== undefined) {
        updateFields.push(`metadata = $${paramIndex++}`);
        params.push(JSON.stringify(updates.metadata));
      }

      if (updates.isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        params.push(updates.isActive);
      }

      if (updateFields.length === 0) {
        // No updates, return existing template
        return this.mapRowToTemplateInfo(existing.rows[0]);
      }

      // Add updated_by and updated_at
      updateFields.push(`updated_by = $${paramIndex++}`);
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(userId);

      // Add ID for WHERE clause
      params.push(id);

      const updateQuery = `
        UPDATE prompt_templates 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await client.query(updateQuery, params);
      const row = result.rows[0];

      logger.info('Template updated successfully', {
        templateId: id,
        updatedFields: Object.keys(updates),
        userId
      });

      return this.mapRowToTemplateInfo(row);
    });
  }

  /**
   * Soft delete template (set is_active = false)
   */
  async softDelete(id: string, userId?: string): Promise<void> {
    return this.db.transaction(async (client) => {
      const query = `
        UPDATE prompt_templates 
        SET is_active = false, updated_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_active = true
        RETURNING id
      `;

      const result = await client.query(query, [id, userId]);
      
      if (result.rows.length === 0) {
        throw new AppError(
          `Template with ID '${id}' not found or already deleted`,
          404,
          'TEMPLATE_NOT_FOUND' as any
        );
      }

      logger.info('Template soft deleted successfully', {
        templateId: id,
        userId
      });
    });
  }

  /**
   * Archive template (for data retention)
   */
  async archive(id: string, userId?: string): Promise<void> {
    return this.db.transaction(async (client) => {
      // Update template metadata to mark as archived
      const query = `
        UPDATE prompt_templates 
        SET metadata = metadata || '{"archived": true, "archived_at": "${new Date().toISOString()}"}'::jsonb,
            updated_by = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND is_active = true
        RETURNING id
      `;

      const result = await client.query(query, [id, userId]);
      
      if (result.rows.length === 0) {
        throw new AppError(
          `Template with ID '${id}' not found`,
          404,
          'TEMPLATE_NOT_FOUND' as any
        );
      }

      logger.info('Template archived successfully', {
        templateId: id,
        userId
      });
    });
  }

  /**
   * Restore archived template
   */
  async restore(id: string, userId?: string): Promise<void> {
    return this.db.transaction(async (client) => {
      const query = `
        UPDATE prompt_templates 
        SET metadata = metadata - 'archived' - 'archived_at',
            is_active = true,
            updated_by = $2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id
      `;

      const result = await client.query(query, [id, userId]);
      
      if (result.rows.length === 0) {
        throw new AppError(
          `Template with ID '${id}' not found`,
          404,
          'TEMPLATE_NOT_FOUND' as any
        );
      }

      logger.info('Template restored successfully', {
        templateId: id,
        userId
      });
    });
  }

  /**
   * Get templates by category with usage statistics
   */
  async findByCategory(category: TemplateCategory): Promise<TemplateInfo[]> {
    const query = `
      SELECT t.*, 
             COALESCE(u.usage_count, 0) as usage_count,
             COALESCE(v.max_version, 0) as version
      FROM prompt_templates t
      LEFT JOIN (
        SELECT template_id, COUNT(*) as usage_count
        FROM prompt_template_usage
        GROUP BY template_id
      ) u ON t.id = u.template_id
      LEFT JOIN (
        SELECT template_id, MAX(version_number) as max_version
        FROM prompt_template_versions
        GROUP BY template_id
      ) v ON t.id = v.template_id
      WHERE t.category = $1 AND t.is_active = true
      ORDER BY t.name ASC
    `;

    const result = await this.db.query(query, [category]);
    return result.rows.map(row => this.mapRowToTemplateInfo(row));
  }

  /**
   * Get default templates for a category
   */
  async findDefaultsByCategory(category: TemplateCategory): Promise<TemplateInfo[]> {
    const query = `
      SELECT t.*, 
             COALESCE(u.usage_count, 0) as usage_count,
             COALESCE(v.max_version, 0) as version
      FROM prompt_templates t
      LEFT JOIN (
        SELECT template_id, COUNT(*) as usage_count
        FROM prompt_template_usage
        GROUP BY template_id
      ) u ON t.id = u.template_id
      LEFT JOIN (
        SELECT template_id, MAX(version_number) as max_version
        FROM prompt_template_versions
        GROUP BY template_id
      ) v ON t.id = v.template_id
      WHERE t.category = $1 AND t.is_default = true AND t.is_active = true
      ORDER BY t.name ASC
    `;

    const result = await this.db.query(query, [category]);
    return result.rows.map(row => this.mapRowToTemplateInfo(row));
  }

  /**
   * Execute atomic operations within a transaction
   */
  async executeInTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    return this.db.transaction(callback);
  }

  /**
   * Map database row to TemplateInfo object
   */
  private mapRowToTemplateInfo(row: any): TemplateInfo {
    return {
      id: row.id,
      category: row.category as TemplateCategory,
      key: row.key,
      name: row.name,
      description: row.description || '',
      content: row.content,
      variables: (row.variables || []) as TemplateVariable[],
      metadata: (row.metadata || {}) as TemplateMetadata,
      isActive: row.is_active,
      isDefault: row.is_default,
      version: row.version || 0,
      lastModified: new Date(row.updated_at),
      createdAt: new Date(row.created_at),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      usageCount: parseInt(row.usage_count || '0')
    };
  }
}