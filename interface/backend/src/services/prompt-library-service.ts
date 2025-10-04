import { logger } from '../utils/logger.js';
import { ServiceUnavailableError, NotFoundError, ValidationError } from '../types/errors.js';
import { LLMExecutionService } from './llm-execution-service.js';
import { WebSocketService } from './websocket-service.js';
import path from 'path';
import fs from 'fs/promises';
import * as YAML from 'yaml';

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
    preferred_model?: string;
    tuned_for_provider?: string;
    source_url?: string;
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
    enhancement_model?: string;
    enhancement_provider?: string;
  }>;
  ratings?: Rating[];
  averageRating?: number;
  totalRatings?: number;
  // Frontend compatibility fields
  createdAt?: string;
  updatedAt?: string;
  status?: 'active' | 'draft' | 'archived' | 'deprecated';
}

export interface EnhancementResult {
  structuredPrompt: StructuredPrompt;
  questions: Question[];
  rationale: string;
  confidence: number;
  changes_made: string[];
  warnings?: string[];
  enhancement_model?: string;
  enhancement_provider?: string;
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
  targetModel?: string; // Target model for adaptation
  temperature?: number;
  variables?: Record<string, any>;
  version?: 'original' | 'enhanced' | 'original-no-adapt';
  connectionId?: string;
}

export interface ProviderPayload {
  provider: string;
  model?: string;
  targetModel?: string | undefined; // Target model for adaptation/variant tagging
  messages: Array<{
    role: string;
    content: string;
  }>;
  parameters?: Record<string, any>;
  formatted_prompt: string;
  response?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface CreatePromptRequest {
  metadata: {
    title: string;
    summary: string;
    tags: string[];
    preferred_model?: string;
    tuned_for_provider?: string;
    source_url?: string;
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
  target_model?: string;
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

  private webSocketService: WebSocketService;

  constructor(webSocketService: WebSocketService, config?: { storageDir?: string }) {
    this.webSocketService = webSocketService;
    this.storageDir = config?.storageDir || path.resolve(process.cwd(), 'data/prompts');
  }

  /**
   * Initialize the prompt library service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Prompt Library Service already initialized, skipping');
      return;
    }

    try {
      logger.info('Initializing Prompt Library Service...');

      // Create storage directory if it doesn't exist
      logger.info('Creating storage directory...');
      await fs.mkdir(this.storageDir, { recursive: true });
      logger.info('Storage directory created/verified');

      // Load existing prompts from files
      logger.info('Loading prompts from files...');
      await this.loadPromptsFromFiles();
      logger.info('Finished loading prompts from files');

      // If no prompts were loaded, create some sample data
      if (this.prompts.size === 0) {
        logger.info('No existing prompts found, creating sample data');
        await this.loadMockData();
        logger.info('Sample data created');
      }

      this.isInitialized = true;
      logger.info('Prompt Library Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Prompt Library Service:', error);
      throw new ServiceUnavailableError('Prompt library service initialization failed');
    }
  }

  /**
   * Save a prompt to file
   */
  private async savePromptToFile(prompt: PromptRecord): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, `${prompt.id}.yaml`);
      const yamlContent = YAML.stringify(prompt);
      await fs.writeFile(filePath, yamlContent, 'utf-8');
      logger.debug('Prompt saved to file', { promptId: prompt.id, filePath });
    } catch (error) {
      logger.error('Failed to save prompt to file', { promptId: prompt.id, error });
      throw error;
    }
  }

  /**
   * Load prompts from files
   */
  private async loadPromptsFromFiles(): Promise<void> {
    try {
      logger.info('Reading storage directory...');
      const files = await fs.readdir(this.storageDir);
      const yamlFiles = files.filter(file => file.endsWith('.yaml'));

      logger.info('Loading prompts from files', { fileCount: yamlFiles.length });

      let loadedCount = 0;
      for (const file of yamlFiles) {
        try {
          logger.debug('Processing file', { file });
          const filePath = path.join(this.storageDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          logger.debug('File content read', { file, contentLength: content.length });
          
          const prompt = YAML.parse(content) as PromptRecord;
          logger.debug('YAML parsed', { file, promptId: prompt?.id });

          // Validate that the prompt has required fields
          if (prompt.id && prompt.metadata && prompt.humanPrompt) {
            // Ensure required metadata fields exist
            if (!prompt.metadata.created_at) {
              prompt.metadata.created_at = new Date().toISOString();
            }
            if (!prompt.metadata.updated_at) {
              prompt.metadata.updated_at = prompt.metadata.created_at;
            }

            this.prompts.set(prompt.id, prompt);
            // Initialize empty ratings for loaded prompts
            if (!this.ratings.has(prompt.id)) {
              this.ratings.set(prompt.id, []);
            }
            loadedCount++;
            logger.debug('Loaded prompt from file', { promptId: prompt.id, loadedCount });
          } else {
            logger.warn('Invalid prompt structure in file, missing required fields', {
              file,
              hasId: !!prompt.id,
              hasMetadata: !!prompt.metadata,
              hasHumanPrompt: !!prompt.humanPrompt
            });
          }
        } catch (error) {
          logger.error('Failed to load prompt from file', { file, error });
        }
      }

      logger.info('Finished loading prompts from files', {
        totalLoaded: this.prompts.size,
        processedFiles: yamlFiles.length
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('No existing prompts directory found, starting with empty collection');
      } else {
        logger.error('Failed to load prompts from files', { error });
        throw error;
      }
    }
  }

  /**
   * Delete prompt file
   */
  private async deletePromptFile(promptId: string): Promise<void> {
    try {
      const filePath = path.join(this.storageDir, `${promptId}.yaml`);
      await fs.unlink(filePath);
      logger.debug('Prompt file deleted', { promptId, filePath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('Prompt file not found, nothing to delete', { promptId });
      } else {
        logger.error('Failed to delete prompt file', { promptId, error });
        throw error;
      }
    }
  }

  /**
   * Sync ratings from rating service to in-memory cache
   */
  async syncRatingsFromRatingService(): Promise<void> {
    try {
      // Import getRatingService dynamically to avoid circular dependencies
      const { getRatingService } = await import('./rating-service.js');
      const ratingService = getRatingService();

      // Clear existing ratings cache
      this.ratings.clear();

      // Sync ratings for each prompt
      for (const promptId of this.prompts.keys()) {
        try {
          const ratingResult = await ratingService.getPromptRatings(promptId);
          const ratings = ratingResult.ratings || [];

          // Convert rating service format to prompt library format
          const convertedRatings = ratings.map(rating => ({
            id: rating.id,
            prompt_id: promptId,
            user_id: rating.userId, // Rating service returns camelCase
            score: rating.score,
            note: rating.note,
            timestamp: rating.createdAt // Rating service returns camelCase
          }));

          this.ratings.set(promptId, convertedRatings);
          logger.debug('Synced ratings for prompt', { promptId, ratingsCount: convertedRatings.length });
        } catch (error) {
          logger.warn('Failed to sync ratings for prompt', { promptId, error });
          // Set empty ratings for this prompt
          this.ratings.set(promptId, []);
        }
      }

      logger.info('Finished syncing ratings from rating service', {
        totalPrompts: this.prompts.size,
        totalRatings: Array.from(this.ratings.values()).reduce((sum, ratings) => sum + ratings.length, 0)
      });
    } catch (error) {
      logger.error('Failed to sync ratings from rating service', { error });
    }
  }

  /**
   * Sync ratings for a specific prompt from rating service
   */
  async syncPromptRatings(promptId: string): Promise<void> {
    try {
      // Import getRatingService dynamically to avoid circular dependencies
      const { getRatingService } = await import('./rating-service.js');
      const ratingService = getRatingService();

      const ratingResult = await ratingService.getPromptRatings(promptId);
      const ratings = ratingResult.ratings || [];

      // Convert rating service format to prompt library format
      const convertedRatings = ratings.map(rating => ({
        id: rating.id,
        prompt_id: promptId,
        user_id: rating.userId, // Rating service returns camelCase
        score: rating.score,
        note: rating.note,
        timestamp: rating.createdAt // Rating service returns camelCase
      }));

      this.ratings.set(promptId, convertedRatings);
      logger.debug('Synced ratings for prompt', { promptId, ratingsCount: convertedRatings.length });
    } catch (error) {
      logger.warn('Failed to sync ratings for prompt', { promptId, error });
      // Set empty ratings for this prompt on error
      this.ratings.set(promptId, []);
    }
  }

  /**
   * Save all prompts to files (useful for backup or migration)
   */
  async saveAllPromptsToFiles(): Promise<void> {
    this.ensureInitialized();

    logger.info('Saving all prompts to files', { totalPrompts: this.prompts.size });

    const savePromises = Array.from(this.prompts.values()).map(prompt =>
      this.savePromptToFile(prompt).catch(error => {
        logger.error('Failed to save prompt to file', { promptId: prompt.id, error });
      })
    );

    await Promise.all(savePromises);
    logger.info('Finished saving all prompts to files');
  }

  /**
   * Load mock data for demonstration
   */
  private async loadMockData(): Promise<void> {
    // Create multiple sample prompts for demonstration
    const samplePrompts: PromptRecord[] = [
      {
        id: 'sample-prompt-1',
        version: 1,
        metadata: {
          title: 'Code Review Assistant',
          summary: 'A prompt to help review code and provide constructive feedback',
          tags: ['code-review', 'development', 'feedback'],
          owner: 'system',
          created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          updated_at: new Date(Date.now() - 86400000).toISOString()
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
        history: [
          {
            version: 1,
            message: 'Prompt created',
            author: 'demo-user',
            timestamp: '2024-01-15T10:00:00.000Z',
            changes: {
              action: 'create',
              details: 'Initial prompt creation'
            }
          }
        ]
      },
      {
        id: 'sample-prompt-2',
        version: 1,
        metadata: {
          title: 'Technical Documentation Writer',
          summary: 'Generate comprehensive technical documentation for software projects',
          tags: ['documentation', 'technical-writing', 'software'],
          owner: 'system',
          created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
          updated_at: new Date(Date.now() - 172800000).toISOString()
        },
        humanPrompt: {
          goal: 'Create clear, comprehensive technical documentation',
          audience: 'Developers and technical stakeholders',
          steps: [
            'Analyze the software component or feature',
            'Structure the documentation logically',
            'Include code examples and usage patterns',
            'Add troubleshooting and FAQ sections'
          ],
          output_expectations: {
            format: 'Markdown documentation with clear sections',
            fields: ['overview', 'installation', 'usage', 'api_reference', 'examples', 'troubleshooting']
          }
        },
        variables: [
          {
            key: 'component_name',
            label: 'Component/Feature Name',
            type: 'string',
            required: true,
            sensitive: false
          },
          {
            key: 'tech_stack',
            label: 'Technology Stack',
            type: 'string',
            required: true,
            sensitive: false
          }
        ],
        history: [
          {
            version: 1,
            message: 'Prompt created',
            author: 'demo-user',
            timestamp: '2024-01-15T11:30:00.000Z',
            changes: {
              action: 'create',
              details: 'Initial prompt creation'
            }
          },
          {
            version: 1,
            message: 'Prompt enhanced using AI (generation task)',
            author: 'system',
            timestamp: '2024-01-15T12:15:00.000Z',
            changes: {
              action: 'enhance',
              details: {
                taskType: 'generation',
                questionsGenerated: 1,
                confidence: 0.92,
                enhancementModel: 'claude-3-sonnet',
                enhancementProvider: 'anthropic'
              }
            },
            enhancement_model: 'claude-3-sonnet',
            enhancement_provider: 'anthropic'
          }
        ]
      },
      {
        id: 'sample-prompt-3',
        version: 1,
        metadata: {
          title: 'API Design Consultant',
          summary: 'Help design RESTful APIs with best practices and standards',
          tags: ['api-design', 'rest', 'backend', 'architecture'],
          owner: 'system',
          created_at: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
          updated_at: new Date(Date.now() - 259200000).toISOString()
        },
        humanPrompt: {
          goal: 'Design a well-structured RESTful API following industry best practices',
          audience: 'Backend developers and API architects',
          steps: [
            'Understand the business requirements',
            'Define resource models and relationships',
            'Design endpoint structure and HTTP methods',
            'Specify request/response formats',
            'Add authentication and error handling'
          ],
          output_expectations: {
            format: 'OpenAPI specification with detailed documentation',
            fields: ['endpoints', 'models', 'authentication', 'error_codes', 'examples']
          }
        },
        variables: [
          {
            key: 'domain',
            label: 'Business Domain',
            type: 'string',
            required: true,
            sensitive: false
          },
          {
            key: 'auth_type',
            label: 'Authentication Type',
            type: 'select',
            required: true,
            sensitive: false,
            options: ['JWT', 'OAuth2', 'API Key', 'Basic Auth']
          }
        ],
        history: [
          {
            version: 1,
            message: 'Prompt created',
            author: 'demo-user',
            timestamp: '2024-01-14T09:00:00.000Z',
            changes: {
              action: 'create',
              details: 'Initial prompt creation'
            }
          },
          {
            version: 1,
            message: 'Prompt rendered for openai',
            author: 'user123',
            timestamp: '2024-01-14T14:20:00.000Z',
            changes: {
              action: 'render',
              details: {
                provider: 'openai',
                version: 'original',
                variablesUsed: ['code_language', 'requirements'],
                connectionId: 'conn-789'
              }
            }
          },
          {
            version: 1,
            message: 'Rated 4/5 stars',
            author: 'user456',
            timestamp: '2024-01-14T16:45:00.000Z',
            changes: {
              action: 'rate',
              details: {
                score: 4,
                hasNote: false,
                totalRatings: 2,
                averageRating: 4.5
              }
            }
          }
        ]
      },
      {
        id: 'sample-prompt-4',
        version: 1,
        metadata: {
          title: 'Database Schema Designer',
          summary: 'Design efficient database schemas with proper normalization',
          tags: ['database', 'schema-design', 'sql', 'data-modeling'],
          owner: 'system',
          created_at: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
          updated_at: new Date(Date.now() - 345600000).toISOString()
        },
        humanPrompt: {
          goal: 'Create an optimized database schema for the given requirements',
          audience: 'Database administrators and backend developers',
          steps: [
            'Analyze data requirements and relationships',
            'Apply normalization principles',
            'Define primary and foreign keys',
            'Add appropriate indexes for performance',
            'Include constraints and validation rules'
          ],
          output_expectations: {
            format: 'SQL DDL statements with documentation',
            fields: ['tables', 'relationships', 'indexes', 'constraints', 'sample_data']
          }
        },
        variables: [
          {
            key: 'business_domain',
            label: 'Business Domain',
            type: 'string',
            required: true,
            sensitive: false
          },
          {
            key: 'database_type',
            label: 'Database Type',
            type: 'select',
            required: true,
            sensitive: false,
            options: ['PostgreSQL', 'MySQL', 'SQLite', 'SQL Server', 'Oracle']
          }
        ],
        history: [
          {
            version: 1,
            message: 'Prompt created',
            author: 'demo-user',
            timestamp: '2024-01-13T15:30:00.000Z',
            changes: {
              action: 'create',
              details: 'Initial prompt creation'
            }
          },
          {
            version: 1,
            message: 'Title changed from "Email Marketing Campaign" to "Advanced Email Marketing Campaign", Tags modified',
            author: 'jane.smith',
            timestamp: '2024-01-13T16:45:00.000Z',
            changes: {
              action: 'update',
              details: [
                'Title changed from "Email Marketing Campaign" to "Advanced Email Marketing Campaign"',
                'Tags modified'
              ],
              fieldsChanged: ['metadata']
            }
          }
        ]
      },
      {
        id: 'sample-prompt-5',
        version: 1,
        metadata: {
          title: 'Test Case Generator',
          summary: 'Generate comprehensive test cases for software features',
          tags: ['testing', 'qa', 'test-cases', 'quality-assurance'],
          owner: 'system',
          created_at: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
          updated_at: new Date(Date.now() - 432000000).toISOString()
        },
        humanPrompt: {
          goal: 'Create comprehensive test cases covering all scenarios',
          audience: 'QA engineers and developers',
          steps: [
            'Analyze the feature requirements',
            'Identify positive and negative test scenarios',
            'Create edge cases and boundary conditions',
            'Define expected results for each test',
            'Organize tests by priority and category'
          ],
          output_expectations: {
            format: 'Structured test case document',
            fields: ['test_id', 'description', 'preconditions', 'steps', 'expected_result', 'priority']
          }
        },
        variables: [
          {
            key: 'feature_description',
            label: 'Feature Description',
            type: 'string',
            required: true,
            sensitive: false
          },
          {
            key: 'test_type',
            label: 'Test Type',
            type: 'select',
            required: true,
            sensitive: false,
            options: ['Unit', 'Integration', 'System', 'Acceptance', 'Performance']
          }
        ],
        history: [
          {
            version: 1,
            message: 'Prompt created',
            author: 'demo-user',
            timestamp: '2024-01-12T08:00:00.000Z',
            changes: {
              action: 'create',
              details: 'Initial prompt creation'
            }
          },
          {
            version: 1,
            message: 'Prompt rendered for anthropic',
            author: 'user789',
            timestamp: '2024-01-12T10:30:00.000Z',
            changes: {
              action: 'render',
              details: {
                provider: 'anthropic',
                version: 'enhanced',
                variablesUsed: ['research_topic', 'depth_level'],
                connectionId: 'conn-456'
              }
            }
          },
          {
            version: 1,
            message: 'Rated 5/5 stars with feedback',
            author: 'user101',
            timestamp: '2024-01-12T14:15:00.000Z',
            changes: {
              action: 'rate',
              details: {
                score: 5,
                hasNote: true,
                totalRatings: 1,
                averageRating: 5.0
              }
            }
          }
        ]
      }
    ];

    // Add all sample prompts
    for (const prompt of samplePrompts) {
      this.prompts.set(prompt.id, prompt);

      // Save sample prompt to file for persistence
      try {
        await this.savePromptToFile(prompt);
      } catch (error) {
        logger.warn('Failed to save sample prompt to file', { promptId: prompt.id, error });
      }

      // Add multiple sample ratings for each prompt
      const numRatings = Math.floor(Math.random() * 4) + 2; // 2-5 ratings per prompt
      const ratings: Rating[] = [];

      for (let i = 0; i < numRatings; i++) {
        ratings.push({
          id: `rating-${prompt.id}-${i + 1}`,
          prompt_id: prompt.id,
          user_id: `user-${i + 1}`,
          score: Math.floor(Math.random() * 3) + 3, // 3-5 stars
          note: i === 0 ? 'Great prompt, very helpful!' : undefined,
          timestamp: new Date(Date.now() - Math.random() * 86400000 * 7) // Within last week
        });
      }

      this.ratings.set(prompt.id, ratings);
    }
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
          updated_at: now,
          ...(request.metadata.preferred_model && { preferred_model: request.metadata.preferred_model }),
          ...(request.metadata.tuned_for_provider && { tuned_for_provider: request.metadata.tuned_for_provider }),
          ...(request.metadata.source_url && { source_url: request.metadata.source_url })
        },
        humanPrompt: request.humanPrompt,
        variables: [],
        history: [
          {
            version: 1,
            message: 'Prompt created',
            author: request.owner,
            timestamp: now,
            changes: {
              action: 'create',
              details: 'Initial prompt creation'
            }
          }
        ]
      };

      this.prompts.set(id, promptRecord);
      this.ratings.set(id, []);

      // Save prompt to file
      await this.savePromptToFile(promptRecord);

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

      // Determine what changed and create detailed history entry
      const changes = this.analyzeChanges(existingPrompt, updates);
      const isEnhancement = updates.humanPrompt &&
        (updates.humanPrompt.goal?.includes('Enhanced context:') ||
          updates.humanPrompt.steps?.some(step => step.includes('Enhanced:')));

      // Add to history
      const historyEntry: any = {
        version: existingPrompt.version,
        message: this.generateChangeMessage(changes, isEnhancement || false),
        author: existingPrompt.metadata.owner,
        timestamp: new Date().toISOString(),
        changes: {
          action: 'update',
          details: changes,
          fieldsChanged: Object.keys(updates).filter(key => updates[key as keyof UpdatePromptRequest] !== undefined)
        }
      };

      // Add enhancement model info if this is an enhancement
      if (isEnhancement) {
        historyEntry.enhancement_model = 'claude-3-sonnet'; // Default for now
        historyEntry.enhancement_provider = 'anthropic';
      }

      updatedPrompt.history.push(historyEntry);

      this.prompts.set(id, updatedPrompt);

      // Save updated prompt to file
      await this.savePromptToFile(updatedPrompt);

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

      // Enrich with ratings data and convert field names to camelCase
      const ratings = this.ratings.get(id) || [];
      const averageRating = ratings.length > 0
        ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length
        : 0;

      return {
        ...prompt,
        // Convert snake_case to camelCase for frontend compatibility
        createdAt: prompt.metadata.created_at,
        updatedAt: prompt.metadata.updated_at,
        status: 'active' as const, // Add default status
        metadata: {
          ...prompt.metadata
        },
        // Convert variable fields to match frontend expectations
        variables: prompt.variables.map(variable => ({
          ...variable,
          name: variable.key,
          description: variable.label
        })),
        ratings,
        averageRating,
        totalRatings: ratings.length
      };
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

      // Enrich prompts with ratings data and convert field names to camelCase
      const enrichedPrompts = prompts.map(prompt => {
        const ratings = this.ratings.get(prompt.id) || [];
        const averageRating = ratings.length > 0
          ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length
          : 0;

        return {
          ...prompt,
          // Convert snake_case to camelCase for frontend compatibility
          createdAt: prompt.metadata.created_at,
          updatedAt: prompt.metadata.updated_at,
          status: 'active' as const, // Add default status
          metadata: {
            ...prompt.metadata
          },
          // Convert variable fields to match frontend expectations
          variables: prompt.variables.map(variable => ({
            ...variable,
            name: variable.key,
            description: variable.label
          })),
          ratings,
          averageRating,
          totalRatings: ratings.length
        };
      });

      return enrichedPrompts;
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
      const prompt = await this.getPrompt(id);

      // Add final history entry before deletion
      await this.addHistoryEntry(id, {
        message: 'Prompt deleted',
        author: prompt.metadata.owner,
        changes: {
          action: 'delete',
          details: {
            finalVersion: prompt.version,
            totalHistoryEntries: prompt.history.length
          }
        }
      });

      this.prompts.delete(id);
      this.ratings.delete(id);

      // Delete prompt file
      await this.deletePromptFile(id);

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

      // Intelligent question generation logic
      const taskType = this.detectTaskType(prompt.humanPrompt);
      const shouldGenerate = this.shouldGenerateQuestions(prompt.humanPrompt);

      logger.info('Question generation analysis', {
        taskType,
        shouldGenerate,
        goalLength: prompt.humanPrompt.goal.length,
        stepsCount: prompt.humanPrompt.steps.length
      });

      // Generate intelligent questions only if needed
      const questions: Question[] = shouldGenerate
        ? this.generateContextualQuestions(prompt.humanPrompt, taskType, id)
        : [];

      // Create enhanced structured prompt
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
        variables: questions.map(q => q.variable_key)
      };

      const result: EnhancementResult = {
        structuredPrompt,
        questions,
        rationale: questions.length > 0
          ? `Enhanced the prompt and identified ${questions.length} areas where additional context would improve results. The prompt appears to be a ${taskType} task.`
          : `Enhanced the prompt to structured format. No additional questions needed - the prompt is already well-defined for this ${taskType} task.`,
        confidence: questions.length === 0 ? 0.95 : 0.75, // Higher confidence when no questions needed
        changes_made: [
          'Converted to structured format with system instructions',
          'Organized user template with clear steps',
          questions.length > 0 ? `Identified ${questions.length} variables for customization` : 'No additional variables needed',
          'Added accuracy and completeness rules'
        ],
        warnings: [],
        enhancement_model: options?.target_model || 'claude-3-sonnet',
        enhancement_provider: options?.target_provider || 'anthropic'
      };

      // Add enhancement to history if structured prompt was generated
      if (structuredPrompt) {
        await this.addHistoryEntry(id, {
          message: `Prompt enhanced using AI (${taskType} task)`,
          author: 'system',
          changes: {
            action: 'enhance',
            details: {
              taskType,
              questionsGenerated: questions.length,
              confidence: result.confidence,
              enhancementModel: result.enhancement_model,
              enhancementProvider: result.enhancement_provider
            }
          },
          enhancement_model: result.enhancement_model || 'claude-3-sonnet',
          enhancement_provider: result.enhancement_provider || 'anthropic'
        });

        // Create a variant with the enhanced content
        logger.info('About to create enhanced variant', { id, provider: result.enhancement_provider, model: result.enhancement_model });
        await this.createEnhancedVariant(id, result, prompt);
        logger.info('Enhanced variant creation completed', { id });
      }

      logger.info('Prompt enhanced successfully', {
        id,
        confidence: result.confidence,
        questionsGenerated: questions.length,
        taskType
      });
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
   * Create an enhanced variant of a prompt
   */
  private async createEnhancedVariant(originalId: string, enhancementResult: EnhancementResult, originalPrompt: PromptRecord): Promise<void> {
    try {
      const provider = enhancementResult.enhancement_provider || 'anthropic';
      const model = enhancementResult.enhancement_model || 'claude-3-sonnet';
      const variantTag = `${provider}-${model}`;
      
      // Create enhanced prompt content
      const enhancedGoal = `Enhanced context: ${originalPrompt.humanPrompt.goal}`;
      const enhancedSteps = originalPrompt.humanPrompt.steps.map(step => `Enhanced: ${step}`);
      
      // Create variant tags
      const variantTags = [...(originalPrompt.metadata.tags || []), variantTag, 'enhanced'];
      
      // Create the variant prompt
      const variantPrompt: CreatePromptRequest = {
        humanPrompt: {
          goal: enhancedGoal,
          audience: originalPrompt.humanPrompt.audience,
          steps: enhancedSteps,
          output_expectations: originalPrompt.humanPrompt.output_expectations
        },
        metadata: {
          title: `${originalPrompt.metadata.title} (Enhanced)`,
          summary: `${originalPrompt.metadata.summary} - Enhanced using ${provider} ${model}`,
          tags: variantTags,
          tuned_for_provider: provider,
          preferred_model: model
        },
        owner: originalPrompt.metadata.owner
      };

      // Create the variant
      const variant = await this.createPrompt(variantPrompt);
      
      // Update the variant with variables if there are any questions
      if (enhancementResult.questions.length > 0) {
        const variables = enhancementResult.questions.map(q => ({
          key: q.variable_key,
          label: q.text,
          type: q.type as 'string' | 'number' | 'boolean' | 'select' | 'multiselect',
          required: q.required || true,
          sensitive: false,
          ...(q.options && { options: q.options })
        }));
        
        await this.updatePrompt(variant.id, { variables });
      }
      
      logger.info('Enhanced variant created successfully', { 
        originalId, 
        variantId: variant.id, 
        provider, 
        model 
      });
    } catch (error) {
      logger.error('Failed to create enhanced variant:', error);
      // Don't throw - enhancement should still succeed even if variant creation fails
    }
  }

  /**
   * Render a prompt for a specific provider
   */
  async renderPrompt(id: string, provider: string, options: RenderOptions, userId?: string): Promise<ProviderPayload> {
    this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.info('Rendering prompt', { id, provider });

      // Notify render started
      if (options.connectionId && userId) {
        this.webSocketService.notifyRenderStarted(id, provider, userId, options.connectionId);
        this.webSocketService.notifyRenderProgress(id, provider, userId, options.connectionId, 'preparing', 'Loading prompt and validating parameters...');
      }

      // Ensure prompt exists first
      const prompt = await this.getPrompt(id);

      // Validate provider
      const validProviders = ['openai', 'anthropic', 'meta'];
      if (!validProviders.includes(provider)) {
        throw new ValidationError(`Invalid provider: ${provider}. Valid providers are: ${validProviders.join(', ')}`);
      }

      // Progress update: preparing prompt
      if (options.connectionId && userId) {
        this.webSocketService.notifyRenderProgress(id, provider, userId, options.connectionId, 'preparing', `Preparing prompt for ${provider} provider...`);
      }

      // Determine which version to use
      const useEnhanced = options.version === 'enhanced' && prompt.prompt_structured;
      const noAdaptation = options.version === 'original-no-adapt';

      // Mock rendering based on provider and version
      let messages: Array<{ role: string; content: string }>;
      let formattedPrompt: string;

      if (useEnhanced && prompt.prompt_structured) {
        // Use enhanced structured prompt
        const structured = prompt.prompt_structured;

        if (provider === 'openai') {
          messages = [
            {
              role: 'system',
              content: (structured.system || []).join('\n')
            },
            {
              role: 'user',
              content: this.substituteVariables(structured.user_template || '', options.variables || {})
            }
          ];
          formattedPrompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
        } else if (provider === 'anthropic') {
          const systemInstructions = (structured.system || []).join('\n');
          const userContent = this.substituteVariables(structured.user_template || '', options.variables || {});
          messages = [
            {
              role: 'user',
              content: `Human: ${systemInstructions}\n\n${userContent}\n\nAssistant: I'll help you with that following the provided instructions.`
            }
          ];
          formattedPrompt = messages[0]?.content || '';
        } else {
          // Meta/Llama format
          const systemInstructions = (structured.system || []).join('\n');
          const userContent = this.substituteVariables(structured.user_template || '', options.variables || {});
          messages = [
            {
              role: 'user',
              content: `[INST] ${systemInstructions}\n\n${userContent} [/INST]`
            }
          ];
          formattedPrompt = messages[0]?.content || '';
        }
      } else if (noAdaptation) {
        // Use original prompt without any adaptation
        const originalPromptText = this.buildCompleteOriginalPrompt(prompt.humanPrompt);

        if (provider === 'openai') {
          messages = [
            {
              role: 'system',
              content: 'You are a helpful assistant. Please respond to the following prompt exactly as written.'
            },
            {
              role: 'user',
              content: originalPromptText
            }
          ];
          formattedPrompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
        } else if (provider === 'anthropic') {
          messages = [
            {
              role: 'user',
              content: `Human: ${originalPromptText}\n\nAssistant: I'll respond to this prompt:`
            }
          ];
          formattedPrompt = messages[0]?.content || '';
        } else {
          // Meta/Llama format
          messages = [
            {
              role: 'user',
              content: `[INST] ${originalPromptText} [/INST]`
            }
          ];
          formattedPrompt = messages[0]?.content || '';
        }
      } else {
        // Use original human prompt with adaptive rendering
        const isAgentPrompt = this.isAgentPrompt(prompt.humanPrompt, prompt.metadata);

        if (isAgentPrompt) {
          // Agent prompt - send complete original prompt for adaptation
          const originalPromptText = this.buildCompleteOriginalPrompt(prompt.humanPrompt);
          const formatInstructions = this.buildFormatAdaptationInstructions(prompt, provider);
          const fullAgentPrompt = `${formatInstructions}\n\n## Original Prompt to Adapt:\n\n${originalPromptText}`;

          if (provider === 'openai') {
            messages = [
              {
                role: 'system',
                content: fullAgentPrompt
              },
              {
                role: 'user',
                content: 'Become this expert agent with all specified capabilities.'
              }
            ];
          } else if (provider === 'anthropic') {
            messages = [
              {
                role: 'user',
                content: `Human: ${fullAgentPrompt}\n\nBecome this expert agent with all specified capabilities.\n\nAssistant: I am this expert agent:`
              }
            ];
          } else {
            // Meta/Llama format
            messages = [
              {
                role: 'user',
                content: `[INST] ${fullAgentPrompt}\n\nBecome this expert agent with all specified capabilities. [/INST]`
              }
            ];
          }
        } else {
          // Task prompt - complete the specific task with format adaptation
          const taskDefinition = this.buildTaskDefinition(prompt.humanPrompt);
          const formatInstructions = this.buildTaskFormatInstructions(prompt, provider);
          const fullTaskPrompt = `${formatInstructions}\n\n${taskDefinition}`;

          if (provider === 'openai') {
            messages = [
              {
                role: 'system',
                content: fullTaskPrompt
              },
              {
                role: 'user',
                content: 'Please complete this task now.'
              }
            ];
          } else if (provider === 'anthropic') {
            messages = [
              {
                role: 'user',
                content: `Human: ${fullTaskPrompt}\n\nPlease complete this task now.\n\nAssistant: I'll complete this task for you:`
              }
            ];
          } else {
            // Meta/Llama format
            messages = [
              {
                role: 'user',
                content: `[INST] ${fullTaskPrompt}\n\nPlease complete this task now. [/INST]`
              }
            ];
          }
        }

        formattedPrompt = provider === 'openai'
          ? messages.map(m => `${m.role}: ${m.content}`).join('\n\n')
          : messages[0]?.content || '';
      }

      // If connectionId is provided and userId is available, use real LLM execution
      logger.info('Checking LLM execution conditions', {
        hasConnectionId: !!options.connectionId,
        connectionId: options.connectionId,
        hasUserId: !!userId,
        userId: userId
      });

      if (options.connectionId && userId) {
        try {
          logger.info('Using real LLM execution', { connectionId: options.connectionId, provider });

          // Progress update: executing LLM
          this.webSocketService.notifyRenderProgress(id, provider, userId, options.connectionId, 'executing', `Sending request to ${provider} LLM...`);
          logger.info('Sent render progress update: executing', { promptId: id, provider, userId, connectionId: options.connectionId });

          // Progress update: processing (send BEFORE execution starts)
          this.webSocketService.notifyRenderProgress(id, provider, userId, options.connectionId, 'processing', 'Processing LLM response...');
          logger.info('Sent render progress update: processing', { promptId: id, provider, userId, connectionId: options.connectionId });

          const executionResult = await LLMExecutionService.executePrompt({
            connectionId: options.connectionId,
            userId,
            messages,
            options: {
              temperature: options.temperature || 0.7,
              maxTokens: 2000,
              ...(options.model && { model: options.model })
            }
          });

          const payload: ProviderPayload = {
            provider: executionResult.provider,
            model: executionResult.model,
            targetModel: options.targetModel, // Include target model for adaptation
            messages,
            parameters: {
              temperature: options.temperature || 0.7,
              max_tokens: 2000
            },
            formatted_prompt: formattedPrompt,
            response: executionResult.response,
            ...(executionResult.usage && { usage: executionResult.usage })
          };

          const renderTime = Date.now() - startTime;
          
          logger.info('Real LLM execution completed', {
            id,
            provider,
            model: executionResult.model,
            responseLength: executionResult.response.length,
            responsePreview: executionResult.response.substring(0, 100) + '...',
            renderTime
          });

          // Send completion notification directly (skip the "completed successfully" progress message)
          this.webSocketService.notifyRenderCompleted(id, provider, userId, options.connectionId, payload, renderTime);
          logger.info('Sent render completion notification', { promptId: id, provider, userId, connectionId: options.connectionId, renderTime });

          return payload;
        } catch (error) {
          logger.error('Real LLM execution failed, falling back to mock', { error: (error as Error).message });
          
          // Notify error via WebSocket
          this.webSocketService.notifyRenderFailed(id, provider, userId, options.connectionId, (error as Error).message);
          
          // Fall through to mock response
        }
      }

      // Mock response (fallback or when no connectionId provided)
      logger.info('Using mock response', {
        reason: !options.connectionId ? 'no connectionId' : !userId ? 'no userId' : 'LLM execution failed'
      });

      // Determine the appropriate model for the provider
      const getDefaultModel = (provider: string): string => {
        switch (provider) {
          case 'openai':
            return 'gpt-3.5-turbo';
          case 'anthropic':
            return 'claude-3-sonnet-20240229';
          case 'meta':
            return 'llama-2-70b-chat';
          default:
            return 'default';
        }
      };

      const modelToUse = options.model || getDefaultModel(provider);

      const payload: ProviderPayload = {
        provider,
        model: modelToUse,
        targetModel: options.targetModel, // Include target model for adaptation
        messages,
        parameters: {
          temperature: options.temperature || 0.7,
          max_tokens: 2000
        },
        formatted_prompt: formattedPrompt,
        response: `[MOCK RESPONSE] This would be the actual response from ${provider} ${modelToUse}. The prompt has been formatted correctly and would be sent to the real API.`,
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150
        }
      };

      // Track render in history
      await this.addHistoryEntry(id, {
        message: `Prompt rendered for ${provider}`,
        author: userId || 'system',
        changes: {
          action: 'render',
          details: {
            provider,
            version: useEnhanced ? 'enhanced' : (noAdaptation ? 'original-no-adapt' : 'original'),
            variablesUsed: Object.keys(options.variables || {}),
            connectionId: options.connectionId
          }
        }
      });

      logger.info('Mock prompt rendered successfully', { id, provider });
      return payload;
    } catch (error) {
      logger.error('Failed to render prompt:', error);
      
      // Notify error via WebSocket if we have connection info
      if (options.connectionId && userId) {
        this.webSocketService.notifyRenderFailed(id, provider, userId, options.connectionId, (error as Error).message);
      }
      
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

      // Add rating to history
      await this.addHistoryEntry(promptId, {
        message: `Rated ${ratingData.score}/5 stars${ratingData.note ? ' with feedback' : ''}`,
        author: userId,
        changes: {
          action: 'rate',
          details: {
            score: ratingData.score,
            hasNote: !!ratingData.note,
            totalRatings: filteredRatings.length,
            averageRating: filteredRatings.reduce((sum, r) => sum + r.score, 0) / filteredRatings.length
          }
        }
      });

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

  /**
   * Substitute variables in a template string
   */
  private substituteVariables(template: string, variables: Record<string, any>): string {
    let result = template;

    // Replace variables in the format {{variable_name}}
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, String(value || ''));
    });

    return result;
  }

  /**
   * Detect if this is an agent prompt (vs a task prompt) using hybrid approach
   */
  private isAgentPrompt(humanPrompt: HumanPrompt, metadata?: any): boolean {
    // 1. Check explicit metadata tag first (manual override)
    if (metadata?.tags) {
      if (metadata.tags.includes('prompt-type:agent')) return true;
      if (metadata.tags.includes('prompt-type:task')) return false;
    }

    // 2. Auto-detect based on language patterns
    const goalLower = humanPrompt.goal.toLowerCase();
    const stepsText = humanPrompt.steps.join(' ').toLowerCase();

    // Agent-defining keywords (identity/capability focused)
    const agentKeywords = [
      'expert', 'specialist', 'engineer', 'architect', 'masters', 'specializing',
      'capabilities', 'behavioral traits', 'knowledge base', 'response approach',
      'example interactions', 'purpose', '## capabilities', '## behavioral',
      'you are', 'i am', 'my expertise', 'my specialization'
    ];

    // Task-defining keywords (action/deliverable focused)
    const taskKeywords = [
      'create', 'build', 'generate', 'analyze', 'write', 'develop', 'design',
      'implement', 'test', 'review', 'document', 'plan', 'organize', 'identify'
    ];

    const hasAgentKeywords = agentKeywords.some(keyword =>
      goalLower.includes(keyword) || stepsText.includes(keyword)
    );

    const hasTaskKeywords = taskKeywords.some(keyword =>
      goalLower.includes(keyword)
    );

    // If both present, prioritize agent keywords
    // If only task keywords, it's likely a task
    return hasAgentKeywords || (!hasTaskKeywords && hasAgentKeywords);
  }

  /**
   * Build the complete original prompt text exactly as it was structured
   */
  private buildCompleteOriginalPrompt(humanPrompt: HumanPrompt): string {
    const sections = [];

    // Goal section
    sections.push(`**Goal:** ${humanPrompt.goal}`);

    // Audience section
    if (humanPrompt.audience) {
      sections.push(`\n**Audience:** ${humanPrompt.audience}`);
    }

    // Steps section (contains all the detailed capabilities, traits, etc.)
    if (humanPrompt.steps && humanPrompt.steps.length > 0) {
      sections.push('\n**Capabilities and Knowledge:**');
      humanPrompt.steps.forEach(step => {
        // Preserve exact original formatting and content
        sections.push(`\n${step}`);
      });
    }

    // Output expectations
    if (humanPrompt.output_expectations?.format) {
      sections.push(`\n**Output Expectations:** ${humanPrompt.output_expectations.format}`);
    }

    return sections.join('\n');
  }

  /**
   * Build task definition for completion - preserving original structure
   */
  private buildTaskDefinition(humanPrompt: HumanPrompt): string {
    const sections = [];

    // Preserve original structure
    sections.push(`**Goal:** ${humanPrompt.goal}`);

    if (humanPrompt.audience && humanPrompt.audience !== 'General') {
      sections.push(`**Audience:** ${humanPrompt.audience}`);
    }

    if (humanPrompt.steps && humanPrompt.steps.length > 0) {
      sections.push('\n**Steps:**');
      humanPrompt.steps.forEach((step, i) => {
        sections.push(`${i + 1}. ${step}`);
      });
    }

    if (humanPrompt.output_expectations?.format) {
      sections.push(`\n**Expected Output:** ${humanPrompt.output_expectations.format}`);
    }

    // Add completion instructions
    sections.push('\n---');
    sections.push('\n**TASK COMPLETION:**');
    sections.push('Please complete the above task by following each step systematically and delivering the expected output. Start your response by acknowledging the goal and audience, then work through each step to produce the final deliverable.');

    return sections.join('\n');
  }

  /**
   * Build format instructions for task completion
   */
  private buildTaskFormatInstructions(_prompt: PromptRecord, targetProvider: string): string {
    const providerFormats = {
      openai: {
        name: 'OpenAI GPT',
        style: 'structured, clear, and actionable deliverables with numbered lists, code blocks, and practical examples',
      },
      anthropic: {
        name: 'Anthropic Claude',
        style: 'detailed, thorough deliverables with comprehensive explanations and step-by-step reasoning',
      },
      meta: {
        name: 'Meta Llama',
        style: 'concise, direct deliverables with practical examples and straightforward presentation',
      }
    };

    const outputFormat = providerFormats[targetProvider as keyof typeof providerFormats] || {
      name: 'Unknown',
      style: 'standard format',
    };

    return `## Task Completion Instructions:

**Format**: Deliver the task output using ${outputFormat.style}.

**Structure**: Start your response by restating the Goal, Audience, and Steps from the task definition below, then provide the complete deliverable.

**Objective**: Complete the task and provide the actual deliverable, not instructions on how to do it. Follow the defined steps systematically to produce the expected output.`;
  }

  /**
   * Build format adaptation instructions for cross-provider compatibility
   */
  private buildFormatAdaptationInstructions(prompt: PromptRecord, targetProvider: string): string {
    const originalProvider = (prompt.metadata as any)?.tuned_for_provider || 'generic';

    const providerFormats = {
      openai: {
        name: 'OpenAI GPT',
        style: 'structured, clear, and actionable responses with numbered lists, code blocks, and practical examples',
      },
      anthropic: {
        name: 'Anthropic Claude',
        style: 'conversational, detailed explanations with step-by-step reasoning and thoughtful analysis',
      },
      meta: {
        name: 'Meta Llama',
        style: 'concise, direct responses with practical examples and straightforward explanations',
      }
    };

    const outputFormat = providerFormats[targetProvider as keyof typeof providerFormats] || {
      name: 'Unknown',
      style: 'standard format',
    };

    if (originalProvider === targetProvider) {
      // Same provider - minimal adaptation needed
      return `## Format Instructions:
This prompt is optimized for ${outputFormat.name}. Respond using ${outputFormat.style}.`;
    }

    // Cross-provider adaptation
    return `## Transform to ${outputFormat.name} Format:

**Task**: Become this agent using ${outputFormat.style}. Preserve ALL content - every capability, trait, tool, example, and methodology exactly as specified below.

**Critical**: This is format adaptation, not summarization. Include everything.`;
  }

  /**
   * Detect the task type from the human prompt
   */
  private detectTaskType(humanPrompt: HumanPrompt): string {
    const goalText = humanPrompt.goal.toLowerCase();
    const stepsText = humanPrompt.steps.join(' ').toLowerCase();
    const combinedText = `${goalText} ${stepsText}`;

    // Code keywords (check first as they're more specific)
    if (this.containsKeywords(combinedText, ['code', 'program', 'script', 'function', 'algorithm', 'debug', 'refactor', 'write a function', 'implement'])) {
      return 'code';
    }

    // Analysis keywords
    if (this.containsKeywords(combinedText, ['analyze', 'analysis', 'examine', 'evaluate', 'assess', 'review', 'study'])) {
      return 'analysis';
    }

    // Generation keywords (but exclude code-related generation)
    if (this.containsKeywords(combinedText, ['generate', 'create', 'write', 'produce', 'build', 'make', 'compose']) &&
      !this.containsKeywords(combinedText, ['function', 'code', 'program', 'script'])) {
      return 'generation';
    }

    // Transformation keywords
    if (this.containsKeywords(combinedText, ['transform', 'convert', 'translate', 'reformat', 'restructure', 'modify'])) {
      return 'transformation';
    }

    // Classification keywords
    if (this.containsKeywords(combinedText, ['classify', 'categorize', 'sort', 'group', 'label', 'tag'])) {
      return 'classification';
    }

    // Summarization keywords
    if (this.containsKeywords(combinedText, ['summarize', 'summary', 'condense', 'brief', 'overview', 'abstract'])) {
      return 'summarization';
    }

    // Conversation keywords
    if (this.containsKeywords(combinedText, ['chat', 'conversation', 'dialogue', 'discuss', 'talk', 'respond'])) {
      return 'conversation';
    }

    // Creative keywords
    if (this.containsKeywords(combinedText, ['creative', 'story', 'poem', 'design', 'brainstorm', 'imagine'])) {
      return 'creative';
    }

    return 'unknown';
  }

  /**
   * Determine if questions are actually needed for this enhancement
   */
  private shouldGenerateQuestions(humanPrompt: HumanPrompt): boolean {
    // Don't generate questions if the prompt is already very specific
    if (this.isPromptAlreadySpecific(humanPrompt)) {
      return false;
    }

    // Don't generate questions for simple, self-contained tasks
    if (this.isSelfContainedTask(humanPrompt)) {
      return false;
    }

    return true;
  }

  /**
   * Generate contextual questions based on task type
   */
  private generateContextualQuestions(humanPrompt: HumanPrompt, taskType: string, promptId: string): Question[] {
    const questions: Question[] = [];

    switch (taskType) {
      case 'analysis':
        questions.push(...this.generateAnalysisQuestions(humanPrompt, promptId));
        break;
      case 'generation':
        questions.push(...this.generateGenerationQuestions(humanPrompt, promptId));
        break;
      case 'transformation':
        questions.push(...this.generateTransformationQuestions(humanPrompt, promptId));
        break;
      case 'classification':
        questions.push(...this.generateClassificationQuestions(humanPrompt, promptId));
        break;
      case 'code':
        questions.push(...this.generateCodeQuestions(humanPrompt, promptId));
        break;
      default:
        // For unknown or simple tasks, generate minimal questions only if prompt is very vague
        if (this.isPromptVeryVague(humanPrompt)) {
          questions.push(...this.generateGenericQuestions(humanPrompt, promptId));
        }
    }

    return questions;
  }

  private generateAnalysisQuestions(humanPrompt: HumanPrompt, promptId: string): Question[] {
    const questions: Question[] = [];

    // Only ask for data if not already specified
    if (!this.hasDataSpecified(humanPrompt)) {
      questions.push({
        id: `${promptId}_analysis_data`,
        prompt_id: promptId,
        variable_key: 'analysis_data',
        text: 'What data or content should be analyzed?',
        type: 'string',
        required: true,
        help_text: 'Provide the specific data, document, or content to analyze'
      });
    }

    // Ask for analysis focus if goal is vague
    if (this.isGoalVague(humanPrompt)) {
      questions.push({
        id: `${promptId}_analysis_focus`,
        prompt_id: promptId,
        variable_key: 'analysis_focus',
        text: 'What specific aspects should the analysis focus on?',
        type: 'string',
        required: false,
        help_text: 'e.g., trends, patterns, quality, performance, etc.'
      });
    }

    return questions;
  }

  private generateGenerationQuestions(humanPrompt: HumanPrompt, promptId: string): Question[] {
    const questions: Question[] = [];

    // Ask for topic/subject if not clear
    if (!this.hasTopicSpecified(humanPrompt)) {
      questions.push({
        id: `${promptId}_generation_topic`,
        prompt_id: promptId,
        variable_key: 'generation_topic',
        text: 'What topic or subject should be generated?',
        type: 'string',
        required: true,
        help_text: 'The main topic, theme, or subject for the generated content'
      });
    }

    // Ask for style/tone if not specified
    if (!this.hasStyleSpecified(humanPrompt)) {
      questions.push({
        id: `${promptId}_content_style`,
        prompt_id: promptId,
        variable_key: 'content_style',
        text: 'What style or tone should be used?',
        type: 'select',
        required: false,
        options: ['professional', 'casual', 'academic', 'creative', 'technical', 'friendly'],
        help_text: 'The writing style or tone for the generated content'
      });
    }

    return questions;
  }

  private generateTransformationQuestions(_humanPrompt: HumanPrompt, promptId: string): Question[] {
    const questions: Question[] = [];

    // Ask for source format if not clear
    questions.push({
      id: `${promptId}_source_format`,
      prompt_id: promptId,
      variable_key: 'source_format',
      text: 'What is the current format of the content?',
      type: 'string',
      required: true,
      help_text: 'The format of the input content (e.g., JSON, CSV, plain text)'
    });

    // Ask for target format
    questions.push({
      id: `${promptId}_target_format`,
      prompt_id: promptId,
      variable_key: 'target_format',
      text: 'What format should the content be transformed to?',
      type: 'string',
      required: true,
      help_text: 'The desired output format'
    });

    return questions;
  }

  private generateClassificationQuestions(_humanPrompt: HumanPrompt, promptId: string): Question[] {
    const questions: Question[] = [];

    // Ask for classification categories if not specified
    questions.push({
      id: `${promptId}_classification_categories`,
      prompt_id: promptId,
      variable_key: 'classification_categories',
      text: 'What categories should be used for classification?',
      type: 'string',
      required: true,
      help_text: 'List the categories or labels to classify content into'
    });

    return questions;
  }

  private generateCodeQuestions(humanPrompt: HumanPrompt, promptId: string): Question[] {
    const questions: Question[] = [];

    // Ask for programming language if not specified
    if (!this.hasLanguageSpecified(humanPrompt)) {
      questions.push({
        id: `${promptId}_programming_language`,
        prompt_id: promptId,
        variable_key: 'programming_language',
        text: 'What programming language should be used?',
        type: 'select',
        required: true,
        options: ['JavaScript', 'Python', 'TypeScript', 'Java', 'C#', 'Go', 'Rust', 'Other'],
        help_text: 'The programming language for the code'
      });
    }

    // Ask for specific requirements if the goal is vague
    if (this.isGoalVague(humanPrompt)) {
      questions.push({
        id: `${promptId}_code_requirements`,
        prompt_id: promptId,
        variable_key: 'code_requirements',
        text: 'What are the specific requirements for the code?',
        type: 'string',
        required: false,
        help_text: 'Any specific requirements, constraints, or features needed'
      });
    }

    return questions;
  }

  private generateGenericQuestions(_humanPrompt: HumanPrompt, promptId: string): Question[] {
    const questions: Question[] = [];

    questions.push({
      id: `${promptId}_specific_requirements`,
      prompt_id: promptId,
      variable_key: 'specific_requirements',
      text: 'What are the specific requirements or details?',
      type: 'string',
      required: false,
      help_text: 'Any additional details that would help complete the task'
    });

    return questions;
  }

  // Helper methods for analysis
  private containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private isPromptAlreadySpecific(humanPrompt: HumanPrompt): boolean {
    const totalLength = humanPrompt.goal.length + humanPrompt.steps.join(' ').length;
    const hasDetailedSteps = humanPrompt.steps.length >= 3 && humanPrompt.steps.some(step => step.length > 50);
    const hasSpecificOutput = humanPrompt.output_expectations.fields.length > 1;

    return totalLength > 300 && hasDetailedSteps && hasSpecificOutput;
  }

  private isSelfContainedTask(humanPrompt: HumanPrompt): boolean {
    const goalText = humanPrompt.goal.toLowerCase();

    // Tasks that typically don't need additional input
    const selfContainedKeywords = [
      'explain', 'describe', 'list', 'define', 'compare',
      'what is', 'how to', 'why does', 'when should'
    ];

    return selfContainedKeywords.some(keyword => goalText.includes(keyword));
  }

  private hasDataSpecified(humanPrompt: HumanPrompt): boolean {
    const combinedText = `${humanPrompt.goal} ${humanPrompt.steps.join(' ')}`.toLowerCase();
    const dataKeywords = ['data', 'file', 'document', 'content', 'text', 'input'];
    return dataKeywords.some(keyword => combinedText.includes(keyword));
  }

  private isGoalVague(humanPrompt: HumanPrompt): boolean {
    return humanPrompt.goal.length < 50 ||
      (humanPrompt.goal.toLowerCase().includes('analyze') &&
        !humanPrompt.goal.toLowerCase().includes('for'));
  }

  private hasTopicSpecified(humanPrompt: HumanPrompt): boolean {
    const goalText = humanPrompt.goal.toLowerCase();
    return goalText.includes('about') || goalText.includes('on') || goalText.includes('regarding');
  }

  private hasStyleSpecified(humanPrompt: HumanPrompt): boolean {
    const combinedText = `${humanPrompt.goal} ${humanPrompt.steps.join(' ')}`.toLowerCase();
    const styleKeywords = ['professional', 'casual', 'formal', 'informal', 'technical', 'simple', 'detailed'];
    return styleKeywords.some(keyword => combinedText.includes(keyword));
  }

  private hasLanguageSpecified(humanPrompt: HumanPrompt): boolean {
    const combinedText = `${humanPrompt.goal} ${humanPrompt.steps.join(' ')}`.toLowerCase();
    const languages = ['javascript', 'python', 'java', 'typescript', 'c#', 'go', 'rust', 'php', 'ruby'];
    return languages.some(lang => combinedText.includes(lang));
  }

  private isPromptVeryVague(humanPrompt: HumanPrompt): boolean {
    return humanPrompt.goal.length < 30 && humanPrompt.steps.length < 2;
  }

  /**
   * Add a history entry to a prompt
   */
  private async addHistoryEntry(promptId: string, entry: {
    message: string;
    author: string;
    changes: any;
    enhancement_model?: string;
    enhancement_provider?: string;
  }): Promise<void> {
    try {
      const prompt = await this.getPrompt(promptId);

      const historyEntry = {
        version: prompt.version,
        message: entry.message,
        author: entry.author,
        timestamp: new Date().toISOString(),
        changes: entry.changes,
        ...(entry.enhancement_model && { enhancement_model: entry.enhancement_model }),
        ...(entry.enhancement_provider && { enhancement_provider: entry.enhancement_provider })
      };

      prompt.history.push(historyEntry);
      prompt.metadata.updated_at = new Date().toISOString();

      this.prompts.set(promptId, prompt);
      await this.savePromptToFile(prompt);

      logger.debug('History entry added', { promptId, message: entry.message });
    } catch (error) {
      logger.error('Failed to add history entry:', error);
      // Don't throw - history tracking shouldn't break the main operation
    }
  }

  /**
   * Analyze changes between existing prompt and updates
   */
  private analyzeChanges(existingPrompt: PromptRecord, updates: UpdatePromptRequest): string[] {
    const changes: string[] = [];

    if (updates.metadata) {
      if (updates.metadata.title && updates.metadata.title !== existingPrompt.metadata.title) {
        changes.push(`Title changed from "${existingPrompt.metadata.title}" to "${updates.metadata.title}"`);
      }
      if (updates.metadata.summary && updates.metadata.summary !== existingPrompt.metadata.summary) {
        changes.push('Summary updated');
      }
      if (updates.metadata.tags && JSON.stringify(updates.metadata.tags) !== JSON.stringify(existingPrompt.metadata.tags)) {
        changes.push('Tags modified');
      }
      if ((updates.metadata as any).preferred_model && (updates.metadata as any).preferred_model !== (existingPrompt.metadata as any).preferred_model) {
        changes.push(`Preferred model changed to ${(updates.metadata as any).preferred_model}`);
      }
    }

    if (updates.humanPrompt) {
      if (updates.humanPrompt.goal && updates.humanPrompt.goal !== existingPrompt.humanPrompt.goal) {
        changes.push('Goal updated');
      }
      if (updates.humanPrompt.audience && updates.humanPrompt.audience !== existingPrompt.humanPrompt.audience) {
        changes.push('Target audience changed');
      }
      if (updates.humanPrompt.steps && JSON.stringify(updates.humanPrompt.steps) !== JSON.stringify(existingPrompt.humanPrompt.steps)) {
        changes.push('Steps modified');
      }
      if (updates.humanPrompt.output_expectations) {
        changes.push('Output expectations updated');
      }
    }

    if (updates.variables && JSON.stringify(updates.variables) !== JSON.stringify(existingPrompt.variables)) {
      changes.push('Variables modified');
    }

    return changes;
  }

  /**
   * Generate a human-readable change message
   */
  private generateChangeMessage(changes: string[], isEnhancement: boolean): string {
    if (isEnhancement) {
      return 'Prompt enhanced via AI';
    }

    if (changes.length === 0) {
      return 'Prompt updated';
    }

    if (changes.length === 1) {
      return changes[0] || 'Prompt updated';
    }

    if (changes.length <= 3) {
      return changes.join(', ');
    }

    return `${changes.length} changes made: ${changes.slice(0, 2).join(', ')} and ${changes.length - 2} more`;
  }
}

// Singleton instance for the API
let promptLibraryService: PromptLibraryService | null = null;

/**
 * Get the singleton instance of the prompt library service
 */
export function getPromptLibraryService(): PromptLibraryService {
  if (!promptLibraryService) {
    throw new Error('PromptLibraryService not initialized. Call initializePromptLibraryService first.');
  }
  return promptLibraryService;
}

export async function initializePromptLibraryService(
  webSocketService: WebSocketService,
  config?: { storageDir?: string }
): Promise<void> {
  if (promptLibraryService) {
    await promptLibraryService.shutdown();
  }

  promptLibraryService = new PromptLibraryService(webSocketService, config);
  await promptLibraryService.initialize();
}