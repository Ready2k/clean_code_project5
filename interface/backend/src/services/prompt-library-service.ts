import { logger } from '../utils/logger.js';
import { ServiceUnavailableError, NotFoundError, ValidationError } from '../types/errors.js';
import path from 'path';

// Local type definitions that match the main library interfaces
export interface HumanPrompt {
  goal: string;
  audience: string;
  steps: string[];
  output_expectations: {
    format: string;
    fields: string[];
  };
}

export interface Variable {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  required: boolean;
  sensitive: boolean;
  options?: string[];
  default?: any;
}

export interface StructuredPrompt {
  schema_version: number;
  system: string[];
  capabilities: string[];
  user_template: string;
  rules: Array<{ name: string; description: string }>;
  variables: string[];
}

export interface PromptRecord {
  id: string;
  version: number;
  metadata: {
    title: string;
    summary: string;
    tags: string[];
    owner: string;
    created_at: string;
    updated_at: string;
  };
  humanPrompt: HumanPrompt;
  prompt_structured?: StructuredPrompt;
  variables: Variable[];
  history: Array<{
    version: number;
    message: string;
    author: string;
    timestamp: string;
    changes: any;
  }>;
}

export interface EnhancementResult {
  structuredPrompt: StructuredPrompt;
  questions: Question[];
  rationale: string;
  confidence: number;
  changes_made: string[];
  warnings?: string[];
}

export interface Question {
  id: string;
  prompt_id: string;
  variable_key: string;
  text: string;
  type: Variable['type'];
  required: boolean;
  options?: string[];
  help_text?: string;
}

export interface Rating {
  id?: string;
  prompt_id: string;
  user_id: string;
  score: number;
  note?: string | undefined;
  timestamp: Date;
}

export interface PromptFilters {
  search?: string;
  tags?: string[] | undefined;
  owner?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number | undefined;
  limit?: number | undefined;
}

export interface RenderOptions {
  model?: string;
  temperature?: number;
  variables?: Record<string, any>;
}

export interface ProviderPayload {
  provider: string;
  model?: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  parameters?: Record<string, any>;
  formatted_prompt: string;
}

export interface CreatePromptRequest {
  metadata: {
    title: string;
    summary: string;
    tags: string[];
  };
  humanPrompt: HumanPrompt;
  owner: string;
}

export interface UpdatePromptRequest {
  metadata?: Partial<{
    title: string;
    summary: string;
    tags: string[];
  }>;
  humanPrompt?: Partial<HumanPrompt>;
  variables?: Variable[];
}

export interface EnhancementOptions {
  preserve_style?: boolean;
  target_provider?: string;
}

export interface RatingData {
  score: number; // 1-5
  note?: string;
}

/**
 * Service layer that provides prompt library functionality for the API
 * This is a mock implementation that will be replaced with actual integration
 */
export class PromptLibraryService {
  private isInitialized = false;
  private prompts = new Map<string, PromptRecord>();
  private ratings = new Map<string, Rating[]>();
  private storageDir: string;

  constructor(config?: { storageDir?: string }) {
    this.storageDir = config?.storageDir || path.resolve(process.cwd(), 'data/prompts');
  }

  /**
   * Initialize the prompt library service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Prompt Library Service...');
      
      // Create storage directory if it doesn't exist
      const fs = await import('fs/promises');
      await fs.mkdir(this.storageDir, { recursive: true });
      
      // Load existing prompts (mock implementation)
      await this.loadMockData();
      
      this.isInitialized = true;
      logger.info('Prompt Library Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Prompt Library Service:', error);
      throw new ServiceUnavailableError('Prompt library service initialization failed');
    }
  }

  /**
   * Load mock data for demonstration
   */
  private async loadMockData(): Promise<void> {
    // Create a sample prompt for demonstration
    const samplePrompt: PromptRecord = {
      id: 'sample-prompt-1',
      version: 1,
      metadata: {
        title: 'Code Review Assistant',
        summary: 'A prompt to help review code and provide constructive feedback',
        tags: ['code-review', 'development', 'feedback'],
        owner: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      humanPrompt: {
        goal: 'Review the provided code and give constructive feedback',
        audience: 'Software developers',
        steps: [
          'Analyze the code structure and logic',
          'Identify potential issues or improvements',
          'Provide specific, actionable feedback',
          'Suggest best practices where applicable'
        ],
        output_expectations: {
          format: 'Structured feedback with sections for different aspects',
          fields: ['strengths', 'issues', 'suggestions', 'best_practices']
        }
      },
      variables: [
        {
          key: 'code',
          label: 'Code to Review',
          type: 'string',
          required: true,
          sensitive: false
        },
        {
          key: 'language',
          label: 'Programming Language',
          type: 'select',
          required: true,
          sensitive: false,
          options: ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'Other']
        }
      ],
      history: []
    };

    this.prompts.set(samplePrompt.id, samplePrompt);
    this.ratings.set(samplePrompt.id, []);
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new ServiceUnavailableError('Prompt library service not initialized');
    }
  }

  /**
   * Create a new prompt from human-readable format
   */
  async createPrompt(request: CreatePromptRequest): Promise<PromptRecord> {
    this.ensureInitialized();

    try {
      logger.info('Creating new prompt', { title: request.metadata.title, owner: request.owner });
      
      const id = `prompt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      
      const promptRecord: PromptRecord = {
        id,
        version: 1,
        metadata: {
          title: request.metadata.title,
          summary: request.metadata.summary,
          tags: request.metadata.tags,
          owner: request.owner,
          created_at: now,
          updated_at: now
        },
        humanPrompt: request.humanPrompt,
        variables: [],
        history: []
      };

      this.prompts.set(id, promptRecord);
      this.ratings.set(id, []);

      logger.info('Prompt created successfully', { id, title: request.metadata.title });
      return promptRecord;
    } catch (error) {
      logger.error('Failed to create prompt:', error);
      if (error instanceof Error && error.message.includes('validation')) {
        throw new ValidationError(error.message);
      }
      throw new ServiceUnavailableError('Failed to create prompt');
    }
  }

  /**
   * Update an existing prompt
   */
  async updatePrompt(id: string, updates: UpdatePromptRequest): Promise<PromptRecord> {
    this.ensureInitialized();

    try {
      logger.info('Updating prompt', { id });
      
      // Get the existing prompt first to ensure it exists
      const existingPrompt = await this.getPrompt(id);
      
      // Create updated prompt
      const updatedPrompt: PromptRecord = {
        ...existingPrompt,
        version: existingPrompt.version + 1,
        metadata: {
          ...existingPrompt.metadata,
          ...updates.metadata,
          updated_at: new Date().toISOString()
        },
        humanPrompt: updates.humanPrompt ? {
          ...existingPrompt.humanPrompt,
          ...updates.humanPrompt
        } : existingPrompt.humanPrompt,
        variables: updates.variables || existingPrompt.variables
      };

      // Add to history
      updatedPrompt.history.push({
        version: existingPrompt.version,
        message: 'Prompt updated via API',
        author: existingPrompt.metadata.owner,
        timestamp: new Date().toISOString(),
        changes: updates
      });

      this.prompts.set(id, updatedPrompt);
      
      logger.info('Prompt updated successfully', { id });
      return updatedPrompt;
    } catch (error) {
      logger.error('Failed to update prompt:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error instanceof Error && error.message.includes('validation')) {
        throw new ValidationError(error.message);
      }
      throw new ServiceUnavailableError('Failed to update prompt');
    }
  }

  /**
   * Retrieve a prompt by ID
   */
  async getPrompt(id: string): Promise<PromptRecord> {
    this.ensureInitialized();

    try {
      logger.debug('Retrieving prompt', { id });
      const prompt = this.prompts.get(id);
      if (!prompt) {
        throw new NotFoundError(`Prompt with id ${id} not found`);
      }
      return prompt;
    } catch (error) {
      logger.error('Failed to retrieve prompt:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceUnavailableError('Failed to retrieve prompt');
    }
  }

  /**
   * List prompts with optional filtering
   */
  async listPrompts(filters?: PromptFilters): Promise<PromptRecord[]> {
    this.ensureInitialized();

    try {
      logger.debug('Listing prompts', { filters });
      let prompts = Array.from(this.prompts.values());

      // Apply filters
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        prompts = prompts.filter(p => 
          p.metadata.title.toLowerCase().includes(searchTerm) ||
          p.metadata.summary.toLowerCase().includes(searchTerm) ||
          p.humanPrompt.goal.toLowerCase().includes(searchTerm)
        );
      }

      if (filters?.tags && filters.tags.length > 0) {
        prompts = prompts.filter(p => 
          filters.tags!.some(tag => p.metadata.tags.includes(tag))
        );
      }

      if (filters?.owner) {
        prompts = prompts.filter(p => p.metadata.owner === filters.owner);
      }

      // Apply sorting
      if (filters?.sortBy) {
        prompts.sort((a, b) => {
          let aVal: any, bVal: any;
          switch (filters.sortBy) {
            case 'title':
              aVal = a.metadata.title;
              bVal = b.metadata.title;
              break;
            case 'created_at':
              aVal = a.metadata.created_at;
              bVal = b.metadata.created_at;
              break;
            case 'updated_at':
              aVal = a.metadata.updated_at;
              bVal = b.metadata.updated_at;
              break;
            default:
              return 0;
          }
          
          if (filters.sortOrder === 'desc') {
            return bVal > aVal ? 1 : -1;
          }
          return aVal > bVal ? 1 : -1;
        });
      }

      // Apply pagination
      if (filters?.page && filters?.limit) {
        const start = (filters.page - 1) * filters.limit;
        prompts = prompts.slice(start, start + filters.limit);
      }

      return prompts;
    } catch (error) {
      logger.error('Failed to list prompts:', error);
      throw new ServiceUnavailableError('Failed to list prompts');
    }
  }

  /**
   * Delete a prompt
   */
  async deletePrompt(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      logger.info('Deleting prompt', { id });
      
      // Ensure prompt exists first
      await this.getPrompt(id);
      
      this.prompts.delete(id);
      this.ratings.delete(id);
      
      logger.info('Prompt deleted successfully', { id });
    } catch (error) {
      logger.error('Failed to delete prompt:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceUnavailableError('Failed to delete prompt');
    }
  }

  /**
   * Enhance a prompt using LLM
   */
  async enhancePrompt(id: string, options?: EnhancementOptions): Promise<EnhancementResult> {
    this.ensureInitialized();

    try {
      logger.info('Enhancing prompt', { id, options });
      
      // Ensure prompt exists first
      const prompt = await this.getPrompt(id);
      
      // Mock enhancement result
      const structuredPrompt: StructuredPrompt = {
        schema_version: 1,
        system: [
          'You are a helpful assistant specialized in the task described below.',
          `Your target audience is: ${prompt.humanPrompt.audience}`
        ],
        capabilities: ['analysis', 'structured_output', 'detailed_feedback'],
        user_template: `Goal: ${prompt.humanPrompt.goal}\n\nSteps to follow:\n${prompt.humanPrompt.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n\nPlease provide output in the following format: ${prompt.humanPrompt.output_expectations.format}`,
        rules: [
          { name: 'accuracy', description: 'Ensure all information provided is accurate and relevant' },
          { name: 'completeness', description: 'Address all aspects mentioned in the goal' }
        ],
        variables: ['input_data', 'context']
      };

      const questions: Question[] = [
        {
          id: `q-${Date.now()}-1`,
          prompt_id: id,
          variable_key: 'input_data',
          text: 'What specific data or content should be processed?',
          type: 'string',
          required: true,
          help_text: 'Provide the main input that needs to be analyzed or processed'
        },
        {
          id: `q-${Date.now()}-2`,
          prompt_id: id,
          variable_key: 'context',
          text: 'Any additional context or constraints?',
          type: 'string',
          required: false,
          help_text: 'Optional context that might influence the analysis'
        }
      ];

      const result: EnhancementResult = {
        structuredPrompt,
        questions,
        rationale: 'Enhanced the human prompt by converting it to structured format with clear system instructions, user template, and extracted variables for reusability.',
        confidence: 0.85,
        changes_made: [
          'Added system instructions for context',
          'Structured the user template with clear steps',
          'Extracted variables for input data and context',
          'Added rules for accuracy and completeness'
        ],
        warnings: []
      };
      
      logger.info('Prompt enhanced successfully', { id, confidence: result.confidence });
      return result;
    } catch (error) {
      logger.error('Failed to enhance prompt:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceUnavailableError('Failed to enhance prompt');
    }
  }

  /**
   * Render a prompt for a specific provider
   */
  async renderPrompt(id: string, provider: string, options: RenderOptions): Promise<ProviderPayload> {
    this.ensureInitialized();

    try {
      logger.info('Rendering prompt', { id, provider });
      
      // Ensure prompt exists first
      const prompt = await this.getPrompt(id);
      
      // Validate provider
      const validProviders = ['openai', 'anthropic', 'meta'];
      if (!validProviders.includes(provider)) {
        throw new ValidationError(`Invalid provider: ${provider}. Valid providers are: ${validProviders.join(', ')}`);
      }
      
      // Mock rendering based on provider
      let messages: Array<{ role: string; content: string }>;
      let formattedPrompt: string;

      if (provider === 'openai') {
        messages = [
          {
            role: 'system',
            content: `You are a helpful assistant. ${prompt.humanPrompt.goal}`
          },
          {
            role: 'user',
            content: `Please help me with the following:\n\nGoal: ${prompt.humanPrompt.goal}\nAudience: ${prompt.humanPrompt.audience}\n\nSteps:\n${prompt.humanPrompt.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n\nExpected output format: ${prompt.humanPrompt.output_expectations.format}`
          }
        ];
        formattedPrompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
      } else if (provider === 'anthropic') {
        messages = [
          {
            role: 'user',
            content: `Human: ${prompt.humanPrompt.goal}\n\nPlease follow these steps:\n${prompt.humanPrompt.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n\nTarget audience: ${prompt.humanPrompt.audience}\nExpected format: ${prompt.humanPrompt.output_expectations.format}\n\nAssistant: I'll help you with that. Let me work through this step by step.`
          }
        ];
        formattedPrompt = messages[0]?.content || '';
      } else {
        // Meta/Llama format
        messages = [
          {
            role: 'user',
            content: `[INST] ${prompt.humanPrompt.goal}\n\nSteps to follow:\n${prompt.humanPrompt.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}\n\nAudience: ${prompt.humanPrompt.audience}\nFormat: ${prompt.humanPrompt.output_expectations.format} [/INST]`
          }
        ];
        formattedPrompt = messages[0]?.content || '';
      }

      const payload: ProviderPayload = {
        provider,
        model: options.model || 'default',
        messages,
        parameters: {
          temperature: options.temperature || 0.7,
          max_tokens: 2000
        },
        formatted_prompt: formattedPrompt
      };
      
      logger.info('Prompt rendered successfully', { id, provider });
      return payload;
    } catch (error) {
      logger.error('Failed to render prompt:', error);
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new ServiceUnavailableError('Failed to render prompt');
    }
  }

  /**
   * Get prompt history and versions
   */
  async getPromptHistory(id: string): Promise<PromptRecord['history']> {
    this.ensureInitialized();

    try {
      logger.debug('Retrieving prompt history', { id });
      
      // Ensure prompt exists first
      const prompt = await this.getPrompt(id);
      
      return prompt.history;
    } catch (error) {
      logger.error('Failed to retrieve prompt history:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceUnavailableError('Failed to retrieve prompt history');
    }
  }

  /**
   * Create a new version of a prompt
   */
  async createVersion(id: string, changes: Partial<PromptRecord>, message: string, author: string): Promise<PromptRecord> {
    this.ensureInitialized();

    try {
      logger.info('Creating prompt version', { id, message, author });
      
      const existingPrompt = await this.getPrompt(id);
      
      const newVersion: PromptRecord = {
        ...existingPrompt,
        ...changes,
        version: existingPrompt.version + 1,
        metadata: {
          ...existingPrompt.metadata,
          ...changes.metadata,
          updated_at: new Date().toISOString()
        }
      };

      // Add to history
      newVersion.history.push({
        version: existingPrompt.version,
        message,
        author,
        timestamp: new Date().toISOString(),
        changes
      });

      this.prompts.set(id, newVersion);
      
      logger.info('Prompt version created successfully', { id, version: newVersion.version });
      return newVersion;
    } catch (error) {
      logger.error('Failed to create prompt version:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceUnavailableError('Failed to create prompt version');
    }
  }

  /**
   * Rate a prompt
   */
  async ratePrompt(promptId: string, userId: string, ratingData: RatingData): Promise<void> {
    this.ensureInitialized();

    try {
      logger.info('Rating prompt', { promptId, userId, score: ratingData.score });
      
      // Ensure prompt exists first
      await this.getPrompt(promptId);
      
      // Validate rating score
      if (ratingData.score < 1 || ratingData.score > 5) {
        throw new ValidationError('Rating score must be between 1 and 5');
      }
      
      const rating: Rating = {
        id: `rating-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        prompt_id: promptId,
        user_id: userId,
        score: ratingData.score,
        note: ratingData.note || undefined,
        timestamp: new Date()
      };
      
      const promptRatings = this.ratings.get(promptId) || [];
      
      // Remove existing rating from this user if it exists
      const filteredRatings = promptRatings.filter(r => r.user_id !== userId);
      filteredRatings.push(rating);
      
      this.ratings.set(promptId, filteredRatings);
      
      logger.info('Prompt rated successfully', { promptId, userId, score: ratingData.score });
    } catch (error) {
      logger.error('Failed to rate prompt:', error);
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      throw new ServiceUnavailableError('Failed to rate prompt');
    }
  }

  /**
   * Get ratings for a prompt
   */
  async getPromptRatings(promptId: string): Promise<Rating[]> {
    this.ensureInitialized();

    try {
      logger.debug('Retrieving prompt ratings', { promptId });
      
      // Ensure prompt exists first
      await this.getPrompt(promptId);
      
      const ratings = this.ratings.get(promptId) || [];
      return ratings;
    } catch (error) {
      logger.error('Failed to retrieve prompt ratings:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new ServiceUnavailableError('Failed to retrieve prompt ratings');
    }
  }

  /**
   * Get available providers
   */
  async getAvailableProviders(): Promise<Array<{ id: string; name: string }>> {
    this.ensureInitialized();

    try {
      // Mock providers
      return [
        { id: 'openai', name: 'OpenAI' },
        { id: 'anthropic', name: 'Anthropic' },
        { id: 'meta', name: 'Meta (Llama)' }
      ];
    } catch (error) {
      logger.error('Failed to get available providers:', error);
      throw new ServiceUnavailableError('Failed to get available providers');
    }
  }

  /**
   * Get service status and health information
   */
  async getStatus(): Promise<{
    initialized: boolean;
    healthy: boolean;
    providers: Array<{ id: string; name: string; healthy: boolean }>;
    storageStats?: any;
  }> {
    try {
      if (!this.isInitialized) {
        return {
          initialized: false,
          healthy: false,
          providers: []
        };
      }

      const providers = await this.getAvailableProviders();
      
      return {
        initialized: this.isInitialized,
        healthy: this.isInitialized,
        providers: providers.map(p => ({ ...p, healthy: true })),
        storageStats: {
          totalPrompts: this.prompts.size,
          totalRatings: Array.from(this.ratings.values()).reduce((sum, ratings) => sum + ratings.length, 0),
          storageDir: this.storageDir
        }
      };
    } catch (error) {
      logger.error('Failed to get service status:', error);
      return {
        initialized: this.isInitialized,
        healthy: false,
        providers: []
      };
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Shutting down Prompt Library Service...');
      // In a real implementation, this would save data to persistent storage
      this.prompts.clear();
      this.ratings.clear();
      this.isInitialized = false;
      logger.info('Prompt Library Service shut down successfully');
    }
  }
}

// Singleton instance for the API
let promptLibraryService: PromptLibraryService | null = null;

/**
 * Get the singleton instance of the prompt library service
 */
export function getPromptLibraryService(): PromptLibraryService {
  if (!promptLibraryService) {
    promptLibraryService = new PromptLibraryService();
  }
  return promptLibraryService;
}

/**
 * Initialize the prompt library service
 */
export async function initializePromptLibraryService(config?: { storageDir?: string }): Promise<void> {
  if (promptLibraryService) {
    await promptLibraryService.shutdown();
  }
  
  promptLibraryService = new PromptLibraryService(config);
  await promptLibraryService.initialize();
}