import { EventEmitter } from 'events';
import { EnhancementResult } from './prompt-library-service.js';
import { logger } from '../utils/logger.js';
import { WebSocketService } from './websocket-service.js';

// Enhancement job status types
export interface EnhancementJob {
  id: string;
  promptId: string;
  userId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: number;
  message: string;
  createdAt: Date;
  updatedAt: Date;
  result?: EnhancementResult;
  error?: string;
}

export interface EnhancementProgress {
  jobId: string;
  status: EnhancementJob['status'];
  progress: number;
  message: string;
  result?: EnhancementResult | undefined;
  error?: string | undefined;
}

export interface QuestionnaireResponse {
  jobId: string;
  responses: Record<string, any>;
  answers: Record<string, any>;
}

export class EnhancementWorkflowService extends EventEmitter {
  private jobs = new Map<string, EnhancementJob>();
  private jobCounter = 0;
  private webSocketService: WebSocketService;

  constructor(webSocketService: WebSocketService) {
    super();
    this.webSocketService = webSocketService;
  }

  // ... (other methods remain the same)

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
    
    // Notify WebSocket service for real-time updates
    if (status === 'completed') {
      this.webSocketService.notifyEnhancementCompleted(jobId, job.promptId, result);
    } else if (status === 'failed') {
      this.webSocketService.notifyEnhancementFailed(jobId, job.promptId, error || 'Unknown error');
    }
    
    logger.debug('Enhancement job status updated', { 
      jobId, 
      status, 
      progress, 
      message: message.substring(0, 100) 
    });
  }

  /**
   * Start enhancement process for a prompt
   */
  async startEnhancement(promptId: string, userId: string, value: any): Promise<string> {
    const jobId = `enhancement_${Date.now()}_${++this.jobCounter}`;
    
    const job: EnhancementJob = {
      id: jobId,
      promptId,
      userId,
      status: 'pending',
      progress: 0,
      message: 'Enhancement job created',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.jobs.set(jobId, job);
    
    // Start the enhancement process asynchronously
    this.processEnhancement(jobId, value).catch(error => {
      logger.error('Enhancement process failed', { jobId, error });
      this.updateJobStatus(jobId, 'failed', 0, 'Enhancement failed', undefined, error.message);
    });

    return jobId;
  }

  /**
   * Get all jobs for a specific user
   */
  getUserJobs(userId: string): EnhancementJob[] {
    return Array.from(this.jobs.values()).filter(job => job.userId === userId);
  }

  /**
   * Get enhancement status for a specific job
   */
  getEnhancementStatus(jobId: string): EnhancementProgress | null {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }

    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      result: job.result,
      error: job.error
    };
  }

  /**
   * Submit questionnaire response
   */
  async submitQuestionnaireResponse(response: QuestionnaireResponse): Promise<void> {
    const job = this.jobs.get(response.jobId);
    if (!job) {
      throw new Error(`Job ${response.jobId} not found`);
    }

    // Process the questionnaire response
    this.updateJobStatus(response.jobId, 'in-progress', 50, 'Processing questionnaire response');
    
    // Simulate processing
    setTimeout(() => {
      this.updateJobStatus(response.jobId, 'completed', 100, 'Enhancement completed');
    }, 2000);
  }

  /**
   * Process enhancement job
   */
  private async processEnhancement(jobId: string, value: any): Promise<void> {
    this.updateJobStatus(jobId, 'in-progress', 10, 'Starting enhancement process');
    
    try {
      // Simulate enhancement process
      this.updateJobStatus(jobId, 'in-progress', 30, 'Analyzing prompt structure');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.updateJobStatus(jobId, 'in-progress', 60, 'Generating enhancements');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.updateJobStatus(jobId, 'in-progress', 90, 'Finalizing results');
      
      const result: EnhancementResult = {
        structuredPrompt: {
          schema_version: 1,
          system: [`Enhanced: ${value}`],
          capabilities: ['enhanced-reasoning'],
          user_template: 'Enhanced user template',
          rules: [{ name: 'enhancement', description: 'Enhanced for better performance' }],
          variables: []
        },
        questions: [],
        rationale: 'Enhanced prompt for better performance',
        confidence: 0.9,
        changes_made: ['Enhanced prompt structure'],
        enhancement_model: 'gpt-4',
        enhancement_provider: 'openai'
      };
      
      this.updateJobStatus(jobId, 'completed', 100, 'Enhancement completed successfully', result);
      
    } catch (error) {
      logger.error('Enhancement processing failed', { jobId, error });
      this.updateJobStatus(jobId, 'failed', 0, 'Enhancement failed', undefined, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Clean up old completed jobs
   */
  public cleanupOldJobs(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [jobId, job] of this.jobs.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') && job.updatedAt < cutoffTime) {
        this.jobs.delete(jobId);
        logger.debug('Cleaned up old enhancement job', { jobId });
      }
    }
  }
}

// Singleton instance
let enhancementWorkflowService: EnhancementWorkflowService | null = null;

/**
 * Get the singleton instance of the enhancement workflow service
 */
export function getEnhancementWorkflowService(webSocketService: WebSocketService): EnhancementWorkflowService {
  if (!enhancementWorkflowService) {
    enhancementWorkflowService = new EnhancementWorkflowService(webSocketService);
    
    // Set up periodic cleanup of old jobs
    setInterval(() => {
      enhancementWorkflowService?.cleanupOldJobs();
    }, 60 * 60 * 1000); // Clean up every hour
  }
  return enhancementWorkflowService;
}