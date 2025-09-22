// Tests for validation service

import { describe, it, expect } from 'vitest';
import { ValidationService } from '../validation-service';
import { PromptRecordClass } from '../../models/prompt';
import { Variable } from '../../models/prompt';

describe('ValidationService', () => {
  describe('validateYAML', () => {
    it('should validate correct YAML', () => {
      const yamlString = `
name: test
value: 123
items:
  - item1
  - item2
`;
      
      const result = ValidationService.validateYAML(yamlString);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.parsedData).toEqual({
        name: 'test',
        value: 123,
        items: ['item1', 'item2']
      });
    });

    it('should fail validation for invalid YAML', () => {
      const invalidYaml = `
name: test
  invalid: indentation
`;
      
      const result = ValidationService.validateYAML(invalidYaml);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe('root');
    });
  });

  describe('validatePromptYAMLSchema', () => {
    it('should validate correct prompt YAML schema', () => {
      const validPromptYaml = `
version: 1
id: test-id
slug: test-prompt
created_at: "2023-01-01T00:00:00.000Z"
updated_at: "2023-01-01T00:00:00.000Z"
status: draft
metadata:
  title: Test Prompt
  summary: A test prompt
  tags:
    - test
  owner: user1
prompt_human:
  goal: Test goal
  audience: Developers
  steps:
    - Step 1
  output_expectations:
    format: JSON
    fields:
      - result
variables: []
history:
  versions: []
  ratings: []
renders: []
`;

      const result = ValidationService.validatePromptYAMLSchema(validPromptYaml);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail validation for missing required fields', () => {
      const invalidPromptYaml = `
version: 1
metadata:
  title: Test Prompt
`;

      const result = ValidationService.validatePromptYAMLSchema(invalidPromptYaml);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.path === 'id')).toBe(true);
      expect(result.errors.some(e => e.path === 'slug')).toBe(true);
    });

    it('should fail validation for invalid status', () => {
      const invalidStatusYaml = `
version: 1
id: test-id
slug: test-prompt
created_at: "2023-01-01T00:00:00.000Z"
updated_at: "2023-01-01T00:00:00.000Z"
status: invalid_status
metadata:
  title: Test Prompt
  summary: A test prompt
  tags: []
  owner: user1
prompt_human:
  goal: Test goal
  audience: Developers
  steps:
    - Step 1
  output_expectations:
    format: JSON
    fields: []
`;

      const result = ValidationService.validatePromptYAMLSchema(invalidStatusYaml);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.path === 'status')).toBe(true);
    });
  });

  describe('validateVariableValue', () => {
    it('should validate string variable', () => {
      const variable: Variable = {
        key: 'name',
        label: 'Name',
        type: 'string',
        required: true
      };

      const result = ValidationService.validateVariableValue('John Doe', variable);
      expect(result.isValid).toBe(true);
    });

    it('should fail validation for required string with empty value', () => {
      const variable: Variable = {
        key: 'name',
        label: 'Name',
        type: 'string',
        required: true
      };

      const result = ValidationService.validateVariableValue('', variable);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Value is required for variable 'name'");
    });

    it('should validate number variable', () => {
      const variable: Variable = {
        key: 'age',
        label: 'Age',
        type: 'number',
        required: true
      };

      const result = ValidationService.validateVariableValue(25, variable);
      expect(result.isValid).toBe(true);
    });

    it('should fail validation for invalid number', () => {
      const variable: Variable = {
        key: 'age',
        label: 'Age',
        type: 'number',
        required: true
      };

      const result = ValidationService.validateVariableValue('not a number', variable);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Variable 'age' must be a valid number, got 'not a number'");
    });

    it('should validate select variable', () => {
      const variable: Variable = {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        required: true,
        options: ['low', 'medium', 'high']
      };

      const result = ValidationService.validateVariableValue('high', variable);
      expect(result.isValid).toBe(true);
    });

    it('should fail validation for invalid select option', () => {
      const variable: Variable = {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        required: true,
        options: ['low', 'medium', 'high']
      };

      const result = ValidationService.validateVariableValue('invalid', variable);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Variable 'priority' must be one of: low, medium, high, got 'invalid'");
    });

    it('should validate multiselect variable', () => {
      const variable: Variable = {
        key: 'tags',
        label: 'Tags',
        type: 'multiselect',
        required: true,
        options: ['tag1', 'tag2', 'tag3']
      };

      const result = ValidationService.validateVariableValue(['tag1', 'tag3'], variable);
      expect(result.isValid).toBe(true);
    });

    it('should validate boolean variable', () => {
      const variable: Variable = {
        key: 'enabled',
        label: 'Enabled',
        type: 'boolean',
        required: true
      };

      const result1 = ValidationService.validateVariableValue(true, variable);
      expect(result1.isValid).toBe(true);

      const result2 = ValidationService.validateVariableValue('true', variable);
      expect(result2.isValid).toBe(true);
    });
  });

  describe('validateVariableValues', () => {
    it('should validate multiple variables', () => {
      const variables: Variable[] = [
        { key: 'name', label: 'Name', type: 'string', required: true },
        { key: 'age', label: 'Age', type: 'number', required: false },
        { key: 'priority', label: 'Priority', type: 'select', required: true, options: ['low', 'high'] }
      ];

      const values = {
        name: 'John',
        priority: 'high'
      };

      const result = ValidationService.validateVariableValues(values, variables);
      expect(result.isValid).toBe(true);
    });

    it('should fail validation for missing required variables', () => {
      const variables: Variable[] = [
        { key: 'name', label: 'Name', type: 'string', required: true },
        { key: 'priority', label: 'Priority', type: 'select', required: true, options: ['low', 'high'] }
      ];

      const values = {
        name: 'John'
        // missing priority
      };

      const result = ValidationService.validateVariableValues(values, variables);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'priority')).toBe(true);
    });

    it('should warn about extra values', () => {
      const variables: Variable[] = [
        { key: 'name', label: 'Name', type: 'string', required: true }
      ];

      const values = {
        name: 'John',
        extra_field: 'extra value'
      };

      const result = ValidationService.validateVariableValues(values, variables);
      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.some(w => w.field === 'extra_field')).toBe(true);
    });
  });

  describe('validatePromptStructure', () => {
    it('should validate complete prompt structure', () => {
      const prompt = new PromptRecordClass({
        metadata: {
          title: 'Test Prompt',
          summary: 'A test prompt',
          tags: ['test'],
          owner: 'user1'
        },
        prompt_human: {
          goal: 'Test goal',
          audience: 'Developers',
          steps: ['Step 1', 'Step 2'],
          output_expectations: {
            format: 'JSON',
            fields: ['result']
          }
        }
      });

      const result = ValidationService.validatePromptStructure(prompt);
      expect(result.isValid).toBe(true);
    });

    it('should fail validation for incomplete prompt', () => {
      const prompt = new PromptRecordClass();

      const result = ValidationService.validatePromptStructure(prompt);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateRequiredVariables', () => {
    it('should validate when all required variables are provided', () => {
      const variables: Variable[] = [
        { key: 'name', label: 'Name', type: 'string', required: true },
        { key: 'age', label: 'Age', type: 'number', required: false }
      ];

      const values = {
        name: 'John',
        age: 25
      };

      const result = ValidationService.validateRequiredVariables(values, variables);
      expect(result.isValid).toBe(true);
    });

    it('should fail validation when required variables are missing', () => {
      const variables: Variable[] = [
        { key: 'name', label: 'Name', type: 'string', required: true },
        { key: 'email', label: 'Email', type: 'string', required: true }
      ];

      const values = {
        name: 'John'
        // missing email
      };

      const result = ValidationService.validateRequiredVariables(values, variables);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Required variable 'email' is missing or empty");
    });
  });
});