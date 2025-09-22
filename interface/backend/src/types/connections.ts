export interface LLMConnection {
  id: string;
  name: string;
  provider: 'openai' | 'bedrock';
  status: 'active' | 'inactive' | 'error';
  config: OpenAIConfig | BedrockConfig;
  createdAt: Date;
  updatedAt: Date;
  lastTested?: Date;
  userId: string; // Owner of the connection
}

export interface OpenAIConfig {
  apiKey: string; // Will be encrypted in storage
  organizationId?: string;
  baseUrl?: string;
  models: string[];
  defaultModel: string;
}

export interface BedrockConfig {
  accessKeyId: string; // Will be encrypted in storage
  secretAccessKey: string; // Will be encrypted in storage
  region: string;
  models: string[];
  defaultModel: string;
}

export interface ConnectionTestResult {
  success: boolean;
  latency?: number;
  error?: string;
  availableModels?: string[];
  testedAt: Date;
}

export interface CreateConnectionRequest {
  name: string;
  provider: 'openai' | 'bedrock';
  config: OpenAIConfig | BedrockConfig;
}

export interface UpdateConnectionRequest {
  name?: string;
  config?: Partial<OpenAIConfig | BedrockConfig>;
  status?: 'active' | 'inactive';
}

export interface ConnectionListResponse {
  connections: LLMConnection[];
  total: number;
}

export interface ConnectionResponse {
  connection: LLMConnection;
}

export interface ConnectionTestResponse {
  result: ConnectionTestResult;
}

export interface AvailableModelsResponse {
  models: string[];
  provider: string;
}

// Database schema interfaces
export interface ConnectionRecord {
  id: string;
  name: string;
  provider: 'openai' | 'bedrock';
  status: 'active' | 'inactive' | 'error';
  encrypted_config: string; // JSON string of encrypted config
  created_at: Date;
  updated_at: Date;
  last_tested?: Date;
  user_id: string;
}

// Validation schemas
export interface ConnectionValidationSchema {
  name: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  provider: {
    required: boolean;
    enum: string[];
  };
  config: {
    required: boolean;
  };
}

// Provider-specific model lists
export const OPENAI_MODELS = [
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4-turbo-preview',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-16k',
  'text-davinci-003',
  'text-davinci-002'
] as const;

export const BEDROCK_MODELS = [
  'anthropic.claude-3-sonnet-20240229-v1:0',
  'anthropic.claude-3-haiku-20240307-v1:0',
  'anthropic.claude-v2:1',
  'anthropic.claude-v2',
  'anthropic.claude-instant-v1',
  'amazon.titan-text-express-v1',
  'amazon.titan-text-lite-v1',
  'ai21.j2-ultra-v1',
  'ai21.j2-mid-v1',
  'cohere.command-text-v14',
  'cohere.command-light-text-v14',
  'meta.llama2-13b-chat-v1',
  'meta.llama2-70b-chat-v1'
] as const;

export type OpenAIModel = typeof OPENAI_MODELS[number];
export type BedrockModel = typeof BEDROCK_MODELS[number];

// Error types specific to connections
export enum ConnectionErrorCode {
  INVALID_API_KEY = 'INVALID_API_KEY',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  PROVIDER_UNAVAILABLE = 'PROVIDER_UNAVAILABLE',
  MODEL_NOT_AVAILABLE = 'MODEL_NOT_AVAILABLE',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT'
}