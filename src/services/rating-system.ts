// Rating System interface - Prompt evaluation and feedback collection

import { Rating, RunLog, RatingAggregation } from '../models/rating';
import { PromptRecord } from '../models/prompt';

export interface RatingSystem {
  /**
   * Rate a prompt
   */
  ratePrompt(promptId: string, userId: string, rating: Omit<Rating, 'id' | 'created_at'>): Promise<void>;

  /**
   * Get all ratings for a prompt
   */
  getPromptRatings(promptId: string): Promise<Rating[]>;

  /**
   * Get average rating for a prompt
   */
  getAverageRating(promptId: string): Promise<number>;

  /**
   * Get top-rated prompts
   */
  getTopRatedPrompts(limit: number): Promise<PromptRecord[]>;

  /**
   * Log a prompt run/usage
   */
  logRun(runLog: Omit<RunLog, 'id' | 'created_at'>): Promise<void>;

  /**
   * Get run history for a prompt
   */
  getRunHistory(promptId: string): Promise<RunLog[]>;

  /**
   * Get rating aggregation data
   */
  getRatingAggregation(promptId: string): Promise<RatingAggregation>;

  /**
   * Get user's rating for a prompt
   */
  getUserRating(promptId: string, userId: string): Promise<Rating | null>;

  /**
   * Update an existing rating
   */
  updateRating(ratingId: string, updates: Partial<Rating>): Promise<void>;

  /**
   * Delete a rating
   */
  deleteRating(ratingId: string): Promise<void>;

  /**
   * Get rating aggregation across all versions of a prompt
   */
  getPromptRatingAggregationAllVersions(promptId: string): Promise<RatingAggregation>;

  /**
   * Get rating aggregation for a specific prompt version
   */
  getPromptVersionRatingAggregation(promptId: string, version: number): Promise<RatingAggregation>;

  /**
   * Get run statistics for a prompt
   */
  getRunStatistics(promptId: string): Promise<{
    total_runs: number;
    success_rate: number;
    provider_distribution: Record<string, number>;
    model_distribution: Record<string, number>;
    recent_runs: RunLog[];
  }>;

  /**
   * Get comprehensive prompt analytics
   */
  getPromptAnalytics(promptId: string): Promise<{
    ratings: RatingAggregation;
    runs: {
      total_runs: number;
      success_rate: number;
      provider_distribution: Record<string, number>;
      model_distribution: Record<string, number>;
    };
    version_ratings: Record<number, RatingAggregation>;
  }>;
}