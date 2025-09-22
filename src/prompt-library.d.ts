import { PromptManager } from './services/prompt-manager';
import { EnhancementAgent } from './services/enhancement-agent';
import { VariableManager } from './services/variable-manager';
import { RatingSystem } from './services/rating-system';
import { ProviderRegistry } from './adapters/provider-registry';
import { IntegratedStorage } from './storage/integrated-storage';
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
export declare class PromptLibrary {
    private config;
    private promptManager?;
    private enhancementAgent?;
    private variableManager?;
    private ratingSystem?;
    private providerRegistry?;
    private integratedStorage?;
    private versionManager?;
    private llmService?;
    private isInitialized;
    private initializationError?;
    private shutdownHandlers;
    private isShuttingDown;
    constructor(config: PromptLibraryConfig);
    initialize(): Promise<void>;
    /**
     * Initialize storage layer with optional database integration
     */
    private initializeStorage;
    /**
     * Initialize optional database integration
     */
    private initializeDatabaseIntegration;
    /**
     * Initialize LLM service for enhancement
     */
    private initializeLLMService;
    /**
     * Initialize provider registry and register adapters with configuration-based filtering
     */
    private initializeProviderRegistry;
    /**
     * Initialize version manager
     */
    private initializeVersionManager;
    /**
     * Initialize rating system
     */
    private initializeRatingSystem;
    /**
     * Initialize variable manager
     */
    private initializeVariableManager;
    /**
     * Initialize enhancement agent
     */
    private initializeEnhancementAgent;
    /**
     * Initialize prompt manager (main orchestrator)
     */
    private initializePromptManager;
    /**
     * Validate configuration parameters comprehensively
     */
    private validateConfig;
    /**
     * Cleanup partially initialized services
     */
    private cleanup;
    /**
     * Graceful shutdown of all services
     */
    shutdown(): Promise<void>;
    /**
     * Setup process signal handlers for graceful shutdown
     */
    setupGracefulShutdown(): void;
    /**
     * Get all services (for advanced usage)
     */
    getServices(): PromptLibraryServices;
    /**
     * Check if library is initialized
     */
    get initialized(): boolean;
    /**
     * Get comprehensive initialization status and health information
     */
    getStatus(): Promise<{
        initialized: boolean;
        shuttingDown: boolean;
        services: {
            storage: {
                initialized: boolean;
                healthy: boolean;
                error?: string;
            };
            llmService: {
                initialized: boolean;
                healthy: boolean;
                error?: string;
            };
            providerRegistry: {
                initialized: boolean;
                healthy: boolean;
                error?: string;
            };
            ratingSystem: {
                initialized: boolean;
                healthy: boolean;
                error?: string;
            };
            variableManager: {
                initialized: boolean;
                healthy: boolean;
                error?: string;
            };
            enhancementAgent: {
                initialized: boolean;
                healthy: boolean;
                error?: string;
            };
            promptManager: {
                initialized: boolean;
                healthy: boolean;
                error?: string;
            };
        };
        providers: Array<{
            id: string;
            name: string;
            healthy: boolean;
        }>;
        config: {
            storageDir: string;
            enableCache: boolean;
            enableFileWatcher: boolean;
            databaseEnabled: boolean;
            llmProvider?: string;
        };
        storageStats?: any;
        initializationError?: string;
    }>;
    /**
     * Check health of individual service
     */
    private checkServiceHealth;
    /**
     * Check health of all registered providers
     */
    private checkProviderHealth;
    /**
     * Validate service dependencies before initialization
     */
    private validateServiceDependencies;
    /**
     * Compare version strings
     */
    private compareVersions;
    /**
     * Validate that all services are properly initialized and working
     */
    private validateInitialization;
    get prompts(): PromptManager;
    get enhancement(): EnhancementAgent;
    get variables(): VariableManager;
    get ratings(): RatingSystem;
    get providers(): ProviderRegistry;
    get storage(): IntegratedStorage;
}
//# sourceMappingURL=prompt-library.d.ts.map