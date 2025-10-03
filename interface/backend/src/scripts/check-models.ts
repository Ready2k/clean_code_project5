#!/usr/bin/env node

/**
 * Check Models Script
 * 
 * This script checks what models are in the database
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
}

async function checkModels(): Promise<void> {
  logger.info('Checking models in database...');
  
  const db = getDatabaseService();
  
  try {
    const result = await db.query('SELECT id, identifier, name, capabilities FROM models LIMIT 5');
    logger.info(`Found ${result.rows.length} model records`);
    
    if (result.rows.length > 0) {
      logger.info('Sample model records:');
      result.rows.forEach((row, index) => {
        logger.info(`${index + 1}. ID: ${row.id}, Identifier: ${row.identifier}, Name: ${row.name}`);
        logger.info(`   Capabilities type: ${typeof row.capabilities}`);
        if (typeof row.capabilities === 'string') {
          logger.info(`   Capabilities string: ${row.capabilities.substring(0, 100)}...`);
          try {
            const parsed = JSON.parse(row.capabilities);
            logger.info(`   Parsed successfully: ${Object.keys(parsed).join(', ')}`);
          } catch (error) {
            logger.error(`   Failed to parse JSON: ${error.message}`);
          }
        } else {
          logger.info(`   Capabilities object: ${JSON.stringify(row.capabilities).substring(0, 100)}...`);
        }
      });
    }
    
  } catch (error) {
    logger.error('Failed to check models:', error);
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
    
    // Check models
    await checkModels();
    
    process.exit(0);
  } catch (error) {
    logger.error('Check models failed:', error);
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