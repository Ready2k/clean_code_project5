/**
 * Template Management Service
 * 
 * Enhanced template management functionality including CRUD operations,
 * template instantiation with parameter substitution, and system template management.
 * This service builds on top of the TemplateStorageService to provide higher-level operations.
 */

import { getTemplateStorageService } from './template-storage-service.js';
import { logger } from '../utils/logger.js';
import { AppError, ValidationError, NotFoundError, ConflictError, ErrorCode } from '../types/errors.js';
import { DynamicProviderValidator } from '../types/dynamic-provider-validation.js';
import {
  ProviderTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  ApplyTemplateRequest,
  CreateProviderRequest,
  ProviderTemplateConfig,
  ModelTemplateConfig,
  AuthMethod,

} from '../types/dynamic-providers.js';

/**
 * Enhanced template management service
 */
export class TemplateManagementService {
  private templateStorage = getTemplateStorageService();

  // ============================================================================
  // Template CRUD Operations
  // ============================================================================

  /**
   * Create a new template
   */
  async createTemplate(request: CreateTemplateRequest, createdBy?: string): Promise<ProviderTemplate> {
    return this.createTemplateWithValidation(request, createdBy);
  }

  /**
   * Get a template by ID
   */
  async getTemplate(id: string): Promise<ProviderTemplate> {
    return this.templateStorage.getTemplate(id);
  }

  /**
   * Get templates with filtering
   */
  async getTemplates(options: any = {}): Promise<{ templates: ProviderTemplate[]; total: number }> {
    return await this.templateStorage.getTemplates(options);
  }

  /**
   * Update a template
   */
  async updateTemplate(id: string, request: UpdateTemplateRequest): Promise<ProviderTemplate> {
    return this.templateStorage.updateTemplate(id, request);
  }

  /**
   * Delete a template
   */
  async deleteTemplate(id: string): Promise<void> {
    return this.templateStorage.deleteTemplate(id);
  }

  /**
   * Create a new template with validation
   */
  async createTemplateWithValidation(request: CreateTemplateRequest, createdBy?: string): Promise<ProviderTemplate> {
    logger.info('Creating template with validation', {
      name: request.name,
      createdBy
    });

    try {
      // Validate request data
      const validation = DynamicProviderValidator.validateCreateTemplate(request);
      if (validation.error) {
        throw new ValidationError(`Invalid template configuration: ${validation.error.message}`);
      }

      // Validate provider configuration within template
      await this.validateProviderTemplateConfig(request.providerConfig);

      // Validate default models
      for (const modelTemplate of request.defaultModels) {
        await this.validateModelTemplateConfig(modelTemplate, request.providerConfig);
      }

      // Create the template
      const template = await this.templateStorage.createTemplate(request, createdBy);

      logger.info('Template created successfully with validation', {
        templateId: template.id,
        name: template.name
      });

      return template;

    } catch (error) {
      logger.error('Failed to create template with validation:', error);
      
      if (error instanceof ValidationError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to create template',
        500,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Update template with validation
   */
  async updateTemplateWithValidation(id: string, request: UpdateTemplateRequest): Promise<ProviderTemplate> {
    logger.info('Updating template with validation', { templateId: id });

    try {
      // Validate request data
      const validation = DynamicProviderValidator.validateUpdateTemplate(request);
      if (validation.error) {
        throw new ValidationError(`Invalid update request: ${validation.error.message}`);
      }

      // Get current template to check if it's a system template
      const currentTemplate = await this.templateStorage.getTemplate(id);
      
      if (currentTemplate.isSystem) {
        throw new ValidationError('Cannot modify system template');
      }

      // Validate provider configuration if being updated
      if (request.providerConfig) {
        await this.validateProviderTemplateConfig({
          ...currentTemplate.providerConfig,
          ...request.providerConfig
        });
      }

      // Validate default models if being updated
      if (request.defaultModels) {
        const providerConfig = request.providerConfig ? 
          { ...currentTemplate.providerConfig, ...request.providerConfig } :
          currentTemplate.providerConfig;
        for (const modelTemplate of request.defaultModels) {
          await this.validateModelTemplateConfig(modelTemplate, providerConfig);
        }
      }

      // Update the template
      const template = await this.templateStorage.updateTemplate(id, request);

      logger.info('Template updated successfully with validation', { templateId: id });

      return template;

    } catch (error) {
      logger.error('Failed to update template with validation:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to update template',
        500,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Delete template with checks
   */
  async deleteTemplateWithChecks(id: string): Promise<void> {
    logger.info('Deleting template with checks', { templateId: id });

    try {
      // Get template to check if it's a system template
      const template = await this.templateStorage.getTemplate(id);

      if (template.isSystem) {
        throw new ValidationError('Cannot delete system template');
      }

      // Check if template is in use (would need to track template usage)
      // For now, we'll just delete it

      // Delete the template
      await this.templateStorage.deleteTemplate(id);

      logger.info('Template deleted successfully', { templateId: id });

    } catch (error) {
      logger.error('Failed to delete template:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to delete template',
        500,
        ErrorCode.DATABASE_ERROR
      );
    }
  }

  // ============================================================================
  // Template Instantiation and Customization
  // ============================================================================

  /**
   * Apply template with customizations to create provider configuration
   */
  async applyTemplateWithCustomizations(
    templateId: string,
    customizations: {
      name?: string;
      description?: string;
      authConfig?: Record<string, any>;
      selectedModels?: string[];
      customFields?: Record<string, any>;
    } = {}
  ): Promise<CreateProviderRequest> {
    logger.info('Applying template with customizations', {
      templateId,
      customizations: Object.keys(customizations)
    });

    try {
      // Get the template
      const template = await this.templateStorage.getTemplate(templateId);

      // Apply customizations to create provider configuration
      const providerConfig = await this.templateStorage.instantiateTemplate(template, customizations);

      logger.info('Template applied successfully', {
        templateId,
        providerName: providerConfig.name
      });

      return providerConfig;

    } catch (error) {
      logger.error('Failed to apply template:', error);
      
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to apply template',
        500,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Preview template instantiation without creating provider
   */
  async previewTemplateInstantiation(
    templateId: string,
    customizations: Record<string, any> = {}
  ): Promise<{
    providerConfig: CreateProviderRequest;
    selectedModels: ModelTemplateConfig[];
    warnings: string[];
  }> {
    logger.info('Previewing template instantiation', { templateId });

    try {
      const template = await this.templateStorage.getTemplate(templateId);
      
      // Generate provider configuration
      const providerConfig = await this.templateStorage.instantiateTemplate(template, customizations);
      
      // Determine selected models
      const selectedModelIds = customizations['selectedModels'] || template.defaultModels.map(m => m.identifier);
      const selectedModels = template.defaultModels.filter(m => selectedModelIds.includes(m.identifier));
      
      // Generate warnings
      const warnings: string[] = [];
      
      // Check for missing required customizations
      if (!customizations['name'] && template.providerConfig.name.includes('{{')) {
        warnings.push('Provider name contains template variables that need customization');
      }
      
      if (!customizations['authConfig']) {
        warnings.push('Authentication configuration may need customization');
      }
      
      // Check for model compatibility
      for (const model of selectedModels) {
        if (model.contextLength > (providerConfig.capabilities?.maxContextLength || 0)) {
          warnings.push(`Model ${model.name} context length exceeds provider maximum`);
        }
      }

      return {
        providerConfig,
        selectedModels,
        warnings
      };

    } catch (error) {
      logger.error('Failed to preview template instantiation:', error);
      throw new AppError(
        'Failed to preview template',
        500,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  // ============================================================================
  // System Template Management
  // ============================================================================

  /**
   * Get all system templates
   */
  async getSystemTemplates(): Promise<ProviderTemplate[]> {
    const result = await this.templateStorage.getTemplates({ isSystem: true });
    return result.templates;
  }

  /**
   * Create system template (admin only)
   */
  async createSystemTemplate(request: CreateTemplateRequest): Promise<ProviderTemplate> {
    logger.info('Creating system template', { name: request.name });

    try {
      // Validate template configuration
      const validation = DynamicProviderValidator.validateCreateTemplate(request);
      if (validation.error) {
        throw new ValidationError(`Invalid system template configuration: ${validation.error.message}`);
      }

      // Create template (it will be marked as system in the storage layer)
      const template = await this.templateStorage.createTemplate(request);

      logger.info('System template created successfully', {
        templateId: template.id,
        name: template.name
      });

      return template;

    } catch (error) {
      logger.error('Failed to create system template:', error);
      throw new AppError(
        'Failed to create system template',
        500,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Update system template
   */
  async updateSystemTemplate(id: string, request: UpdateTemplateRequest): Promise<ProviderTemplate> {
    logger.info('Updating system template', { templateId: id });

    try {
      // Verify it's a system template
      const template = await this.templateStorage.getTemplate(id);
      if (!template.isSystem) {
        throw new ValidationError('Template is not a system template');
      }

      // Update the template
      const updatedTemplate = await this.templateStorage.updateTemplate(id, request);

      logger.info('System template updated successfully', { templateId: id });

      return updatedTemplate;

    } catch (error) {
      logger.error('Failed to update system template:', error);
      
      if (error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      
      throw new AppError(
        'Failed to update system template',
        500,
        ErrorCode.VALIDATION_ERROR
      );
    }
  }

  /**
   * Initialize default system templates
   */
  async initializeSystemTemplates(): Promise<void> {
    logger.info('Initializing system templates');

    const defaultTemplates = this.getDefaultSystemTemplates();

    for (const templateData of defaultTemplates) {
      try {
        // Check if template already exists
        const existing = await this.templateStorage.getTemplateByName(templateData.name);
        if (existing) {
          logger.debug('System template already exists', { name: templateData.name });
          continue;
        }

        // Create system template
        await this.createSystemTemplate(templateData);
        
        logger.info('System template initialized', { name: templateData.name });

      } catch (error) {
        logger.error('Failed to initialize system template', {
          name: templateData.name,
          error: (error as any).message
        });
      }
    }

    logger.info('System template initialization completed');
  }

  // ============================================================================
  // Template Validation
  // ============================================================================

  /**
   * Validate provider template configuration
   */
  private async validateProviderTemplateConfig(config: ProviderTemplateConfig): Promise<void> {
    // Validate basic structure
    if (!config.name || !config.apiEndpoint || !config.authMethod) {
      throw new ValidationError('Provider template config missing required fields');
    }

    // Validate auth method
    const validAuthMethods: AuthMethod[] = ['api_key', 'oauth2', 'aws_iam', 'custom'];
    if (!validAuthMethods.includes(config.authMethod)) {
      throw new ValidationError(`Invalid auth method: ${config.authMethod}`);
    }

    // Validate API endpoint format (allow template variables)
    if (!config.apiEndpoint.startsWith('http') && !config.apiEndpoint.includes('{{')) {
      throw new ValidationError('Invalid API endpoint format');
    }

    // Validate capabilities if provided
    if (config.capabilities) {
      if (config.capabilities.maxContextLength && config.capabilities.maxContextLength <= 0) {
        throw new ValidationError('Invalid max context length in capabilities');
      }
    }
  }

  /**
   * Validate model template configuration
   */
  private async validateModelTemplateConfig(
    modelConfig: ModelTemplateConfig,
    providerConfig: ProviderTemplateConfig
  ): Promise<void> {
    // Validate basic structure
    if (!modelConfig.identifier || !modelConfig.name || !modelConfig.contextLength) {
      throw new ValidationError('Model template config missing required fields');
    }

    // Validate context length
    if (modelConfig.contextLength <= 0) {
      throw new ValidationError('Model context length must be positive');
    }

    // Validate against provider capabilities if available
    if (providerConfig.capabilities && providerConfig.capabilities.maxContextLength) {
      if (modelConfig.contextLength > providerConfig.capabilities.maxContextLength) {
        throw new ValidationError(
          `Model context length (${modelConfig.contextLength}) exceeds provider maximum (${providerConfig.capabilities.maxContextLength})`
        );
      }
    }

    // Validate model capabilities if provided
    if (modelConfig.capabilities) {
      if (modelConfig.capabilities.maxContextLength && 
          modelConfig.capabilities.maxContextLength !== modelConfig.contextLength) {
        throw new ValidationError('Model capability context length must match model context length');
      }
    }
  }

  // ============================================================================
  // Template Discovery and Management
  // ============================================================================

  /**
   * Search templates by criteria
   */
  async searchTemplates(criteria: {
    query?: string;
    authMethod?: AuthMethod;
    hasModels?: boolean;
    isSystem?: boolean;
  }): Promise<ProviderTemplate[]> {
    logger.info('Searching templates', { criteria });

    try {
      const searchOptions: any = {};
      if (criteria.query) {
        searchOptions.search = criteria.query;
      }
      if (criteria.isSystem !== undefined) {
        searchOptions.isSystem = criteria.isSystem;
      }
      
      const result = await this.templateStorage.getTemplates(searchOptions);

      let templates = result.templates;

      // Filter by auth method if specified
      if (criteria.authMethod) {
        templates = templates.filter(t => t.providerConfig.authMethod === criteria.authMethod);
      }

      // Filter by model availability if specified
      if (criteria.hasModels !== undefined) {
        templates = templates.filter(t => 
          criteria.hasModels ? t.defaultModels.length > 0 : t.defaultModels.length === 0
        );
      }

      logger.debug('Template search completed', {
        criteria,
        found: templates.length
      });

      return templates;

    } catch (error) {
      logger.error('Failed to search templates:', error);
      throw new AppError(
        'Failed to search templates',
        500,
        ErrorCode.DATABASE_ERROR
      );
    }
  }

  /**
   * Get template usage statistics
   */
  async getTemplateStats(): Promise<{
    total: number;
    system: number;
    custom: number;
    byAuthMethod: Record<AuthMethod, number>;
    mostUsed: Array<{ templateId: string; name: string; usageCount: number }>;
  }> {
    try {
      const result = await this.templateStorage.getTemplates();
      const templates = result.templates;

      const stats = {
        total: templates.length,
        system: templates.filter(t => t.isSystem).length,
        custom: templates.filter(t => !t.isSystem).length,
        byAuthMethod: {
          api_key: 0,
          oauth2: 0,
          aws_iam: 0,
          custom: 0
        } as Record<AuthMethod, number>,
        mostUsed: [] as Array<{ templateId: string; name: string; usageCount: number }>
      };

      // Count by auth method
      for (const template of templates) {
        stats.byAuthMethod[template.providerConfig.authMethod]++;
      }

      // For now, we don't track usage, so mostUsed will be empty
      // In a real implementation, this would query usage tracking data

      return stats;

    } catch (error) {
      logger.error('Failed to get template stats:', error);
      throw new AppError(
        'Failed to get template statistics',
        500,
        ErrorCode.DATABASE_ERROR
      );
    }
  }

  // ============================================================================
  // Default System Templates
  // ============================================================================

  /**
   * Get default system templates configuration
   */
  private getDefaultSystemTemplates(): CreateTemplateRequest[] {
    return [
      {
        name: 'OpenAI GPT',
        description: 'Template for OpenAI GPT models with API key authentication',
        providerConfig: {
          name: 'OpenAI {{name}}',
          description: 'OpenAI provider for GPT models',
          apiEndpoint: 'https://api.openai.com/v1',
          authMethod: 'api_key',
          authConfig: {
            type: 'api_key',
            fields: {
              apiKey: {
                required: true,
                description: 'OpenAI API key',
                sensitive: true
              },
              organizationId: {
                required: false,
                description: 'OpenAI organization ID (optional)'
              }
            },
            headers: {
              'Authorization': 'Bearer {{apiKey}}',
              'OpenAI-Organization': '{{organizationId}}'
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
            description: 'Most capable GPT-4 model',
            contextLength: 8192,
            isDefault: true
          },
          {
            identifier: 'gpt-4-turbo',
            name: 'GPT-4 Turbo',
            description: 'Latest GPT-4 Turbo model',
            contextLength: 128000
          },
          {
            identifier: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            description: 'Fast and efficient GPT-3.5 model',
            contextLength: 16385
          }
        ]
      },
      {
        name: 'Anthropic Claude',
        description: 'Template for Anthropic Claude models with API key authentication',
        providerConfig: {
          name: 'Anthropic {{name}}',
          description: 'Anthropic provider for Claude models',
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
            },
            headers: {
              'x-api-key': '{{apiKey}}',
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
        defaultModels: [
          {
            identifier: 'claude-3-opus-20240229',
            name: 'Claude 3 Opus',
            description: 'Most powerful Claude 3 model',
            contextLength: 200000,
            isDefault: true
          },
          {
            identifier: 'claude-3-sonnet-20240229',
            name: 'Claude 3 Sonnet',
            description: 'Balanced Claude 3 model',
            contextLength: 200000
          },
          {
            identifier: 'claude-3-haiku-20240307',
            name: 'Claude 3 Haiku',
            description: 'Fastest Claude 3 model',
            contextLength: 200000
          }
        ]
      },
      {
        name: 'AWS Bedrock',
        description: 'Template for AWS Bedrock with IAM authentication',
        providerConfig: {
          name: 'AWS Bedrock {{region}}',
          description: 'AWS Bedrock provider',
          apiEndpoint: 'https://bedrock-runtime.{{region}}.amazonaws.com',
          authMethod: 'aws_iam',
          authConfig: {
            type: 'aws_iam',
            fields: {
              accessKeyId: {
                required: true,
                description: 'AWS access key ID',
                sensitive: true
              },
              secretAccessKey: {
                required: true,
                description: 'AWS secret access key',
                sensitive: true
              },
              region: {
                required: true,
                description: 'AWS region',
                default: 'us-east-1'
              }
            }
          },
          capabilities: {
            supportsSystemMessages: true,
            maxContextLength: 200000,
            supportedRoles: ['system', 'user', 'assistant'],
            supportsStreaming: true,
            supportsTools: false,
            supportedAuthMethods: ['aws_iam']
          }
        },
        defaultModels: [
          {
            identifier: 'anthropic.claude-3-opus-20240229-v1:0',
            name: 'Claude 3 Opus (Bedrock)',
            description: 'Claude 3 Opus via AWS Bedrock',
            contextLength: 200000,
            isDefault: true
          },
          {
            identifier: 'anthropic.claude-3-sonnet-20240229-v1:0',
            name: 'Claude 3 Sonnet (Bedrock)',
            description: 'Claude 3 Sonnet via AWS Bedrock',
            contextLength: 200000
          }
        ]
      }
    ];
  }

  // ============================================================================
  // Additional Methods for API Controllers
  // ============================================================================

  /**
   * Preview template application
   */
  async previewTemplate(request: ApplyTemplateRequest): Promise<any> {
    logger.info('Previewing template application', { templateId: request.templateId });

    try {
      const template = await this.templateStorage.getTemplate(request.templateId);
      const customizations = request.customizations || {};

      // Apply customizations to template
      const previewConfig = {
        ...template.providerConfig,
        name: customizations.name || template.providerConfig.name,
        description: customizations.description || template.providerConfig.description,
        identifier: customizations.providerIdentifier || template.name.toLowerCase().replace(/\s+/g, '-')
      };

      // Apply auth config customizations
      if (customizations.authConfig) {
        previewConfig.authConfig = {
          ...previewConfig.authConfig,
          fields: {
            ...previewConfig.authConfig.fields,
            ...customizations.authConfig
          }
        };
      }

      // Filter models if specified
      let previewModels = template.defaultModels;
      if (customizations.selectedModels && customizations.selectedModels.length > 0) {
        previewModels = template.defaultModels.filter(model => 
          customizations.selectedModels!.includes(model.identifier)
        );
      }

      return {
        providerConfig: previewConfig,
        models: previewModels,
        template: {
          id: template.id,
          name: template.name,
          description: template.description
        }
      };
    } catch (error) {
      logger.error('Failed to preview template:', error);
      throw error;
    }
  }

  /**
   * Get template customization options
   */
  async getCustomizationOptions(templateId: string): Promise<any> {
    try {
      const template = await this.templateStorage.getTemplate(templateId);

      return {
        templateId,
        templateName: template.name,
        requiredFields: {
          name: { required: true, type: 'string', description: 'Provider name' },
          providerIdentifier: { required: true, type: 'string', description: 'Unique provider identifier' }
        },
        optionalFields: {
          description: { required: false, type: 'string', description: 'Provider description' }
        },
        authFields: Object.keys(template.providerConfig.authConfig.fields).map(key => ({
          key,
          ...template.providerConfig.authConfig.fields[key],
          customizable: true
        })),
        availableModels: template.defaultModels.map(model => ({
          identifier: model.identifier,
          name: model.name,
          description: model.description,
          contextLength: model.contextLength,
          capabilities: model.capabilities
        }))
      };
    } catch (error) {
      logger.error('Failed to get customization options:', error);
      throw error;
    }
  }

  /**
   * Get template categories
   */
  async getTemplateCategories(): Promise<string[]> {
    // For now, return static categories - could be dynamic based on templates
    return [
      'LLM Providers',
      'Chat Models',
      'Code Generation',
      'Text Analysis',
      'Image Generation',
      'Audio Processing',
      'Custom Providers'
    ];
  }

  /**
   * Clone template
   */
  async cloneTemplate(
    templateId: string, 
    options: { name: string; description?: string }, 
    createdBy?: string
  ): Promise<ProviderTemplate> {
    logger.info('Cloning template', { templateId, newName: options.name });

    try {
      const sourceTemplate = await this.templateStorage.getTemplate(templateId);

      const cloneRequest: CreateTemplateRequest = {
        name: options.name,
        description: options.description || `Clone of ${sourceTemplate.name}`,
        providerConfig: { ...sourceTemplate.providerConfig },
        defaultModels: sourceTemplate.defaultModels.map(model => ({ ...model }))
      };

      const clonedTemplate = await this.templateStorage.createTemplate(cloneRequest, createdBy);

      logger.info('Template cloned successfully', {
        sourceTemplateId: templateId,
        clonedTemplateId: clonedTemplate.id,
        newName: options.name
      });

      return clonedTemplate;
    } catch (error) {
      logger.error('Failed to clone template:', error);
      throw error;
    }
  }

  /**
   * Export template
   */
  async exportTemplate(templateId: string, format: 'json' | 'yaml' = 'json'): Promise<string | object> {
    try {
      const template = await this.templateStorage.getTemplate(templateId);

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        template: {
          name: template.name,
          description: template.description,
          providerConfig: template.providerConfig,
          defaultModels: template.defaultModels
        }
      };

      if (format === 'yaml') {
        const yaml = await import('yaml');
        return yaml.stringify(exportData);
      }

      return exportData;
    } catch (error) {
      logger.error('Failed to export template:', error);
      throw error;
    }
  }

  /**
   * Import template
   */
  async importTemplate(
    templateData: any, 
    options: { overwrite?: boolean; createdBy?: string } = {}
  ): Promise<ProviderTemplate> {
    logger.info('Importing template', { options });

    try {
      let data = templateData;
      
      // Parse if string
      if (typeof templateData === 'string') {
        try {
          data = JSON.parse(templateData);
        } catch {
          const yaml = await import('yaml');
          data = yaml.parse(templateData);
        }
      }

      const template = data.template || data;
      
      // Check if template with same name exists
      if (!options.overwrite) {
        try {
          const existing = await this.templateStorage.getTemplateByName(template.name);
          if (existing) {
            throw new ConflictError(`Template with name '${template.name}' already exists`);
          }
        } catch (error) {
          if (!(error instanceof NotFoundError)) {
            throw error;
          }
        }
      }

      const createRequest: CreateTemplateRequest = {
        name: template.name,
        description: template.description,
        providerConfig: template.providerConfig,
        defaultModels: template.defaultModels
      };

      const importedTemplate = await this.templateStorage.createTemplate(createRequest, options.createdBy);

      logger.info('Template imported successfully', {
        templateId: importedTemplate.id,
        name: importedTemplate.name
      });

      return importedTemplate;
    } catch (error) {
      logger.error('Failed to import template:', error);
      throw error;
    }
  }

  /**
   * Export templates
   */
  async exportTemplates(options: any): Promise<string | object> {
    logger.info('Exporting templates', { options });

    try {
      const queryOptions: any = {};
      if (options.templateIds) {
        queryOptions.templateIds = options.templateIds;
      }

      const result = await this.templateStorage.getTemplates(queryOptions);

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        templates: result.templates.map(template => ({
          name: template.name,
          description: template.description,
          providerConfig: template.providerConfig,
          defaultModels: template.defaultModels,
          isSystem: template.isSystem
        }))
      };

      if (options.format === 'yaml') {
        const yaml = await import('yaml');
        return yaml.stringify(exportData);
      }

      return exportData;
    } catch (error) {
      logger.error('Failed to export templates:', error);
      throw error;
    }
  }

  /**
   * Import templates
   */
  async importTemplates(
    data: any, 
    options: any = {}
  ): Promise<{
    imported: ProviderTemplate[];
    skipped: any[];
    errors: any[];
  }> {
    logger.info('Importing templates', { options });

    const imported: ProviderTemplate[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    try {
      let templatesData = data;
      
      if (typeof data === 'string') {
        try {
          templatesData = JSON.parse(data);
        } catch {
          const yaml = await import('yaml');
          templatesData = yaml.parse(data);
        }
      }

      const templates = Array.isArray(templatesData) 
        ? templatesData 
        : templatesData.templates || [];

      for (const templateData of templates) {
        try {
          if (!options.dryRun) {
            // Check for existing template
            try {
              const existing = await this.templateStorage.getTemplateByName(templateData.name);
              if (existing) {
                if (options.conflictResolution === 'skip') {
                  skipped.push({ name: templateData.name, reason: 'Already exists' });
                  continue;
                } else if (options.conflictResolution === 'overwrite') {
                  const updated = await this.templateStorage.updateTemplate(existing.id, templateData);
                  imported.push(updated);
                  continue;
                }
              }
            } catch (error) {
              if (!(error instanceof NotFoundError)) {
                throw error;
              }
            }

            const template = await this.templateStorage.createTemplate(templateData, options.createdBy);
            imported.push(template);
          } else {
            imported.push(templateData);
          }
        } catch (error) {
          errors.push({
            name: templateData.name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return { imported, skipped, errors };
    } catch (error) {
      logger.error('Failed to import templates:', error);
      throw error;
    }
  }
}

// Singleton instance
let templateManagementService: TemplateManagementService | null = null;

/**
 * Get the template management service instance
 */
export function getTemplateManagementService(): TemplateManagementService {
  if (!templateManagementService) {
    templateManagementService = new TemplateManagementService();
  }
  return templateManagementService;
}