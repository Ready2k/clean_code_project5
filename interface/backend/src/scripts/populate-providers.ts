/**
 * Provider Population Script
 * 
 * Pre-populates the system with major AI providers and their current models
 * based on the latest information about available providers and models.
 */

import { getDynamicProviderService } from '../services/dynamic-provider-service.js';
import { logger } from '../utils/logger.js';
import { CreateProviderRequest, CreateModelRequest } from '../types/dynamic-providers.js';

interface ProviderData {
  provider: CreateProviderRequest;
  models: CreateModelRequest[];
}

const PROVIDERS_DATA: ProviderData[] = [
  // 1. OpenAI / Microsoft (Azure OpenAI)
  {
    provider: {
      identifier: 'openai',
      name: 'OpenAI',
      description: 'OpenAI GPT models including latest reasoning models and multimodal capabilities',
      apiEndpoint: 'https://api.openai.com/v1',
      authMethod: 'api_key',
      authConfig: {
        type: 'api_key',
        fields: {
          apiKey: {
            required: true,
            description: 'OpenAI API key (starts with sk-)',
            sensitive: true,
            validation: {
              pattern: '^sk-[a-zA-Z0-9]{48}$',
              minLength: 51,
              maxLength: 51
            }
          }
        },
        headers: {
          'Authorization': 'Bearer {apiKey}',
          'Content-Type': 'application/json'
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
    models: [
      {
        identifier: 'o3',
        name: 'o3',
        description: 'OpenAI\'s latest reasoning model with advanced problem-solving capabilities',
        contextLength: 128000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 128000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: false,
          supportsAudio: false
        },
        pricingInfo: {
          inputTokenPrice: 0.06,
          outputTokenPrice: 0.24,
          currency: 'USD',
          billingUnit: '1K tokens'
        },
        isDefault: false
      },
      {
        identifier: 'o4-mini',
        name: 'o4-mini',
        description: 'A lighter version in the "o4" line, optimized for efficiency',
        contextLength: 128000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 128000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: false,
          supportsAudio: false
        },
        pricingInfo: {
          inputTokenPrice: 0.015,
          outputTokenPrice: 0.06,
          currency: 'USD',
          billingUnit: '1K tokens'
        },
        isDefault: false
      },
      {
        identifier: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'High-performance model for complex tasks, still widely used',
        contextLength: 128000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 128000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: true,
          supportsAudio: false
        },
        pricingInfo: {
          inputTokenPrice: 0.01,
          outputTokenPrice: 0.03,
          currency: 'USD',
          billingUnit: '1K tokens'
        },
        isDefault: true
      },
      {
        identifier: 'gpt-4o',
        name: 'GPT-4o (Omni)',
        description: 'Multimodal model supporting text, images, and audio',
        contextLength: 128000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 128000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: true,
          supportsAudio: true
        },
        pricingInfo: {
          inputTokenPrice: 0.005,
          outputTokenPrice: 0.015,
          currency: 'USD',
          billingUnit: '1K tokens'
        },
        isDefault: false
      },
      {
        identifier: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and efficient workhorse model for many applications',
        contextLength: 16385,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 16385,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: false,
          supportsAudio: false
        },
        pricingInfo: {
          inputTokenPrice: 0.0015,
          outputTokenPrice: 0.002,
          currency: 'USD',
          billingUnit: '1K tokens'
        },
        isDefault: false
      },
      {
        identifier: 'gpt-4.5',
        name: 'GPT-4.5 (Preview)',
        description: 'Research preview model positioned as "best chat model yet"',
        contextLength: 128000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 128000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: true,
          supportsAudio: false
        },
        isDefault: false
      }
    ]
  },

  // 2. Anthropic Claude
  {
    provider: {
      identifier: 'anthropic',
      name: 'Anthropic',
      description: 'Anthropic Claude models with advanced reasoning and safety features',
      apiEndpoint: 'https://api.anthropic.com',
      authMethod: 'api_key',
      authConfig: {
        type: 'api_key',
        fields: {
          apiKey: {
            required: true,
            description: 'Anthropic API key',
            sensitive: true,
            validation: {
              pattern: '^sk-ant-[a-zA-Z0-9\\-_]+$'
            }
          }
        },
        headers: {
          'x-api-key': '{apiKey}',
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
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
    models: [
      {
        identifier: 'claude-opus-4.1',
        name: 'Claude Opus 4.1',
        description: 'Most powerful Claude model for complex reasoning tasks',
        contextLength: 200000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 200000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: true,
          supportsAudio: false
        },
        pricingInfo: {
          inputTokenPrice: 0.015,
          outputTokenPrice: 0.075,
          currency: 'USD',
          billingUnit: '1K tokens'
        },
        isDefault: false
      },
      {
        identifier: 'claude-sonnet-4.5',
        name: 'Claude Sonnet 4.5',
        description: 'Balanced performance and cost model with excellent capabilities',
        contextLength: 200000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 200000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: true,
          supportsAudio: false
        },
        pricingInfo: {
          inputTokenPrice: 0.003,
          outputTokenPrice: 0.015,
          currency: 'USD',
          billingUnit: '1K tokens'
        },
        isDefault: true
      },
      {
        identifier: 'claude-3.7-sonnet',
        name: 'Claude 3.7 Sonnet',
        description: 'Widely cited in Anthropic\'s roadmap, advanced reasoning',
        contextLength: 200000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 200000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: true,
          supportsAudio: false
        },
        isDefault: false
      },
      {
        identifier: 'claude-3.5-sonnet-v2',
        name: 'Claude 3.5 Sonnet (v2)',
        description: 'Current generation model with improved performance',
        contextLength: 200000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 200000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: true,
          supportsAudio: false
        },
        pricingInfo: {
          inputTokenPrice: 0.003,
          outputTokenPrice: 0.015,
          currency: 'USD',
          billingUnit: '1K tokens'
        },
        isDefault: false
      },
      {
        identifier: 'claude-3-haiku',
        name: 'Claude 3 Haiku',
        description: 'Fast and efficient model for speed-oriented tasks',
        contextLength: 200000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 200000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: false,
          supportsAudio: false
        },
        pricingInfo: {
          inputTokenPrice: 0.00025,
          outputTokenPrice: 0.00125,
          currency: 'USD',
          billingUnit: '1K tokens'
        },
        isDefault: false
      }
    ]
  },

  // 3. Google / DeepMind (Gemini)
  {
    provider: {
      identifier: 'google-gemini',
      name: 'Google Gemini',
      description: 'Google\'s flagship Gemini models with multimodal capabilities',
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
        },
        headers: {
          'Authorization': 'Bearer {apiKey}',
          'Content-Type': 'application/json'
        }
      },
      capabilities: {
        supportsSystemMessages: true,
        maxContextLength: 2000000,
        supportedRoles: ['system', 'user', 'assistant'],
        supportsStreaming: true,
        supportsTools: true,
        supportedAuthMethods: ['api_key']
      }
    },
    models: [
      {
        identifier: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Full reasoning flagship model with advanced capabilities',
        contextLength: 1000000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 1000000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: true,
          supportsAudio: true
        },
        isDefault: true
      },
      {
        identifier: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Optimized for cost and speed with reasoning capabilities',
        contextLength: 1000000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 1000000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: true,
          supportsAudio: false
        },
        isDefault: false
      },
      {
        identifier: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: 'Widely deployed production model powering user-facing products',
        contextLength: 1000000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 1000000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: true,
          supportsAudio: false
        },
        isDefault: false
      },
      {
        identifier: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Previous generation Pro model with extended context',
        contextLength: 2000000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 2000000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: true,
          supportsAudio: false
        },
        isDefault: false
      },
      {
        identifier: 'gemini-nano',
        name: 'Gemini Nano',
        description: 'On-device compact variant for edge deployments',
        contextLength: 32000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 32000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: false,
          supportsTools: false,
          supportsFunctionCalling: false,
          supportsVision: false,
          supportsAudio: false
        },
        isDefault: false
      }
    ]
  },

  // 4. Mistral AI
  {
    provider: {
      identifier: 'mistral',
      name: 'Mistral AI',
      description: 'High-performance open and frontier models with focus on deployability',
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
        },
        headers: {
          'Authorization': 'Bearer {apiKey}',
          'Content-Type': 'application/json'
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
    },
    models: [
      {
        identifier: 'mistral-medium-3',
        name: 'Mistral Medium 3',
        description: 'Current frontier class model with excellent performance',
        contextLength: 32768,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 32768,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: false,
          supportsAudio: false
        },
        isDefault: false
      },
      {
        identifier: 'mistral-large-2.1',
        name: 'Mistral Large 2.1',
        description: 'High-capacity flagship model for complex tasks',
        contextLength: 32768,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 32768,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: false,
          supportsAudio: false
        },
        isDefault: true
      },
      {
        identifier: 'mistral-small',
        name: 'Mistral Small',
        description: 'Lightweight and efficient model for cost-sensitive applications',
        contextLength: 32768,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 32768,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: false,
          supportsAudio: false
        },
        isDefault: false
      },
      {
        identifier: 'codestral',
        name: 'Codestral',
        description: 'Specialized model for code generation and programming tasks',
        contextLength: 32768,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 32768,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: false,
          supportsAudio: false,
          supportsCodeExecution: true
        },
        isDefault: false
      }
    ]
  },

  // 5. Cohere
  {
    provider: {
      identifier: 'cohere',
      name: 'Cohere',
      description: 'Enterprise-focused NLP models with strong retrieval and ranking capabilities',
      apiEndpoint: 'https://api.cohere.ai/v1',
      authMethod: 'api_key',
      authConfig: {
        type: 'api_key',
        fields: {
          apiKey: {
            required: true,
            description: 'Cohere API key',
            sensitive: true
          }
        },
        headers: {
          'Authorization': 'Bearer {apiKey}',
          'Content-Type': 'application/json'
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
    models: [
      {
        identifier: 'command-a',
        name: 'Command A',
        description: 'Flagship generative model optimized for enterprise use cases',
        contextLength: 128000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 128000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: false,
          supportsAudio: false
        },
        isDefault: true
      },
      {
        identifier: 'command-r',
        name: 'Command R',
        description: 'Chat and reasoning optimized model with strong performance',
        contextLength: 128000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 128000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: false,
          supportsAudio: false
        },
        isDefault: false
      },
      {
        identifier: 'rerank-3',
        name: 'Rerank 3',
        description: 'Specialized model for ranking and search tasks',
        contextLength: 4096,
        capabilities: {
          supportsSystemMessages: false,
          maxContextLength: 4096,
          supportedRoles: ['user'],
          supportsStreaming: false,
          supportsTools: false,
          supportsFunctionCalling: false,
          supportsVision: false,
          supportsAudio: false
        },
        isDefault: false
      },
      {
        identifier: 'embed-v3',
        name: 'Embed V3',
        description: 'Advanced embeddings model for retrieval and vector use cases',
        contextLength: 512,
        capabilities: {
          supportsSystemMessages: false,
          maxContextLength: 512,
          supportedRoles: ['user'],
          supportsStreaming: false,
          supportsTools: false,
          supportsFunctionCalling: false,
          supportsVision: false,
          supportsAudio: false
        },
        isDefault: false
      }
    ]
  },

  // 6. AI21 Labs
  {
    provider: {
      identifier: 'ai21',
      name: 'AI21 Labs',
      description: 'Jamba and Jurassic models with hybrid architecture and long context',
      apiEndpoint: 'https://api.ai21.com/studio/v1',
      authMethod: 'api_key',
      authConfig: {
        type: 'api_key',
        fields: {
          apiKey: {
            required: true,
            description: 'AI21 API key',
            sensitive: true
          }
        },
        headers: {
          'Authorization': 'Bearer {apiKey}',
          'Content-Type': 'application/json'
        }
      },
      capabilities: {
        supportsSystemMessages: true,
        maxContextLength: 256000,
        supportedRoles: ['system', 'user', 'assistant'],
        supportsStreaming: true,
        supportsTools: false,
        supportedAuthMethods: ['api_key']
      }
    },
    models: [
      {
        identifier: 'jamba-1.5-large',
        name: 'Jamba 1.5 Large',
        description: 'Large-scale hybrid model with extended context capabilities',
        contextLength: 256000,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 256000,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: false,
          supportsFunctionCalling: false,
          supportsVision: false,
          supportsAudio: false
        },
        isDefault: true
      },
      {
        identifier: 'jurassic-2-ultra',
        name: 'Jurassic-2 Ultra',
        description: 'High-performance text generation model from AI21\'s Jurassic line',
        contextLength: 8192,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 8192,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: false,
          supportsFunctionCalling: false,
          supportsVision: false,
          supportsAudio: false
        },
        isDefault: false
      }
    ]
  }
];

/**
 * Populate providers and models in the system
 */
export async function populateProviders(): Promise<void> {
  logger.info('Starting provider population...');
  
  try {
    const providerService = getDynamicProviderService();
    let createdProviders = 0;
    let createdModels = 0;
    let skippedProviders = 0;

    for (const providerData of PROVIDERS_DATA) {
      try {
        logger.info(`Processing provider: ${providerData.provider.name}`);
        
        // Try to create the provider, skip if it already exists
        let provider;
        try {
          provider = await providerService.createProvider(providerData.provider);
          createdProviders++;
          logger.info(`Created provider: ${provider.name} (${provider.id})`);
        } catch (error: any) {
          if (error.message?.includes('already exists')) {
            logger.info(`Provider ${providerData.provider.name} already exists, skipping...`);
            skippedProviders++;
            
            // Get existing provider to create models
            const existingProviders = await providerService.getProviders({ 
              search: providerData.provider.identifier 
            });
            provider = existingProviders.providers.find(p => p.identifier === providerData.provider.identifier);
            
            if (!provider) {
              logger.error(`Could not find existing provider ${providerData.provider.identifier}`);
              continue;
            }
          } else {
            throw error;
          }
        }

        // Create models for this provider
        for (const modelData of providerData.models) {
          try {
            logger.info(`Creating model: ${modelData.name} for provider ${provider.name}`);
            
            const model = await providerService.createModel(provider.id, modelData);
            createdModels++;
            
            logger.info(`Created model: ${model.name} (${model.id})`);
          } catch (error: any) {
            if (error.message?.includes('already exists')) {
              logger.info(`Model ${modelData.name} already exists, skipping...`);
            } else {
              logger.error(`Failed to create model ${modelData.name}:`, error);
            }
          }
        }
      } catch (error) {
        logger.error(`Failed to process provider ${providerData.provider.name}:`, error);
      }
    }

    logger.info(`Provider population completed successfully!`);
    logger.info(`Created ${createdProviders} providers and ${createdModels} models`);
    logger.info(`Skipped ${skippedProviders} existing providers`);
    
  } catch (error) {
    logger.error('Failed to populate providers:', error);
    throw error;
  }
}

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
    database: dbUrl.pathname.slice(1), // Remove leading slash
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
 * Main execution function
 */
async function main() {
  try {
    // Load environment variables
    const dotenv = await import('dotenv');
    dotenv.config({ path: '../.env' });
    
    // Initialize all required services
    await initializeServices();
    
    // Populate providers
    await populateProviders();
    
    process.exit(0);
  } catch (error) {
    logger.error('Provider population failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}