import { logger } from '../utils/logger.js';
import { getConnectionManagementService } from './connection-management-service.js';
import { LLMConnection, OpenAIConfig, BedrockConfig } from '../types/connections.js';
import { ValidationError, ServiceUnavailableError } from '../types/errors.js';

export interface LLMExecutionRequest {
  connectionId: string;
  userId: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  options?: {
    temperature?: number;
    maxTokens?: number;
    model?: string;
  };
}

export interface LLMExecutionResult {
  response: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

export class LLMExecutionService {
  /**
   * Execute a prompt using the specified connection
   */
  static async executePrompt(request: LLMExecutionRequest): Promise<LLMExecutionResult> {
    try {
      logger.info('Executing LLM prompt', { 
        connectionId: request.connectionId, 
        userId: request.userId,
        messageCount: request.messages.length
      });

      // Get the connection
      const connectionService = getConnectionManagementService();
      const connection = await connectionService.getConnection(request.userId, request.connectionId);

      if (connection.status !== 'active') {
        throw new ServiceUnavailableError(`Connection ${request.connectionId} is not active`);
      }

      // Execute based on provider
      switch (connection.provider) {
        case 'openai':
          return await this.executeOpenAI(connection as LLMConnection, request);
        case 'bedrock':
          return await this.executeBedrock(connection as LLMConnection, request);
        default:
          throw new ValidationError(`Unsupported provider: ${connection.provider}`);
      }
    } catch (error) {
      logger.error('Failed to execute LLM prompt:', error);
      throw error;
    }
  }

  /**
   * Execute prompt using OpenAI API
   */
  private static async executeOpenAI(
    connection: LLMConnection, 
    request: LLMExecutionRequest
  ): Promise<LLMExecutionResult> {
    const config = connection.config as OpenAIConfig;
    const model = request.options?.model || config.defaultModel || 'gpt-3.5-turbo';

    const payload = {
      model,
      messages: request.messages,
      temperature: request.options?.temperature || 0.7,
      max_tokens: request.options?.maxTokens || 2000,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new ServiceUnavailableError(`OpenAI API error: ${response.status} ${error}`);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new ServiceUnavailableError('OpenAI API request timed out after 2 minutes');
      }
      throw error;
    }

    const data = await response.json() as any;

    return {
      response: data.choices?.[0]?.message?.content || '',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
      model: data.model || model,
      provider: 'openai',
    };
  }

  /**
   * Execute prompt using AWS Bedrock
   */
  private static async executeBedrock(
    connection: LLMConnection, 
    request: LLMExecutionRequest
  ): Promise<LLMExecutionResult> {
    const config = connection.config as BedrockConfig;
    const model = request.options?.model || config.defaultModel || 'anthropic.claude-3-sonnet-20240229-v1:0';

    // For now, return a mock response since Bedrock integration is complex
    // In a real implementation, this would use AWS SDK to call Bedrock
    logger.warn('Bedrock execution is mocked - implement AWS SDK integration');
    
    return {
      response: `[MOCK BEDROCK RESPONSE] This would be the actual response from ${model} via AWS Bedrock. Messages: ${request.messages.length}`,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
      model,
      provider: 'bedrock',
    };
  }
}