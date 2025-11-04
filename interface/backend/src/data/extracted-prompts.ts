/**
 * Extracted Hardcoded Prompts Documentation
 * 
 * This file documents all hardcoded prompts found in the existing codebase
 * that need to be migrated to the template system.
 */

export interface ExtractedPrompt {
  source: string;
  method: string;
  category: 'enhancement' | 'question_generation' | 'mock_responses' | 'system_prompts';
  key: string;
  name: string;
  description: string;
  content: string;
  variables: string[];
  context?: Record<string, any>;
}

/**
 * All hardcoded prompts extracted from the codebase
 */
export const EXTRACTED_PROMPTS: ExtractedPrompt[] = [
  // Enhancement Agent Prompts
  {
    source: 'src/services/enhancement-agent.ts',
    method: 'buildEnhancementPrompt',
    category: 'enhancement',
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
    variables: ['goal', 'audience', 'steps', 'output_format', 'expected_fields', 'target_provider', 'domain_knowledge']
  },
  {
    source: 'src/services/enhancement-agent.ts',
    method: 'getEnhancementSystemPrompt',
    category: 'enhancement',
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
    variables: []
  },

  // Question Generation Templates (Task-Specific)
  {
    source: 'src/services/intelligent-question-generator.ts',
    method: 'generateAnalysisQuestions',
    category: 'question_generation',
    key: 'analysis_questions',
    name: 'Analysis Task Questions',
    description: 'Questions for analysis-type tasks',
    content: `Generate contextual questions for analysis tasks based on the following context:

Task Goal: {{goal}}
Audience: {{audience}}
Steps: {{steps}}
Output Format: {{output_format}}

Generate questions that help clarify:
1. What data or content should be analyzed (if not specified)
2. What specific aspects should the analysis focus on (if goal is vague)

Return as JSON array:
{
  "questions": [
    {
      "variable_key": "analysis_data",
      "text": "What data or content should be analyzed?",
      "type": "string",
      "required": true,
      "help_text": "Provide the specific data, document, or content to analyze"
    }
  ]
}`,
    variables: ['goal', 'audience', 'steps', 'output_format']
  },
  {
    source: 'src/services/intelligent-question-generator.ts',
    method: 'generateGenerationQuestions',
    category: 'question_generation',
    key: 'generation_questions',
    name: 'Generation Task Questions',
    description: 'Questions for content generation tasks',
    content: `Generate contextual questions for content generation tasks:

Task Goal: {{goal}}
Audience: {{audience}}
Steps: {{steps}}

Generate questions that help clarify:
1. Topic or subject (if not clear)
2. Style or tone (if not specified)

Return as JSON array:
{
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
    variables: ['goal', 'audience', 'steps']
  },
  {
    source: 'src/services/intelligent-question-generator.ts',
    method: 'generateTransformationQuestions',
    category: 'question_generation',
    key: 'transformation_questions',
    name: 'Transformation Task Questions',
    description: 'Questions for data/content transformation tasks',
    content: `Generate questions for transformation tasks:

Return as JSON array:
{
  "questions": [
    {
      "variable_key": "source_format",
      "text": "What is the current format of the content?",
      "type": "string",
      "required": true,
      "help_text": "The format of the input content (e.g., JSON, CSV, plain text)"
    },
    {
      "variable_key": "target_format",
      "text": "What format should the content be transformed to?",
      "type": "string",
      "required": true,
      "help_text": "The desired output format"
    }
  ]
}`,
    variables: []
  },
  {
    source: 'src/services/intelligent-question-generator.ts',
    method: 'generateClassificationQuestions',
    category: 'question_generation',
    key: 'classification_questions',
    name: 'Classification Task Questions',
    description: 'Questions for classification tasks',
    content: `Generate questions for classification tasks:

Return as JSON array:
{
  "questions": [
    {
      "variable_key": "classification_categories",
      "text": "What categories should be used for classification?",
      "type": "string",
      "required": true,
      "help_text": "List the categories or labels to classify content into"
    }
  ]
}`,
    variables: []
  },
  {
    source: 'src/services/intelligent-question-generator.ts',
    method: 'generateCodeQuestions',
    category: 'question_generation',
    key: 'code_questions',
    name: 'Code Task Questions',
    description: 'Questions for coding tasks',
    content: `Generate contextual questions for coding tasks:

Task Goal: {{goal}}
Audience: {{audience}}
Steps: {{steps}}

Generate questions that help clarify:
1. Programming language (if not specified)
2. Specific requirements (if goal is vague)

Return as JSON array:
{
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
    variables: ['goal', 'audience', 'steps']
  },

  // Mock LLM Service Response Templates
  {
    source: 'src/services/mock-llm-service.ts',
    method: 'generateDefaultEnhancementResponse',
    category: 'mock_responses',
    key: 'enhancement_response',
    name: 'Default Enhancement Response',
    description: 'Mock response for enhancement requests',
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
    variables: ['task_description', 'audience', 'output_format']
  },
  {
    source: 'src/services/mock-llm-service.ts',
    method: 'generateBlogPostResponse',
    category: 'mock_responses',
    key: 'blog_post_response',
    name: 'Blog Post Response',
    description: 'Mock response for blog post creation requests',
    content: `{
  "structured": {
    "schema_version": 1,
    "system": [
      "You are a professional content writer specializing in creating engaging blog posts.",
      "Your writing should be informative, well-structured, and tailored to the target audience."
    ],
    "capabilities": [
      "Content creation and writing",
      "SEO optimization",
      "Audience engagement",
      "Research and fact-checking"
    ],
    "user_template": "Write a blog post about {{topic}} for {{target_audience}}. The post should be {{word_count}} words long, written in a {{tone}} tone, and include {{key_points}}. Format the output as {{output_format}}.",
    "rules": [
      {
        "name": "Engagement",
        "description": "Use compelling headlines and engaging introductions"
      },
      {
        "name": "Structure",
        "description": "Organize content with clear headings and logical flow"
      },
      {
        "name": "Accuracy",
        "description": "Ensure all information is accurate and well-researched"
      }
    ],
    "variables": ["topic", "target_audience", "word_count", "tone", "key_points", "output_format"]
  },
  "changes_made": [
    "Structured the blog writing task with clear parameters",
    "Added professional content writer persona",
    "Defined specific writing capabilities",
    "Created reusable template with key variables"
  ],
  "warnings": []
}`,
    variables: ['topic', 'target_audience', 'word_count', 'tone', 'key_points', 'output_format']
  },
  {
    source: 'src/services/mock-llm-service.ts',
    method: 'generateDataAnalysisResponse',
    category: 'mock_responses',
    key: 'data_analysis_response',
    name: 'Data Analysis Response',
    description: 'Mock response for data analysis requests',
    content: `{
  "structured": {
    "schema_version": 1,
    "system": [
      "You are a data analyst expert capable of interpreting complex datasets and providing actionable insights.",
      "Your analysis should be thorough, objective, and supported by evidence from the data."
    ],
    "capabilities": [
      "Statistical analysis",
      "Data visualization interpretation",
      "Trend identification",
      "Insight generation",
      "Report writing"
    ],
    "user_template": "Analyze the {{data_type}} data provided and focus on {{analysis_focus}}. The analysis should be suitable for {{stakeholder_level}} and delivered in {{report_format}} format. Key metrics to examine: {{key_metrics}}.",
    "rules": [
      {
        "name": "Objectivity",
        "description": "Present findings without bias and support conclusions with data"
      },
      {
        "name": "Clarity",
        "description": "Explain complex concepts in terms appropriate for the audience"
      },
      {
        "name": "Actionability",
        "description": "Provide specific, actionable recommendations based on findings"
      }
    ],
    "variables": ["data_type", "analysis_focus", "stakeholder_level", "report_format", "key_metrics"]
  },
  "changes_made": [
    "Transformed general analysis request into structured data analysis framework",
    "Added data analyst expertise and methodology",
    "Defined analytical capabilities and approach",
    "Created flexible template for various data analysis scenarios"
  ],
  "warnings": []
}`,
    variables: ['data_type', 'analysis_focus', 'stakeholder_level', 'report_format', 'key_metrics']
  },
  {
    source: 'src/services/mock-llm-service.ts',
    method: 'generateSummaryResponse',
    category: 'mock_responses',
    key: 'summary_response',
    name: 'Summary Response',
    description: 'Mock response for summarization requests',
    content: `{
  "structured": {
    "schema_version": 1,
    "system": [
      "You are an expert at creating concise, accurate summaries that capture the essential information.",
      "Your summaries should be well-organized and highlight the most important points."
    ],
    "capabilities": [
      "Information extraction",
      "Content synthesis",
      "Key point identification",
      "Concise writing"
    ],
    "user_template": "Create a {{summary_type}} summary of the following {{content_type}}: {{content}}. The summary should be {{length}} and focus on {{focus_areas}}. Target audience: {{audience}}.",
    "rules": [
      {
        "name": "Accuracy",
        "description": "Ensure all summarized information is accurate and faithful to the source"
      },
      {
        "name": "Conciseness",
        "description": "Include only the most essential information"
      },
      {
        "name": "Completeness",
        "description": "Cover all major points while maintaining brevity"
      }
    ],
    "variables": ["summary_type", "content_type", "content", "length", "focus_areas", "audience"]
  },
  "changes_made": [
    "Structured the summarization task with clear parameters",
    "Added summarization expertise and best practices",
    "Defined content processing capabilities",
    "Created flexible template for different summary types"
  ],
  "warnings": []
}`,
    variables: ['summary_type', 'content_type', 'content', 'length', 'focus_areas', 'audience']
  }
];

/**
 * Summary of extracted prompts by category
 */
export const EXTRACTION_SUMMARY = {
  enhancement: 2,
  question_generation: 5,
  mock_responses: 4,
  system_prompts: 0,
  total: 11
};

/**
 * All unique variables found across all templates
 */
export const ALL_VARIABLES = [
  // Enhancement variables
  'goal', 'audience', 'steps', 'output_format', 'expected_fields', 'target_provider', 'domain_knowledge',
  
  // Question generation variables
  'analysis_data', 'analysis_focus', 'generation_topic', 'content_style', 'source_format', 'target_format',
  'classification_categories', 'programming_language', 'code_requirements',
  
  // Mock response variables
  'task_description', 'topic', 'target_audience', 'word_count', 'tone', 'key_points',
  'data_type', 'stakeholder_level', 'report_format', 'key_metrics',
  'summary_type', 'content_type', 'content', 'length', 'focus_areas'
];

/**
 * Variable patterns and their inferred types
 */
export const VARIABLE_PATTERNS = {
  // String variables (default)
  string: ['goal', 'audience', 'output_format', 'expected_fields', 'domain_knowledge', 'analysis_data', 'analysis_focus', 'generation_topic', 'source_format', 'target_format', 'classification_categories', 'code_requirements', 'task_description', 'topic', 'target_audience', 'tone', 'key_points', 'data_type', 'stakeholder_level', 'report_format', 'key_metrics', 'summary_type', 'content_type', 'content', 'length', 'focus_areas'],
  
  // Array variables
  array: ['steps'],
  
  // Number variables
  number: ['word_count'],
  
  // Select variables (with predefined options)
  select: ['content_style', 'programming_language'],
  
  // Provider-specific variables
  provider: ['target_provider']
};