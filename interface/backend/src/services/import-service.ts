import { CreatePromptRequest } from './prompt-library-service.js';

export interface ImportOptions {
  sourceProvider?: string;
  conflictResolution: 'skip' | 'overwrite' | 'create_new' | 'prompt';
  defaultOwner?: string;
  defaultTags?: string[];
  autoEnhance?: boolean;
  slugPrefix?: string;
  validateBeforeImport?: boolean;
  sourceUrl?: string;
}

export interface ImportValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
  detectedProvider: string | undefined;
  confidence: number;
}

export class ImportService {
  constructor(private promptLibraryService?: any) {}

  /**
   * Import prompt from content string
   */
  async importFromContent(
    content: string,
    options: ImportOptions & { filename?: string }
  ): Promise<any | null> {
    // Parse content - try JSON first, then treat as string (markdown/text)
    let parsedContent: any;
    try {
      parsedContent = JSON.parse(content);
    } catch (error) {
      // If JSON parsing fails, treat as string content (markdown/text)
      parsedContent = content;
    }

    // Validate content
    const validation = this.validateImportContent(parsedContent, options);
    if (!validation.isValid && options.validateBeforeImport !== false) {
      throw new Error(`Import validation failed: ${validation.errors.join(', ')}`);
    }

    // Detect provider format if not specified
    const sourceProvider = options.sourceProvider || validation.detectedProvider;
    if (!sourceProvider) {
      throw new Error('Could not detect provider format. Please specify sourceProvider in options.');
    }

    // Convert to internal format
    const promptData = this.convertToInternalFormat(parsedContent, sourceProvider, options);

    // Handle conflicts
    if (this.promptLibraryService) {
      const existingPrompt = await this.findExistingPrompt(promptData);
      if (existingPrompt) {
        return this.handleConflict(promptData, existingPrompt, options);
      }

      // Save the imported prompt
      return await this.promptLibraryService.createPrompt(promptData);
    }

    return promptData;
  }

  /**
   * Validate import content
   */
  validateImportContent(
    content: any,
    options: ImportOptions
  ): ImportValidationResult {
    const errors: string[] = [];
    const suggestions: string[] = [];

    if (!content) {
      return {
        isValid: false,
        errors: ['Content cannot be empty'],
        suggestions: ['Provide valid JSON or markdown content'],
        detectedProvider: undefined,
        confidence: 0
      };
    }

    // Allow both objects (JSON) and strings (markdown/text)
    if (typeof content !== 'object' && typeof content !== 'string') {
      return {
        isValid: false,
        errors: ['Content must be a valid object or string'],
        suggestions: ['Ensure the file contains valid JSON or markdown'],
        detectedProvider: undefined,
        confidence: 0
      };
    }

    // Detect provider format
    const detection = this.detectProviderFormat(content);
    
    if (!detection.provider && !options.sourceProvider) {
      errors.push('Could not detect provider format');
      suggestions.push('Specify sourceProvider in import options');
    }

    // Validate based on detected/specified provider
    const provider = options.sourceProvider || detection.provider;
    if (provider) {
      const providerValidation = this.validateProviderFormat(content, provider);
      errors.push(...providerValidation.errors);
      suggestions.push(...providerValidation.suggestions);
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions,
      detectedProvider: detection.provider,
      confidence: detection.confidence
    };
  }

  /**
   * Detect provider format from content
   */
  private detectProviderFormat(content: any): { provider?: string; confidence: number } {
    // If content is a string, it's likely markdown
    if (typeof content === 'string') {
      return { provider: 'markdown', confidence: 0.8 };
    }

    // Internal format detection (check first as it's most specific)
    if (content.prompt_human || content.prompt_structured) {
      return { provider: 'internal', confidence: 1.0 };
    }

    // Anthropic format detection (check before OpenAI since it's more specific)
    if (content.system && typeof content.system === 'string' && content.messages && Array.isArray(content.messages)) {
      return { provider: 'anthropic', confidence: 0.9 };
    }

    // OpenAI format detection
    if (content.messages && Array.isArray(content.messages)) {
      const hasValidMessages = content.messages.every((msg: any) => 
        msg.role && ['system', 'user', 'assistant'].includes(msg.role) && msg.content
      );
      if (hasValidMessages) {
        return { provider: 'openai', confidence: 0.9 };
      }
    }

    // Meta/Llama format detection
    if (content.messages && Array.isArray(content.messages)) {
      const hasLlamaStructure = content.messages.some((msg: any) => 
        msg.role === 'system' || (msg.role === 'user' && typeof msg.content === 'string')
      );
      if (hasLlamaStructure) {
        return { provider: 'meta', confidence: 0.7 };
      }
    }

    return { confidence: 0 };
  }

  /**
   * Validate provider-specific format
   */
  private validateProviderFormat(content: any, provider: string): { errors: string[]; suggestions: string[] } {
    const errors: string[] = [];
    const suggestions: string[] = [];

    switch (provider) {
      case 'openai':
        if (!content.messages || !Array.isArray(content.messages)) {
          errors.push('OpenAI format requires messages array');
        } else if (content.messages.length === 0) {
          errors.push('Messages array cannot be empty');
        }
        break;

      case 'anthropic':
        if (!content.messages || !Array.isArray(content.messages)) {
          errors.push('Anthropic format requires messages array');
        }
        if (typeof content.system !== 'string') {
          suggestions.push('Anthropic format typically includes system field');
        }
        break;

      case 'meta':
        if (!content.messages || !Array.isArray(content.messages)) {
          errors.push('Meta format requires messages array');
        }
        break;

      case 'internal':
        if (!content.prompt_human && !content.prompt_structured) {
          errors.push('Internal format requires prompt_human or prompt_structured');
        }
        break;

      case 'markdown':
        if (typeof content !== 'string') {
          errors.push('Markdown format requires string content');
        } else if (content.trim().length === 0) {
          errors.push('Markdown content cannot be empty');
        }
        break;

      default:
        errors.push(`Unknown provider format: ${provider}`);
    }

    return { errors, suggestions };
  }

  /**
   * Convert provider format to internal format
   */
  private convertToInternalFormat(
    content: any,
    sourceProvider: string,
    options: ImportOptions
  ): CreatePromptRequest {
    switch (sourceProvider) {
      case 'openai':
        return this.convertFromOpenAI(content, options);
      case 'anthropic':
        return this.convertFromAnthropic(content, options);
      case 'meta':
        return this.convertFromMeta(content, options);
      case 'internal':
        return this.convertFromInternal(content, options);
      case 'markdown':
        return this.convertFromMarkdown(content, options);
      default:
        throw new Error(`Unsupported provider format: ${sourceProvider}`);
    }
  }

  /**
   * Convert from OpenAI format
   */
  private convertFromOpenAI(content: any, options: ImportOptions): CreatePromptRequest {
    const messages = content.messages || [];
    const userMessages = messages.filter((m: any) => m.role === 'user');

    // Extract title from metadata if available, otherwise from content
    let title = 'Imported OpenAI Prompt';
    if (content._metadata?.promptTitle) {
      title = content._metadata.promptTitle;
    } else if (userMessages[0]?.content) {
      title = this.extractTitleFromContent(userMessages[0].content) || title;
    }
    
    // Create human prompt from metadata if available
    const humanPrompt = {
      goal: content._metadata?.originalPrompt?.goal || this.extractGoalFromMessages(messages),
      audience: content._metadata?.originalPrompt?.audience || 'General',
      steps: this.extractStepsFromMessages(messages),
      output_expectations: {
        format: 'Text',
        fields: []
      }
    };

    return {
      humanPrompt: humanPrompt,
      metadata: {
        title,
        summary: `Imported prompt: ${title}`,
        tags: options.defaultTags || ['imported']
      },
      owner: options.defaultOwner || 'unknown'
    };
  }

  /**
   * Convert from Anthropic format
   */
  private convertFromAnthropic(content: any, options: ImportOptions): CreatePromptRequest {
    const messages = content.messages || [];
    const systemContent = content.system || '';
    const userMessages = messages.filter((m: any) => m.role === 'user');

    // Extract title from metadata if available, otherwise from content
    let title = 'Imported Anthropic Prompt';
    if (content._metadata?.promptTitle) {
      title = content._metadata.promptTitle;
    } else if (userMessages[0]?.content) {
      title = this.extractTitleFromContent(userMessages[0].content) || title;
    }

    const humanPrompt = {
      goal: content._metadata?.originalPrompt?.goal || this.extractGoalFromContent(systemContent) || 'Imported goal',
      audience: content._metadata?.originalPrompt?.audience || 'General',
      steps: this.extractStepsFromMessages(messages),
      output_expectations: {
        format: 'Text',
        fields: []
      }
    };

    return {
      humanPrompt: humanPrompt,
      metadata: {
        title,
        summary: `Imported prompt: ${title}`,
        tags: options.defaultTags || ['imported']
      },
      owner: options.defaultOwner || 'unknown'
    };
  }

  /**
   * Convert from Meta format
   */
  private convertFromMeta(content: any, options: ImportOptions): CreatePromptRequest {
    // Meta format is similar to OpenAI, so reuse that logic
    return this.convertFromOpenAI(content, options);
  }

  /**
   * Convert from internal format
   */
  private convertFromInternal(content: any, options: ImportOptions): CreatePromptRequest {
    // If it's already in internal format, extract the needed parts
    const title = content.metadata?.title || 'Imported Prompt';
    
    return {
      humanPrompt: content.humanPrompt || content.prompt_human || {
        goal: 'Imported goal',
        audience: 'General',
        steps: ['Process the request'],
        output_expectations: { format: 'Text', fields: [] }
      },
      metadata: {
        title,
        summary: content.metadata?.summary || `Imported prompt: ${title}`,
        tags: [...(content.metadata?.tags || []), ...(options.defaultTags || [])]
      },
      owner: options.defaultOwner || content.metadata?.owner || 'unknown'
    };
  }

  /**
   * Convert from Markdown format
   */
  private convertFromMarkdown(content: string, options: ImportOptions): CreatePromptRequest {
    let title = 'Imported Markdown Prompt';
    let description = '';
    let goal = '';
    let audience = 'General';
    const steps: string[] = [];
    let currentSection = '';
    let format = 'Text';
    let mainContent = content;
    let modelInfo = '';
    
    // Parse YAML frontmatter if present
    if (content.startsWith('---')) {
      const frontmatterEnd = content.indexOf('---', 3);
      if (frontmatterEnd !== -1) {
        const frontmatter = content.substring(3, frontmatterEnd).trim();
        mainContent = content.substring(frontmatterEnd + 3).trim();
        
        // Parse YAML frontmatter
        const yamlLines = frontmatter.split('\n');
        for (const line of yamlLines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('name:')) {
            title = trimmedLine.substring(5).trim();
          } else if (trimmedLine.startsWith('description:')) {
            description = trimmedLine.substring(12).trim();
          } else if (trimmedLine.startsWith('model:')) {
            modelInfo = trimmedLine.substring(6).trim();
          }
        }
      }
    }
    
    const lines = mainContent.split('\n');
    
    // Parse markdown content
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() || '';
      
      // Extract title from first H1 header if not found in frontmatter
      if (line.startsWith('# ') && title.includes('Imported')) {
        title = line.substring(2).trim();
        continue;
      }
      
      // Look for common sections
      if (line.startsWith('## ') || line.startsWith('### ')) {
        currentSection = line.substring(line.indexOf(' ') + 1).toLowerCase();
        continue;
      }
      
      // Extract content based on section
      if (line && !line.startsWith('#')) {
        switch (currentSection) {
          case 'goal':
          case 'objective':
          case 'purpose':
          case 'focus areas':
          case 'focus':
            if (!goal) {
              goal = line;
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
              // Add bullet points to goal
              goal += ' ' + line.substring(2);
            }
            break;
          case 'audience':
          case 'target':
          case 'user':
            if (audience === 'General') audience = line;
            break;
          case 'steps':
          case 'instructions':
          case 'process':
          case 'approach':
            if (line.match(/^\d+\./)) {
              steps.push(line.replace(/^\d+\.\s*/, ''));
            } else if (line.startsWith('- ') || line.startsWith('* ')) {
              steps.push(line.substring(2));
            } else if (line && steps.length === 0) {
              steps.push(line);
            }
            break;
          case 'format':
          case 'output':
          case 'response':
            if (!format.includes('Text')) format = line;
            break;
        }
      }
    }
    
    // If no goal found in sections, use description or first paragraph
    if (!goal) {
      if (description) {
        goal = description;
      } else {
        // Extract first paragraph as goal
        const paragraphs = mainContent.split('\n\n').filter(p => p.trim());
        if (paragraphs.length > 0 && paragraphs[0]) {
          goal = paragraphs[0].replace(/^#+\s*/, '').trim();
        }
      }
    }
    
    // If no steps found, extract from remaining content
    if (steps.length === 0) {
      const paragraphs = mainContent.split('\n\n').filter(p => p.trim());
      if (paragraphs.length > 1) {
        steps.push(...paragraphs.slice(1).map(p => p.trim()));
      } else {
        steps.push('Follow the instructions in the content');
      }
    }
    
    // Fallback values
    if (!goal) goal = 'Process the markdown content';
    
    // Use description as summary if available, otherwise generate one
    const summary = description || `Imported from markdown: ${title}`;
    
    // Determine provider from model info
    let tunedForProvider = '';
    let preferredModel = modelInfo;
    
    if (modelInfo) {
      const lowerModel = modelInfo.toLowerCase();
      if (lowerModel.includes('sonnet') || lowerModel.includes('claude') || lowerModel.includes('anthropic')) {
        tunedForProvider = 'anthropic';
      } else if (lowerModel.includes('gpt') || lowerModel.includes('openai')) {
        tunedForProvider = 'openai';
      } else if (lowerModel.includes('llama') || lowerModel.includes('meta')) {
        tunedForProvider = 'meta';
      }
    }
    
    // Build tags including provider-model tag
    const baseTags = options.defaultTags || ['imported', 'markdown'];
    const providerModelTag = tunedForProvider && preferredModel 
      ? `${tunedForProvider}-${preferredModel}` 
      : null;
    
    // Auto-detect prompt type and add tag
    const promptType = ImportService.detectPromptType({ goal, audience, steps, output_expectations: { format, fields: [] } });
    const promptTypeTag = `prompt-type:${promptType}`;
    
    let allTags = [...baseTags, promptTypeTag];
    if (providerModelTag) {
      allTags.push(providerModelTag);
    }
    
    return {
      humanPrompt: {
        goal,
        audience,
        steps,
        output_expectations: {
          format,
          fields: []
        }
      },
      metadata: {
        title,
        summary,
        tags: allTags,
        ...(preferredModel && { preferred_model: preferredModel }),
        ...(tunedForProvider && { tuned_for_provider: tunedForProvider }),
        ...(options.sourceUrl && { source_url: options.sourceUrl })
      },
      owner: options.defaultOwner || 'unknown'
    };
  }

  /**
   * Detect prompt type based on content
   */
  private static detectPromptType(humanPrompt: any): 'task' | 'agent' {
    const goalLower = humanPrompt.goal.toLowerCase();
    const stepsText = humanPrompt.steps.join(' ').toLowerCase();
    
    // Agent-defining keywords (identity/capability focused)
    const agentKeywords = [
      'expert', 'specialist', 'engineer', 'architect', 'masters', 'specializing',
      'capabilities', 'behavioral traits', 'knowledge base', 'response approach',
      'example interactions', 'purpose', '## capabilities', '## behavioral',
      'you are', 'i am', 'my expertise', 'my specialization'
    ];
    
    // Task-defining keywords (action/deliverable focused) - for future use
    // const taskKeywords = ['create', 'build', 'generate', 'analyze', 'write', 'develop', 'design'];
    
    const hasAgentKeywords = agentKeywords.some(keyword => 
      goalLower.includes(keyword) || stepsText.includes(keyword)
    );
    
    // If agent keywords present, it's an agent
    // Otherwise, it's a task
    return hasAgentKeywords ? 'agent' : 'task';
  }

  /**
   * Extract title from content
   */
  private extractTitleFromContent(content: string): string | null {
    if (!content) return null;
    
    // Look for title-like patterns
    const titlePatterns = [
      /^#\s+(.+)$/m,  // Markdown header
      /^Title:\s*(.+)$/mi,  // Title: prefix
    ];

    for (const pattern of titlePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback to first meaningful words (up to 50 chars)
    const firstLine = content.split('\n')[0];
    if (firstLine && firstLine.length > 0) {
      return firstLine.substring(0, 50).trim();
    }

    return null;
  }

  /**
   * Extract goal from messages or content
   */
  private extractGoalFromMessages(messages: any[]): string {
    const systemMessages = messages.filter(m => m.role === 'system');
    if (systemMessages.length > 0) {
      return systemMessages[0].content.substring(0, 200) + '...';
    }

    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length > 0) {
      return `Help with: ${userMessages[0].content.substring(0, 100)}...`;
    }

    return 'Imported prompt goal';
  }

  /**
   * Extract goal from content string
   */
  private extractGoalFromContent(content: string): string | null {
    if (!content) return null;
    return content.substring(0, 200) + (content.length > 200 ? '...' : '');
  }

  /**
   * Extract steps from messages
   */
  private extractStepsFromMessages(messages: any[]): string[] {
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return ['Process the request'];

    // Try to extract numbered steps
    const content = userMessages.map(m => m.content).join('\n');
    const stepMatches = content.match(/^\d+\.\s+(.+)$/gm);
    
    if (stepMatches && stepMatches.length > 1) {
      return stepMatches.map(step => step.replace(/^\d+\.\s+/, ''));
    }

    // Fallback to generic steps
    return [
      'Analyze the user request',
      'Process the information',
      'Provide appropriate response'
    ];
  }



  /**
   * Find existing prompt by title (simplified)
   */
  private async findExistingPrompt(promptData: CreatePromptRequest): Promise<any | null> {
    if (!this.promptLibraryService) return null;

    try {
      // Try to find by title (simplified approach)
      const allPrompts = await this.promptLibraryService.getPrompts({});
      const existingByTitle = allPrompts.prompts.find((p: any) => 
        p.metadata.title.toLowerCase() === promptData.metadata.title.toLowerCase()
      );
      return existingByTitle || null;
    } catch {
      return null;
    }
  }

  /**
   * Handle conflict resolution
   */
  private async handleConflict(
    newPrompt: CreatePromptRequest,
    existingPrompt: any,
    options: ImportOptions
  ): Promise<any | null> {
    switch (options.conflictResolution) {
      case 'skip':
        return null;

      case 'overwrite':
        if (this.promptLibraryService) {
          return await this.promptLibraryService.updatePrompt(existingPrompt.id, {
            humanPrompt: newPrompt.humanPrompt,
            metadata: {
              ...existingPrompt.metadata,
              ...newPrompt.metadata
            }
          });
        }
        return newPrompt;

      case 'create_new':
        // Modify title to make it unique
        newPrompt.metadata.title = `${newPrompt.metadata.title} (Imported)`;
        if (this.promptLibraryService) {
          return await this.promptLibraryService.createPrompt(newPrompt);
        }
        return newPrompt;

      case 'prompt':
        // In a real implementation, this would prompt the user
        // For now, default to create_new
        return this.handleConflict(newPrompt, existingPrompt, {
          ...options,
          conflictResolution: 'create_new'
        });

      default:
        throw new Error(`Unknown conflict resolution strategy: ${options.conflictResolution}`);
    }
  }
}