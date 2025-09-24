// Enhancement Workflow - Orchestrates the complete enhancement pipeline

import { HumanPrompt, StructuredPrompt } from '../models/prompt';
import { EnhancementResult, EnhancementRequest } from '../models/enhancement';
import { Question, Answer } from '../models/variable';
import { EnhancementAgent } from './enhancement-agent';
import { ValidationResult } from '../types/validation';
import { EnhancementContext } from '../types/common';

export interface EnhancementWorkflow {
  /**
   * Execute the complete enhancement pipeline
   */
  executeEnhancement(request: EnhancementRequest): Promise<EnhancementWorkflowResult>;

  /**
   * Validate enhancement prerequisites
   */
  validateEnhancementRequest(request: EnhancementRequest): ValidationResult;

  /**
   * Detect missing variables and generate questions
   */
  detectMissingVariables(
    structuredPrompt: StructuredPrompt, 
    existingAnswers?: Answer[]
  ): Promise<Question[]>;

  /**
   * Validate enhancement result quality
   */
  validateEnhancementResult(result: EnhancementResult): ValidationResult;

  /**
   * Generate comprehensive rationale with change analysis
   */
  generateDetailedRationale(
    original: HumanPrompt,
    enhanced: StructuredPrompt,
    context?: EnhancementContext
  ): Promise<EnhancementRationale>;
}

export interface EnhancementWorkflowResult {
  success: boolean;
  result?: EnhancementResult;
  error?: string;
  warnings: string[];
  metadata: {
    processing_time_ms: number;
    llm_calls: number;
    confidence_score: number;
    quality_metrics: QualityMetrics;
  };
}

export interface EnhancementRationale {
  summary: string;
  detailed_changes: ChangeAnalysis[];
  quality_improvements: string[];
  potential_issues: string[];
  recommendations: string[];
}

export interface ChangeAnalysis {
  category: 'structure' | 'content' | 'variables' | 'rules' | 'capabilities';
  description: string;
  impact: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface QualityMetrics {
  completeness_score: number; // 0-100
  clarity_score: number; // 0-100
  reusability_score: number; // 0-100
  specificity_score: number; // 0-100
  overall_score: number; // 0-100
}

export class EnhancementWorkflowImpl implements EnhancementWorkflow {
  private enhancementAgent: EnhancementAgent;
  constructor(
    enhancementAgent: EnhancementAgent
  ) {
    this.enhancementAgent = enhancementAgent;
  }

  async executeEnhancement(request: EnhancementRequest): Promise<EnhancementWorkflowResult> {
    const startTime = Date.now();
    let llmCalls = 0;
    const warnings: string[] = [];

    try {
      // Step 1: Validate request
      const requestValidation = this.validateEnhancementRequest(request);
      if (!requestValidation.isValid) {
        return {
          success: false,
          error: `Invalid enhancement request: ${requestValidation.errors.join(', ')}`,
          warnings,
          metadata: {
            processing_time_ms: Date.now() - startTime,
            llm_calls: 0,
            confidence_score: 0,
            quality_metrics: this.getEmptyQualityMetrics()
          }
        };
      }

      // Step 2: Parse human prompt
      const humanPrompt = this.parseHumanPrompt(request.human_prompt);
      
      // Step 3: Execute enhancement
      llmCalls++;
      const enhancementResult = await this.enhancementAgent.enhance(
        humanPrompt, 
        request.context
      );

      // Step 4: Validate enhancement result
      const resultValidation = this.validateEnhancementResult(enhancementResult);
      if (!resultValidation.isValid) {
        warnings.push(...resultValidation.errors);
      }
      if (resultValidation.warnings) {
        warnings.push(...resultValidation.warnings);
      }

      // Step 5: Detect missing variables
      const missingVariableQuestions = await this.detectMissingVariables(
        enhancementResult.structuredPrompt
      );

      // Merge questions from enhancement and missing variable detection
      const allQuestions = [
        ...enhancementResult.questions,
        ...missingVariableQuestions
      ];

      // Remove duplicates based on variable_key
      const uniqueQuestions = allQuestions.filter((question, index, array) => 
        array.findIndex(q => q.variable_key === question.variable_key) === index
      );

      // Step 6: Generate detailed rationale
      llmCalls++;
      const detailedRationale = await this.generateDetailedRationale(
        humanPrompt,
        enhancementResult.structuredPrompt,
        request.context
      );

      // Step 7: Calculate quality metrics
      const qualityMetrics = await this.calculateQualityMetrics(
        humanPrompt,
        enhancementResult.structuredPrompt
      );

      // Step 8: Prepare final result
      const finalResult: EnhancementResult = {
        ...enhancementResult,
        questions: uniqueQuestions,
        rationale: detailedRationale.summary,
        warnings: [...(enhancementResult.warnings || []), ...warnings]
      };

      return {
        success: true,
        result: finalResult,
        warnings,
        metadata: {
          processing_time_ms: Date.now() - startTime,
          llm_calls: llmCalls,
          confidence_score: enhancementResult.confidence,
          quality_metrics: qualityMetrics
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Enhancement workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        warnings,
        metadata: {
          processing_time_ms: Date.now() - startTime,
          llm_calls: llmCalls,
          confidence_score: 0,
          quality_metrics: this.getEmptyQualityMetrics()
        }
      };
    }
  }

  validateEnhancementRequest(request: EnhancementRequest): ValidationResult {
    const errors: string[] = [];

    if (!request.prompt_id) {
      errors.push('Prompt ID is required');
    }

    if (!request.human_prompt || request.human_prompt.trim().length === 0) {
      errors.push('Human prompt is required and cannot be empty');
    }

    if (request.human_prompt && request.human_prompt.length > 10000) {
      errors.push('Human prompt is too long (maximum 10,000 characters)');
    }

    // Validate context if provided
    if (request.context) {
      if (request.context.targetProvider && 
          !['openai', 'anthropic', 'meta'].includes(request.context.targetProvider)) {
        errors.push('Invalid target provider. Must be one of: openai, anthropic, meta');
      }
    }

    // Validate options if provided
    if (request.options) {
      if (typeof request.options.preserve_style !== 'undefined' && 
          typeof request.options.preserve_style !== 'boolean') {
        errors.push('preserve_style option must be a boolean');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async detectMissingVariables(
    structuredPrompt: StructuredPrompt, 
    existingAnswers: Answer[] = []
  ): Promise<Question[]> {
    // Extract variables from the template
    const templateVariables = this.enhancementAgent.extractVariables(structuredPrompt.user_template);
    
    // Get existing answer variable keys
    const answeredVariableKeys = new Set(
      existingAnswers.map(answer => {
        // Find the question for this answer to get the variable key
        // This is a simplified approach - in a real implementation,
        // you'd need to look up the question by answer.question_id
        return answer.question_id; // Placeholder
      })
    );

    // Filter out variables that already have answers
    const missingVariables = templateVariables.filter(variable => 
      !answeredVariableKeys.has(variable.key)
    );

    // Generate questions for missing variables
    return await this.enhancementAgent.generateQuestions(missingVariables);
  }

  validateEnhancementResult(result: EnhancementResult): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate structured prompt
    const structuredValidation = this.enhancementAgent.validateStructuredPrompt(result.structuredPrompt);
    if (!structuredValidation.isValid) {
      errors.push(...structuredValidation.errors);
    }
    if (structuredValidation.warnings) {
      warnings.push(...structuredValidation.warnings);
    }

    // Validate confidence score
    if (result.confidence < 0 || result.confidence > 1) {
      errors.push('Confidence score must be between 0 and 1');
    }

    // Quality checks
    if (result.confidence < 0.5) {
      warnings.push('Low confidence score - enhancement may need review');
    }

    if (!result.rationale || result.rationale.length < 20) {
      warnings.push('Enhancement rationale is too brief');
    }

    if (result.questions.length === 0 && result.structuredPrompt.variables.length > 0) {
      warnings.push('Variables defined but no questions generated');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  async generateDetailedRationale(
    original: HumanPrompt,
    enhanced: StructuredPrompt,
    context?: EnhancementContext
  ): Promise<EnhancementRationale> {
    const changes: ChangeAnalysis[] = [];
    const qualityImprovements: string[] = [];
    const potentialIssues: string[] = [];
    const recommendations: string[] = [];

    // Analyze structural changes
    if (enhanced.system.length > 0) {
      changes.push({
        category: 'structure',
        description: `Added ${enhanced.system.length} system instruction(s)`,
        impact: 'high',
        rationale: 'System instructions provide clear context and role definition for the AI'
      });
      qualityImprovements.push('Improved AI role clarity and context understanding');
    }

    // Analyze content transformation
    const originalLength = original.goal.length + original.steps.join(' ').length;
    const enhancedLength = enhanced.user_template.length + enhanced.system.join(' ').length;
    
    if (enhancedLength > originalLength * 1.5) {
      changes.push({
        category: 'content',
        description: 'Significantly expanded content with additional details',
        impact: 'medium',
        rationale: 'Added specificity and clarity to improve prompt effectiveness'
      });
      qualityImprovements.push('Enhanced specificity and detail level');
    }

    // Analyze variable extraction
    const variables = this.enhancementAgent.extractVariables(enhanced.user_template);
    if (variables.length > 0) {
      changes.push({
        category: 'variables',
        description: `Extracted ${variables.length} variable(s) for reusability`,
        impact: 'high',
        rationale: 'Variables make the prompt reusable across different contexts'
      });
      qualityImprovements.push('Increased prompt reusability and flexibility');
    }

    // Analyze rules
    if (enhanced.rules.length > 0) {
      changes.push({
        category: 'rules',
        description: `Defined ${enhanced.rules.length} specific rule(s)`,
        impact: 'medium',
        rationale: 'Rules ensure consistent behavior and output quality'
      });
      qualityImprovements.push('Added behavioral constraints for consistency');
    }

    // Analyze capabilities
    if (enhanced.capabilities.length > 0) {
      changes.push({
        category: 'capabilities',
        description: `Identified ${enhanced.capabilities.length} required capability/capabilities`,
        impact: 'low',
        rationale: 'Capability requirements help with provider selection and optimization'
      });
    }

    // Identify potential issues
    if (variables.length > 5) {
      potentialIssues.push('High number of variables may make the prompt complex to use');
      recommendations.push('Consider grouping related variables or providing defaults');
    }

    if (enhanced.system.length > 5) {
      potentialIssues.push('Many system instructions may lead to conflicting guidance');
      recommendations.push('Consolidate system instructions for clarity');
    }

    if (enhanced.user_template.length > 1000) {
      potentialIssues.push('Very long user template may impact performance');
      recommendations.push('Consider breaking down into smaller, focused prompts');
    }

    // Context-specific recommendations
    if (context?.targetProvider === 'anthropic') {
      recommendations.push('Consider leveraging Claude\'s strong reasoning capabilities');
    } else if (context?.targetProvider === 'openai') {
      recommendations.push('Optimize for GPT\'s conversational strengths');
    }

    const summary = this.generateRationaleSummary(changes, qualityImprovements);

    return {
      summary,
      detailed_changes: changes,
      quality_improvements: qualityImprovements,
      potential_issues: potentialIssues,
      recommendations
    };
  }

  private parseHumanPrompt(humanPromptText: string): HumanPrompt {
    // Simple parsing - in a real implementation, this could be more sophisticated
    // For now, we'll create a basic structure from the text
    const lines = humanPromptText.split('\n').filter(line => line.trim());
    
    return {
      goal: lines[0] || humanPromptText.substring(0, 200),
      audience: 'General users', // Default
      steps: lines.slice(1, 4).length > 0 ? lines.slice(1, 4) : ['Complete the requested task'],
      output_expectations: {
        format: 'text',
        fields: ['result']
      }
    };
  }

  private async calculateQualityMetrics(
    _original: HumanPrompt,
    enhanced: StructuredPrompt
  ): Promise<QualityMetrics> {
    let completeness = 0;
    let clarity = 0;
    let reusability = 0;
    let specificity = 0;

    // Completeness score
    if (enhanced.system.length > 0) completeness += 25;
    if (enhanced.user_template.length > 50) completeness += 25;
    if (enhanced.rules.length > 0) completeness += 25;
    if (enhanced.capabilities.length > 0) completeness += 25;

    // Clarity score
    const avgSystemLength = enhanced.system.reduce((sum, s) => sum + s.length, 0) / Math.max(enhanced.system.length, 1);
    if (avgSystemLength > 20 && avgSystemLength < 200) clarity += 30;
    if (enhanced.user_template.length > 30) clarity += 30;
    if (enhanced.rules.length > 0) clarity += 40;

    // Reusability score
    const variables = this.enhancementAgent.extractVariables(enhanced.user_template);
    reusability = Math.min(100, variables.length * 25);

    // Specificity score
    const specificityKeywords = ['specific', 'detailed', 'exactly', 'must', 'should', 'format'];
    const templateText = enhanced.user_template.toLowerCase();
    const keywordCount = specificityKeywords.filter(keyword => templateText.includes(keyword)).length;
    specificity = Math.min(100, keywordCount * 20);

    const overall = Math.round((completeness + clarity + reusability + specificity) / 4);

    return {
      completeness_score: completeness,
      clarity_score: clarity,
      reusability_score: reusability,
      specificity_score: specificity,
      overall_score: overall
    };
  }

  private generateRationaleSummary(changes: ChangeAnalysis[], improvements: string[]): string {
    if (changes.length === 0) {
      return 'Converted human prompt to structured format with minimal changes needed.';
    }

    const changeDescriptions = changes.map(c => c.description.toLowerCase());

    let summary = 'Enhanced the prompt by: ';
    summary += changeDescriptions.join(', ');
    summary += '. ';

    if (improvements.length > 0) {
      summary += `Key improvements: ${improvements.slice(0, 3).join(', ')}.`;
    }

    return summary;
  }

  private getEmptyQualityMetrics(): QualityMetrics {
    return {
      completeness_score: 0,
      clarity_score: 0,
      reusability_score: 0,
      specificity_score: 0,
      overall_score: 0
    };
  }
}