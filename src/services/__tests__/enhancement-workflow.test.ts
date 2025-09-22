// Tests for EnhancementWorkflow

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancementWorkflowImpl } from '../enhancement-workflow';
import { EnhancementAgentImpl } from '../enhancement-agent';
import { MockLLMService } from '../mock-llm-service';
import { VariableManager } from '../variable-manager';
import { EnhancementRequest } from '../../models/enhancement';
import { HumanPrompt, StructuredPrompt } from '../../models/prompt';

describe('EnhancementWorkflowImpl', () => {
  let workflow: EnhancementWorkflowImpl;
  let mockLLMService: MockLLMService;
  let enhancementAgent: EnhancementAgentImpl;
  let variableManager: VariableManager;

  beforeEach(() => {
    mockLLMService = new MockLLMService();
    enhancementAgent = new EnhancementAgentImpl(mockLLMService);
    variableManager = new VariableManager();
    workflow = new EnhancementWorkflowImpl(enhancementAgent, variableManager);
  });

  describe('executeEnhancement', () => {
    it('should execute complete enhancement workflow successfully', async () => {
      const request: EnhancementRequest = {
        prompt_id: 'test-prompt-123',
        human_prompt: 'Help users write better emails for business communication',
        context: {
          targetProvider: 'openai',
          domainKnowledge: 'Business communication best practices'
        },
        options: {
          preserve_style: true,
          add_examples: false,
          optimize_for_clarity: true
        }
      };

      const result = await workflow.executeEnhancement(request);

      if (!result.success) {
        console.log('Enhancement failed:', result.error);
        console.log('Warnings:', result.warnings);
      }

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result!.structuredPrompt).toBeDefined();
      expect(result.result!.questions).toBeInstanceOf(Array);
      expect(result.result!.rationale).toBeTruthy();
      expect(result.result!.confidence).toBeGreaterThan(0);
      expect(result.metadata.processing_time_ms).toBeGreaterThan(0);
      expect(result.metadata.llm_calls).toBeGreaterThan(0);
      expect(result.metadata.quality_metrics).toBeDefined();
    });

    it('should handle invalid enhancement request', async () => {
      const invalidRequest: EnhancementRequest = {
        prompt_id: '', // Empty prompt ID
        human_prompt: '', // Empty human prompt
        context: {
          targetProvider: 'invalid-provider' as any
        }
      };

      const result = await workflow.executeEnhancement(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain('Invalid enhancement request');
      expect(result.metadata.llm_calls).toBe(0);
    });

    it('should handle LLM service failures gracefully', async () => {
      const failingLLMService = {
        async complete() {
          throw new Error('LLM service unavailable');
        },
        async isAvailable() {
          return false;
        }
      };

      const failingAgent = new EnhancementAgentImpl(failingLLMService);
      const failingWorkflow = new EnhancementWorkflowImpl(failingAgent, variableManager);

      const request: EnhancementRequest = {
        prompt_id: 'test-prompt',
        human_prompt: 'Test prompt'
      };

      const result = await failingWorkflow.executeEnhancement(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Enhancement workflow failed');
      expect(result.metadata.confidence_score).toBe(0);
    });

    it('should merge questions from enhancement and missing variable detection', async () => {
      // Set up a custom response with specific variables
      const customResponse = JSON.stringify({
        structured: {
          schema_version: 1,
          system: ["You are a helpful assistant"],
          capabilities: ["text processing"],
          user_template: "Process {{input_text}} for {{audience}} and output in {{format}} format with {{additional_param}}",
          rules: [{ name: "clarity", description: "Be clear" }],
          variables: ["input_text", "audience", "format", "additional_param"]
        },
        changes_made: ["Added variables"],
        warnings: []
      });

      mockLLMService.addResponse('Help users write better emails', customResponse);

      const request: EnhancementRequest = {
        prompt_id: 'test-prompt',
        human_prompt: 'Help users write better emails for business communication'
      };

      const result = await workflow.executeEnhancement(request);

      expect(result.success).toBe(true);
      expect(result.result!.questions.length).toBeGreaterThan(0);
      
      // Check that questions are unique by variable_key
      const variableKeys = result.result!.questions.map(q => q.variable_key);
      const uniqueKeys = [...new Set(variableKeys)];
      expect(variableKeys.length).toBe(uniqueKeys.length);
    });

    it('should include quality metrics in metadata', async () => {
      const request: EnhancementRequest = {
        prompt_id: 'test-prompt',
        human_prompt: 'Create a comprehensive data analysis report with detailed insights'
      };

      const result = await workflow.executeEnhancement(request);

      expect(result.success).toBe(true);
      expect(result.metadata.quality_metrics).toBeDefined();
      expect(result.metadata.quality_metrics.completeness_score).toBeGreaterThanOrEqual(0);
      expect(result.metadata.quality_metrics.clarity_score).toBeGreaterThanOrEqual(0);
      expect(result.metadata.quality_metrics.reusability_score).toBeGreaterThanOrEqual(0);
      expect(result.metadata.quality_metrics.specificity_score).toBeGreaterThanOrEqual(0);
      expect(result.metadata.quality_metrics.overall_score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validateEnhancementRequest', () => {
    it('should validate a well-formed request', () => {
      const validRequest: EnhancementRequest = {
        prompt_id: 'test-prompt-123',
        human_prompt: 'Help users with task completion',
        context: {
          targetProvider: 'openai',
          domainKnowledge: 'Task management'
        },
        options: {
          preserve_style: true,
          add_examples: false,
          optimize_for_clarity: true
        }
      };

      const result = workflow.validateEnhancementRequest(validRequest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should identify missing required fields', () => {
      const invalidRequest: EnhancementRequest = {
        prompt_id: '',
        human_prompt: ''
      };

      const result = workflow.validateEnhancementRequest(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Prompt ID is required');
      expect(result.errors).toContain('Human prompt is required and cannot be empty');
    });

    it('should validate prompt length limits', () => {
      const longPrompt = 'a'.repeat(10001); // Exceeds 10,000 character limit
      const request: EnhancementRequest = {
        prompt_id: 'test',
        human_prompt: longPrompt
      };

      const result = workflow.validateEnhancementRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Human prompt is too long (maximum 10,000 characters)');
    });

    it('should validate target provider', () => {
      const request: EnhancementRequest = {
        prompt_id: 'test',
        human_prompt: 'Test prompt',
        context: {
          targetProvider: 'invalid-provider' as any
        }
      };

      const result = workflow.validateEnhancementRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid target provider. Must be one of: openai, anthropic, meta');
    });

    it('should validate options types', () => {
      const request: EnhancementRequest = {
        prompt_id: 'test',
        human_prompt: 'Test prompt',
        options: {
          preserve_style: 'true' as any, // Should be boolean
          add_examples: false,
          optimize_for_clarity: true
        }
      };

      const result = workflow.validateEnhancementRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('preserve_style option must be a boolean');
    });
  });

  describe('detectMissingVariables', () => {
    it('should detect variables without answers', async () => {
      const structuredPrompt: StructuredPrompt = {
        schema_version: 1,
        system: ['You are helpful'],
        capabilities: [],
        user_template: 'Process {{input_data}} for {{target_audience}} in {{output_format}} format',
        rules: [],
        variables: ['input_data', 'target_audience', 'output_format']
      };

      const questions = await workflow.detectMissingVariables(structuredPrompt);

      expect(questions.length).toBe(3);
      expect(questions.map(q => q.variable_key)).toEqual([
        'input_data', 'target_audience', 'output_format'
      ]);
    });

    it('should handle prompts with no variables', async () => {
      const structuredPrompt: StructuredPrompt = {
        schema_version: 1,
        system: ['You are helpful'],
        capabilities: [],
        user_template: 'This is a static prompt with no variables',
        rules: [],
        variables: []
      };

      const questions = await workflow.detectMissingVariables(structuredPrompt);

      expect(questions).toHaveLength(0);
    });
  });

  describe('validateEnhancementResult', () => {
    it('should validate a good enhancement result', () => {
      const goodResult = {
        structuredPrompt: {
          schema_version: 1,
          system: ['You are a helpful assistant'],
          capabilities: ['text processing'],
          user_template: 'Help with {{task}}',
          rules: [{ name: 'clarity', description: 'Be clear' }],
          variables: ['task']
        },
        questions: [],
        rationale: 'Enhanced the prompt by adding structure and clarity',
        confidence: 0.85,
        changes_made: ['Added system instructions'],
        warnings: []
      };

      const result = workflow.validateEnhancementResult(goodResult);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should identify quality issues', () => {
      const poorResult = {
        structuredPrompt: {
          schema_version: 1,
          system: ['Help'],
          capabilities: [],
          user_template: 'Do task',
          rules: [],
          variables: ['unused_var'] // Variable not in template
        },
        questions: [],
        rationale: 'Brief', // Too short
        confidence: 0.3, // Low confidence
        changes_made: [],
        warnings: []
      };

      const result = workflow.validateEnhancementResult(poorResult);

      expect(result.isValid).toBe(false);
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
      expect(result.warnings!.some(w => w.includes('Low confidence'))).toBe(true);
      expect(result.warnings!.some(w => w.includes('rationale is too brief'))).toBe(true);
    });

    it('should validate confidence score range', () => {
      const invalidResult = {
        structuredPrompt: {
          schema_version: 1,
          system: ['You are helpful'],
          capabilities: [],
          user_template: 'Help with task',
          rules: [],
          variables: []
        },
        questions: [],
        rationale: 'Good rationale',
        confidence: 1.5, // Invalid - over 1.0
        changes_made: [],
        warnings: []
      };

      const result = workflow.validateEnhancementResult(invalidResult);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Confidence score must be between 0 and 1');
    });
  });

  describe('generateDetailedRationale', () => {
    it('should generate comprehensive rationale', async () => {
      const original: HumanPrompt = {
        goal: 'Help with email writing',
        audience: 'Business professionals',
        steps: ['Analyze context', 'Suggest improvements'],
        output_expectations: { format: 'feedback', fields: ['suggestions'] }
      };

      const enhanced: StructuredPrompt = {
        schema_version: 1,
        system: [
          'You are an expert email writing assistant',
          'Focus on professional communication standards'
        ],
        capabilities: ['writing analysis', 'communication optimization'],
        user_template: 'Analyze {{email_content}} for {{recipient_type}} and provide {{feedback_type}} feedback',
        rules: [
          { name: 'professionalism', description: 'Maintain professional tone' },
          { name: 'clarity', description: 'Ensure clear communication' }
        ],
        variables: ['email_content', 'recipient_type', 'feedback_type']
      };

      const rationale = await workflow.generateDetailedRationale(original, enhanced);

      expect(rationale.summary).toBeTruthy();
      expect(rationale.detailed_changes).toBeInstanceOf(Array);
      expect(rationale.detailed_changes.length).toBeGreaterThan(0);
      expect(rationale.quality_improvements).toBeInstanceOf(Array);
      expect(rationale.potential_issues).toBeInstanceOf(Array);
      expect(rationale.recommendations).toBeInstanceOf(Array);

      // Check for specific change categories
      const changeCategories = rationale.detailed_changes.map(c => c.category);
      expect(changeCategories).toContain('structure');
      expect(changeCategories).toContain('variables');
      expect(changeCategories).toContain('rules');
      expect(changeCategories).toContain('capabilities');
    });

    it('should identify potential issues with complex prompts', async () => {
      const original: HumanPrompt = {
        goal: 'Simple task',
        audience: 'Users',
        steps: ['Do something'],
        output_expectations: { format: 'text', fields: ['result'] }
      };

      const complexEnhanced: StructuredPrompt = {
        schema_version: 1,
        system: [
          'Instruction 1', 'Instruction 2', 'Instruction 3',
          'Instruction 4', 'Instruction 5', 'Instruction 6'
        ], // Too many system instructions
        capabilities: [],
        user_template: 'Process {{var1}} {{var2}} {{var3}} {{var4}} {{var5}} {{var6}}', // Too many variables
        rules: [],
        variables: ['var1', 'var2', 'var3', 'var4', 'var5', 'var6']
      };

      const rationale = await workflow.generateDetailedRationale(original, complexEnhanced);

      expect(rationale.potential_issues.length).toBeGreaterThan(0);
      expect(rationale.recommendations.length).toBeGreaterThan(0);
      expect(rationale.potential_issues.some(issue => 
        issue.includes('High number of variables')
      )).toBe(true);
      expect(rationale.potential_issues.some(issue => 
        issue.includes('Many system instructions')
      )).toBe(true);
    });

    it('should provide provider-specific recommendations', async () => {
      const original: HumanPrompt = {
        goal: 'Test task',
        audience: 'Users',
        steps: ['Step 1'],
        output_expectations: { format: 'text', fields: ['result'] }
      };

      const enhanced: StructuredPrompt = {
        schema_version: 1,
        system: ['You are helpful'],
        capabilities: [],
        user_template: 'Do {{task}}',
        rules: [],
        variables: ['task']
      };

      const anthropicContext = { targetProvider: 'anthropic' as const };
      const openaiContext = { targetProvider: 'openai' as const };

      const anthropicRationale = await workflow.generateDetailedRationale(
        original, enhanced, anthropicContext
      );
      const openaiRationale = await workflow.generateDetailedRationale(
        original, enhanced, openaiContext
      );

      expect(anthropicRationale.recommendations.some(r => 
        r.includes('Claude')
      )).toBe(true);
      expect(openaiRationale.recommendations.some(r => 
        r.includes('GPT')
      )).toBe(true);
    });
  });
});