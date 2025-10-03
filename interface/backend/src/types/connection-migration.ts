/**
 * Connection Migration Utilities and Types
 * 
 * This file contains utilities for migrating legacy connections to dynamic providers
 * and maintaining backward compatibility during the transition.
 */

import { 
  LLMConnection,
  OpenAIConfig,
  BedrockConfig,
  MicrosoftCopilotConfig,
  OPENAI_MODELS,
  BEDROCK_MODELS,
  MICROSOFT_COPILOT_MODELS
} from './connections.js';
import { 
  ExtendedLLMConnection,
  DynamicConnectionConfig,
  ProviderMapping,
  ConnectionMigrationPlan,
  MigrationStep,
  MigrationRisk
} from './extended-connections.js';
import { Provider, Model } from './dynamic-providers.js';

// ============================================================================
// Migration Strategy Types
// ============================================================================

export interface MigrationStrategy {
  name: string;
  description: string;
  phases: MigrationPhase[];
  rollbackSupported: boolean;
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface MigrationPhase {
  name: string;
  description: string;
  steps: string[];
  dependencies: string[];
  rollbackSteps?: string[];
}

// ============================================================================
// Built-in Provider Mappings
// ============================================================================

export const OPENAI_PROVIDER_MAPPING: ProviderMapping = {
  legacyProvider: 'openai',
  dynamicProviderId: 'openai', // Assumes system provider with this ID
  configMapping: [
    {
      legacyField: 'apiKey',
      dynamicField: 'apiKey',
      required: true
    },
    {
      legacyField: 'organizationId',
      dynamicField: 'organizationId',
      required: false
    },
    {
      legacyField: 'baseUrl',
      dynamicField: 'baseUrl',
      required: false
    }
  ],
  modelMapping: OPENAI_MODELS.map(model => ({
    legacyModel: model,
    dynamicModel: model
  }))
};

export const BEDROCK_PROVIDER_MAPPING: ProviderMapping = {
  legacyProvider: 'bedrock',
  dynamicProviderId: 'bedrock',
  configMapping: [
    {
      legacyField: 'accessKeyId',
      dynamicField: 'accessKeyId',
      required: true
    },
    {
      legacyField: 'secretAccessKey',
      dynamicField: 'secretAccessKey',
      required: true
    },
    {
      legacyField: 'region',
      dynamicField: 'region',
      required: true
    }
  ],
  modelMapping: BEDROCK_MODELS.map(model => ({
    legacyModel: model,
    dynamicModel: model
  }))
};

export const MICROSOFT_COPILOT_PROVIDER_MAPPING: ProviderMapping = {
  legacyProvider: 'microsoft-copilot',
  dynamicProviderId: 'microsoft-copilot',
  configMapping: [
    {
      legacyField: 'apiKey',
      dynamicField: 'apiKey',
      required: true
    },
    {
      legacyField: 'endpoint',
      dynamicField: 'endpoint',
      required: true
    },
    {
      legacyField: 'apiVersion',
      dynamicField: 'apiVersion',
      required: false
    },
    {
      legacyField: 'deploymentName',
      dynamicField: 'deploymentName',
      required: false
    }
  ],
  modelMapping: MICROSOFT_COPILOT_MODELS.map(model => ({
    legacyModel: model,
    dynamicModel: model
  }))
};

export const DEFAULT_PROVIDER_MAPPINGS: ProviderMapping[] = [
  OPENAI_PROVIDER_MAPPING,
  BEDROCK_PROVIDER_MAPPING,
  MICROSOFT_COPILOT_PROVIDER_MAPPING
];

// ============================================================================
// Migration Utilities
// ============================================================================

export class ConnectionMigrationUtils {
  /**
   * Convert legacy connection to extended connection format
   */
  static convertLegacyToExtended(legacy: LLMConnection): ExtendedLLMConnection {
    return {
      ...legacy,
      connectionType: 'legacy',
      // Keep existing provider and config for backward compatibility
    };
  }

  /**
   * Create migration plan for a legacy connection
   */
  static createMigrationPlan(
    connection: LLMConnection,
    targetProvider: Provider,
    availableModels: Model[]
  ): ConnectionMigrationPlan {
    const mapping = this.getProviderMapping(connection.provider);
    if (!mapping) {
      throw new Error(`No migration mapping found for provider: ${connection.provider}`);
    }

    const steps: MigrationStep[] = [
      {
        step: 1,
        description: 'Validate current connection configuration',
        action: 'validate',
        estimated: 5,
        reversible: true
      },
      {
        step: 2,
        description: 'Create backup of current connection',
        action: 'backup',
        estimated: 2,
        reversible: true
      },
      {
        step: 3,
        description: 'Convert configuration to dynamic provider format',
        action: 'convert',
        estimated: 3,
        reversible: true
      },
      {
        step: 4,
        description: 'Test new dynamic provider connection',
        action: 'test',
        estimated: 10,
        reversible: true
      },
      {
        step: 5,
        description: 'Activate dynamic provider connection',
        action: 'activate',
        estimated: 2,
        reversible: false
      }
    ];

    const risks: MigrationRisk[] = [
      {
        level: 'low',
        description: 'Configuration mapping may not be 100% compatible',
        mitigation: 'Validate configuration before activation and maintain backup'
      }
    ];

    // Add model-specific risks
    const legacyModels = this.getLegacyModels(connection);
    const unavailableModels = legacyModels.filter(
      legacyModel => !availableModels.some(m => m.identifier === legacyModel)
    );

    if (unavailableModels.length > 0) {
      risks.push({
        level: 'medium',
        description: `Some models may not be available: ${unavailableModels.join(', ')}`,
        mitigation: 'Review and update model selections after migration'
      });
    }

    return {
      connectionId: connection.id,
      currentProvider: connection.provider,
      targetProviderId: targetProvider.id,
      migrationSteps: steps,
      estimatedDuration: steps.reduce((total, step) => total + step.estimated, 0),
      risks
    };
  }

  /**
   * Convert legacy configuration to dynamic configuration
   */
  static convertLegacyConfig(
    legacyConfig: OpenAIConfig | BedrockConfig | MicrosoftCopilotConfig,
    provider: 'openai' | 'bedrock' | 'microsoft-copilot'
  ): DynamicConnectionConfig {
    const mapping = this.getProviderMapping(provider);
    if (!mapping) {
      throw new Error(`No mapping found for provider: ${provider}`);
    }

    const credentials: Record<string, any> = {};
    const settings: Record<string, any> = {};

    // Map configuration fields
    for (const fieldMapping of mapping.configMapping) {
      const legacyValue = (legacyConfig as any)[fieldMapping.legacyField];
      
      if (legacyValue !== undefined) {
        const dynamicValue = fieldMapping.transform 
          ? fieldMapping.transform(legacyValue)
          : legacyValue;
        
        // Determine if field should go in credentials or settings
        if (this.isCredentialField(fieldMapping.dynamicField)) {
          credentials[fieldMapping.dynamicField] = dynamicValue;
        } else {
          settings[fieldMapping.dynamicField] = dynamicValue;
        }
      } else if (fieldMapping.required) {
        throw new Error(`Required field ${fieldMapping.legacyField} is missing`);
      }
    }

    // Map model preferences
    const modelPreferences = {
      preferredModels: (legacyConfig as any).models || [],
      defaultModel: (legacyConfig as any).defaultModel
    };

    return {
      credentials,
      settings: Object.keys(settings).length > 0 ? settings : {},
      modelPreferences
    };
  }

  /**
   * Validate migration compatibility
   */
  static validateMigrationCompatibility(
    connection: LLMConnection,
    targetProvider: Provider,
    availableModels: Model[]
  ): { compatible: boolean; issues: string[]; warnings: string[] } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check if provider mapping exists
    const mapping = this.getProviderMapping(connection.provider);
    if (!mapping) {
      issues.push(`No migration mapping available for provider: ${connection.provider}`);
      return { compatible: false, issues, warnings };
    }

    // Check if target provider matches expected mapping
    if (mapping.dynamicProviderId !== targetProvider.identifier) {
      warnings.push(`Target provider ${targetProvider.identifier} differs from expected ${mapping.dynamicProviderId}`);
    }

    // Validate configuration fields
    try {
      this.convertLegacyConfig(connection.config, connection.provider);
    } catch (error) {
      issues.push(`Configuration conversion failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Check model availability
    const legacyModels = this.getLegacyModels(connection);
    const unavailableModels = legacyModels.filter(
      legacyModel => !availableModels.some(m => m.identifier === legacyModel)
    );

    if (unavailableModels.length > 0) {
      warnings.push(`Some models may not be available: ${unavailableModels.join(', ')}`);
    }

    // Check provider capabilities
    const requiredCapabilities = this.getRequiredCapabilities(connection);
    const missingCapabilities = requiredCapabilities.filter(
      cap => !this.hasCapability(targetProvider, cap)
    );

    if (missingCapabilities.length > 0) {
      issues.push(`Target provider missing required capabilities: ${missingCapabilities.join(', ')}`);
    }

    return {
      compatible: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Get provider mapping for legacy provider
   */
  private static getProviderMapping(provider: 'openai' | 'bedrock' | 'microsoft-copilot'): ProviderMapping | undefined {
    return DEFAULT_PROVIDER_MAPPINGS.find(mapping => mapping.legacyProvider === provider);
  }

  /**
   * Get models from legacy configuration
   */
  private static getLegacyModels(connection: LLMConnection): string[] {
    const config = connection.config as any;
    return config.models || [];
  }

  /**
   * Check if field should be stored as credential
   */
  private static isCredentialField(fieldName: string): boolean {
    const credentialFields = [
      'apiKey', 'accessKeyId', 'secretAccessKey', 'clientSecret', 'token'
    ];
    return credentialFields.some(field => 
      fieldName.toLowerCase().includes(field.toLowerCase())
    );
  }

  /**
   * Get required capabilities for a connection
   */
  private static getRequiredCapabilities(_connection: LLMConnection): string[] {
    // This would analyze the connection usage to determine required capabilities
    // For now, return basic capabilities
    return ['supportsSystemMessages', 'supportsStreaming'];
  }

  /**
   * Check if provider has a specific capability
   */
  private static hasCapability(provider: Provider, capability: string): boolean {
    const capabilities = provider.capabilities as any;
    return capabilities[capability] === true;
  }
}

// ============================================================================
// Migration Strategies
// ============================================================================

export const GRADUAL_MIGRATION_STRATEGY: MigrationStrategy = {
  name: 'Gradual Migration',
  description: 'Migrate connections one by one with full testing and rollback capability',
  phases: [
    {
      name: 'Preparation',
      description: 'Prepare for migration by validating configurations and creating backups',
      steps: [
        'Validate all legacy connections',
        'Create full system backup',
        'Verify dynamic providers are configured',
        'Test migration process with non-critical connections'
      ],
      dependencies: []
    },
    {
      name: 'Migration',
      description: 'Migrate connections in small batches',
      steps: [
        'Select batch of connections to migrate',
        'Create individual backups',
        'Convert configurations',
        'Test new connections',
        'Activate if tests pass'
      ],
      dependencies: ['Preparation'],
      rollbackSteps: [
        'Deactivate dynamic connections',
        'Restore from backup',
        'Verify legacy connections work'
      ]
    },
    {
      name: 'Validation',
      description: 'Validate migrated connections and clean up',
      steps: [
        'Test all migrated connections',
        'Verify functionality with real workloads',
        'Clean up legacy configurations',
        'Update documentation'
      ],
      dependencies: ['Migration']
    }
  ],
  rollbackSupported: true,
  estimatedDuration: 3600, // 1 hour
  riskLevel: 'low'
};

export const BULK_MIGRATION_STRATEGY: MigrationStrategy = {
  name: 'Bulk Migration',
  description: 'Migrate all connections at once for faster transition',
  phases: [
    {
      name: 'Preparation',
      description: 'Prepare for bulk migration',
      steps: [
        'Validate all legacy connections',
        'Create full system backup',
        'Verify all dynamic providers are ready',
        'Schedule maintenance window'
      ],
      dependencies: []
    },
    {
      name: 'Migration',
      description: 'Migrate all connections simultaneously',
      steps: [
        'Put system in maintenance mode',
        'Convert all configurations',
        'Test all new connections',
        'Activate all if tests pass',
        'Exit maintenance mode'
      ],
      dependencies: ['Preparation'],
      rollbackSteps: [
        'Put system in maintenance mode',
        'Restore from full backup',
        'Verify all legacy connections',
        'Exit maintenance mode'
      ]
    }
  ],
  rollbackSupported: true,
  estimatedDuration: 1800, // 30 minutes
  riskLevel: 'medium'
};

// ============================================================================
// Migration Events
// ============================================================================

export interface MigrationEvent {
  type: 'started' | 'progress' | 'completed' | 'failed' | 'rollback';
  connectionId?: string;
  batchId?: string;
  timestamp: Date;
  message: string;
  details?: any;
}

export interface MigrationProgress {
  total: number;
  completed: number;
  failed: number;
  currentStep?: string;
  estimatedTimeRemaining?: number;
  events: MigrationEvent[];
}