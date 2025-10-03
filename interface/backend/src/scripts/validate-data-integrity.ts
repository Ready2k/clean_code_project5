#!/usr/bin/env node

/**
 * Data Integrity Validation Script
 * 
 * Validates data integrity for the dynamic provider system,
 * checks for orphaned records, validates relationships,
 * and reports any inconsistencies.
 */

import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { getDynamicProviderService } from '../services/dynamic-provider-service.js';
import { getConnectionManagementService } from '../services/connection-management-service.js';
import { initializeDatabaseService } from '../services/database-service.js';
import { initializeConnectionManagementService } from '../services/connection-management-service.js';

// Load environment variables
dotenv.config();

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    providers: number;
    models: number;
    templates: number;
    connections: number;
    orphanedModels: number;
    orphanedConnections: number;
  };
}

/**
 * Validate data integrity
 */
async function validateDataIntegrity(): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: {
      providers: 0,
      models: 0,
      templates: 0,
      connections: 0,
      orphanedModels: 0,
      orphanedConnections: 0
    }
  };

  try {
    console.log('🔍 Validating data integrity...\n');

    // Initialize services
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

    const dynamicProviderService = getDynamicProviderService();
    const connectionService = getConnectionManagementService();

    // Get all data
    const providersResponse = await dynamicProviderService.getProviders();
    const templates = await dynamicProviderService.getTemplates();
    const allConnections = await connectionService.getAllConnections();

    const providers = providersResponse.providers;

    result.stats.providers = providers.length;
    result.stats.templates = templates.length;
    result.stats.connections = allConnections.length;

    console.log(`📊 Found ${providers.length} providers, ${templates.length} templates, ${allConnections.length} connections`);

    // Validate providers and their models
    for (const provider of providers) {
      try {
        const models = await dynamicProviderService.getProviderModels(provider.id);
        result.stats.models += models.length;

        // Check for required fields
        if (!provider.identifier || !provider.name || !provider.apiEndpoint) {
          result.errors.push(`Provider ${provider.id} is missing required fields`);
          result.valid = false;
        }

        // Check for duplicate identifiers
        const duplicateProviders = providers.filter(p => p.identifier === provider.identifier);
        if (duplicateProviders.length > 1) {
          result.errors.push(`Duplicate provider identifier: ${provider.identifier}`);
          result.valid = false;
        }

        // Validate models
        for (const model of models) {
          if (!model.identifier || !model.name) {
            result.errors.push(`Model ${model.id} in provider ${provider.name} is missing required fields`);
            result.valid = false;
          }

          if (model.contextLength <= 0) {
            result.warnings.push(`Model ${model.name} has invalid context length: ${model.contextLength}`);
          }
        }

        // Check for default model
        const defaultModels = models.filter(m => m.isDefault);
        if (defaultModels.length === 0 && models.length > 0) {
          result.warnings.push(`Provider ${provider.name} has no default model`);
        } else if (defaultModels.length > 1) {
          result.warnings.push(`Provider ${provider.name} has multiple default models`);
        }

      } catch (error) {
        result.errors.push(`Failed to validate provider ${provider.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.valid = false;
      }
    }

    // Validate connections
    const providerIds = new Set(providers.map(p => p.id));
    
    for (const connection of allConnections) {
      // Check for orphaned dynamic connections
      if ((connection as any).providerId && !providerIds.has((connection as any).providerId)) {
        result.errors.push(`Connection ${connection.id} references non-existent provider ${(connection as any).providerId}`);
        result.stats.orphanedConnections++;
        result.valid = false;
      }

      // Check connection integrity
      if (!connection.name || !connection.userId) {
        result.errors.push(`Connection ${connection.id} is missing required fields`);
        result.valid = false;
      }
    }

    // Validate templates
    for (const template of templates) {
      if (!template.name || !template.providerConfig) {
        result.errors.push(`Template ${template.id} is missing required fields`);
        result.valid = false;
      }
    }

    console.log('\n📋 Validation Summary:');
    console.log('=====================');
    console.log(`✅ Valid: ${result.valid ? 'Yes' : 'No'}`);
    console.log(`📊 Providers: ${result.stats.providers}`);
    console.log(`🤖 Models: ${result.stats.models}`);
    console.log(`📋 Templates: ${result.stats.templates}`);
    console.log(`🔗 Connections: ${result.stats.connections}`);
    console.log(`🚨 Orphaned connections: ${result.stats.orphanedConnections}`);
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

    if (result.valid) {
      console.log('✅ Data integrity validation passed!');
    } else {
      console.log('❌ Data integrity validation failed. Fix the errors above.');
    }

  } catch (error) {
    result.valid = false;
    result.errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error('💥 Validation script failed:', error);
  }

  return result;
}

/**
 * Main execution
 */
async function main() {
  try {
    const result = await validateDataIntegrity();
    process.exit(result.valid ? 0 : 1);
  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in validation script:', error);
  console.error('💥 Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in validation script:', { reason, promise });
  console.error('💥 Unhandled rejection:', reason);
  process.exit(1);
});

// Run the script
main();