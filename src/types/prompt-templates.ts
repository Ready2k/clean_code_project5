/**
 * Types and interfaces for the customizable prompt template system
 * Core library version - simplified interfaces for integration
 */

export enum TemplateCategory {
  ENHANCEMENT = 'enhancement',
  QUESTION_GENERATION = 'question_generation',
  MOCK_RESPONSES = 'mock_responses',
  SYSTEM_PROMPTS = 'system_prompts',
  CUSTOM = 'custom'
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  defaultValue?: any;
}

export interface TemplateContext {
  provider?: string;
  taskType?: string;
  domainKnowledge?: string;
  userContext?: Record<string, any>;
}

export interface TemplateInfo {
  id: string;
  category: TemplateCategory;
  key: string;
  name: string;
  description: string;
  content: string;
  variables: TemplateVariable[];
  metadata: Record<string, any>;
  isActive: boolean;
  isDefault: boolean;
  version: number;
  lastModified: Date;
  usageCount: number;
}