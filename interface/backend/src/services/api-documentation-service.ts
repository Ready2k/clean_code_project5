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
            name: 'Templates',
            description: 'LLM prompt template management and customization'
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

      // Template endpoints
      {
        method: 'GET',
        path: '/templates',
        description: 'List all prompt templates with optional filtering',
        parameters: {
          category: { type: 'string', required: false, description: 'Filter by template category (enhancement, question_generation, etc.)' },
          search: { type: 'string', required: false, description: 'Search term for template name or description' },
          isActive: { type: 'boolean', required: false, description: 'Filter by active status' },
          page: { type: 'number', required: false, description: 'Page number for pagination' },
          limit: { type: 'number', required: false, description: 'Number of items per page' }
        },
        responses: {
          '200': { description: 'List of templates with pagination info' }
        },
        authentication: true,
        permissions: ['read:templates']
      },

      {
        method: 'POST',
        path: '/templates',
        description: 'Create a new prompt template',
        parameters: {
          category: { type: 'string', required: true, description: 'Template category' },
          key: { type: 'string', required: true, description: 'Unique key within category' },
          name: { type: 'string', required: true, description: 'Human-readable template name' },
          description: { type: 'string', required: false, description: 'Template description' },
          content: { type: 'string', required: true, description: 'Template content with variable placeholders' },
          variables: { type: 'array', required: false, description: 'Template variables definition' }
        },
        responses: {
          '201': { description: 'Template created successfully' },
          '400': { description: 'Validation error' }
        },
        authentication: true,
        permissions: ['write:templates']
      },

      {
        method: 'GET',
        path: '/templates/{id}',
        description: 'Get detailed information about a specific template',
        parameters: {
          id: { type: 'string', required: true, description: 'Template ID' }
        },
        responses: {
          '200': { description: 'Template details including content and variables' },
          '404': { description: 'Template not found' }
        },
        authentication: true,
        permissions: ['read:templates']
      },

      {
        method: 'PUT',
        path: '/templates/{id}',
        description: 'Update an existing template',
        parameters: {
          id: { type: 'string', required: true, description: 'Template ID' },
          name: { type: 'string', required: false, description: 'Updated template name' },
          description: { type: 'string', required: false, description: 'Updated description' },
          content: { type: 'string', required: false, description: 'Updated template content' },
          variables: { type: 'array', required: false, description: 'Updated variables definition' },
          changeMessage: { type: 'string', required: false, description: 'Description of changes made' }
        },
        responses: {
          '200': { description: 'Template updated successfully' },
          '400': { description: 'Validation error' },
          '404': { description: 'Template not found' }
        },
        authentication: true,
        permissions: ['write:templates']
      },

      {
        method: 'POST',
        path: '/templates/{id}/test',
        description: 'Test template rendering with sample data',
        parameters: {
          id: { type: 'string', required: true, description: 'Template ID' },
          testData: { type: 'object', required: true, description: 'Variable values for testing' },
          provider: { type: 'string', required: false, description: 'Target LLM provider for testing' }
        },
        responses: {
          '200': { description: 'Template test results including rendered content' },
          '400': { description: 'Invalid test data' },
          '404': { description: 'Template not found' }
        },
        authentication: true,
        permissions: ['test:templates']
      },

      {
        method: 'GET',
        path: '/templates/{id}/analytics',
        description: 'Get template usage statistics and performance metrics',
        parameters: {
          id: { type: 'string', required: true, description: 'Template ID' },
          timeRange: { type: 'string', required: false, description: 'Time range for analytics (1d, 7d, 30d, 90d, 1y)' }
        },
        responses: {
          '200': { description: 'Template analytics including usage stats and performance metrics' },
          '404': { description: 'Template not found' }
        },
        authentication: true,
        permissions: ['read:analytics']
      },

      {
        method: 'GET',
        path: '/templates/{id}/history',
        description: 'Get template version history',
        parameters: {
          id: { type: 'string', required: true, description: 'Template ID' },
          page: { type: 'number', required: false, description: 'Page number for pagination' },
          limit: { type: 'number', required: false, description: 'Number of versions per page' }
        },
        responses: {
          '200': { description: 'Template version history with pagination' },
          '404': { description: 'Template not found' }
        },
        authentication: true,
        permissions: ['read:templates']
      },

      {
        method: 'POST',
        path: '/templates/{id}/revert/{version}',
        description: 'Revert template to a previous version',
        parameters: {
          id: { type: 'string', required: true, description: 'Template ID' },
          version: { type: 'number', required: true, description: 'Version number to revert to' }
        },
        responses: {
          '200': { description: 'Template reverted successfully' },
          '400': { description: 'Invalid version number' },
          '404': { description: 'Template or version not found' }
        },
        authentication: true,
        permissions: ['write:templates']
      },

      {
        method: 'GET',
        path: '/templates/categories',
        description: 'Get all available template categories with counts',
        responses: {
          '200': { description: 'List of template categories with template counts' }
        },
        authentication: true,
        permissions: ['read:templates']
      },

      {
        method: 'POST',
        path: '/templates/export',
        description: 'Export templates in various formats',
        parameters: {
          templateIds: { type: 'array', required: false, description: 'Specific template IDs to export (if not provided, exports all)' },
          format: { type: 'string', required: false, description: 'Export format (json, yaml)' },
          includeHistory: { type: 'boolean', required: false, description: 'Include version history in export' }
        },
        responses: {
          '200': { description: 'Exported templates data' },
          '400': { description: 'Invalid export parameters' }
        },
        authentication: true,
        permissions: ['export:templates']
      },

      {
        method: 'POST',
        path: '/templates/import',
        description: 'Import templates from exported data',
        parameters: {
          templates: { type: 'array', required: true, description: 'Templates to import' },
          overwriteExisting: { type: 'boolean', required: false, description: 'Whether to overwrite existing templates' }
        },
        responses: {
          '200': { description: 'Import results with counts and errors' },
          '400': { description: 'Invalid import data' }
        },
        authentication: true,
        permissions: ['import:templates']
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
      },
      TemplateInfo: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Unique template identifier' },
          category: { type: 'string', enum: ['enhancement', 'question_generation', 'mock_responses', 'system_prompts', 'custom'], description: 'Template category' },
          key: { type: 'string', description: 'Template key within category' },
          name: { type: 'string', description: 'Human-readable template name' },
          description: { type: 'string', description: 'Template description' },
          isActive: { type: 'boolean', description: 'Whether template is active' },
          isDefault: { type: 'boolean', description: 'Whether this is a default system template' },
          version: { type: 'integer', description: 'Current version number' },
          usageCount: { type: 'integer', description: 'Number of times template has been used' },
          lastModified: { type: 'string', format: 'date-time', description: 'Last modification timestamp' },
          createdBy: { type: 'string', description: 'Username of template creator' },
          updatedBy: { type: 'string', description: 'Username of last modifier' }
        }
      },
      TemplateDetail: {
        allOf: [
          { $ref: '#/components/schemas/TemplateInfo' },
          {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'Template content with variable placeholders' },
              variables: {
                type: 'array',
                items: { $ref: '#/components/schemas/TemplateVariable' },
                description: 'Template variables'
              },
              metadata: {
                type: 'object',
                properties: {
                  providerOptimized: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'LLM providers this template is optimized for'
                  },
                  taskTypes: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Task types this template supports'
                  },
                  complexityLevel: {
                    type: 'string',
                    enum: ['basic', 'intermediate', 'advanced'],
                    description: 'Template complexity level'
                  }
                }
              }
            }
          }
        ]
      },
      TemplateVariable: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Variable name (without braces)' },
          type: { type: 'string', enum: ['string', 'number', 'boolean', 'array', 'object'], description: 'Variable data type' },
          description: { type: 'string', description: 'Variable description' },
          required: { type: 'boolean', description: 'Whether variable is required' },
          defaultValue: { description: 'Default value for the variable' }
        }
      },
      TemplateTestResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean', description: 'Whether test was successful' },
          renderedContent: { type: 'string', description: 'Template content with variables substituted' },
          executionTime: { type: 'number', description: 'Template rendering time in milliseconds' },
          errors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Test errors if any'
          },
          warnings: {
            type: 'array',
            items: { type: 'string' },
            description: 'Test warnings if any'
          },
          providerResponse: {
            type: 'object',
            description: 'LLM provider response if tested'
          }
        }
      },
      TemplateAnalytics: {
        type: 'object',
        properties: {
          templateId: { type: 'string', description: 'Template ID' },
          timeRange: { type: 'string', description: 'Analytics time range' },
          usageStats: {
            type: 'object',
            properties: {
              totalUsage: { type: 'integer', description: 'Total number of times template was used' },
              uniqueUsers: { type: 'integer', description: 'Number of unique users who used the template' },
              averageUsagePerDay: { type: 'number', description: 'Average daily usage' },
              usageByProvider: {
                type: 'object',
                description: 'Usage breakdown by LLM provider',
                additionalProperties: { type: 'integer' }
              }
            }
          },
          performanceMetrics: {
            type: 'object',
            properties: {
              averageRenderTime: { type: 'number', description: 'Average template rendering time in milliseconds' },
              successRate: { type: 'number', description: 'Success rate as percentage (0-100)' },
              errorRate: { type: 'number', description: 'Error rate as percentage (0-100)' },
              qualityScore: { type: 'number', description: 'Template quality score (0-100)' }
            }
          }
        }
      },
      TemplateCategory: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: ['enhancement', 'question_generation', 'mock_responses', 'system_prompts', 'custom'], description: 'Category name' },
          displayName: { type: 'string', description: 'Human-readable category name' },
          description: { type: 'string', description: 'Category description' },
          templateCount: { type: 'integer', description: 'Number of templates in this category' },
          activeCount: { type: 'integer', description: 'Number of active templates in this category' }
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
      },
      'Create Template': {
        request: {
          method: 'POST',
          url: '/api/templates',
          headers: {
            'Authorization': 'Bearer <jwt-token>',
            'Content-Type': 'application/json'
          },
          body: {
            category: 'custom',
            key: 'my_custom_template',
            name: 'My Custom Template',
            description: 'A custom template for specific use case',
            content: 'You are a {{role}} assistant. Help the user with {{task_type}} tasks.\n\nUser request: {{user_input}}\n\nProvide a {{output_format}} response.',
            variables: [
              {
                name: 'role',
                type: 'string',
                description: 'Assistant role',
                required: true
              },
              {
                name: 'task_type',
                type: 'string',
                description: 'Type of task to help with',
                required: true
              },
              {
                name: 'user_input',
                type: 'string',
                description: 'User input or request',
                required: true
              },
              {
                name: 'output_format',
                type: 'string',
                description: 'Expected output format',
                required: false,
                defaultValue: 'detailed'
              }
            ]
          }
        },
        response: {
          id: 'template-789',
          category: 'custom',
          key: 'my_custom_template',
          name: 'My Custom Template',
          description: 'A custom template for specific use case',
          isActive: true,
          isDefault: false,
          version: 1,
          usageCount: 0,
          lastModified: '2024-01-01T00:00:00Z',
          createdBy: 'user-123',
          updatedBy: 'user-123'
        }
      },
      'Test Template': {
        request: {
          method: 'POST',
          url: '/api/templates/template-789/test',
          headers: {
            'Authorization': 'Bearer <jwt-token>',
            'Content-Type': 'application/json'
          },
          body: {
            testData: {
              role: 'helpful',
              task_type: 'code review',
              user_input: 'Please review this Python function for best practices',
              output_format: 'markdown'
            },
            provider: 'openai'
          }
        },
        response: {
          success: true,
          renderedContent: 'You are a helpful assistant. Help the user with code review tasks.\n\nUser request: Please review this Python function for best practices\n\nProvide a markdown response.',
          executionTime: 12.5,
          errors: [],
          warnings: [],
          providerResponse: {
            status: 'success',
            responseTime: 1250,
            tokenCount: 45
          }
        }
      },
      'Get Template Analytics': {
        request: {
          method: 'GET',
          url: '/api/templates/template-123/analytics?timeRange=30d',
          headers: {
            'Authorization': 'Bearer <jwt-token>'
          }
        },
        response: {
          templateId: 'template-123',
          timeRange: '30d',
          usageStats: {
            totalUsage: 1247,
            uniqueUsers: 89,
            averageUsagePerDay: 41.6,
            usageByProvider: {
              openai: 756,
              anthropic: 321,
              meta: 170
            }
          },
          performanceMetrics: {
            averageRenderTime: 8.3,
            successRate: 98.7,
            errorRate: 1.3,
            qualityScore: 87.5
          }
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
      },
      '/templates': {
        get: {
          tags: ['Templates'],
          summary: 'List prompt templates',
          parameters: [
            {
              name: 'category',
              in: 'query',
              schema: { 
                type: 'string',
                enum: ['enhancement', 'question_generation', 'mock_responses', 'system_prompts', 'custom']
              },
              description: 'Filter by template category'
            },
            {
              name: 'search',
              in: 'query',
              schema: { type: 'string' },
              description: 'Search term for template name or description'
            },
            {
              name: 'isActive',
              in: 'query',
              schema: { type: 'boolean' },
              description: 'Filter by active status'
            },
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', minimum: 1, default: 1 },
              description: 'Page number (1-based)'
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
              description: 'Number of items per page'
            }
          ],
          responses: {
            '200': {
              description: 'Templates retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/TemplateInfo' }
                      },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          limit: { type: 'integer' },
                          total: { type: 'integer' },
                          totalPages: { type: 'integer' }
                        }
                      }
                    }
                  }
                }
              }
            },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '403': { $ref: '#/components/responses/ForbiddenError' }
          }
        },
        post: {
          tags: ['Templates'],
          summary: 'Create new template',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['category', 'key', 'name', 'content'],
                  properties: {
                    category: {
                      type: 'string',
                      enum: ['enhancement', 'question_generation', 'mock_responses', 'system_prompts', 'custom']
                    },
                    key: { type: 'string' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    content: { type: 'string' },
                    variables: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/TemplateVariable' }
                    }
                  }
                }
              }
            }
          },
          responses: {
            '201': {
              description: 'Template created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TemplateInfo' }
                }
              }
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '403': { $ref: '#/components/responses/ForbiddenError' }
          }
        }
      },
      '/templates/{id}': {
        get: {
          tags: ['Templates'],
          summary: 'Get template by ID',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Template ID'
            }
          ],
          responses: {
            '200': {
              description: 'Template retrieved successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TemplateDetail' }
                }
              }
            },
            '404': { $ref: '#/components/responses/NotFoundError' },
            '401': { $ref: '#/components/responses/UnauthorizedError' }
          }
        },
        put: {
          tags: ['Templates'],
          summary: 'Update template',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Template ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    content: { type: 'string' },
                    variables: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/TemplateVariable' }
                    },
                    changeMessage: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Template updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TemplateDetail' }
                }
              }
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '404': { $ref: '#/components/responses/NotFoundError' },
            '401': { $ref: '#/components/responses/UnauthorizedError' },
            '403': { $ref: '#/components/responses/ForbiddenError' }
          }
        }
      },
      '/templates/{id}/test': {
        post: {
          tags: ['Templates'],
          summary: 'Test template',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Template ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    testData: {
                      type: 'object',
                      description: 'Variable values for testing'
                    },
                    provider: {
                      type: 'string',
                      description: 'Target LLM provider for testing'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Template test completed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TemplateTestResult' }
                }
              }
            },
            '400': { $ref: '#/components/responses/ValidationError' },
            '404': { $ref: '#/components/responses/NotFoundError' },
            '401': { $ref: '#/components/responses/UnauthorizedError' }
          }
        }
      },
      '/templates/{id}/analytics': {
        get: {
          tags: ['Templates'],
          summary: 'Get template analytics',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Template ID'
            },
            {
              name: 'timeRange',
              in: 'query',
              schema: {
                type: 'string',
                enum: ['1d', '7d', '30d', '90d', '1y'],
                default: '30d'
              },
              description: 'Time range for analytics'
            }
          ],
          responses: {
            '200': {
              description: 'Analytics retrieved successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TemplateAnalytics' }
                }
              }
            },
            '404': { $ref: '#/components/responses/NotFoundError' },
            '401': { $ref: '#/components/responses/UnauthorizedError' }
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