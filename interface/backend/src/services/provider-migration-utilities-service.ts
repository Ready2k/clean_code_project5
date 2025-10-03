/**
 * Provider Migration Utilities Service
 * 
 * Comprehensive migration utilities for converting existing connections
 * to dynamic providers, with validation and rollback mechanisms.
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { getDatabaseService } from './database-service.js';
import { getDynamicProviderService } from './dynamic-provider-service.js';
import { 
  CreateProviderRequest,
  CreateModelRequest 
} from '../types/dynamic-providers.js';

export interface MigrationConfig {
  batchSize: number;
  validateBeforeMigration: boolean;
  createBackup: boolean;
  enableRollback: boolean;
  dryRun: boolean;
}

export interface LegacyConnection {
  id: string;
  name: string;
  type: string; // 'openai', 'anthropic', 'meta', etc.
  config: any;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MigrationPlan {
  id: string;
  totalConnections: number;
  connectionsByProvider: Record<string, number>;
  requiredProviders: ProviderMigrationSpec[];
  requiredModels: ModelMigrationSpec[];
  estimatedDuration: number;
  risks: MigrationRisk[];
  createdAt: Date;
}

export interface ProviderMigrationSpec {
  legacyType: string;
  providerConfig: CreateProviderRequest;
  modelConfigs: CreateModelRequest[];
  connectionCount: number;
}

export interface ModelMigrationSpec {
  legacyModelId: string;
  modelConfig: CreateModelRequest;
  providerId: string;
  connectionCount: number;
}

export interface MigrationRisk {
  type: 'compatibility' | 'data_loss' | 'performance' | 'configuration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  mitigation: string;
  affectedConnections: string[];
}

export interface MigrationResult {
  planId: string;
  success: boolean;
  migratedConnections: number;
  failedConnections: number;
  createdProviders: string[];
  createdModels: string[];
  errors: MigrationError[];
  warnings: MigrationWarning[];
  duration: number;
  rollbackInfo?: RollbackInfo;
}

export interface MigrationError {
  connectionId: string;
  error: string;
  details?: any;
}

export interface MigrationWarning {
  connectionId: string;
  warning: string;
  details?: any;
}

export interface RollbackInfo {
  backupId: string;
  backupPath: string;
  createdAt: Date;
  canRollback: boolean;
}

export interface MigrationProgress {
  planId: string;
  phase: 'validation' | 'backup' | 'migration' | 'verification' | 'complete' | 'failed';
  progress: number; // 0-100
  currentConnection?: string;
  message: string;
  startedAt: Date;
  estimatedCompletion?: Date;
}

/**
 * Provider Migration Utilities Service
 */
export class ProviderMigrationUtilitiesService extends EventEmitter {
  private config: MigrationConfig;
  private activeMigrations = new Map<string, MigrationProgress>();

  constructor(config?: Partial<MigrationConfig>) {
    super();
    
    this.config = {
      batchSize: 10,
      validateBeforeMigration: true,
      createBackup: true,
      enableRollback: true,
      dryRun: false,
      ...config
    };

    logger.info('Provider migration utilities service initialized', { config: this.config });
  }

  /**
   * Analyze existing connections and create migration plan
   */
  async createMigrationPlan(): Promise<MigrationPlan> {
    try {
      logger.info('Creating migration plan for existing connections');

      // Get all existing connections
      const connections = await this.getLegacyConnections();
      
      // Group connections by provider type
      const connectionsByProvider = this.groupConnectionsByProvider(connections);
      
      // Create provider migration specs
      const requiredProviders = await this.createProviderSpecs(connectionsByProvider);
      
      // Create model migration specs
      const requiredModels = await this.createModelSpecs(connections, requiredProviders);
      
      // Analyze risks
      const risks = await this.analyzeRisks(connections, requiredProviders);
      
      // Estimate duration
      const estimatedDuration = this.estimateMigrationDuration(connections.length);

      const plan: MigrationPlan = {
        id: this.generateId(),
        totalConnections: connections.length,
        connectionsByProvider,
        requiredProviders,
        requiredModels,
        estimatedDuration,
        risks,
        createdAt: new Date()
      };

      // Save plan to database
      await this.saveMigrationPlan(plan);

      logger.info('Migration plan created successfully', { 
        planId: plan.id, 
        totalConnections: plan.totalConnections 
      });

      return plan;

    } catch (error) {
      logger.error('Failed to create migration plan', error);
      throw error;
    }
  }

  /**
   * Execute migration plan
   */
  async executeMigrationPlan(planId: string): Promise<MigrationResult> {
    try {
      logger.info('Executing migration plan', { planId });

      // Load migration plan
      const plan = await this.loadMigrationPlan(planId);
      if (!plan) {
        throw new Error(`Migration plan not found: ${planId}`);
      }

      // Initialize progress tracking
      const progress: MigrationProgress = {
        planId,
        phase: 'validation',
        progress: 0,
        message: 'Starting migration...',
        startedAt: new Date()
      };
      
      this.activeMigrations.set(planId, progress);
      this.emit('migration_started', progress);

      const startTime = Date.now();
      const result: MigrationResult = {
        planId,
        success: false,
        migratedConnections: 0,
        failedConnections: 0,
        createdProviders: [],
        createdModels: [],
        errors: [],
        warnings: [],
        duration: 0
      };

      try {
        // Phase 1: Validation
        await this.updateProgress(planId, 'validation', 10, 'Validating migration plan...');
        
        if (this.config.validateBeforeMigration) {
          await this.validateMigrationPlan(plan);
        }

        // Phase 2: Backup
        if (this.config.createBackup) {
          await this.updateProgress(planId, 'backup', 20, 'Creating backup...');
          result.rollbackInfo = await this.createBackup(planId);
        }

        // Phase 3: Migration
        await this.updateProgress(planId, 'migration', 30, 'Starting migration...');
        
        // Create providers
        for (const providerSpec of plan.requiredProviders) {
          try {
            const providerId = await this.createProvider(providerSpec);
            result.createdProviders.push(providerId);
            
            // Create models for this provider
            for (const modelSpec of providerSpec.modelConfigs) {
              try {
                const modelId = await this.createModel(providerId, modelSpec);
                result.createdModels.push(modelId);
              } catch (error) {
                result.warnings.push({
                  connectionId: 'N/A',
                  warning: `Failed to create model: ${modelSpec.identifier}`,
                  details: error
                });
              }
            }
          } catch (error) {
            result.errors.push({
              connectionId: 'N/A',
              error: `Failed to create provider: ${providerSpec.legacyType}`,
              details: error
            });
          }
        }

        // Migrate connections in batches
        const connections = await this.getLegacyConnections();
        const batches = this.createBatches(connections, this.config.batchSize);
        
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          if (!batch) continue;
          const batchProgress = 30 + (i / batches.length) * 60;
          
          await this.updateProgress(
            planId, 
            'migration', 
            batchProgress, 
            `Migrating batch ${i + 1}/${batches.length}...`
          );

          for (const connection of batch) {
            try {
              if (!this.config.dryRun) {
                await this.migrateConnection(connection, plan);
              }
              result.migratedConnections++;
            } catch (error) {
              result.failedConnections++;
              result.errors.push({
                connectionId: connection.id,
                error: error instanceof Error ? error.message : 'Unknown error',
                details: error
              });
            }
          }
        }

        // Phase 4: Verification
        await this.updateProgress(planId, 'verification', 95, 'Verifying migration...');
        
        if (!this.config.dryRun) {
          await this.verifyMigration(plan, result);
        }

        // Complete
        result.success = result.errors.length === 0 || result.migratedConnections > 0;
        result.duration = Date.now() - startTime;

        await this.updateProgress(planId, 'complete', 100, 'Migration completed successfully');
        
        logger.info('Migration completed', { 
          planId, 
          success: result.success,
          migratedConnections: result.migratedConnections,
          failedConnections: result.failedConnections
        });

        this.emit('migration_completed', result);
        return result;

      } catch (error) {
        result.success = false;
        result.duration = Date.now() - startTime;
        
        await this.updateProgress(planId, 'failed', 0, `Migration failed: ${error}`);
        
        logger.error('Migration failed', { planId, error });
        this.emit('migration_failed', { planId, error });
        
        throw error;
      } finally {
        this.activeMigrations.delete(planId);
      }

    } catch (error) {
      logger.error('Failed to execute migration plan', { planId, error });
      throw error;
    }
  }

  /**
   * Rollback migration
   */
  async rollbackMigration(planId: string): Promise<void> {
    try {
      logger.info('Rolling back migration', { planId });

      if (!this.config.enableRollback) {
        throw new Error('Rollback is disabled in configuration');
      }

      // Load migration result
      const result = await this.loadMigrationResult(planId);
      if (!result || !result.rollbackInfo) {
        throw new Error('No rollback information available');
      }

      // Restore from backup
      await this.restoreFromBackup(result.rollbackInfo);

      // Remove created providers and models
      await this.cleanupCreatedResources(result);

      logger.info('Migration rollback completed', { planId });
      this.emit('migration_rolled_back', { planId });

    } catch (error) {
      logger.error('Failed to rollback migration', { planId, error });
      throw error;
    }
  }

  /**
   * Get migration progress
   */
  getMigrationProgress(planId: string): MigrationProgress | null {
    return this.activeMigrations.get(planId) || null;
  }

  /**
   * Validate existing connection compatibility
   */
  async validateConnectionCompatibility(connectionId: string): Promise<{
    compatible: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    try {
      const connection = await this.getLegacyConnection(connectionId);
      if (!connection) {
        throw new Error(`Connection not found: ${connectionId}`);
      }

      const issues: string[] = [];
      const recommendations: string[] = [];

      // Check provider type compatibility
      const supportedTypes = ['openai', 'anthropic', 'meta', 'aws_bedrock', 'microsoft_copilot'];
      if (!supportedTypes.includes(connection.type)) {
        issues.push(`Unsupported provider type: ${connection.type}`);
        recommendations.push('Consider using a custom provider configuration');
      }

      // Check configuration completeness
      if (!connection.config || Object.keys(connection.config).length === 0) {
        issues.push('Connection configuration is empty or missing');
        recommendations.push('Ensure connection has valid configuration before migration');
      }

      // Check for deprecated features
      if (connection.config?.deprecated_feature) {
        issues.push('Connection uses deprecated features');
        recommendations.push('Update connection configuration to use supported features');
      }

      const compatible = issues.length === 0;

      return {
        compatible,
        issues,
        recommendations
      };

    } catch (error) {
      logger.error('Failed to validate connection compatibility', { connectionId, error });
      throw error;
    }
  }

  /**
   * Get legacy connections from database
   */
  private async getLegacyConnections(): Promise<LegacyConnection[]> {
    try {
      const db = getDatabaseService();
      const result = await db.query(`
        SELECT id, name, type, config, user_id, created_at, updated_at
        FROM connections 
        WHERE migrated_to_dynamic = false OR migrated_to_dynamic IS NULL
        ORDER BY created_at
      `);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        config: row.config,
        userId: row.user_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

    } catch (error) {
      logger.error('Failed to get legacy connections', error);
      throw error;
    }
  }

  /**
   * Get single legacy connection
   */
  private async getLegacyConnection(connectionId: string): Promise<LegacyConnection | null> {
    try {
      const db = getDatabaseService();
      const result = await db.query(`
        SELECT id, name, type, config, user_id, created_at, updated_at
        FROM connections 
        WHERE id = $1
      `, [connectionId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        config: row.config,
        userId: row.user_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };

    } catch (error) {
      logger.error('Failed to get legacy connection', { connectionId, error });
      throw error;
    }
  }

  /**
   * Group connections by provider type
   */
  private groupConnectionsByProvider(connections: LegacyConnection[]): Record<string, number> {
    const groups: Record<string, number> = {};
    
    for (const connection of connections) {
      groups[connection.type] = (groups[connection.type] || 0) + 1;
    }
    
    return groups;
  }

  /**
   * Create provider migration specifications
   */
  private async createProviderSpecs(
    connectionsByProvider: Record<string, number>
  ): Promise<ProviderMigrationSpec[]> {
    const specs: ProviderMigrationSpec[] = [];

    for (const [providerType, connectionCount] of Object.entries(connectionsByProvider)) {
      const spec = await this.createProviderSpec(providerType, connectionCount);
      if (spec) {
        specs.push(spec);
      }
    }

    return specs;
  }

  /**
   * Create single provider specification
   */
  private async createProviderSpec(
    legacyType: string, 
    connectionCount: number
  ): Promise<ProviderMigrationSpec | null> {
    try {
      // Define provider configurations for known types
      const providerConfigs: Record<string, CreateProviderRequest> = {
        openai: {
          identifier: 'openai-migrated',
          name: 'OpenAI (Migrated)',
          description: 'Migrated OpenAI provider from legacy connections',
          apiEndpoint: 'https://api.openai.com/v1',
          authMethod: 'api_key',
          authConfig: {
            type: 'api_key',
            fields: {
              apiKey: {
                required: true,
                description: 'OpenAI API Key',
                sensitive: true
              }
            },
            headers: {
              'Authorization': 'Bearer {{apiKey}}'
            }
          },
          capabilities: {
            supportsSystemMessages: true,
            maxContextLength: 128000,
            supportedRoles: ['system', 'user', 'assistant'],
            supportsStreaming: true,
            supportsTools: true,
            supportedAuthMethods: ['api_key']
          }
        },
        anthropic: {
          identifier: 'anthropic-migrated',
          name: 'Anthropic (Migrated)',
          description: 'Migrated Anthropic provider from legacy connections',
          apiEndpoint: 'https://api.anthropic.com/v1',
          authMethod: 'api_key',
          authConfig: {
            type: 'api_key',
            fields: {
              apiKey: {
                required: true,
                description: 'Anthropic API Key',
                sensitive: true
              }
            },
            headers: {
              'x-api-key': '{{apiKey}}'
            }
          },
          capabilities: {
            supportsSystemMessages: true,
            maxContextLength: 200000,
            supportedRoles: ['user', 'assistant'],
            supportsStreaming: true,
            supportsTools: true,
            supportedAuthMethods: ['api_key']
          }
        }
        // Add more provider configurations as needed
      };

      const providerConfig = providerConfigs[legacyType];
      if (!providerConfig) {
        logger.warn('No migration configuration available for provider type', { legacyType });
        return null;
      }

      // Define model configurations for each provider
      const modelConfigs = await this.getModelConfigsForProvider(legacyType);

      return {
        legacyType,
        providerConfig,
        modelConfigs,
        connectionCount
      };

    } catch (error) {
      logger.error('Failed to create provider spec', { legacyType, error });
      return null;
    }
  }

  /**
   * Get model configurations for a provider type
   */
  private async getModelConfigsForProvider(providerType: string): Promise<CreateModelRequest[]> {
    const modelConfigs: Record<string, CreateModelRequest[]> = {
      openai: [
        {
          identifier: 'gpt-4',
          name: 'GPT-4',
          description: 'OpenAI GPT-4 model',
          contextLength: 8192,
          capabilities: {
            supportsSystemMessages: true,
            maxContextLength: 8192,
            supportedRoles: ['system', 'user', 'assistant'],
            supportsStreaming: true,
            supportsTools: true,
            supportsFunctionCalling: true
          },
          isDefault: true
        },
        {
          identifier: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          description: 'OpenAI GPT-3.5 Turbo model',
          contextLength: 4096,
          capabilities: {
            supportsSystemMessages: true,
            maxContextLength: 4096,
            supportedRoles: ['system', 'user', 'assistant'],
            supportsStreaming: true,
            supportsTools: true,
            supportsFunctionCalling: true
          }
        }
      ],
      anthropic: [
        {
          identifier: 'claude-3-opus-20240229',
          name: 'Claude 3 Opus',
          description: 'Anthropic Claude 3 Opus model',
          contextLength: 200000,
          capabilities: {
            supportsSystemMessages: true,
            maxContextLength: 200000,
            supportedRoles: ['user', 'assistant'],
            supportsStreaming: true,
            supportsTools: true,
            supportsFunctionCalling: true
          },
          isDefault: true
        },
        {
          identifier: 'claude-3-sonnet-20240229',
          name: 'Claude 3 Sonnet',
          description: 'Anthropic Claude 3 Sonnet model',
          contextLength: 200000,
          capabilities: {
            supportsSystemMessages: true,
            maxContextLength: 200000,
            supportedRoles: ['user', 'assistant'],
            supportsStreaming: true,
            supportsTools: true,
            supportsFunctionCalling: true
          }
        }
      ]
    };

    return modelConfigs[providerType] || [];
  }

  /**
   * Create model migration specifications
   */
  private async createModelSpecs(
    connections: LegacyConnection[],
    providerSpecs: ProviderMigrationSpec[]
  ): Promise<ModelMigrationSpec[]> {
    const specs: ModelMigrationSpec[] = [];

    for (const providerSpec of providerSpecs) {
      for (const modelConfig of providerSpec.modelConfigs) {
        const connectionCount = connections.filter(c => c.type === providerSpec.legacyType).length;
        
        specs.push({
          legacyModelId: modelConfig.identifier,
          modelConfig,
          providerId: '', // Will be filled during migration
          connectionCount
        });
      }
    }

    return specs;
  }

  /**
   * Analyze migration risks
   */
  private async analyzeRisks(
    connections: LegacyConnection[],
    providerSpecs: ProviderMigrationSpec[]
  ): Promise<MigrationRisk[]> {
    const risks: MigrationRisk[] = [];

    // Check for unsupported provider types
    const supportedTypes = providerSpecs.map(spec => spec.legacyType);
    const unsupportedConnections = connections.filter(c => !supportedTypes.includes(c.type));
    
    if (unsupportedConnections.length > 0) {
      risks.push({
        type: 'compatibility',
        severity: 'high',
        description: `${unsupportedConnections.length} connections use unsupported provider types`,
        mitigation: 'Create custom provider configurations or update connection types',
        affectedConnections: unsupportedConnections.map(c => c.id)
      });
    }

    // Check for configuration issues
    const invalidConfigConnections = connections.filter(c => 
      !c.config || Object.keys(c.config).length === 0
    );
    
    if (invalidConfigConnections.length > 0) {
      risks.push({
        type: 'configuration',
        severity: 'medium',
        description: `${invalidConfigConnections.length} connections have invalid or missing configurations`,
        mitigation: 'Review and fix connection configurations before migration',
        affectedConnections: invalidConfigConnections.map(c => c.id)
      });
    }

    // Check for performance impact
    if (connections.length > 100) {
      risks.push({
        type: 'performance',
        severity: 'medium',
        description: 'Large number of connections may impact migration performance',
        mitigation: 'Consider migrating in smaller batches or during off-peak hours',
        affectedConnections: []
      });
    }

    return risks;
  }

  /**
   * Estimate migration duration
   */
  private estimateMigrationDuration(connectionCount: number): number {
    // Estimate 2 seconds per connection plus overhead
    const baseTime = 60000; // 1 minute base time
    const perConnectionTime = 2000; // 2 seconds per connection
    
    return baseTime + (connectionCount * perConnectionTime);
  }

  /**
   * Create provider from specification
   */
  private async createProvider(spec: ProviderMigrationSpec): Promise<string> {
    try {
      const providerService = getDynamicProviderService();
      const provider = await providerService.createProvider(spec.providerConfig);
      return provider.id;
    } catch (error) {
      logger.error('Failed to create provider during migration', { spec, error });
      throw error;
    }
  }

  /**
   * Create model from specification
   */
  private async createModel(providerId: string, spec: CreateModelRequest): Promise<string> {
    try {
      const providerService = getDynamicProviderService();
      const model = await providerService.createModel(providerId, spec);
      return model.id;
    } catch (error) {
      logger.error('Failed to create model during migration', { providerId, spec, error });
      throw error;
    }
  }

  /**
   * Migrate single connection
   */
  private async migrateConnection(
    connection: LegacyConnection, 
    plan: MigrationPlan
  ): Promise<void> {
    try {
      const db = getDatabaseService();
      
      // Find the corresponding provider spec
      const providerSpec = plan.requiredProviders.find(spec => spec.legacyType === connection.type);
      if (!providerSpec) {
        throw new Error(`No provider spec found for connection type: ${connection.type}`);
      }

      // Find the dynamic provider
      const providerService = getDynamicProviderService();
      const providersResult = await providerService.getProviders();
      const dynamicProvider = providersResult.providers.find((p: any) => p.identifier === providerSpec.providerConfig.identifier);
      
      if (!dynamicProvider) {
        throw new Error(`Dynamic provider not found: ${providerSpec.providerConfig.identifier}`);
      }

      // Update connection to reference dynamic provider
      await db.query(`
        UPDATE connections 
        SET 
          dynamic_provider_id = $1,
          migrated_to_dynamic = true,
          migration_date = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `, [dynamicProvider.id, connection.id]);

      logger.debug('Connection migrated successfully', { 
        connectionId: connection.id, 
        providerId: dynamicProvider.id 
      });

    } catch (error) {
      logger.error('Failed to migrate connection', { connectionId: connection.id, error });
      throw error;
    }
  }

  /**
   * Create batches for processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Update migration progress
   */
  private async updateProgress(
    planId: string, 
    phase: MigrationProgress['phase'], 
    progress: number, 
    message: string
  ): Promise<void> {
    const migrationProgress = this.activeMigrations.get(planId);
    if (migrationProgress) {
      migrationProgress.phase = phase;
      migrationProgress.progress = progress;
      migrationProgress.message = message;
      
      this.emit('migration_progress', migrationProgress);
    }
  }

  /**
   * Validate migration plan
   */
  private async validateMigrationPlan(plan: MigrationPlan): Promise<void> {
    // Check if required providers can be created
    for (const providerSpec of plan.requiredProviders) {
      // Validate provider configuration
      if (!providerSpec.providerConfig.identifier || !providerSpec.providerConfig.name) {
        throw new Error(`Invalid provider configuration for ${providerSpec.legacyType}`);
      }
    }

    // Check for high-risk issues
    const criticalRisks = plan.risks.filter(risk => risk.severity === 'critical');
    if (criticalRisks.length > 0) {
      throw new Error(`Migration blocked by critical risks: ${criticalRisks.map(r => r.description).join(', ')}`);
    }
  }

  /**
   * Create backup
   */
  private async createBackup(planId: string): Promise<RollbackInfo> {
    try {
      const db = getDatabaseService();
      const backupId = this.generateId();
      
      // Create backup of connections table
      await db.query(`
        CREATE TABLE connections_backup_${backupId} AS 
        SELECT * FROM connections 
        WHERE migrated_to_dynamic = false OR migrated_to_dynamic IS NULL
      `);

      const rollbackInfo: RollbackInfo = {
        backupId,
        backupPath: `connections_backup_${backupId}`,
        createdAt: new Date(),
        canRollback: true
      };

      // Save rollback info
      await db.query(`
        INSERT INTO migration_backups (plan_id, backup_id, backup_path, created_at)
        VALUES ($1, $2, $3, $4)
      `, [planId, backupId, rollbackInfo.backupPath, rollbackInfo.createdAt]);

      return rollbackInfo;

    } catch (error) {
      logger.error('Failed to create backup', { planId, error });
      throw error;
    }
  }

  /**
   * Verify migration
   */
  private async verifyMigration(plan: MigrationPlan, result: MigrationResult): Promise<void> {
    try {
      const db = getDatabaseService();
      
      // Check that connections were migrated
      const migratedResult = await db.query(`
        SELECT COUNT(*) as migrated_count
        FROM connections 
        WHERE migrated_to_dynamic = true
      `);

      const migratedCount = parseInt(migratedResult.rows[0].migrated_count);
      
      if (migratedCount !== result.migratedConnections) {
        result.warnings.push({
          connectionId: 'N/A',
          warning: `Migrated count mismatch: expected ${result.migratedConnections}, found ${migratedCount}`
        });
      }

      // Verify created providers exist
      const providerService = getDynamicProviderService();
      for (const providerId of result.createdProviders) {
        try {
          await providerService.getProvider(providerId);
        } catch (error) {
          result.warnings.push({
            connectionId: 'N/A',
            warning: `Created provider not found: ${providerId}`
          });
        }
      }

    } catch (error) {
      logger.error('Migration verification failed', { planId: plan.id, error });
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  private async restoreFromBackup(rollbackInfo: RollbackInfo): Promise<void> {
    try {
      const db = getDatabaseService();
      
      // Restore connections from backup
      await db.query(`
        INSERT INTO connections 
        SELECT * FROM ${rollbackInfo.backupPath}
        ON CONFLICT (id) DO UPDATE SET
          dynamic_provider_id = EXCLUDED.dynamic_provider_id,
          migrated_to_dynamic = EXCLUDED.migrated_to_dynamic,
          migration_date = EXCLUDED.migration_date,
          updated_at = EXCLUDED.updated_at
      `);

      // Clean up backup table
      await db.query(`DROP TABLE IF EXISTS ${rollbackInfo.backupPath}`);

    } catch (error) {
      logger.error('Failed to restore from backup', { rollbackInfo, error });
      throw error;
    }
  }

  /**
   * Cleanup created resources
   */
  private async cleanupCreatedResources(result: MigrationResult): Promise<void> {
    try {
      const providerService = getDynamicProviderService();
      
      // Remove created models
      for (const modelId of result.createdModels) {
        try {
          await providerService.deleteModel(modelId);
        } catch (error) {
          logger.warn('Failed to cleanup model during rollback', { modelId, error });
        }
      }

      // Remove created providers
      for (const providerId of result.createdProviders) {
        try {
          await providerService.deleteProvider(providerId);
        } catch (error) {
          logger.warn('Failed to cleanup provider during rollback', { providerId, error });
        }
      }

    } catch (error) {
      logger.error('Failed to cleanup created resources', error);
      throw error;
    }
  }

  /**
   * Save migration plan to database
   */
  private async saveMigrationPlan(plan: MigrationPlan): Promise<void> {
    try {
      const db = getDatabaseService();
      await db.query(`
        INSERT INTO migration_plans 
        (id, total_connections, connections_by_provider, required_providers, required_models, estimated_duration, risks, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        plan.id,
        plan.totalConnections,
        JSON.stringify(plan.connectionsByProvider),
        JSON.stringify(plan.requiredProviders),
        JSON.stringify(plan.requiredModels),
        plan.estimatedDuration,
        JSON.stringify(plan.risks),
        plan.createdAt
      ]);
    } catch (error) {
      logger.error('Failed to save migration plan', { planId: plan.id, error });
      throw error;
    }
  }

  /**
   * Load migration plan from database
   */
  private async loadMigrationPlan(planId: string): Promise<MigrationPlan | null> {
    try {
      const db = getDatabaseService();
      const result = await db.query(`
        SELECT * FROM migration_plans WHERE id = $1
      `, [planId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        totalConnections: row.total_connections,
        connectionsByProvider: JSON.parse(row.connections_by_provider),
        requiredProviders: JSON.parse(row.required_providers),
        requiredModels: JSON.parse(row.required_models),
        estimatedDuration: row.estimated_duration,
        risks: JSON.parse(row.risks),
        createdAt: row.created_at
      };

    } catch (error) {
      logger.error('Failed to load migration plan', { planId, error });
      throw error;
    }
  }

  /**
   * Load migration result from database
   */
  private async loadMigrationResult(planId: string): Promise<MigrationResult | null> {
    try {
      const db = getDatabaseService();
      const result = await db.query(`
        SELECT * FROM migration_results WHERE plan_id = $1
      `, [planId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        planId: row.plan_id,
        success: row.success,
        migratedConnections: row.migrated_connections,
        failedConnections: row.failed_connections,
        createdProviders: JSON.parse(row.created_providers),
        createdModels: JSON.parse(row.created_models),
        errors: JSON.parse(row.errors),
        warnings: JSON.parse(row.warnings),
        duration: row.duration,
        rollbackInfo: row.rollback_info ? JSON.parse(row.rollback_info) : undefined
      };

    } catch (error) {
      logger.error('Failed to load migration result', { planId, error });
      throw error;
    }
  }

  /**
   * Initialize database tables for migration utilities
   */
  async initializeTables(): Promise<void> {
    const db = getDatabaseService();

    // Migration plans table
    await db.query(`
      CREATE TABLE IF NOT EXISTS migration_plans (
        id VARCHAR(255) PRIMARY KEY,
        total_connections INTEGER NOT NULL,
        connections_by_provider JSONB NOT NULL,
        required_providers JSONB NOT NULL,
        required_models JSONB NOT NULL,
        estimated_duration INTEGER NOT NULL,
        risks JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `);

    // Migration results table
    await db.query(`
      CREATE TABLE IF NOT EXISTS migration_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id VARCHAR(255) NOT NULL REFERENCES migration_plans(id),
        success BOOLEAN NOT NULL,
        migrated_connections INTEGER NOT NULL DEFAULT 0,
        failed_connections INTEGER NOT NULL DEFAULT 0,
        created_providers JSONB NOT NULL DEFAULT '[]',
        created_models JSONB NOT NULL DEFAULT '[]',
        errors JSONB NOT NULL DEFAULT '[]',
        warnings JSONB NOT NULL DEFAULT '[]',
        duration INTEGER NOT NULL DEFAULT 0,
        rollback_info JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration backups table
    await db.query(`
      CREATE TABLE IF NOT EXISTS migration_backups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id VARCHAR(255) NOT NULL,
        backup_id VARCHAR(255) NOT NULL,
        backup_path VARCHAR(500) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `);

    // Add migration columns to connections table if they don't exist
    await db.query(`
      ALTER TABLE connections 
      ADD COLUMN IF NOT EXISTS dynamic_provider_id UUID REFERENCES providers(id),
      ADD COLUMN IF NOT EXISTS migrated_to_dynamic BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS migration_date TIMESTAMP WITH TIME ZONE
    `);

    // Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_migration_plans_created_at 
      ON migration_plans(created_at)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_migration_results_plan_id 
      ON migration_results(plan_id)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_connections_migrated 
      ON connections(migrated_to_dynamic)
    `);

    logger.info('Migration utilities database tables initialized');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
let migrationUtilitiesService: ProviderMigrationUtilitiesService | null = null;

/**
 * Get the singleton instance of the migration utilities service
 */
export function getProviderMigrationUtilitiesService(
  config?: Partial<MigrationConfig>
): ProviderMigrationUtilitiesService {
  if (!migrationUtilitiesService) {
    migrationUtilitiesService = new ProviderMigrationUtilitiesService(config);
  }
  return migrationUtilitiesService;
}