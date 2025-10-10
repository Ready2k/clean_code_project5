import { Request, Response } from 'express';
import Joi from 'joi';
import { getPromptLibraryService, CreatePromptRequest, PromptFilters } from '../services/prompt-library-service.js';
import { getEnhancementWorkflowService, QuestionnaireResponse } from '../services/enhancement-workflow-service.js';
import { getProviderRegistryService, RenderRequest } from '../services/provider-registry-service.js';
import { getExportService, ExportOptions, BulkExportOptions } from '../services/export-service.js';
import { getWebSocketService } from '../services/websocket-service.js';
import { AuthenticatedRequest } from '../types/auth.js';

// Extend AuthenticatedRequest to include params and query
interface ExtendedAuthenticatedRequest extends AuthenticatedRequest {
  params: any;
  query: any;
  body: any;
  app: any;
}
import { ValidationError, NotFoundError } from '../types/errors.js';
import { logger } from '../utils/logger.js';

// Validation schemas
const createPromptSchema = Joi.object({
  metadata: Joi.object({
    title: Joi.string().required().min(1).max(200),
    summary: Joi.string().required().min(1).max(500),
    tags: Joi.array().items(Joi.string().min(1).max(50)).default([])
  }).required(),
  humanPrompt: Joi.object({
    goal: Joi.string().required().min(10),
    audience: Joi.string().required().min(5),
    steps: Joi.array().items(Joi.string().min(1)).min(1).required(),
    output_expectations: Joi.object({
      format: Joi.string().required().min(1),
      fields: Joi.array().items(Joi.string().min(1)).default([])
    }).required()
  }).required()
});

const updatePromptSchema = Joi.object({
  metadata: Joi.object({
    title: Joi.string().min(1).max(200),
    summary: Joi.string().min(1).max(500),
    tags: Joi.array().items(Joi.string().min(1).max(50)),
    owner: Joi.string().strip() // Allow but strip out owner field - it shouldn't be modifiable
  }),
  humanPrompt: Joi.object({
    goal: Joi.string().min(10),
    audience: Joi.string().min(5),
    steps: Joi.array().items(Joi.string().min(1)).min(1),
    output_expectations: Joi.object({
      format: Joi.string().min(1),
      fields: Joi.array().items(Joi.string().min(1))
    })
  }),
  variables: Joi.array().items(Joi.object({
    key: Joi.string().required(),
    label: Joi.string().required(),
    type: Joi.string().valid('string', 'number', 'boolean', 'select', 'multiselect').required(),
    required: Joi.boolean().default(true),
    sensitive: Joi.boolean().default(false),
    options: Joi.array().items(Joi.string()),
    default: Joi.any()
  }))
}).min(1);

const enhancePromptSchema = Joi.object({
  preserve_style: Joi.boolean().default(false),
  target_provider: Joi.string().valid('openai', 'anthropic', 'meta')
});

const renderPromptSchema = Joi.object({
  model: Joi.string(),
  targetModel: Joi.string().optional(), // Target model for adaptation
  temperature: Joi.number().min(0).max(2),
  variables: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
  connectionId: Joi.string().optional(),
  maxTokens: Joi.number().optional(),
  topP: Joi.number().optional(),
  frequencyPenalty: Joi.number().optional(),
  presencePenalty: Joi.number().optional(),
  version: Joi.string().valid('original', 'enhanced').default('original')
});

// Rating schema moved to rating controller

const questionnaireResponseSchema = Joi.object({
  answers: Joi.object().pattern(Joi.string(), Joi.any()).required()
});

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

/**
 * Get all prompts with optional filtering
 */
export const getPrompts = async (req: Request, res: Response): Promise<void> => {
  try {
    const filters: PromptFilters = {
      search: req.query['search'] as string,
      tags: req.query['tags'] ? (req.query['tags'] as string).split(',') : undefined,
      owner: req.query['owner'] as string,
      sortBy: req.query['sortBy'] as string,
      sortOrder: req.query['sortOrder'] as 'asc' | 'desc',
      page: req.query['page'] ? parseInt(req.query['page'] as string) : 1,
      limit: req.query['limit'] ? parseInt(req.query['limit'] as string) : 50 // Increased default limit
    };

    const promptLibraryService = getPromptLibraryService();
    const result = await promptLibraryService.listPromptsWithPagination(filters);

    res.json({
      items: result.items,
      pagination: {
        page: filters.page!,
        limit: filters.limit!,
        total: result.total,
        totalPages: Math.ceil(result.total / filters.limit!),
        hasNextPage: filters.page! * filters.limit! < result.total,
        hasPreviousPage: filters.page! > 1
      }
    });
  } catch (error) {
    logger.error('Failed to get prompts:', error);
    throw error;
  }
};

/**
 * Create a new prompt
 */
export const createPrompt = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { error, value } = createPromptSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    const createRequest: CreatePromptRequest = {
      ...value,
      owner: req.user!.userId
    };

    const promptLibraryService = getPromptLibraryService();
    const prompt = await promptLibraryService.createPrompt(createRequest);

    // Emit WebSocket event for user activity
    const webSocketService = req.app.get('webSocketService');
    if (webSocketService) {
      webSocketService.trackUserActivity(
        req.user!.userId,
        req.user!.username || 'User',
        'created prompt',
        prompt.id
      );
    }

    res.status(201).json(prompt);
  } catch (error) {
    logger.error('Failed to create prompt:', error);
    throw error;
  }
};

/**
 * Get a specific prompt by ID
 */
export const getPrompt = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      throw new ValidationError('Prompt ID is required');
    }
    
    const promptLibraryService = getPromptLibraryService();
    const prompt = await promptLibraryService.getPrompt(id);

    res.json(prompt);
  } catch (error) {
    logger.error('Failed to get prompt:', error);
    throw error;
  }
};

/**
 * Update an existing prompt
 */
export const updatePrompt = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { error, value } = updatePromptSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    const promptLibraryService = getPromptLibraryService();
    const prompt = await promptLibraryService.updatePrompt(id, value);

    // Emit WebSocket events for prompt update and user activity
    const webSocketService = req.app.get('webSocketService');
    if (webSocketService) {
      webSocketService.notifyPromptUpdated(
        id,
        req.user!.userId,
        req.user!.username || 'User',
        value
      );
      
      webSocketService.trackUserActivity(
        req.user!.userId,
        req.user!.username || 'User',
        'updated prompt',
        id
      );
    }

    res.json(prompt);
  } catch (error) {
    logger.error('Failed to update prompt:', error);
    throw error;
  }
};

/**
 * Delete a prompt
 */
export const deletePrompt = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      throw new ValidationError('Prompt ID is required');
    }
    
    const promptLibraryService = getPromptLibraryService();
    await promptLibraryService.deletePrompt(id);

    // Emit WebSocket event for user activity
    const webSocketService = req.app.get('webSocketService');
    if (webSocketService) {
      webSocketService.trackUserActivity(
        req.user!.userId,
        req.user!.username || 'User',
        'deleted prompt',
        id
      );
    }

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete prompt:', error);
    throw error;
  }
};

/**
 * Start prompt enhancement
 */
export const enhancePrompt = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { error, value } = enhancePromptSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    const enhancementService = getEnhancementWorkflowService(getWebSocketService());
    const jobId = await enhancementService.startEnhancement(id, req.user!.userId, value);

    res.status(202).json({
      jobId,
      message: 'Enhancement job started',
      statusUrl: `/api/prompts/${id}/enhance/status?jobId=${jobId}`
    });
  } catch (error) {
    logger.error('Failed to start prompt enhancement:', error);
    throw error;
  }
};

/**
 * Get enhancement status
 */
export const getEnhancementStatus = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const jobId = req.query['jobId'] as string;

    if (!jobId) {
      // Return all jobs for this user and prompt
      const enhancementService = getEnhancementWorkflowService(getWebSocketService());
      const userJobs = enhancementService.getUserJobs(req.user!.userId);
      const promptJobs = userJobs.filter(job => job.promptId === id);
      
      res.json({ jobs: promptJobs });
      return;
    }

    const enhancementService = getEnhancementWorkflowService(getWebSocketService());
    const status = enhancementService.getEnhancementStatus(jobId);

    if (!status) {
      throw new NotFoundError(`Enhancement job ${jobId} not found`);
    }

    res.json(status);
  } catch (error) {
    logger.error('Failed to get enhancement status:', error);
    throw error;
  }
};

/**
 * Submit questionnaire response for enhancement
 */
export const submitQuestionnaireResponse = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const jobId = req.query['jobId'] as string;

    if (!jobId) {
      throw new ValidationError('jobId query parameter is required');
    }

    const { error, value } = questionnaireResponseSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    const response: QuestionnaireResponse = {
      jobId,
      responses: value.answers || {},
      answers: value.answers || {}
    };

    const enhancementService = getEnhancementWorkflowService(getWebSocketService());
    await enhancementService.submitQuestionnaireResponse(response);

    res.json({
      message: 'Questionnaire response submitted successfully',
      statusUrl: `/api/prompts/${id}/enhance/status?jobId=${jobId}`
    });
  } catch (error) {
    logger.error('Failed to submit questionnaire response:', error);
    throw error;
  }
};

// Track active render requests to prevent duplicates
const activeRenders = new Map<string, { promise: Promise<any>; timestamp: number }>();

// Clean up old render requests (older than 5 minutes)
const cleanupOldRenders = () => {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [key, { timestamp }] of activeRenders.entries()) {
    if (timestamp < fiveMinutesAgo) {
      activeRenders.delete(key);
    }
  }
};

// Run cleanup every minute
setInterval(cleanupOldRenders, 60 * 1000);

/**
 * Render a prompt for a specific provider
 */
export const renderPrompt = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, provider } = req.params;
    const { error, value } = renderPromptSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    // Create a unique key for this render request
    const renderKey = `${id}-${provider}-${req.user!.userId}-${value.connectionId || 'default'}`;
    
    // Check if this exact render is already in progress
    if (activeRenders.has(renderKey)) {
      logger.info('Duplicate render request detected, waiting for existing request', {
        promptId: id,
        provider,
        userId: req.user!.userId,
        connectionId: value.connectionId
      });
      
      // Wait for the existing request to complete and return its result
      const { promise } = activeRenders.get(renderKey)!;
      const existingResult = await promise;
      res.json(existingResult);
      return;
    }

    const renderRequest: RenderRequest = {
      promptId: id,
      provider,
      options: {
        model: value.model,
        targetModel: value.targetModel, // Pass target model for adaptation
        temperature: value.temperature,
        variables: value.variables,
        version: value.version,
        connectionId: value.connectionId
      },
      userId: req.user!.userId,
      connectionId: value.connectionId
    };

    // Create the render promise and store it
    const renderPromise = (async () => {
      try {
        logger.info('Starting render request', {
          promptId: id,
          provider,
          userId: req.user!.userId,
          connectionId: value.connectionId
        });

        const providerService = getProviderRegistryService();
        const result = await providerService.renderPrompt(renderRequest);
        
        logger.info('Render request completed successfully', {
          promptId: id,
          provider,
          userId: req.user!.userId,
          connectionId: value.connectionId
        });

        return result;
      } finally {
        // Always clean up the active render entry
        activeRenders.delete(renderKey);
      }
    })();

    // Store the promise in the active renders map with timestamp
    activeRenders.set(renderKey, { 
      promise: renderPromise, 
      timestamp: Date.now() 
    });

    // Wait for the result and return it
    const result = await renderPromise;
    res.json(result);
  } catch (error) {
    logger.error('Failed to render prompt:', error);
    throw error;
  }
};

/**
 * Get prompt history and versions
 */
export const getPromptHistory = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      throw new ValidationError('Prompt ID is required');
    }
    
    const promptLibraryService = getPromptLibraryService();
    const history = await promptLibraryService.getPromptHistory(id);

    res.json({ history });
  } catch (error) {
    logger.error('Failed to get prompt history:', error);
    throw error;
  }
};

/**
 * Get a specific version of a prompt
 */
export const getPromptVersion = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id, version } = req.params;
    
    if (!id || !version) {
      throw new ValidationError('Prompt ID and version are required');
    }
    
    const promptLibraryService = getPromptLibraryService();
    const history = await promptLibraryService.getPromptHistory(id);
    
    const versionNumber = parseInt(version);
    const versionEntry = history.find(h => h.version === versionNumber);
    
    if (!versionEntry) {
      throw new NotFoundError(`Version ${version} not found for prompt ${id}`);
    }

    res.json(versionEntry);
  } catch (error) {
    logger.error('Failed to get prompt version:', error);
    throw error;
  }
};

// Rating functionality moved to dedicated rating controller and service

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

    res.send(result.content);
  } catch (error) {
    logger.error('Failed to export prompt:', error);
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

    // Stream the archive to the response
    result.stream.pipe(res);
  } catch (error) {
    logger.error('Failed to bulk export prompts:', error);
    throw error;
  }
};

/**
 * Search prompts (enhanced version of getPrompts with search focus)
 */
export const searchPrompts = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query['q'] as string;
    if (!query || query.trim().length === 0) {
      throw new ValidationError('Search query is required');
    }

    const filters: PromptFilters = {
      search: query,
      tags: req.query['tags'] ? (req.query['tags'] as string).split(',') : undefined,
      owner: req.query['owner'] as string,
      sortBy: 'relevance', // Default to relevance for search
      page: req.query['page'] ? parseInt(req.query['page'] as string) : 1,
      limit: req.query['limit'] ? parseInt(req.query['limit'] as string) : 20
    };

    const promptLibraryService = getPromptLibraryService();
    const prompts = await promptLibraryService.listPrompts(filters);

    const page = filters.page || 1;
    const limit = filters.limit || prompts.length;
    const totalPages = limit ? Math.ceil(prompts.length / limit) : 1;
    
    res.json({
      query,
      items: prompts,
      pagination: {
        page,
        limit,
        total: prompts.length,
        totalPages
      }
    });
  } catch (error) {
    logger.error('Failed to search prompts:', error);
    throw error;
  }
};

/**
 * Get available tags from all prompts
 */
export const getAvailableTags = async (_req: Request, res: Response): Promise<void> => {
  try {
    const promptLibraryService = getPromptLibraryService();
    const prompts = await promptLibraryService.listPrompts();

    // Extract and count all tags
    const tagCounts = new Map<string, number>();
    
    for (const prompt of prompts) {
      for (const tag of prompt.metadata.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Convert to array and sort by usage count
    const tags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      tags,
      total: tags.length
    });
  } catch (error) {
    logger.error('Failed to get available tags:', error);
    throw error;
  }
};

/**
 * Get available providers
 */
export const getAvailableProviders = async (_req: Request, res: Response): Promise<void> => {
  try {
    const providerService = getProviderRegistryService();
    const providers = await providerService.getAvailableProviders();

    res.json({
      providers,
      total: providers.length
    });
  } catch (error) {
    logger.error('Failed to get available providers:', error);
    throw error;
  }
};

/**
 * Compare prompt rendering across multiple providers
 */
export const compareProviders = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { providers, ...renderOptions } = req.body;

    if (!providers || !Array.isArray(providers) || providers.length === 0) {
      throw new ValidationError('providers array is required');
    }

    const { error, value } = renderPromptSchema.validate(renderOptions);
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    const providerService = getProviderRegistryService();
    const results = await providerService.compareProviders(
      id,
      providers,
      value,
      req.user!.userId
    );

    res.json({
      promptId: id,
      providers: providers,
      results,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Failed to compare providers:', error);
    throw error;
  }
};

/**
 * Save a rendered prompt as a variant
 */
export const saveVariant = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { provider, model, adaptedContent } = req.body;

    if (!provider || !model || !adaptedContent) {
      throw new ValidationError('provider, model, and adaptedContent are required');
    }

    const promptLibraryService = getPromptLibraryService();
    
    // Get the original prompt
    const originalPrompt = await promptLibraryService.getPrompt(id);
    
    // Create variant with provider-model tag
    const variantTag = `${provider}-${model}`;
    const variantTags = [...(originalPrompt.metadata.tags || []), variantTag];
    
    // Create new prompt as variant
    const variantPrompt = {
      humanPrompt: {
        goal: originalPrompt.humanPrompt.goal,
        audience: originalPrompt.humanPrompt.audience,
        steps: originalPrompt.humanPrompt.steps,
        output_expectations: originalPrompt.humanPrompt.output_expectations
      },
      metadata: {
        title: `${originalPrompt.metadata.title} (${provider}-${model})`,
        summary: `${originalPrompt.metadata.summary} - Optimized for ${provider} ${model}`,
        tags: variantTags,
        owner: req.user!.userId,
        variant_of: id,
        tuned_for_provider: provider,
        preferred_model: model
      },
      owner: req.user!.userId
    };

    const savedVariant = await promptLibraryService.createPrompt(variantPrompt);

    logger.info('Variant saved successfully', { 
      originalId: id, 
      variantId: savedVariant.id, 
      provider, 
      model 
    });

    res.status(201).json(savedVariant);
  } catch (error) {
    logger.error('Failed to save variant:', error);
    throw error;
  }
};

/**
 * Get supported export formats
 */
export const getExportFormats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const exportService = getExportService();
    const formats = exportService.getSupportedFormats();

    res.json({
      formats,
      total: formats.length
    });
  } catch (error) {
    logger.error('Failed to get export formats:', error);
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
      filename: result.filename,
      size: result.size,
      preview: result.content.substring(0, 1000), // First 1000 characters
      truncated: result.content.length > 1000,
      mimeType: result.mimeType,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to preview export:', error);
    throw error;
  }
};

/**
 * Clean up duplicate prompts (admin only)
 */
export const cleanupDuplicates = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const promptLibraryService = getPromptLibraryService();
    const result = await promptLibraryService.cleanupDuplicates();

    logger.info('Duplicate cleanup completed by admin', {
      userId: req.user!.userId,
      removedPrompts: result.removedPrompts,
      removedFiles: result.removedFiles
    });

    res.json({
      message: 'Duplicate cleanup completed successfully',
      removedPrompts: result.removedPrompts,
      removedFiles: result.removedFiles,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to cleanup duplicates:', error);
    throw error;
  }
};