/**
 * Predefined Provider Templates
 * 
 * This file contains templates for major AI providers with their supported models.
 * These templates can be used to quickly set up providers without requiring active connections.
 */

import { ProviderTemplate } from '../types/dynamic-providers.js';

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  // OpenAI / Microsoft Azure OpenAI
  {
    id: 'openai-template',
    name: 'OpenAI',
    description: 'OpenAI GPT models including GPT-4, GPT-3.5, and latest reasoning models',
    providerConfig: {
      name: 'OpenAI',
      description: 'OpenAI API provider for GPT models',
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
    defaultModels: [
      {
        identifier: 'o3',
        name: 'o3',
        description: 'OpenAI\'s latest reasoning model',
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
        identifier: 'o4-mini',
        name: 'o4-mini',
        description: 'A lighter version in the "o4" line',
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
        identifier: 'gpt-4',
        name: 'GPT-4',
        description: 'Original GPT-4 model for complex reasoning tasks',
        contextLength: 8192,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 8192,
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
        identifier: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'High-performance model for complex tasks',
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
        isDefault: true
      },
      {
        identifier: 'gpt-4o',
        name: 'GPT-4o (Omni)',
        description: 'Multimodal model supporting text and images',
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
        isDefault: false
      },
      {
        identifier: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and efficient model for most applications',
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
        isDefault: false
      }
    ],
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Azure OpenAI
  {
    id: 'azure-openai-template',
    name: 'Azure OpenAI',
    description: 'Microsoft Azure OpenAI Service',
    providerConfig: {
      name: 'Azure OpenAI',
      description: 'Microsoft Azure OpenAI Service provider',
      apiEndpoint: 'https://{resource-name}.openai.azure.com',
      authMethod: 'api_key',
      authConfig: {
        type: 'api_key',
        fields: {
          apiKey: {
            required: true,
            description: 'Azure OpenAI API key',
            sensitive: true
          },
          resourceName: {
            required: true,
            description: 'Azure OpenAI resource name'
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
    defaultModels: [
      {
        identifier: 'gpt-4',
        name: 'GPT-4',
        description: 'GPT-4 model on Azure',
        contextLength: 8192,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 8192,
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
        identifier: 'gpt-35-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'GPT-3.5 Turbo model on Azure',
        contextLength: 4096,
        capabilities: {
          supportsSystemMessages: true,
          maxContextLength: 4096,
          supportedRoles: ['system', 'user', 'assistant'],
          supportsStreaming: true,
          supportsTools: true,
          supportsFunctionCalling: true,
          supportsVision: false,
          supportsAudio: false
        },
        isDefault: false
      }
    ],
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Anthropic Claude
  {
    id: 'anthropic-template',
    name: 'Anthropic Claude',
    description: 'Anthropic Claude models including Opus, Sonnet, and Haiku',
    providerConfig: {
      name: 'Anthropic',
      description: 'Anthropic Claude API provider',
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
    defaultModels: [
      {
        identifier: 'claude-opus-4.1',
        name: 'Claude Opus 4.1',
        description: 'Most powerful Claude model for complex reasoning',
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
        identifier: 'claude-sonnet-4.5',
        name: 'Claude Sonnet 4.5',
        description: 'Balanced performance and cost model',
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
        isDefault: true
      },
      {
        identifier: 'claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        description: 'Current generation balanced model',
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
        isDefault: false
      }
    ],
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Google Gemini
  {
    id: 'google-gemini-template',
    name: 'Google Gemini',
    description: 'Google Gemini models including Pro and Flash variants',
    providerConfig: {
      name: 'Google Gemini',
      description: 'Google Gemini API provider',
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
    defaultModels: [
      {
        identifier: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Full reasoning flagship model',
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
        description: 'Optimized for cost and speed with reasoning',
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
        description: 'Widely deployed production model',
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
        description: 'Previous generation Pro model',
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
      }
    ],
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Mistral
  {
    id: 'mistral-template',
    name: 'Mistral AI',
    description: 'Mistral AI models including Large, Medium, and specialized variants',
    providerConfig: {
      name: 'Mistral AI',
      description: 'Mistral AI API provider',
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
    },
    defaultModels: [
      {
        identifier: 'mistral-large-2.1',
        name: 'Mistral Large 2.1',
        description: 'High-capacity flagship model',
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
        identifier: 'mistral-medium-3',
        name: 'Mistral Medium 3',
        description: 'Current frontier class model',
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
        identifier: 'mistral-small',
        name: 'Mistral Small',
        description: 'Lightweight and efficient model',
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
        description: 'Specialized model for code generation',
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
    ],
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // Cohere
  {
    id: 'cohere-template',
    name: 'Cohere',
    description: 'Cohere Command models optimized for enterprise use',
    providerConfig: {
      name: 'Cohere',
      description: 'Cohere API provider for Command models',
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
    defaultModels: [
      {
        identifier: 'command-a',
        name: 'Command A',
        description: 'Flagship generative model optimized for enterprise',
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
        description: 'Chat and reasoning optimized model',
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
      }
    ],
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },

  // AI21 Labs
  {
    id: 'ai21-template',
    name: 'AI21 Labs',
    description: 'AI21 Labs Jamba and Jurassic models',
    providerConfig: {
      name: 'AI21 Labs',
      description: 'AI21 Labs API provider',
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
    defaultModels: [
      {
        identifier: 'jamba-1.5-large',
        name: 'Jamba 1.5 Large',
        description: 'Large-scale hybrid model with long context',
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
        description: 'High-performance text generation model',
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
    ],
    isSystem: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

/**
 * Get all available provider templates
 */
export function getAllProviderTemplates(): ProviderTemplate[] {
  return PROVIDER_TEMPLATES;
}

/**
 * Get a specific provider template by ID
 */
export function getProviderTemplate(id: string): ProviderTemplate | undefined {
  return PROVIDER_TEMPLATES.find(template => template.id === id);
}

/**
 * Get provider templates by category/provider name
 */
export function getProviderTemplatesByProvider(providerName: string): ProviderTemplate[] {
  return PROVIDER_TEMPLATES.filter(template => 
    template.name.toLowerCase().includes(providerName.toLowerCase())
  );
}

/**
 * Search provider templates by name or description
 */
export function searchProviderTemplates(query: string): ProviderTemplate[] {
  const lowerQuery = query.toLowerCase();
  return PROVIDER_TEMPLATES.filter(template =>
    template.name.toLowerCase().includes(lowerQuery) ||
    template.description?.toLowerCase().includes(lowerQuery) ||
    template.defaultModels.some(model => 
      model.name.toLowerCase().includes(lowerQuery) ||
      model.description?.toLowerCase().includes(lowerQuery)
    )
  );
}