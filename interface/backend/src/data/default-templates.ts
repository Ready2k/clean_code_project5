/**
 * Default Template Definitions
 * 
 * This file contains all default templates converted from hardcoded prompts
 * into the proper template format for the System Prompt Manager.
 */

import { TemplateCategory, DefaultTemplate } from '../types/prompt-templates';

/**
 * All default templates organized by category
 */
export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  // Enhancement Templates
  {
    category: TemplateCategory.ENHANCEMENT,
    key: 'main_enhancement_prompt',
    name: 'Main Enhancement Instruction',
    description: 'Primary template for converting human prompts to structured format',
    content: `Please enhance the following human-readable prompt into a structured format.

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

Respond with a JSON object containing:
{
  "structured": {
    "schema_version": 1,
    "system": ["instruction1", "instruction2"],
    "capabilities": ["capability1", "capability2"],
    "user_template": "template with {{variables}}",
    "rules": [{"name": "rule1", "description": "desc1"}],
    "variables": ["var1", "var2"]
  },
  "changes_made": ["change1", "change2"],
  "warnings": ["warning1", "warning2"]
}`,
    variables: [
      {
        name: 'goal',
        type: 'string',
        description: 'The main goal of the prompt',
        required: true,
        defaultValue: null,
        validation: [{ type: 'minLength', value: 10 }]
      },
      {
        name: 'audience',
        type: 'string',
        description: 'Target audience for the prompt',
        required: true,
        defaultValue: null,
        validation: [{ type: 'minLength', value: 3 }]
      },
      {
        name: 'steps',
        type: 'array',
        description: 'List of steps to accomplish the goal',
        required: true,
        defaultValue: null
      },
      {
        name: 'output_format',
        type: 'string',
        description: 'Expected output format',
        required: true,
        defaultValue: 'text'
      },
      {
        name: 'expected_fields',
        type: 'string',
        description: 'Expected output fields (comma-separated)',
        required: true,
        defaultValue: null
      },
      {
        name: 'target_provider',
        type: 'string',
        description: 'Target LLM provider for optimization',
        required: false,
        defaultValue: null
      },
      {
        name: 'domain_knowledge',
        type: 'string',
        description: 'Domain-specific context or knowledge',
        required: false,
        defaultValue: null
      }
    ],
    metadata: {
      provider_optimized: ['openai', 'anthropic', 'meta'],
      task_types: ['enhancement'],
      complexity_level: 'intermediate'
    }
  },
  {
    category: TemplateCategory.ENHANCEMENT,
    key: 'system_enhancement_prompt',
    name: 'Enhancement System Instructions',
    description: 'System-level instructions for the enhancement agent',
    content: `You are an expert prompt engineer specializing in converting human-readable prompts into structured, reusable formats. Your goal is to:

1. Preserve the original intent and meaning
2. Create clear, actionable system instructions
3. Design flexible user templates with appropriate variables
4. Define specific rules and constraints
5. Identify required capabilities
6. Ensure the result is provider-agnostic and reusable

Focus on clarity, specificity, and maintainability. Extract variables for any content that should be dynamic or reusable.`,
    variables: [],
    metadata: {
      provider_optimized: ['openai', 'anthropic', 'meta'],
      task_types: ['enhancement'],
      complexity_level: 'basic'
    }
  },

  // Question Generation Templates
  {
    category: TemplateCategory.QUESTION_GENERATION,
    key: 'analysis_questions',
    name: 'Analysis Task Questions',
    description: 'Questions for analysis-type tasks',
    content: `{
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
}`,
    variables: [],
    metadata: {
      task_types: ['analysis'],
      complexity_level: 'basic'
    }
  },
  {
    category: TemplateCategory.QUESTION_GENERATION,
    key: 'generation_questions',
    name: 'Generation Task Questions',
    description: 'Questions for content generation tasks',
    content: `{
  "questions": [
    {
      "variable_key": "generation_topic",
      "text": "What topic or subject should be generated?",
      "type": "string",
      "required": true,
      "help_text": "The main topic, theme, or subject for the generated content"
    },
    {
      "variable_key": "content_style",
      "text": "What style or tone should be used?",
      "type": "select",
      "required": false,
      "options": ["professional", "casual", "academic", "creative", "technical", "friendly"],
      "help_text": "The writing style or tone for the generated content"
    }
  ]
}`,
    variables: [],
    metadata: {
      task_types: ['generation'],
      complexity_level: 'basic'
    }
  },
  {
    category: TemplateCategory.QUESTION_GENERATION,
    key: 'code_questions',
    name: 'Code Task Questions',
    description: 'Questions for coding tasks',
    content: `{
  "questions": [
    {
      "variable_key": "programming_language",
      "text": "What programming language should be used?",
      "type": "select",
      "required": true,
      "options": ["JavaScript", "Python", "TypeScript", "Java", "C#", "Go", "Rust", "Other"],
      "help_text": "The programming language for the code"
    },
    {
      "variable_key": "code_requirements",
      "text": "What are the specific requirements for the code?",
      "type": "string",
      "required": false,
      "help_text": "Any specific requirements, constraints, or features needed"
    }
  ]
}`,
    variables: [],
    metadata: {
      task_types: ['code'],
      complexity_level: 'intermediate'
    }
  },

  // Mock Response Templates (Development/Testing Only)
  {
    category: TemplateCategory.MOCK_RESPONSES,
    key: 'enhancement_response',
    name: 'Default Enhancement Response',
    description: 'Mock response for enhancement requests (development/testing only)',
    content: `{
  "structured": {
    "schema_version": 1,
    "system": [
      "You are a helpful AI assistant designed to complete tasks efficiently and accurately.",
      "Always provide clear, well-structured responses that directly address the user's needs."
    ],
    "capabilities": [
      "Text analysis and processing",
      "Information synthesis",
      "Clear communication"
    ],
    "user_template": "Please help me with the following task: {{task_description}}. The target audience is {{audience}} and I need the output in {{output_format}} format.",
    "rules": [
      {
        "name": "Clarity",
        "description": "Always provide clear and unambiguous responses"
      },
      {
        "name": "Relevance",
        "description": "Stay focused on the specific task at hand"
      }
    ],
    "variables": ["task_description", "audience", "output_format"]
  },
  "changes_made": [
    "Converted free-form instructions into structured template format",
    "Added system context for role definition",
    "Extracted variables for reusability",
    "Defined specific rules for consistent behavior"
  ],
  "warnings": []
}`,
    variables: [
      {
        name: 'task_description',
        type: 'string',
        description: 'Description of the task to be performed',
        required: true,
        defaultValue: null
      },
      {
        name: 'audience',
        type: 'string',
        description: 'Target audience for the output',
        required: true,
        defaultValue: null
      },
      {
        name: 'output_format',
        type: 'string',
        description: 'Desired output format',
        required: true,
        defaultValue: 'text'
      }
    ],
    metadata: {
      task_types: ['enhancement'],
      complexity_level: 'basic'
    }
  }
];

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateCategory): DefaultTemplate[] {
  return DEFAULT_TEMPLATES.filter(template => template.category === category);
}

/**
 * Get template by key
 */
export function getTemplateByKey(category: TemplateCategory, key: string): DefaultTemplate | undefined {
  return DEFAULT_TEMPLATES.find(template => 
    template.category === category && template.key === key
  );
}