export interface EnhancementJob {
  id: string;
  promptId: string;
  userId: string;
  status: 'pending' | 'analyzing' | 'enhancing' | 'generating_questions' | 'complete' | 'failed';
  progress: number;
  message: string;
  result?: EnhancementResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
  options?: EnhancementOptions;
}

export interface EnhancementOptions {
  preserve_style?: boolean;
  target_provider?: string;
}

export interface EnhancementResult {
  enhancedPrompt: {
    humanPrompt: {
      goal: string;
      audience: string;
      steps: string[];
      outputExpectations: string;
      examples?: string[];
    };
    structuredPrompt?: {
      systemMessage: string;
      userMessage: string;
      assistantMessage?: string;
      temperature?: number;
      maxTokens?: number;
    };
    variables: Array<{
      name: string;
      description: string;
      type: 'string' | 'number' | 'boolean' | 'array' | 'object';
      required: boolean;
      defaultValue?: any;
    }>;
  };
  rationale: string;
  confidence: number;
  questions?: EnhancementQuestion[];
  changes: EnhancementChange[];
}

export interface EnhancementQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'multiselect' | 'number' | 'boolean';
  required: boolean;
  options?: string[];
  placeholder?: string;
  helpText?: string;
}

export interface EnhancementChange {
  type: 'added' | 'modified' | 'removed';
  field: string;
  oldValue?: any;
  newValue?: any;
  description: string;
}

export interface EnhancementProgress {
  jobId: string;
  promptId: string;
  status: EnhancementJob['status'];
  progress: number;
  message: string;
  result?: EnhancementResult;
  error?: string;
}

export interface QuestionnaireResponse {
  jobId: string;
  answers: Record<string, any>;
}

export interface EnhancementStartRequest {
  preserve_style?: boolean;
  target_provider?: string;
}

export interface EnhancementJobResponse {
  jobId: string;
  message: string;
  statusUrl: string;
}