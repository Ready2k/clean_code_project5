// Tests for EnhancementAgent

import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancementAgentImpl, LLMService } from '../enhancement-agent';
import { MockLLMService } from '../mock-llm-service';
import { HumanPrompt, StructuredPrompt, Variable } from '../../models/prompt';
import { VariableType } from '../../types/common';

describe('EnhancementAgentImpl', () => {
  let enhancementAgent: EnhancementAgentImpl;
  let mockLLMService: MockLLMService;

  beforeEach(() => {
    mockLLMService = new MockLLMService();
    enhancementAgent = new EnhancementAgentImpl(mockLLMService);
  });

  describe('enhance', () => {
    it('should enhance a basic human prompt successfully', async () => {
      const humanPrompt: HumanPrompt = {
        goal: 'Help users write better emails',
        audience: 'Business professionals',
        steps: [
          'Analyze the email context',
          'Suggest improvements for clarity',
          'Provide formatting recommendations'
        ],
        output_expectations: {
          format: 'structured feedback',
          fields: ['clarity_score', 'suggestions', 'improved_version']
        }
      };

      const result = await enhancementAgent.enhance(humanPrompt);

      expect(result).toBeDefined();
      expect(result.structuredPrompt).toBeDefined();
      expect(result.structuredPrompt.schema_version).toBe(1);
      expect(result.structuredPrompt.system).toBeInstanceOf(Array);
      expect(result.structuredPrompt.system.length).toBeGreaterThan(0);
      expect(result.structuredPrompt.user_template).toBeTruthy();
      expect(result.questions).toBeInstanceOf(Array);
      expect(result.rationale).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.changes_made).toBeInstanceOf(Array);
    });

    it('should extract variables from the generated template', async () => {
      // Set up a custom response with variables
      const customResponse = JSON.stringify({
        structured: {
          schema_version: 1,
          system: ["You are a helpful assistant"],
          capabilities: ["text processing"],
          user_template: "Process {{input_text}} for {{target_audience}} in {{output_format}} format",
          rules: [{ name: "clarity", description: "Be clear" }],
          variables: ["input_text", "target_audience", "output_format"]
        },
        changes_made: ["Added variables"],
        warnings: []
      });

      mockLLMService.addResponse('Help users write better emails', customResponse);

      const humanPrompt: HumanPrompt = {
        goal: 'Help users write better emails',
        audience: 'Business professionals',
        steps: ['Analyze context'],
        output_expectations: { format: 'text', fields: ['suggestions'] }
      };

      const result = await enhancementAgent.enhance(humanPrompt);

      expect(result.questions).toHaveLength(3);
      expect(result.questions.map(q => q.variable_key)).toEqual([
        'input_text', 'target_audience', 'output_format'
      ]);
    });

    it('should handle invalid human prompt', async () => {
      const invalidPrompt: HumanPrompt = {
        goal: '', // Empty goal should cause validation error
        audience: 'Users',
        steps: [],
        output_expectations: { format: '', fields: [] }
      };

      await expect(enhancementAgent.enhance(invalidPrompt))
        .rejects.toThrow('Invalid human prompt');
    });

    it('should handle LLM service errors', async () => {
      const failingLLMService: LLMService = {
        async complete() {
          throw new Error('LLM service unavailable');
        },
        async isAvailable() {
          return false;
        }
      };

      const agent = new EnhancementAgentImpl(failingLLMService);
      const humanPrompt: HumanPrompt = {
        goal: 'Test goal',
        audience: 'Test audience',
        steps: ['Step 1'],
        output_expectations: { format: 'text', fields: ['result'] }
      };

      await expect(agent.enhance(humanPrompt))
        .rejects.toThrow('Enhancement failed');
    });

    it('should include context in enhancement', async () => {
      const humanPrompt: HumanPrompt = {
        goal: 'Create a data analysis report',
        audience: 'Data scientists',
        steps: ['Collect data', 'Analyze patterns', 'Generate insights'],
        output_expectations: { format: 'report', fields: ['findings', 'recommendations'] }
      };

      const context = {
        targetProvider: 'openai',
        domainKnowledge: 'Financial data analysis'
      };

      const result = await enhancementAgent.enhance(humanPrompt, context);

      expect(result).toBeDefined();
      expect(result.structuredPrompt).toBeDefined();
    });
  });

  describe('generateQuestions', () => {
    it('should generate questions for variables', async () => {
      const variables: Variable[] = [
        {
          key: 'user_name',
          label: 'User Name',
          type: 'string',
          required: true
        },
        {
          key: 'age',
          label: 'Age',
          type: 'number',
          required: false
        },
        {
          key: 'preferences',
          label: 'Preferences',
          type: 'multiselect',
          required: true,
          options: ['option1', 'option2', 'option3']
        }
      ];

      const questions = await enhancementAgent.generateQuestions(variables);

      expect(questions).toHaveLength(3);
      expect(questions[0].variable_key).toBe('user_name');
      expect(questions[0].type).toBe('string');
      expect(questions[0].required).toBe(true);
      expect(questions[0].text).toContain('User Name');

      expect(questions[1].variable_key).toBe('age');
      expect(questions[1].type).toBe('number');
      expect(questions[1].required).toBe(false);
      expect(questions[1].text).toContain('number');

      expect(questions[2].variable_key).toBe('preferences');
      expect(questions[2].type).toBe('multiselect');
      expect(questions[2].options).toEqual(['option1', 'option2', 'option3']);
    });

    it('should handle empty variables array', async () => {
      const questions = await enhancementAgent.generateQuestions([]);
      expect(questions).toHaveLength(0);
    });
  });

  describe('validateStructuredPrompt', () => {
    it('should validate a well-formed structured prompt', () => {
      const structuredPrompt: StructuredPrompt = {
        schema_version: 1,
        system: ['You are a helpful assistant', 'Follow the user instructions carefully'],
        capabilities: ['text processing', 'analysis'],
        user_template: 'Please help me with {{task}} for {{audience}}',
        rules: [
          { name: 'clarity', description: 'Be clear and concise' },
          { name: 'accuracy', description: 'Provide accurate information' }
        ],
        variables: ['task', 'audience']
      };

      const result = enhancementAgent.validateStructuredPrompt(structuredPrompt);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should identify validation errors', () => {
      const invalidPrompt: StructuredPrompt = {
        schema_version: 0, // Invalid version
        system: [], // Empty system
        capabilities: [],
        user_template: '', // Empty template
        rules: [],
        variables: ['unused_var'] // Variable not used in template
      };

      const result = enhancementAgent.validateStructuredPrompt(invalidPrompt);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Schema version'))).toBe(true);
      expect(result.errors.some(e => e.includes('system instruction'))).toBe(true);
      expect(result.errors.some(e => e.includes('User template'))).toBe(true);
    });

    it('should provide quality warnings', () => {
      const minimalPrompt: StructuredPrompt = {
        schema_version: 1,
        system: ['Basic instruction'], // Only one system instruction
        capabilities: [],
        user_template: 'Short template', // Very short template
        rules: [], // No rules
        variables: []
      };

      const result = enhancementAgent.validateStructuredPrompt(minimalPrompt);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });
  });

  describe('analyzePrompt', () => {
    it('should analyze human prompt quality', async () => {
      const humanPrompt: HumanPrompt = {
        goal: 'Create comprehensive documentation for software projects',
        audience: 'Software developers and technical writers',
        steps: [
          'Analyze the codebase structure',
          'Identify key components and their relationships',
          'Generate clear documentation with examples'
        ],
        output_expectations: {
          format: 'markdown documentation',
          fields: ['overview', 'api_reference', 'examples', 'troubleshooting']
        }
      };

      const analysis = await enhancementAgent.analyzePrompt(humanPrompt);

      expect(analysis.quality_score).toBeGreaterThan(0);
      expect(analysis.quality_score).toBeLessThanOrEqual(100);
      expect(analysis.suggestions).toBeInstanceOf(Array);
      expect(analysis.missing_elements).toBeInstanceOf(Array);
    });

    it('should analyze structured prompt quality', async () => {
      const structuredPrompt: StructuredPrompt = {
        schema_version: 1,
        system: [
          'You are a documentation expert',
          'Focus on clarity and completeness'
        ],
        capabilities: ['code analysis', 'technical writing'],
        user_template: 'Generate documentation for {{project_type}} targeting {{audience}}',
        rules: [
          { name: 'clarity', description: 'Use clear, concise language' }
        ],
        variables: ['project_type', 'audience']
      };

      const analysis = await enhancementAgent.analyzePrompt(structuredPrompt);

      expect(analysis.quality_score).toBeGreaterThan(0);
      expect(analysis.suggestions).toBeInstanceOf(Array);
      expect(analysis.missing_elements).toBeInstanceOf(Array);
    });

    it('should identify missing elements in poor quality prompt', async () => {
      const poorPrompt: HumanPrompt = {
        goal: 'Help', // Too short
        audience: '', // Missing
        steps: [], // Empty
        output_expectations: { format: '', fields: [] } // Missing
      };

      const analysis = await enhancementAgent.analyzePrompt(poorPrompt);

      expect(analysis.quality_score).toBeLessThan(50);
      expect(analysis.missing_elements.length).toBeGreaterThan(0);
      expect(analysis.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('extractVariables', () => {
    it('should extract variables from template', () => {
      const template = 'Process {{input_data}} for {{target_audience}} and output in {{format}} format. Use {{style}} style.';
      
      const variables = enhancementAgent.extractVariables(template);

      expect(variables).toHaveLength(4);
      expect(variables.map(v => v.key)).toEqual(['input_data', 'target_audience', 'format', 'style']);
      expect(variables[0].label).toBe('Input Data');
      expect(variables[1].label).toBe('Target Audience');
    });

    it('should infer variable types correctly', () => {
      const template = 'Count: {{item_count}}, Enabled: {{is_enabled}}, Type: {{content_type}}, Tags: {{selected_tags}}';
      
      const variables = enhancementAgent.extractVariables(template);

      expect(variables.find(v => v.key === 'item_count')?.type).toBe('number');
      expect(variables.find(v => v.key === 'is_enabled')?.type).toBe('boolean');
      expect(variables.find(v => v.key === 'content_type')?.type).toBe('select');
      expect(variables.find(v => v.key === 'selected_tags')?.type).toBe('multiselect');
    });

    it('should handle template with no variables', () => {
      const template = 'This is a static template with no variables.';
      
      const variables = enhancementAgent.extractVariables(template);

      expect(variables).toHaveLength(0);
    });

    it('should handle duplicate variables', () => {
      const template = 'Use {{name}} for {{name}} processing with {{name}} output.';
      
      const variables = enhancementAgent.extractVariables(template);

      expect(variables).toHaveLength(1);
      expect(variables[0].key).toBe('name');
    });

    it('should identify sensitive variables', () => {
      const template = 'Connect using {{api_key}} and {{password}} for {{username}}';
      
      const variables = enhancementAgent.extractVariables(template);

      expect(variables.find(v => v.key === 'api_key')?.sensitive).toBe(true);
      expect(variables.find(v => v.key === 'password')?.sensitive).toBe(true);
      expect(variables.find(v => v.key === 'username')?.sensitive).toBe(false);
    });
  });

  describe('generateRationale', () => {
    it('should generate meaningful rationale', () => {
      const original: HumanPrompt = {
        goal: 'Help with writing',
        audience: 'Students',
        steps: ['Review text', 'Suggest improvements'],
        output_expectations: { format: 'feedback', fields: ['score', 'suggestions'] }
      };

      const enhanced: StructuredPrompt = {
        schema_version: 1,
        system: ['You are a writing tutor', 'Focus on constructive feedback'],
        capabilities: ['grammar checking', 'style analysis'],
        user_template: 'Review {{text}} for {{student_level}} student',
        rules: [{ name: 'constructive', description: 'Provide helpful feedback' }],
        variables: ['text', 'student_level']
      };

      const rationale = enhancementAgent.generateRationale(original, enhanced);

      expect(rationale).toBeTruthy();
      expect(rationale).toContain('system instruction');
      expect(rationale).toContain('variable');
      expect(rationale).toContain('structured');
    });

    it('should handle minimal changes', () => {
      const original: HumanPrompt = {
        goal: 'Simple task',
        audience: 'Users',
        steps: ['Do something'],
        output_expectations: { format: 'text', fields: ['result'] }
      };

      const enhanced: StructuredPrompt = {
        schema_version: 1,
        system: [], // No system instructions
        capabilities: [],
        user_template: 'Do the task', // No variables
        rules: [],
        variables: []
      };

      const rationale = enhancementAgent.generateRationale(original, enhanced);

      expect(rationale).toBeTruthy();
      expect(rationale).toContain('minimal changes');
    });
  });
});