/**
 * Dynamic Provider Management Types
 * 
 * This file contains all TypeScript interfaces and types for the dynamic
 * provider management system, including providers, models, templates,
 * and related request/response types.
 */

// ============================================================================
// Core Provider Types
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
  createdAt: Date;
  updatedAt: Date;
  lastTested?: Date;
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
  fields: Record<string, AuthField | undefined>;
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

// Specific auth config types
export interface APIKeyAuthConfig extends AuthConfig {
  type: 'api_key';
  fields: {
    apiKey: AuthField;
    organizationId?: AuthField;
    baseUrl?: AuthField;
    [key: string]: AuthField | undefined;
  };
}

export interface OAuth2AuthConfig extends AuthConfig {
  type: 'oauth2';
  fields: {
    clientId: AuthField;
    clientSecret: AuthField;
    scope?: AuthField;
    tokenUrl: AuthField;
    [key: string]: AuthField | undefined;
  };
}

export interface AWSIAMAuthConfig extends AuthConfig {
  type: 'aws_iam';
  fields: {
    accessKeyId: AuthField;
    secretAccessKey: AuthField;
    region: AuthField;
    sessionToken?: AuthField;
    [key: string]: AuthField | undefined;
  };
}

export interface CustomAuthConfig extends AuthConfig {
  type: 'custom';
  fields: Record<string, AuthField>;
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
  createdAt: Date;
  updatedAt: Date;
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
  inputTokenPrice?: number;  // Price per 1K input tokens
  outputTokenPrice?: number; // Price per 1K output tokens
  currency?: string;         // Currency code (USD, EUR, etc.)
  billingUnit?: string;      // Billing unit (tokens, requests, etc.)
  lastUpdated?: Date;
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
  createdAt: Date;
  updatedAt: Date;
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

// Provider CRUD operations
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

// Model CRUD operations
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

// Template operations
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
    providerIdentifier?: string;
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
  testedAt: Date;
  capabilities?: Partial<ProviderCapabilities>;
}

export interface ModelTestResult {
  success: boolean;
  latency?: number;
  error?: string;
  testedAt: Date;
  actualCapabilities?: Partial<ModelCapabilities>;
}

export interface ValidationResult {
  valid: boolean;
  invalid?: ValidationError[];
  conflicts?: ValidationError[];
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
// Registry and Status Types
// ============================================================================

export interface ProviderRegistryStatus {
  totalProviders: number;
  activeProviders: number;
  inactiveProviders: number;
  systemProviders: number;
  customProviders: number;
  lastRefresh: Date;
  cacheAge: number;
}

export interface ProviderHealth {
  providerId: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
  uptime: number;
}

export interface SystemProviderStats {
  totalProviders: number;
  totalModels: number;
  activeConnections: number;
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  byProvider: Record<string, {
    models: number;
    connections: number;
    requests: number;
    errors: number;
  }>;
}

// ============================================================================
// Import/Export Types
// ============================================================================

export interface ProviderExportData {
  providers: Omit<Provider, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'lastTested' | 'testResult'>[];
  models: Omit<Model, 'id' | 'providerId' | 'createdAt' | 'updatedAt'>[];
  templates: Omit<ProviderTemplate, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>[];
  exportedAt: Date;
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
// Query and Filter Types
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
  includeModels?: boolean;
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

// ============================================================================
// Database Record Types (for internal use)
// ============================================================================

export interface ProviderRecord {
  id: string;
  identifier: string;
  name: string;
  description?: string;
  api_endpoint: string;
  auth_method: AuthMethod;
  auth_config: any; // JSONB
  capabilities: any; // JSONB
  status: ProviderStatus;
  is_system: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
  last_tested?: Date;
  test_result?: any; // JSONB
}

export interface ModelRecord {
  id: string;
  provider_id: string;
  identifier: string;
  name: string;
  description?: string;
  context_length: number;
  capabilities: any; // JSONB
  pricing_info?: any; // JSONB
  status: ModelStatus;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ProviderTemplateRecord {
  id: string;
  name: string;
  description?: string;
  provider_config: any; // JSONB
  default_models: any; // JSONB
  is_system: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Import/Export and Backup Types
// ============================================================================

export type ExportFormat = 'json' | 'yaml';

export interface ExportOptions {
  format?: ExportFormat;
  includeModels?: boolean;
  includeTemplates?: boolean;
  includeSystemProviders?: boolean;
  excludeCredentials?: boolean;
  providerIds?: string[];
  templateIds?: string[];
}

export interface ImportOptions {
  format?: ExportFormat;
  overwriteExisting?: boolean;
  skipValidation?: boolean;
  dryRun?: boolean;
  conflictResolution?: 'skip' | 'overwrite' | 'merge' | 'rename';
  importModels?: boolean;
  importTemplates?: boolean;
  createdBy?: string;
}

export interface BackupOptions {
  includeSystemProviders?: boolean;
  includeCredentials?: boolean;
  compression?: boolean;
  encryption?: boolean;
  encryptionKey?: string;
}

export interface RestoreOptions {
  overwriteExisting?: boolean;
  validateBeforeRestore?: boolean;
  restoreCredentials?: boolean;
  decryptionKey?: string;
}

export interface BackupInfo {
  id: string;
  filename: string;
  size: number;
  providerCount: number;
  modelCount: number;
  templateCount: number;
  createdAt: string;
  compressed: boolean;
  encrypted: boolean;
}

export interface ImportResult<T> {
  imported: T[];
  skipped: Array<{ identifier: string; reason: string }>;
  errors: Array<{ identifier: string; error: string }>;
}

// Removed duplicate ValidationResult interface - using the one defined earlier

// ============================================================================
// Template Query Types
// ============================================================================

export interface TemplateQueryOptions {
  isSystem?: boolean;
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TemplateListResult {
  templates: ProviderTemplate[];
  total: number;
}

// ============================================================================
// Bulk Operation Types
// ============================================================================

export interface BulkOperationResult<T> {
  successful: T[];
  errors: Array<{ item: any; error: string }>;
}

export interface ModelImportOptions {
  overwrite?: boolean;
  dryRun?: boolean;
}

export interface ModelImportResult {
  imported: Model[];
  skipped: Array<{ identifier: string; reason: string }>;
  errors: Array<{ identifier: string; error: string }>;
}

// ============================================================================
// Statistics and Analytics Types
// ============================================================================

export interface ProviderStats {
  providerId: string;
  identifier: string;
  name: string;
  status: ProviderStatus;
  modelCount: number;
  activeModels: number;
  lastTested?: Date;
  testResult?: ProviderTestResult;
  createdAt: Date;
  updatedAt: Date;
  usageStats?: {
    totalRequests: number;
    totalTokens: number;
    averageLatency: number;
    errorRate: number;
    lastUsed?: Date;
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
  createdAt: Date;
  updatedAt: Date;
  usageStats?: {
    totalRequests: number;
    totalTokens: number;
    averageLatency: number;
    errorRate: number;
    lastUsed?: Date;
  };
}

export interface DetailedSystemProviderStats {
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
  lastUpdated: Date;
}