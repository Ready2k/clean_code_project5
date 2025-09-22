// Validation service for prompt structure, metadata, and variables

import * as YAML from 'yaml';
import { 
  ValidationResult, 
  DetailedValidationResult, 
  ValidationError, 
  ValidationWarning,
  YAMLSchemaValidationResult,
  YAMLSchemaError,
  VariableValidationOptions
} from '../types/validation';
import { VariableType, PromptStatus } from '../types/common';
import { PromptRecord, Variable } from '../models/prompt';

export class ValidationService {
  
  /**
   * Validate YAML structure and parse it
   */
  static validateYAML(yamlString: string): YAMLSchemaValidationResult {
    const errors: YAMLSchemaError[] = [];
    let parsedData: any = null;

    try {
      parsedData = YAML.parse(yamlString);
    } catch (error) {
      errors.push({
        path: 'root',
        message: `Invalid YAML syntax: ${error instanceof Error ? error.message : 'Unknown error'}`,
        expectedType: 'valid YAML',
        actualType: 'invalid YAML'
      });
      
      return {
        isValid: false,
        errors
      };
    }

    // Validate basic structure
    if (typeof parsedData !== 'object' || parsedData === null) {
      errors.push({
        path: 'root',
        message: 'YAML must parse to an object',
        expectedType: 'object',
        actualType: typeof parsedData,
        value: parsedData
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      parsedData
    };
  }

  /**
   * Validate prompt file YAML schema
   */
  static validatePromptYAMLSchema(yamlString: string): YAMLSchemaValidationResult {
    const yamlResult = this.validateYAML(yamlString);
    if (!yamlResult.isValid) {
      return yamlResult;
    }

    const errors: YAMLSchemaError[] = [];
    const data = yamlResult.parsedData;

    // Required fields validation
    const requiredFields = ['version', 'id', 'slug', 'created_at', 'updated_at', 'status', 'metadata', 'prompt_human'];
    
    for (const field of requiredFields) {
      if (!(field in data)) {
        errors.push({
          path: field,
          message: `Required field '${field}' is missing`,
          expectedType: 'any',
          actualType: 'undefined'
        });
      }
    }

    // Type validations
    if ('version' in data && typeof data.version !== 'number') {
      errors.push({
        path: 'version',
        message: 'Version must be a number',
        expectedType: 'number',
        actualType: typeof data.version,
        value: data.version
      });
    }

    if ('id' in data && typeof data.id !== 'string') {
      errors.push({
        path: 'id',
        message: 'ID must be a string',
        expectedType: 'string',
        actualType: typeof data.id,
        value: data.id
      });
    }

    if ('slug' in data && typeof data.slug !== 'string') {
      errors.push({
        path: 'slug',
        message: 'Slug must be a string',
        expectedType: 'string',
        actualType: typeof data.slug,
        value: data.slug
      });
    }

    // Status validation
    if ('status' in data) {
      const validStatuses: PromptStatus[] = ['draft', 'active', 'archived'];
      if (!validStatuses.includes(data.status)) {
        errors.push({
          path: 'status',
          message: `Status must be one of: ${validStatuses.join(', ')}`,
          expectedType: validStatuses.join(' | '),
          actualType: typeof data.status,
          value: data.status
        });
      }
    }

    // Metadata validation
    if ('metadata' in data) {
      if (typeof data.metadata !== 'object' || data.metadata === null) {
        errors.push({
          path: 'metadata',
          message: 'Metadata must be an object',
          expectedType: 'object',
          actualType: typeof data.metadata,
          value: data.metadata
        });
      } else {
        const metadataFields = ['title', 'summary', 'tags', 'owner'];
        for (const field of metadataFields) {
          if (!(field in data.metadata)) {
            errors.push({
              path: `metadata.${field}`,
              message: `Required metadata field '${field}' is missing`,
              expectedType: 'any',
              actualType: 'undefined'
            });
          }
        }

        if ('tags' in data.metadata && !Array.isArray(data.metadata.tags)) {
          errors.push({
            path: 'metadata.tags',
            message: 'Tags must be an array',
            expectedType: 'array',
            actualType: typeof data.metadata.tags,
            value: data.metadata.tags
          });
        }
      }
    }

    // Variables validation
    if ('variables' in data) {
      if (!Array.isArray(data.variables)) {
        errors.push({
          path: 'variables',
          message: 'Variables must be an array',
          expectedType: 'array',
          actualType: typeof data.variables,
          value: data.variables
        });
      } else {
        data.variables.forEach((variable: any, index: number) => {
          const variableErrors = this.validateVariableSchema(variable, `variables[${index}]`);
          errors.push(...variableErrors);
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      parsedData: data
    };
  }

  /**
   * Validate variable schema
   */
  private static validateVariableSchema(variable: any, path: string): YAMLSchemaError[] {
    const errors: YAMLSchemaError[] = [];

    if (typeof variable !== 'object' || variable === null) {
      errors.push({
        path,
        message: 'Variable must be an object',
        expectedType: 'object',
        actualType: typeof variable,
        value: variable
      });
      return errors;
    }

    // Required fields
    const requiredFields = ['key', 'label', 'type', 'required'];
    for (const field of requiredFields) {
      if (!(field in variable)) {
        errors.push({
          path: `${path}.${field}`,
          message: `Required variable field '${field}' is missing`,
          expectedType: 'any',
          actualType: 'undefined'
        });
      }
    }

    // Type validation
    if ('type' in variable) {
      const validTypes: VariableType[] = ['string', 'number', 'select', 'multiselect', 'boolean'];
      if (!validTypes.includes(variable.type)) {
        errors.push({
          path: `${path}.type`,
          message: `Variable type must be one of: ${validTypes.join(', ')}`,
          expectedType: validTypes.join(' | '),
          actualType: typeof variable.type,
          value: variable.type
        });
      }

      // Options validation for select types
      if ((variable.type === 'select' || variable.type === 'multiselect')) {
        if (!('options' in variable) || !Array.isArray(variable.options) || variable.options.length === 0) {
          errors.push({
            path: `${path}.options`,
            message: `Variable of type '${variable.type}' must have a non-empty options array`,
            expectedType: 'array',
            actualType: typeof variable.options,
            value: variable.options
          });
        }
      }
    }

    // Required field type validation
    if ('required' in variable && typeof variable.required !== 'boolean') {
      errors.push({
        path: `${path}.required`,
        message: 'Required field must be a boolean',
        expectedType: 'boolean',
        actualType: typeof variable.required,
        value: variable.required
      });
    }

    return errors;
  }

  /**
   * Validate variable value against its type
   */
  static validateVariableValue(
    value: any, 
    variable: Variable, 
    options: VariableValidationOptions = {}
  ): ValidationResult {
    const errors: string[] = [];

    // Check if required value is provided
    if (variable.required && (value === null || value === undefined || value === '')) {
      if (!options.allowEmpty) {
        errors.push(`Value is required for variable '${variable.key}'`);
      }
    }

    // Skip type validation if value is empty and not required
    if (!variable.required && (value === null || value === undefined || value === '')) {
      return { isValid: true, errors: [] };
    }

    // Type-specific validation
    switch (variable.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Variable '${variable.key}' must be a string, got ${typeof value}`);
        }
        break;

      case 'number':
        const numValue = Number(value);
        if (!Number.isFinite(numValue)) {
          errors.push(`Variable '${variable.key}' must be a valid number, got '${value}'`);
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false' && value !== true && value !== false) {
          errors.push(`Variable '${variable.key}' must be a boolean (true/false), got '${value}'`);
        }
        break;

      case 'select':
        if (!variable.options?.includes(value)) {
          errors.push(`Variable '${variable.key}' must be one of: ${variable.options?.join(', ') || 'no options available'}, got '${value}'`);
        }
        break;

      case 'multiselect':
        if (!Array.isArray(value)) {
          errors.push(`Variable '${variable.key}' must be an array for multiselect, got ${typeof value}`);
        } else {
          const invalidOptions = value.filter(v => !variable.options?.includes(v));
          if (invalidOptions.length > 0) {
            errors.push(`Variable '${variable.key}' contains invalid options: ${invalidOptions.join(', ')}. Valid options: ${variable.options?.join(', ') || 'none'}`);
          }
        }
        break;

      default:
        errors.push(`Unknown variable type '${variable.type}' for variable '${variable.key}'`);
    }

    // Custom validators
    if (options.customValidators && variable.key in options.customValidators) {
      const customResult = options.customValidators[variable.key](value);
      errors.push(...customResult.errors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate multiple variable values
   */
  static validateVariableValues(
    values: Record<string, any>,
    variables: Variable[],
    options: VariableValidationOptions = {}
  ): DetailedValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate each variable
    for (const variable of variables) {
      const value = values[variable.key];
      const result = this.validateVariableValue(value, variable, options);
      
      if (!result.isValid) {
        errors.push(...result.errors.map(error => ({
          field: variable.key,
          message: error,
          code: 'VARIABLE_VALIDATION_ERROR',
          value
        })));
      }
    }

    // Check for extra values not defined in variables
    const definedKeys = variables.map(v => v.key);
    const extraKeys = Object.keys(values).filter(key => !definedKeys.includes(key));
    
    if (extraKeys.length > 0) {
      warnings.push(...extraKeys.map(key => ({
        field: key,
        message: `Value provided for undefined variable '${key}'`,
        suggestion: `Remove this value or add variable definition for '${key}'`
      })));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : []
    };
  }

  /**
   * Validate prompt structure and metadata
   */
  static validatePromptStructure(prompt: PromptRecord): DetailedValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic field validation
    if (!prompt.id) {
      errors.push({
        field: 'id',
        message: 'Prompt ID is required',
        code: 'REQUIRED_FIELD_MISSING'
      });
    }

    if (!prompt.slug) {
      errors.push({
        field: 'slug',
        message: 'Prompt slug is required',
        code: 'REQUIRED_FIELD_MISSING'
      });
    }

    if (!prompt.metadata.title) {
      errors.push({
        field: 'metadata.title',
        message: 'Prompt title is required',
        code: 'REQUIRED_FIELD_MISSING'
      });
    }

    // Status validation
    const validStatuses: PromptStatus[] = ['draft', 'active', 'archived'];
    if (!validStatuses.includes(prompt.status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${validStatuses.join(', ')}`,
        code: 'INVALID_ENUM_VALUE',
        value: prompt.status
      });
    }

    // Human prompt validation
    if (!prompt.prompt_human.goal) {
      errors.push({
        field: 'prompt_human.goal',
        message: 'Prompt goal is required',
        code: 'REQUIRED_FIELD_MISSING'
      });
    }

    if (!prompt.prompt_human.audience) {
      errors.push({
        field: 'prompt_human.audience',
        message: 'Prompt audience is required',
        code: 'REQUIRED_FIELD_MISSING'
      });
    }

    if (!prompt.prompt_human.steps || prompt.prompt_human.steps.length === 0) {
      errors.push({
        field: 'prompt_human.steps',
        message: 'At least one step is required',
        code: 'REQUIRED_FIELD_MISSING'
      });
    }

    // Variable validation
    const variableResult = this.validateVariableValues({}, prompt.variables);
    errors.push(...variableResult.errors);
    if (variableResult.warnings) {
      warnings.push(...variableResult.warnings);
    }

    // Structured prompt validation (if present)
    if (prompt.prompt_structured) {
      if (!prompt.prompt_structured.user_template) {
        errors.push({
          field: 'prompt_structured.user_template',
          message: 'User template is required in structured prompt',
          code: 'REQUIRED_FIELD_MISSING'
        });
      }

      if (!prompt.prompt_structured.system || prompt.prompt_structured.system.length === 0) {
        errors.push({
          field: 'prompt_structured.system',
          message: 'At least one system instruction is required',
          code: 'REQUIRED_FIELD_MISSING'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : []
    };
  }

  /**
   * Validate that all required variables have values
   */
  static validateRequiredVariables(
    values: Record<string, any>,
    variables: Variable[]
  ): ValidationResult {
    const errors: string[] = [];
    
    const requiredVariables = variables.filter(v => v.required);
    
    for (const variable of requiredVariables) {
      const value = values[variable.key];
      if (value === null || value === undefined || value === '') {
        errors.push(`Required variable '${variable.key}' is missing or empty`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}