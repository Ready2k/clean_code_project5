import { EventEmitter } from 'events';
import { EnhancementResult, getPromptLibraryService } from './prompt-library-service.js';
import { logger } from '../utils/logger.js';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../types/errors.js';

export interface EnhancementJob {
  id: string;
  promptId: string;
  userId: string;
  status: 'pending' | 'analyzing' | 'enhancing' | 'generating_questions' | 'complete' | 'failed';
  progress: number;
  message: string;
  result?: EnhancementResult;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  options?: {
    preserve_style?: boolean;
    target_provider?: string;
  } | undefined;
}

export interface EnhancementProgress {
  jobId: string;
  promptId: string;
  status: EnhancementJob['status'];
  progress: number;
  message: string;
  result?: EnhancementResult;
  error?: string;
}

export interface QuestionnaireResponse {
  jobId: string;
  answers: Record<string, any>;
}

/**
 * Service for managing AI enhancement workflows with progress tracking
 */
export class EnhancementWorkflowService extends EventEmitter {
  private jobs = new Map<string, EnhancementJob>();
  private jobCounter = 0;

  constructor() {
    super();
  }

  /**
   * Start an enhancement job for a prompt
   */
  async startEnhancement(
    promptId: string,
    userId: string,
    options?: {
      preserve_style?: boolean;
      target_provider?: string;
    }
  ): Promise<string> {
    const jobId = this.generateJobId();
    
    const job: EnhancementJob = {
      id: jobId,
      promptId,
      userId,
      status: 'pending',
      progress: 0,
      message: 'Enhancement job queued',
      createdAt: new Date(),
      updatedAt: new Date(),
      options: options || undefined
    };

    this.jobs.set(jobId, job);
    
    logger.info('Enhancement job started', { jobId, promptId, userId });

    // Start the enhancement process asynchronously
    this.processEnhancement(jobId).catch(error => {
      logger.error('Enhancement job failed', { jobId, error });
      this.updateJobStatus(jobId, 'failed', 0, `Enhancement failed: ${error.message}`, undefined, error.message);
    });

    return jobId;
  }

  /**
   * Get the status of an enhancement job
   */
  getEnhancementStatus(jobId: string): EnhancementProgress | null {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    return {
      jobId: job.id,
      promptId: job.promptId,
      status: job.status,
      progress: job.progress,
      message: job.message,
      result: job.result,
      error: job.error
    } as EnhancementProgress;
  }

  /**
   * Get all jobs for a user
   */
  getUserJobs(userId: string): EnhancementProgress[] {
    const userJobs = Array.from(this.jobs.values())
      .filter(job => job.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return userJobs.map(job => ({
      jobId: job.id,
      promptId: job.promptId,
      status: job.status,
      progress: job.progress,
      message: job.message,
      result: job.result,
      error: job.error
    } as EnhancementProgress));
  }

  /**
   * Submit questionnaire responses for an enhancement job
   */
  async submitQuestionnaireResponse(response: QuestionnaireResponse): Promise<void> {
    const job = this.jobs.get(response.jobId);
    if (!job) {
      throw new NotFoundError(`Enhancement job ${response.jobId} not found`);
    }

    if (job.status !== 'generating_questions') {
      throw new ValidationError('Job is not in a state that accepts questionnaire responses');
    }

    logger.info('Questionnaire response submitted', { jobId: response.jobId, answers: Object.keys(response.answers) });

    try {
      // Update job status
      this.updateJobStatus(response.jobId, 'enhancing', 75, 'Processing questionnaire responses...');

      // Process the answers and complete the enhancement
      // In a real implementation, this would integrate the answers into the enhancement process
      await this.completeEnhancementWithAnswers(response.jobId, response.answers);

    } catch (error) {
      logger.error('Failed to process questionnaire response', { jobId: response.jobId, error });
      this.updateJobStatus(response.jobId, 'failed', 0, 'Failed to process questionnaire response', undefined, error instanceof Error ? error.message : 'Unknown error');
      throw new ServiceUnavailableError('Failed to process questionnaire response');
    }
  }

  /**
   * Cancel an enhancement job
   */
  cancelEnhancement(jobId: string, userId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.userId !== userId) {
      throw new ValidationError('Cannot cancel job belonging to another user');
    }

    if (job.status === 'complete' || job.status === 'failed') {
      return false; // Already finished
    }

    this.updateJobStatus(jobId, 'failed', 0, 'Enhancement cancelled by user', undefined, 'Cancelled by user');
    logger.info('Enhancement job cancelled', { jobId, userId });
    
    return true;
  }

  /**
   * Clean up old completed jobs
   */
  cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): number { // Default 24 hours
    const cutoff = new Date(Date.now() - maxAge);
    let cleaned = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if ((job.status === 'complete' || job.status === 'failed') && job.updatedAt < cutoff) {
        this.jobs.delete(jobId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up old enhancement jobs', { count: cleaned });
    }

    return cleaned;
  }

  /**
   * Process an enhancement job
   */
  private async processEnhancement(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      // Step 1: Analyzing
      this.updateJobStatus(jobId, 'analyzing', 25, 'Analyzing prompt structure...');
      await this.delay(1000); // Simulate processing time

      // Step 2: Enhancing
      this.updateJobStatus(jobId, 'enhancing', 50, 'Enhancing prompt with AI...');
      
      const promptLibraryService = getPromptLibraryService();
      const result = await promptLibraryService.enhancePrompt(job.promptId, job.options);

      // Step 3: Check if questions need to be generated
      if (result.questions && result.questions.length > 0) {
        this.updateJobStatus(jobId, 'generating_questions', 75, 'Generated questions for missing information', result);
        // Job will wait for questionnaire response
        return;
      }

      // Step 4: Complete
      this.updateJobStatus(jobId, 'complete', 100, 'Enhancement completed successfully', result);

    } catch (error) {
      logger.error('Enhancement processing failed', { jobId, error });
      this.updateJobStatus(jobId, 'failed', 0, 'Enhancement failed', undefined, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Complete enhancement with questionnaire answers
   */
  private async completeEnhancementWithAnswers(jobId: string, _answers: Record<string, any>): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || !job.result) {
      throw new Error('Invalid job state for completing with answers');
    }

    // In a real implementation, this would:
    // 1. Apply the answers to the variables in the enhanced prompt
    // 2. Re-run any necessary processing
    // 3. Update the structured prompt with the new variable values

    // For now, we'll simulate this by updating the result
    const updatedResult: EnhancementResult = {
      ...job.result,
      questions: [], // Clear questions since they've been answered
      rationale: job.result.rationale + ' User provided additional context through questionnaire responses.'
    };

    this.updateJobStatus(jobId, 'complete', 100, 'Enhancement completed with user input', updatedResult);
  }

  /**
   * Update job status and emit progress event
   */
  private updateJobStatus(
    jobId: string,
    status: EnhancementJob['status'],
    progress: number,
    message: string,
    result?: EnhancementResult,
    error?: string
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.status = status;
    job.progress = progress;
    job.message = message;
    job.updatedAt = new Date();
    
    if (result) {
      job.result = result;
    }
    
    if (error) {
      job.error = error;
    }

    // Emit progress event for real-time updates
    const progressData = {
      jobId: job.id,
      promptId: job.promptId,
      status: job.status,
      progress: job.progress,
      message: job.message,
      result: job.result,
      error: job.error
    } as EnhancementProgress;

    this.emit('progress', progressData);
    
    logger.debug('Enhancement job status updated', { 
      jobId, 
      status, 
      progress, 
      message: message.substring(0, 100) 
    });
  }

  /**
   * Generate a unique job ID
   */
  private generateJobId(): string {
    this.jobCounter++;
    return `enhancement_${Date.now()}_${this.jobCounter}`;
  }

  /**
   * Utility method to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    jobsByStatus: Record<string, number>;
  } {
    const jobs = Array.from(this.jobs.values());
    const jobsByStatus: Record<string, number> = {};
    
    for (const job of jobs) {
      jobsByStatus[job.status] = (jobsByStatus[job.status] || 0) + 1;
    }

    return {
      totalJobs: jobs.length,
      activeJobs: jobs.filter(j => !['complete', 'failed'].includes(j.status)).length,
      completedJobs: jobs.filter(j => j.status === 'complete').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
      jobsByStatus
    };
  }
}

// Singleton instance
let enhancementWorkflowService: EnhancementWorkflowService | null = null;

/**
 * Get the singleton instance of the enhancement workflow service
 */
export function getEnhancementWorkflowService(): EnhancementWorkflowService {
  if (!enhancementWorkflowService) {
    enhancementWorkflowService = new EnhancementWorkflowService();
    
    // Set up periodic cleanup of old jobs
    setInterval(() => {
      enhancementWorkflowService?.cleanupOldJobs();
    }, 60 * 60 * 1000); // Clean up every hour
  }
  return enhancementWorkflowService;
}