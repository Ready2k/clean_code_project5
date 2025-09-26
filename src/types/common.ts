// Common types used across the application

export type PromptStatus = 'draft' | 'active' | 'archived';

export type VariableType = 'string' | 'number' | 'select' | 'multiselect' | 'boolean';

export interface PromptFilters {
  status?: PromptStatus;
  tags?: string[];
  owner?: string;
  minRating?: number;
  searchTerm?: string;
}

export interface RenderOptions {
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  systemOverride?: string;
  variables?: Record<string, any>;
  // Microsoft Copilot specific parameters
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export interface EnhancementContext {
  userPreferences?: Record<string, any>;
  domainKnowledge?: string;
  targetProvider?: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  supportedModels: string[];
  defaultModel: string;
}

export interface ProviderPayload {
  provider: string;
  model: string;
  content: Record<string, any>;
  metadata?: Record<string, any>;
}