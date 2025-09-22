import { AppError, ErrorType, RetryConfig, DEFAULT_RETRY_CONFIG } from '../types/errors';

export class RetryMechanism {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  async execute<T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T> {
    let lastError: AppError | Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Log successful retry if this wasn't the first attempt
        if (attempt > 0) {
          console.log(`Operation succeeded after ${attempt} retries`, { context });
        }
        
        return result;
      } catch (error) {
        lastError = error as AppError | Error;
        
        // Don't retry on the last attempt
        if (attempt === this.config.maxRetries) {
          break;
        }

        // Check if error is retryable
        if (!this.shouldRetry(lastError)) {
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt);
        
        console.warn(`Operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries})`, {
          context,
          error: lastError.message
        });

        // Wait before retrying
        await this.delay(delay);
      }
    }

    // All retries exhausted, throw the last error
    throw lastError!;
  }

  private shouldRetry(error: AppError | Error): boolean {
    if (error instanceof AppError) {
      return this.config.retryableErrors.includes(error.type);
    }

    // For generic errors, only retry network-related errors
    return error.name === 'TypeError' || error.message.includes('fetch');
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffFactor, attempt);
    const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // Add jitter
    return Math.min(jitteredDelay, this.config.maxDelay);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance for global use
export const globalRetryMechanism = new RetryMechanism();

// Utility function for one-off retries
export async function withRetry<T>(
  operation: () => Promise<T>,
  config?: Partial<RetryConfig>,
  context?: string
): Promise<T> {
  const retryMechanism = new RetryMechanism(config);
  return retryMechanism.execute(operation, context);
}

// Hook for React components
export function useRetry(config?: Partial<RetryConfig>) {
  const retryMechanism = new RetryMechanism(config);
  
  return {
    execute: <T>(operation: () => Promise<T>, context?: string) => 
      retryMechanism.execute(operation, context),
    
    executeWithState: async <T>(
      operation: () => Promise<T>,
      setLoading: (loading: boolean) => void,
      setError: (error: AppError | null) => void,
      context?: string
    ): Promise<T | null> => {
      try {
        setLoading(true);
        setError(null);
        const result = await retryMechanism.execute(operation, context);
        return result;
      } catch (error) {
        const appError = error instanceof AppError ? error : new AppError(
          ErrorType.UNKNOWN_ERROR,
          error instanceof Error ? error.message : 'Unknown error occurred'
        );
        setError(appError);
        return null;
      } finally {
        setLoading(false);
      }
    }
  };
}