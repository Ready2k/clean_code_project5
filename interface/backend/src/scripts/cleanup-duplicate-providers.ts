/**
 * Cleanup Duplicate Providers Script
 * 
 * Removes duplicate providers that were created by running multiple populate scripts.
 * Keeps the "-basic" providers and removes the system providers without "-basic".
 */

import { getDynamicProviderService } from '../services/dynamic-provider-service.js';
import { initializeDatabaseService } from '../services/database-service.js';
import { logger } from '../utils/logger.js';

async function cleanupDuplicateProviders() {
  try {
    // Initialize database service
    const config = {
      host: process.env['DB_HOST'] || 'localhost',
      port: parseInt(process.env['DB_PORT'] || '5432'),
      database: process.env['DB_NAME'] || 'prompt_library',
      user: process.env['DB_USER'] || 'postgres',
      password: process.env['DB_PASSWORD'] || 'password'
    };
    await initializeDatabaseService(config);
    
    const dynamicProviderService = getDynamicProviderService();
    
    // Get all providers
    const result = await dynamicProviderService.getProviders();
    const providers = result.providers;
    
    logger.info(`Found ${providers.length} providers total`);
    
    // Find duplicates - providers that have both "basic" and non-basic versions
    const duplicatesToRemove: any[] = [];
    const providerNames = new Map();
    
    // Group providers by name
    for (const provider of providers) {
      if (!providerNames.has(provider.name)) {
        providerNames.set(provider.name, []);
      }
      providerNames.get(provider.name).push(provider);
    }
    
    // Find duplicates and mark non-basic ones for removal
    for (const [name, providerList] of providerNames.entries()) {
      if (providerList.length > 1) {
        logger.info(`Found ${providerList.length} providers with name "${name}"`);
        
        // Keep the "-basic" version, remove others
        const basicProvider = providerList.find((p: any) => p.identifier.includes('-basic'));
        const nonBasicProviders = providerList.filter((p: any) => !p.identifier.includes('-basic'));
        
        if (basicProvider && nonBasicProviders.length > 0) {
          logger.info(`Keeping "${basicProvider.identifier}", removing: ${nonBasicProviders.map((p: any) => p.identifier).join(', ')}`);
          duplicatesToRemove.push(...nonBasicProviders);
        }
      }
    }
    
    // Remove duplicates
    logger.info(`Removing ${duplicatesToRemove.length} duplicate providers`);
    
    for (const provider of duplicatesToRemove) {
      try {
        await dynamicProviderService.deleteProvider(provider.id);
        logger.info(`Deleted provider: ${provider.identifier} (${provider.name})`);
      } catch (error) {
        logger.error(`Failed to delete provider ${provider.identifier}:`, error);
      }
    }
    
    // Get final count
    const finalResult = await dynamicProviderService.getProviders();
    logger.info(`Cleanup complete. ${finalResult.providers.length} providers remaining`);
    
    return {
      removed: duplicatesToRemove.length,
      remaining: finalResult.providers.length
    };
    
  } catch (error) {
    logger.error('Failed to cleanup duplicate providers:', error);
    throw error;
  }
}

// Run the cleanup if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDuplicateProviders()
    .then((result) => {
      console.log(`✅ Cleanup completed successfully!`);
      console.log(`   - Removed: ${result.removed} duplicate providers`);
      console.log(`   - Remaining: ${result.remaining} providers`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}

export { cleanupDuplicateProviders };