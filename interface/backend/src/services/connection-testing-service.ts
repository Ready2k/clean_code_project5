import { logger } from '../utils/logger.js';
import { 
  ConnectionTestResult, 
  OpenAIConfig, 
  BedrockConfig,
  MicrosoftCopilotConfig,
  OPENAI_MODELS,
  BEDROCK_MODELS,
  MICROSOFT_COPILOT_MODELS,
  ConnectionErrorCode
} from '../types/connections.js';
import { AppError } from '../types/errors.js';

export class ConnectionTestingService {
  private static readonly TEST_TIMEOUT = 10000; // 10 seconds
  private static readonly MAX_RETRIES = 2;

  /**
   * Test an OpenAI connection
   */
  public static async testOpenAIConnection(config: OpenAIConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Testing OpenAI connection', {
        baseUrl: config.baseUrl || 'https://api.openai.com',
        hasApiKey: !!config.apiKey,
        organizationId: config.organizationId
      });

      // Prepare request headers
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PromptLibrary/1.0.0'
      };

      if (config.organizationId) {
        headers['OpenAI-Organization'] = config.organizationId;
      }

      // Test with a simple models list request
      const baseUrl = config.baseUrl || 'https://api.openai.com';
      const response = await this.makeRequest(
        `${baseUrl}/v1/models`,
        {
          method: 'GET',
          headers,
          timeout: this.TEST_TIMEOUT
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = (errorData as any)?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        
        logger.warn('OpenAI connection test failed', {
          status: response.status,
          error: errorMessage
        });

        return {
          success: false,
          error: this.mapOpenAIError(response.status, errorMessage),
          testedAt: new Date()
        };
      }

      const data = await response.json();
      const availableModels = (data as any)?.data
        ?.filter((model: any) => OPENAI_MODELS.includes(model.id))
        ?.map((model: any) => model.id) || [];

      const latency = Date.now() - startTime;

      logger.info('OpenAI connection test successful', {
        latency,
        availableModels: availableModels.length
      });

      return {
        success: true,
        latency,
        availableModels,
        testedAt: new Date()
      };

    } catch (error: any) {
      const latency = Date.now() - startTime;
      const errorMessage = this.extractErrorMessage(error);
      
      logger.error('OpenAI connection test failed', {
        error: errorMessage,
        latency
      });

      return {
        success: false,
        latency,
        error: errorMessage,
        testedAt: new Date()
      };
    }
  }

  /**
   * Test a Microsoft Copilot connection
   */
  public static async testMicrosoftCopilotConnection(config: MicrosoftCopilotConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Testing Microsoft Copilot connection', {
        endpoint: config.endpoint,
        hasApiKey: !!config.apiKey,
        apiVersion: config.apiVersion || '2024-02-15-preview'
      });

      // Test the connection by making a simple API call
      const response = await fetch(`${config.endpoint}/openai/deployments?api-version=${config.apiVersion || '2024-02-15-preview'}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(this.TEST_TIMEOUT)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const availableModels = (data as any)?.data
        ?.filter((deployment: any) => MICROSOFT_COPILOT_MODELS.includes(deployment.model))
        ?.map((deployment: any) => deployment.model) || [];

      const latency = Date.now() - startTime;
      
      logger.info('Microsoft Copilot connection test successful', {
        latency,
        availableModels: availableModels.length
      });

      return {
        success: true,
        latency,
        availableModels,
        testedAt: new Date()
      };

    } catch (error: any) {
      const latency = Date.now() - startTime;
      const errorMessage = this.extractErrorMessage(error);
      
      logger.error('Microsoft Copilot connection test failed', {
        error: errorMessage,
        latency
      });

      return {
        success: false,
        latency,
        error: errorMessage,
        testedAt: new Date()
      };
    }
  }

  /**
   * Test an AWS Bedrock connection
   */
  public static async testBedrockConnection(config: BedrockConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Testing AWS Bedrock connection', {
        region: config.region,
        hasAccessKey: !!config.accessKeyId,
        hasSecretKey: !!config.secretAccessKey
      });

      // For Bedrock, we'll test by listing available foundation models
      const result = await this.testBedrockCredentials(config);
      const latency = Date.now() - startTime;

      if (result.success) {
        logger.info('AWS Bedrock connection test successful', {
          latency,
          availableModels: result.availableModels?.length || 0
        });

        return {
          success: true,
          latency,
          availableModels: result.availableModels || [],
          testedAt: new Date()
        };
      } else {
        logger.warn('AWS Bedrock connection test failed', {
          latency,
          error: result.error
        });

        return {
          success: false,
          latency,
          error: result.error || 'Unknown error',
          testedAt: new Date()
        };
      }

    } catch (error: any) {
      const latency = Date.now() - startTime;
      const errorMessage = this.extractErrorMessage(error);
      
      logger.error('AWS Bedrock connection test failed', {
        error: errorMessage,
        latency
      });

      return {
        success: false,
        latency,
        error: errorMessage,
        testedAt: new Date()
      };
    }
  }

  /**
   * Test Bedrock credentials by making a simple API call
   */
  private static async testBedrockCredentials(config: BedrockConfig): Promise<{
    success: boolean;
    error?: string;
    availableModels?: string[];
  }> {
    try {
      // Create AWS signature for the request
      const { signature, headers } = await this.createAWSSignature(
        config,
        'GET',
        `/foundation-models`,
        ''
      );

      const url = `https://bedrock.${config.region}.amazonaws.com/foundation-models`;
      
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: {
          ...headers,
          'Authorization': signature,
          'Content-Type': 'application/x-amz-json-1.1'
        },
        timeout: this.TEST_TIMEOUT
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = (errorData as any)?.message || `HTTP ${response.status}: ${response.statusText}`;
        
        return {
          success: false,
          error: this.mapBedrockError(response.status, errorMessage)
        };
      }

      const data = await response.json();
      const availableModels = (data as any)?.modelSummaries
        ?.filter((model: any) => BEDROCK_MODELS.includes(model.modelId))
        ?.map((model: any) => model.modelId) || [];

      return {
        success: true,
        availableModels
      };

    } catch (error: any) {
      return {
        success: false,
        error: this.extractErrorMessage(error)
      };
    }
  }

  /**
   * Create AWS Signature Version 4 for Bedrock API calls
   */
  private static async createAWSSignature(
    config: BedrockConfig,
    method: string,
    path: string,
    body: string
  ): Promise<{ signature: string; headers: Record<string, string> }> {
    // This is a simplified implementation
    // In a production environment, you would use the AWS SDK or a proper signing library
    
    const crypto = await import('crypto');
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStamp = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    
    const headers = {
      'Host': `bedrock.${config.region}.amazonaws.com`,
      'X-Amz-Date': timeStamp,
      'X-Amz-Content-Sha256': crypto.createHash('sha256').update(body).digest('hex')
    };

    // Create canonical request
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key as keyof typeof headers]}`)
      .join('\n');
    
    const signedHeaders = Object.keys(headers)
      .sort()
      .map(key => key.toLowerCase())
      .join(';');

    const canonicalRequest = [
      method,
      path,
      '', // query string
      canonicalHeaders,
      '',
      signedHeaders,
      headers['X-Amz-Content-Sha256']
    ].join('\n');

    // Create string to sign
    const credentialScope = `${dateStamp}/${config.region}/bedrock/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      timeStamp,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    // Calculate signature
    const kDate = crypto.createHmac('sha256', `AWS4${config.secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(config.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('bedrock').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      signature: authHeader,
      headers
    };
  }

  /**
   * Make an HTTP request with timeout and retry logic
   */
  private static async makeRequest(
    url: string, 
    options: RequestInit & { timeout?: number }
  ): Promise<Response> {
    const { timeout = this.TEST_TIMEOUT, ...fetchOptions } = options;
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response;
        
      } catch (error: any) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          throw new AppError(
            'Connection timeout',
            408,
            ConnectionErrorCode.CONNECTION_TIMEOUT as any
          );
        }
        
        if (attempt === this.MAX_RETRIES) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    
    throw lastError;
  }

  /**
   * Map OpenAI API errors to user-friendly messages
   */
  private static mapOpenAIError(status: number, message: string): string {
    switch (status) {
      case 401:
        return 'Invalid API key. Please check your OpenAI API key.';
      case 403:
        return 'Access forbidden. Please check your API key permissions.';
      case 429:
        return 'Rate limit exceeded. Please try again later.';
      case 500:
      case 502:
      case 503:
        return 'OpenAI service is temporarily unavailable. Please try again later.';
      default:
        return message || 'Unknown error occurred while testing OpenAI connection.';
    }
  }

  /**
   * Map Bedrock API errors to user-friendly messages
   */
  private static mapBedrockError(status: number, message: string): string {
    switch (status) {
      case 401:
        return 'Invalid AWS credentials. Please check your access key and secret key.';
      case 403:
        return 'Access denied. Please check your AWS permissions for Bedrock.';
      case 404:
        return 'Bedrock service not available in the specified region.';
      case 429:
        return 'Request throttled. Please try again later.';
      case 500:
      case 502:
      case 503:
        return 'AWS Bedrock service is temporarily unavailable. Please try again later.';
      default:
        return message || 'Unknown error occurred while testing AWS Bedrock connection.';
    }
  }

  /**
   * Extract error message from various error types
   */
  private static extractErrorMessage(error: any): string {
    if (error.message) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    if (error.code) {
      switch (error.code) {
        case 'ENOTFOUND':
          return 'Network error: Unable to resolve hostname.';
        case 'ECONNREFUSED':
          return 'Network error: Connection refused.';
        case 'ETIMEDOUT':
          return 'Network error: Connection timeout.';
        default:
          return `Network error: ${error.code}`;
      }
    }
    
    return 'Unknown error occurred during connection test.';
  }

  /**
   * Validate connection configuration before testing
   */
  public static validateConfig(provider: 'openai' | 'bedrock', config: any): void {
    if (provider === 'openai') {
      const openaiConfig = config as OpenAIConfig;
      if (!openaiConfig.apiKey || openaiConfig.apiKey.trim() === '') {
        throw new AppError(
          'OpenAI API key is required',
          400,
          ConnectionErrorCode.INVALID_API_KEY as any
        );
      }
    } else if (provider === 'bedrock') {
      const bedrockConfig = config as BedrockConfig;
      if (!bedrockConfig.accessKeyId || bedrockConfig.accessKeyId.trim() === '') {
        throw new AppError(
          'AWS Access Key ID is required',
          400,
          ConnectionErrorCode.INVALID_CREDENTIALS as any
        );
      }
      if (!bedrockConfig.secretAccessKey || bedrockConfig.secretAccessKey.trim() === '') {
        throw new AppError(
          'AWS Secret Access Key is required',
          400,
          ConnectionErrorCode.INVALID_CREDENTIALS as any
        );
      }
      if (!bedrockConfig.region || bedrockConfig.region.trim() === '') {
        throw new AppError(
          'AWS Region is required',
          400,
          ConnectionErrorCode.INVALID_CREDENTIALS as any
        );
      }
    }
  }
}