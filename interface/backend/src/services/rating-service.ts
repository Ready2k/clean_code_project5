import { logger } from '../utils/logger.js';
import { ServiceUnavailableError, NotFoundError, ValidationError } from '../types/errors.js';
import { getPromptLibraryService } from './prompt-library-service.js';
import path from 'path';
import fs from 'fs/promises';
import * as YAML from 'yaml';
import { v4 as uuidv4 } from 'uuid';

// Local type definitions for rating system
export interface Rating {
  id: string;
  prompt_id: string;
  user_id: string;
  score: number; // 1-5 stars
  note?: string;
  created_at: string;
  prompt_version?: number;
}

export interface RunLog {
  id: string;
  prompt_id: string;
  user_id: string;
  provider: string;
  model: string;
  created_at: string;
  outcome_note?: string;
  success: boolean;
  metadata?: Record<string, any>;
}

export interface RatingAggregation {
  prompt_id: string;
  average_score: number;
  total_ratings: number;
  score_distribution: Record<number, number>; // score -> count
  latest_rating_date: string;
}

export interface RatingAnalytics {
  promptId: string;
  totalRatings: number;
  averageScore: number;
  scoreDistribution: Record<number, number>;
  ratingTrends: Array<{
    date: string;
    averageScore: number;
    count: number;
  }>;
  recentRatings: any[];
  topRatedVersions: Array<{
    version: number;
    averageScore: number;
    totalRatings: number;
  }>;
}

export interface SystemRatingStats {
  totalRatings: number;
  averageScore: number;
  ratingsByScore: Record<number, number>;
  topRatedPrompts: Array<{
    promptId: string;
    title: string;
    averageScore: number;
    totalRatings: number;
  }>;
  recentActivity: Array<{
    promptId: string;
    title: string;
    userId: string;
    username?: string | undefined;
    score: number;
    timestamp: string;
  }>;
  ratingTrends: Array<{
    date: string;
    totalRatings: number;
    averageScore: number;
  }>;
}

export interface RatingFilters {
  minScore?: number;
  maxScore?: number;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'score' | 'date' | 'user';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface PromptRatingFilters {
  minRating?: number;
  maxRating?: number;
  minRatingCount?: number;
  sortByRating?: boolean;
}

/**
 * Local file-based rating system implementation
 */
class LocalFileRatingSystem {
  private ratingsDir: string;
  private runLogsDir: string;

  constructor(baseDir: string = './data') {
    this.ratingsDir = path.join(baseDir, 'ratings');
    this.runLogsDir = path.join(baseDir, 'run-logs');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.ratingsDir, { recursive: true });
    await fs.mkdir(this.runLogsDir, { recursive: true });
  }

  async ratePrompt(promptId: string, userId: string, rating: {
    score: number;
    note?: string;
    prompt_version?: number;
  }): Promise<void> {
    if (rating.score < 1 || rating.score > 5) {
      throw new Error('Rating score must be between 1 and 5');
    }

    const existingRating = await this.getUserRating(promptId, userId);
    
    const ratingData: Rating = {
      id: existingRating?.id || uuidv4(),
      prompt_id: promptId,
      user_id: userId,
      score: rating.score,
      created_at: new Date().toISOString(),
      ...(rating.note && { note: rating.note }),
      ...(rating.prompt_version && { prompt_version: rating.prompt_version })
    };

    const ratingFile = path.join(this.ratingsDir, `${ratingData.id}.yaml`);
    await fs.writeFile(ratingFile, YAML.stringify(ratingData));
  }

  async getPromptRatings(promptId: string): Promise<Rating[]> {
    try {
      const files = await fs.readdir(this.ratingsDir);
      const ratings: Rating[] = [];

      for (const file of files) {
        if (file.endsWith('.yaml')) {
          const filePath = path.join(this.ratingsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const rating = YAML.parse(content) as Rating;
          
          if (rating.prompt_id === promptId) {
            ratings.push(rating);
          }
        }
      }

      return ratings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async getRatingAggregation(promptId: string): Promise<RatingAggregation> {
    const ratings = await this.getPromptRatings(promptId);
    
    if (ratings.length === 0) {
      return {
        prompt_id: promptId,
        average_score: 0,
        total_ratings: 0,
        score_distribution: {},
        latest_rating_date: ''
      };
    }

    const scoreDistribution: Record<number, number> = {};
    let sum = 0;

    for (const rating of ratings) {
      sum += rating.score;
      scoreDistribution[rating.score] = (scoreDistribution[rating.score] || 0) + 1;
    }

    return {
      prompt_id: promptId,
      average_score: Math.round((sum / ratings.length) * 100) / 100,
      total_ratings: ratings.length,
      score_distribution: scoreDistribution,
      latest_rating_date: ratings[0]?.created_at || ''
    };
  }

  async getUserRating(promptId: string, userId: string): Promise<Rating | null> {
    const ratings = await this.getPromptRatings(promptId);
    return ratings.find(rating => rating.user_id === userId) || null;
  }

  async updateRating(ratingId: string, updates: Partial<Rating>): Promise<void> {
    const ratingFile = path.join(this.ratingsDir, `${ratingId}.yaml`);
    
    try {
      const content = await fs.readFile(ratingFile, 'utf-8');
      const rating = YAML.parse(content) as Rating;
      
      const updatedRating = {
        ...rating,
        ...updates,
        id: ratingId,
        created_at: rating.created_at
      };

      if (updates.score !== undefined && (updates.score < 1 || updates.score > 5)) {
        throw new Error('Rating score must be between 1 and 5');
      }

      await fs.writeFile(ratingFile, YAML.stringify(updatedRating));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Rating with ID ${ratingId} not found`);
      }
      throw error;
    }
  }

  async deleteRating(ratingId: string): Promise<void> {
    const ratingFile = path.join(this.ratingsDir, `${ratingId}.yaml`);
    
    try {
      await fs.unlink(ratingFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Rating with ID ${ratingId} not found`);
      }
      throw error;
    }
  }

  async logRun(runLog: {
    prompt_id: string;
    user_id: string;
    provider: string;
    model: string;
    success: boolean;
    outcome_note?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const logData: RunLog = {
      id: uuidv4(),
      prompt_id: runLog.prompt_id,
      user_id: runLog.user_id,
      provider: runLog.provider,
      model: runLog.model,
      created_at: new Date().toISOString(),
      success: runLog.success,
      ...(runLog.outcome_note && { outcome_note: runLog.outcome_note }),
      ...(runLog.metadata && { metadata: runLog.metadata })
    };

    const logFile = path.join(this.runLogsDir, `${logData.id}.yaml`);
    await fs.writeFile(logFile, YAML.stringify(logData));
  }

  async getRunHistory(promptId: string): Promise<RunLog[]> {
    try {
      const files = await fs.readdir(this.runLogsDir);
      const runLogs: RunLog[] = [];

      for (const file of files) {
        if (file.endsWith('.yaml')) {
          const filePath = path.join(this.runLogsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const runLog = YAML.parse(content) as RunLog;
          
          if (runLog.prompt_id === promptId) {
            runLogs.push(runLog);
          }
        }
      }

      return runLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}

/**
 * Enhanced rating service that provides comprehensive rating and evaluation functionality
 */
export class RatingService {
  private fileRatingSystem: LocalFileRatingSystem;
  private isInitialized = false;

  constructor(config?: { storageDir?: string }) {
    const storageDir = config?.storageDir || path.resolve(process.cwd(), 'data');
    this.fileRatingSystem = new LocalFileRatingSystem(storageDir);
  }

  /**
   * Initialize the rating service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Rating Service...');
      await this.fileRatingSystem.initialize();
      this.isInitialized = true;
      logger.info('Rating Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Rating Service:', error);
      throw new ServiceUnavailableError('Rating service initialization failed');
    }
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new ServiceUnavailableError('Rating service not initialized');
    }
  }

  /**
   * Map backend rating fields to frontend format
   */
  private mapRatingToFrontend(rating: Rating & { username?: string | undefined }): any {
    return {
      id: rating.id,
      userId: rating.user_id,
      username: rating.username,
      score: rating.score,
      note: rating.note,
      createdAt: rating.created_at,
      promptVersion: rating.prompt_version
    };
  }

  /**
   * Enrich ratings with username information
   */
  private async enrichRatingsWithUsernames(ratings: Rating[]): Promise<Array<Rating & { username?: string | undefined }>> {
    try {
      // Import getUserService dynamically to avoid circular dependencies
      const { getUserService } = await import('./user-service.js');
      const userService = getUserService();

      const enrichedRatings = await Promise.all(
        ratings.map(async (rating) => {
          try {
            const user = await userService.getUserById(rating.user_id);
            return {
              ...rating,
              username: user?.username
            } as Rating & { username?: string | undefined };
          } catch (error) {
            logger.warn('Failed to get username for rating', { 
              ratingId: rating.id, 
              userId: rating.user_id, 
              error 
            });
            return {
              ...rating,
              username: undefined
            } as Rating & { username?: string | undefined };
          }
        })
      );

      return enrichedRatings;
    } catch (error) {
      logger.warn('Failed to enrich ratings with usernames, returning original ratings', { error });
      return ratings.map(rating => ({ ...rating, username: undefined } as Rating & { username?: string | undefined }));
    }
  }

  /**
   * Submit a rating for a prompt
   */
  async ratePrompt(promptId: string, userId: string, ratingData: {
    score: number;
    note?: string;
    promptVersion?: number;
  }): Promise<void> {
    this.ensureInitialized();

    try {
      logger.info('Submitting rating', { promptId, userId, score: ratingData.score });

      // Validate that the prompt exists
      const promptLibraryService = getPromptLibraryService();
      await promptLibraryService.getPrompt(promptId);

      const ratingInput: {
        score: number;
        note?: string;
        prompt_version?: number;
      } = {
        score: ratingData.score
      };
      
      if (ratingData.note) {
        ratingInput.note = ratingData.note;
      }
      
      if (ratingData.promptVersion) {
        ratingInput.prompt_version = ratingData.promptVersion;
      }

      await this.fileRatingSystem.ratePrompt(promptId, userId, ratingInput);

      logger.info('Rating submitted successfully', { promptId, userId, score: ratingData.score });
    } catch (error) {
      logger.error('Failed to submit rating:', error);
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new ServiceUnavailableError('Failed to submit rating');
    }
  }

  /**
   * Get ratings for a prompt with filtering
   */
  async getPromptRatings(promptId: string, filters?: RatingFilters): Promise<{
    ratings: any[];
    total: number;
    aggregation: RatingAggregation;
  }> {
    this.ensureInitialized();

    try {
      logger.debug('Getting prompt ratings', { promptId, filters });

      let ratings = await this.fileRatingSystem.getPromptRatings(promptId);
      const total = ratings.length;

      // Apply filters
      if (filters) {
        if (filters.minScore !== undefined) {
          ratings = ratings.filter(r => r.score >= filters.minScore!);
        }
        if (filters.maxScore !== undefined) {
          ratings = ratings.filter(r => r.score <= filters.maxScore!);
        }
        if (filters.userId) {
          ratings = ratings.filter(r => r.user_id === filters.userId);
        }
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom);
          ratings = ratings.filter(r => new Date(r.created_at) >= fromDate);
        }
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          ratings = ratings.filter(r => new Date(r.created_at) <= toDate);
        }

        // Apply sorting
        if (filters.sortBy) {
          ratings.sort((a, b) => {
            let aVal: any, bVal: any;
            switch (filters.sortBy) {
              case 'score':
                aVal = a.score;
                bVal = b.score;
                break;
              case 'date':
                aVal = new Date(a.created_at);
                bVal = new Date(b.created_at);
                break;
              case 'user':
                aVal = a.user_id;
                bVal = b.user_id;
                break;
              default:
                return 0;
            }
            
            if (filters.sortOrder === 'desc') {
              return bVal > aVal ? 1 : -1;
            }
            return aVal > bVal ? 1 : -1;
          });
        }

        // Apply pagination
        if (filters.offset !== undefined || filters.limit !== undefined) {
          const offset = filters.offset || 0;
          const limit = filters.limit || ratings.length;
          ratings = ratings.slice(offset, offset + limit);
        }
      }

      // Enrich ratings with username information
      const enrichedRatings = await this.enrichRatingsWithUsernames(ratings);

      // Map to frontend format
      const mappedRatings = enrichedRatings.map(rating => this.mapRatingToFrontend(rating));

      const aggregation = await this.fileRatingSystem.getRatingAggregation(promptId);

      return {
        ratings: mappedRatings,
        total,
        aggregation
      };
    } catch (error) {
      logger.error('Failed to get prompt ratings:', error);
      throw new ServiceUnavailableError('Failed to get prompt ratings');
    }
  }

  /**
   * Get comprehensive rating analytics for a prompt
   */
  async getPromptRatingAnalytics(promptId: string): Promise<RatingAnalytics> {
    this.ensureInitialized();

    try {
      logger.debug('Getting prompt rating analytics', { promptId });

      const ratings = await this.fileRatingSystem.getPromptRatings(promptId);
      const aggregation = await this.fileRatingSystem.getRatingAggregation(promptId);

      // Calculate rating trends (group by day)
      const trendMap = new Map<string, { scores: number[]; count: number }>();
      
      for (const rating of ratings) {
        const date = new Date(rating.created_at).toISOString().split('T')[0];
        if (date && !trendMap.has(date)) {
          trendMap.set(date, { scores: [], count: 0 });
        }
        if (date) {
          const trend = trendMap.get(date)!;
          trend.scores.push(rating.score);
          trend.count++;
        }
      }

      const ratingTrends = Array.from(trendMap.entries())
        .map(([date, data]) => ({
          date,
          averageScore: data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length,
          count: data.count
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Get recent ratings (last 10) and enrich with usernames
      const recentRatingsRaw = ratings.slice(0, 10);
      const enrichedRecentRatings = await this.enrichRatingsWithUsernames(recentRatingsRaw);
      const recentRatings = enrichedRecentRatings.map(rating => this.mapRatingToFrontend(rating));

      // Get top rated versions
      const versionMap = new Map<number, { scores: number[]; count: number }>();
      
      for (const rating of ratings) {
        if (rating.prompt_version !== undefined) {
          const version = rating.prompt_version;
          if (!versionMap.has(version)) {
            versionMap.set(version, { scores: [], count: 0 });
          }
          const versionData = versionMap.get(version)!;
          versionData.scores.push(rating.score);
          versionData.count++;
        }
      }

      const topRatedVersions = Array.from(versionMap.entries())
        .map(([version, data]) => ({
          version,
          averageScore: data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length,
          totalRatings: data.count
        }))
        .sort((a, b) => b.averageScore - a.averageScore);

      return {
        promptId,
        totalRatings: aggregation.total_ratings,
        averageScore: aggregation.average_score,
        scoreDistribution: aggregation.score_distribution,
        ratingTrends,
        recentRatings,
        topRatedVersions
      };
    } catch (error) {
      logger.error('Failed to get prompt rating analytics:', error);
      throw new ServiceUnavailableError('Failed to get prompt rating analytics');
    }
  }

  /**
   * Get system-wide rating statistics
   */
  async getSystemRatingStats(): Promise<SystemRatingStats> {
    this.ensureInitialized();

    try {
      logger.debug('Getting system rating statistics');

      const promptLibraryService = getPromptLibraryService();
      const prompts = await promptLibraryService.listPrompts();

      let totalRatings = 0;
      let totalScore = 0;
      const ratingsByScore: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const promptRatings: Array<{
        promptId: string;
        title: string;
        averageScore: number;
        totalRatings: number;
      }> = [];
      const allRecentRatings: Array<{
        promptId: string;
        title: string;
        userId: string;
        score: number;
        timestamp: string;
      }> = [];

      // Collect data from all prompts
      for (const prompt of prompts) {
        try {
          const ratings = await this.fileRatingSystem.getPromptRatings(prompt.id);
          const aggregation = await this.fileRatingSystem.getRatingAggregation(prompt.id);

          if (aggregation.total_ratings > 0) {
            totalRatings += aggregation.total_ratings;
            totalScore += aggregation.average_score * aggregation.total_ratings;

            // Update score distribution
            for (const [score, count] of Object.entries(aggregation.score_distribution)) {
              const scoreNum = parseInt(score);
              if (ratingsByScore[scoreNum] !== undefined) {
                ratingsByScore[scoreNum] += count;
              }
            }

            promptRatings.push({
              promptId: prompt.id,
              title: prompt.metadata.title,
              averageScore: aggregation.average_score,
              totalRatings: aggregation.total_ratings
            });

            // Collect recent ratings with usernames
            const recentRatingsRaw = ratings.slice(0, 5);
            const enrichedRecentRatings = await this.enrichRatingsWithUsernames(recentRatingsRaw);
            const recentRatings = enrichedRecentRatings.map(rating => ({
              promptId: prompt.id,
              title: prompt.metadata.title,
              userId: rating.user_id,
              username: rating.username,
              score: rating.score,
              timestamp: rating.created_at
            }));
            allRecentRatings.push(...recentRatings);
          }
        } catch (error) {
          // Skip prompts that have issues
          logger.warn('Failed to get ratings for prompt', { promptId: prompt.id, error });
        }
      }

      // Sort and limit results
      const topRatedPrompts = promptRatings
        .sort((a, b) => b.averageScore - a.averageScore)
        .slice(0, 10);

      const recentActivity = allRecentRatings
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20);

      // Calculate system trends (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const trendMap = new Map<string, { totalRatings: number; totalScore: number }>();
      
      for (const activity of allRecentRatings) {
        const activityDate = new Date(activity.timestamp);
        if (activityDate >= thirtyDaysAgo) {
          const date = activityDate.toISOString().split('T')[0];
          if (date && !trendMap.has(date)) {
            trendMap.set(date, { totalRatings: 0, totalScore: 0 });
          }
          if (date) {
            const trend = trendMap.get(date)!;
            trend.totalRatings++;
            trend.totalScore += activity.score;
          }
        }
      }

      const ratingTrends = Array.from(trendMap.entries())
        .map(([date, data]) => ({
          date,
          totalRatings: data.totalRatings,
          averageScore: data.totalRatings > 0 ? data.totalScore / data.totalRatings : 0
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalRatings,
        averageScore: totalRatings > 0 ? totalScore / totalRatings : 0,
        ratingsByScore,
        topRatedPrompts,
        recentActivity,
        ratingTrends
      };
    } catch (error) {
      logger.error('Failed to get system rating statistics:', error);
      throw new ServiceUnavailableError('Failed to get system rating statistics');
    }
  }

  /**
   * Get user's rating for a specific prompt
   */
  async getUserRating(promptId: string, userId: string): Promise<Rating | null> {
    this.ensureInitialized();

    try {
      logger.debug('Getting user rating', { promptId, userId });
      return await this.fileRatingSystem.getUserRating(promptId, userId);
    } catch (error) {
      logger.error('Failed to get user rating:', error);
      throw new ServiceUnavailableError('Failed to get user rating');
    }
  }

  /**
   * Update an existing rating
   */
  async updateRating(ratingId: string, updates: {
    score?: number;
    note?: string;
  }): Promise<void> {
    this.ensureInitialized();

    try {
      logger.info('Updating rating', { ratingId, updates });
      await this.fileRatingSystem.updateRating(ratingId, updates);
      logger.info('Rating updated successfully', { ratingId });
    } catch (error) {
      logger.error('Failed to update rating:', error);
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new ServiceUnavailableError('Failed to update rating');
    }
  }

  /**
   * Delete a rating
   */
  async deleteRating(ratingId: string): Promise<void> {
    this.ensureInitialized();

    try {
      logger.info('Deleting rating', { ratingId });
      await this.fileRatingSystem.deleteRating(ratingId);
      logger.info('Rating deleted successfully', { ratingId });
    } catch (error) {
      logger.error('Failed to delete rating:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceUnavailableError('Failed to delete rating');
    }
  }

  /**
   * Filter prompts by rating criteria
   */
  async filterPromptsByRating(filters: PromptRatingFilters): Promise<Array<{
    promptId: string;
    title: string;
    averageScore: number;
    totalRatings: number;
    tags: string[];
  }>> {
    this.ensureInitialized();

    try {
      logger.debug('Filtering prompts by rating', { filters });

      const promptLibraryService = getPromptLibraryService();
      const prompts = await promptLibraryService.listPrompts();

      const results: Array<{
        promptId: string;
        title: string;
        averageScore: number;
        totalRatings: number;
        tags: string[];
      }> = [];

      for (const prompt of prompts) {
        try {
          const aggregation = await this.fileRatingSystem.getRatingAggregation(prompt.id);
          
          // Apply filters
          let include = true;
          
          if (filters.minRating !== undefined && aggregation.average_score < filters.minRating) {
            include = false;
          }
          
          if (filters.maxRating !== undefined && aggregation.average_score > filters.maxRating) {
            include = false;
          }
          
          if (filters.minRatingCount !== undefined && aggregation.total_ratings < filters.minRatingCount) {
            include = false;
          }

          if (include) {
            results.push({
              promptId: prompt.id,
              title: prompt.metadata.title,
              averageScore: aggregation.average_score,
              totalRatings: aggregation.total_ratings,
              tags: prompt.metadata.tags
            });
          }
        } catch (error) {
          // Skip prompts that have issues
          logger.warn('Failed to get rating aggregation for prompt', { promptId: prompt.id, error });
        }
      }

      // Sort by rating if requested
      if (filters.sortByRating) {
        results.sort((a, b) => b.averageScore - a.averageScore);
      }

      return results;
    } catch (error) {
      logger.error('Failed to filter prompts by rating:', error);
      throw new ServiceUnavailableError('Failed to filter prompts by rating');
    }
  }

  /**
   * Log a prompt run/usage
   */
  async logRun(runLog: {
    promptId: string;
    userId: string;
    provider: string;
    model: string;
    success: boolean;
    outcomeNote?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    this.ensureInitialized();

    try {
      logger.info('Logging prompt run', { promptId: runLog.promptId, provider: runLog.provider });
      
      const logInput: {
        prompt_id: string;
        user_id: string;
        provider: string;
        model: string;
        success: boolean;
        outcome_note?: string;
        metadata?: Record<string, any>;
      } = {
        prompt_id: runLog.promptId,
        user_id: runLog.userId,
        provider: runLog.provider,
        model: runLog.model,
        success: runLog.success
      };
      
      if (runLog.outcomeNote) {
        logInput.outcome_note = runLog.outcomeNote;
      }
      
      if (runLog.metadata) {
        logInput.metadata = runLog.metadata;
      }

      await this.fileRatingSystem.logRun(logInput);

      logger.info('Prompt run logged successfully', { promptId: runLog.promptId });
    } catch (error) {
      logger.error('Failed to log prompt run:', error);
      throw new ServiceUnavailableError('Failed to log prompt run');
    }
  }

  /**
   * Get run history for a prompt
   */
  async getRunHistory(promptId: string): Promise<RunLog[]> {
    this.ensureInitialized();

    try {
      logger.debug('Getting run history', { promptId });
      return await this.fileRatingSystem.getRunHistory(promptId);
    } catch (error) {
      logger.error('Failed to get run history:', error);
      throw new ServiceUnavailableError('Failed to get run history');
    }
  }

  /**
   * Get comprehensive prompt analytics including ratings and runs
   */
  async getPromptAnalytics(promptId: string): Promise<{
    ratings: RatingAggregation;
    runs: {
      total_runs: number;
      success_rate: number;
      provider_distribution: Record<string, number>;
      model_distribution: Record<string, number>;
    };
    version_ratings: Record<number, RatingAggregation>;
  }> {
    this.ensureInitialized();

    try {
      logger.debug('Getting comprehensive prompt analytics', { promptId });
      
      const [ratings, runHistory] = await Promise.all([
        this.fileRatingSystem.getRatingAggregation(promptId),
        this.fileRatingSystem.getRunHistory(promptId)
      ]);

      // Calculate run statistics
      const totalRuns = runHistory.length;
      const successfulRuns = runHistory.filter(run => run.success).length;
      const successRate = totalRuns > 0 ? successfulRuns / totalRuns : 0;

      const providerDistribution: Record<string, number> = {};
      const modelDistribution: Record<string, number> = {};

      for (const run of runHistory) {
        providerDistribution[run.provider] = (providerDistribution[run.provider] || 0) + 1;
        modelDistribution[run.model] = (modelDistribution[run.model] || 0) + 1;
      }

      // Get ratings by version
      const allRatings = await this.fileRatingSystem.getPromptRatings(promptId);
      const versions = [...new Set(allRatings.map(r => r.prompt_version).filter(v => v !== undefined))];
      
      const versionRatings: Record<number, RatingAggregation> = {};
      for (const version of versions) {
        const versionRatingsList = allRatings.filter(r => r.prompt_version === version);
        
        if (versionRatingsList.length > 0) {
          const scoreDistribution: Record<number, number> = {};
          let sum = 0;

          for (const rating of versionRatingsList) {
            sum += rating.score;
            scoreDistribution[rating.score] = (scoreDistribution[rating.score] || 0) + 1;
          }

          versionRatings[version] = {
            prompt_id: promptId,
            average_score: Math.round((sum / versionRatingsList.length) * 100) / 100,
            total_ratings: versionRatingsList.length,
            score_distribution: scoreDistribution,
            latest_rating_date: versionRatingsList[0]?.created_at || ''
          };
        }
      }

      return {
        ratings,
        runs: {
          total_runs: totalRuns,
          success_rate: successRate,
          provider_distribution: providerDistribution,
          model_distribution: modelDistribution
        },
        version_ratings: versionRatings
      };
    } catch (error) {
      logger.error('Failed to get prompt analytics:', error);
      throw new ServiceUnavailableError('Failed to get prompt analytics');
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Shutting down Rating Service...');
      this.isInitialized = false;
      logger.info('Rating Service shut down successfully');
    }
  }
}

// Singleton instance for the API
let ratingService: RatingService | null = null;

/**
 * Get the singleton instance of the rating service
 */
export function getRatingService(): RatingService {
  if (!ratingService) {
    ratingService = new RatingService();
  }
  return ratingService;
}

/**
 * Initialize the rating service
 */
export async function initializeRatingService(config?: { storageDir?: string }): Promise<void> {
  if (ratingService) {
    await ratingService.shutdown();
  }
  
  ratingService = new RatingService(config);
  await ratingService.initialize();
}