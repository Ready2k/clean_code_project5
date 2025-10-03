/**
 * Basic Provider Population Script
 * 
 * Adds basic provider entries to populate the model dictionary
 * without complex model configurations that cause JSON parsing issues.
 */

import { getDynamicProviderService } from '../services/dynamic-provider-service.js';
import { logger } from '../utils/logger.js';
import { CreateProviderRequest } from '../types/dynamic-providers.js';

const BASIC_PROVIDERS: CreateProviderRequest[] = [
  // OpenAI
  {
    identifier: 'openai-basic',
    name: 'OpenAI',
    description: 'OpenAI GPT models including GPT-4, GPT-3.5, and latest reasoning models',
    apiEndpoint: 'https://api.openai.com/v1',
    authMethod: 'api_key',
    authConfig: {
      type: 'api_key',
      fields: {
        apiKey: {
          required: true,
          description: 'OpenAI API key',
          sensitive: true
        }
      }
    },
    capabilities: {
      supportsSystemMessages: true,
      maxContextLength: 128000,
      supportedRoles: ['system', 'user', 'assistant'],
      supportsStreaming: true,
      supportsTools: true,
      supportedAuthMethods: ['api_key']
    }
  },

  // Anthropic
  {
    identifier: 'anthropic-basic',
    name: 'Anthropic Claude',
    description: 'Anthropic Claude models with advanced reasoning capabilities',
    apiEndpoint: 'https://api.anthropic.com',
    authMethod: 'api_key',
    authConfig: {
      type: 'api_key',
      fields: {
        apiKey: {
          required: true,
          description: 'Anthropic API key',
          sensitive: true
        }
      }
    },
    capabilities: {
      supportsSystemMessages: true,
      maxContextLength: 200000,
      supportedRoles: ['system', 'user', 'assistant'],
      supportsStreaming: true,
      supportsTools: true,
      supportedAuthMethods: ['api_key']
    }
  },

  // Google Gemini
  {
    identifier: 'google-gemini-basic',
    name: 'Google Gemini',
    description: 'Google Gemini models with multimodal capabilities',
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    authMethod: 'api_key',
    authConfig: {
      type: 'api_key',
      fields: {
        apiKey: {
          required: true,
          description: 'Google AI API key',
          sensitive: true
        }
      }
    },
    capabilities: {
      supportsSystemMessages: true,
      maxContextLength: 1000000,
      supportedRoles: ['system', 'user', 'assistant'],
      supportsStreaming: true,
      supportsTools: true,
      supportedAuthMethods: ['api_key']
    }
  },

  // Mistral AI
  {
    identifier: 'mistral-basic',
    name: 'Mistral AI',
    description: 'Mistral AI high-performance models',
    apiEndpoint: 'https://api.mistral.ai/v1',
    authMethod: 'api_key',
    authConfig: {
      type: 'api_key',
      fields: {
        apiKey: {
          required: true,
          description: 'Mistral AI API key',
          sensitive: true
        }
      }
    },
    capabilities: {
      supportsSystemMessages: true,
      maxContextLength: 32768,
      supportedRoles: ['system', 'user', 'assistant'],
      supportsStreaming: true,
      supportsTools: true,
      supportedAuthMethods: ['api_key']
    }
  }
];

/**
 * Initialize all required services
 */
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

/**
 * Populate basic providers
 */
export async function populateBasicProviders(): Promise<void> {
  logger.info('Starting basic provider population...');
  
  try {
    const providerService = getDynamicProviderService();
    let createdProviders = 0;
    let skippedProviders = 0;

    for (const providerData of BASIC_PROVIDERS) {
      try {
        logger.info(`Processing provider: ${providerData.name}`);
        
        const provider = await providerService.createProvider(providerData);
        createdProviders++;
        logger.info(`Created provider: ${provider.name} (${provider.id})`);
        
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          logger.info(`Provider ${providerData.name} already exists, skipping...`);
          skippedProviders++;
        } else {
          logger.error(`Failed to create provider ${providerData.name}:`, error);
        }
      }
    }

    logger.info(`Basic provider population completed successfully!`);
    logger.info(`Created ${createdProviders} providers`);
    logger.info(`Skipped ${skippedProviders} existing providers`);
    
  } catch (error) {
    logger.error('Failed to populate basic providers:', error);
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Load environment variables
    const dotenv = await import('dotenv');
    dotenv.config({ path: '../.env' });
    
    // Initialize all required services
    await initializeServices();
    
    // Populate basic providers
    await populateBasicProviders();
    
    process.exit(0);
  } catch (error) {
    logger.error('Basic provider population failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}