import { Response } from 'express';
import Joi from 'joi';
import { getPromptLibraryService } from '../services/prompt-library-service.js';
import { ImportService, ImportOptions } from '../services/import-service.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { ValidationError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import { promises as fs } from 'fs';
import fetch from 'node-fetch';

// Extend AuthenticatedRequest to include params and query
interface ImportRequest extends AuthenticatedRequest {
  params: any;
  query: any;
  app: any;
  file?: Express.Multer.File;
  body: any;
}

// Validation schemas
const importFromContentSchema = Joi.object({
  content: Joi.string().required(),
  sourceProvider: Joi.string().valid('openai', 'anthropic', 'meta', 'internal').optional(),
  conflictResolution: Joi.string().valid('skip', 'overwrite', 'create_new', 'prompt').default('create_new'),
  defaultOwner: Joi.string().optional(),
  defaultTags: Joi.array().items(Joi.string()).optional(),
  autoEnhance: Joi.boolean().default(false),
  slugPrefix: Joi.string().optional(),
  validateBeforeImport: Joi.boolean().default(true)
});

const importFromUrlSchema = Joi.object({
  url: Joi.string().uri().required(),
  sourceProvider: Joi.string().valid('openai', 'anthropic', 'meta', 'internal').optional(),
  conflictResolution: Joi.string().valid('skip', 'overwrite', 'create_new', 'prompt').default('create_new'),
  defaultOwner: Joi.string().optional(),
  defaultTags: Joi.array().items(Joi.string()).optional(),
  autoEnhance: Joi.boolean().default(false),
  slugPrefix: Joi.string().optional(),
  validateBeforeImport: Joi.boolean().default(true)
});

/**
 * Import prompt from content string
 */
export const importFromContent = async (req: ImportRequest, res: Response): Promise<void> => {
  try {
    const { error, value } = importFromContentSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    const promptLibraryService = getPromptLibraryService();
    const importService = new ImportService(promptLibraryService);

    const options: ImportOptions = {
      sourceProvider: value.sourceProvider,
      conflictResolution: value.conflictResolution,
      defaultOwner: value.defaultOwner || (req.user as any)?.email,
      defaultTags: value.defaultTags,
      autoEnhance: value.autoEnhance,
      slugPrefix: value.slugPrefix,
      validateBeforeImport: value.validateBeforeImport
    };

    const importedPrompt = await importService.importFromContent(value.content, options);

    if (!importedPrompt) {
      res.status(200).json({
        success: true,
        message: 'Prompt was skipped due to conflict resolution settings',
        data: null
      });
      return;
    }

    logger.info('Prompt imported from content', {
      promptId: importedPrompt.id,
      title: importedPrompt.metadata.title,
      userId: (req.user as any)?.id
    });

    res.status(201).json({
      success: true,
      message: 'Prompt imported successfully',
      data: importedPrompt
    });
  } catch (error) {
    logger.error('Error importing prompt from content:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        message: error.message,
        error: 'VALIDATION_ERROR'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to import prompt',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

/**
 * Import prompt from URL (GitHub, etc.)
 */
export const importFromUrl = async (req: ImportRequest, res: Response): Promise<void> => {
  try {
    const { error, value } = importFromUrlSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    // Convert GitHub URLs to raw URLs automatically
    const convertedUrl = convertGitHubUrl(value.url);
    
    // Fetch content from URL
    let content: string;
    try {
      const response = await fetch(convertedUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      content = await response.text();
    } catch (fetchError) {
      throw new Error(`Failed to fetch content from URL: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
    }

    const promptLibraryService = getPromptLibraryService();
    const importService = new ImportService(promptLibraryService);

    const options: ImportOptions = {
      sourceProvider: value.sourceProvider,
      conflictResolution: value.conflictResolution,
      defaultOwner: value.defaultOwner || (req.user as any)?.email,
      defaultTags: value.defaultTags || ['imported-from-url'],
      autoEnhance: value.autoEnhance,
      slugPrefix: value.slugPrefix,
      validateBeforeImport: value.validateBeforeImport,
      sourceUrl: value.url
    };

    const importedPrompt = await importService.importFromContent(content, options);

    if (!importedPrompt) {
      res.status(200).json({
        success: true,
        message: 'Prompt was skipped due to conflict resolution settings',
        data: null
      });
      return;
    }

    logger.info('Prompt imported from URL', {
      promptId: importedPrompt.id,
      title: importedPrompt.metadata.title,
      url: value.url,
      userId: (req.user as any)?.id
    });

    res.status(201).json({
      success: true,
      message: 'Prompt imported successfully from URL',
      data: importedPrompt
    });
  } catch (error) {
    logger.error('Error importing prompt from URL:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        message: error.message,
        error: 'VALIDATION_ERROR'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to import prompt from URL',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

/**
 * Import prompt from uploaded file
 */
export const importFromFile = async (req: ImportRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    // Read file content
    const content = await fs.readFile(req.file.path, 'utf-8');

    const options: ImportOptions = {
      sourceProvider: req.body?.sourceProvider,
      conflictResolution: req.body?.conflictResolution || 'create_new',
      defaultOwner: req.body?.defaultOwner || (req.user as any)?.email,
      defaultTags: req.body?.defaultTags ? JSON.parse(req.body.defaultTags) : ['imported-from-file'],
      autoEnhance: req.body?.autoEnhance === 'true',
      slugPrefix: req.body?.slugPrefix,
      validateBeforeImport: req.body?.validateBeforeImport !== 'false'
    };

    const promptLibraryService = getPromptLibraryService();
    const importService = new ImportService(promptLibraryService);

    const importedPrompt = await importService.importFromContent(content, {
      ...options,
      filename: req.file.originalname
    });

    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
    } catch (cleanupError) {
      logger.warn('Failed to clean up uploaded file:', cleanupError);
    }

    if (!importedPrompt) {
      res.status(200).json({
        success: true,
        message: 'Prompt was skipped due to conflict resolution settings',
        data: null
      });
      return;
    }

    logger.info('Prompt imported from file', {
      promptId: importedPrompt.id,
      title: importedPrompt.metadata.title,
      filename: req.file.originalname,
      userId: (req.user as any)?.id
    });

    res.status(201).json({
      success: true,
      message: 'Prompt imported successfully from file',
      data: importedPrompt
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        logger.warn('Failed to clean up uploaded file after error:', cleanupError);
      }
    }

    logger.error('Error importing prompt from file:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        message: error.message,
        error: 'VALIDATION_ERROR'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to import prompt from file',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

/**
 * Validate import content without importing
 */
export const validateImportContent = async (req: ImportRequest, res: Response): Promise<void> => {
  try {
    const { error, value } = Joi.object({
      content: Joi.string().required(),
      sourceProvider: Joi.string().valid('openai', 'anthropic', 'meta', 'internal').optional()
    }).validate(req.body);

    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    const importService = new ImportService();
    
    // Try to parse as JSON, otherwise use as string
    let parsedContent: any;
    try {
      parsedContent = JSON.parse(value.content);
    } catch {
      parsedContent = value.content;
    }
    
    const validation = importService.validateImportContent(
      parsedContent,
      { sourceProvider: value.sourceProvider, conflictResolution: 'skip' }
    );

    res.status(200).json({
      success: true,
      message: 'Content validation completed',
      data: validation
    });
  } catch (error) {
    logger.error('Error validating import content:', error);
    
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        message: error.message,
        error: 'VALIDATION_ERROR'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to validate import content',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};

/**
 * Get supported import formats
 */
/**
 * Convert GitHub URLs to raw URLs
 */
function convertGitHubUrl(url: string): string {
  // Check if it's a GitHub blob URL
  const githubBlobRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/;
  const match = url.match(githubBlobRegex);
  
  if (match) {
    const [, owner, repo, branch, path] = match;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  }
  
  // Return original URL if not a GitHub blob URL
  return url;
}

export const getSupportedFormats = async (_req: ImportRequest, res: Response): Promise<void> => {
  try {
    const formats = [
      {
        provider: 'openai',
        name: 'OpenAI',
        description: 'OpenAI Chat Completions format with messages array',
        fileExtensions: ['.json'],
        example: {
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello, how can you help me?' }
          ]
        }
      },
      {
        provider: 'anthropic',
        name: 'Anthropic Claude',
        description: 'Anthropic format with system field and messages array',
        fileExtensions: ['.json'],
        example: {
          system: 'You are a helpful assistant.',
          messages: [
            { role: 'user', content: 'Hello, how can you help me?' }
          ]
        }
      },
      {
        provider: 'meta',
        name: 'Meta Llama',
        description: 'Meta/Llama format with messages array',
        fileExtensions: ['.json'],
        example: {
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Hello, how can you help me?' }
          ]
        }
      },
      {
        provider: 'internal',
        name: 'Internal Format',
        description: 'Native prompt library format',
        fileExtensions: ['.json', '.yaml', '.yml'],
        example: {
          prompt_human: {
            goal: 'Help users with their questions',
            audience: 'General users',
            steps: ['Listen to the question', 'Provide helpful response'],
            output_expectations: { format: 'text', fields: [] }
          }
        }
      },
      {
        provider: 'markdown',
        name: 'Markdown',
        description: 'Markdown format with structured sections',
        fileExtensions: ['.md', '.markdown'],
        example: `# Prompt Title

## Goal
Help users with their questions

## Audience
General users

## Steps
1. Listen to the question
2. Provide helpful response

## Output
Provide clear and helpful answers`
      }
    ];

    res.status(200).json({
      success: true,
      message: 'Supported import formats retrieved',
      data: formats
    });
  } catch (error) {
    logger.error('Error getting supported formats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get supported formats',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};