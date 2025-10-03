/**
 * Extended Connection Types for Dynamic Provider Support
 * 
 * This file extends the existing connection types to support dynamic providers
 * while maintaining backward compatibility with hardcoded provider types.
 */

import { 
  LLMConnection as BaseLLMConnection,
  OpenAIConfig,
  BedrockConfig,
  MicrosoftCopilotConfig,
  ConnectionTestResult,
  ConnectionErrorCode
} from './connections.js';
import { Provider, Model } from './dynamic-providers.js';

// ============================================================================
// Extended Connection Types
// ============================================================================

/**
 * Extended LLM Connection that supports both legacy hardcoded providers
 * and new dynamic providers
 */
export interface ExtendedLLMConnection extends Omit<BaseLLMConnection, 'provider' | 'config'> {
  // Legacy provider support (for backward compatibility)
  provider?: 'openai' | 'bedrock' | 'microsoft-copilot';
  config?: OpenAIConfig | BedrockConfig | MicrosoftCopilotConfig;
  
  // Dynamic provider support
  providerId?: string;           // Reference to dynamic provider
  dynamicConfig?: DynamicConnectionConfig;
  
  // Connection metadata
  connectionType: 'legacy' | 'dynamic';
  selectedModels?: string[];     // Model identifiers for dynamic providers
  defaultModel?: string;         // Default model identifier
}

/**
 * Configuration for dynamic provider connections
 */
export interface DynamicConnectionConfig {
  // Authentication credentials (will be encrypted)
  credentials: Record<string, any>;
  
  // Provider-specific settings
  settings?: {
    baseUrl?: string;
    apiVersion?: string;
    timeout?: number;
    retries?: number;
    customHeaders?: Record<string, string>;
  };
  
  // Model preferences
  modelPreferences?: {
    preferredModels?: string[];
    excludedModels?: string[];
    defaultModel?: string;
  };
}

/**
 * Enhanced connection test result with dynamic provider information
 */
export interface ExtendedConnectionTestResult extends ConnectionTestResult {
  // Provider information
  providerInfo?: {
    id: string;
    name: string;
    version?: string;
    capabilities?: string[];
  };
  
  // Model availability
  modelAvailability?: {
    total: number;
    available: number;
    unavailable: number;
    models: ModelAvailabilityInfo[];
  };
  
  // Performance metrics
  performance?: {
    averageLatency: number;
    minLatency: number;
    maxLatency: number;
    successRate: number;
  };
}

export interface ModelAvailabilityInfo {
  identifier: string;
  name: string;
  available: boolean;
  latency?: number;
  error?: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Create connection request supporting both legacy and dynamic providers
 */
export interface ExtendedCreateConnectionRequest {
  name: string;
  
  // Legacy provider (for backward compatibility)
  provider?: 'openai' | 'bedrock' | 'microsoft-copilot';
  config?: OpenAIConfig | BedrockConfig | MicrosoftCopilotConfig;
  
  // Dynamic provider
  providerId?: string;
  dynamicConfig?: DynamicConnectionConfig;
  selectedModels?: string[];
}

/**
 * Update connection request supporting both legacy and dynamic providers
 */
export interface ExtendedUpdateConnectionRequest {
  name?: string;
  status?: 'active' | 'inactive';
  
  // Legacy provider updates
  config?: Partial<OpenAIConfig | BedrockConfig | MicrosoftCopilotConfig>;
  
  // Dynamic provider updates
  dynamicConfig?: Partial<DynamicConnectionConfig>;
  selectedModels?: string[];
  defaultModel?: string;
}

/**
 * Connection response with provider and model information
 */
export interface ExtendedConnectionResponse {
  connection: ExtendedLLMConnection;
  provider?: Provider;           // Dynamic provider info
  availableModels?: Model[];     // Available models for the provider
}

/**
 * Connection list response with enhanced information
 */
export interface ExtendedConnectionListResponse {
  connections: ExtendedLLMConnection[];
  total: number;
  providers?: Provider[];        // All available dynamic providers
  summary?: {
    legacy: number;
    dynamic: number;
    byProvider: Record<string, number>;
  };
}

// ============================================================================
// Migration Types
// ============================================================================

/**
 * Migration plan for converting legacy connections to dynamic providers
 */
export interface ConnectionMigrationPlan {
  connectionId: string;
  currentProvider: string;
  targetProviderId: string;
  migrationSteps: MigrationStep[];
  estimatedDuration: number;
  risks: MigrationRisk[];
}

export interface MigrationStep {
  step: number;
  description: string;
  action: 'validate' | 'backup' | 'convert' | 'test' | 'activate';
  estimated: number; // seconds
  reversible: boolean;
}

export interface MigrationRisk {
  level: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

/**
 * Migration result for a single connection
 */
export interface ConnectionMigrationResult {
  connectionId: string;
  success: boolean;
  migratedAt?: Date;
  newProviderId?: string;
  backupId?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Batch migration request
 */
export interface BatchMigrationRequest {
  connectionIds: string[];
  targetProviderMappings?: Record<string, string>; // legacy provider -> dynamic provider ID
  options?: {
    dryRun?: boolean;
    createBackup?: boolean;
    validateOnly?: boolean;
    continueOnError?: boolean;
  };
}

/**
 * Batch migration result
 */
export interface BatchMigrationResult {
  totalConnections: number;
  successful: number;
  failed: number;
  skipped: number;
  results: ConnectionMigrationResult[];
  summary: {
    duration: number;
    backupsCreated: number;
    errors: string[];
    warnings: string[];
  };
}

// ============================================================================
// Compatibility Types
// ============================================================================

/**
 * Provider mapping for legacy to dynamic provider conversion
 */
export interface ProviderMapping {
  legacyProvider: 'openai' | 'bedrock' | 'microsoft-copilot';
  dynamicProviderId: string;
  configMapping: ConfigFieldMapping[];
  modelMapping: ModelMapping[];
}

export interface ConfigFieldMapping {
  legacyField: string;
  dynamicField: string;
  transform?: (value: any) => any;
  required: boolean;
}

export interface ModelMapping {
  legacyModel: string;
  dynamicModel: string;
  deprecated?: boolean;
  replacement?: string;
}

/**
 * Compatibility checker result
 */
export interface CompatibilityCheckResult {
  compatible: boolean;
  issues: CompatibilityIssue[];
  recommendations: string[];
  migrationRequired: boolean;
}

export interface CompatibilityIssue {
  type: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  resolution?: string;
}

// ============================================================================
// Database Record Types
// ============================================================================

/**
 * Extended connection record for database storage
 */
export interface ExtendedConnectionRecord {
  id: string;
  name: string;
  
  // Legacy provider fields (nullable for dynamic providers)
  provider?: 'openai' | 'bedrock' | 'microsoft-copilot';
  encrypted_config?: string;
  
  // Dynamic provider fields (nullable for legacy providers)
  provider_id?: string;
  encrypted_dynamic_config?: string;
  selected_models?: string; // JSON array of model identifiers
  default_model?: string;
  
  // Common fields
  connection_type: 'legacy' | 'dynamic';
  status: 'active' | 'inactive' | 'error';
  created_at: Date;
  updated_at: Date;
  last_tested?: Date;
  user_id: string;
  
  // Migration tracking
  migrated_from?: string;      // Original legacy provider if migrated
  migrated_at?: Date;
  migration_backup_id?: string;
}

// ============================================================================
// Service Interface Extensions
// ============================================================================

/**
 * Extended connection service interface
 */
export interface ExtendedConnectionService {
  // Legacy connection methods (for backward compatibility)
  createLegacyConnection(userId: string, request: ExtendedCreateConnectionRequest): Promise<ExtendedLLMConnection>;
  
  // Dynamic connection methods
  createDynamicConnection(userId: string, providerId: string, config: DynamicConnectionConfig): Promise<ExtendedLLMConnection>;
  
  // Universal methods (work with both legacy and dynamic)
  getConnection(userId: string, connectionId: string): Promise<ExtendedLLMConnection>;
  updateConnection(userId: string, connectionId: string, request: ExtendedUpdateConnectionRequest): Promise<ExtendedLLMConnection>;
  testConnection(userId: string, connectionId: string): Promise<ExtendedConnectionTestResult>;
  
  // Migration methods
  planMigration(connectionId: string, targetProviderId?: string): Promise<ConnectionMigrationPlan>;
  migrateConnection(connectionId: string, plan: ConnectionMigrationPlan): Promise<ConnectionMigrationResult>;
  batchMigrate(request: BatchMigrationRequest): Promise<BatchMigrationResult>;
  
  // Compatibility methods
  checkCompatibility(connectionId: string, targetProviderId: string): Promise<CompatibilityCheckResult>;
  getProviderMappings(): Promise<ProviderMapping[]>;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Connection type guard functions
 */
export function isLegacyConnection(connection: ExtendedLLMConnection): connection is ExtendedLLMConnection & {
  provider: 'openai' | 'bedrock' | 'microsoft-copilot';
  config: OpenAIConfig | BedrockConfig | MicrosoftCopilotConfig;
} {
  return connection.connectionType === 'legacy' && !!connection.provider && !!connection.config;
}

export function isDynamicConnection(connection: ExtendedLLMConnection): connection is ExtendedLLMConnection & {
  providerId: string;
  dynamicConfig: DynamicConnectionConfig;
} {
  return connection.connectionType === 'dynamic' && !!connection.providerId && !!connection.dynamicConfig;
}

/**
 * Configuration type guards
 */
export function isOpenAIConfig(config: any): config is OpenAIConfig {
  return config && typeof config.apiKey === 'string' && Array.isArray(config.models);
}

export function isBedrockConfig(config: any): config is BedrockConfig {
  return config && typeof config.accessKeyId === 'string' && typeof config.secretAccessKey === 'string';
}

export function isMicrosoftCopilotConfig(config: any): config is MicrosoftCopilotConfig {
  return config && typeof config.apiKey === 'string' && typeof config.endpoint === 'string';
}

// ============================================================================
// Error Extensions
// ============================================================================

export enum ExtendedConnectionErrorCode {
  // Legacy error codes (re-exported)
  INVALID_API_KEY = ConnectionErrorCode.INVALID_API_KEY,
  INVALID_CREDENTIALS = ConnectionErrorCode.INVALID_CREDENTIALS,
  PROVIDER_UNAVAILABLE = ConnectionErrorCode.PROVIDER_UNAVAILABLE,
  MODEL_NOT_AVAILABLE = ConnectionErrorCode.MODEL_NOT_AVAILABLE,
  QUOTA_EXCEEDED = ConnectionErrorCode.QUOTA_EXCEEDED,
  NETWORK_ERROR = ConnectionErrorCode.NETWORK_ERROR,
  ENCRYPTION_ERROR = ConnectionErrorCode.ENCRYPTION_ERROR,
  DECRYPTION_ERROR = ConnectionErrorCode.DECRYPTION_ERROR,
  CONNECTION_TIMEOUT = ConnectionErrorCode.CONNECTION_TIMEOUT,
  
  // New error codes for dynamic providers
  DYNAMIC_PROVIDER_NOT_FOUND = 'DYNAMIC_PROVIDER_NOT_FOUND',
  DYNAMIC_PROVIDER_INACTIVE = 'DYNAMIC_PROVIDER_INACTIVE',
  INVALID_DYNAMIC_CONFIG = 'INVALID_DYNAMIC_CONFIG',
  MODEL_NOT_SUPPORTED = 'MODEL_NOT_SUPPORTED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  MIGRATION_IN_PROGRESS = 'MIGRATION_IN_PROGRESS',
  COMPATIBILITY_CHECK_FAILED = 'COMPATIBILITY_CHECK_FAILED',
  BACKUP_CREATION_FAILED = 'BACKUP_CREATION_FAILED',
  ROLLBACK_FAILED = 'ROLLBACK_FAILED'
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default provider mappings for migration
 */
export const DEFAULT_PROVIDER_MAPPINGS: Record<string, string> = {
  'openai': 'openai',
  'bedrock': 'bedrock', 
  'microsoft-copilot': 'microsoft-copilot'
};

/**
 * Migration configuration
 */
export const MIGRATION_CONFIG = {
  BACKUP_RETENTION_DAYS: 30,
  MAX_BATCH_SIZE: 50,
  DEFAULT_TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  VALIDATION_TIMEOUT: 10000
} as const;