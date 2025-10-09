import { Request, Response } from 'express';
import Joi from 'joi';
import { getExportService, ExportOptions, BulkExportOptions } from '../services/export-service.js';
import { getPromptLibraryService } from '../services/prompt-library-service.js';
import { getAPIDocumentationService } from '../services/api-documentation-service.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { ValidationError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

// Extend AuthenticatedRequest to include params and query
interface ExtendedAuthenticatedRequest extends AuthenticatedRequest {
  params: any;
  query: any;
  body: any;
}

// Validation schemas
const exportPromptSchema = Joi.object({
  format: Joi.string().valid('json', 'yaml', 'openai', 'anthropic', 'meta').required(),
  includeMetadata: Joi.boolean().default(true),
  includeHistory: Joi.boolean().default(false),
  includeRatings: Joi.boolean().default(false),
  substituteVariables: Joi.boolean().default(false),
  variableValues: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
  template: Joi.string().valid('minimal', 'full', 'provider-ready').default('full')
});

const bulkExportSchema = Joi.object({
  promptIds: Joi.array().items(Joi.string()).min(1).required(),
  format: Joi.string().valid('json', 'yaml', 'openai', 'anthropic', 'meta').required(),
  includeMetadata: Joi.boolean().default(true),
  includeHistory: Joi.boolean().default(false),
  includeRatings: Joi.boolean().default(false),
  substituteVariables: Joi.boolean().default(false),
  variableValues: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
  template: Joi.string().valid('minimal', 'full', 'provider-ready').default('full'),
  archiveFormat: Joi.string().valid('zip', 'tar').default('zip'),
  filename: Joi.string().max(100)
});

const shareLinkSchema = Joi.object({
  promptId: Joi.string().required(),
  expiresIn: Joi.number().min(1).max(8760), // 1 hour to 1 year
  maxAccess: Joi.number().min(1).max(10000),
  password: Joi.string().min(4).max(100),
  includeMetadata: Joi.boolean().default(true)
});

// In-memory storage for share links (in production, use a database)
interface ShareLink {
  id: string;
  promptId: string;
  url: string;
  expiresAt?: string | undefined;
  accessCount: number;
  maxAccess?: number | undefined;
  password?: string | undefined;
  includeMetadata: boolean;
  createdAt: string;
  createdBy: string;
}

const shareLinks: Map<string, ShareLink> = new Map();

// In-memory storage for export history (in production, use a database)
interface ExportHistoryItem {
  id: string;
  promptId?: string;
  promptIds?: string[];
  format: string;
  template: string;
  filename: string;
  size: number;
  type: 'single' | 'bulk';
  status: 'completed' | 'failed' | 'expired';
  createdAt: string;
  createdBy: string;
  downloadCount: number;
  expiresAt?: string;
  filePath?: string;
}

const exportHistory: Map<string, ExportHistoryItem> = new Map();

/**
 * Get supported export formats
 */
export const getExportFormats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const exportService = getExportService();
    const formats = exportService.getSupportedFormats();

    res.json({
      formats,
      total: formats.length,
      templates: ['minimal', 'full', 'provider-ready'],
      archiveFormats: ['zip', 'tar']
    });
  } catch (error) {
    logger.error('Failed to get export formats:', error);
    throw error;
  }
};

/**
 * Get export documentation and API reference
 */
export const getExportDocumentation = async (_req: Request, res: Response): Promise<void> => {
  try {
    const documentation = {
      overview: 'Export API allows you to export prompts in various formats for integration with different AI providers and workflows.',
      endpoints: {
        'POST /api/export/prompt/:id': {
          description: 'Export a single prompt',
          parameters: {
            format: 'Export format (json, yaml, openai, anthropic, meta)',
            includeMetadata: 'Include prompt metadata (default: true)',
            includeHistory: 'Include version history (default: false)',
            includeRatings: 'Include user ratings (default: false)',
            substituteVariables: 'Replace variable placeholders with values (default: false)',
            variableValues: 'Variable values for substitution (object)',
            template: 'Export template (minimal, full, provider-ready)'
          }
        },
        'POST /api/export/bulk': {
          description: 'Export multiple prompts as an archive',
          parameters: {
            promptIds: 'Array of prompt IDs to export',
            archiveFormat: 'Archive format (zip, tar)',
            filename: 'Custom filename for the archive'
          }
        }
      },
      formats: {
        json: 'Standard JSON format with full prompt data',
        yaml: 'Human-readable YAML format',
        openai: 'OpenAI API compatible format with messages array',
        anthropic: 'Anthropic Claude API compatible format',
        meta: 'Meta Llama API compatible format'
      },
      templates: {
        minimal: 'Only essential prompt content',
        full: 'Complete prompt data including metadata',
        'provider-ready': 'Optimized for specific AI provider integration'
      },
      examples: {
        'Single Export': {
          method: 'POST',
          url: '/api/export/prompt/prompt-123',
          body: {
            format: 'openai',
            includeMetadata: true,
            substituteVariables: true,
            variableValues: {
              input_data: 'Sample data',
              context: 'Sample context'
            }
          }
        },
        'Bulk Export': {
          method: 'POST',
          url: '/api/export/bulk',
          body: {
            promptIds: ['prompt-123', 'prompt-456'],
            format: 'json',
            archiveFormat: 'zip',
            filename: 'my_prompts_export.zip'
          }
        }
      }
    };

    res.json(documentation);
  } catch (error) {
    logger.error('Failed to get export documentation:', error);
    throw error;
  }
};

/**
 * Export a single prompt in the specified format
 */
export const exportPrompt = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { error, value } = exportPromptSchema.validate(req.body);
    
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    if (!id) {
      throw new ValidationError('Prompt ID is required');
    }

    const exportOptions: ExportOptions = value;
    const exportService = getExportService();
    const result = await exportService.exportPrompt(id, exportOptions);

    // Set appropriate headers for file download
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.size);
    res.setHeader('X-Export-Format', exportOptions.format);
    res.setHeader('X-Export-Size', result.size);
    res.setHeader('X-Export-Template', exportOptions.template || 'full');

    res.send(result.content);
  } catch (error) {
    logger.error('Failed to export prompt:', error);
    throw error;
  }
};

/**
 * Preview export content without downloading
 */
export const previewExport = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { error, value } = exportPromptSchema.validate(req.body);
    
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    if (!id) {
      throw new ValidationError('Prompt ID is required');
    }

    const exportOptions: ExportOptions = value;
    const exportService = getExportService();
    const result = await exportService.exportPrompt(id, exportOptions);

    // Return preview data instead of file download
    res.json({
      promptId: id,
      format: exportOptions.format,
      template: exportOptions.template,
      filename: result.filename,
      size: result.size,
      preview: result.content.substring(0, 2000), // First 2000 characters
      truncated: result.content.length > 2000,
      mimeType: result.mimeType,
      options: exportOptions,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to preview export:', error);
    throw error;
  }
};

/**
 * Bulk export multiple prompts as an archive
 */
export const bulkExportPrompts = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { error, value } = bulkExportSchema.validate(req.body);
    
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    const bulkOptions: BulkExportOptions = value;
    const exportService = getExportService();
    const result = await exportService.bulkExport(bulkOptions);

    // Set appropriate headers for archive download
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('X-Export-Format', bulkOptions.format);
    res.setHeader('X-Export-Count', result.totalPrompts);
    res.setHeader('X-Archive-Format', bulkOptions.archiveFormat || 'zip');
    res.setHeader('X-Export-Template', bulkOptions.template || 'full');

    // Stream the archive to the response
    result.stream.pipe(res);
  } catch (error) {
    logger.error('Failed to bulk export prompts:', error);
    throw error;
  }
};

/**
 * Preview bulk export without creating the actual archive
 */
export const previewBulkExport = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { error, value } = bulkExportSchema.validate(req.body);
    
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    const bulkOptions: BulkExportOptions = value;
    const promptLibraryService = getPromptLibraryService();
    
    // Validate prompts exist and get their metadata
    const promptsInfo: any[] = [];
    let totalSize = 0;

    for (const promptId of bulkOptions.promptIds) {
      try {
        const prompt = await promptLibraryService.getPrompt(promptId);
        const estimatedSize = JSON.stringify(prompt).length; // Rough size estimate
        
        promptsInfo.push({
          id: prompt.id,
          title: prompt.metadata.title,
          version: prompt.version,
          estimatedSize,
          tags: prompt.metadata.tags,
          owner: prompt.metadata.owner
        });
        
        totalSize += estimatedSize;
      } catch (error) {
        logger.warn('Prompt not found for bulk export preview', { promptId, error });
        promptsInfo.push({
          id: promptId,
          title: 'Not Found',
          error: 'Prompt not found or inaccessible'
        });
      }
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = bulkOptions.filename || `prompts_export_${timestamp}.${bulkOptions.archiveFormat || 'zip'}`;

    res.json({
      format: bulkOptions.format,
      template: bulkOptions.template,
      archiveFormat: bulkOptions.archiveFormat || 'zip',
      filename,
      totalPrompts: bulkOptions.promptIds.length,
      validPrompts: promptsInfo.filter(p => !p.error).length,
      invalidPrompts: promptsInfo.filter(p => p.error).length,
      estimatedSize: totalSize,
      prompts: promptsInfo,
      options: bulkOptions,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to preview bulk export:', error);
    throw error;
  }
};

/**
 * Get available export templates
 */
export const getExportTemplates = async (_req: Request, res: Response): Promise<void> => {
  try {
    const templates = [
      {
        id: 'minimal',
        name: 'Minimal',
        description: 'Only essential prompt content (title, goal, content)',
        useCase: 'Quick integration, reduced file size',
        includes: ['title', 'goal', 'content']
      },
      {
        id: 'full',
        name: 'Full',
        description: 'Complete prompt data including metadata and variables',
        useCase: 'Complete backup, detailed analysis',
        includes: ['metadata', 'humanPrompt', 'structuredPrompt', 'variables']
      },
      {
        id: 'provider-ready',
        name: 'Provider Ready',
        description: 'Optimized for specific AI provider integration',
        useCase: 'Direct API integration, production deployment',
        includes: ['provider-specific format', 'API parameters', 'optimized structure']
      }
    ];

    res.json({
      templates,
      total: templates.length,
      default: 'full'
    });
  } catch (error) {
    logger.error('Failed to get export templates:', error);
    throw error;
  }
};

/**
 * Get format-specific example
 */
export const getFormatExample = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { format } = req.params;
    
    if (!format) {
      throw new ValidationError('Format parameter is required');
    }

    const validFormats = ['json', 'yaml', 'openai', 'anthropic', 'meta'];
    if (!validFormats.includes(format)) {
      throw new ValidationError(`Invalid format. Valid formats: ${validFormats.join(', ')}`);
    }

    // Create example prompt data
    const examplePrompt = {
      id: 'example-prompt-123',
      version: 1,
      metadata: {
        title: 'Code Review Assistant',
        summary: 'A prompt to help review code and provide constructive feedback',
        tags: ['code-review', 'development', 'feedback'],
        owner: 'example-user',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      humanPrompt: {
        goal: 'Review the provided code and give constructive feedback',
        audience: 'Software developers',
        steps: [
          'Analyze the code structure and logic',
          'Identify potential issues or improvements',
          'Provide specific, actionable feedback'
        ],
        output_expectations: {
          format: 'Structured feedback with sections',
          fields: ['strengths', 'issues', 'suggestions']
        }
      },
      variables: [
        {
          key: 'code',
          label: 'Code to Review',
          type: 'string',
          required: true,
          sensitive: false
        }
      ]
    };

    let example: any;

    switch (format) {
      case 'json':
        example = examplePrompt;
        break;
      case 'yaml':
        example = `# Code Review Assistant Prompt
id: example-prompt-123
version: 1
metadata:
  title: Code Review Assistant
  summary: A prompt to help review code and provide constructive feedback
  tags:
    - code-review
    - development
    - feedback
  owner: example-user
humanPrompt:
  goal: Review the provided code and give constructive feedback
  audience: Software developers
  steps:
    - Analyze the code structure and logic
    - Identify potential issues or improvements
    - Provide specific, actionable feedback`;
        break;
      case 'openai':
        example = {
          prompt_id: 'example-prompt-123',
          prompt_title: 'Code Review Assistant',
          provider: 'openai',
          request: {
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: 'You are a helpful assistant. Review the provided code and give constructive feedback'
              },
              {
                role: 'user',
                content: 'Please review this code: {{code}}'
              }
            ],
            temperature: 0.7,
            max_tokens: 2000
          }
        };
        break;
      case 'anthropic':
        example = {
          prompt_id: 'example-prompt-123',
          prompt_title: 'Code Review Assistant',
          provider: 'anthropic',
          request: {
            model: 'claude-3-sonnet-20240229',
            prompt: 'Human: Review the provided code and give constructive feedback\n\nCode to review: {{code}}\n\nAssistant: I\'ll help you review this code.',
            temperature: 0.7,
            max_tokens: 2000
          }
        };
        break;
      case 'meta':
        example = {
          prompt_id: 'example-prompt-123',
          prompt_title: 'Code Review Assistant',
          provider: 'meta',
          request: {
            model: 'llama-2-70b-chat',
            prompt: '[INST] Review the provided code and give constructive feedback\n\nCode: {{code}} [/INST]',
            temperature: 0.7,
            max_tokens: 2000
          }
        };
        break;
    }

    res.json({
      format,
      description: `Example ${format.toUpperCase()} export format`,
      example,
      notes: format === 'yaml' ? 'YAML format is human-readable and great for documentation' :
             format === 'json' ? 'JSON format preserves all data types and structure' :
             'Provider-specific format optimized for API integration'
    });
  } catch (error) {
    logger.error('Failed to get format example:', error);
    throw error;
  }
};

/**
 * Generate complete API documentation
 */
export const getAPIDocumentation = async (_req: Request, res: Response): Promise<void> => {
  try {
    const apiDocService = getAPIDocumentationService();
    const documentation = await apiDocService.generateDocumentation();

    res.json(documentation);
  } catch (error) {
    logger.error('Failed to get API documentation:', error);
    throw error;
  }
};

/**
 * Generate OpenAPI specification
 */
export const getOpenAPISpec = async (_req: Request, res: Response): Promise<void> => {
  try {
    const apiDocService = getAPIDocumentationService();
    const openApiSpec = await apiDocService.generateOpenAPISpec();

    res.json(openApiSpec);
  } catch (error) {
    logger.error('Failed to get OpenAPI specification:', error);
    throw error;
  }
};

/**
 * Create a share link for a prompt
 */
export const createShareLink = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { error, value } = shareLinkSchema.validate(req.body);
    
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    const { promptId, expiresIn, maxAccess, password, includeMetadata } = value;
    
    // Verify prompt exists
    const promptLibraryService = getPromptLibraryService();
    await promptLibraryService.getPrompt(promptId);

    // Generate unique link ID
    const linkId = crypto.randomUUID();
    const baseUrl = process.env['BASE_URL'] || 'http://localhost:3000';
    const url = `${baseUrl}/shared/${linkId}`;

    // Calculate expiration
    let expiresAt: string | undefined;
    if (expiresIn) {
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + expiresIn);
      expiresAt = expiry.toISOString();
    }

    const shareLink: ShareLink = {
      id: linkId,
      promptId,
      url,
      expiresAt,
      accessCount: 0,
      maxAccess,
      password,
      includeMetadata,
      createdAt: new Date().toISOString(),
      createdBy: req.user?.username || 'unknown'
    };

    shareLinks.set(linkId, shareLink);

    res.status(201).json(shareLink);
  } catch (error) {
    logger.error('Failed to create share link:', error);
    throw error;
  }
};

/**
 * Get share links for a prompt or all share links for the user
 */
export const getShareLinks = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { promptId } = req.query;
    const username = req.user?.username;

    let links = Array.from(shareLinks.values()).filter(link => link.createdBy === username);

    if (promptId) {
      links = links.filter(link => link.promptId === promptId);
    }

    // Remove expired links
    const now = new Date();
    links = links.filter(link => {
      if (link.expiresAt && new Date(link.expiresAt) < now) {
        shareLinks.delete(link.id);
        return false;
      }
      return true;
    });

    res.json(links);
  } catch (error) {
    logger.error('Failed to get share links:', error);
    throw error;
  }
};

/**
 * Delete a share link
 */
export const deleteShareLink = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;
    const username = req.user?.username;

    if (!linkId) {
      throw new ValidationError('Link ID is required');
    }

    const link = shareLinks.get(linkId);
    if (!link) {
      throw new ValidationError('Share link not found');
    }

    if (link.createdBy !== username && req.user?.role !== 'admin') {
      throw new ValidationError('Not authorized to delete this share link');
    }

    shareLinks.delete(linkId);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete share link:', error);
    throw error;
  }
};

/**
 * Access a shared prompt
 */
export const getSharedPrompt = async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;
    const { password } = req.body;

    if (!linkId) {
      throw new ValidationError('Link ID is required');
    }

    const link = shareLinks.get(linkId);
    if (!link) {
      throw new ValidationError('Share link not found or expired');
    }

    // Check expiration
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      shareLinks.delete(linkId);
      throw new ValidationError('Share link has expired');
    }

    // Check access limit
    if (link.maxAccess && link.accessCount >= link.maxAccess) {
      throw new ValidationError('Share link access limit exceeded');
    }

    // Check password
    if (link.password && link.password !== password) {
      throw new ValidationError('Invalid password');
    }

    // Increment access count
    link.accessCount++;
    shareLinks.set(linkId, link);

    // Get prompt data
    const promptLibraryService = getPromptLibraryService();
    const prompt = await promptLibraryService.getPrompt(link.promptId);

    // Filter data based on share settings
    const sharedData: any = {
      id: prompt.id,
      humanPrompt: prompt.humanPrompt,
      variables: prompt.variables
    };

    if (link.includeMetadata) {
      sharedData.metadata = prompt.metadata;
    }

    if (prompt.prompt_structured) {
      sharedData.structuredPrompt = prompt.prompt_structured;
    }

    res.json({
      prompt: sharedData,
      shareInfo: {
        accessCount: link.accessCount,
        maxAccess: link.maxAccess,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt
      }
    });
  } catch (error) {
    logger.error('Failed to get shared prompt:', error);
    throw error;
  }
};

/**
 * Get export history
 */
export const getExportHistory = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { promptId, type, status, limit = 10, offset = 0 } = req.query;
    const username = req.user?.username;

    let history = Array.from(exportHistory.values()).filter(item => item.createdBy === username);

    // Apply filters
    if (promptId) {
      history = history.filter(item => 
        item.promptId === promptId || 
        (item.promptIds && item.promptIds.includes(promptId as string))
      );
    }

    if (type) {
      history = history.filter(item => item.type === type);
    }

    if (status) {
      history = history.filter(item => item.status === status);
    }

    // Sort by creation date (newest first)
    history.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Apply pagination
    const total = history.length;
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);
    const paginatedHistory = history.slice(offsetNum, offsetNum + limitNum);

    res.json({
      exports: paginatedHistory,
      total,
      limit: limitNum,
      offset: offsetNum
    });
  } catch (error) {
    logger.error('Failed to get export history:', error);
    throw error;
  }
};

/**
 * Delete export history item
 */
export const deleteExportHistory = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { exportId } = req.params;
    const username = req.user?.username;

    const item = exportHistory.get(exportId);
    if (!item) {
      throw new ValidationError('Export history item not found');
    }

    if (item.createdBy !== username && req.user?.role !== 'admin') {
      throw new ValidationError('Not authorized to delete this export');
    }

    // Delete file if it exists
    if (item.filePath) {
      try {
        await fs.unlink(item.filePath);
      } catch (error) {
        logger.warn('Failed to delete export file:', error);
      }
    }

    exportHistory.delete(exportId);
    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete export history:', error);
    throw error;
  }
};

/**
 * Download from export history
 */
export const downloadFromHistory = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { exportId } = req.params;
    const username = req.user?.username;

    const item = exportHistory.get(exportId);
    if (!item) {
      throw new ValidationError('Export history item not found');
    }

    if (item.createdBy !== username && req.user?.role !== 'admin') {
      throw new ValidationError('Not authorized to download this export');
    }

    if (item.status !== 'completed') {
      throw new ValidationError('Export is not available for download');
    }

    if (!item.filePath) {
      throw new ValidationError('Export file not found');
    }

    // Check if file exists
    try {
      await fs.access(item.filePath);
    } catch (error) {
      throw new ValidationError('Export file no longer exists');
    }

    // Increment download count
    item.downloadCount++;
    exportHistory.set(exportId, item);

    // Send file
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${item.filename}"`);
    res.sendFile(path.resolve(item.filePath));
  } catch (error) {
    logger.error('Failed to download from history:', error);
    throw error;
  }
};

// Helper function to add export to history
export const addToExportHistory = (exportData: Omit<ExportHistoryItem, 'id' | 'createdAt' | 'downloadCount'>) => {
  const id = crypto.randomUUID();
  const item: ExportHistoryItem = {
    ...exportData,
    id,
    createdAt: new Date().toISOString(),
    downloadCount: 0
  };
  
  exportHistory.set(id, item);
  return item;
};