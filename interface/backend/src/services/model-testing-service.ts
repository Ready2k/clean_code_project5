/**
 * Model Testing Service
 * 
 * Handles model availability testing with actual API calls, capability verification,
 * and model performance benchmarking for dynamic providers.
 */

import { getProviderStorageService } from './provider-storage-service.js';
import { getModelStorageService } from './model-storage-service.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../types/errors.js';
import { 
  Provider, 
  Model,
  ModelTestResult,
  ModelCapabilities
} from '../types/dynamic-providers.js';

/**
 * Interface for model test configuration
 */
export interface ModelTestConfig {
  timeout?: number;
  retries?: number;
  testPrompt?: string;
  verifyCapabilities?: boolean;
  benchmarkPerformance?: boolean;
}

/**
 * Interface for model performance metrics
 */
export interface ModelPerformanceMetrics {
  responseTime: number;
  tokensPerSecond?: number;
  firstTokenLatency?: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Interface for capability verification result
 */
export interface CapabilityVerificationResult {
  verified: boolean;
  supportedCapabilities: Partial<ModelCapabilities>;
  unsupportedCapabilities: string[];
  warnings: string[];
}

/**
 * Model testing service for validating model availability and performance
 */
export class ModelTestingService {
  private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private static readonly DEFAULT_RETRIES = 2;
  private static readonly DEFAULT_TEST_PROMPT = "Hello, this is a test message. Please respond with 'Test successful'.";
  private static readonly BENCHMARK_ITERATIONS = 3;

  /**
   * Test model availability with actual API call
   */
  async testModelAvailability(
    modelId: string, 
    config: ModelTestConfig = {}
  ): Promise<ModelTestResult> {
    const startTime = Date.now();

    try {
      // Get model and provider information
      const model = await getModelStorageService().getModel(modelId);
      const provider = await getProviderStorageService().getProvider(model.providerId);

      logger.info('Starting model availability test', {
        modelId,
        providerId: provider.id,
        modelIdentifier: model.identifier,
        providerIdentifier: provider.identifier
      });

      // Perform the actual API test
      const testResult = await this.performModelApiTest(provider, model, config);

      // Update model test result in database if successful
      if (testResult.success) {
        await this.updateModelTestResult(modelId, testResult);
      }

      logger.info('Model availability test completed', {
        modelId,
        success: testResult.success,
        latency: testResult.latency,
        error: testResult.error
      });

      return testResult;

    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Model availability test failed', {
        modelId,
        error: errorMessage,
        latency
      });

      const testResult: ModelTestResult = {
        success: false,
        latency,
        error: errorMessage,
        testedAt: new Date()
      };

      // Try to update the test result even if the test failed
      try {
        await this.updateModelTestResult(modelId, testResult);
      } catch (updateError) {
        logger.warn('Failed to update model test result', { modelId, updateError });
      }

      return testResult;
    }
  }

  /**
   * Verify model capabilities against claimed capabilities
   */
  async verifyModelCapabilities(
    modelId: string,
    config: ModelTestConfig = {}
  ): Promise<CapabilityVerificationResult> {
    try {
      const model = await getModelStorageService().getModel(modelId);
      const provider = await getProviderStorageService().getProvider(model.providerId);

      logger.info('Starting model capability verification', {
        modelId,
        claimedCapabilities: model.capabilities
      });

      const verificationResult = await this.performCapabilityVerification(
        provider, 
        model, 
        config
      );

      logger.info('Model capability verification completed', {
        modelId,
        verified: verificationResult.verified,
        supportedCount: Object.keys(verificationResult.supportedCapabilities).length,
        unsupportedCount: verificationResult.unsupportedCapabilities.length
      });

      return verificationResult;

    } catch (error) {
      logger.error('Model capability verification failed', {
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        verified: false,
        supportedCapabilities: {},
        unsupportedCapabilities: ['verification_failed'],
        warnings: [`Capability verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Benchmark model performance
   */
  async benchmarkModelPerformance(
    modelId: string,
    config: ModelTestConfig = {}
  ): Promise<ModelPerformanceMetrics> {
    try {
      const model = await getModelStorageService().getModel(modelId);
      const provider = await getProviderStorageService().getProvider(model.providerId);

      logger.info('Starting model performance benchmark', {
        modelId,
        iterations: ModelTestingService.BENCHMARK_ITERATIONS
      });

      const metrics = await this.performPerformanceBenchmark(provider, model, config);

      logger.info('Model performance benchmark completed', {
        modelId,
        responseTime: metrics.responseTime,
        tokensPerSecond: metrics.tokensPerSecond
      });

      return metrics;

    } catch (error) {
      logger.error('Model performance benchmark failed', {
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Model performance benchmark failed',
        500,
        'MODEL_TEST_FAILED' as any
      );
    }
  }

  /**
   * Test multiple models for a provider
   */
  async testProviderModels(
    providerId: string,
    config: ModelTestConfig = {}
  ): Promise<Record<string, ModelTestResult>> {
    try {
      const { models } = await getModelStorageService().getProviderModels(providerId);
      const results: Record<string, ModelTestResult> = {};

      logger.info('Starting provider models test', {
        providerId,
        modelCount: models.length
      });

      // Test models in parallel with concurrency limit
      const concurrency = 3; // Limit concurrent tests to avoid rate limiting
      const chunks = this.chunkArray(models, concurrency);

      for (const chunk of chunks) {
        const chunkPromises = chunk.map(async (model) => {
          const result = await this.testModelAvailability(model.id, config);
          results[model.id] = result;
        });

        await Promise.all(chunkPromises);
      }

      const successCount = Object.values(results).filter(r => r.success).length;
      logger.info('Provider models test completed', {
        providerId,
        totalModels: models.length,
        successfulTests: successCount,
        failedTests: models.length - successCount
      });

      return results;

    } catch (error) {
      logger.error('Provider models test failed', {
        providerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Provider models test failed',
        500,
        'MODEL_TEST_FAILED' as any
      );
    }
  }

  /**
   * Perform actual API test for a model
   */
  private async performModelApiTest(
    provider: Provider,
    model: Model,
    config: ModelTestConfig
  ): Promise<ModelTestResult> {
    const startTime = Date.now();
    const timeout = config.timeout || ModelTestingService.DEFAULT_TIMEOUT;
    const retries = config.retries || ModelTestingService.DEFAULT_RETRIES;
    const testPrompt = config.testPrompt || ModelTestingService.DEFAULT_TEST_PROMPT;

    let lastError: Error | null = null;

    // Retry logic
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const authConfig = await getProviderStorageService().getDecryptedAuthConfig(provider.id);
        const apiResponse = await this.makeModelApiCall(
          provider,
          model,
          authConfig,
          testPrompt,
          timeout
        );

        const latency = Date.now() - startTime;

        // Parse response to extract actual capabilities if possible
        const result: ModelTestResult = {
          success: true,
          latency,
          testedAt: new Date()
        };

        if (config.verifyCapabilities) {
          result.actualCapabilities = this.extractCapabilitiesFromResponse(apiResponse);
        }

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < retries) {
          logger.warn('Model API test attempt failed, retrying', {
            providerId: provider.id,
            modelId: model.id,
            attempt: attempt + 1,
            error: lastError.message
          });
          
          // Wait before retry (exponential backoff)
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    const latency = Date.now() - startTime;
    return {
      success: false,
      latency,
      error: lastError?.message || 'Unknown error',
      testedAt: new Date()
    };
  }

  /**
   * Make actual API call to test model
   */
  private async makeModelApiCall(
    provider: Provider,
    model: Model,
    authConfig: any,
    testPrompt: string,
    timeout: number
  ): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Build request based on provider type and auth method
      const { url, headers, body } = this.buildApiRequest(
        provider,
        model,
        authConfig,
        testPrompt
      );

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseData = await response.json();
      return responseData;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`API call timed out after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Build API request for different provider types
   */
  private buildApiRequest(
    provider: Provider,
    model: Model,
    authConfig: any,
    testPrompt: string
  ): { url: string; headers: Record<string, string>; body: any } {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Add authentication headers based on auth method
    switch (provider.authMethod) {
      case 'api_key':
        if (provider.identifier.includes('openai') || provider.identifier.includes('gpt')) {
          headers['Authorization'] = `Bearer ${authConfig.fields.apiKey}`;
          if (authConfig.fields.organizationId) {
            headers['OpenAI-Organization'] = authConfig.fields.organizationId;
          }
        } else if (provider.identifier.includes('anthropic')) {
          headers['x-api-key'] = authConfig.fields.apiKey;
          headers['anthropic-version'] = '2023-06-01';
        } else {
          // Generic API key handling
          headers['Authorization'] = `Bearer ${authConfig.fields.apiKey}`;
        }
        break;

      case 'custom':
        // Apply custom headers from auth config
        if (authConfig.headers) {
          Object.assign(headers, authConfig.headers);
        }
        break;

      default:
        throw new Error(`Unsupported auth method for testing: ${provider.authMethod}`);
    }

    // Build request body based on provider type
    let body: any;
    let url = provider.apiEndpoint;

    if (provider.identifier.includes('openai') || provider.identifier.includes('gpt')) {
      // OpenAI format
      url = `${provider.apiEndpoint.replace(/\/$/, '')}/chat/completions`;
      body = {
        model: model.identifier,
        messages: [
          { role: 'user', content: testPrompt }
        ],
        max_tokens: 50,
        temperature: 0.1
      };
    } else if (provider.identifier.includes('anthropic')) {
      // Anthropic format
      url = `${provider.apiEndpoint.replace(/\/$/, '')}/messages`;
      body = {
        model: model.identifier,
        max_tokens: 50,
        messages: [
          { role: 'user', content: testPrompt }
        ]
      };
    } else {
      // Generic format (assume OpenAI-compatible)
      url = `${provider.apiEndpoint.replace(/\/$/, '')}/chat/completions`;
      body = {
        model: model.identifier,
        messages: [
          { role: 'user', content: testPrompt }
        ],
        max_tokens: 50,
        temperature: 0.1
      };
    }

    return { url, headers, body };
  }

  /**
   * Perform capability verification tests
   */
  private async performCapabilityVerification(
    provider: Provider,
    model: Model,
    config: ModelTestConfig
  ): Promise<CapabilityVerificationResult> {
    const supportedCapabilities: Partial<ModelCapabilities> = {};
    const unsupportedCapabilities: string[] = [];
    const warnings: string[] = [];

    try {
      // Test basic functionality first
      const basicTest = await this.performModelApiTest(provider, model, config);
      if (!basicTest.success) {
        return {
          verified: false,
          supportedCapabilities: {},
          unsupportedCapabilities: ['basic_functionality'],
          warnings: [`Basic API test failed: ${basicTest.error}`]
        };
      }

      // Test system message support if claimed
      if (model.capabilities.supportsSystemMessages) {
        try {
          await this.testSystemMessageSupport(provider, model);
          supportedCapabilities.supportsSystemMessages = true;
        } catch (error) {
          unsupportedCapabilities.push('supportsSystemMessages');
          warnings.push(`System message test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Test streaming support if claimed
      if (model.capabilities.supportsStreaming) {
        try {
          await this.testStreamingSupport(provider, model);
          supportedCapabilities.supportsStreaming = true;
        } catch (error) {
          unsupportedCapabilities.push('supportsStreaming');
          warnings.push(`Streaming test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Test tools/function calling if claimed
      if (model.capabilities.supportsTools || model.capabilities.supportsFunctionCalling) {
        try {
          await this.testToolsSupport(provider, model);
          supportedCapabilities.supportsTools = true;
          supportedCapabilities.supportsFunctionCalling = true;
        } catch (error) {
          unsupportedCapabilities.push('supportsTools', 'supportsFunctionCalling');
          warnings.push(`Tools/function calling test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Verify context length by testing with a long prompt
      try {
        const actualContextLength = await this.testContextLength(provider, model);
        supportedCapabilities.maxContextLength = actualContextLength;
        
        if (actualContextLength < model.capabilities.maxContextLength) {
          warnings.push(`Actual context length (${actualContextLength}) is less than claimed (${model.capabilities.maxContextLength})`);
        }
      } catch (error) {
        warnings.push(`Context length test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      const verified = unsupportedCapabilities.length === 0;

      return {
        verified,
        supportedCapabilities,
        unsupportedCapabilities,
        warnings
      };

    } catch (error) {
      return {
        verified: false,
        supportedCapabilities: {},
        unsupportedCapabilities: ['verification_error'],
        warnings: [`Capability verification error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Perform performance benchmark
   */
  private async performPerformanceBenchmark(
    provider: Provider,
    model: Model,
    config: ModelTestConfig
  ): Promise<ModelPerformanceMetrics> {
    const iterations = ModelTestingService.BENCHMARK_ITERATIONS;
    const responseTimes: number[] = [];
    let totalTokens = 0;
    let inputTokens = 0;
    let outputTokens = 0;

    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        const authConfig = await getProviderStorageService().getDecryptedAuthConfig(provider.id);
        const response = await this.makeModelApiCall(
          provider,
          model,
          authConfig,
          `Benchmark test ${i + 1}: Please provide a brief response about artificial intelligence.`,
          config.timeout || ModelTestingService.DEFAULT_TIMEOUT
        );

        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);

        // Extract token usage if available
        if (response.usage) {
          totalTokens += response.usage.total_tokens || 0;
          inputTokens += response.usage.prompt_tokens || 0;
          outputTokens += response.usage.completion_tokens || 0;
        }

      } catch (error) {
        logger.warn('Benchmark iteration failed', {
          iteration: i + 1,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Small delay between iterations
      if (i < iterations - 1) {
        await this.sleep(1000);
      }
    }

    if (responseTimes.length === 0) {
      throw new Error('All benchmark iterations failed');
    }

    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    const result: ModelPerformanceMetrics = {
      responseTime: averageResponseTime,
      totalTokens: totalTokens / iterations,
      inputTokens: inputTokens / iterations,
      outputTokens: outputTokens / iterations
    };

    if (outputTokens > 0) {
      result.tokensPerSecond = outputTokens / (averageResponseTime / 1000);
    }

    return result;
  }

  /**
   * Test system message support
   */
  private async testSystemMessageSupport(provider: Provider, model: Model): Promise<void> {
    const authConfig = await getProviderStorageService().getDecryptedAuthConfig(provider.id);
    
    // Build request with system message
    const { url, headers, body } = this.buildApiRequest(
      provider,
      model,
      authConfig,
      'What is your role?'
    );

    // Add system message to the request
    if (body.messages) {
      body.messages.unshift({
        role: 'system',
        content: 'You are a helpful assistant. Always start your response with "SYSTEM_TEST:"'
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`System message test failed: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    const content = this.extractResponseContent(responseData);
    
    if (!content.includes('SYSTEM_TEST:')) {
      throw new Error('System message was not properly processed');
    }
  }

  /**
   * Test streaming support
   */
  private async testStreamingSupport(provider: Provider, model: Model): Promise<void> {
    const authConfig = await getProviderStorageService().getDecryptedAuthConfig(provider.id);
    
    const { url, headers, body } = this.buildApiRequest(
      provider,
      model,
      authConfig,
      'Count from 1 to 5.'
    );

    // Enable streaming
    body.stream = true;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Streaming test failed: ${response.status} ${response.statusText}`);
    }

    // Check if response is actually streaming
    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    // Read first chunk to verify streaming works
    const reader = response.body.getReader();
    const { done, value } = await reader.read();
    
    if (done || !value) {
      throw new Error('Streaming response ended immediately');
    }

    reader.releaseLock();
  }

  /**
   * Test tools/function calling support
   */
  private async testToolsSupport(provider: Provider, model: Model): Promise<void> {
    const authConfig = await getProviderStorageService().getDecryptedAuthConfig(provider.id);
    
    const { url, headers, body } = this.buildApiRequest(
      provider,
      model,
      authConfig,
      'What is the current time?'
    );

    // Add function/tool definition
    if (provider.identifier.includes('openai')) {
      body.functions = [{
        name: 'get_current_time',
        description: 'Get the current time',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }];
    } else if (provider.identifier.includes('anthropic')) {
      body.tools = [{
        name: 'get_current_time',
        description: 'Get the current time',
        input_schema: {
          type: 'object',
          properties: {},
          required: []
        }
      }];
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Tools test failed: ${response.status} ${response.statusText}`);
    }

    // The test passes if the API accepts the request with tools
    // More sophisticated testing would check if the model actually calls the function
  }

  /**
   * Test context length by sending increasingly long prompts
   */
  private async testContextLength(provider: Provider, model: Model): Promise<number> {
    const authConfig = await getProviderStorageService().getDecryptedAuthConfig(provider.id);
    
    // Start with a reasonable test size (approximate token count)
    const testSizes = [1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000];
    let maxWorkingSize = 0;

    for (const size of testSizes) {
      if (size > model.capabilities.maxContextLength) {
        break;
      }

      try {
        // Generate a prompt of approximately the target size
        const testPrompt = 'Test '.repeat(Math.floor(size / 4)); // Rough token estimation
        
        const { url, headers, body } = this.buildApiRequest(
          provider,
          model,
          authConfig,
          testPrompt
        );

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        if (response.ok) {
          maxWorkingSize = size;
        } else {
          // If we get a context length error, we've found the limit
          break;
        }

      } catch (error) {
        // Context length exceeded or other error
        break;
      }
    }

    return maxWorkingSize || 1000; // Return at least 1000 if no tests passed
  }

  /**
   * Extract response content from API response
   */
  private extractResponseContent(response: any): string {
    // Handle different response formats
    if (response.choices && response.choices[0]) {
      return response.choices[0].message?.content || response.choices[0].text || '';
    }
    
    if (response.content) {
      return Array.isArray(response.content) ? response.content[0]?.text || '' : response.content;
    }

    return '';
  }

  /**
   * Extract capabilities from API response
   */
  private extractCapabilitiesFromResponse(response: any): Partial<ModelCapabilities> {
    const capabilities: Partial<ModelCapabilities> = {};

    // Basic inference: if we got a response, basic capabilities work
    if (response) {
      capabilities.supportsSystemMessages = true; // We'll test this separately
      capabilities.supportedRoles = ['user', 'assistant'];
    }

    // Check for streaming indicators
    if (response.object === 'chat.completion.chunk') {
      capabilities.supportsStreaming = true;
    }

    // Check for function calling indicators
    if (response.choices?.[0]?.message?.function_call || response.choices?.[0]?.message?.tool_calls) {
      capabilities.supportsTools = true;
      capabilities.supportsFunctionCalling = true;
    }

    return capabilities;
  }

  /**
   * Update model test result in database
   */
  private async updateModelTestResult(modelId: string, testResult: ModelTestResult): Promise<void> {
    // For now, we'll store the test result in the model record
    // In a more sophisticated implementation, we might have a separate test_results table
    
    // This is a placeholder - the actual implementation would depend on 
    // whether we want to store test results in the models table or a separate table
    logger.debug('Model test result recorded', {
      modelId,
      success: testResult.success,
      latency: testResult.latency
    });
  }

  /**
   * Utility function to chunk array for parallel processing
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Utility function to sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let modelTestingService: ModelTestingService | null = null;

/**
 * Get the model testing service instance
 */
export function getModelTestingService(): ModelTestingService {
  if (!modelTestingService) {
    modelTestingService = new ModelTestingService();
  }
  return modelTestingService;
}