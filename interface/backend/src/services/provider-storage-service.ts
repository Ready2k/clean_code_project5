/**
 * Provider Storage Service
 * 
 * Handles database operations for dynamic providers including CRUD operations,
 * encryption/decryption of sensitive configuration data, and provider testing results.
 */

import { getDatabaseService } from './database-service.js';
import { EncryptionService } from './encryption-service.js';
import { logger } from '../utils/logger.js';
import { AppError, ValidationError, NotFoundError } from '../types/errors.js';
import { 
  Provider, 
  ProviderRecord,
  CreateProviderRequest,
  UpdateProviderRequest,
  ProviderTestResult,
  ProviderQueryOptions,
  AuthMethod
} from '../types/dynamic-providers.js';

/**
 * Provider storage service for database operations
 */
export class ProviderStorageService {
  /**
   * Create a new provider
   */
  async createProvider(request: CreateProviderRequest, createdBy?: string): Promise<Provider> {
    const db = getDatabaseService();

    try {
      // Check if provider with same identifier already exists
      const existing = await this.getProviderByIdentifier(request.identifier);
      if (existing) {
        throw new ValidationError(`Provider with identifier '${request.identifier}' already exists`);
      }

      // Encrypt sensitive auth configuration
      const encryptedAuthConfig = EncryptionService.encryptConfig(request.authConfig);

      const result = await db.query<ProviderRecord>(`
        INSERT INTO providers (
          identifier, name, description, api_endpoint, auth_method, 
          auth_config, capabilities, status, is_system, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        request.identifier,
        request.name,
        request.description || null,
        request.apiEndpoint,
        request.authMethod,
        encryptedAuthConfig,
        JSON.stringify(request.capabilities),
        'active',
        false, // User-created providers are not system providers
        createdBy || null
      ]);

      if (!result.rows[0]) {
        throw new AppError('Failed to create provider', 500, 'CREATION_FAILED' as any);
      }
      const provider = this.mapRecordToProvider(result.rows[0]);

      logger.info('Provider created successfully', {
        providerId: provider.id,
        identifier: provider.identifier,
        name: provider.name,
        createdBy
      });

      return provider;

    } catch (error) {
      logger.error('Failed to create provider:', error);
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to create provider',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get provider by ID
   */
  async getProvider(id: string): Promise<Provider> {
    const db = getDatabaseService();

    try {
      const result = await db.query<ProviderRecord>(`
        SELECT * FROM providers WHERE id = $1
      `, [id]);

      if (result.rows.length === 0 || !result.rows[0]) {
        throw new NotFoundError(`Provider with ID ${id} not found`);
      }

      return this.mapRecordToProvider(result.rows[0]);

    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Failed to get provider:', error);
      throw new AppError(
        'Failed to retrieve provider',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get provider by identifier
   */
  async getProviderByIdentifier(identifier: string): Promise<Provider | null> {
    const db = getDatabaseService();

    try {
      const result = await db.query<ProviderRecord>(`
        SELECT * FROM providers WHERE identifier = $1
      `, [identifier]);

      if (result.rows.length === 0 || !result.rows[0]) {
        return null;
      }

      return this.mapRecordToProvider(result.rows[0]);

    } catch (error) {
      logger.error('Failed to get provider by identifier:', error);
      throw new AppError(
        'Failed to retrieve provider',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get all providers with optional filtering
   */
  async getProviders(options: ProviderQueryOptions = {}): Promise<{
    providers: Provider[];
    total: number;
  }> {
    const db = getDatabaseService();

    try {
      // Build WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (options.status && options.status.length > 0) {
        conditions.push(`status = ANY($${paramIndex})`);
        params.push(options.status);
        paramIndex++;
      }

      if (options.authMethod && options.authMethod.length > 0) {
        conditions.push(`auth_method = ANY($${paramIndex})`);
        params.push(options.authMethod);
        paramIndex++;
      }

      if (options.isSystem !== undefined) {
        conditions.push(`is_system = $${paramIndex}`);
        params.push(options.isSystem);
        paramIndex++;
      }

      if (options.search) {
        conditions.push(`(name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR identifier ILIKE $${paramIndex})`);
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
      const countQuery = `SELECT COUNT(*) as count FROM providers ${whereClause}`;
      const countResult = await db.query(countQuery, params.slice(0, paramIndex - (options.limit ? (options.page ? 2 : 1) : 0)));
      const total = parseInt(countResult.rows[0].count);

      // Get providers
      const query = `SELECT * FROM providers ${whereClause} ${orderClause} ${limitClause}`;
      const result = await db.query<ProviderRecord>(query, params);

      const providers = result.rows.map(record => this.mapRecordToProvider(record));

      logger.debug('Retrieved providers', {
        total,
        returned: providers.length,
        filters: options
      });

      return { providers, total };

    } catch (error) {
      logger.error('Failed to get providers:', error);
      throw new AppError(
        'Failed to retrieve providers',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Update provider
   */
  async updateProvider(id: string, request: UpdateProviderRequest): Promise<Provider> {
    const db = getDatabaseService();

    try {
      // Check if provider exists
      await this.getProvider(id);

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

      if (request.apiEndpoint !== undefined) {
        updates.push(`api_endpoint = $${paramIndex}`);
        params.push(request.apiEndpoint);
        paramIndex++;
      }

      if (request.authConfig !== undefined) {
        const encryptedAuthConfig = EncryptionService.encryptConfig(request.authConfig);
        updates.push(`auth_config = $${paramIndex}`);
        params.push(encryptedAuthConfig);
        paramIndex++;
      }

      if (request.capabilities !== undefined) {
        updates.push(`capabilities = $${paramIndex}`);
        params.push(JSON.stringify(request.capabilities));
        paramIndex++;
      }

      if (request.status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        params.push(request.status);
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
        UPDATE providers 
        SET ${updates.join(', ')}
        WHERE id = $${idParam}
        RETURNING *
      `;

      const result = await db.query<ProviderRecord>(query, params);

      if (result.rows.length === 0 || !result.rows[0]) {
        throw new NotFoundError(`Provider with ID ${id} not found`);
      }

      const provider = this.mapRecordToProvider(result.rows[0]);

      logger.info('Provider updated successfully', {
        providerId: id,
        updatedFields: Object.keys(request)
      });

      return provider;

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to update provider:', error);
      throw new AppError(
        'Failed to update provider',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Delete provider
   */
  async deleteProvider(id: string): Promise<void> {
    const db = getDatabaseService();

    try {
      // Check if provider exists and is not a system provider
      const provider = await this.getProvider(id);
      
      if (provider.isSystem) {
        throw new ValidationError('Cannot delete system provider');
      }

      // Check if provider is in use by any connections
      const connectionCheck = await db.query(`
        SELECT COUNT(*) as count FROM connections WHERE provider_id = $1
      `, [id]);

      const connectionCount = parseInt(connectionCheck.rows[0].count);
      if (connectionCount > 0) {
        throw new ValidationError(`Cannot delete provider: ${connectionCount} connections are using this provider`);
      }

      // Delete the provider (models will be cascade deleted)
      const result = await db.query(`
        DELETE FROM providers WHERE id = $1
      `, [id]);

      if (result.rowCount === 0) {
        throw new NotFoundError(`Provider with ID ${id} not found`);
      }

      logger.info('Provider deleted successfully', {
        providerId: id,
        identifier: provider.identifier
      });

    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }

      logger.error('Failed to delete provider:', error);
      throw new AppError(
        'Failed to delete provider',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get decrypted auth configuration for a provider
   */
  async getDecryptedAuthConfig(id: string): Promise<any> {
    const db = getDatabaseService();

    try {
      const result = await db.query<{ auth_config: string }>(`
        SELECT auth_config FROM providers WHERE id = $1
      `, [id]);

      if (result.rows.length === 0 || !result.rows[0]) {
        throw new NotFoundError(`Provider with ID ${id} not found`);
      }

      return EncryptionService.decryptConfig(result.rows[0].auth_config);

    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Failed to get decrypted auth config:', error);
      throw new AppError(
        'Failed to retrieve provider configuration',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Update provider test result
   */
  async updateProviderTestResult(id: string, testResult: ProviderTestResult): Promise<void> {
    const db = getDatabaseService();

    try {
      const result = await db.query(`
        UPDATE providers 
        SET 
          last_tested = $1,
          test_result = $2,
          status = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [
        testResult.testedAt,
        JSON.stringify(testResult),
        testResult.success ? 'active' : 'error',
        id
      ]);

      if (result.rowCount === 0) {
        throw new NotFoundError(`Provider with ID ${id} not found`);
      }

      logger.debug('Provider test result updated', {
        providerId: id,
        success: testResult.success,
        latency: testResult.latency
      });

    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      logger.error('Failed to update provider test result:', error);
      throw new AppError(
        'Failed to update provider test result',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get provider statistics
   */
  async getProviderStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    testing: number;
    system: number;
    custom: number;
    byAuthMethod: Record<AuthMethod, number>;
  }> {
    const db = getDatabaseService();

    try {
      const result = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'active') as active,
          COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
          COUNT(*) FILTER (WHERE status = 'testing') as testing,
          COUNT(*) FILTER (WHERE is_system = true) as system,
          COUNT(*) FILTER (WHERE is_system = false) as custom,
          COUNT(*) FILTER (WHERE auth_method = 'api_key') as api_key,
          COUNT(*) FILTER (WHERE auth_method = 'oauth2') as oauth2,
          COUNT(*) FILTER (WHERE auth_method = 'aws_iam') as aws_iam,
          COUNT(*) FILTER (WHERE auth_method = 'custom') as custom_auth
        FROM providers
      `);

      const row = result.rows[0];

      return {
        total: parseInt(row.total),
        active: parseInt(row.active),
        inactive: parseInt(row.inactive),
        testing: parseInt(row.testing),
        system: parseInt(row.system),
        custom: parseInt(row.custom),
        byAuthMethod: {
          api_key: parseInt(row.api_key),
          oauth2: parseInt(row.oauth2),
          aws_iam: parseInt(row.aws_iam),
          custom: parseInt(row.custom_auth)
        }
      };

    } catch (error) {
      logger.error('Failed to get provider stats:', error);
      throw new AppError(
        'Failed to retrieve provider statistics',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get system providers
   */
  async getSystemProviders(): Promise<Provider[]> {
    const result = await this.getProviders({ isSystem: true });
    return result.providers;
  }

  /**
   * Get active providers
   */
  async getActiveProviders(): Promise<Provider[]> {
    const result = await this.getProviders({ status: ['active'] });
    return result.providers;
  }

  /**
   * Check if provider identifier is available
   */
  async isIdentifierAvailable(identifier: string, excludeId?: string): Promise<boolean> {
    const db = getDatabaseService();

    try {
      let query = 'SELECT COUNT(*) as count FROM providers WHERE identifier = $1';
      const params: any[] = [identifier];

      if (excludeId) {
        query += ' AND id != $2';
        params.push(excludeId);
      }

      const result = await db.query(query, params);
      const count = parseInt(result.rows[0].count);

      return count === 0;

    } catch (error) {
      logger.error('Failed to check identifier availability:', error);
      throw new AppError(
        'Failed to check identifier availability',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Map database record to Provider object
   */
  private mapRecordToProvider(record: ProviderRecord): Provider {
    return {
      id: record.id,
      identifier: record.identifier,
      name: record.name,
      description: record.description || '',
      apiEndpoint: record.api_endpoint,
      authMethod: record.auth_method,
      authConfig: typeof record.auth_config === 'string' 
        ? EncryptionService.decryptConfig(record.auth_config)
        : record.auth_config,
      capabilities: typeof record.capabilities === 'string' 
        ? JSON.parse(record.capabilities)
        : record.capabilities,
      status: record.status,
      isSystem: record.is_system,
      ...(record.created_by && { createdBy: record.created_by }),
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      ...(record.last_tested && { lastTested: record.last_tested }),
      testResult: record.test_result 
        ? (typeof record.test_result === 'string' ? JSON.parse(record.test_result) : record.test_result)
        : undefined
    };
  }
}

// Singleton instance
let providerStorageService: ProviderStorageService | null = null;

/**
 * Get the provider storage service instance
 */
export function getProviderStorageService(): ProviderStorageService {
  if (!providerStorageService) {
    providerStorageService = new ProviderStorageService();
  }
  return providerStorageService;
}