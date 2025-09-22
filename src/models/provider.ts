// Provider-related models

// Provider-related models

export interface ProviderCapabilities {
  supportsSystemMessages: boolean;
  supportsMultipleMessages: boolean;
  supportsTemperature: boolean;
  supportsTopP: boolean;
  supportsMaxTokens: boolean;
  maxContextLength: number;
  supportedMessageRoles: string[];
}

export interface ProviderModel {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  deprecated: boolean;
  capabilities: ProviderCapabilities;
}

export interface ProviderConfiguration {
  id: string;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel: string;
  models: ProviderModel[];
  rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}