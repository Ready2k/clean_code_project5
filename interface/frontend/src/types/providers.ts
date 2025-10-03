/**
 * Frontend Provider Management Types
 * 
 * This file contains TypeScript interfaces and types for the frontend
 * provider management interface, based on the backend dynamic provider types.
 */

// ============================================================================
// Core Provider Types (Frontend)
// ============================================================================

export interface Provider {
  id: string;
  identifier: string;
  name: string;
  description?: string;
  apiEndpoint: string;
  authMethod: AuthMethod;
  authConfig: AuthConfig;
  capabilities: ProviderCapabilities;
  status: ProviderStatus;
  isSystem: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  lastTested?: string;
  testResult?: ProviderTestResult;
}

export type AuthMethod = 'api_key' | 'oauth2' | 'aws_iam' | 'custom';
export type ProviderStatus = 'active' | 'inactive' | 'testing';

export interface ProviderCapabilities {
  supportsSystemMessages: boolean;
  maxContextLength: number;
  supportedRoles: string[];
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportedAuthMethods: AuthMethod[];
  rateLimits?: RateLimitConfig;
}

export interface RateLimitConfig {
  requestsPerMinute?: number;
  tokensPerMinute?: number;
  requestsPerDay?: number;
  tokensPerDay?: number;
}

// ============================================================================
// Authentication Configuration Types
// ============================================================================

export interface AuthConfig {
  type: AuthMethod;
  fields: Record<string, AuthField>;
  headers?: Record<string, string>;
  testEndpoint?: string;
}

export interface AuthField {
  required: boolean;
  description: string;
  default?: string;
  sensitive?: boolean;
  validation?: AuthFieldValidation;
}

export interface AuthFieldValidation {
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  options?: string[];
}

// ============================================================================
// Model Types
// ============================================================================

export interface Model {
  id: string;
  providerId: string;
  identifier: string;
  name: string;
  description?: string;
  contextLength: number;
  capabilities: ModelCapabilities;
  pricingInfo?: PricingInfo;
  status: ModelStatus;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ModelStatus = 'active' | 'inactive' | 'deprecated';

export interface ModelCapabilities {
  supportsSystemMessages: boolean;
  maxContextLength: number;
  supportedRoles: string[];
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsFunctionCalling: boolean;
  supportsVision?: boolean;
  supportsAudio?: boolean;
  supportsImageGeneration?: boolean;
  supportsCodeExecution?: boolean;
}

export interface PricingInfo {
  inputTokenPrice?: number;
  outputTokenPrice?: number;
  currency?: string;
  billingUnit?: string;
  lastUpdated?: string;
}

// ============================================================================
// Provider Template Types
// ============================================================================

export interface ProviderTemplate {
  id: string;
  name: string;
  description?: string;
  providerConfig: ProviderTemplateConfig;
  defaultModels: ModelTemplateConfig[];
  isSystem: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderTemplateConfig {
  name: string;
  description?: string;
  apiEndpoint: string;
  authMethod: AuthMethod;
  authConfig: AuthConfig;
  capabilities?: Partial<ProviderCapabilities>;
}

export interface ModelTemplateConfig {
  identifier: string;
  name: string;
  description?: string;
  contextLength: number;
  capabilities?: Partial<ModelCapabilities>;
  isDefault?: boolean;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface CreateProviderRequest {
  identifier: string;
  name: string;
  description?: string;
  apiEndpoint: string;
  authMethod: AuthMethod;
  authConfig: AuthConfig;
  capabilities: ProviderCapabilities;
}

export interface UpdateProviderRequest {
  name?: string;
  description?: string;
  apiEndpoint?: string;
  authConfig?: Partial<AuthConfig>;
  capabilities?: Partial<ProviderCapabilities>;
  status?: ProviderStatus;
}

export interface ProviderResponse {
  provider: Provider;
}

export interface ProviderListResponse {
  providers: Provider[];
  total: number;
  page?: number;
  limit?: number;
}

export interface CreateModelRequest {
  identifier: string;
  name: string;
  description?: string;
  contextLength: number;
  capabilities: ModelCapabilities;
  pricingInfo?: PricingInfo;
  isDefault?: boolean;
}

export interface UpdateModelRequest {
  name?: string;
  description?: string;
  contextLength?: number;
  capabilities?: Partial<ModelCapabilities>;
  pricingInfo?: PricingInfo;
  status?: ModelStatus;
  isDefault?: boolean;
}

export interface ModelResponse {
  model: Model;
}

export interface ModelListResponse {
  models: Model[];
  total: number;
  providerId?: string;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  providerConfig: ProviderTemplateConfig;
  defaultModels: ModelTemplateConfig[];
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  providerConfig?: Partial<ProviderTemplateConfig>;
  defaultModels?: ModelTemplateConfig[];
}

export interface TemplateResponse {
  template: ProviderTemplate;
}

export interface TemplateListResponse {
  templates: ProviderTemplate[];
  total: number;
}

export interface ApplyTemplateRequest {
  templateId: string;
  customizations?: {
    name?: string;
    description?: string;
    authConfig?: Record<string, any>;
    selectedModels?: string[];
  };
}

// ============================================================================
// Testing and Validation Types
// ============================================================================

export interface ProviderTestResult {
  success: boolean;
  latency?: number;
  error?: string;
  availableModels?: string[];
  testedAt: string;
  capabilities?: Partial<ProviderCapabilities>;
}

export interface ModelTestResult {
  success: boolean;
  latency?: number;
  error?: string;
  testedAt: string;
  actualCapabilities?: Partial<ModelCapabilities>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  details?: any;
}

export interface ValidationWarning {
  field: string;
  code: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// Statistics and Dashboard Types
// ============================================================================

export interface ProviderStats {
  providerId: string;
  identifier: string;
  name: string;
  status: ProviderStatus;
  modelCount: number;
  activeModels: number;
  lastTested?: string;
  testResult?: ProviderTestResult;
  createdAt: string;
  updatedAt: string;
  usageStats?: {
    totalRequests: number;
    totalTokens: number;
    averageLatency: number;
    errorRate: number;
    lastUsed?: string;
  };
}

export interface ModelStats {
  modelId: string;
  identifier: string;
  name: string;
  providerId: string;
  status: ModelStatus;
  contextLength: number;
  isDefault: boolean;
  capabilities: ModelCapabilities;
  pricingInfo?: PricingInfo;
  createdAt: string;
  updatedAt: string;
  usageStats?: {
    totalRequests: number;
    totalTokens: number;
    averageLatency: number;
    errorRate: number;
    lastUsed?: string;
  };
}

export interface SystemProviderStats {
  totalProviders: number;
  activeProviders: number;
  inactiveProviders: number;
  systemProviders: number;
  customProviders: number;
  totalModels: number;
  activeModels: number;
  totalTemplates: number;
  systemTemplates: number;
  customTemplates: number;
  lastUpdated: string;
}

export interface ProviderHealth {
  providerId: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: string;
  responseTime?: number;
  error?: string;
  uptime: number;
}

// ============================================================================
// UI State Types
// ============================================================================

export interface ProviderFormData {
  identifier: string;
  name: string;
  description: string;
  apiEndpoint: string;
  authMethod: AuthMethod;
  authConfig: Record<string, any>;
  capabilities: ProviderCapabilities;
}

export interface ModelFormData {
  identifier: string;
  name: string;
  description: string;
  contextLength: number;
  capabilities: ModelCapabilities;
  pricingInfo?: PricingInfo;
  isDefault: boolean;
}

export interface TemplateFormData {
  name: string;
  description: string;
  providerConfig: ProviderTemplateConfig;
  defaultModels: ModelTemplateConfig[];
}

export interface ProviderFilters {
  status?: ProviderStatus[];
  authMethod?: AuthMethod[];
  isSystem?: boolean;
  search?: string;
}

export interface ModelFilters {
  providerId?: string;
  status?: ModelStatus[];
  isDefault?: boolean;
  minContextLength?: number;
  maxContextLength?: number;
  capabilities?: string[];
  search?: string;
}

// ============================================================================
// Query Options
// ============================================================================

export interface ProviderQueryOptions {
  status?: ProviderStatus[];
  authMethod?: AuthMethod[];
  isSystem?: boolean;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastTested';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ModelQueryOptions {
  providerId?: string;
  status?: ModelStatus[];
  isDefault?: boolean;
  minContextLength?: number;
  maxContextLength?: number;
  capabilities?: string[];
  search?: string;
  sortBy?: 'name' | 'contextLength' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface TemplateQueryOptions {
  isSystem?: boolean;
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Import/Export Types
// ============================================================================

export interface ProviderExportData {
  providers: Omit<Provider, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'lastTested' | 'testResult'>[];
  models: Omit<Model, 'id' | 'providerId' | 'createdAt' | 'updatedAt'>[];
  templates: Omit<ProviderTemplate, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>[];
  exportedAt: string;
  version: string;
}

export interface ProviderImportRequest {
  data: ProviderExportData;
  options?: {
    overwriteExisting?: boolean;
    skipSystemProviders?: boolean;
    validateOnly?: boolean;
  };
}

export interface ProviderImportResult {
  success: boolean;
  imported: {
    providers: number;
    models: number;
    templates: number;
  };
  skipped: {
    providers: number;
    models: number;
    templates: number;
  };
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// ============================================================================
// Error Types
// ============================================================================

export enum DynamicProviderErrorCode {
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  PROVIDER_ALREADY_EXISTS = 'PROVIDER_ALREADY_EXISTS',
  MODEL_ALREADY_EXISTS = 'MODEL_ALREADY_EXISTS',
  INVALID_PROVIDER_CONFIG = 'INVALID_PROVIDER_CONFIG',
  INVALID_MODEL_CONFIG = 'INVALID_MODEL_CONFIG',
  PROVIDER_TEST_FAILED = 'PROVIDER_TEST_FAILED',
  MODEL_TEST_FAILED = 'MODEL_TEST_FAILED',
  PROVIDER_IN_USE = 'PROVIDER_IN_USE',
  MODEL_IN_USE = 'MODEL_IN_USE',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  INVALID_TEMPLATE = 'INVALID_TEMPLATE',
  TEMPLATE_APPLICATION_FAILED = 'TEMPLATE_APPLICATION_FAILED'
}