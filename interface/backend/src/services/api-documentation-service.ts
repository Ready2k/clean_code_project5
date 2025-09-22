import { logger } from '../utils/logger.js';
import { getExportService } from './export-service.js';
import { ServiceUnavailableError } from '../types/errors.js';

export interface APIEndpoint {
  method: string;
  path: string;
  description: string;
  parameters?: Record<string, {
    type: string;
    required: boolean;
    description: string;
    example?: any;
  }>;
  responses?: Record<string, {
    description: string;
    example?: any;
  }>;
  authentication: boolean;
  permissions?: string[];
}

export interface APIDocumentation {
  title: string;
  version: string;
  description: string;
  baseUrl: string;
  authentication: {
    type: string;
    description: string;
  };
  endpoints: APIEndpoint[];
  schemas: Record<string, any>;
  examples: Record<string, any>;
}

/**
 * Service for generating API documentation for programmatic access
 */
export class APIDocumentationService {
  private isInitialized = false;

  /**
   * Initialize the API documentation service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing API Documentation Service...');
      this.isInitialized = true;
      logger.info('API Documentation Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize API Documentation Service:', error);
      throw new ServiceUnavailableError('API documentation service initialization failed');
    }
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new ServiceUnavailableError('API documentation service not initialized');
    }
  }

  /**
   * Generate complete API documentation
   */
  async generateDocumentation(): Promise<APIDocumentation> {
    this.ensureInitialized();

    try {
      logger.info('Generating API documentation...');

      const exportService = getExportService();
      const supportedFormats = exportService.getSupportedFormats();

      const documentation: APIDocumentation = {
        title: 'Prompt Library API',
        version: '1.0.0',
        description: 'RESTful API for managing AI prompts, connections, and export functionality',
        baseUrl: process.env['API_BASE_URL'] || 'http://localhost:8000/api',
        authentication: {
          type: 'Bearer Token (JWT)',
          description: 'Include JWT token in Authorization header: Bearer <token>'
        },
        endpoints: this.getAPIEndpoints(),
        schemas: this.getAPISchemas(),
        examples: this.getAPIExamples(supportedFormats)
      };

      logger.info('API documentation generated successfully');
      return documentation;
    } catch (error) {
      logger.error('Failed to generate API documentation:', error);
      throw new ServiceUnavailableError('Failed to generate API documentation');
    }
  }

  /**
   * Generate OpenAPI 3.0 specification
   */
  async generateOpenAPISpec(): Promise<any> {
    this.ensureInitialized();

    try {
      logger.info('Generating OpenAPI specification...');

      const documentation = await this.generateDocumentation();
      const exportService = getExportService();
      const supportedFormats = exportService.getSupportedFormats();

      const openApiSpec = {
        openapi: '3.0.0',
        info: {
          title: documentation.title,
          version: documentation.version,
          description: documentation.description,
          contact: {
            name: 'API Support',
            email: 'support@promptlibrary.com'
          }
        },
        servers: [
          {
            url: documentation.baseUrl,
            description: 'Production server'
          }
        ],
        security: [
          {
            bearerAuth: []
          }
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            }
          },
          schemas: this.getOpenAPISchemas(),
          responses: this.getOpenAPIResponses()
        },
        paths: this.getOpenAPIPaths(supportedFormats),
        tags: [
          {
            name: 'Authentication',
            description: 'User authentication and authorization'
          },
          {
            name: 'Prompts',
            description: 'Prompt management operations'
          },
          {
            name: 'Export',
            description: 'Export and integration operations'
          },
          {
            name: 'Connections',
            description: 'LLM connection management'
          },
          {
            name: 'System',
            description: 'System administration and monitoring'
          }
        ]
      };

      logger.info('OpenAPI specification generated successfully');
      return openApiSpec;
    } catch (error) {
      logger.error('Failed to generate OpenAPI specification:', error);
      throw new ServiceUnavailableError('Failed to generate OpenAPI specification');
    }
  }

  /**
   * Get API endpoints documentation
   */
  private getAPIEndpoints(): APIEndpoint[] {
    return [
      // Authentication endpoints
      {
        method: 'POST',
        path: '/auth/login',
        description: 'Authenticate user and get JWT token',
        parameters: {
          email: { type: 'string', required: true, description: 'User email address' },
          password: { type: 'string', required: true, description: 'User password' }
        },
        responses: {
          '200': { description: 'Authentication successful', example: { token: 'jwt-token', user: {} } },
          '401': { description: 'Invalid credentials' }
        },
        authentication: false
      },

      // Prompt endpoints
      {
        method: 'GET',
        path: '/prompts',
        description: 'List all prompts with optional filtering',
        parameters: {
          search: { type: 'string', required: false, description: 'Search term for prompt content' },
          tags: { type: 'string', required: false, description: 'Comma-separated list of tags' },
          owner: { type: 'string', required: false, description: 'Filter by prompt owner' },
          page: { type: 'number', required: false, description: 'Page number for pagination' },
          limit: { type: 'number', required: false, description: 'Number of items per page' }
        },
        responses: {
          '200': { description: 'List of prompts', example: { prompts: [], total: 0 } }
        },
        authentication: true,
        permissions: ['read:prompts']
      },

      {
        method: 'POST',
        path: '/prompts',
        description: 'Create a new prompt',
        parameters: {
          metadata: { type: 'object', required: true, description: 'Prompt metadata' },
          humanPrompt: { type: 'object', required: true, description: 'Human-readable prompt content' }
        },
        responses: {
          '201': { description: 'Prompt created successfully' },
          '400': { description: 'Validation error' }
        },
        authentication: true,
        permissions: ['write:prompts']
      },

      {
        method: 'GET',
        path: '/prompts/{id}',
        description: 'Get a specific prompt by ID',
        parameters: {
          id: { type: 'string', required: true, description: 'Prompt ID' }
        },
        responses: {
          '200': { description: 'Prompt details' },
          '404': { description: 'Prompt not found' }
        },
        authentication: true,
        permissions: ['read:prompts']
      },

      // Export endpoints
      {
        method: 'GET',
        path: '/export/formats',
        description: 'Get supported export formats',
        responses: {
          '200': { description: 'List of supported formats' }
        },
        authentication: true,
        permissions: ['export:prompts']
      },

      {
        method: 'POST',
        path: '/export/prompt/{id}',
        description: 'Export a single prompt in specified format',
        parameters: {
          id: { type: 'string', required: true, description: 'Prompt ID' },
          format: { type: 'string', required: true, description: 'Export format (json, yaml, openai, anthropic, meta)' },
          includeMetadata: { type: 'boolean', required: false, description: 'Include prompt metadata' },
          includeHistory: { type: 'boolean', required: false, description: 'Include version history' },
          substituteVariables: { type: 'boolean', required: false, description: 'Replace variable placeholders' },
          variableValues: { type: 'object', required: false, description: 'Variable values for substitution' }
        },
        responses: {
          '200': { description: 'Exported prompt file' },
          '404': { description: 'Prompt not found' },
          '400': { description: 'Invalid export format or parameters' }
        },
        authentication: true,
        permissions: ['export:prompts']
      },

      {
        method: 'POST',
        path: '/export/bulk',
        description: 'Export multiple prompts as an archive',
        parameters: {
          promptIds: { type: 'array', required: true, description: 'Array of prompt IDs to export' },
          format: { type: 'string', required: true, description: 'Export format' },
          archiveFormat: { type: 'string', required: false, description: 'Archive format (zip, tar)' },
          filename: { type: 'string', required: false, description: 'Custom filename for archive' }
        },
        responses: {
          '200': { description: 'Archive file with exported prompts' },
          '400': { description: 'Invalid parameters or no valid prompts' }
        },
        authentication: true,
        permissions: ['export:prompts']
      },

      // Connection endpoints
      {
        method: 'GET',
        path: '/connections',
        description: 'List all LLM connections',
        responses: {
          '200': { description: 'List of connections' }
        },
        authentication: true,
        permissions: ['manage:connections']
      },

      {
        method: 'POST',
        path: '/connections',
        description: 'Create a new LLM connection',
        parameters: {
          name: { type: 'string', required: true, description: 'Connection name' },
          provider: { type: 'string', required: true, description: 'Provider type (openai, bedrock)' },
          config: { type: 'object', required: true, description: 'Provider-specific configuration' }
        },
        responses: {
          '201': { description: 'Connection created successfully' },
          '400': { description: 'Validation error' }
        },
        authentication: true,
        permissions: ['manage:connections']
      }
    ];
  }

  /**
   * Get API schemas
   */
  private getAPISchemas(): Record<string, any> {
    return {
      PromptRecord: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique prompt identifier' },
          version: { type: 'number', description: 'Prompt version number' },
          metadata: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Prompt title' },
              summary: { type: 'string', description: 'Brief description' },
              tags: { type: 'array', items: { type: 'string' }, description: 'Categorization tags' },
              owner: { type: 'string', description: 'Prompt owner ID' },
              created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
              updated_at: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
            }
          },
          humanPrompt: {
            type: 'object',
            properties: {
              goal: { type: 'string', description: 'What the prompt aims to achieve' },
              audience: { type: 'string', description: 'Target audience' },
              steps: { type: 'array', items: { type: 'string' }, description: 'Step-by-step instructions' },
              output_expectations: {
                type: 'object',
                properties: {
                  format: { type: 'string', description: 'Expected output format' },
                  fields: { type: 'array', items: { type: 'string' }, description: 'Expected output fields' }
                }
              }
            }
          },
          variables: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string', description: 'Variable key' },
                label: { type: 'string', description: 'Human-readable label' },
                type: { type: 'string', enum: ['string', 'number', 'boolean', 'select', 'multiselect'] },
                required: { type: 'boolean', description: 'Whether variable is required' },
                sensitive: { type: 'boolean', description: 'Whether variable contains sensitive data' }
              }
            }
          }
        }
      },
      ExportOptions: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['json', 'yaml', 'openai', 'anthropic', 'meta'], description: 'Export format' },
          includeMetadata: { type: 'boolean', default: true, description: 'Include prompt metadata' },
          includeHistory: { type: 'boolean', default: false, description: 'Include version history' },
          includeRatings: { type: 'boolean', default: false, description: 'Include user ratings' },
          substituteVariables: { type: 'boolean', default: false, description: 'Replace variable placeholders' },
          variableValues: { type: 'object', description: 'Variable values for substitution' },
          template: { type: 'string', enum: ['minimal', 'full', 'provider-ready'], default: 'full' }
        }
      }
    };
  }

  /**
   * Get API examples
   */
  private getAPIExamples(_supportedFormats: any[]): Record<string, any> {
    return {
      'Create Prompt': {
        request: {
          method: 'POST',
          url: '/api/prompts',
          headers: {
            'Authorization': 'Bearer <jwt-token>',
            'Content-Type': 'application/json'
          },
          body: {
            metadata: {
              title: 'Code Review Assistant',
              summary: 'A prompt to help review code and provide feedback',
              tags: ['code-review', 'development']
            },
            humanPrompt: {
              goal: 'Review code and provide constructive feedback',
              audience: 'Software developers',
              steps: [
                'Analyze code structure',
                'Identify potential issues',
                'Provide actionable suggestions'
              ],
              output_expectations: {
                format: 'Structured feedback',
                fields: ['strengths', 'issues', 'suggestions']
              }
            }
          }
        },
        response: {
          id: 'prompt-123',
          version: 1,
          metadata: {
            title: 'Code Review Assistant',
            summary: 'A prompt to help review code and provide feedback',
            tags: ['code-review', 'development'],
            owner: 'user-456',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        }
      },
      'Export Prompt': {
        request: {
          method: 'POST',
          url: '/api/export/prompt/prompt-123',
          headers: {
            'Authorization': 'Bearer <jwt-token>',
            'Content-Type': 'application/json'
          },
          body: {
            format: 'openai',
            includeMetadata: true,
            substituteVariables: true,
            variableValues: {
              code: 'function hello() { console.log("Hello World"); }'
            }
          }
        },
        response: {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="code_review_assistant_openai.json"'
          },
          body: {
            prompt_id: 'prompt-123',
            provider: 'openai',
            request: {
              model: 'gpt-3.5-turbo',
              messages: [
                {
                  role: 'system',
                  content: 'You are a code review assistant.'
                },
                {
                  role: 'user',
                  content: 'Please review this code: function hello() { console.log("Hello World"); }'
                }
              ]
            }
          }
        }
      },
      'Bulk Export': {
        request: {
          method: 'POST',
          url: '/api/export/bulk',
          body: {
            promptIds: ['prompt-123', 'prompt-456'],
            format: 'json',
            archiveFormat: 'zip',
            filename: 'my_prompts.zip'
          }
        },
        response: {
          headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="my_prompts.zip"'
          },
          body: 'Binary ZIP archive containing exported prompts'
        }
      }
    };
  }

  /**
   * Get OpenAPI schemas
   */
  private getOpenAPISchemas(): Record<string, any> {
    return {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' }
            }
          },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      ...this.getAPISchemas()
    };
  }

  /**
   * Get OpenAPI responses
   */
  private getOpenAPIResponses(): Record<string, any> {
    return {
      UnauthorizedError: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      ForbiddenError: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      }
    };
  }

  /**
   * Get OpenAPI paths
   */
  private getOpenAPIPaths(_supportedFormats: any[]): Record<string, any> {
    return {
      '/export/formats': {
        get: {
          tags: ['Export'],
          summary: 'Get supported export formats',
          responses: {
            '200': {
              description: 'List of supported formats',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      formats: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            name: { type: 'string' },
                            description: { type: 'string' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/export/prompt/{id}': {
        post: {
          tags: ['Export'],
          summary: 'Export a single prompt',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Prompt ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ExportOptions' }
              }
            }
          },
          responses: {
            '200': {
              description: 'Exported prompt file',
              content: {
                'application/json': {},
                'application/x-yaml': {},
                'application/octet-stream': {}
              }
            },
            '404': { $ref: '#/components/responses/NotFoundError' },
            '400': { $ref: '#/components/responses/ValidationError' }
          }
        }
      }
    };
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    initialized: boolean;
    healthy: boolean;
  }> {
    try {
      return {
        initialized: this.isInitialized,
        healthy: this.isInitialized
      };
    } catch (error) {
      logger.error('Failed to get API documentation service status:', error);
      return {
        initialized: this.isInitialized,
        healthy: false
      };
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Shutting down API Documentation Service...');
      this.isInitialized = false;
      logger.info('API Documentation Service shut down successfully');
    }
  }
}

// Singleton instance for the API
let apiDocumentationService: APIDocumentationService | null = null;

/**
 * Get the singleton instance of the API documentation service
 */
export function getAPIDocumentationService(): APIDocumentationService {
  if (!apiDocumentationService) {
    apiDocumentationService = new APIDocumentationService();
  }
  return apiDocumentationService;
}

/**
 * Initialize the API documentation service
 */
export async function initializeAPIDocumentationService(): Promise<void> {
  if (apiDocumentationService) {
    await apiDocumentationService.shutdown();
  }
  
  apiDocumentationService = new APIDocumentationService();
  await apiDocumentationService.initialize();
}