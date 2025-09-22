import { ProviderAdapter } from './provider-adapter';
import { ProviderRegistry } from './provider-registry';
import { ProviderInfo } from '../types/common';
export declare class ConcreteProviderRegistry implements ProviderRegistry {
    private adapters;
    /**
     * Register a new provider adapter
     */
    registerAdapter(adapter: ProviderAdapter): void;
    /**
     * Get a provider adapter by ID
     */
    getAdapter(providerId: string): ProviderAdapter;
    /**
     * List all registered providers
     */
    listProviders(): ProviderInfo[];
    /**
     * Find providers that support a specific model
     */
    supportsModel(model: string): ProviderInfo[];
    /**
     * Check if a provider is registered
     */
    hasProvider(providerId: string): boolean;
    /**
     * Unregister a provider adapter
     */
    unregisterAdapter(providerId: string): void;
    /**
     * Get all adapters
     */
    getAllAdapters(): ProviderAdapter[];
    /**
     * Find the best provider for a given model
     */
    findBestProvider(model: string): ProviderAdapter | null;
    /**
     * Get provider recommendations based on requirements
     */
    getRecommendations(requirements: {
        supportsSystemMessages?: boolean;
        maxContextLength?: number;
        supportedRoles?: string[];
    }): ProviderInfo[];
}
//# sourceMappingURL=concrete-provider-registry.d.ts.map