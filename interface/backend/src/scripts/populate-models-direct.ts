#!/usr/bin/env node

/**
 * Direct Model Population Script
 * 
 * This script populates models directly in the database,
 * bypassing the ModelStorageService to avoid JSON parsing issues.
 */

import { getDatabaseService } from '../services/database-service.js';
import { getDynamicProviderService } from '../services/dynamic-provider-service.js';
import { logger } from '../utils/logger.js';
import { PROVIDER_TEMPLATES } from '../data/provider-templates.js';
import { v4 as uuidv4 } from 'uuid';

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

async function getExistingProviders(): Promise<any[]> {
  const providerService = getDynamicProviderService();
  const result = await providerService.getProviders({});
  return result.providers;
}

async function createModelDirect(providerId: string, modelData: any): Promise<void> {
  const db = getDatabaseService();
  
  const query = `
    INSERT INTO models (
      id, provider_id, identifier, name, description, 
      context_length, capabilities, pricing_info, 
      is_default, status, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
  `;
  
  const now = new Date().toISOString();
  const values = [
    uuidv4(), // id
    providerId, // provider_id
    modelData.identifier, // identifier
    modelData.name, // name
    modelData.description || '', // description
    modelData.contextLength, // context_length
    JSON.stringify(modelData.capabilities), // capabilities (as JSON string)
    JSON.stringify({}), // pricing_info (empty for now)
    modelData.isDefault || false, // is_default
    'active', // status
    now, // created_at
    now // updated_at
  ];
  
  await db.query(query, values);
}

async function populateModelsForProvider(provider: any, template: any): Promise<number> {
  let createdCount = 0;
  
  if (!template.defaultModels || template.defaultModels.length === 0) {
    logger.info(`No models defined for provider template: ${template.name}`);
    return 0;
  }

  for (const modelTemplate of template.defaultModels) {
    try {
      logger.info(`Creating model: ${modelTemplate.name} for provider: ${provider.name}`);
      
      await createModelDirect(provider.id, {
        identifier: modelTemplate.identifier,
        name: modelTemplate.name,
        description: modelTemplate.description,
        contextLength: modelTemplate.contextLength,
        capabilities: modelTemplate.capabilities,
        isDefault: modelTemplate.isDefault || false
      });
      
      createdCount++;
      
    } catch (error) {
      logger.error(`Failed to create model ${modelTemplate.identifier} for provider ${provider.name}:`, error);
    }
  }

  return createdCount;
}

async function findTemplateForProvider(providerIdentifier: string): Promise<any | null> {
  // Direct matches
  const directMatches: Record<string, string> = {
    'openai': 'openai-template',
    'openai-basic': 'openai-template',
    'anthropic': 'anthropic-template',
    'anthropic-basic': 'anthropic-template',
    'google-gemini': 'google-gemini-template',
    'google-gemini-basic': 'google-gemini-template',
    'mistral': 'mistral-template',
    'mistral-basic': 'mistral-template',
    'cohere': 'cohere-template',
    'ai21': 'ai21-template'
  };

  const templateId = directMatches[providerIdentifier];
  if (templateId) {
    return PROVIDER_TEMPLATES.find(t => t.id === templateId);
  }

  // Fuzzy matching for other cases
  const normalizedIdentifier = providerIdentifier.toLowerCase();
  
  if (normalizedIdentifier.includes('openai') || normalizedIdentifier.includes('gpt')) {
    return PROVIDER_TEMPLATES.find(t => t.id === 'openai-template');
  }
  
  if (normalizedIdentifier.includes('anthropic') || normalizedIdentifier.includes('claude')) {
    return PROVIDER_TEMPLATES.find(t => t.id === 'anthropic-template');
  }
  
  if (normalizedIdentifier.includes('gemini') || normalizedIdentifier.includes('google')) {
    return PROVIDER_TEMPLATES.find(t => t.id === 'google-gemini-template');
  }
  
  if (normalizedIdentifier.includes('mistral')) {
    return PROVIDER_TEMPLATES.find(t => t.id === 'mistral-template');
  }
  
  if (normalizedIdentifier.includes('cohere')) {
    return PROVIDER_TEMPLATES.find(t => t.id === 'cohere-template');
  }
  
  if (normalizedIdentifier.includes('ai21')) {
    return PROVIDER_TEMPLATES.find(t => t.id === 'ai21-template');
  }

  return null;
}

async function populateModels(): Promise<void> {
  logger.info('Starting direct model population...');

  // Get existing providers
  const providers = await getExistingProviders();
  logger.info(`Found ${providers.length} providers to populate models for`);

  let totalCreated = 0;

  for (const provider of providers) {
    logger.info(`Processing provider: ${provider.name} (${provider.identifier})`);

    // Find matching template
    const template = await findTemplateForProvider(provider.identifier);
    
    if (!template) {
      logger.warn(`No template found for provider: ${provider.identifier}, skipping...`);
      continue;
    }

    logger.info(`Using template: ${template.name} for provider: ${provider.name}`);

    try {
      const createdCount = await populateModelsForProvider(provider, template);
      totalCreated += createdCount;
      logger.info(`Created ${createdCount} models for provider: ${provider.name}`);
    } catch (error) {
      logger.error(`Failed to populate models for provider ${provider.name}:`, error);
    }
  }

  logger.info(`Direct model population completed successfully!`);
  logger.info(`Created ${totalCreated} models across ${providers.length} providers`);
}

async function main(): Promise<void> {
  try {
    // Load environment variables
    const dotenv = await import('dotenv');
    dotenv.config({ path: '../.env' });
    
    // Initialize all required services
    await initializeServices();
    
    // Populate models
    await populateModels();
    
    process.exit(0);
  } catch (error) {
    logger.error('Direct model population failed:', error);
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

export { populateModels };