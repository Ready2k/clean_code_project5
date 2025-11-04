/**
 * Example demonstrating how to use the template-integrated services
 */

import { 
  createEnhancementAgent, 
  createQuestionGenerator, 
  createMockLLMService,
  initializePromptTemplateIntegration 
} from '../services/prompt-template-integration';
import { HumanPrompt } from '../models/prompt';
import { TemplateCategory, TemplateContext } from '../types/prompt-templates';

// Mock System Prompt Manager for demonstration
class MockSystemPromptManager {
  private templates = new Map<string, string>();

  constructor() {
    // Setup some example templates
    this.templates.set('enhancement:main_enhancement_prompt', `
Please enhance the following human-readable prompt into a structured format.

HUMAN PROMPT:
Goal: {{goal}}
Audience: {{audience}}
Steps: {{steps}}
Output Format: {{output_format}}
Expected Fields: {{expected_fields}}

REQUIREMENTS:
- Convert to structured format with system instructions, user template, rules, and capabilities
- Extract variables using {{variable_name}} syntax where content should be dynamic
- Preserve the original intent and goal
- Make the prompt clear, specific, and actionable
- Include appropriate rules and constraints
{{#if target_provider}}- Optimize for {{target_provider}} provider{{/if}}
{{#if domain_knowledge}}- Consider this domain context: {{domain_knowledge}}{{/if}}

Respond with a JSON object containing the structured prompt format.
    `);

    this.templates.set('enhancement:system_enhancement_prompt', `
You are an expert prompt engineer specializing in converting human-readable prompts into structured, reusable formats. Your goal is to:

1. Preserve the original intent and meaning
2. Create clear, actionable system instructions
3. Design flexible user templates with appropriate variables
4. Define specific rules and constraints
5. Identify required capabilities
6. Ensure the result is provider-agnostic and reusable

Focus on clarity, specificity, and maintainability. Extract variables for any content that should be dynamic or reusable.
    `);

    this.templates.set('question_generation:analysis_questions', `
{
  "questions": [
    {
      "variable_key": "analysis_data",
      "text": "What data or content should be analyzed?",
      "type": "string",
      "required": true,
      "help_text": "Provide the specific data, document, or content to analyze"
    },
    {
      "variable_key": "analysis_focus",
      "text": "What specific aspects should the analysis focus on?",
      "type": "string",
      "required": false,
      "help_text": "e.g., trends, patterns, quality, performance, etc."
    }
  ]
}
    `);
  }

  async getTemplate(category: TemplateCategory, key: string, context?: TemplateContext): Promise<string> {
    const templateKey = `${category}:${key}`;
    const template = this.templates.get(templateKey);
    
    if (!template) {
      throw new Error(`Template not found: ${templateKey}`);
    }

    // Simple variable substitution for demonstration
    let rendered = template;
    if (context?.userContext) {
      for (const [key, value] of Object.entries(context.userContext)) {
        rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      }
    }

    return rendered;
  }
}

/**
 * Example usage of template-integrated services
 */
export async function demonstrateTemplateIntegration(): Promise<void> {
  console.log('=== Template Integration Example ===\n');

  // 1. Initialize the integration service with a mock template manager
  const mockTemplateManager = new MockSystemPromptManager();
  const integrationService = initializePromptTemplateIntegration(mockTemplateManager);

  console.log('✓ Template integration initialized');

  // 2. Create services with template support
  const mockLLM = createMockLLMService();
  const enhancementAgent = createEnhancementAgent(mockLLM);
  const questionGenerator = createQuestionGenerator();

  console.log('✓ Services created with template integration');

  // 3. Test enhancement with templates
  const humanPrompt: HumanPrompt = {
    goal: 'Create a comprehensive data analysis report',
    audience: 'Business stakeholders',
    steps: [
      'Collect relevant data from multiple sources',
      'Clean and preprocess the data',
      'Perform statistical analysis',
      'Create visualizations',
      'Write executive summary'
    ],
    output_expectations: {
      format: 'PDF report with charts',
      fields: ['executive_summary', 'methodology', 'findings', 'recommendations']
    }
  };

  console.log('\n--- Testing Enhancement Agent with Templates ---');
  try {
    const enhancementResult = await enhancementAgent.enhance(humanPrompt, {
      targetProvider: 'openai',
      domainKnowledge: 'Business intelligence and data analytics'
    });

    console.log('✓ Enhancement completed using templates');
    console.log(`Generated ${enhancementResult.questions.length} contextual questions`);
    console.log(`Confidence score: ${enhancementResult.confidence}`);
  } catch (error) {
    console.log('⚠ Enhancement fell back to hardcoded prompts:', error);
  }

  // 4. Test question generation with templates
  console.log('\n--- Testing Question Generator with Templates ---');
  try {
    const questions = await questionGenerator.generateQuestions({
      humanPrompt,
      taskType: 'analysis'
    });

    console.log(`✓ Generated ${questions.length} questions using templates`);
    questions.forEach((q, i) => {
      console.log(`  ${i + 1}. ${q.text} (${q.variable_key})`);
    });
  } catch (error) {
    console.log('⚠ Question generation fell back to hardcoded logic:', error);
  }

  // 5. Test mock LLM with templates
  console.log('\n--- Testing Mock LLM with Templates ---');
  try {
    const mockResponse = await mockLLM.complete('Please analyze the sales data for trends');
    console.log('✓ Mock LLM response generated');
    console.log('Response preview:', mockResponse.substring(0, 100) + '...');
  } catch (error) {
    console.log('⚠ Mock LLM error:', error);
  }

  console.log('\n=== Integration Example Complete ===');
}

/**
 * Example of using services without template integration (backward compatibility)
 */
export async function demonstrateBackwardCompatibility(): Promise<void> {
  console.log('\n=== Backward Compatibility Example ===\n');

  // Create services without template manager - should work with hardcoded prompts
  const mockLLM = createMockLLMService();
  const enhancementAgent = createEnhancementAgent(mockLLM);
  const questionGenerator = createQuestionGenerator();

  console.log('✓ Services created without template integration');

  const humanPrompt: HumanPrompt = {
    goal: 'Write a blog post about AI trends',
    audience: 'Technology professionals',
    steps: ['Research current AI trends', 'Write engaging content', 'Add examples'],
    output_expectations: {
      format: 'Markdown',
      fields: ['title', 'introduction', 'main_content', 'conclusion']
    }
  };

  try {
    const result = await enhancementAgent.enhance(humanPrompt);
    console.log('✓ Enhancement works with hardcoded prompts');
    console.log(`Generated ${result.questions.length} questions using fallback logic`);
  } catch (error) {
    console.log('✗ Backward compatibility issue:', error);
  }

  console.log('\n=== Backward Compatibility Verified ===');
}

// Run examples if this file is executed directly
if (require.main === module) {
  demonstrateTemplateIntegration()
    .then(() => demonstrateBackwardCompatibility())
    .catch(console.error);
}