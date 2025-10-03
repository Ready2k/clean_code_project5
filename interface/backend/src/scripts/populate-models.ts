#!/usr/bin/env node

/**
 * Model Population Script
 * 
 * This script populates the database with models for existing providers.
 * It reads from provider templates and creates models for each provider.
 */

import { getDynamicProviderService } from '../services/dynamic-provider-service.js';
import { getModelStorageService } from '../services/model-storage-service.js';
import { logger } from '../utils/logger.js';
import { PROVIDER_TEMPLATES } from '../data/provider-templates.js';
import { CreateModelRequest } from '../types/dynamic-providers.js';



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

async function populateModelsForProvider(provider: any, template: any): Promise<number> {
  let createdCount = 0;
  const modelService = getModelStorageService();
  
  if (!template.defaultModels || template.defaultModels.length === 0) {
    logger.info(`No models defined for provider template: ${template.name}`);
    return 0;
  }

  for (const modelTemplate of template.defaultModels) {
    try {
      const modelRequest: CreateModelRequest = {
        identifier: modelTemplate.identifier,
        name: modelTemplate.name,
        description: modelTemplate.description,
        contextLength: modelTemplate.contextLength,
        capabilities: modelTemplate.capabilities,
        isDefault: modelTemplate.isDefault || false
      };

      // Check if model already exists
      const existingModels = await modelService.getModels({ providerId: provider.id });
      const modelExists = existingModels.models.some(m => m.identifier === modelRequest.identifier);

      if (modelExists) {
        logger.info(`Model ${modelRequest.identifier} already exists for provider ${provider.name}, skipping...`);
        continue;
      }

      // Create the model
      logger.info(`Creating model: ${modelRequest.name} for provider: ${provider.name}`);
      await modelService.createModel(provider.id, modelRequest);
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
  logger.info('Starting model population...');

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

  logger.info(`Model population completed successfully!`);
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
    logger.error('Model population failed:', error);
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