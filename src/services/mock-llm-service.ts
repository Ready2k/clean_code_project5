// Mock LLM Service for testing and development

import { LLMService } from './enhancement-agent';

export class MockLLMService implements LLMService {
  private responses: Map<string, string> = new Map();
  private defaultResponse: string;

  constructor() {
    this.defaultResponse = this.generateDefaultEnhancementResponse();
    this.setupDefaultResponses();
  }

  async complete(prompt: string, _options?: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }): Promise<string> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check for specific prompt patterns
    for (const [pattern, response] of this.responses) {
      if (prompt.includes(pattern)) {
        return response;
      }
    }

    // Return default enhancement response
    return this.defaultResponse;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Add a custom response for testing
   */
  addResponse(promptPattern: string, response: string): void {
    this.responses.set(promptPattern, response);
  }

  /**
   * Clear all custom responses
   */
  clearResponses(): void {
    this.responses.clear();
  }

  private setupDefaultResponses(): void {
    // Add some common test responses
    this.responses.set('write a blog post', this.generateBlogPostResponse());
    this.responses.set('analyze data', this.generateDataAnalysisResponse());
    this.responses.set('create a summary', this.generateSummaryResponse());
  }

  private generateDefaultEnhancementResponse(): string {
    return JSON.stringify({
      structured: {
        schema_version: 1,
        system: [
          "You are a helpful AI assistant designed to complete tasks efficiently and accurately.",
          "Always provide clear, well-structured responses that directly address the user's needs."
        ],
        capabilities: [
          "Text analysis and processing",
          "Information synthesis",
          "Clear communication"
        ],
        user_template: "Please help me with the following task: {{task_description}}. The target audience is {{audience}} and I need the output in {{output_format}} format.",
        rules: [
          {
            name: "Clarity",
            description: "Always provide clear and unambiguous responses"
          },
          {
            name: "Relevance",
            description: "Stay focused on the specific task at hand"
          }
        ],
        variables: ["task_description", "audience", "output_format"]
      },
      changes_made: [
        "Converted free-form instructions into structured template format",
        "Added system context for role definition",
        "Extracted variables for reusability",
        "Defined specific rules for consistent behavior"
      ],
      warnings: []
    }, null, 2);
  }

  private generateBlogPostResponse(): string {
    return JSON.stringify({
      structured: {
        schema_version: 1,
        system: [
          "You are a professional content writer specializing in creating engaging blog posts.",
          "Your writing should be informative, well-structured, and tailored to the target audience."
        ],
        capabilities: [
          "Content creation and writing",
          "SEO optimization",
          "Audience engagement",
          "Research and fact-checking"
        ],
        user_template: "Write a blog post about {{topic}} for {{target_audience}}. The post should be {{word_count}} words long, written in a {{tone}} tone, and include {{key_points}}. Format the output as {{output_format}}.",
        rules: [
          {
            name: "Engagement",
            description: "Use compelling headlines and engaging introductions"
          },
          {
            name: "Structure",
            description: "Organize content with clear headings and logical flow"
          },
          {
            name: "Accuracy",
            description: "Ensure all information is accurate and well-researched"
          }
        ],
        variables: ["topic", "target_audience", "word_count", "tone", "key_points", "output_format"]
      },
      changes_made: [
        "Structured the blog writing task with clear parameters",
        "Added professional content writer persona",
        "Defined specific writing capabilities",
        "Created reusable template with key variables"
      ],
      warnings: []
    }, null, 2);
  }

  private generateDataAnalysisResponse(): string {
    return JSON.stringify({
      structured: {
        schema_version: 1,
        system: [
          "You are a data analyst expert capable of interpreting complex datasets and providing actionable insights.",
          "Your analysis should be thorough, objective, and supported by evidence from the data."
        ],
        capabilities: [
          "Statistical analysis",
          "Data visualization interpretation",
          "Trend identification",
          "Insight generation",
          "Report writing"
        ],
        user_template: "Analyze the {{data_type}} data provided and focus on {{analysis_focus}}. The analysis should be suitable for {{stakeholder_level}} and delivered in {{report_format}} format. Key metrics to examine: {{key_metrics}}.",
        rules: [
          {
            name: "Objectivity",
            description: "Present findings without bias and support conclusions with data"
          },
          {
            name: "Clarity",
            description: "Explain complex concepts in terms appropriate for the audience"
          },
          {
            name: "Actionability",
            description: "Provide specific, actionable recommendations based on findings"
          }
        ],
        variables: ["data_type", "analysis_focus", "stakeholder_level", "report_format", "key_metrics"]
      },
      changes_made: [
        "Transformed general analysis request into structured data analysis framework",
        "Added data analyst expertise and methodology",
        "Defined analytical capabilities and approach",
        "Created flexible template for various data analysis scenarios"
      ],
      warnings: []
    }, null, 2);
  }

  private generateSummaryResponse(): string {
    return JSON.stringify({
      structured: {
        schema_version: 1,
        system: [
          "You are an expert at creating concise, accurate summaries that capture the essential information.",
          "Your summaries should be well-organized and highlight the most important points."
        ],
        capabilities: [
          "Information extraction",
          "Content synthesis",
          "Key point identification",
          "Concise writing"
        ],
        user_template: "Create a {{summary_type}} summary of the following {{content_type}}: {{content}}. The summary should be {{length}} and focus on {{focus_areas}}. Target audience: {{audience}}.",
        rules: [
          {
            name: "Accuracy",
            description: "Ensure all summarized information is accurate and faithful to the source"
          },
          {
            name: "Conciseness",
            description: "Include only the most essential information"
          },
          {
            name: "Completeness",
            description: "Cover all major points while maintaining brevity"
          }
        ],
        variables: ["summary_type", "content_type", "content", "length", "focus_areas", "audience"]
      },
      changes_made: [
        "Structured the summarization task with clear parameters",
        "Added summarization expertise and best practices",
        "Defined content processing capabilities",
        "Created flexible template for different summary types"
      ],
      warnings: []
    }, null, 2);
  }
}