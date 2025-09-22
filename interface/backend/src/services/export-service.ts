import { logger } from '../utils/logger.js';
import { getPromptLibraryService, PromptRecord } from './prompt-library-service.js';
import { ValidationError, NotFoundError, ServiceUnavailableError } from '../types/errors.js';
import * as yaml from 'js-yaml';
import { promises as fs } from 'fs';
import path from 'path';
import archiver from 'archiver';
import { Readable } from 'stream';

export interface ExportOptions {
  format: 'json' | 'yaml' | 'openai' | 'anthropic' | 'meta';
  includeMetadata?: boolean;
  includeHistory?: boolean;
  includeRatings?: boolean;
  substituteVariables?: boolean;
  variableValues?: Record<string, any>;
  template?: 'minimal' | 'full' | 'provider-ready';
}

export interface BulkExportOptions extends ExportOptions {
  promptIds: string[];
  archiveFormat?: 'zip' | 'tar';
  filename?: string;
}

export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface BulkExportResult {
  stream: Readable;
  filename: string;
  mimeType: string;
  totalPrompts: number;
}

export interface ProviderSpecificFormat {
  openai: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    temperature?: number;
    max_tokens?: number;
  };
  anthropic: {
    prompt: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
  };
  meta: {
    prompt: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
  };
}

/**
 * Service for exporting prompts in various formats
 */
export class ExportService {
  private isInitialized = false;
  private tempDir: string;

  constructor(config?: { tempDir?: string }) {
    this.tempDir = config?.tempDir || path.resolve(process.cwd(), 'temp/exports');
  }

  /**
   * Initialize the export service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Export Service...');
      
      // Create temp directory for export files
      await fs.mkdir(this.tempDir, { recursive: true });
      
      this.isInitialized = true;
      logger.info('Export Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Export Service:', error);
      throw new ServiceUnavailableError('Export service initialization failed');
    }
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new ServiceUnavailableError('Export service not initialized');
    }
  }

  /**
   * Export a single prompt
   */
  async exportPrompt(promptId: string, options: ExportOptions): Promise<ExportResult> {
    this.ensureInitialized();

    try {
      logger.info('Exporting prompt', { promptId, format: options.format });

      const promptLibraryService = getPromptLibraryService();
      const prompt = await promptLibraryService.getPrompt(promptId);

      let content: string;
      let filename: string;
      let mimeType: string;

      switch (options.format) {
        case 'json':
          content = await this.exportAsJSON(prompt, options);
          filename = `${this.sanitizeFilename(prompt.metadata.title)}.json`;
          mimeType = 'application/json';
          break;
        case 'yaml':
          content = await this.exportAsYAML(prompt, options);
          filename = `${this.sanitizeFilename(prompt.metadata.title)}.yaml`;
          mimeType = 'application/x-yaml';
          break;
        case 'openai':
          content = await this.exportAsProviderFormat(prompt, 'openai', options);
          filename = `${this.sanitizeFilename(prompt.metadata.title)}_openai.json`;
          mimeType = 'application/json';
          break;
        case 'anthropic':
          content = await this.exportAsProviderFormat(prompt, 'anthropic', options);
          filename = `${this.sanitizeFilename(prompt.metadata.title)}_anthropic.json`;
          mimeType = 'application/json';
          break;
        case 'meta':
          content = await this.exportAsProviderFormat(prompt, 'meta', options);
          filename = `${this.sanitizeFilename(prompt.metadata.title)}_meta.json`;
          mimeType = 'application/json';
          break;
        default:
          throw new ValidationError(`Unsupported export format: ${options.format}`);
      }

      const result: ExportResult = {
        content,
        filename,
        mimeType,
        size: Buffer.byteLength(content, 'utf8')
      };

      logger.info('Prompt exported successfully', { 
        promptId, 
        format: options.format, 
        size: result.size 
      });

      return result;
    } catch (error) {
      logger.error('Failed to export prompt:', error);
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new ServiceUnavailableError('Failed to export prompt');
    }
  }

  /**
   * Export multiple prompts as an archive
   */
  async bulkExport(options: BulkExportOptions): Promise<BulkExportResult> {
    this.ensureInitialized();

    try {
      logger.info('Starting bulk export', { 
        promptCount: options.promptIds.length, 
        format: options.format 
      });

      const promptLibraryService = getPromptLibraryService();
      const prompts: PromptRecord[] = [];

      // Fetch all prompts
      for (const promptId of options.promptIds) {
        try {
          const prompt = await promptLibraryService.getPrompt(promptId);
          prompts.push(prompt);
        } catch (error) {
          logger.warn('Failed to fetch prompt for bulk export', { promptId, error });
          // Continue with other prompts
        }
      }

      if (prompts.length === 0) {
        throw new ValidationError('No valid prompts found for export');
      }

      // Create archive
      const archiveFormat = options.archiveFormat || 'zip';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = options.filename || `prompts_export_${timestamp}.${archiveFormat}`;

      const archive = archiver(archiveFormat, {
        zlib: { level: 9 } // Maximum compression
      });

      // Add prompts to archive
      for (const prompt of prompts) {
        try {
          const exportResult = await this.exportPrompt(prompt.id, {
            ...options,
            // Don't include archive-specific options in individual exports
            promptIds: undefined,
            archiveFormat: undefined,
            filename: undefined
          } as ExportOptions);

          archive.append(exportResult.content, { name: exportResult.filename });
        } catch (error) {
          logger.warn('Failed to export prompt in bulk operation', { 
            promptId: prompt.id, 
            error 
          });
        }
      }

      // Add manifest file
      const manifest = {
        exportDate: new Date().toISOString(),
        format: options.format,
        totalPrompts: prompts.length,
        options: {
          includeMetadata: options.includeMetadata,
          includeHistory: options.includeHistory,
          includeRatings: options.includeRatings,
          substituteVariables: options.substituteVariables,
          template: options.template
        },
        prompts: prompts.map(p => ({
          id: p.id,
          title: p.metadata.title,
          version: p.version,
          exportedAt: new Date().toISOString()
        }))
      };

      archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

      // Finalize archive
      archive.finalize();

      const result: BulkExportResult = {
        stream: archive,
        filename,
        mimeType: archiveFormat === 'zip' ? 'application/zip' : 'application/x-tar',
        totalPrompts: prompts.length
      };

      logger.info('Bulk export completed', { 
        totalPrompts: prompts.length, 
        format: options.format,
        filename 
      });

      return result;
    } catch (error) {
      logger.error('Failed to perform bulk export:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ServiceUnavailableError('Failed to perform bulk export');
    }
  }

  /**
   * Export prompt as JSON
   */
  private async exportAsJSON(prompt: PromptRecord, options: ExportOptions): Promise<string> {
    const exportData: any = {
      id: prompt.id,
      version: prompt.version,
      metadata: prompt.metadata,
      humanPrompt: prompt.humanPrompt,
      variables: prompt.variables
    };

    // Add structured prompt if available
    if (prompt.prompt_structured) {
      exportData.structuredPrompt = prompt.prompt_structured;
    }

    // Include optional data based on options
    if (options.includeHistory && prompt.history.length > 0) {
      exportData.history = prompt.history;
    }

    if (options.includeRatings) {
      try {
        const promptLibraryService = getPromptLibraryService();
        const ratings = await promptLibraryService.getPromptRatings(prompt.id);
        exportData.ratings = ratings;
      } catch (error) {
        logger.warn('Failed to include ratings in export', { promptId: prompt.id, error });
      }
    }

    // Apply variable substitution if requested
    if (options.substituteVariables && options.variableValues) {
      exportData.renderedContent = this.substituteVariables(
        prompt,
        options.variableValues
      );
    }

    // Apply template filtering
    if (options.template === 'minimal') {
      return JSON.stringify({
        title: exportData.metadata.title,
        goal: exportData.humanPrompt.goal,
        content: exportData.structuredPrompt?.user_template || exportData.humanPrompt.goal
      }, null, 2);
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export prompt as YAML
   */
  private async exportAsYAML(prompt: PromptRecord, options: ExportOptions): Promise<string> {
    const jsonContent = await this.exportAsJSON(prompt, options);
    const data = JSON.parse(jsonContent);
    return yaml.dump(data, { 
      indent: 2,
      lineWidth: 120,
      noRefs: true
    });
  }

  /**
   * Export prompt in provider-specific format
   */
  private async exportAsProviderFormat(
    prompt: PromptRecord, 
    provider: 'openai' | 'anthropic' | 'meta', 
    options: ExportOptions
  ): Promise<string> {
    // Use the existing render functionality to get provider-specific format
    const promptLibraryService = getPromptLibraryService();
    
    try {
      const renderResult = await promptLibraryService.renderPrompt(
        prompt.id, 
        provider, 
        {
          variables: options.variableValues || {},
          temperature: 0.7
        }
      );

      const providerData: any = {
        prompt_id: prompt.id,
        prompt_title: prompt.metadata.title,
        provider: provider,
        generated_at: new Date().toISOString()
      };

      switch (provider) {
        case 'openai':
          providerData.request = {
            model: renderResult.model || 'gpt-3.5-turbo',
            messages: renderResult.messages,
            temperature: renderResult.parameters?.['temperature'] || 0.7,
            max_tokens: renderResult.parameters?.['max_tokens'] || 2000
          };
          break;
        case 'anthropic':
          providerData.request = {
            model: renderResult.model || 'claude-3-sonnet-20240229',
            prompt: renderResult.formatted_prompt,
            temperature: renderResult.parameters?.['temperature'] || 0.7,
            max_tokens: renderResult.parameters?.['max_tokens'] || 2000
          };
          break;
        case 'meta':
          providerData.request = {
            model: renderResult.model || 'llama-2-70b-chat',
            prompt: renderResult.formatted_prompt,
            temperature: renderResult.parameters?.['temperature'] || 0.7,
            max_tokens: renderResult.parameters?.['max_tokens'] || 2000
          };
          break;
      }

      // Include metadata if requested
      if (options.includeMetadata) {
        providerData.metadata = prompt.metadata;
        providerData.variables = prompt.variables;
      }

      return JSON.stringify(providerData, null, 2);
    } catch (error) {
      logger.error('Failed to render prompt for provider export', { 
        promptId: prompt.id, 
        provider, 
        error 
      });
      
      // Fallback to basic format
      const fallbackData = {
        prompt_id: prompt.id,
        prompt_title: prompt.metadata.title,
        provider: provider,
        error: 'Failed to render with provider, using fallback format',
        content: prompt.humanPrompt.goal,
        generated_at: new Date().toISOString()
      };

      return JSON.stringify(fallbackData, null, 2);
    }
  }

  /**
   * Substitute variables in prompt content
   */
  private substituteVariables(prompt: PromptRecord, variableValues: Record<string, any>): any {
    const substituted: any = {
      goal: this.replaceVariables(prompt.humanPrompt.goal, variableValues),
      audience: this.replaceVariables(prompt.humanPrompt.audience, variableValues),
      steps: prompt.humanPrompt.steps.map(step => 
        this.replaceVariables(step, variableValues)
      ),
      output_expectations: {
        format: this.replaceVariables(prompt.humanPrompt.output_expectations.format, variableValues),
        fields: prompt.humanPrompt.output_expectations.fields.map(field =>
          this.replaceVariables(field, variableValues)
        )
      }
    };

    if (prompt.prompt_structured) {
      substituted.structured = {
        system: prompt.prompt_structured.system.map(sys =>
          this.replaceVariables(sys, variableValues)
        ),
        user_template: this.replaceVariables(prompt.prompt_structured.user_template, variableValues),
        capabilities: prompt.prompt_structured.capabilities,
        rules: prompt.prompt_structured.rules
      };
    }

    return substituted;
  }

  /**
   * Replace variable placeholders in text
   */
  private replaceVariables(text: string, variables: Record<string, any>): string {
    let result = text;
    
    // Replace {{variable}} patterns
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(pattern, String(value));
    }

    // Replace ${variable} patterns
    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\$\\{\\s*${key}\\s*\\}`, 'g');
      result = result.replace(pattern, String(value));
    }

    return result;
  }

  /**
   * Sanitize filename for safe file system usage
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-z0-9\-_\s]/gi, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .toLowerCase()
      .substring(0, 100); // Limit length
  }

  /**
   * Get supported export formats
   */
  getSupportedFormats(): Array<{ id: string; name: string; description: string }> {
    return [
      {
        id: 'json',
        name: 'JSON',
        description: 'Standard JSON format with full prompt data'
      },
      {
        id: 'yaml',
        name: 'YAML',
        description: 'Human-readable YAML format'
      },
      {
        id: 'openai',
        name: 'OpenAI',
        description: 'OpenAI API compatible format'
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Anthropic Claude API compatible format'
      },
      {
        id: 'meta',
        name: 'Meta (Llama)',
        description: 'Meta Llama API compatible format'
      }
    ];
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    initialized: boolean;
    healthy: boolean;
    tempDir: string;
    supportedFormats: number;
  }> {
    try {
      const formats = this.getSupportedFormats();
      
      return {
        initialized: this.isInitialized,
        healthy: this.isInitialized,
        tempDir: this.tempDir,
        supportedFormats: formats.length
      };
    } catch (error) {
      logger.error('Failed to get export service status:', error);
      return {
        initialized: this.isInitialized,
        healthy: false,
        tempDir: this.tempDir,
        supportedFormats: 0
      };
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up export service temporary files...');
      
      // Remove old temporary files (older than 1 hour)
      const files = await fs.readdir(this.tempDir);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime.getTime() < oneHourAgo) {
          await fs.unlink(filePath);
          logger.debug('Removed old temporary file', { file });
        }
      }
      
      logger.info('Export service cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup export service:', error);
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Shutting down Export Service...');
      await this.cleanup();
      this.isInitialized = false;
      logger.info('Export Service shut down successfully');
    }
  }
}

// Singleton instance for the API
let exportService: ExportService | null = null;

/**
 * Get the singleton instance of the export service
 */
export function getExportService(): ExportService {
  if (!exportService) {
    exportService = new ExportService();
  }
  return exportService;
}

/**
 * Initialize the export service
 */
export async function initializeExportService(config?: { tempDir?: string }): Promise<void> {
  if (exportService) {
    await exportService.shutdown();
  }
  
  exportService = new ExportService(config);
  await exportService.initialize();
}