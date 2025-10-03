/**
 * Provider Validation Service
 * 
 * Handles validation of provider configurations, connectivity testing,
 * and capability verification for dynamic providers.
 */

import axios, { AxiosError } from 'axios';
import { logger } from '../utils/logger.js';
// Removed unused imports
import {
  Provider,
  Model,
  ProviderTestResult,
  ValidationResult,
  ValidationError as DynamicValidationError,
  ValidationWarning,
  ProviderCapabilities,
  ModelCapabilities,
  AuthConfig,
  AuthMethod
} from '../types/dynamic-providers.js';
import { validateCapabilityConsistency, validateContextLengthConsistency } from '../types/dynamic-provider-validation.js';

/**
 * Provider validation service
 */
export class ProviderValidationService {
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  // Removed unused MAX_RETRIES constant

  // ============================================================================
  // Provider Configuration Validation
  // ============================================================================

  /**
   * Validate complete provider configuration
   */
  async validateProviderConfig(provider: Provider): Promise<ValidationResult> {
    const errors: DynamicValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Validate API endpoint accessibility
      const endpointValidation = await this.validateApiEndpoint(provider.apiEndpoint);
      if (!endpointValidation.valid) {
        errors.push(...endpointValidation.errors);
      }
      warnings.push(...endpointValidation.warnings);

      // Validate authentication configuration
      const authValidation = this.validateAuthConfiguration(provider.authMethod, provider.authConfig);
      if (!authValidation.valid) {
        errors.push(...authValidation.errors);
      }
      warnings.push(...authValidation.warnings);

      // Validate provider capabilities
      const capabilityValidation = this.validateProviderCapabilities(provider.capabilities);
      if (!capabilityValidation.valid) {
        errors.push(...capabilityValidation.errors);
      }
      warnings.push(...capabilityValidation.warnings);

      return {
        valid: errors.length === 0,
        invalid: [],
        conflicts: [],
        errors,
        warnings
      };

    } catch (error) {
      logger.error('Provider configuration validation failed:', error);
      
      errors.push({
        field: 'general',
        code: 'VALIDATION_ERROR',
        message: 'Failed to validate provider configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Validate model configuration against provider capabilities
   */
  async validateModelConfig(provider: Provider, model: Model): Promise<ValidationResult> {
    const errors: DynamicValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Validate model capabilities against provider capabilities
      const capabilityValidation = await this.validateModelCapabilities(
        provider.capabilities,
        model.capabilities
      );

      if (!capabilityValidation.valid) {
        errors.push(...capabilityValidation.errors);
      }
      warnings.push(...capabilityValidation.warnings);

      // Validate context length consistency
      if (!validateContextLengthConsistency(provider.capabilities.maxContextLength, model.contextLength)) {
        errors.push({
          field: 'contextLength',
          code: 'CONTEXT_LENGTH_EXCEEDS_PROVIDER',
          message: `Model context length (${model.contextLength}) exceeds provider maximum (${provider.capabilities.maxContextLength})`
        });
      }

      return {
        valid: errors.length === 0,
        invalid: [],
        conflicts: [],
        errors,
        warnings
      };

    } catch (error) {
      logger.error('Model configuration validation failed:', error);
      
      errors.push({
        field: 'general',
        code: 'VALIDATION_ERROR',
        message: 'Failed to validate model configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Validate model capabilities against provider capabilities
   */
  async validateModelCapabilities(
    providerCapabilities: ProviderCapabilities,
    modelCapabilities: ModelCapabilities
  ): Promise<ValidationResult> {
    const errors: DynamicValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Use the utility function for capability consistency
    const consistencyCheck = validateCapabilityConsistency(providerCapabilities, modelCapabilities);
    
    if (!consistencyCheck.valid) {
      for (const conflict of consistencyCheck.conflicts) {
        errors.push({
          field: 'capabilities',
          code: 'CAPABILITY_MISMATCH',
          message: conflict
        });
      }
    }

    // Additional model-specific validations
    if (modelCapabilities.maxContextLength > providerCapabilities.maxContextLength) {
      errors.push({
        field: 'maxContextLength',
        code: 'CONTEXT_LENGTH_EXCEEDS_PROVIDER',
        message: `Model context length (${modelCapabilities.maxContextLength}) exceeds provider maximum (${providerCapabilities.maxContextLength})`
      });
    }

    // Check for advanced capabilities that might not be supported
    if (modelCapabilities.supportsVision && !providerCapabilities.supportsTools) {
      warnings.push({
        field: 'supportsVision',
        code: 'ADVANCED_CAPABILITY_WARNING',
        message: 'Vision support may require tool support from the provider',
        suggestion: 'Verify that the provider supports vision capabilities'
      });
    }

    if (modelCapabilities.supportsFunctionCalling && !modelCapabilities.supportsTools) {
      errors.push({
        field: 'supportsFunctionCalling',
        code: 'INCONSISTENT_CAPABILITIES',
        message: 'Function calling requires tool support to be enabled'
      });
    }

    return {
      valid: errors.length === 0,
      invalid: [],
      conflicts: [],
      errors,
      warnings
    };
  }

  // ============================================================================
  // Connectivity Testing
  // ============================================================================

  /**
   * Test provider connectivity and basic functionality
   */
  async testProviderConnectivity(provider: Provider): Promise<ProviderTestResult> {
    const startTime = Date.now();
    
    logger.info('Testing provider connectivity', {
      providerId: provider.id,
      identifier: provider.identifier,
      endpoint: provider.apiEndpoint
    });

    try {
      // Test basic endpoint accessibility
      const endpointTest = await this.testEndpointAccessibility(provider.apiEndpoint);
      if (!endpointTest.success) {
        return {
          success: false,
          error: `Endpoint not accessible: ${endpointTest.error}`,
          testedAt: new Date(),
          latency: Date.now() - startTime
        };
      }

      // Test authentication
      const authTest = await this.testAuthentication(provider);
      if (!authTest.success) {
        return {
          success: false,
          error: `Authentication failed: ${authTest.error}`,
          testedAt: new Date(),
          latency: Date.now() - startTime
        };
      }

      // Test provider capabilities (if possible)
      const capabilityTest = await this.testProviderCapabilities(provider);
      
      const latency = Date.now() - startTime;

      logger.info('Provider connectivity test completed', {
        providerId: provider.id,
        success: true,
        latency
      });

      return {
        success: true,
        latency,
        testedAt: new Date(),
        availableModels: capabilityTest.availableModels || [],
        capabilities: capabilityTest.detectedCapabilities || {}
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      
      logger.error('Provider connectivity test failed:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency,
        testedAt: new Date()
      };
    }
  }

  /**
   * Test basic endpoint accessibility
   */
  private async testEndpointAccessibility(endpoint: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Try a simple HEAD or GET request to check if endpoint is reachable
      await axios.head(endpoint, {
        timeout: this.REQUEST_TIMEOUT,
        validateStatus: (status) => status < 500 // Accept 4xx as "accessible"
      });

      return { success: true };

    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          return {
            success: false,
            error: 'Endpoint not reachable'
          };
        }
        
        if (error.response && error.response.status < 500) {
          // 4xx errors are acceptable for accessibility test
          return { success: true };
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test provider authentication
   */
  private async testAuthentication(provider: Provider): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Build authentication headers based on auth method
      const headers = await this.buildAuthHeaders(provider.authMethod, provider.authConfig);
      
      // Try to make an authenticated request to a common endpoint
      const testEndpoint = this.getAuthTestEndpoint(provider);
      
      const response = await axios.get(testEndpoint, {
        headers,
        timeout: this.REQUEST_TIMEOUT,
        validateStatus: (status) => status === 200 || status === 401 || status === 403
      });

      // 401/403 might indicate auth is working but credentials are wrong
      // 200 indicates successful auth
      if (response.status === 200) {
        return { success: true };
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

      return { success: true }; // Other statuses might be acceptable

    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          return {
            success: false,
            error: 'Invalid credentials'
          };
        }
        
        if (error.response?.status === 403) {
          return {
            success: false,
            error: 'Access forbidden'
          };
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Test provider capabilities by making actual API calls
   */
  private async testProviderCapabilities(provider: Provider): Promise<{
    availableModels?: string[];
    detectedCapabilities?: Partial<ProviderCapabilities>;
  }> {
    try {
      const headers = await this.buildAuthHeaders(provider.authMethod, provider.authConfig);
      
      // Try to get available models
      const modelsEndpoint = this.getModelsEndpoint(provider);
      if (modelsEndpoint) {
        try {
          const response = await axios.get(modelsEndpoint, {
            headers,
            timeout: this.REQUEST_TIMEOUT
          });

          const availableModels = this.extractModelList(response.data, provider);
          
          return {
            availableModels,
            detectedCapabilities: {
              // Could detect capabilities based on available models
            }
          };
        } catch (error) {
          logger.debug('Failed to fetch models list', {
            providerId: provider.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return {};

    } catch (error) {
      logger.debug('Failed to test provider capabilities', {
        providerId: provider.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {};
    }
  }

  // ============================================================================
  // Authentication Helpers
  // ============================================================================

  /**
   * Build authentication headers based on auth method and config
   */
  private async buildAuthHeaders(authMethod: AuthMethod, authConfig: AuthConfig): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    switch (authMethod) {
      case 'api_key':
        if (authConfig.fields['apiKey']) {
          headers['Authorization'] = `Bearer ${authConfig.fields['apiKey']}`;
        }
        if (authConfig.fields['organizationId']) {
          headers['OpenAI-Organization'] = String(authConfig.fields['organizationId']);
        }
        break;

      case 'oauth2':
        // For OAuth2, we would need to handle token exchange
        // This is a simplified implementation
        if (authConfig.fields['accessToken']) {
          headers['Authorization'] = `Bearer ${authConfig.fields['accessToken']}`;
        }
        break;

      case 'aws_iam':
        // For AWS IAM, we would need to sign requests
        // This would require AWS SDK integration
        headers['Authorization'] = 'AWS4-HMAC-SHA256 ...'; // Placeholder
        break;

      case 'custom':
        // Apply custom headers from config
        if (authConfig.headers) {
          Object.assign(headers, authConfig.headers);
        }
        break;
    }

    // Apply any additional headers from config
    if (authConfig.headers) {
      Object.assign(headers, authConfig.headers);
    }

    return headers;
  }

  /**
   * Get appropriate test endpoint for authentication
   */
  private getAuthTestEndpoint(provider: Provider): string {
    // Use custom test endpoint if provided
    if (provider.authConfig.testEndpoint) {
      return `${provider.apiEndpoint}${provider.authConfig.testEndpoint}`;
    }

    // Default test endpoints for common providers
    if (provider.apiEndpoint.includes('openai.com')) {
      return `${provider.apiEndpoint}/models`;
    }
    
    if (provider.apiEndpoint.includes('anthropic.com')) {
      return `${provider.apiEndpoint}/v1/messages`;
    }

    if (provider.apiEndpoint.includes('bedrock')) {
      return `${provider.apiEndpoint}/foundation-models`;
    }

    // Default to base endpoint
    return provider.apiEndpoint;
  }

  /**
   * Get models endpoint for the provider
   */
  private getModelsEndpoint(provider: Provider): string | null {
    if (provider.apiEndpoint.includes('openai.com')) {
      return `${provider.apiEndpoint}/models`;
    }
    
    // Anthropic doesn't have a public models endpoint
    if (provider.apiEndpoint.includes('anthropic.com')) {
      return null;
    }

    if (provider.apiEndpoint.includes('bedrock')) {
      return `${provider.apiEndpoint}/foundation-models`;
    }

    // Try common patterns
    return `${provider.apiEndpoint}/models`;
  }

  /**
   * Extract model list from API response
   */
  private extractModelList(responseData: any, provider: Provider): string[] {
    try {
      // OpenAI format
      if (responseData.data && Array.isArray(responseData.data)) {
        return responseData.data.map((model: any) => model.id).filter(Boolean);
      }

      // AWS Bedrock format
      if (responseData.modelSummaries && Array.isArray(responseData.modelSummaries)) {
        return responseData.modelSummaries.map((model: any) => model.modelId).filter(Boolean);
      }

      // Generic array format
      if (Array.isArray(responseData)) {
        return responseData.map((model: any) => model.id || model.name || model.modelId).filter(Boolean);
      }

      return [];

    } catch (error) {
      logger.debug('Failed to extract model list', {
        providerId: provider.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }

  // ============================================================================
  // Configuration Validation Helpers
  // ============================================================================

  /**
   * Validate API endpoint format and accessibility
   */
  private async validateApiEndpoint(endpoint: string): Promise<ValidationResult> {
    const errors: DynamicValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic URL format validation
    try {
      new URL(endpoint);
    } catch (error) {
      errors.push({
        field: 'apiEndpoint',
        code: 'INVALID_URL',
        message: 'Invalid API endpoint URL format'
      });
      
      return { valid: false, invalid: [], conflicts: [], errors, warnings };
    }

    // Check if HTTPS
    if (!endpoint.startsWith('https://')) {
      warnings.push({
        field: 'apiEndpoint',
        code: 'INSECURE_ENDPOINT',
        message: 'API endpoint should use HTTPS for security',
        suggestion: 'Use HTTPS endpoint if available'
      });
    }

    return { valid: true, invalid: [], conflicts: [], errors, warnings };
  }

  /**
   * Validate authentication configuration
   */
  private validateAuthConfiguration(authMethod: AuthMethod, authConfig: AuthConfig): ValidationResult {
    const errors: DynamicValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if auth config type matches auth method
    if (authConfig.type !== authMethod) {
      errors.push({
        field: 'authConfig',
        code: 'AUTH_METHOD_MISMATCH',
        message: `Auth config type (${authConfig.type}) does not match auth method (${authMethod})`
      });
    }

    // Validate required fields based on auth method
    switch (authMethod) {
      case 'api_key':
        if (!authConfig.fields['apiKey']) {
          errors.push({
            field: 'authConfig.fields.apiKey',
            code: 'MISSING_REQUIRED_FIELD',
            message: 'API key is required for api_key authentication'
          });
        }
        break;

      case 'oauth2':
        if (!authConfig.fields['clientId'] || !authConfig.fields['clientSecret']) {
          errors.push({
            field: 'authConfig.fields',
            code: 'MISSING_REQUIRED_FIELD',
            message: 'Client ID and client secret are required for OAuth2 authentication'
          });
        }
        break;

      case 'aws_iam':
        if (!authConfig.fields['accessKeyId'] || !authConfig.fields['secretAccessKey'] || !authConfig.fields['region']) {
          errors.push({
            field: 'authConfig.fields',
            code: 'MISSING_REQUIRED_FIELD',
            message: 'Access key ID, secret access key, and region are required for AWS IAM authentication'
          });
        }
        break;

      case 'custom':
        if (!authConfig.fields || Object.keys(authConfig.fields).length === 0) {
          errors.push({
            field: 'authConfig.fields',
            code: 'MISSING_REQUIRED_FIELD',
            message: 'At least one authentication field is required for custom authentication'
          });
        }
        break;
    }

    return { valid: errors.length === 0, invalid: [], conflicts: [], errors, warnings };
  }

  /**
   * Validate provider capabilities configuration
   */
  private validateProviderCapabilities(capabilities: ProviderCapabilities): ValidationResult {
    const errors: DynamicValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate context length
    if (capabilities.maxContextLength <= 0) {
      errors.push({
        field: 'capabilities.maxContextLength',
        code: 'INVALID_VALUE',
        message: 'Maximum context length must be greater than 0'
      });
    }

    if (capabilities.maxContextLength > 2000000) {
      warnings.push({
        field: 'capabilities.maxContextLength',
        code: 'UNUSUALLY_HIGH_VALUE',
        message: 'Maximum context length is unusually high',
        suggestion: 'Verify that the provider actually supports this context length'
      });
    }

    // Validate supported roles
    if (!capabilities.supportedRoles || capabilities.supportedRoles.length === 0) {
      errors.push({
        field: 'capabilities.supportedRoles',
        code: 'MISSING_REQUIRED_FIELD',
        message: 'At least one supported role must be specified'
      });
    }

    // Validate rate limits if provided
    if (capabilities.rateLimits) {
      const rateLimits = capabilities.rateLimits;
      
      if (rateLimits.requestsPerMinute && rateLimits.requestsPerMinute <= 0) {
        errors.push({
          field: 'capabilities.rateLimits.requestsPerMinute',
          code: 'INVALID_VALUE',
          message: 'Requests per minute must be greater than 0'
        });
      }

      if (rateLimits.tokensPerMinute && rateLimits.tokensPerMinute <= 0) {
        errors.push({
          field: 'capabilities.rateLimits.tokensPerMinute',
          code: 'INVALID_VALUE',
          message: 'Tokens per minute must be greater than 0'
        });
      }
    }

    return { valid: errors.length === 0, invalid: [], conflicts: [], errors, warnings };
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