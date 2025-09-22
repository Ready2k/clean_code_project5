// Tests for prompt data models

import { describe, it, expect } from 'vitest';
import { PromptRecordClass, HumanPromptClass, StructuredPromptClass } from '../prompt';
import { PromptStatus } from '../../types/common';

describe('PromptRecordClass', () => {
  it('should create a new prompt record with defaults', () => {
    const prompt = new PromptRecordClass();
    
    expect(prompt.version).toBe(1);
    expect(prompt.id).toBeDefined();
    expect(prompt.slug).toBeDefined();
    expect(prompt.status).toBe('draft');
    expect(prompt.metadata.title).toBe('');
    expect(prompt.variables).toEqual([]);
  });

  it('should create a prompt record with provided data', () => {
    const data = {
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
    };

    const prompt = new PromptRecordClass(data);
    
    expect(prompt.metadata.title).toBe('Test Prompt');
    expect(prompt.prompt_human.goal).toBe('Test goal');
    expect(prompt.slug).toBe('test-prompt');
  });

  it('should serialize to YAML correctly', () => {
    const prompt = new PromptRecordClass({
      metadata: {
        title: 'Test Prompt',
        summary: 'A test prompt',
        tags: ['test'],
        owner: 'user1'
      }
    });

    const yaml = prompt.toYAML();
    expect(yaml).toContain('version: 1');
    expect(yaml).toContain('title: Test Prompt');
    expect(yaml).toContain('tags:');
    expect(yaml).toContain('- test');
  });

  it('should deserialize from YAML correctly', () => {
    const yamlString = `
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
    - Step 2
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

    const prompt = PromptRecordClass.fromYAML(yamlString);
    
    expect(prompt.id).toBe('test-id');
    expect(prompt.metadata.title).toBe('Test Prompt');
    expect(prompt.prompt_human.goal).toBe('Test goal');
    expect(prompt.prompt_human.steps).toEqual(['Step 1', 'Step 2']);
  });

  it('should validate correctly', () => {
    const validPrompt = new PromptRecordClass({
      metadata: {
        title: 'Valid Prompt',
        summary: 'A valid prompt',
        tags: ['test'],
        owner: 'user1'
      },
      prompt_human: {
        goal: 'Test goal',
        audience: 'Developers',
        steps: ['Step 1'],
        output_expectations: {
          format: 'JSON',
          fields: ['result']
        }
      }
    });

    const result = validPrompt.validate();
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should fail validation for missing required fields', () => {
    const invalidPrompt = new PromptRecordClass();
    
    const result = invalidPrompt.validate();
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Title is required');
    expect(result.errors).toContain('Goal is required');
  });

  it('should add ratings correctly', () => {
    const prompt = new PromptRecordClass();
    
    prompt.addRating('user1', 5, 'Great prompt!');
    prompt.addRating('user2', 4, 'Good prompt');
    
    expect(prompt.history.ratings).toHaveLength(2);
    expect(prompt.getAverageRating()).toBe(4.5);
  });

  it('should update ratings from same user', () => {
    const prompt = new PromptRecordClass();
    
    prompt.addRating('user1', 3, 'OK prompt');
    prompt.addRating('user1', 5, 'Actually great!');
    
    expect(prompt.history.ratings).toHaveLength(1);
    expect(prompt.history.ratings[0].score).toBe(5);
    expect(prompt.getAverageRating()).toBe(5);
  });
});

describe('HumanPromptClass', () => {
  it('should create with defaults', () => {
    const prompt = new HumanPromptClass();
    
    expect(prompt.goal).toBe('');
    expect(prompt.audience).toBe('');
    expect(prompt.steps).toEqual([]);
    expect(prompt.output_expectations.format).toBe('');
  });

  it('should validate correctly', () => {
    const validPrompt = new HumanPromptClass({
      goal: 'Test goal',
      audience: 'Developers',
      steps: ['Step 1', 'Step 2'],
      output_expectations: {
        format: 'JSON',
        fields: ['result']
      }
    });

    const result = validPrompt.validate();
    expect(result.isValid).toBe(true);
  });

  it('should fail validation for missing fields', () => {
    const invalidPrompt = new HumanPromptClass();
    
    const result = invalidPrompt.validate();
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Goal is required and cannot be empty');
    expect(result.errors).toContain('Audience is required and cannot be empty');
  });
});

describe('StructuredPromptClass', () => {
  it('should create with defaults', () => {
    const prompt = new StructuredPromptClass();
    
    expect(prompt.schema_version).toBe(1);
    expect(prompt.system).toEqual([]);
    expect(prompt.user_template).toBe('');
  });

  it('should validate correctly', () => {
    const validPrompt = new StructuredPromptClass({
      system: ['You are a helpful assistant'],
      user_template: 'Please help with {{task}}',
      variables: ['task'],
      rules: [{ name: 'Be helpful', description: 'Always be helpful' }]
    });

    const result = validPrompt.validate();
    expect(result.isValid).toBe(true);
  });

  it('should substitute variables correctly', () => {
    const prompt = new StructuredPromptClass({
      user_template: 'Hello {{name}}, please {{action}} the {{item}}'
    });

    const result = prompt.substituteVariables({
      name: 'John',
      action: 'review',
      item: 'document'
    });

    expect(result).toBe('Hello John, please review the document');
  });

  it('should extract template variables', () => {
    const prompt = new StructuredPromptClass({
      user_template: 'Process {{input}} and return {{format}} with {{details}}'
    });

    const variables = prompt.getTemplateVariables();
    expect(variables).toEqual(['input', 'format', 'details']);
  });
});