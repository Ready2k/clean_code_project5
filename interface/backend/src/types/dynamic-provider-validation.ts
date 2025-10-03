/**
 * Validation schemas and utilities for dynamic provider management
 */

import Joi from 'joi';
import {
  AuthMethod,
  CreateProviderRequest,
  UpdateProviderRequest,
  CreateModelRequest,
  UpdateModelRequest,
  CreateTemplateRequest,
  UpdateTemplateRequest
} from './dynamic-providers.js';

// ============================================================================
// Base Validation Schemas
// ============================================================================

const authMethodSchema = Joi.string().valid('api_key', 'oauth2', 'aws_iam', 'custom');
const providerStatusSchema = Joi.string().valid('active', 'inactive', 'testing');
const modelStatusSchema = Joi.string().valid('active', 'inactive', 'deprecated');

const authFieldSchema = Joi.object({
  required: Joi.boolean().required(),
  description: Joi.string().required(),
  default: Joi.string().optional(),
  sensitive: Joi.boolean().optional(),
  validation: Joi.object({
    pattern: Joi.string().optional(),
    minLength: Joi.number().integer().min(0).optional(),
    maxLength: Joi.number().integer().min(1).optional(),
    options: Joi.array().items(Joi.string()).optional()
  }).optional()
});

const authConfigSchema = Joi.object({
  type: authMethodSchema.required(),
  fields: Joi.object().pattern(Joi.string(), authFieldSchema).required(),
  headers: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
  testEndpoint: Joi.string().uri({ relativeOnly: true }).optional()
});

const rateLimitConfigSchema = Joi.object({
  requestsPerMinute: Joi.number().integer().min(1).optional(),
  tokensPerMinute: Joi.number().integer().min(1).optional(),
  requestsPerDay: Joi.number().integer().min(1).optional(),
  tokensPerDay: Joi.number().integer().min(1).optional()
});

const providerCapabilitiesSchema = Joi.object({
  supportsSystemMessages: Joi.boolean().required(),
  maxContextLength: Joi.number().integer().min(1).max(2000000).required(),
  supportedRoles: Joi.array().items(Joi.string()).min(1).required(),
  supportsStreaming: Joi.boolean().required(),
  supportsTools: Joi.boolean().required(),
  supportedAuthMethods: Joi.array().items(authMethodSchema).min(1).required(),
  rateLimits: rateLimitConfigSchema.optional()
});

const modelCapabilitiesSchema = Joi.object({
  supportsSystemMessages: Joi.boolean().required(),
  maxContextLength: Joi.number().integer().min(1).max(2000000).required(),
  supportedRoles: Joi.array().items(Joi.string()).min(1).required(),
  supportsStreaming: Joi.boolean().required(),
  supportsTools: Joi.boolean().required(),
  supportsFunctionCalling: Joi.boolean().required(),
  supportsVision: Joi.boolean().optional(),
  supportsAudio: Joi.boolean().optional(),
  supportsImageGeneration: Joi.boolean().optional(),
  supportsCodeExecution: Joi.boolean().optional()
});

const pricingInfoSchema = Joi.object({
  inputTokenPrice: Joi.number().min(0).optional(),
  outputTokenPrice: Joi.number().min(0).optional(),
  currency: Joi.string().length(3).uppercase().optional(),
  billingUnit: Joi.string().optional(),
  lastUpdated: Joi.date().optional()
});

// ============================================================================
// Provider Validation Schemas
// ============================================================================

export const createProviderSchema = Joi.object<CreateProviderRequest>({
  identifier: Joi.string()
    .pattern(/^[a-z0-9-_]+$/)
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': 'Identifier must contain only lowercase letters, numbers, hyphens, and underscores',
      'string.min': 'Identifier must be at least 2 characters long',
      'string.max': 'Identifier must be at most 50 characters long'
    }),
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  apiEndpoint: Joi.string().uri().required(),
  authMethod: authMethodSchema.required(),
  authConfig: authConfigSchema.required(),
  capabilities: providerCapabilitiesSchema.required()
});

export const updateProviderSchema = Joi.object<UpdateProviderRequest>({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).allow('').optional(),
  apiEndpoint: Joi.string().uri().optional(),
  authConfig: authConfigSchema.optional(),
  capabilities: providerCapabilitiesSchema.optional(),
  status: providerStatusSchema.optional()
}).min(1); // At least one field must be provided

// ============================================================================
// Model Validation Schemas
// ============================================================================

export const createModelSchema = Joi.object<CreateModelRequest>({
  identifier: Joi.string()
    .pattern(/^[a-zA-Z0-9-_./:]+$/)
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.pattern.base': 'Model identifier must contain only letters, numbers, hyphens, underscores, dots, colons, and slashes'
    }),
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  contextLength: Joi.number().integer().min(1).max(2000000).required(),
  capabilities: modelCapabilitiesSchema.required(),
  pricingInfo: pricingInfoSchema.optional(),
  isDefault: Joi.boolean().optional()
});

export const updateModelSchema = Joi.object<UpdateModelRequest>({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).allow('').optional(),
  contextLength: Joi.number().integer().min(1).max(2000000).optional(),
  capabilities: modelCapabilitiesSchema.optional(),
  pricingInfo: pricingInfoSchema.optional(),
  status: modelStatusSchema.optional(),
  isDefault: Joi.boolean().optional()
}).min(1); // At least one field must be provided

// ============================================================================
// Template Validation Schemas
// ============================================================================

const providerTemplateConfigSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  apiEndpoint: Joi.string().uri().required(),
  authMethod: authMethodSchema.required(),
  authConfig: authConfigSchema.required(),
  capabilities: providerCapabilitiesSchema.optional()
});

const modelTemplateConfigSchema = Joi.object({
  identifier: Joi.string()
    .pattern(/^[a-zA-Z0-9-_./:]+$/)
    .min(1)
    .max(100)
    .required(),
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  contextLength: Joi.number().integer().min(1).max(2000000).required(),
  capabilities: modelCapabilitiesSchema.optional(),
  isDefault: Joi.boolean().optional()
});

export const createTemplateSchema = Joi.object<CreateTemplateRequest>({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  providerConfig: providerTemplateConfigSchema.required(),
  defaultModels: Joi.array().items(modelTemplateConfigSchema).min(1).required()
});

export const updateTemplateSchema = Joi.object<UpdateTemplateRequest>({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).allow('').optional(),
  providerConfig: providerTemplateConfigSchema.optional(),
  defaultModels: Joi.array().items(modelTemplateConfigSchema).min(1).optional()
}).min(1); // At least one field must be provided

// ============================================================================
// Query Parameter Validation Schemas
// ============================================================================

export const providerQuerySchema = Joi.object({
  status: Joi.array().items(providerStatusSchema).optional(),
  authMethod: Joi.array().items(authMethodSchema).optional(),
  isSystem: Joi.boolean().optional(),
  search: Joi.string().max(255).optional(),
  sortBy: Joi.string().valid('name', 'createdAt', 'updatedAt', 'lastTested').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional()
});

export const modelQuerySchema = Joi.object({
  providerId: Joi.string().uuid().optional(),
  status: Joi.array().items(modelStatusSchema).optional(),
  isDefault: Joi.boolean().optional(),
  minContextLength: Joi.number().integer().min(1).optional(),
  maxContextLength: Joi.number().integer().min(1).optional(),
  capabilities: Joi.array().items(Joi.string()).optional(),
  search: Joi.string().max(255).optional(),
  sortBy: Joi.string().valid('name', 'contextLength', 'createdAt').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional()
});

// ============================================================================
// Validation Utilities
// ============================================================================

export interface ValidationOptions {
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

export class DynamicProviderValidator {
  /**
   * Validate create provider request
   */
  static validateCreateProvider(data: any, options: ValidationOptions = {}): {
    value: CreateProviderRequest;
    error?: Joi.ValidationError;
  } {
    const result = createProviderSchema.validate(data, {
      allowUnknown: options.allowUnknown ?? false,
      stripUnknown: options.stripUnknown ?? true,
      abortEarly: options.abortEarly ?? false
    });
    return result.error
      ? { value: result.value, error: result.error }
      : { value: result.value };
  }

  /**
   * Validate update provider request
   */
  static validateUpdateProvider(data: any, options: ValidationOptions = {}): {
    value: UpdateProviderRequest;
    error?: Joi.ValidationError;
  } {
    const result = updateProviderSchema.validate(data, {
      allowUnknown: options.allowUnknown ?? false,
      stripUnknown: options.stripUnknown ?? true,
      abortEarly: options.abortEarly ?? false
    });
    return result.error
      ? { value: result.value, error: result.error }
      : { value: result.value };
  }

  /**
   * Validate create model request
   */
  static validateCreateModel(data: any, options: ValidationOptions = {}): {
    value: CreateModelRequest;
    error?: Joi.ValidationError;
  } {
    const result = createModelSchema.validate(data, {
      allowUnknown: options.allowUnknown ?? false,
      stripUnknown: options.stripUnknown ?? true,
      abortEarly: options.abortEarly ?? false
    });
    return result.error
      ? { value: result.value, error: result.error }
      : { value: result.value };
  }

  /**
   * Validate update model request
   */
  static validateUpdateModel(data: any, options: ValidationOptions = {}): {
    value: UpdateModelRequest;
    error?: Joi.ValidationError;
  } {
    const result = updateModelSchema.validate(data, {
      allowUnknown: options.allowUnknown ?? false,
      stripUnknown: options.stripUnknown ?? true,
      abortEarly: options.abortEarly ?? false
    });
    return result.error
      ? { value: result.value, error: result.error }
      : { value: result.value };
  }

  /**
   * Validate create template request
   */
  static validateCreateTemplate(data: any, options: ValidationOptions = {}): {
    value: CreateTemplateRequest;
    error?: Joi.ValidationError;
  } {
    const result = createTemplateSchema.validate(data, {
      allowUnknown: options.allowUnknown ?? false,
      stripUnknown: options.stripUnknown ?? true,
      abortEarly: options.abortEarly ?? false
    });
    return result.error
      ? { value: result.value, error: result.error }
      : { value: result.value };
  }

  /**
   * Validate update template request
   */
  static validateUpdateTemplate(data: any, options: ValidationOptions = {}): {
    value: UpdateTemplateRequest;
    error?: Joi.ValidationError;
  } {
    const result = updateTemplateSchema.validate(data, {
      allowUnknown: options.allowUnknown ?? false,
      stripUnknown: options.stripUnknown ?? true,
      abortEarly: options.abortEarly ?? false
    });
    return result.error
      ? { value: result.value, error: result.error }
      : { value: result.value };
  }

  /**
   * Validate provider query parameters
   */
  static validateProviderQuery(data: any): {
    value: any;
    error?: Joi.ValidationError;
  } {
    const result = providerQuerySchema.validate(data, {
      allowUnknown: false,
      stripUnknown: true,
      abortEarly: false
    });
    return result.error
      ? { value: result.value, error: result.error }
      : { value: result.value };
  }

  /**
   * Validate model query parameters
   */
  static validateModelQuery(data: any): {
    value: any;
    error?: Joi.ValidationError;
  } {
    const result = modelQuerySchema.validate(data, {
      allowUnknown: false,
      stripUnknown: true,
      abortEarly: false
    });
    return result.error
      ? { value: result.value, error: result.error }
      : { value: result.value };
  }

  /**
   * Validate provider identifier format
   */
  static validateProviderIdentifier(identifier: string): boolean {
    const result = Joi.string()
      .pattern(/^[a-z0-9-_]+$/)
      .min(2)
      .max(50)
      .validate(identifier);

    return !result.error;
  }

  /**
   * Validate model identifier format
   */
  static validateModelIdentifier(identifier: string): boolean {
    const result = Joi.string()
      .pattern(/^[a-zA-Z0-9-_./:]+$/)
      .min(1)
      .max(100)
      .validate(identifier);

    return !result.error;
  }

  /**
   * Validate API endpoint URL
   */
  static validateApiEndpoint(url: string): boolean {
    const result = Joi.string().uri().validate(url);
    return !result.error;
  }

  /**
   * Check if auth config matches auth method
   */
  static validateAuthConfigConsistency(authMethod: AuthMethod, authConfig: any): boolean {
    if (authConfig.type !== authMethod) {
      return false;
    }

    // Validate required fields based on auth method
    switch (authMethod) {
      case 'api_key':
        return authConfig.fields && authConfig.fields.apiKey;
      case 'oauth2':
        return authConfig.fields &&
          authConfig.fields.clientId &&
          authConfig.fields.clientSecret &&
          authConfig.fields.tokenUrl;
      case 'aws_iam':
        return authConfig.fields &&
          authConfig.fields.accessKeyId &&
          authConfig.fields.secretAccessKey &&
          authConfig.fields.region;
      case 'custom':
        return authConfig.fields && Object.keys(authConfig.fields).length > 0;
      default:
        return false;
    }
  }
}

// ============================================================================
// Custom Validation Rules
// ============================================================================

/**
 * Validate that context length is consistent between provider and model capabilities
 */
export function validateContextLengthConsistency(
  providerMaxContext: number,
  modelMaxContext: number
): boolean {
  return modelMaxContext <= providerMaxContext;
}

/**
 * Validate that model capabilities are subset of provider capabilities
 */
export function validateCapabilityConsistency(
  providerCapabilities: any,
  modelCapabilities: any
): { valid: boolean; conflicts: string[] } {
  const conflicts: string[] = [];

  // Check system messages support
  if (modelCapabilities.supportsSystemMessages && !providerCapabilities.supportsSystemMessages) {
    conflicts.push('Model supports system messages but provider does not');
  }

  // Check streaming support
  if (modelCapabilities.supportsStreaming && !providerCapabilities.supportsStreaming) {
    conflicts.push('Model supports streaming but provider does not');
  }

  // Check tools support
  if (modelCapabilities.supportsTools && !providerCapabilities.supportsTools) {
    conflicts.push('Model supports tools but provider does not');
  }

  // Check context length
  if (modelCapabilities.maxContextLength > providerCapabilities.maxContextLength) {
    conflicts.push('Model context length exceeds provider maximum');
  }

  // Check supported roles
  if (modelCapabilities.supportedRoles) {
    const unsupportedRoles = modelCapabilities.supportedRoles.filter(
      (role: string) => !providerCapabilities.supportedRoles.includes(role)
    );
    if (unsupportedRoles.length > 0) {
      conflicts.push(`Model supports roles not supported by provider: ${unsupportedRoles.join(', ')}`);
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts
  };
}