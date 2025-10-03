import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { logger } from '../utils/logger.js';
import { AppError } from '../types/errors.js';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface QueryOptions {
  timeout?: number;
  retries?: number;
}

/**
 * Database service for PostgreSQL operations
 */
export class DatabaseService {
  private pool: Pool | null = null;
  private config: DatabaseConfig;
  private initialized = false;

  constructor(config: DatabaseConfig) {
    this.config = {
      maxConnections: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ...config
    };
  }

  /**
   * Initialize the database connection pool
   */
  async initialize(): Promise<void> {
    try {
      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl: this.config.ssl,
        max: this.config.maxConnections,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      });

      // Test the connection
      await this.testConnection();
      
      this.initialized = true;
      logger.info('Database service initialized successfully', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        maxConnections: this.config.maxConnections
      });

      // Handle pool errors
      this.pool.on('error', (err) => {
        logger.error('Database pool error:', err);
      });

    } catch (error) {
      logger.error('Failed to initialize database service:', error);
      throw new AppError(
        'Database initialization failed',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<void> {
    if (!this.pool) {
      throw new AppError('Database not initialized', 500, 'DATABASE_ERROR' as any);
    }

    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.debug('Database connection test successful');
    } catch (error) {
      logger.error('Database connection test failed:', error);
      throw new AppError(
        'Database connection test failed',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Execute a query with parameters
   */
  async query<T extends QueryResultRow = any>(
    text: string, 
    params?: any[], 
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    this.ensureInitialized();

    const startTime = Date.now();
    let client: PoolClient | null = null;

    try {
      client = await this.pool!.connect();
      
      const queryConfig = {
        text,
        values: params,
        ...(options.timeout && { timeout: options.timeout })
      };

      const result = await client.query<T>(queryConfig);
      
      const duration = Date.now() - startTime;
      logger.debug('Database query executed', {
        query: text.substring(0, 100),
        duration,
        rowCount: result.rowCount || 0
      });

      return result as QueryResult<T>;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Database query failed', {
        query: text.substring(0, 100),
        duration,
        error: error instanceof Error ? error.message : String(error)
      });

      // Retry logic for transient errors
      if (options.retries && options.retries > 0 && this.isRetryableError(error)) {
        logger.info('Retrying database query', { retriesLeft: options.retries - 1 });
        return this.query(text, params, { ...options, retries: options.retries - 1 });
      }

      throw new AppError(
        'Database query failed',
        500,
        'DATABASE_ERROR' as any
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>,
    _options: QueryOptions = {}
  ): Promise<T> {
    this.ensureInitialized();

    let client: PoolClient | null = null;

    try {
      client = await this.pool!.connect();
      await client.query('BEGIN');

      const result = await callback(client);

      await client.query('COMMIT');
      logger.debug('Database transaction committed successfully');

      return result;

    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
          logger.debug('Database transaction rolled back');
        } catch (rollbackError) {
          logger.error('Failed to rollback transaction:', rollbackError);
        }
      }

      logger.error('Database transaction failed:', error);
      throw new AppError(
        'Database transaction failed',
        500,
        'DATABASE_ERROR' as any
      );
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalConnections: number;
    idleConnections: number;
    waitingCount: number;
  }> {
    this.ensureInitialized();

    return {
      totalConnections: this.pool!.totalCount,
      idleConnections: this.pool!.idleCount,
      waitingCount: this.pool!.waitingCount
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error || typeof error.code !== 'string') {
      return false;
    }

    // PostgreSQL error codes that are typically retryable
    const retryableCodes = [
      '53300', // too_many_connections
      '53400', // configuration_limit_exceeded
      '08000', // connection_exception
      '08003', // connection_does_not_exist
      '08006', // connection_failure
      '08001', // sqlclient_unable_to_establish_sqlconnection
      '08004', // sqlserver_rejected_establishment_of_sqlconnection
    ];

    return retryableCodes.includes(error.code);
  }

  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.pool) {
      throw new AppError(
        'Database service not initialized',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Shutdown the database service
   */
  async shutdown(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
        this.pool = null;
        this.initialized = false;
        logger.info('Database service shut down successfully');
      } catch (error) {
        logger.error('Error during database shutdown:', error);
        throw error;
      }
    }
  }
}

// Singleton instance
let databaseService: DatabaseService | null = null;

/**
 * Initialize the database service
 */
export async function initializeDatabaseService(config: DatabaseConfig): Promise<void> {
  if (databaseService) {
    logger.warn('Database service already initialized');
    return;
  }

  databaseService = new DatabaseService(config);
  await databaseService.initialize();
}

/**
 * Get the database service instance
 */
export function getDatabaseService(): DatabaseService {
  if (!databaseService) {
    throw new AppError(
      'Database service not initialized',
      500,
      'DATABASE_ERROR' as any
    );
  }

  return databaseService;
}

/**
 * Shutdown the database service
 */
export async function shutdownDatabaseService(): Promise<void> {
  if (databaseService) {
    await databaseService.shutdown();
    databaseService = null;
  }
}