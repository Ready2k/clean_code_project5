/**
 * Model Storage Service
 * 
 * Handles database operations for provider models including CRUD operations,
 * model capability validation and storage, and model testing and availability tracking.
 */

import { getDatabaseService } from './database-service.js';
import { logger } from '../utils/logger.js';
import { AppError, ValidationError, NotFoundError } from '../types/errors.js';
import { 
  Model, 
  ModelRecord,
  CreateModelRequest,
  UpdateModelRequest,
  ModelQueryOptions,
  ModelStatus
} from '../types/dynamic-providers.js';

/**
 * Model storage service for database operations
 */
export class ModelStorageService {
  /**
   * Create a new model for a provider
   */
  async createModel(providerId: string, request: CreateModelRequest): Promise<Model> {
    const db = getDatabaseService();

    try {
      // Check if model with same identifier already exists for this provider
      const existing = await this.getModelByIdentifier(providerId, request.identifier);
      if (existing) {
        throw new ValidationError(`Model with identifier '${request.identifier}' already exists for this provider`);
      }

      // If this is set as default, unset other default models for the provider
      if (request.isDefault) {
        await this.unsetDefaultModels(providerId);
      }

      const result = await db.query<ModelRecord>(`
        INSERT INTO models (
          provider_id, identifier, name, description, context_length,
          capabilities, pricing_info, status, is_default
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        providerId,
        request.identifier,
        request.name,
        request.description || null,
        request.contextLength,
        JSON.stringify(request.capabilities),
        request.pricingInfo ? JSON.stringify(request.pricingInfo) : null,
        'active',
        request.isDefault || false
      ]);

      const model = this.mapRecordToModel(result.rows[0]!);

      logger.info('Model created successfully', {
        modelId: model.id,
        providerId,
        identifier: model.identifier,
        name: model.name
      });

      return model;

    } catch (error) {
      logger.error('Failed to create model:', error);
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to create model',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get model by ID
   */
  async getModel(id: string): Promise<Model> {
    const db = getDatabaseService();

    try {
      const result = await db.query<ModelRecord>(`
        SELECT * FROM models WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new NotFoundError(`Model with ID ${id} not found`);
      }

      return this.mapRecordToModel(result.rows[0]!);

    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Failed to get model:', error);
      throw new AppError(
        'Failed to retrieve model',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get model by provider ID and identifier
   */
  async getModelByIdentifier(providerId: string, identifier: string): Promise<Model | null> {
    const db = getDatabaseService();

    try {
      const result = await db.query<ModelRecord>(`
        SELECT * FROM models WHERE provider_id = $1 AND identifier = $2
      `, [providerId, identifier]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRecordToModel(result.rows[0]!);

    } catch (error) {
      logger.error('Failed to get model by identifier:', error);
      throw new AppError(
        'Failed to retrieve model',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get all models for a provider
   */
  async getProviderModels(providerId: string, options: Omit<ModelQueryOptions, 'providerId'> = {}): Promise<{
    models: Model[];
    total: number;
  }> {
    return this.getModels({ ...options, providerId });
  }

  /**
   * Get all models with optional filtering
   */
  async getModels(options: ModelQueryOptions = {}): Promise<{
    models: Model[];
    total: number;
  }> {
    const db = getDatabaseService();

    try {
      // Build WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (options.providerId) {
        conditions.push(`provider_id = $${paramIndex}`);
        params.push(options.providerId);
        paramIndex++;
      }

      if (options.status && options.status.length > 0) {
        conditions.push(`status = ANY($${paramIndex})`);
        params.push(options.status);
        paramIndex++;
      }

      if (options.isDefault !== undefined) {
        conditions.push(`is_default = $${paramIndex}`);
        params.push(options.isDefault);
        paramIndex++;
      }

      if (options.minContextLength !== undefined) {
        conditions.push(`context_length >= $${paramIndex}`);
        params.push(options.minContextLength);
        paramIndex++;
      }

      if (options.maxContextLength !== undefined) {
        conditions.push(`context_length <= $${paramIndex}`);
        params.push(options.maxContextLength);
        paramIndex++;
      }

      if (options.capabilities && options.capabilities.length > 0) {
        // Check if model has all specified capabilities
        const capabilityChecks = options.capabilities.map((capability) => {
          return `capabilities->>'${capability}' = 'true'`;
        });
        conditions.push(`(${capabilityChecks.join(' AND ')})`);
      }

      if (options.search) {
        const searchParam = `$${paramIndex}`;
        conditions.push(`(name ILIKE ${searchParam} OR description ILIKE ${searchParam} OR identifier ILIKE ${searchParam})`);
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
      const countQuery = `SELECT COUNT(*) as count FROM models ${whereClause}`;
      // Count query should only include filter parameters, not limit/offset
      const limitParamCount = options.limit ? (options.page && options.page > 1 ? 2 : 1) : 0;
      const countParams = params.slice(0, Math.max(0, params.length - limitParamCount));
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      // Get models
      const query = `SELECT * FROM models ${whereClause} ${orderClause} ${limitClause}`;
      const result = await db.query<ModelRecord>(query, params);

      const models = result.rows.map(record => this.mapRecordToModel(record));

      logger.debug('Retrieved models', {
        total,
        returned: models.length,
        filters: options
      });

      return { models, total };

    } catch (error) {
      logger.error('Failed to get models:', error);
      throw new AppError(
        'Failed to retrieve models',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Update model
   */
  async updateModel(id: string, request: UpdateModelRequest): Promise<Model> {
    const db = getDatabaseService();

    try {
      // Check if model exists
      const existingModel = await this.getModel(id);

      // If setting as default, unset other default models for the provider
      if (request.isDefault) {
        await this.unsetDefaultModels(existingModel.providerId);
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

      if (request.contextLength !== undefined) {
        updates.push(`context_length = $${paramIndex}`);
        params.push(request.contextLength);
        paramIndex++;
      }

      if (request.capabilities !== undefined) {
        updates.push(`capabilities = $${paramIndex}`);
        params.push(JSON.stringify(request.capabilities));
        paramIndex++;
      }

      if (request.pricingInfo !== undefined) {
        updates.push(`pricing_info = $${paramIndex}`);
        params.push(request.pricingInfo ? JSON.stringify(request.pricingInfo) : null);
        paramIndex++;
      }

      if (request.status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        params.push(request.status);
        paramIndex++;
      }

      if (request.isDefault !== undefined) {
        updates.push(`is_default = $${paramIndex}`);
        params.push(request.isDefault);
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
        UPDATE models 
        SET ${updates.join(', ')}
        WHERE id = $${idParam}
        RETURNING *
      `;

      const result = await db.query<ModelRecord>(query, params);

      if (result.rows.length === 0) {
        throw new NotFoundError(`Model with ID ${id} not found`);
      }

      const model = this.mapRecordToModel(result.rows[0]!);

      logger.info('Model updated successfully', {
        modelId: id,
        updatedFields: Object.keys(request)
      });

      return model;

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to update model:', error);
      throw new AppError(
        'Failed to update model',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Delete model
   */
  async deleteModel(id: string): Promise<void> {
    const db = getDatabaseService();

    try {
      // Check if model exists
      const model = await this.getModel(id);

      // Check if model is in use by any connections
      const connectionCheck = await db.query(`
        SELECT COUNT(*) as count 
        FROM connections 
        WHERE provider_id = $1 
        AND (
          selected_models::jsonb ? $2 
          OR default_model = $2
        )
      `, [model.providerId, model.identifier]);

      const connectionCount = parseInt(connectionCheck.rows[0].count);
      if (connectionCount > 0) {
        throw new ValidationError(`Cannot delete model: ${connectionCount} connections are using this model`);
      }

      // Delete the model
      const result = await db.query(`
        DELETE FROM models WHERE id = $1
      `, [id]);

      if (result.rowCount === 0) {
        throw new NotFoundError(`Model with ID ${id} not found`);
      }

      logger.info('Model deleted successfully', {
        modelId: id,
        identifier: model.identifier,
        providerId: model.providerId
      });

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to delete model:', error);
      throw new AppError(
        'Failed to delete model',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get default model for a provider
   */
  async getDefaultModel(providerId: string): Promise<Model | null> {
    const db = getDatabaseService();

    try {
      const result = await db.query<ModelRecord>(`
        SELECT * FROM models 
        WHERE provider_id = $1 AND is_default = true
        LIMIT 1
      `, [providerId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRecordToModel(result.rows[0]!);

    } catch (error) {
      logger.error('Failed to get default model:', error);
      throw new AppError(
        'Failed to retrieve default model',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Set model as default for provider
   */
  async setDefaultModel(id: string): Promise<void> {
    const db = getDatabaseService();

    try {
      const model = await this.getModel(id);
      
      await db.transaction(async (client) => {
        // Unset all default models for the provider
        await client.query(`
          UPDATE models SET is_default = false 
          WHERE provider_id = $1
        `, [model.providerId]);

        // Set this model as default
        await client.query(`
          UPDATE models SET is_default = true, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [id]);
      });

      logger.info('Default model updated', {
        modelId: id,
        providerId: model.providerId
      });

    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Failed to set default model:', error);
      throw new AppError(
        'Failed to set default model',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get model statistics for a provider
   */
  async getProviderModelStats(providerId: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    deprecated: number;
    hasDefault: boolean;
    averageContextLength: number;
    maxContextLength: number;
    minContextLength: number;
  }> {
    const db = getDatabaseService();

    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
          COUNT(*) FILTER (WHERE status = 'deprecated') as deprecated,
          COUNT(*) FILTER (WHERE is_default = true) as default_count,
          AVG(context_length) as avg_context_length,
          MAX(context_length) as max_context_length,
          MIN(context_length) as min_context_length
        FROM models
        WHERE provider_id = $1
      `, [providerId]);

      const row = result.rows[0];

      return {
        total: parseInt(row.total),
        active: parseInt(row.active),
        inactive: parseInt(row.inactive),
        deprecated: parseInt(row.deprecated),
        hasDefault: parseInt(row.default_count) > 0,
        averageContextLength: parseFloat(row.avg_context_length) || 0,
        maxContextLength: parseInt(row.max_context_length) || 0,
        minContextLength: parseInt(row.min_context_length) || 0
      };

    } catch (error) {
      logger.error('Failed to get provider model stats:', error);
      throw new AppError(
        'Failed to retrieve model statistics',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get global model statistics
   */
  async getGlobalModelStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    deprecated: number;
    byProvider: Record<string, number>;
    averageContextLength: number;
    maxContextLength: number;
  }> {
    const db = getDatabaseService();

    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
          COUNT(*) FILTER (WHERE status = 'deprecated') as deprecated,
          AVG(context_length) as avg_context_length,
          MAX(context_length) as max_context_length
        FROM models
      `);

      const providerResult = await db.query(`
        SELECT p.identifier, COUNT(m.id) as model_count
        FROM providers p
        LEFT JOIN models m ON p.id = m.provider_id
        GROUP BY p.id, p.identifier
      `);

      const row = result.rows[0];
      const byProvider: Record<string, number> = {};
      
      providerResult.rows.forEach(providerRow => {
        byProvider[providerRow.identifier] = parseInt(providerRow.model_count);
      });

      return {
        total: parseInt(row.total),
        active: parseInt(row.active),
        inactive: parseInt(row.inactive),
        deprecated: parseInt(row.deprecated),
        byProvider,
        averageContextLength: parseFloat(row.avg_context_length) || 0,
        maxContextLength: parseInt(row.max_context_length) || 0
      };

    } catch (error) {
      logger.error('Failed to get global model stats:', error);
      throw new AppError(
        'Failed to retrieve global model statistics',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Bulk update model status
   */
  async bulkUpdateModelStatus(modelIds: string[], status: ModelStatus): Promise<number> {
    const db = getDatabaseService();

    try {
      const result = await db.query(`
        UPDATE models 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ANY($2)
      `, [status, modelIds]);

      const updatedCount = result.rowCount || 0;

      logger.info('Bulk model status update completed', {
        modelIds,
        status,
        updatedCount
      });

      return updatedCount;

    } catch (error) {
      logger.error('Failed to bulk update model status:', error);
      throw new AppError(
        'Failed to bulk update model status',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Check if model identifier is available for a provider
   */
  async isIdentifierAvailable(providerId: string, identifier: string, excludeId?: string): Promise<boolean> {
    const db = getDatabaseService();

    try {
      let query = 'SELECT COUNT(*) as count FROM models WHERE provider_id = $1 AND identifier = $2';
      const params: any[] = [providerId, identifier];

      if (excludeId) {
        query += ' AND id != $3';
        params.push(excludeId);
      }

      const result = await db.query(query, params);
      const count = parseInt(result.rows[0].count);

      return count === 0;

    } catch (error) {
      logger.error('Failed to check model identifier availability:', error);
      throw new AppError(
        'Failed to check model identifier availability',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Unset all default models for a provider
   */
  async unsetDefaultModels(providerId: string): Promise<void> {
    const db = getDatabaseService();

    try {
      await db.query(`
        UPDATE models SET is_default = false 
        WHERE provider_id = $1 AND is_default = true
      `, [providerId]);

    } catch (error) {
      logger.error('Failed to unset default models:', error);
      throw new AppError(
        'Failed to unset default models',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Map database record to Model object
   */
  private mapRecordToModel(record: ModelRecord): Model {
    const model: Model = {
      id: record.id,
      providerId: record.provider_id,
      identifier: record.identifier,
      name: record.name,
      contextLength: record.context_length,
      capabilities: typeof record.capabilities === 'string' ? JSON.parse(record.capabilities) : record.capabilities,
      status: record.status,
      isDefault: record.is_default,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };

    if (record.description) {
      model.description = record.description;
    }

    if (record.pricing_info) {
      model.pricingInfo = typeof record.pricing_info === 'string' ? JSON.parse(record.pricing_info) : record.pricing_info;
    }

    return model;
  }
}

// Singleton instance
let modelStorageService: ModelStorageService | null = null;

/**
 * Get the model storage service instance
 */
export function getModelStorageService(): ModelStorageService {
  if (!modelStorageService) {
    modelStorageService = new ModelStorageService();
  }
  return modelStorageService;
}