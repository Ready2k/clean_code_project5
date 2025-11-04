

export interface AdaptationRequest {
  promptId: string;
  sourceProvider: string;
  sourceModel: string;
  targetProvider: string;
  targetModel: string;
  adaptationConnectionId: string; // Which LLM connection to use for adaptation
}

export interface AdaptationResult {
  adaptedPrompt: {
    humanPrompt: any;
    structuredPrompt?: any;
    variables?: any[];
  };
  adaptationNotes: string[];
  confidence: number;
}

export class PromptAdaptationService {
  /**
   * Adapt a prompt from one provider/model to another
   */
  static async adaptPrompt(request: AdaptationRequest): Promise<AdaptationResult> {
    // This would call a backend endpoint that uses the selected LLM to adapt the prompt
    // For now, return a mock result - this would be replaced with actual API call
    return {
      adaptedPrompt: {
        humanPrompt: {
          goal: "Adapted goal for " + request.targetModel,
          audience: "General",
          steps: ["Adapted step 1", "Adapted step 2"],
          output_expectations: {
            format: "Optimized for " + request.targetProvider,
            fields: []
          }
        }
      },
      adaptationNotes: [
        `Converted from ${request.sourceProvider} ${request.sourceModel} format`,
        `Optimized instruction structure for ${request.targetProvider}`,
        `Adjusted prompt patterns for ${request.targetModel} preferences`
      ],
      confidence: 0.85
    };
  }

  /**
   * Build the adaptation prompt to send to the LLM
   */
  private static buildAdaptationPrompt(request: AdaptationRequest): string {
    return `You are an expert prompt engineer specializing in cross-provider prompt adaptation.

TASK: Convert the attached prompt from ${request.sourceProvider} ${request.sourceModel} format to work optimally with ${request.targetProvider} ${request.targetModel}.

SOURCE FORMAT: ${request.sourceProvider} ${request.sourceModel}
TARGET FORMAT: ${request.targetProvider} ${request.targetModel}

ADAPTATION REQUIREMENTS:
1. Preserve the core functionality and intent of the original prompt
2. Adjust instruction structure and patterns for ${request.targetModel} preferences
3. Optimize system messages, user templates, and formatting for ${request.targetProvider}
4. Maintain all variables and their purposes
5. Adapt any provider-specific features or limitations

SPECIFIC ADAPTATIONS FOR ${request.targetProvider.toUpperCase()}:
${this.getProviderSpecificGuidance(request.targetProvider)}

Please provide:
1. The adapted prompt in the optimal format for ${request.targetProvider} ${request.targetModel}
2. A list of key changes made during adaptation
3. Your confidence level (0-1) in the adaptation quality

Format your response as JSON with the structure:
{
  "adaptedPrompt": { ... },
  "adaptationNotes": ["change 1", "change 2", ...],
  "confidence": 0.85
}`;
  }

  /**
   * Get provider-specific adaptation guidance
   */
  private static getProviderSpecificGuidance(targetProvider: string): string {
    switch (targetProvider) {
      case 'anthropic':
        return `- Use clear, structured system messages
- Prefer explicit instructions over implicit ones
- Utilize Claude's strong reasoning capabilities
- Format for Constitutional AI principles`;
        
      case 'openai':
        return `- Optimize for GPT's conversational style
- Use clear role definitions (system/user/assistant)
- Leverage GPT's broad knowledge base
- Structure for function calling if applicable`;
        
      case 'meta':
        return `- Adapt for Llama's instruction-following format
- Use clear, direct language
- Optimize for open-source model capabilities
- Consider context length limitations`;
        
      default:
        return `- Follow general best practices for the target provider
- Maintain clear instruction structure
- Optimize for the specific model's capabilities`;
    }
  }

  /**
   * Check if a variant already exists for the target provider/model
   */
  static hasVariant(prompt: any, targetProvider: string, targetModel: string): boolean {
    const variantTag = `${targetProvider}-${targetModel}`;
    return prompt.metadata?.tags?.includes(variantTag) || false;
  }

  /**
   * Get existing variant if it exists
   */
  static getVariant(_prompt: any, _targetProvider: string, _targetModel: string): any | null {
    // This would look for stored variants in the prompt record
    // For now, return null - would be implemented with actual storage
    return null;
  }

  /**
   * Generate variant tag for storage
   */
  static generateVariantTag(provider: string, model: string): string {
    return `${provider}-${model}`;
  }
}