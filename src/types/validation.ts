// Validation types and interfaces

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface DetailedValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings?: ValidationWarning[];
}

// YAML Schema validation types
export interface YAMLSchemaValidationResult {
  isValid: boolean;
  errors: YAMLSchemaError[];
  parsedData?: any;
}

export interface YAMLSchemaError {
  path: string;
  message: string;
  expectedType?: string;
  actualType?: string;
  value?: any;
}

// Variable validation types
export interface VariableValidationOptions {
  allowEmpty?: boolean;
  customValidators?: Record<string, (value: any) => ValidationResult>;
}