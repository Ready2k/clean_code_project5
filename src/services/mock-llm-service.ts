// Mock LLM Service for testing and development

import { LLMService } from './enhancement-agent';

// Import System Prompt Manager types
import { TemplateCategory, TemplateContext } from '../types/prompt-templates';

// Interface for System Prompt Manager (to avoid circular dependency)
interface ISystemPromptManager {
  getTemplate(category: TemplateCategory, key: string, context?: TemplateContext): Promise<string>;
}

export class MockLLMService implements LLMService {
  private responses: Map<string, string> = new Map();
  private defaultResponse: string;
  private systemPromptManager?: ISystemPromptManager;
  private isProductionEnvironment: boolean;

  constructor(systemPromptManager?: ISystemPromptManager) {
    this.systemPromptManager = systemPromptManager;
    this.isProductionEnvironment = process.env.NODE_ENV === 'production';
    
    // Only initialize mock responses in non-production environments
    if (!this.isProductionEnvironment) {
      this.defaultResponse = this.generateDefaultEnhancementResponse();
      this.setupDefaultResponses();
    } else {
      // In production, throw error if mock service is used
      throw new Error('MockLLMService should not be used in production environment');
    }
  }

  async complete(prompt: string): Promise<string> {
    // Ensure we're not in production
    if (this.isProductionEnvironment) {
      throw new Error('MockLLMService cannot be used in production environment');
    }

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Try to get response from template system first
    if (this.systemPromptManager) {
      try {
        const templateResponse = await this.getResponseFromTemplate(prompt);
        if (templateResponse) {
          return templateResponse;
        }
      } catch (error) {
        console.warn('Failed to get mock response from template, using fallback:', error);
      }
    }

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
    // Only available in non-production environments
    return !this.isProductionEnvironment;
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
    // Only setup in non-production environments
    if (this.isProductionEnvironment) {
      return;
    }

    // Add some common test responses
    this.responses.set('write a blog post', this.generateBlogPostResponse());
    this.responses.set('analyze data', this.generateDataAnalysisResponse());
    this.responses.set('create a summary', this.generateSummaryResponse());
  }

  /**
   * Get mock response from template system
   */
  private async getResponseFromTemplate(prompt: string): Promise<string | null> {
    if (!this.systemPromptManager) {
      return null;
    }

    try {
      // Determine response type based on prompt content
      const responseType = this.detectResponseType(prompt);
      
      const templateContext: TemplateContext = {
        userContext: {
          prompt_content: prompt,
          response_type: responseType
        }
      };

      // Try to get template for this response type
      return await this.systemPromptManager.getTemplate(
        TemplateCategory.MOCK_RESPONSES,
        responseType,
        templateContext
      );

    } catch (error) {
      // Template not found, return null to fall back to hardcoded responses
      return null;
    }
  }

  /**
   * Detect the type of response needed based on prompt content
   */
  private detectResponseType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('blog post') || lowerPrompt.includes('article')) {
      return 'blog_post_response';
    }
    if (lowerPrompt.includes('analyze') || lowerPrompt.includes('analysis')) {
      return 'data_analysis_response';
    }
    if (lowerPrompt.includes('summary') || lowerPrompt.includes('summarize')) {
      return 'summary_response';
    }
    if (lowerPrompt.includes('code') || lowerPrompt.includes('function') || lowerPrompt.includes('program')) {
      return 'code_response';
    }
    if (lowerPrompt.includes('enhance') || lowerPrompt.includes('structured format')) {
      return 'enhancement_response';
    }

    return 'default_response';
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