#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { initializeDatabaseService } from '../services/database-service.js';
import { getMigrationService } from '../services/migration-service.js';
import { logger } from '../utils/logger.js';

// Load environment variables
dotenv.config({ path: '../.env' });

async function runMigrations() {
  try {
    if (!process.env['DATABASE_URL']) {
      logger.error('DATABASE_URL environment variable is required');
      process.exit(1);
    }

    // Initialize database service
    const dbUrl = new URL(process.env['DATABASE_URL']);
    await initializeDatabaseService({
      host: dbUrl.hostname,
      port: parseInt(dbUrl.port) || 5432,
      database: dbUrl.pathname.slice(1), // Remove leading slash
      user: dbUrl.username,
      password: dbUrl.password,
      ssl: process.env['NODE_ENV'] === 'production'
    });

    // Initialize and run migrations
    const migrationService = getMigrationService();
    await migrationService.initialize();

    const command = process.argv[2];

    switch (command) {
      case 'up':
      case 'migrate':
        await migrationService.migrate();
        logger.info('Migrations completed successfully');
        break;

      case 'down':
      case 'rollback':
        await migrationService.rollback();
        logger.info('Rollback completed successfully');
        break;

      case 'status':
        const status = await migrationService.getStatus();
        logger.info('Migration status:', status);
        console.log(`Available migrations: ${status.available}`);
        console.log(`Executed migrations: ${status.executed}`);
        console.log(`Pending migrations: ${status.pending}`);
        if (status.lastExecuted) {
          console.log(`Last executed: ${status.lastExecuted.name} at ${status.lastExecuted.executed_at}`);
        }
        break;

      case 'pending':
        const pending = await migrationService.getPendingMigrations();
        if (pending.length === 0) {
          console.log('No pending migrations');
        } else {
          console.log('Pending migrations:');
          pending.forEach(m => console.log(`  - ${m.name} (${m.id})`));
        }
        break;

      case 'executed':
        const executed = await migrationService.getExecutedMigrations();
        if (executed.length === 0) {
          console.log('No executed migrations');
        } else {
          console.log('Executed migrations:');
          executed.forEach(m => console.log(`  - ${m.name} (${m.id}) - ${m.executed_at}`));
        }
        break;

      default:
        console.log('Usage: tsx migrate.ts <command>');
        console.log('Commands:');
        console.log('  up|migrate  - Run pending migrations');
        console.log('  down|rollback - Rollback last migration');
        console.log('  status      - Show migration status');
        console.log('  pending     - List pending migrations');
        console.log('  executed    - List executed migrations');
        process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    logger.error('Migration script failed:', error);
    process.exit(1);
  }
}

runMigrations();