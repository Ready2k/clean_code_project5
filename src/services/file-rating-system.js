// File-based Rating System implementation
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as YAML from 'yaml';
export class FileRatingSystem {
    ratingsDir;
    runLogsDir;
    constructor(baseDir = './data') {
        this.ratingsDir = path.join(baseDir, 'ratings');
        this.runLogsDir = path.join(baseDir, 'run-logs');
    }
    /**
     * Initialize the rating system directories
     */
    async initialize() {
        await fs.mkdir(this.ratingsDir, { recursive: true });
        await fs.mkdir(this.runLogsDir, { recursive: true });
    }
    /**
     * Rate a prompt
     */
    async ratePrompt(promptId, userId, rating) {
        // Validate rating score
        if (rating.score < 1 || rating.score > 5) {
            throw new Error('Rating score must be between 1 and 5');
        }
        // Check if user already rated this prompt
        const existingRating = await this.getUserRating(promptId, userId);
        const ratingData = {
            id: existingRating?.id || uuidv4(),
            prompt_id: promptId,
            user_id: userId,
            score: rating.score,
            note: rating.note,
            created_at: new Date().toISOString(),
            prompt_version: rating.prompt_version
        };
        // Save rating to file
        const ratingFile = path.join(this.ratingsDir, `${ratingData.id}.yaml`);
        await fs.writeFile(ratingFile, YAML.stringify(ratingData));
    }
    /**
     * Get all ratings for a prompt
     */
    async getPromptRatings(promptId) {
        try {
            const files = await fs.readdir(this.ratingsDir);
            const ratings = [];
            for (const file of files) {
                if (file.endsWith('.yaml')) {
                    const filePath = path.join(this.ratingsDir, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const rating = YAML.parse(content);
                    if (rating.prompt_id === promptId) {
                        ratings.push(rating);
                    }
                }
            }
            // Sort by creation date (newest first)
            return ratings.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }
    /**
     * Get average rating for a prompt
     */
    async getAverageRating(promptId) {
        const ratings = await this.getPromptRatings(promptId);
        if (ratings.length === 0) {
            return 0;
        }
        const sum = ratings.reduce((acc, rating) => acc + rating.score, 0);
        return Math.round((sum / ratings.length) * 100) / 100;
    }
    /**
     * Get top-rated prompts (requires integration with prompt storage)
     */
    async getTopRatedPrompts(_limit) {
        // This would need integration with the prompt storage system
        // For now, return empty array as this requires cross-service coordination
        return [];
    }
    /**
     * Log a prompt run/usage
     */
    async logRun(runLog) {
        const logData = {
            id: uuidv4(),
            prompt_id: runLog.prompt_id,
            user_id: runLog.user_id,
            provider: runLog.provider,
            model: runLog.model,
            created_at: new Date().toISOString(),
            outcome_note: runLog.outcome_note,
            success: runLog.success,
            metadata: runLog.metadata
        };
        // Save run log to file
        const logFile = path.join(this.runLogsDir, `${logData.id}.yaml`);
        await fs.writeFile(logFile, YAML.stringify(logData));
    }
    /**
     * Get run history for a prompt
     */
    async getRunHistory(promptId) {
        try {
            const files = await fs.readdir(this.runLogsDir);
            const runLogs = [];
            for (const file of files) {
                if (file.endsWith('.yaml')) {
                    const filePath = path.join(this.runLogsDir, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const runLog = YAML.parse(content);
                    if (runLog.prompt_id === promptId) {
                        runLogs.push(runLog);
                    }
                }
            }
            // Sort by creation date (newest first)
            return runLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }
    /**
     * Get rating aggregation data
     */
    async getRatingAggregation(promptId) {
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
        // Calculate score distribution
        const scoreDistribution = {};
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
            latest_rating_date: ratings[0].created_at
        };
    }
    /**
     * Get user's rating for a prompt
     */
    async getUserRating(promptId, userId) {
        const ratings = await this.getPromptRatings(promptId);
        return ratings.find(rating => rating.user_id === userId) || null;
    }
    /**
     * Update an existing rating
     */
    async updateRating(ratingId, updates) {
        const ratingFile = path.join(this.ratingsDir, `${ratingId}.yaml`);
        try {
            const content = await fs.readFile(ratingFile, 'utf-8');
            const rating = YAML.parse(content);
            // Apply updates
            const updatedRating = {
                ...rating,
                ...updates,
                id: ratingId, // Ensure ID doesn't change
                created_at: rating.created_at // Preserve original creation date
            };
            // Validate score if being updated
            if (updates.score !== undefined && (updates.score < 1 || updates.score > 5)) {
                throw new Error('Rating score must be between 1 and 5');
            }
            await fs.writeFile(ratingFile, YAML.stringify(updatedRating));
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Rating with ID ${ratingId} not found`);
            }
            throw error;
        }
    }
    /**
     * Delete a rating
     */
    async deleteRating(ratingId) {
        const ratingFile = path.join(this.ratingsDir, `${ratingId}.yaml`);
        try {
            await fs.unlink(ratingFile);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Rating with ID ${ratingId} not found`);
            }
            throw error;
        }
    }
    /**
     * Get rating aggregation across all versions of a prompt
     */
    async getPromptRatingAggregationAllVersions(promptId) {
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
        // Calculate score distribution across all versions
        const scoreDistribution = {};
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
            latest_rating_date: ratings[0].created_at
        };
    }
    /**
     * Get rating aggregation for a specific prompt version
     */
    async getPromptVersionRatingAggregation(promptId, version) {
        const allRatings = await this.getPromptRatings(promptId);
        const versionRatings = allRatings.filter(rating => rating.prompt_version === version);
        if (versionRatings.length === 0) {
            return {
                prompt_id: promptId,
                average_score: 0,
                total_ratings: 0,
                score_distribution: {},
                latest_rating_date: ''
            };
        }
        // Calculate score distribution for specific version
        const scoreDistribution = {};
        let sum = 0;
        for (const rating of versionRatings) {
            sum += rating.score;
            scoreDistribution[rating.score] = (scoreDistribution[rating.score] || 0) + 1;
        }
        return {
            prompt_id: promptId,
            average_score: Math.round((sum / versionRatings.length) * 100) / 100,
            total_ratings: versionRatings.length,
            score_distribution: scoreDistribution,
            latest_rating_date: versionRatings[0].created_at
        };
    }
    /**
     * Get run statistics for a prompt
     */
    async getRunStatistics(promptId) {
        const runHistory = await this.getRunHistory(promptId);
        if (runHistory.length === 0) {
            return {
                total_runs: 0,
                success_rate: 0,
                provider_distribution: {},
                model_distribution: {},
                recent_runs: []
            };
        }
        const successfulRuns = runHistory.filter(run => run.success).length;
        const successRate = Math.round((successfulRuns / runHistory.length) * 100) / 100;
        // Calculate provider distribution
        const providerDistribution = {};
        const modelDistribution = {};
        for (const run of runHistory) {
            providerDistribution[run.provider] = (providerDistribution[run.provider] || 0) + 1;
            modelDistribution[run.model] = (modelDistribution[run.model] || 0) + 1;
        }
        // Get recent runs (last 10)
        const recentRuns = runHistory.slice(0, 10);
        return {
            total_runs: runHistory.length,
            success_rate: successRate,
            provider_distribution: providerDistribution,
            model_distribution: modelDistribution,
            recent_runs: recentRuns
        };
    }
    /**
     * Get comprehensive prompt analytics
     */
    async getPromptAnalytics(promptId) {
        const [ratings, runStats] = await Promise.all([
            this.getPromptRatingAggregationAllVersions(promptId),
            this.getRunStatistics(promptId)
        ]);
        // Get ratings by version
        const allRatings = await this.getPromptRatings(promptId);
        const versions = [...new Set(allRatings.map(r => r.prompt_version).filter(v => v !== undefined))];
        const versionRatings = {};
        for (const version of versions) {
            versionRatings[version] = await this.getPromptVersionRatingAggregation(promptId, version);
        }
        return {
            ratings,
            runs: {
                total_runs: runStats.total_runs,
                success_rate: runStats.success_rate,
                provider_distribution: runStats.provider_distribution,
                model_distribution: runStats.model_distribution
            },
            version_ratings: versionRatings
        };
    }
}
//# sourceMappingURL=file-rating-system.js.map