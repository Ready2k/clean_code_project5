/**
 * Types and interfaces for the customizable prompt template system
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
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'select' | 'multiselect';
  description: string;
  required: boolean;
  defaultValue?: any;
  validation?: ValidationRule[];
  options?: string[];
}

export interface ValidationRule {
  type: 'minLength' | 'maxLength' | 'pattern' | 'enum' | 'min' | 'max';
  value: any;
  message?: string;
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
  metadata: TemplateMetadata;
  isActive: boolean;
  isDefault: boolean;
  version: number;
  lastModified: Date;
  createdAt: Date;
  createdBy?: string;
  updatedBy?: string;
  usageCount: number;
}

export interface TemplateMetadata {
  provider_optimized?: string[];
  task_types?: string[];
  complexity_level?: 'basic' | 'intermediate' | 'advanced';
  tags?: string[];
  [key: string]: any;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  content: string;
  variables: TemplateVariable[];
  metadata: TemplateMetadata;
  changeMessage?: string;
  createdAt: Date;
  createdBy?: string;
}

export interface TemplateFilters {
  category?: TemplateCategory;
  isActive?: boolean;
  isDefault?: boolean;
  search?: string;
  tags?: string[];
  provider?: string;
  limit?: number;
  offset?: number;
}

export interface CreateTemplateRequest {
  category: TemplateCategory;
  key: string;
  name: string;
  description: string;
  content: string;
  variables: TemplateVariable[];
  metadata?: TemplateMetadata;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  content?: string;
  variables?: TemplateVariable[];
  metadata?: TemplateMetadata;
  isActive?: boolean;
  changeMessage?: string;
}

export interface TemplateTestData {
  variables: Record<string, any>;
  context?: TemplateContext;
}

export interface TemplateTestResult {
  success: boolean;
  renderedContent: string;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
  performance?: {
    renderTime: number;
    variableSubstitutions: number;
  };
}

export interface ValidationError {
  type: 'SYNTAX_ERROR' | 'MISSING_VARIABLE' | 'INVALID_VARIABLE' | 'SECURITY_VIOLATION';
  message: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationWarning {
  type: 'UNUSED_VARIABLE' | 'DEPRECATED_SYNTAX' | 'PERFORMANCE_CONCERN' | 'SECURITY_CONCERN';
  message: string;
  suggestion?: string;
}

export interface SyntaxValidationResult extends ValidationResult {}
export interface VariableValidationResult extends ValidationResult {}
export interface SecurityValidationResult extends ValidationResult {}
export interface CompatibilityValidationResult extends ValidationResult {}

export interface SecurityViolation {
  type: 'CODE_INJECTION' | 'SENSITIVE_DATA' | 'UNSAFE_PATTERN';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface UsageContext {
  userId?: string;
  sessionId?: string;
  provider?: string;
  taskType?: string;
  timestamp: Date;
}

export interface PerformanceData {
  renderTime: number;
  cacheHit: boolean;
  variableCount: number;
  contentLength: number;
  timestamp: Date;
}

export interface UsageStats {
  templateId: string;
  totalUsage: number;
  uniqueUsers: number;
  averageRenderTime: number;
  successRate: number;
  timeRange: TimeRange;
  usageByProvider: Record<string, number>;
  usageByTaskType: Record<string, number>;
}

export interface PerformanceMetrics {
  templateId: string;
  averageRenderTime: number;
  p95RenderTime: number;
  cacheHitRate: number;
  errorRate: number;
  timeRange: TimeRange;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface UsageReport {
  templateId: string;
  timeRange: TimeRange;
  totalUsage: number;
  uniqueUsers: number;
  usageByDay: Array<{ date: string; count: number }>;
  topUsers: Array<{ userId: string; count: number }>;
  usageByProvider: Record<string, number>;
  usageByTaskType: Record<string, number>;
}

export interface PerformanceReport {
  templateId: string;
  timeRange: TimeRange;
  averageRenderTime: number;
  p50RenderTime: number;
  p95RenderTime: number;
  p99RenderTime: number;
  cacheHitRate: number;
  errorRate: number;
  performanceByDay: Array<{ date: string; avgTime: number; cacheHitRate: number }>;
}

export interface TemplateRanking {
  templateId: string;
  name: string;
  category: TemplateCategory;
  score: number;
  metrics: {
    usage: number;
    performance: number;
    successRate: number;
  };
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  cacheSize: number;
  memoryUsage: number;
  evictions: number;
}

export interface DefaultTemplate {
  category: TemplateCategory;
  key: string;
  name: string;
  description: string;
  content: string;
  variables: TemplateVariable[];
  metadata: TemplateMetadata;
}