export interface LLMConnection {
  id: string;
  name: string;
  provider: 'openai' | 'bedrock';
  status: 'active' | 'inactive' | 'error';
  config: OpenAIConfig | BedrockConfig;
  createdAt: string;
  updatedAt: string;
  lastTested: string;
}

export interface OpenAIConfig {
  apiKey: string; // encrypted
  organizationId?: string;
  baseUrl?: string;
  models: string[];
  defaultModel: string;
}

export interface BedrockConfig {
  accessKeyId: string; // encrypted
  secretAccessKey: string; // encrypted
  region: string;
  models: string[];
  defaultModel: string;
}

export interface ConnectionTestResult {
  success: boolean;
  latency?: number;
  error?: string;
  availableModels?: string[];
  testedAt: string;
}

export interface CreateConnectionRequest {
  name: string;
  provider: 'openai' | 'bedrock';
  config: OpenAIConfig | BedrockConfig;
}

export interface UpdateConnectionRequest {
  name?: string;
  config?: Partial<OpenAIConfig | BedrockConfig>;
}