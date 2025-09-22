// Prompt data models

import { PromptStatus, VariableType } from '../types/common';
import * as YAML from 'yaml';
import { v4 as uuidv4 } from 'uuid';
import { ValidationResult } from '../types/validation';

export interface PromptMetadata {
  title: string;
  summary: string;
  tags: string[];
  owner: string;
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
  schema_version: number;
  system: string[];
  capabilities: string[];
  user_template: string;
  rules: Array<{
    name: string;
    description: string;
  }>;
  variables: string[];
}

export class HumanPromptClass implements HumanPrompt {
  goal: string;
  audience: string;
  steps: string[];
  output_expectations: {
    format: string;
    fields: string[];
  };

  constructor(data: Partial<HumanPrompt> = {}) {
    this.goal = data.goal || '';
    this.audience = data.audience || '';
    this.steps = data.steps || [];
    this.output_expectations = data.output_expectations || {
      format: '',
      fields: []
    };
  }

  /**
   * Validate the human prompt structure
   */
  validate(): ValidationResult {
    const errors: string[] = [];

    if (!this.goal || this.goal.trim().length === 0) {
      errors.push('Goal is required and cannot be empty');
    }

    if (!this.audience || this.audience.trim().length === 0) {
      errors.push('Audience is required and cannot be empty');
    }

    if (!Array.isArray(this.steps)) {
      errors.push('Steps must be an array');
    } else if (this.steps.length === 0) {
      errors.push('At least one step is required');
    } else {
      this.steps.forEach((step, index) => {
        if (!step || step.trim().length === 0) {
          errors.push(`Step ${index + 1} cannot be empty`);
        }
      });
    }

    if (!this.output_expectations.format || this.output_expectations.format.trim().length === 0) {
      errors.push('Output format is required');
    }

    if (!Array.isArray(this.output_expectations.fields)) {
      errors.push('Output fields must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert to a readable string format
   */
  toString(): string {
    const parts = [
      `Goal: ${this.goal}`,
      `Audience: ${this.audience}`,
      `Steps:`,
      ...this.steps.map((step, i) => `  ${i + 1}. ${step}`),
      `Output Format: ${this.output_expectations.format}`,
      `Expected Fields: ${this.output_expectations.fields.join(', ')}`
    ];
    return parts.join('\n');
  }
}

export class StructuredPromptClass implements StructuredPrompt {
  schema_version: number;
  system: string[];
  capabilities: string[];
  user_template: string;
  rules: Array<{
    name: string;
    description: string;
  }>;
  variables: string[];

  constructor(data: Partial<StructuredPrompt> = {}) {
    this.schema_version = data.schema_version ?? 1;
    this.system = data.system || [];
    this.capabilities = data.capabilities || [];
    this.user_template = data.user_template || '';
    this.rules = data.rules || [];
    this.variables = data.variables || [];
  }

  /**
   * Validate the structured prompt
   */
  validate(): ValidationResult {
    const errors: string[] = [];

    if (!this.schema_version || this.schema_version < 1) {
      errors.push('Schema version must be a positive number');
    }

    if (!Array.isArray(this.system)) {
      errors.push('System must be an array');
    } else if (this.system.length === 0) {
      errors.push('At least one system instruction is required');
    } else {
      this.system.forEach((instruction, index) => {
        if (!instruction || instruction.trim().length === 0) {
          errors.push(`System instruction ${index + 1} cannot be empty`);
        }
      });
    }

    if (!Array.isArray(this.capabilities)) {
      errors.push('Capabilities must be an array');
    }

    if (!this.user_template || this.user_template.trim().length === 0) {
      errors.push('User template is required and cannot be empty');
    }

    if (!Array.isArray(this.rules)) {
      errors.push('Rules must be an array');
    } else {
      this.rules.forEach((rule, index) => {
        if (!rule.name || rule.name.trim().length === 0) {
          errors.push(`Rule ${index + 1} name is required`);
        }
        if (!rule.description || rule.description.trim().length === 0) {
          errors.push(`Rule ${index + 1} description is required`);
        }
      });
    }

    if (!Array.isArray(this.variables)) {
      errors.push('Variables must be an array');
    }

    // Validate that variables referenced in user_template exist in variables array
    const templateVariables = this.extractVariablesFromTemplate(this.user_template);
    const missingVariables = templateVariables.filter(v => !this.variables.includes(v));
    if (missingVariables.length > 0) {
      errors.push(`Template references undefined variables: ${missingVariables.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Extract variable references from template (e.g., {{variable_name}})
   */
  private extractVariablesFromTemplate(template: string): string[] {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      const variableName = match[1].trim();
      if (!variables.includes(variableName)) {
        variables.push(variableName);
      }
    }

    return variables;
  }

  /**
   * Substitute variables in the user template
   */
  substituteVariables(values: Record<string, any>): string {
    let result = this.user_template;

    for (const [key, value] of Object.entries(values)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    }

    return result;
  }

  /**
   * Get all variable references in the template
   */
  getTemplateVariables(): string[] {
    return this.extractVariablesFromTemplate(this.user_template);
  }
}

export interface Variable {
  key: string;
  label: string;
  type: VariableType;
  required: boolean;
  options?: string[];
  sensitive?: boolean;
  default_value?: any;
}

export interface PromptVersion {
  number: number;
  message: string;
  created_at: string;
  author: string;
}

export interface PromptRender {
  provider: string;
  model_hint: string;
  version_of_prompt: number;
  created_at: string;
  content_ref: string;
}

export interface PromptRecord {
  version: number;
  id: string;
  slug: string;
  created_at: string;
  updated_at: string;
  status: PromptStatus;
  metadata: PromptMetadata;
  prompt_human: HumanPrompt;
  prompt_structured?: StructuredPrompt;
  variables: Variable[];
  history: {
    versions: PromptVersion[];
    ratings: Array<{
      user: string;
      score: number;
      note: string;
      created_at: string;
    }>;
  };
  renders: PromptRender[];
}

export class PromptRecordClass implements PromptRecord {
  version: number;
  id: string;
  slug: string;
  created_at: string;
  updated_at: string;
  status: PromptStatus;
  metadata: PromptMetadata;
  prompt_human: HumanPrompt;
  prompt_structured?: StructuredPrompt;
  variables: Variable[];
  history: {
    versions: PromptVersion[];
    ratings: Array<{
      user: string;
      score: number;
      note: string;
      created_at: string;
    }>;
  };
  renders: PromptRender[];

  constructor(data: Partial<PromptRecord> = {}) {
    const now = new Date().toISOString();
    
    this.version = data.version || 1;
    this.id = data.id || uuidv4();
    this.slug = data.slug || this.generateSlug(data.metadata?.title || 'untitled');
    this.created_at = data.created_at || now;
    this.updated_at = data.updated_at || now;
    this.status = data.status || 'draft';
    this.metadata = data.metadata || {
      title: '',
      summary: '',
      tags: [],
      owner: ''
    };
    this.prompt_human = data.prompt_human || {
      goal: '',
      audience: '',
      steps: [],
      output_expectations: {
        format: '',
        fields: []
      }
    };
    this.prompt_structured = data.prompt_structured;
    this.variables = data.variables || [];
    this.history = data.history || {
      versions: [],
      ratings: []
    };
    this.renders = data.renders || [];
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .substring(0, 50);
  }

  /**
   * Serialize the PromptRecord to YAML string
   */
  toYAML(): string {
    const data = {
      version: this.version,
      id: this.id,
      slug: this.slug,
      created_at: this.created_at,
      updated_at: this.updated_at,
      status: this.status,
      metadata: this.metadata,
      prompt_human: this.prompt_human,
      ...(this.prompt_structured && { prompt_structured: this.prompt_structured }),
      variables: this.variables,
      history: this.history,
      renders: this.renders
    };

    return YAML.stringify(data, {
      indent: 2,
      lineWidth: 0,
      minContentWidth: 0
    });
  }

  /**
   * Create PromptRecord from YAML string
   */
  static fromYAML(yamlString: string): PromptRecordClass {
    try {
      const data = YAML.parse(yamlString);
      return new PromptRecordClass(data);
    } catch (error) {
      throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate the PromptRecord structure
   */
  validate(): ValidationResult {
    const errors: string[] = [];

    // Required fields validation
    if (!this.id) errors.push('ID is required');
    if (!this.slug) errors.push('Slug is required');
    if (!this.metadata.title) errors.push('Title is required');
    if (!this.prompt_human.goal) errors.push('Goal is required');

    // Status validation
    const validStatuses: PromptStatus[] = ['draft', 'active', 'archived'];
    if (!validStatuses.includes(this.status)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
    }

    // Variables validation
    for (const variable of this.variables) {
      const variableErrors = this.validateVariable(variable);
      errors.push(...variableErrors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateVariable(variable: Variable): string[] {
    const errors: string[] = [];
    const validTypes: VariableType[] = ['string', 'number', 'select', 'multiselect', 'boolean'];

    if (!variable.key) errors.push('Variable key is required');
    if (!variable.label) errors.push('Variable label is required');
    if (!validTypes.includes(variable.type)) {
      errors.push(`Variable type must be one of: ${validTypes.join(', ')}`);
    }

    // Select/multiselect must have options
    if ((variable.type === 'select' || variable.type === 'multiselect') && 
        (!variable.options || variable.options.length === 0)) {
      errors.push(`Variable '${variable.key}' of type '${variable.type}' must have options`);
    }

    return errors;
  }

  /**
   * Update the prompt and increment version
   */
  update(updates: Partial<PromptRecord>, author: string, message: string): void {
    // Store the current state for version history
    const previousVersion = this.version;
    
    // Apply updates
    Object.assign(this, updates);
    
    // Update timestamps and version
    this.updated_at = new Date().toISOString();
    this.version = previousVersion + 1;

    // Add version history
    this.history.versions.push({
      number: previousVersion,
      message,
      created_at: this.updated_at,
      author
    });
  }

  /**
   * Add a rating to the prompt
   */
  addRating(user: string, score: number, note: string = ''): void {
    if (score < 1 || score > 5) {
      throw new Error('Rating score must be between 1 and 5');
    }

    // Remove existing rating from same user
    this.history.ratings = this.history.ratings.filter(r => r.user !== user);

    // Add new rating
    this.history.ratings.push({
      user,
      score,
      note,
      created_at: new Date().toISOString()
    });
  }

  /**
   * Get average rating
   */
  getAverageRating(): number {
    if (this.history.ratings.length === 0) return 0;
    
    const sum = this.history.ratings.reduce((acc, rating) => acc + rating.score, 0);
    return Math.round((sum / this.history.ratings.length) * 100) / 100;
  }

  /**
   * Clone the prompt record
   */
  clone(): PromptRecordClass {
    return new PromptRecordClass(JSON.parse(JSON.stringify(this)));
  }
}