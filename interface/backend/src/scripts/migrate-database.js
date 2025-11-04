#!/usr/bin/env node

/**
 * Database Migration Script for Template System
 * 
 * This script handles database migrations for the template management system.
 * It can be run during deployment to ensure the database schema is up to date.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/promptlib',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

/**
 * Database migration manager
 */
class MigrationManager {
  constructor() {
    this.client = new Client(config);
  }

  /**
   * Connect to database
   */
  async connect() {
    try {
      await this.client.connect();
      console.log('✅ Connected to database');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error.message);
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect() {
    try {
      await this.client.end();
      console.log('✅ Disconnected from database');
    } catch (error) {
      console.error('❌ Failed to disconnect from database:', error.message);
    }
  }

  /**
   * Create schema_migrations table if it doesn't exist
   */
  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    try {
      await this.client.query(query);
      console.log('✅ Schema migrations table ready');
    } catch (error) {
      console.error('❌ Failed to create migrations table:', error.message);
      throw error;
    }
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations() {
    try {
      const result = await this.client.query('SELECT version FROM schema_migrations ORDER BY version');
      return result.rows.map(row => row.version);
    } catch (error) {
      console.error('❌ Failed to get applied migrations:', error.message);
      throw error;
    }
  }

  /**
   * Get list of available migration files
   */
  getAvailableMigrations() {
    try {
      const files = readdirSync(MIGRATIONS_DIR)
        .filter(file => file.endsWith('.sql'))
        .sort();
      
      return files.map(file => ({
        version: file.replace('.sql', ''),
        filename: file,
        path: join(MIGRATIONS_DIR, file)
      }));
    } catch (error) {
      console.error('❌ Failed to read migrations directory:', error.message);
      throw error;
    }
  }

  /**
   * Apply a single migration
   */
  async applyMigration(migration) {
    console.log(`📦 Applying migration: ${migration.version}`);

    try {
      // Read migration file
      const sql = readFileSync(migration.path, 'utf8');

      // Begin transaction
      await this.client.query('BEGIN');

      try {
        // Execute migration SQL
        await this.client.query(sql);

        // Record migration as applied (if not already recorded by the migration itself)
        await this.client.query(
          'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
          [migration.version]
        );

        // Commit transaction
        await this.client.query('COMMIT');
        console.log(`✅ Migration applied: ${migration.version}`);
      } catch (error) {
        // Rollback transaction
        await this.client.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error(`❌ Failed to apply migration ${migration.version}:`, error.message);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate() {
    console.log('🚀 Starting database migration...');

    try {
      await this.connect();
      await this.createMigrationsTable();

      const appliedMigrations = await this.getAppliedMigrations();
      const availableMigrations = this.getAvailableMigrations();

      console.log(`📋 Found ${availableMigrations.length} available migrations`);
      console.log(`📋 Found ${appliedMigrations.length} applied migrations`);

      // Filter out already applied migrations
      const pendingMigrations = availableMigrations.filter(
        migration => !appliedMigrations.includes(migration.version)
      );

      if (pendingMigrations.length === 0) {
        console.log('✅ No pending migrations');
        return;
      }

      console.log(`📦 Applying ${pendingMigrations.length} pending migrations...`);

      // Apply each pending migration
      for (const migration of pendingMigrations) {
        await this.applyMigration(migration);
      }

      console.log('✅ All migrations completed successfully');
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Check migration status
   */
  async status() {
    console.log('📊 Checking migration status...');

    try {
      await this.connect();
      await this.createMigrationsTable();

      const appliedMigrations = await this.getAppliedMigrations();
      const availableMigrations = this.getAvailableMigrations();

      console.log('\n📋 Migration Status:');
      console.log('==================');

      for (const migration of availableMigrations) {
        const isApplied = appliedMigrations.includes(migration.version);
        const status = isApplied ? '✅ Applied' : '⏳ Pending';
        console.log(`${status} ${migration.version}`);
      }

      const pendingCount = availableMigrations.length - appliedMigrations.length;
      console.log(`\n📊 Summary: ${appliedMigrations.length} applied, ${pendingCount} pending`);

      return {
        applied: appliedMigrations.length,
        pending: pendingCount,
        total: availableMigrations.length
      };
    } catch (error) {
      console.error('❌ Failed to check status:', error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Rollback last migration (use with caution)
   */
  async rollback() {
    console.log('⚠️  Rolling back last migration...');

    try {
      await this.connect();
      
      const appliedMigrations = await this.getAppliedMigrations();
      if (appliedMigrations.length === 0) {
        console.log('ℹ️  No migrations to rollback');
        return;
      }

      const lastMigration = appliedMigrations[appliedMigrations.length - 1];
      
      // Remove from migrations table
      await this.client.query('DELETE FROM schema_migrations WHERE version = $1', [lastMigration]);
      
      console.log(`✅ Rolled back migration: ${lastMigration}`);
      console.log('⚠️  Note: This only removes the migration record. Manual cleanup may be required.');
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Validate database schema
   */
  async validate() {
    console.log('🔍 Validating database schema...');

    try {
      await this.connect();

      const checks = [
        {
          name: 'prompt_templates table',
          query: "SELECT to_regclass('prompt_templates') as exists"
        },
        {
          name: 'prompt_template_versions table',
          query: "SELECT to_regclass('prompt_template_versions') as exists"
        },
        {
          name: 'prompt_template_usage table',
          query: "SELECT to_regclass('prompt_template_usage') as exists"
        },
        {
          name: 'prompt_template_metrics table',
          query: "SELECT to_regclass('prompt_template_metrics') as exists"
        },
        {
          name: 'template_analytics view',
          query: "SELECT to_regclass('template_analytics') as exists"
        }
      ];

      console.log('\n🔍 Schema Validation Results:');
      console.log('============================');

      let allValid = true;
      for (const check of checks) {
        try {
          const result = await this.client.query(check.query);
          const exists = result.rows[0].exists !== null;
          const status = exists ? '✅ Exists' : '❌ Missing';
          console.log(`${status} ${check.name}`);
          if (!exists) allValid = false;
        } catch (error) {
          console.log(`❌ Error checking ${check.name}: ${error.message}`);
          allValid = false;
        }
      }

      if (allValid) {
        console.log('\n✅ Database schema is valid');
      } else {
        console.log('\n❌ Database schema validation failed');
        console.log('💡 Run migrations to fix schema issues');
      }

      return allValid;
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

/**
 * CLI interface
 */
async function main() {
  const command = process.argv[2] || 'migrate';
  const migrationManager = new MigrationManager();

  try {
    switch (command) {
      case 'migrate':
        await migrationManager.migrate();
        break;
      
      case 'status':
        await migrationManager.status();
        break;
      
      case 'rollback':
        await migrationManager.rollback();
        break;
      
      case 'validate':
        const isValid = await migrationManager.validate();
        process.exit(isValid ? 0 : 1);
        break;
      
      default:
        console.log('Usage: node migrate-database.js [command]');
        console.log('Commands:');
        console.log('  migrate   - Apply all pending migrations (default)');
        console.log('  status    - Show migration status');
        console.log('  rollback  - Rollback last migration');
        console.log('  validate  - Validate database schema');
        process.exit(1);
    }
  } catch (error) {
    console.error('💥 Migration script failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default MigrationManager;