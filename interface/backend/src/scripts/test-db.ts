#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { initializeDatabaseService, getDatabaseService } from '../services/database-service.js';
import { logger } from '../utils/logger.js';

// Load environment variables
dotenv.config({ path: '../.env' });

async function testDatabase() {
  try {
    if (!process.env['DATABASE_URL']) {
      logger.error('DATABASE_URL environment variable is required');
      process.exit(1);
    }

    logger.info('Testing database connection...');

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

    const db = getDatabaseService();

    // Test basic query
    const result = await db.query('SELECT NOW() as current_time, version() as pg_version');
    logger.info('Database connection successful!', {
      currentTime: result.rows[0].current_time,
      version: result.rows[0].pg_version
    });

    // Test database stats
    const stats = await db.getStats();
    logger.info('Database connection stats:', stats);

    // Test if users table exists
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'prompts', 'connections', 'providers', 'models')
    `);
    
    logger.info('Existing tables:', {
      tables: tableCheck.rows.map(row => row.table_name)
    });

    logger.info('Database test completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database test failed:', error);
    process.exit(1);
  }
}

testDatabase();