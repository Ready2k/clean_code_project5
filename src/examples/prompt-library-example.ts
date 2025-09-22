// Example usage of the PromptLibrary main application class

import { PromptLibrary, PromptLibraryConfig } from '../prompt-library';
import { HumanPrompt } from '../models/prompt';

/**
 * Example demonstrating how to use the PromptLibrary
 */
export async function promptLibraryExample() {
  // Configure the library
  const config: PromptLibraryConfig = {
    storageDir: './example-data',
    enableCache: true,
    enableFileWatcher: true,
    llmService: {
      provider: 'mock', // Use mock for example
      model: 'test-model'
    },
    providers: {
      enabled: ['openai', 'anthropic'], // Only enable specific providers
      disabled: []
    },
    performance: {
      cacheSize: 100,
      maxConcurrentOperations: 5
    },
    logging: {
      level: 'info'
    }
  };

  // Create and initialize the library
  const library = new PromptLibrary(config);
  
  try {
    console.log('Initializing Prompt Library...');
    await library.initialize();

    // Get status to verify initialization
    const status = await library.getStatus();
    console.log('Library Status:', {
      initialized: status.initialized,
      providers: status.providers.map(p => p.id),
      services: Object.entries(status.services)
        .filter(([_, service]) => service.initialized)
        .map(([name]) => name)
    });

    // Create a human prompt
    const humanPrompt: HumanPrompt = {
      goal: 'Create a professional email response',
      audience: 'Business professionals',
      steps: [
        'Acknowledge the sender\'s message',
        'Provide a clear and helpful response',
        'Include next steps if applicable',
        'End with a professional closing'
      ],
      output_expectations: {
        format: 'Email format with subject and body',
        fields: ['subject', 'greeting', 'body', 'closing', 'signature']
      }
    };

    // Create a prompt in the library
    console.log('Creating prompt...');
    const prompt = await library.prompts.createPrompt(humanPrompt, {
      title: 'Professional Email Response Template',
      summary: 'A template for creating professional email responses',
      tags: ['email', 'business', 'communication'],
      owner: 'example-user'
    });

    console.log('Created prompt:', prompt.id);

    // Enhance the prompt
    console.log('Enhancing prompt...');
    const enhancementResult = await library.prompts.enhancePrompt(prompt.id);
    console.log('Enhancement completed with confidence:', enhancementResult.confidence);

    // List available providers
    const providers = library.providers.listProviders();
    console.log('Available providers:', providers.map(p => p.name));

    // Render the prompt for OpenAI (if enabled)
    if (providers.some(p => p.id === 'openai')) {
      console.log('Rendering prompt for OpenAI...');
      const rendered = await library.prompts.renderPrompt(prompt.id, 'openai', {
        model: 'gpt-4',
        temperature: 0.7,
        variables: {
          sender_name: 'John Smith',
          original_message: 'Thank you for your inquiry about our services.',
          response_type: 'informative'
        }
      });
      console.log('Rendered successfully for model:', rendered.model);
    }

    // Export the prompt using ExportService
    console.log('Exporting prompt...');
    const { ExportService } = await import('../services/export-service');
    const exportService = new ExportService(library.providers);
    const enhancedPrompt = await library.prompts.getPrompt(prompt.id);
    const exported = await exportService.exportPrompt(enhancedPrompt, {
      provider: 'openai',
      model: 'gpt-4',
      variables: {
        sender_name: '{{sender_name}}',
        original_message: '{{original_message}}',
        response_type: '{{response_type}}'
      }
    });
    console.log('Exported to file:', exported.filename);

    // Get service statistics
    const stats = await library.getStatus();
    if (stats.storageStats) {
      console.log('Storage stats:', {
        totalPrompts: stats.storageStats.prompts.total,
        providers: stats.storageStats.providers.total
      });
    }

    console.log('Example completed successfully!');

  } catch (error) {
    console.error('Example failed:', error);
  } finally {
    // Always shutdown gracefully
    console.log('Shutting down...');
    await library.shutdown();
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  promptLibraryExample().catch(console.error);
}