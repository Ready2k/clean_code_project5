// Export Service - Generate provider-specific files from prompts

import { PromptRecord } from '../models/prompt';
import { ProviderRegistry } from '../adapters/provider-registry';
import { RenderOptions, ProviderPayload } from '../types/common';
import { ValidationResult } from '../types/validation';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ExportOptions {
  /**
   * Target provider for export
   */
  provider: string;

  /**
   * Model to use for rendering
   */
  model: string;

  /**
   * Variable values for substitution
   */
  variables?: Record<string, any>;

  /**
   * Additional render options
   */
  renderOptions?: Partial<RenderOptions>;

  /**
   * Output directory for exported files
   */
  outputDir?: string;

  /**
   * Whether to include metadata in export
   */
  includeMetadata?: boolean;

  /**
   * Custom filename (without extension)
   */
  customFilename?: string;
}

export interface ExportResult {
  /**
   * Path to the exported file
   */
  filePath: string;

  /**
   * Generated filename
   */
  filename: string;

  /**
   * Provider payload that was exported
   */
  payload: ProviderPayload;

  /**
   * Export metadata
   */
  metadata: {
    promptId: string;
    promptSlug: string;
    promptVersion: number;
    provider: string;
    model: string;
    exportedAt: string;
    variablesUsed: string[];
  };
}

export interface ExportValidationResult extends ValidationResult {
  /**
   * Missing required variables
   */
  missingVariables?: string[];

  /**
   * Provider-specific validation issues
   */
  providerIssues?: string[];
}

export class ExportService {
  constructor(
    private providerRegistry: ProviderRegistry,
    private defaultOutputDir: string = './exports'
  ) {}

  /**
   * Export a prompt to provider-specific format
   */
  async exportPrompt(
    prompt: PromptRecord,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Validate export options
    const validation = this.validateExportOptions(prompt, options);
    if (!validation.isValid) {
      throw new Error(`Export validation failed: ${validation.errors.join(', ')}`);
    }

    // Get provider adapter
    const adapter = this.providerRegistry.getAdapter(options.provider);
    if (!adapter) {
      throw new Error(`Provider '${options.provider}' not found`);
    }

    // Ensure we have a structured prompt
    if (!prompt.prompt_structured) {
      throw new Error('Prompt must have structured format for export. Please enhance the prompt first.');
    }

    // Prepare render options
    const renderOptions: RenderOptions = {
      model: options.model,
      variables: options.variables || {},
      ...options.renderOptions
    };

    // Render the prompt using the provider adapter
    const payload = adapter.render(prompt.prompt_structured, renderOptions);

    // Validate the rendered payload
    const payloadValidation = adapter.validate(payload);
    if (!payloadValidation.isValid) {
      throw new Error(`Provider validation failed: ${payloadValidation.errors.join(', ')}`);
    }

    // Generate filename
    const filename = this.generateFilename(prompt, options);
    
    // Determine output directory
    const outputDir = options.outputDir || this.defaultOutputDir;
    await this.ensureDirectoryExists(outputDir);
    
    const filePath = path.join(outputDir, filename);

    // Prepare export content
    const exportContent = this.prepareExportContent(payload, prompt, options);

    // Write file
    await fs.writeFile(filePath, JSON.stringify(exportContent, null, 2), 'utf-8');

    // Prepare result metadata
    const metadata = {
      promptId: prompt.id,
      promptSlug: prompt.slug,
      promptVersion: prompt.version,
      provider: options.provider,
      model: options.model,
      exportedAt: new Date().toISOString(),
      variablesUsed: Object.keys(options.variables || {})
    };

    return {
      filePath,
      filename,
      payload,
      metadata
    };
  }

  /**
   * Export multiple prompts in batch
   */
  async exportBatch(
    prompts: PromptRecord[],
    options: ExportOptions
  ): Promise<ExportResult[]> {
    const results: ExportResult[] = [];
    
    for (const prompt of prompts) {
      try {
        const result = await this.exportPrompt(prompt, options);
        results.push(result);
      } catch (error) {
        // Log error but continue with other prompts
        console.error(`Failed to export prompt ${prompt.slug}:`, error);
      }
    }

    return results;
  }

  /**
   * Validate export options and prompt compatibility
   */
  validateExportOptions(
    prompt: PromptRecord,
    options: ExportOptions
  ): ExportValidationResult {
    const errors: string[] = [];
    const missingVariables: string[] = [];
    const providerIssues: string[] = [];

    // Check if provider exists
    if (!this.providerRegistry.hasProvider(options.provider)) {
      errors.push(`Provider '${options.provider}' is not registered`);
      return { isValid: false, errors, missingVariables, providerIssues };
    }

    const adapter = this.providerRegistry.getAdapter(options.provider);

    // Check if model is supported
    if (!adapter.supports(options.model)) {
      providerIssues.push(`Model '${options.model}' is not supported by provider '${options.provider}'`);
    }

    // Check if prompt has structured format
    if (!prompt.prompt_structured) {
      errors.push('Prompt must have structured format for export. Please enhance the prompt first.');
      return { isValid: false, errors, missingVariables, providerIssues };
    }

    // Check required variables
    const requiredVariables = prompt.variables
      .filter(v => v.required)
      .map(v => v.key);

    const providedVariables = Object.keys(options.variables || {});
    
    for (const requiredVar of requiredVariables) {
      if (!providedVariables.includes(requiredVar)) {
        missingVariables.push(requiredVar);
      }
    }

    // Check template variables
    const templateVariables = this.extractTemplateVariables(prompt.prompt_structured.user_template);
    for (const templateVar of templateVariables) {
      const variable = prompt.variables.find(v => v.key === templateVar);
      if (variable?.required && !providedVariables.includes(templateVar)) {
        if (!missingVariables.includes(templateVar)) {
          missingVariables.push(templateVar);
        }
      }
    }

    if (missingVariables.length > 0) {
      errors.push(`Missing required variables: ${missingVariables.join(', ')}`);
    }

    // Validate render options against provider capabilities
    const modelInfo = adapter.getModelInfo(options.model);
    if (modelInfo && options.renderOptions) {
      if (options.renderOptions.maxTokens && options.renderOptions.maxTokens > modelInfo.maxTokens) {
        providerIssues.push(`Requested maxTokens (${options.renderOptions.maxTokens}) exceeds model limit (${modelInfo.maxTokens})`);
      }

      if (options.renderOptions.temperature !== undefined) {
        if (options.renderOptions.temperature < 0 || options.renderOptions.temperature > 2) {
          providerIssues.push('Temperature must be between 0 and 2');
        }
      }

      if (options.renderOptions.topP !== undefined) {
        if (options.renderOptions.topP < 0 || options.renderOptions.topP > 1) {
          providerIssues.push('topP must be between 0 and 1');
        }
      }
    }

    return {
      isValid: errors.length === 0 && providerIssues.length === 0,
      errors: [...errors, ...providerIssues],
      missingVariables,
      providerIssues
    };
  }

  /**
   * Generate filename following convention: slug_provider_version.json
   */
  private generateFilename(prompt: PromptRecord, options: ExportOptions): string {
    if (options.customFilename) {
      return `${options.customFilename}.json`;
    }

    const sanitizedSlug = this.sanitizeFilename(prompt.slug);
    const sanitizedProvider = this.sanitizeFilename(options.provider);
    
    return `${sanitizedSlug}_${sanitizedProvider}_v${prompt.version}.json`;
  }

  /**
   * Sanitize filename to remove invalid characters
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\-_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Prepare export content with optional metadata
   */
  private prepareExportContent(
    payload: ProviderPayload,
    prompt: PromptRecord,
    options: ExportOptions
  ): any {
    const content = {
      ...payload.content
    };

    if (options.includeMetadata !== false) {
      return {
        ...content,
        _metadata: {
          promptId: prompt.id,
          promptSlug: prompt.slug,
          promptTitle: prompt.metadata.title,
          promptVersion: prompt.version,
          provider: options.provider,
          model: options.model,
          exportedAt: new Date().toISOString(),
          variablesUsed: Object.keys(options.variables || {}),
          originalPrompt: {
            goal: prompt.prompt_human.goal,
            audience: prompt.prompt_human.audience
          }
        }
      };
    }

    return content;
  }

  /**
   * Extract variable references from template
   */
  private extractTemplateVariables(template: string): string[] {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      const variableName = match[1].trim();
      if (!variables.includes(variableName)) {
        variables.push(variableName);
      }
    }

    return variables;
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Get supported providers for a prompt
   */
  getSupportedProviders(prompt: PromptRecord): string[] {
    if (!prompt.prompt_structured) {
      return [];
    }

    const allProviders = this.providerRegistry.listProviders();
    const supportedProviders: string[] = [];

    for (const provider of allProviders) {
      const adapter = this.providerRegistry.getAdapter(provider.id);
      
      // Check if provider supports the prompt structure
      try {
        // Try to validate with default options
        const defaultOptions = adapter.getDefaultOptions();
        const testPayload = adapter.render(prompt.prompt_structured, defaultOptions);
        const validation = adapter.validate(testPayload);
        
        if (validation.isValid) {
          supportedProviders.push(provider.id);
        }
      } catch {
        // Provider doesn't support this prompt structure
      }
    }

    return supportedProviders;
  }

  /**
   * Get export preview without writing file
   */
  async getExportPreview(
    prompt: PromptRecord,
    options: ExportOptions
  ): Promise<{
    filename: string;
    content: any;
    validation: ExportValidationResult;
  }> {
    const validation = this.validateExportOptions(prompt, options);
    
    if (!validation.isValid) {
      return {
        filename: this.generateFilename(prompt, options),
        content: null,
        validation
      };
    }

    const adapter = this.providerRegistry.getAdapter(options.provider);
    const renderOptions: RenderOptions = {
      model: options.model,
      variables: options.variables || {},
      ...options.renderOptions
    };

    const payload = adapter.render(prompt.prompt_structured!, renderOptions);
    const content = this.prepareExportContent(payload, prompt, options);

    return {
      filename: this.generateFilename(prompt, options),
      content,
      validation
    };
  }
}