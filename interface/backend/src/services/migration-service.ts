import { readdir, readFile, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { constants } from 'fs';
import { getDatabaseService } from './database-service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../types/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface Migration {
  id: string;
  name: string;
  up: string;
  down: string;
  timestamp: Date;
}

export interface MigrationRecord {
  id: string;
  name: string;
  executed_at: Date;
  checksum: string;
}

/**
 * Database migration service
 */
export class MigrationService {
  private defaultMigrationsPath: string;

  constructor(migrationsPath?: string) {
    this.defaultMigrationsPath = migrationsPath || join(__dirname, '../migrations');
  }

  /**
   * Find the correct migrations path
   */
  private async findMigrationsPath(): Promise<string> {
    const possiblePaths = [
      this.defaultMigrationsPath,                 // Constructor provided path
      join(__dirname, '../migrations'),           // Production (compiled)
      join(process.cwd(), 'src/migrations'),      // Development (tsx)
      join(process.cwd(), 'dist/migrations'),     // Alternative production
      join(__dirname, '../../src/migrations'),    // Alternative development
    ];

    for (const path of possiblePaths) {
      try {
        await access(path, constants.F_OK);
        logger.debug(`Found migrations directory at: ${path}`);
        return path;
      } catch {
        // Path doesn't exist, try next
        continue;
      }
    }

    throw new Error(`No migrations directory found. Tried paths: ${possiblePaths.join(', ')}`);
  }

  /**
   * Initialize migration system (create migrations table if needed)
   */
  async initialize(): Promise<void> {
    const db = getDatabaseService();

    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          checksum VARCHAR(64) NOT NULL
        )
      `);

      logger.info('Migration system initialized');
    } catch (error) {
      logger.error('Failed to initialize migration system:', error);
      throw new AppError(
        'Migration system initialization failed',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get all available migrations from files
   */
  async getAvailableMigrations(): Promise<Migration[]> {
    try {
      // Find the correct migrations path
      const migrationsPath = await this.findMigrationsPath();
      
      const files = await readdir(migrationsPath);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort();

      logger.info(`Found ${migrationFiles.length} migration files in ${migrationsPath}`);

      const migrations: Migration[] = [];

      for (const file of migrationFiles) {
        const filePath = join(migrationsPath, file);
        const content = await readFile(filePath, 'utf-8');
        
        // Parse migration file
        const migration = this.parseMigrationFile(file, content);
        migrations.push(migration);
      }

      return migrations;
    } catch (error) {
      logger.error('Failed to read migration files:', error);
      throw new AppError(
        'Failed to read migration files',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get executed migrations from database
   */
  async getExecutedMigrations(): Promise<MigrationRecord[]> {
    const db = getDatabaseService();

    try {
      const result = await db.query<MigrationRecord>(`
        SELECT id, name, executed_at, checksum
        FROM migrations
        ORDER BY executed_at ASC
      `);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get executed migrations:', error);
      throw new AppError(
        'Failed to get executed migrations',
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const [available, executed] = await Promise.all([
      this.getAvailableMigrations(),
      this.getExecutedMigrations()
    ]);

    const executedIds = new Set(executed.map(m => m.id));
    return available.filter(m => !executedIds.has(m.id));
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    logger.info(`Running ${pending.length} pending migrations`);

    for (const migration of pending) {
      await this.runMigration(migration);
    }

    logger.info('All migrations completed successfully');
  }

  /**
   * Run a specific migration
   */
  async runMigration(migration: Migration): Promise<void> {
    const db = getDatabaseService();

    try {
      await db.transaction(async (client) => {
        // Execute the migration
        await client.query(migration.up);

        // Record the migration
        await client.query(`
          INSERT INTO migrations (id, name, executed_at, checksum)
          VALUES ($1, $2, NOW(), $3)
        `, [migration.id, migration.name, this.calculateChecksum(migration.up)]);

        logger.info(`Migration executed: ${migration.name}`, {
          migrationId: migration.id
        });
      });
    } catch (error) {
      logger.error(`Migration failed: ${migration.name}`, {
        migrationId: migration.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        `Migration failed: ${migration.name}`,
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Rollback the last migration
   */
  async rollback(): Promise<void> {
    const executed = await this.getExecutedMigrations();
    
    if (executed.length === 0) {
      logger.info('No migrations to rollback');
      return;
    }

    const lastMigration = executed[executed.length - 1];
    if (!lastMigration) {
      throw new AppError('No migrations to rollback', 400, 'VALIDATION_ERROR' as any);
    }
    
    const available = await this.getAvailableMigrations();
    const migration = available.find(m => m.id === lastMigration.id);

    if (!migration) {
      throw new AppError(
        `Migration file not found for rollback: ${lastMigration.id}`,
        500,
        'DATABASE_ERROR' as any
      );
    }

    const db = getDatabaseService();

    try {
      await db.transaction(async (client) => {
        // Execute the rollback
        await client.query(migration.down);

        // Remove the migration record
        await client.query(`
          DELETE FROM migrations WHERE id = $1
        `, [migration.id]);

        logger.info(`Migration rolled back: ${migration.name}`, {
          migrationId: migration.id
        });
      });
    } catch (error) {
      logger.error(`Migration rollback failed: ${migration.name}`, {
        migrationId: migration.id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new AppError(
        `Migration rollback failed: ${migration.name}`,
        500,
        'DATABASE_ERROR' as any
      );
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    available: number;
    executed: number;
    pending: number;
    lastExecuted?: MigrationRecord;
  }> {
    const [available, executed] = await Promise.all([
      this.getAvailableMigrations(),
      this.getExecutedMigrations()
    ]);

    const result: {
      available: number;
      executed: number;
      pending: number;
      lastExecuted?: MigrationRecord;
    } = {
      available: available.length,
      executed: executed.length,
      pending: available.length - executed.length
    };
    
    if (executed.length > 0) {
      const lastMigration = executed[executed.length - 1];
      if (lastMigration) {
        result.lastExecuted = lastMigration;
      }
    }
    
    return result;
  }

  /**
   * Parse migration file content
   */
  private parseMigrationFile(filename: string, content: string): Migration {
    // Extract migration ID and name from filename
    // Expected format: YYYYMMDDHHMMSS_migration_name.sql
    const match = filename.match(/^(\d{14})_(.+)\.sql$/);
    if (!match) {
      throw new AppError(
        `Invalid migration filename format: ${filename}`,
        500,
        'DATABASE_ERROR' as any
      );
    }

    const [, timestampStr, name] = match;
    if (!timestampStr || !name) {
      throw new AppError(
        `Invalid migration filename format: ${filename}`,
        500,
        'DATABASE_ERROR' as any
      );
    }
    const timestamp = this.parseTimestamp(timestampStr);

    // Split content into UP and DOWN sections
    const sections = content.split(/-- DOWN|--DOWN/i);
    if (sections.length !== 2) {
      throw new AppError(
        `Migration file must contain UP and DOWN sections: ${filename}`,
        500,
        'DATABASE_ERROR' as any
      );
    }

    const up = sections[0]?.replace(/-- UP|--UP/i, '').trim() || '';
    const down = sections[1]?.trim() || '';

    return {
      id: timestampStr,
      name: name.replace(/_/g, ' '),
      up,
      down,
      timestamp
    };
  }

  /**
   * Parse timestamp from migration ID
   */
  private parseTimestamp(timestampStr: string): Date {
    // Format: YYYYMMDDHHMMSS
    const year = parseInt(timestampStr.substring(0, 4));
    const month = parseInt(timestampStr.substring(4, 6)) - 1; // Month is 0-based
    const day = parseInt(timestampStr.substring(6, 8));
    const hour = parseInt(timestampStr.substring(8, 10));
    const minute = parseInt(timestampStr.substring(10, 12));
    const second = parseInt(timestampStr.substring(12, 14));

    return new Date(year, month, day, hour, minute, second);
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}

// Singleton instance
let migrationService: MigrationService | null = null;

/**
 * Get the migration service instance
 */
export function getMigrationService(): MigrationService {
  if (!migrationService) {
    migrationService = new MigrationService();
  }
  return migrationService;
}