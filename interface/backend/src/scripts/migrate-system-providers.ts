#!/usr/bin/env node

/**
 * System Provider Migration Script
 * 
 * Command-line script to migrate hardcoded provider configurations
 * to the dynamic provider system. Supports dry-run, validation,
 * and rollback operations.
 */

import { Command } from 'commander';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { getSystemMigrationService, MigrationOptions } from '../services/system-migration-service.js';
import { initializeDatabaseService } from '../services/database-service.js';
import { initializeConnectionManagementService } from '../services/connection-management-service.js';

// Load environment variables
dotenv.config();

/**
 * Initialize required services
 */
async function initializeServices(): Promise<void> {
  if (!process.env['DATABASE_URL']) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  const dbUrl = new URL(process.env['DATABASE_URL']);
  await initializeDatabaseService({
    host: dbUrl.hostname,
    port: parseInt(dbUrl.port) || 5432,
    database: dbUrl.pathname.slice(1),
    user: dbUrl.username,
    password: dbUrl.password || ''
  });
  await initializeConnectionManagementService({});
}

const program = new Command();

program
  .name('migrate-system-providers')
  .description('Migrate hardcoded provider configurations to dynamic provider system')
  .version('1.0.0');

program
  .command('migrate')
  .description('Perform the system provider migration')
  .option('--dry-run', 'Perform a dry run without making changes')
  .option('--skip-existing', 'Skip providers that already exist')
  .option('--create-backup', 'Create backup before migration')
  .option('--validate-only', 'Only validate system readiness')
  .option('--force', 'Force migration even if errors occur')
  .action(async (options) => {
    try {
      console.log('🚀 Starting system provider migration...\n');

      // Initialize services
      await initializeServices();

      const migrationService = getSystemMigrationService();
      
      const migrationOptions: MigrationOptions = {
        dryRun: options.dryRun,
        skipExisting: options.skipExisting,
        createBackup: options.createBackup,
        validateOnly: options.validateOnly,
        force: options.force
      };

      console.log('Migration options:', migrationOptions);
      console.log('');

      // Perform migration
      const result = await migrationService.migrateSystemProviders(migrationOptions);

      // Display results
      console.log('📊 Migration Results:');
      console.log('===================');
      console.log(`✅ Success: ${result.success}`);
      console.log(`⏱️  Duration: ${result.duration}ms`);
      console.log(`🏭 Providers created: ${result.providersCreated}`);
      console.log(`🤖 Models created: ${result.modelsCreated}`);
      console.log(`📋 Templates created: ${result.templatesCreated}`);
      console.log(`🔗 Connections updated: ${result.connectionsUpdated}`);
      console.log('');

      if (result.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        result.warnings.forEach(warning => console.log(`   - ${warning}`));
        console.log('');
      }

      if (result.errors.length > 0) {
        console.log('❌ Errors:');
        result.errors.forEach(error => console.log(`   - ${error}`));
        console.log('');
      }

      if (result.success) {
        console.log('✅ Migration completed successfully!');
        
        if (options.dryRun) {
          console.log('');
          console.log('💡 This was a dry run. To perform the actual migration, run:');
          console.log('   npm run migrate:providers');
        }
      } else {
        console.log('❌ Migration failed. Check the errors above.');
        process.exit(1);
      }

    } catch (error) {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check current migration status')
  .action(async () => {
    try {
      console.log('📊 Checking migration status...\n');

      // Initialize services
      await initializeServices();

      const migrationService = getSystemMigrationService();
      const status = await migrationService.getMigrationStatus();

      console.log('Migration Status:');
      console.log('================');
      console.log(`🏭 System migrated: ${status.isSystemMigrated ? '✅ Yes' : '❌ No'}`);
      console.log(`🏭 System providers: ${status.systemProviders}`);
      console.log(`🔗 Legacy connections: ${status.legacyConnections}`);
      console.log(`🔗 Dynamic connections: ${status.dynamicConnections}`);
      console.log('');

      if (!status.isSystemMigrated) {
        console.log('💡 To migrate the system, run:');
        console.log('   npm run migrate:providers');
      } else {
        console.log('✅ System is fully migrated to dynamic providers!');
        
        if (status.legacyConnections > 0) {
          console.log('');
          console.log(`⚠️  Found ${status.legacyConnections} legacy connections.`);
          console.log('   These can be migrated individually through the admin interface.');
        }
      }

    } catch (error) {
      console.error('💥 Status check failed:', error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate system readiness for migration')
  .action(async () => {
    try {
      console.log('🔍 Validating system for migration...\n');

      // Initialize services
      await initializeServices();

      const migrationService = getSystemMigrationService();
      
      const result = await migrationService.migrateSystemProviders({
        validateOnly: true
      });

      console.log('Validation Results:');
      console.log('==================');
      console.log(`✅ System ready: ${result.success ? '✅ Yes' : '❌ No'}`);
      console.log('');

      if (result.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        result.warnings.forEach(warning => console.log(`   - ${warning}`));
        console.log('');
      }

      if (result.errors.length > 0) {
        console.log('❌ Errors:');
        result.errors.forEach(error => console.log(`   - ${error}`));
        console.log('');
      }

      if (result.success) {
        console.log('✅ System is ready for migration!');
        console.log('');
        console.log('💡 To perform the migration, run:');
        console.log('   npm run migrate:providers');
      } else {
        console.log('❌ System is not ready for migration. Fix the errors above first.');
        process.exit(1);
      }

    } catch (error) {
      console.error('💥 Validation failed:', error);
      process.exit(1);
    }
  });

program
  .command('dry-run')
  .description('Perform a dry run of the migration')
  .action(async () => {
    try {
      console.log('🧪 Performing migration dry run...\n');

      // Initialize services
      await initializeServices();

      const migrationService = getSystemMigrationService();
      
      const result = await migrationService.migrateSystemProviders({
        dryRun: true,
        skipExisting: true
      });

      console.log('Dry Run Results:');
      console.log('===============');
      console.log(`🏭 Providers to create: ${result.providersCreated}`);
      console.log(`🤖 Models to create: ${result.modelsCreated}`);
      console.log(`📋 Templates to create: ${result.templatesCreated}`);
      console.log(`🔗 Connections to update: ${result.connectionsUpdated}`);
      console.log('');

      if (result.warnings.length > 0) {
        console.log('⚠️  Warnings:');
        result.warnings.forEach(warning => console.log(`   - ${warning}`));
        console.log('');
      }

      if (result.errors.length > 0) {
        console.log('❌ Errors:');
        result.errors.forEach(error => console.log(`   - ${error}`));
        console.log('');
      }

      console.log('✅ Dry run completed!');
      console.log('');
      console.log('💡 To perform the actual migration, run:');
      console.log('   npm run migrate:providers');

    } catch (error) {
      console.error('💥 Dry run failed:', error);
      process.exit(1);
    }
  });

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in migration script:', error);
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in migration script:', { reason, promise });
  console.error('💥 Unhandled rejection:', reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();