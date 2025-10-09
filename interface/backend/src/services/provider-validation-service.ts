/**
 * Provider Validation Service
 * 
 * Handles validation of provider configurations, connectivity testing,
 * and capability verification for dynamic providers.
 */

import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';
import {
  Provider,
  Model,
  ProviderTestResult,
  ValidationResult,
  ValidationError as DynamicValidationError,
  ValidationWarning,
  ProviderCapabilities,
  AuthConfig,
  AuthMethod,
} from '../types/dynamic-providers.js';

export class ProviderValidationService {
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds

  /**
   * Validate a complete provider configuration
   */
  async validateProvider(provider: Provider): Promise<ValidationResult> {
    const errors: DynamicValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Validate API endpoint
      const endpointResult = await this.validateApiEndpoint(provider.apiEndpoint);
      if (!endpointResult.valid) {
        errors.push(...endpointResult.errors);
        warnings.push(...endpointResult.warnings);
      }

      // Validate authentication configuration
      const authResult = await this.validateAuthConfiguration(provider.authMethod, provider.authConfig);
      if (!authResult.valid) {
        errors.push(...authResult.errors);
        warnings.push(...authResult.warnings);
      }

      // Validate provider capabilities
      const capabilitiesResult = await this.validateProviderCapabilities(provider.capabilities);
      if (!capabilitiesResult.valid) {
        errors.push(...capabilitiesResult.errors);
        warnings.push(...capabilitiesResult.warnings);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      logger.error('Provider validation failed:', error);
      errors.push({
        code: 'VALIDATION_ERROR',
        message: 'Failed to validate provider configuration',
        field: 'provider'
      });

      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Test provider connectivity and authentication
   */
  async testProviderConnectivity(provider: Provider): Promise<ProviderTestResult> {
    const startTime = Date.now();

    try {
      // Test basic connectivity
      const connectivityResult = await this.testEndpointAccessibility(provider.apiEndpoint);

      if (!connectivityResult.success) {
        return {
          success: false,
          error: connectivityResult.error,
          testedAt: new Date(),
          latency: Date.now() - startTime
        };
      }

      // Test authentication
      const authResult = await this.testAuthentication(provider);

      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error,
          testedAt: new Date(),
          latency: Date.now() - startTime
        };
      }

      // Test capabilities
      const capabilitiesResult = await this.testProviderCapabilities(provider);

      const result: ProviderTestResult = {
        success: true,
        testedAt: new Date(),
        latency: Date.now() - startTime
      };

      if (capabilitiesResult.availableModels) {
        result.availableModels = capabilitiesResult.availableModels;
      }

      if (capabilitiesResult.detectedCapabilities) {
        result.capabilities = capabilitiesResult.detectedCapabilities;
      }

      return result;
    } catch (error) {
      logger.error('Provider connectivity test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        testedAt: new Date(),
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Validate model capabilities
   */
  async validateModelCapabilities(model: Model): Promise<ValidationResult> {
    const errors: DynamicValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Validate required fields
      if (!model.id) {
        errors.push({
          code: 'MISSING_FIELD',
          message: 'Model ID is required',
          field: 'id'
        });
      }

      if (!model.name) {
        errors.push({
          code: 'MISSING_FIELD',
          message: 'Model name is required',
          field: 'name'
        });
      }

      // Validate capabilities
      if (model.capabilities) {
        if (model.capabilities.maxContextLength <= 0) {
          errors.push({
            code: 'INVALID_VALUE',
            message: 'Max context length must be greater than 0',
            field: 'capabilities.maxContextLength'
          });
        }

        if (!model.capabilities.supportedRoles || model.capabilities.supportedRoles.length === 0) {
          errors.push({
            code: 'INVALID_VALUE',
            message: 'Model must support at least one role',
            field: 'capabilities.supportedRoles'
          });
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      logger.error('Model validation failed:', error);
      errors.push({
        code: 'VALIDATION_ERROR',
        message: 'Failed to validate model configuration',
        field: 'model'
      });

      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Test endpoint accessibility
   */
  private async testEndpointAccessibility(endpoint: string): Promise<{
    success: boolean;
    error: string;
  }> {
    try {
      const response = await fetch(endpoint, {
        method: 'HEAD',
        signal: AbortSignal.timeout(this.REQUEST_TIMEOUT)
      });

      if (response.status < 500) {
        return { success: true, error: '' };
      }

      return {
        success: false,
        error: `Server error: ${response.status}`
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout'
        };
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        return {
          success: false,
          error: 'Endpoint not reachable'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test authentication
   */
  private async testAuthentication(provider: Provider): Promise<{
    success: boolean;
    error: string;
  }> {
    try {
      const headers = await this.buildAuthHeaders(provider.authMethod, provider.authConfig);
      const testEndpoint = this.getAuthTestEndpoint(provider);

      const response = await fetch(testEndpoint, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(this.REQUEST_TIMEOUT)
      });

      if (response.status === 200) {
        return { success: true, error: '' };
      } else if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      } else if (response.status === 403) {
        return {
          success: false,
          error: 'Access forbidden - check permissions'
        };
      }

      return { success: true, error: '' };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout'
        };
      }

      if (error.status === 401) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test provider capabilities
   */
  private async testProviderCapabilities(provider: Provider): Promise<{
    availableModels?: string[];
    detectedCapabilities?: Partial<ProviderCapabilities>;
  }> {
    try {
      const headers = await this.buildAuthHeaders(provider.authMethod, provider.authConfig);
      const modelsEndpoint = this.getModelsEndpoint(provider);

      if (modelsEndpoint) {
        try {
          const response = await fetch(modelsEndpoint, {
            method: 'GET',
            headers,
            signal: AbortSignal.timeout(this.REQUEST_TIMEOUT)
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          const availableModels = this.extractModelList(data, provider);

          return {
            availableModels,
            detectedCapabilities: this.detectCapabilities(data, provider)
          };
        } catch (error) {
          logger.warn(`Failed to fetch models for provider ${provider.identifier}:`, error);
        }
      }

      return {};
    } catch (error) {
      logger.error(`Failed to test capabilities for provider ${provider.identifier}:`, error);
      return {};
    }
  }

  /**
   * Build authentication headers
   */
  private async buildAuthHeaders(authMethod: AuthMethod, authConfig: AuthConfig): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    switch (authMethod) {
      case 'api_key':
        if (authConfig.fields?.['apiKey']) {
          headers['Authorization'] = `Bearer ${authConfig.fields['apiKey']}`;
        }
        break;
      case 'oauth2':
        // OAuth2 would require token exchange, simplified for now
        if (authConfig.fields?.['token']) {
          headers['Authorization'] = `Bearer ${authConfig.fields['token']}`;
        }
        break;
      case 'aws_iam':
        // AWS IAM would require signature calculation, simplified for now
        if (authConfig.fields?.['accessKeyId']) {
          headers['Authorization'] = `AWS4-HMAC-SHA256 ${authConfig.fields['accessKeyId']}`;
        }
        break;
      case 'custom':
        if (authConfig.headers) {
          Object.assign(headers, authConfig.headers);
        }
        break;
    }

    return headers;
  }

  /**
   * Get authentication test endpoint
   */
  private getAuthTestEndpoint(provider: Provider): string {
    // Try common endpoints for testing authentication
    const baseUrl = provider.apiEndpoint.replace(/\/$/, '');

    switch (provider.identifier) {
      case 'openai':
        return `${baseUrl}/models`;
      case 'anthropic':
        return `${baseUrl}/messages`;
      case 'meta':
        return `${baseUrl}/chat/completions`;
      default:
        return `${baseUrl}/models`;
    }
  }

  /**
   * Get models endpoint
   */
  private getModelsEndpoint(provider: Provider): string | null {
    const baseUrl = provider.apiEndpoint.replace(/\/$/, '');

    switch (provider.identifier) {
      case 'openai':
        return `${baseUrl}/models`;
      case 'anthropic':
        return null; // Anthropic doesn't have a public models endpoint
      case 'meta':
        return `${baseUrl}/models`;
      default:
        return `${baseUrl}/models`;
    }
  }

  /**
   * Extract model list from API response
   */
  private extractModelList(responseData: any, provider: Provider): string[] {
    try {
      switch (provider.identifier) {
        case 'openai':
          return responseData.data?.map((model: any) => model.id) || [];
        case 'meta':
          return responseData.data?.map((model: any) => model.id) || [];
        default:
          // Generic extraction
          if (Array.isArray(responseData.data)) {
            return responseData.data.map((item: any) => item.id || item.name).filter(Boolean);
          }
          return [];
      }
    } catch (error) {
      logger.warn(`Failed to extract model list for provider ${provider.identifier}:`, error);
      return [];
    }
  }

  /**
   * Detect capabilities from API response
   */
  private detectCapabilities(_responseData: any, _provider: Provider): Partial<ProviderCapabilities> {
    // Basic capability detection - can be enhanced based on provider responses
    return {
      supportsSystemMessages: true,
      maxContextLength: 4096,
      supportedRoles: ['user', 'assistant'],
      supportsStreaming: true,
      supportsTools: false,
      supportedAuthMethods: ['api_key']
    };
  }

  /**
   * Validate API endpoint
   */
  private async validateApiEndpoint(endpoint: string): Promise<ValidationResult> {
    const errors: DynamicValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      new URL(endpoint);
    } catch (error) {
      errors.push({
        code: 'INVALID_URL',
        message: 'Invalid API endpoint URL',
        field: 'apiEndpoint'
      });
    }

    if (!endpoint.startsWith('https://')) {
      warnings.push({
        code: 'INSECURE_ENDPOINT',
        message: 'API endpoint should use HTTPS for security',
        field: 'apiEndpoint'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate authentication configuration
   */
  private async validateAuthConfiguration(authMethod: AuthMethod, authConfig: AuthConfig): Promise<ValidationResult> {
    const errors: DynamicValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!authConfig) {
      errors.push({
        code: 'MISSING_AUTH_CONFIG',
        message: `Authentication configuration is required for ${authMethod}`,
        field: 'authConfig'
      });
      return { valid: false, errors, warnings };
    }

    switch (authMethod) {
      case 'api_key':
        if (!authConfig.fields?.['apiKey']) {
          errors.push({
            code: 'MISSING_API_KEY',
            message: 'API key is required for api_key authentication',
            field: 'authConfig.fields.apiKey'
          });
        }
        break;
      case 'oauth2':
        if (!authConfig.fields?.['clientId'] || !authConfig.fields?.['clientSecret']) {
          errors.push({
            code: 'MISSING_OAUTH_CREDENTIALS',
            message: 'Client ID and secret are required for oauth2 authentication',
            field: 'authConfig.fields'
          });
        }
        break;
      case 'aws_iam':
        if (!authConfig.fields?.['accessKeyId'] || !authConfig.fields?.['secretAccessKey']) {
          errors.push({
            code: 'MISSING_AWS_CREDENTIALS',
            message: 'Access key ID and secret are required for aws_iam authentication',
            field: 'authConfig.fields'
          });
        }
        break;
      case 'custom':
        if (!authConfig.fields || Object.keys(authConfig.fields).length === 0) {
          errors.push({
            code: 'MISSING_CUSTOM_FIELDS',
            message: 'Custom fields are required for custom authentication',
            field: 'authConfig.fields'
          });
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate provider capabilities
   */
  private async validateProviderCapabilities(capabilities: ProviderCapabilities): Promise<ValidationResult> {
    const errors: DynamicValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!capabilities) {
      errors.push({
        code: 'MISSING_CAPABILITIES',
        message: 'Provider capabilities are required',
        field: 'capabilities'
      });
      return { valid: false, errors, warnings };
    }

    if (capabilities.maxContextLength <= 0) {
      errors.push({
        code: 'INVALID_MAX_CONTEXT_LENGTH',
        message: 'Max context length must be greater than 0',
        field: 'capabilities.maxContextLength'
      });
    }

    if (!capabilities.supportedRoles || capabilities.supportedRoles.length === 0) {
      errors.push({
        code: 'NO_SUPPORTED_ROLES',
        message: 'Provider must support at least one role',
        field: 'capabilities.supportedRoles'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Singleton instance
let providerValidationService: ProviderValidationService | null = null;

/**
 * Get the provider validation service instance
 */
export function getProviderValidationService(): ProviderValidationService {
  if (!providerValidationService) {
    providerValidationService = new ProviderValidationService();
  }
  return providerValidationService;
}

export default ProviderValidationService;