#!/usr/bin/env node

/**
 * Model Cleanup Script
 * 
 * This script cleans up corrupted model data in the database
 * and then populates fresh models for existing providers.
 */

import { getDatabaseService } from '../services/database-service.js';
import { logger } from '../utils/logger.js';

async function initializeServices() {
  // Initialize database service
  const { initializeDatabaseService } = await import('../services/database-service.js');
  
  if (!process.env['DATABASE_URL']) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const dbUrl = new URL(process.env['DATABASE_URL']);
  await initializeDatabaseService({
    host: dbUrl.hostname,
    port: parseInt(dbUrl.port) || 5432,
    database: dbUrl.pathname.slice(1),
    user: dbUrl.username,
    password: dbUrl.password,
    ssl: process.env['NODE_ENV'] === 'production'
  });

  logger.info('Database service initialized successfully');

  // Initialize encryption service
  const { EncryptionService } = await import('../services/encryption-service.js');
  const masterKey = process.env['ENCRYPTION_KEY'];
  if (masterKey) {
    EncryptionService.initialize(masterKey);
    logger.info('Encryption service initialized successfully');
  } else {
    logger.warn('No ENCRYPTION_KEY provided, using default key for development');
    EncryptionService.initialize('dev-key-32-chars-long-for-testing');
  }
}

async function cleanupCorruptedModels(): Promise<void> {
  logger.info('Starting model cleanup...');
  
  const db = getDatabaseService();
  
  try {
    // First, let's see what's in the models table
    const result = await db.query('SELECT id, identifier, name, capabilities FROM models LIMIT 10');
    logger.info(`Found ${result.rows.length} model records`);
    
    if (result.rows.length > 0) {
      logger.info('Sample model records:');
      result.rows.forEach((row, index) => {
        logger.info(`${index + 1}. ID: ${row.id}, Identifier: ${row.identifier}, Name: ${row.name}`);
        logger.info(`   Capabilities type: ${typeof row.capabilities}, Value: ${JSON.stringify(row.capabilities).substring(0, 100)}...`);
      });
    }
    
    // Delete all corrupted model records
    const deleteResult = await db.query('DELETE FROM models WHERE 1=1');
    logger.info(`Deleted ${deleteResult.rowCount} model records`);
    
    // Reset the sequence if it exists
    try {
      await db.query('ALTER SEQUENCE models_id_seq RESTART WITH 1');
      logger.info('Reset models sequence');
    } catch (error) {
      logger.warn('Could not reset sequence (may not exist):', error);
    }
    
    logger.info('Model cleanup completed successfully');
    
  } catch (error) {
    logger.error('Failed to cleanup models:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    // Load environment variables
    const dotenv = await import('dotenv');
    dotenv.config({ path: '../.env' });
    
    // Initialize all required services
    await initializeServices();
    
    // Cleanup corrupted models
    await cleanupCorruptedModels();
    
    logger.info('Model cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Model cleanup failed:', error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { cleanupCorruptedModels };