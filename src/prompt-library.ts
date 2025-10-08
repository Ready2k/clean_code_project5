// Main Prompt Library application class

import { PromptManager } from './services/prompt-manager';
import { EnhancementAgent, EnhancementAgentImpl, LLMService } from './services/enhancement-agent';
import { VariableManager } from './services/variable-manager';
import { RatingSystem } from './services/rating-system';
import { ProviderRegistry } from './adapters/provider-registry';
import { FileSystemPromptManager } from './services/filesystem-prompt-manager';
import { FileRatingSystem } from './services/file-rating-system';
import { ConcreteProviderRegistry } from './adapters/concrete-provider-registry';
import { IntegratedStorage, FileSystemIntegratedStorage } from './storage/integrated-storage';
import { PromptVersionManager } from './services/version-manager';
import { MockLLMService } from './services/mock-llm-service';
import { OpenAIAdapter } from './adapters/openai-adapter';
import { AnthropicAdapter } from './adapters/anthropic-adapter';
import { MetaAdapter } from './adapters/meta-adapter';
import { MicrosoftCopilotAdapter } from './adapters/microsoft-copilot-adapter';

export interface PromptLibraryConfig {
  storageDir: string;
  enableCache: boolean;
  enableFileWatcher: boolean;
  llmService?: {
    provider: 'openai' | 'anthropic' | 'mock';
    apiKey?: string;
    model: string;
    baseUrl?: string;
    timeout?: number;
  };
  database?: {
    enabled: boolean;
    connectionString: string;
    maxConnections?: number;
    timeout?: number;
  };
  providers?: {
    enabled: string[];
    disabled: string[];
    customAdapters?: any[];
  };
  performance?: {
    cacheSize?: number;
    indexRebuildInterval?: number;
    maxConcurrentOperations?: number;
  };
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableFileLogging?: boolean;
    logDir?: string;
  };
}

export interface PromptLibraryServices {
  promptManager: PromptManager;
  enhancementAgent: EnhancementAgent;
  variableManager: VariableManager;
  ratingSystem: RatingSystem;
  providerRegistry: ProviderRegistry;
  storage: IntegratedStorage;
}

// Main application class
export class PromptLibrary {
  private promptManager?: PromptManager;
  private enhancementAgent?: EnhancementAgent;
  private variableManager?: VariableManager;
  private ratingSystem?: RatingSystem;
  private providerRegistry?: ProviderRegistry;
  private integratedStorage?: IntegratedStorage;
  private versionManager?: PromptVersionManager;
  private llmService?: LLMService;
  private isInitialized: boolean = false;
  private initializationError?: Error;
  private shutdownHandlers: Array<() => Promise<void>> = [];
  private isShuttingDown: boolean = false;

  constructor(private config: PromptLibraryConfig) {
    this.validateConfig(config);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationError) {
      throw this.initializationError;
    }

    try {
      console.log(`Initializing Prompt Library with storage dir: ${this.config.storageDir}`);
      
      // Validate system dependencies
      this.validateServiceDependencies();
      
      // Initialize core services in dependency order
      await this.initializeStorage();
      await this.initializeLLMService();
      await this.initializeProviderRegistry();
      await this.initializeVersionManager();
      await this.initializeRatingSystem();
      await this.initializeVariableManager();
      await this.initializeEnhancementAgent();
      await this.initializePromptManager();

      // Perform post-initialization validation
      await this.validateInitialization();

      this.isInitialized = true;
      console.log('Prompt Library initialization completed successfully');
    } catch (error) {
      this.initializationError = error instanceof Error ? error : new Error('Unknown initialization error');
      console.error('Prompt Library initialization failed:', this.initializationError);
      
      // Cleanup any partially initialized services
      await this.cleanup();
      
      throw this.initializationError;
    }
  }

  /**
   * Initialize storage layer with optional database integration
   */
  private async initializeStorage(): Promise<void> {
    console.log('Initializing storage...');
    
    // Create storage directory if it doesn't exist
    try {
      const fs = require('fs/promises');
      await fs.mkdir(this.config.storageDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create storage directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    this.integratedStorage = new FileSystemIntegratedStorage(
      this.config.storageDir,
      this.config.enableFileWatcher
    );

    // Add shutdown handler for storage
    this.shutdownHandlers.push(async () => {
      if (this.integratedStorage) {
        console.log('Shutting down storage...');
        await this.integratedStorage.shutdown();
      }
    });

    await this.integratedStorage.initialize();

    // Initialize database integration if enabled
    if (this.config.database?.enabled) {
      await this.initializeDatabaseIntegration();
    }
  }

  /**
   * Initialize optional database integration
   */
  private async initializeDatabaseIntegration(): Promise<void> {
    console.log('Initializing database integration...');
    
    if (!this.config.database?.connectionString) {
      throw new Error('Database connection string is required');
    }

    try {
      // Database integration not implemented in core library
      // The web interface uses its own database layer
      console.log('Database integration not implemented in core library');
      console.log(`Database config present but unused in core library`);
      
      // Add placeholder shutdown handler
      this.shutdownHandlers.push(async () => {
        console.log('Database shutdown - no connections to close in core library');
      });
      
    } catch (error) {
      throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Initialize LLM service for enhancement
   */
  private async initializeLLMService(): Promise<void> {
    console.log('Initializing LLM service...');
    
    if (this.config.llmService) {
      // Real LLM service not implemented in core library
      // The web interface uses its own LLM execution service
      console.warn('Real LLM service not implemented in core library, using mock service');
    }
    
    this.llmService = new MockLLMService();
    
    // Verify service is available
    const isAvailable = await this.llmService.isAvailable();
    if (!isAvailable) {
      throw new Error('LLM service is not available');
    }
  }

  /**
   * Initialize provider registry and register adapters with configuration-based filtering
   */
  private async initializeProviderRegistry(): Promise<void> {
    console.log('Initializing provider registry...');
    this.providerRegistry = new ConcreteProviderRegistry();
    
    // Built-in adapters (microsoft-copilot is registered only when explicitly enabled)
    const builtInAdapters: { id: string; adapter: any }[] = [
      { id: 'openai', adapter: new OpenAIAdapter() },
      { id: 'anthropic', adapter: new AnthropicAdapter() },
      { id: 'meta', adapter: new MetaAdapter() }
    ];

    // Conditionally include Microsoft Copilot if explicitly enabled
    if (this.config.providers?.enabled && this.config.providers.enabled.includes('microsoft-copilot')) {
      builtInAdapters.push({ id: 'microsoft-copilot', adapter: new MicrosoftCopilotAdapter() });
    }

    // Filter adapters based on configuration
    const enabledProviders = this.config.providers?.enabled;
    const disabledProviders = new Set(this.config.providers?.disabled || []);

    for (const { id, adapter } of builtInAdapters) {
      // Skip if explicitly disabled
      if (disabledProviders.has(id)) {
        console.log(`Skipping disabled provider: ${id}`);
        continue;
      }

      // If enabled list is specified, only register those
      if (enabledProviders && !enabledProviders.includes(id)) {
        console.log(`Skipping non-enabled provider: ${id}`);
        continue;
      }

      try {
        this.providerRegistry.registerAdapter(adapter);
        console.log(`Registered provider adapter: ${id}`);
      } catch (error) {
        console.warn(`Failed to register provider adapter ${id}:`, error);
      }
    }

    // Register custom adapters if provided
    if (this.config.providers?.customAdapters) {
      for (const customAdapter of this.config.providers.customAdapters) {
        try {
          this.providerRegistry.registerAdapter(customAdapter);
          console.log(`Registered custom provider adapter: ${customAdapter.id}`);
        } catch (error) {
          console.warn(`Failed to register custom provider adapter:`, error);
        }
      }
    }

    const registeredCount = this.providerRegistry.listProviders().length;
    if (registeredCount === 0) {
      throw new Error('No provider adapters were successfully registered');
    }

    console.log(`Successfully registered ${registeredCount} provider adapters`);
  }

  /**
   * Initialize version manager
   */
  private async initializeVersionManager(): Promise<void> {
    console.log('Initializing version manager...');
    this.versionManager = new PromptVersionManager();
  }

  /**
   * Initialize rating system
   */
  private async initializeRatingSystem(): Promise<void> {
    console.log('Initializing rating system...');
    this.ratingSystem = new FileRatingSystem(this.config.storageDir);
    if ('initialize' in this.ratingSystem && typeof (this.ratingSystem as any).initialize === 'function') {
      await (this.ratingSystem as any).initialize();
    }
  }

  /**
   * Initialize variable manager
   */
  private async initializeVariableManager(): Promise<void> {
    console.log('Initializing variable manager...');
    // Variable manager doesn't need answer storage for basic functionality
    this.variableManager = new VariableManager();
  }

  /**
   * Initialize enhancement agent
   */
  private async initializeEnhancementAgent(): Promise<void> {
    console.log('Initializing enhancement agent...');
    if (!this.llmService) {
      throw new Error('LLM service must be initialized before enhancement agent');
    }
    this.enhancementAgent = new EnhancementAgentImpl(this.llmService);
  }

  /**
   * Initialize prompt manager (main orchestrator)
   */
  private async initializePromptManager(): Promise<void> {
    console.log('Initializing prompt manager...');
    
    if (!this.integratedStorage || !this.enhancementAgent || !this.variableManager || 
        !this.ratingSystem || !this.versionManager || !this.providerRegistry) {
      throw new Error('All dependencies must be initialized before prompt manager');
    }

    this.promptManager = new FileSystemPromptManager({
      storage: this.integratedStorage,
      enhancementAgent: this.enhancementAgent,
      variableManager: this.variableManager,
      ratingSystem: this.ratingSystem,
      versionManager: this.versionManager,
      providerRegistry: this.providerRegistry
    });

    if ('initialize' in this.promptManager && typeof (this.promptManager as any).initialize === 'function') {
      await (this.promptManager as any).initialize();
    }
  }

  /**
   * Validate configuration parameters comprehensively
   */
  private validateConfig(config: PromptLibraryConfig): void {
    const errors: string[] = [];

    // Validate required fields
    if (!config.storageDir || config.storageDir.trim().length === 0) {
      errors.push('Storage directory is required');
    }

    if (config.enableCache === undefined) {
      errors.push('enableCache must be specified');
    }

    if (config.enableFileWatcher === undefined) {
      errors.push('enableFileWatcher must be specified');
    }

    // Validate LLM service configuration
    if (config.llmService) {
      if (!config.llmService.provider) {
        errors.push('LLM service provider is required when llmService is specified');
      } else if (!['openai', 'anthropic', 'mock'].includes(config.llmService.provider)) {
        errors.push('LLM service provider must be one of: openai, anthropic, mock');
      }

      if (!config.llmService.model || config.llmService.model.trim().length === 0) {
        errors.push('LLM service model is required when llmService is specified');
      }

      if (config.llmService.provider !== 'mock' && !config.llmService.apiKey) {
        errors.push('API key is required for non-mock LLM providers');
      }

      if (config.llmService.timeout !== undefined && config.llmService.timeout <= 0) {
        errors.push('LLM service timeout must be positive');
      }
    }

    // Validate database configuration
    if (config.database?.enabled) {
      if (!config.database.connectionString || config.database.connectionString.trim().length === 0) {
        errors.push('Database connection string is required when database is enabled');
      }

      if (config.database.maxConnections !== undefined && config.database.maxConnections <= 0) {
        errors.push('Database max connections must be positive');
      }

      if (config.database.timeout !== undefined && config.database.timeout <= 0) {
        errors.push('Database timeout must be positive');
      }
    }

    // Validate provider configuration
    if (config.providers) {
      if (config.providers.enabled && !Array.isArray(config.providers.enabled)) {
        errors.push('providers.enabled must be an array');
      }

      if (config.providers.disabled && !Array.isArray(config.providers.disabled)) {
        errors.push('providers.disabled must be an array');
      }

      if (config.providers.customAdapters && !Array.isArray(config.providers.customAdapters)) {
        errors.push('providers.customAdapters must be an array');
      }

      // Check for conflicts between enabled and disabled
      if (config.providers.enabled && config.providers.disabled) {
        const enabledSet = new Set(config.providers.enabled);
        const disabledSet = new Set(config.providers.disabled);
        const conflicts = [...enabledSet].filter(id => disabledSet.has(id));
        if (conflicts.length > 0) {
          errors.push(`Providers cannot be both enabled and disabled: ${conflicts.join(', ')}`);
        }
      }
    }

    // Validate performance configuration
    if (config.performance) {
      if (config.performance.cacheSize !== undefined && config.performance.cacheSize <= 0) {
        errors.push('Performance cache size must be positive');
      }

      if (config.performance.indexRebuildInterval !== undefined && config.performance.indexRebuildInterval <= 0) {
        errors.push('Performance index rebuild interval must be positive');
      }

      if (config.performance.maxConcurrentOperations !== undefined && config.performance.maxConcurrentOperations <= 0) {
        errors.push('Performance max concurrent operations must be positive');
      }
    }

    // Validate logging configuration
    if (config.logging) {
      if (!['debug', 'info', 'warn', 'error'].includes(config.logging.level)) {
        errors.push('Logging level must be one of: debug, info, warn, error');
      }

      if (config.logging.enableFileLogging && !config.logging.logDir) {
        errors.push('Log directory is required when file logging is enabled');
      }
    }

    // Validate storage directory path
    if (config.storageDir) {
      try {
        // Basic path validation
        const path = require('path');
        const resolved = path.resolve(config.storageDir);
        if (!resolved || resolved.length === 0) {
          errors.push('Invalid storage directory path');
        }
      } catch (error) {
        errors.push('Storage directory path validation failed');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join('; ')}`);
    }
  }

  /**
   * Cleanup partially initialized services
   */
  private async cleanup(): Promise<void> {
    console.log('Cleaning up partially initialized services...');
    
    // Run shutdown handlers in reverse order
    for (const handler of [...this.shutdownHandlers].reverse()) {
      try {
        await handler();
      } catch (error) {
        console.warn('Error during cleanup:', error);
      }
    }
    
    this.shutdownHandlers = [];
  }

  /**
   * Graceful shutdown of all services
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      console.log('Shutdown already in progress...');
      return;
    }

    if (!this.isInitialized) {
      console.log('Library not initialized, nothing to shutdown');
      return;
    }

    this.isShuttingDown = true;
    console.log('Starting graceful shutdown...');

    try {
      // Run all shutdown handlers in reverse order of initialization
      for (const handler of [...this.shutdownHandlers].reverse()) {
        try {
          await handler();
        } catch (error) {
          console.warn('Error during shutdown:', error);
        }
      }

      this.isInitialized = false;
      this.isShuttingDown = false;
      console.log('Graceful shutdown completed');
    } catch (error) {
      console.error('Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Setup process signal handlers for graceful shutdown
   */
  setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    for (const signal of signals) {
      process.on(signal, async () => {
        console.log(`Received ${signal}, starting graceful shutdown...`);
        try {
          await this.shutdown();
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      });
    }

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('Uncaught exception:', error);
      try {
        await this.shutdown();
      } catch (shutdownError) {
        console.error('Error during emergency shutdown:', shutdownError);
      }
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      try {
        await this.shutdown();
      } catch (shutdownError) {
        console.error('Error during emergency shutdown:', shutdownError);
      }
      process.exit(1);
    });
  }

  /**
   * Get all services (for advanced usage)
   */
  getServices(): PromptLibraryServices {
    if (!this.isInitialized) {
      throw new Error('Library not initialized. Call initialize() first.');
    }

    return {
      promptManager: this.promptManager!,
      enhancementAgent: this.enhancementAgent!,
      variableManager: this.variableManager!,
      ratingSystem: this.ratingSystem!,
      providerRegistry: this.providerRegistry!,
      storage: this.integratedStorage!
    };
  }

  /**
   * Check if library is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get comprehensive initialization status and health information
   */
  async getStatus(): Promise<{
    initialized: boolean;
    shuttingDown: boolean;
    services: {
      storage: { initialized: boolean; healthy: boolean; error?: string };
      llmService: { initialized: boolean; healthy: boolean; error?: string };
      providerRegistry: { initialized: boolean; healthy: boolean; error?: string };
      ratingSystem: { initialized: boolean; healthy: boolean; error?: string };
      variableManager: { initialized: boolean; healthy: boolean; error?: string };
      enhancementAgent: { initialized: boolean; healthy: boolean; error?: string };
      promptManager: { initialized: boolean; healthy: boolean; error?: string };
    };
    providers: Array<{ id: string; name: string; healthy: boolean }>;
    config: {
      storageDir: string;
      enableCache: boolean;
      enableFileWatcher: boolean;
      databaseEnabled: boolean;
      llmProvider?: string;
    };
    storageStats?: any;
    initializationError?: string;
  }> {
    const status = {
      initialized: this.isInitialized,
      shuttingDown: this.isShuttingDown,
      services: {
        storage: await this.checkServiceHealth('storage'),
        llmService: await this.checkServiceHealth('llmService'),
        providerRegistry: await this.checkServiceHealth('providerRegistry'),
        ratingSystem: await this.checkServiceHealth('ratingSystem'),
        variableManager: await this.checkServiceHealth('variableManager'),
        enhancementAgent: await this.checkServiceHealth('enhancementAgent'),
        promptManager: await this.checkServiceHealth('promptManager')
      },
      providers: await this.checkProviderHealth(),
      config: {
        storageDir: this.config.storageDir,
        enableCache: this.config.enableCache,
        enableFileWatcher: this.config.enableFileWatcher,
        databaseEnabled: !!this.config.database?.enabled,
        llmProvider: this.config.llmService?.provider
      },
      storageStats: undefined as any,
      initializationError: this.initializationError?.message
    };

    if (this.isInitialized && this.promptManager) {
      try {
        if ('getServiceStats' in this.promptManager && typeof (this.promptManager as any).getServiceStats === 'function') {
          status.storageStats = await (this.promptManager as any).getServiceStats();
        }
      } catch (error) {
        console.warn('Failed to get storage stats:', error);
      }
    }

    return status;
  }

  /**
   * Check health of individual service
   */
  private async checkServiceHealth(serviceName: string): Promise<{ initialized: boolean; healthy: boolean; error?: string }> {
    const service = (this as any)[serviceName];
    const initialized = !!service;
    
    if (!initialized) {
      return { initialized: false, healthy: false };
    }

    try {
      // Perform service-specific health checks
      switch (serviceName) {
        case 'storage':
          // Check if storage can perform basic operations
          await this.integratedStorage!.getStorageInfo();
          break;
        case 'llmService':
          // Check if LLM service is available
          await this.llmService!.isAvailable();
          break;
        case 'providerRegistry':
          // Check if providers are registered
          const providers = this.providerRegistry!.listProviders();
          if (providers.length === 0) {
            throw new Error('No providers registered');
          }
          break;
        case 'ratingSystem':
          // Rating system is always healthy if initialized
          break;
        case 'variableManager':
          // Variable manager is always healthy if initialized
          break;
        case 'enhancementAgent':
          // Enhancement agent is healthy if it has an LLM service
          if (!this.llmService) {
            throw new Error('No LLM service available');
          }
          break;
        case 'promptManager':
          // Check if prompt manager can perform basic operations
          await this.promptManager!.listPrompts();
          break;
      }

      return { initialized: true, healthy: true };
    } catch (error) {
      return { 
        initialized: true, 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Check health of all registered providers
   */
  private async checkProviderHealth(): Promise<Array<{ id: string; name: string; healthy: boolean }>> {
    if (!this.providerRegistry) {
      return [];
    }

    const providers = this.providerRegistry.listProviders();
    const healthChecks = providers.map(async (provider) => {
      try {
        const adapter = this.providerRegistry!.getAdapter(provider.id);
        // Basic health check - ensure adapter has required methods
        const hasRequiredMethods = 
          typeof adapter.render === 'function' &&
          typeof adapter.validate === 'function' &&
          typeof adapter.supports === 'function';
        
        return {
          id: provider.id,
          name: provider.name,
          healthy: hasRequiredMethods
        };
      } catch (error) {
        return {
          id: provider.id,
          name: provider.name,
          healthy: false
        };
      }
    });

    return Promise.all(healthChecks);
  }

  /**
   * Validate service dependencies before initialization
   */
  private validateServiceDependencies(): void {
    // This method can be called before each service initialization
    // to ensure dependencies are met
    
    const requiredNodeVersion = '14.0.0';
    const currentVersion = process.version.slice(1); // Remove 'v' prefix
    
    if (this.compareVersions(currentVersion, requiredNodeVersion) < 0) {
      throw new Error(`Node.js version ${requiredNodeVersion} or higher is required. Current version: ${currentVersion}`);
    }

    // Check for required modules
    const requiredModules = ['fs', 'path', 'crypto'];
    for (const module of requiredModules) {
      try {
        require(module);
      } catch (error) {
        throw new Error(`Required Node.js module '${module}' is not available`);
      }
    }
  }

  /**
   * Compare version strings
   */
  private compareVersions(version1: string, version2: string): number {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part > v2part) return 1;
      if (v1part < v2part) return -1;
    }
    
    return 0;
  }

  /**
   * Validate that all services are properly initialized and working
   */
  private async validateInitialization(): Promise<void> {
    console.log('Validating initialization...');
    
    const errors: string[] = [];

    // Check that all required services are initialized
    if (!this.integratedStorage) errors.push('Storage not initialized');
    if (!this.llmService) errors.push('LLM service not initialized');
    if (!this.providerRegistry) errors.push('Provider registry not initialized');
    if (!this.versionManager) errors.push('Version manager not initialized');
    if (!this.ratingSystem) errors.push('Rating system not initialized');
    if (!this.variableManager) errors.push('Variable manager not initialized');
    if (!this.enhancementAgent) errors.push('Enhancement agent not initialized');
    if (!this.promptManager) errors.push('Prompt manager not initialized');

    if (errors.length > 0) {
      throw new Error(`Initialization validation failed: ${errors.join(', ')}`);
    }

    // Perform basic functionality tests
    try {
      // Test storage
      await this.integratedStorage!.getStorageInfo();
      
      // Test LLM service
      const llmAvailable = await this.llmService!.isAvailable();
      if (!llmAvailable) {
        errors.push('LLM service is not available');
      }
      
      // Test provider registry
      const providers = this.providerRegistry!.listProviders();
      if (providers.length === 0) {
        errors.push('No providers registered');
      }
      
      // Test prompt manager
      await this.promptManager!.listPrompts();
      
    } catch (error) {
      errors.push(`Service functionality test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (errors.length > 0) {
      throw new Error(`Post-initialization validation failed: ${errors.join(', ')}`);
    }

    console.log('Initialization validation completed successfully');
  }

  // Getters for accessing services
  get prompts(): PromptManager {
    if (!this.isInitialized || !this.promptManager) {
      throw new Error('Library not initialized. Call initialize() first.');
    }
    return this.promptManager;
  }

  get enhancement(): EnhancementAgent {
    if (!this.isInitialized || !this.enhancementAgent) {
      throw new Error('Library not initialized. Call initialize() first.');
    }
    return this.enhancementAgent;
  }

  get variables(): VariableManager {
    if (!this.isInitialized || !this.variableManager) {
      throw new Error('Library not initialized. Call initialize() first.');
    }
    return this.variableManager;
  }

  get ratings(): RatingSystem {
    if (!this.isInitialized || !this.ratingSystem) {
      throw new Error('Library not initialized. Call initialize() first.');
    }
    return this.ratingSystem;
  }

  get providers(): ProviderRegistry {
    if (!this.isInitialized || !this.providerRegistry) {
      throw new Error('Library not initialized. Call initialize() first.');
    }
    return this.providerRegistry;
  }

  get storage(): IntegratedStorage {
    if (!this.isInitialized || !this.integratedStorage) {
      throw new Error('Library not initialized. Call initialize() first.');
    }
    return this.integratedStorage;
  }
}