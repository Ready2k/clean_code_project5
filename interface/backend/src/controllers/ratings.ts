import { Request, Response } from 'express';
import Joi from 'joi';
import { getRatingService, RatingFilters, PromptRatingFilters } from '../services/rating-service.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { ValidationError } from '../types/errors.js';
import { logger } from '../utils/logger.js';

// Extend AuthenticatedRequest to include params and query
interface ExtendedAuthenticatedRequest extends AuthenticatedRequest {
  params: any;
  query: any;
  body: any;
  app: any;
}

// Validation schemas
const ratePromptSchema = Joi.object({
  score: Joi.number().integer().min(1).max(5).required(),
  note: Joi.string().max(1000),
  promptVersion: Joi.number().integer().min(1)
});

const updateRatingSchema = Joi.object({
  score: Joi.number().integer().min(1).max(5),
  note: Joi.string().max(1000)
}).min(1);

const ratingFiltersSchema = Joi.object({
  minScore: Joi.number().integer().min(1).max(5),
  maxScore: Joi.number().integer().min(1).max(5),
  userId: Joi.string(),
  dateFrom: Joi.string().isoDate(),
  dateTo: Joi.string().isoDate(),
  sortBy: Joi.string().valid('score', 'date', 'user'),
  sortOrder: Joi.string().valid('asc', 'desc'),
  limit: Joi.number().integer().min(1).max(100),
  offset: Joi.number().integer().min(0)
});

const promptRatingFiltersSchema = Joi.object({
  minRating: Joi.number().min(0).max(5),
  maxRating: Joi.number().min(0).max(5),
  minRatingCount: Joi.number().integer().min(0),
  sortByRating: Joi.boolean()
});

const logRunSchema = Joi.object({
  provider: Joi.string().required(),
  model: Joi.string().required(),
  success: Joi.boolean().required(),
  outcomeNote: Joi.string().max(1000),
  metadata: Joi.object()
});

/**
 * Submit a rating for a prompt
 */
export const ratePrompt = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { promptId } = req.params;
    const { error, value } = ratePromptSchema.validate(req.body);
    
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    if (!promptId) {
      throw new ValidationError('Prompt ID is required');
    }

    const ratingService = getRatingService();
    await ratingService.ratePrompt(promptId, req.user!.userId, value);

    // Emit WebSocket events for rating update and user activity
    const webSocketService = req.app.get('webSocketService');
    if (webSocketService) {
      webSocketService.notifyRatingUpdated(promptId, value, req.user!.userId);
      
      webSocketService.trackUserActivity(
        req.user!.userId,
        req.user!.username || 'User',
        'rated prompt',
        promptId
      );
    }

    res.status(201).json({
      message: 'Rating submitted successfully',
      promptId,
      score: value.score
    });
  } catch (error) {
    logger.error('Failed to rate prompt:', error);
    throw error;
  }
};

/**
 * Get ratings for a prompt with optional filtering
 */
export const getPromptRatings = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { promptId } = req.params;
    
    if (!promptId) {
      throw new ValidationError('Prompt ID is required');
    }

    // Validate filters
    const { error: filterError, value: filters } = ratingFiltersSchema.validate(req.query);
    if (filterError) {
      throw new ValidationError(filterError.details[0]?.message || 'Invalid filters');
    }

    const ratingService = getRatingService();
    const result = await ratingService.getPromptRatings(promptId, filters as RatingFilters);

    res.json({
      promptId,
      ratings: result.ratings,
      total: result.total,
      aggregation: result.aggregation,
      filters: filters || {}
    });
  } catch (error) {
    logger.error('Failed to get prompt ratings:', error);
    throw error;
  }
};

/**
 * Get comprehensive rating analytics for a prompt
 */
export const getPromptRatingAnalytics = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { promptId } = req.params;
    
    if (!promptId) {
      throw new ValidationError('Prompt ID is required');
    }

    const ratingService = getRatingService();
    const analytics = await ratingService.getPromptRatingAnalytics(promptId);

    res.json({
      promptId,
      analytics
    });
  } catch (error) {
    logger.error('Failed to get prompt rating analytics:', error);
    throw error;
  }
};

/**
 * Get system-wide rating statistics
 */
export const getSystemRatingStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const ratingService = getRatingService();
    const stats = await ratingService.getSystemRatingStats();

    res.json({
      systemStats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get system rating stats:', error);
    throw error;
  }
};

/**
 * Get user's rating for a specific prompt
 */
export const getUserRating = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { promptId } = req.params;
    
    if (!promptId) {
      throw new ValidationError('Prompt ID is required');
    }

    const ratingService = getRatingService();
    const rating = await ratingService.getUserRating(promptId, req.user!.userId);

    if (!rating) {
      res.json({
        promptId,
        userRating: null,
        message: 'User has not rated this prompt'
      });
      return;
    }

    res.json({
      promptId,
      userRating: rating
    });
  } catch (error) {
    logger.error('Failed to get user rating:', error);
    throw error;
  }
};

/**
 * Update an existing rating
 */
export const updateRating = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { ratingId } = req.params;
    const { error, value } = updateRatingSchema.validate(req.body);
    
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    if (!ratingId) {
      throw new ValidationError('Rating ID is required');
    }

    const ratingService = getRatingService();
    await ratingService.updateRating(ratingId, value);

    res.json({
      message: 'Rating updated successfully',
      ratingId,
      updates: value
    });
  } catch (error) {
    logger.error('Failed to update rating:', error);
    throw error;
  }
};

/**
 * Delete a rating
 */
export const deleteRating = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { ratingId } = req.params;
    
    if (!ratingId) {
      throw new ValidationError('Rating ID is required');
    }

    const ratingService = getRatingService();
    await ratingService.deleteRating(ratingId);

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete rating:', error);
    throw error;
  }
};

/**
 * Filter prompts by rating criteria
 */
export const filterPromptsByRating = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate filters
    const { error: filterError, value: filters } = promptRatingFiltersSchema.validate(req.query);
    if (filterError) {
      throw new ValidationError(filterError.details[0]?.message || 'Invalid filters');
    }

    const ratingService = getRatingService();
    const prompts = await ratingService.filterPromptsByRating(filters as PromptRatingFilters);

    res.json({
      prompts,
      total: prompts.length,
      filters: filters || {}
    });
  } catch (error) {
    logger.error('Failed to filter prompts by rating:', error);
    throw error;
  }
};

/**
 * Log a prompt run/usage
 */
export const logRun = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { promptId } = req.params;
    const { error, value } = logRunSchema.validate(req.body);
    
    if (error) {
      throw new ValidationError(error.details[0]?.message || 'Validation error');
    }

    if (!promptId) {
      throw new ValidationError('Prompt ID is required');
    }

    const ratingService = getRatingService();
    await ratingService.logRun({
      promptId,
      userId: req.user!.userId,
      ...value
    });

    res.status(201).json({
      message: 'Run logged successfully',
      promptId,
      provider: value.provider,
      model: value.model
    });
  } catch (error) {
    logger.error('Failed to log run:', error);
    throw error;
  }
};

/**
 * Get run history for a prompt
 */
export const getRunHistory = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { promptId } = req.params;
    
    if (!promptId) {
      throw new ValidationError('Prompt ID is required');
    }

    const ratingService = getRatingService();
    const runHistory = await ratingService.getRunHistory(promptId);

    res.json({
      promptId,
      runHistory,
      total: runHistory.length
    });
  } catch (error) {
    logger.error('Failed to get run history:', error);
    throw error;
  }
};

/**
 * Get comprehensive prompt analytics including ratings and runs
 */
export const getPromptAnalytics = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { promptId } = req.params;
    
    if (!promptId) {
      throw new ValidationError('Prompt ID is required');
    }

    const ratingService = getRatingService();
    const analytics = await ratingService.getPromptAnalytics(promptId);

    res.json({
      promptId,
      analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get prompt analytics:', error);
    throw error;
  }
};

/**
 * Get rating trends over time
 */
export const getRatingTrends = async (req: Request, res: Response): Promise<void> => {
  try {
    const { promptId } = req.params;
    const days = parseInt(req.query['days'] as string) || 30;
    
    if (days < 1 || days > 365) {
      throw new ValidationError('Days must be between 1 and 365');
    }

    const ratingService = getRatingService();
    
    if (promptId) {
      // Get trends for specific prompt
      const analytics = await ratingService.getPromptRatingAnalytics(promptId);
      
      // Filter trends to requested time period
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const filteredTrends = analytics.ratingTrends.filter(trend => 
        new Date(trend.date) >= cutoffDate
      );
      
      res.json({
        promptId,
        trends: filteredTrends,
        period: `${days} days`,
        totalDataPoints: filteredTrends.length
      });
    } else {
      // Get system-wide trends
      const stats = await ratingService.getSystemRatingStats();
      
      // Filter trends to requested time period
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const filteredTrends = stats.ratingTrends.filter(trend => 
        new Date(trend.date) >= cutoffDate
      );
      
      res.json({
        systemTrends: filteredTrends,
        period: `${days} days`,
        totalDataPoints: filteredTrends.length
      });
    }
  } catch (error) {
    logger.error('Failed to get rating trends:', error);
    throw error;
  }
};

/**
 * Get top rated prompts
 */
export const getTopRatedPrompts = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query['limit'] as string) || 10;
    const minRatingCount = parseInt(req.query['minRatingCount'] as string) || 1;
    
    if (limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100');
    }

    const ratingService = getRatingService();
    const prompts = await ratingService.filterPromptsByRating({
      minRatingCount,
      sortByRating: true
    });

    const topPrompts = prompts.slice(0, limit);

    res.json({
      topRatedPrompts: topPrompts,
      total: topPrompts.length,
      criteria: {
        limit,
        minRatingCount
      }
    });
  } catch (error) {
    logger.error('Failed to get top rated prompts:', error);
    throw error;
  }
};