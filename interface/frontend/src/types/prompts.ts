export interface PromptRecord {
  id: string;
  metadata: PromptMetadata & {
    created_at: string;
    updated_at: string;
  };
  humanPrompt: HumanPrompt;
  structuredPrompt?: StructuredPrompt;
  variables: Variable[];
  status: PromptStatus;
  version: number;
  ratings: Rating[];
  averageRating?: number;
}

export interface PromptMetadata {
  title: string;
  summary: string;
  tags: string[];
  owner: string;
  category?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface HumanPrompt {
  goal: string;
  audience: string;
  steps: string[];
  output_expectations: {
    format: string;
    fields: string[];
  };
}

export interface StructuredPrompt {
  systemMessage: string;
  userMessage: string;
  assistantMessage?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Variable {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  required: boolean;
  sensitive: boolean;
  options?: string[];
  default?: any;
}

export interface ValidationRule {
  type: 'minLength' | 'maxLength' | 'pattern' | 'min' | 'max' | 'required';
  value: any;
  message: string;
}

export interface Rating {
  id: string;
  userId: string;
  username?: string;
  score: number; // 1-5
  note?: string;
  createdAt: string;
}

export type PromptStatus = 'draft' | 'active' | 'archived' | 'deprecated';

export interface PromptFilters {
  search?: string;
  tags?: string[];
  owner?: string;
  status?: PromptStatus[];
  rating?: { min: number; max: number };
  dateRange?: { start: string; end: string };
  sortBy?: 'title' | 'created_at' | 'updated_at' | 'rating';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CreatePromptRequest {
  metadata: {
    title: string;
    summary: string;
    tags: string[];
  };
  humanPrompt: HumanPrompt;
}

export interface UpdatePromptRequest {
  metadata?: Partial<PromptMetadata>;
  humanPrompt?: Partial<HumanPrompt>;
  variables?: Variable[];
}

export interface PromptsResponse {
  items: PromptRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// Rendering types
export interface RenderOptions {
  model?: string;
  targetModel?: string;
  temperature?: number;
  maxTokens?: number;
  variables?: Record<string, any>;
  version?: 'original' | 'enhanced' | 'original-no-adapt';
}

export interface ProviderPayload {
  provider: string;
  model: string;
  payload: string;
  variables: Record<string, any>;
  metadata: {
    temperature?: number;
    maxTokens?: number;
    timestamp: string;
  };
}

export interface RenderResult {
  id: string;
  promptId: string;
  connectionId: string;
  provider: string;
  model: string;
  targetModel?: string;
  payload: string | {
    provider: string;
    model?: string;
    messages: Array<{
      role: string;
      content: string;
    }>;
    parameters?: Record<string, any>;
    formatted_prompt: string;
    response?: string;
  };
  variables: Record<string, any>;
  createdAt: string;
  success: boolean;
  error?: string;
}