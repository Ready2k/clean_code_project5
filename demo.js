#!/usr/bin/env node

// Simple demo script to show how to use the Prompt Library
// Run with: node demo.js

import { PromptLibrary } from './dist/prompt-library.js';
import path from 'path';
import fs from 'fs';

async function runDemo() {
  console.log('🚀 Prompt Library Demo\n');

  // Create a temporary directory for the demo
  const demoDir = path.join(__dirname, 'demo-data');
  if (!fs.existsSync(demoDir)) {
    fs.mkdirSync(demoDir, { recursive: true });
  }

  try {
    // Initialize the Prompt Library
    console.log('1. Initializing Prompt Library...');
    const library = new PromptLibrary({
      storageDir: demoDir,
      enableCache: true,
      enableFileWatcher: false, // Disable for demo
      llmService: {
        provider: 'mock',
        model: 'mock-model'
      },
      providers: {
        enabled: ['openai', 'anthropic', 'meta'],
        disabled: []
      },
      logging: {
        level: 'info'
      }
    });

    await library.initialize();
    console.log('✅ Library initialized successfully!\n');

    // Create a prompt
    console.log('2. Creating a new prompt...');
    const humanPrompt = {
      goal: 'Generate a professional email response',
      audience: 'Business professionals',
      steps: [
        'Analyze the incoming email context',
        'Determine appropriate tone and formality',
        'Craft a clear and concise response',
        'Include relevant call-to-action if needed'
      ],
      output_expectations: {
        format: 'Plain text email',
        fields: ['subject', 'body', 'signature']
      }
    };

    const metadata = {
      title: 'Professional Email Response Generator',
      summary: 'Helps generate professional email responses',
      tags: ['email', 'business', 'communication'],
      owner: 'demo-user'
    };

    const prompt = await library.prompts.createPrompt(humanPrompt, metadata);
    console.log(`✅ Created prompt: ${prompt.metadata.title} (ID: ${prompt.id})\n`);

    // Enhance the prompt
    console.log('3. Enhancing the prompt with AI...');
    const enhancement = await library.prompts.enhancePrompt(prompt.id);
    console.log(`✅ Enhanced prompt with confidence: ${enhancement.confidence}`);
    console.log(`📝 Enhancement rationale: ${enhancement.rationale}\n`);

    // Get the enhanced prompt
    const enhancedPrompt = await library.prompts.getPrompt(prompt.id);
    console.log(`🔧 Generated ${enhancedPrompt.variables.length} variables:`);
    enhancedPrompt.variables.forEach(variable => {
      console.log(`   - ${variable.key}: ${variable.label} (${variable.type})`);
    });
    console.log('');

    // List available providers
    console.log('4. Available AI providers:');
    const providers = library.providers.listProviders();
    providers.forEach(provider => {
      console.log(`   - ${provider.name} (${provider.id})`);
    });
    console.log('');

    // Render for different providers
    console.log('5. Rendering prompt for different providers...');
    const variableValues = enhancedPrompt.variables.reduce((acc, variable) => {
      acc[variable.key] = `demo-${variable.key}`;
      return acc;
    }, {});

    for (const provider of ['openai', 'anthropic', 'meta']) {
      try {
        const rendered = await library.prompts.renderPrompt(prompt.id, provider, {
          model: provider === 'openai' ? 'gpt-3.5-turbo' : 
                provider === 'anthropic' ? 'claude-3-sonnet-20240229' : 
                'llama-2-7b-chat',
          variables: variableValues
        });
        console.log(`✅ Rendered for ${provider}: ${rendered.model}`);
      } catch (error) {
        console.log(`❌ Failed to render for ${provider}: ${error.message}`);
      }
    }
    console.log('');

    // Rate the prompt
    console.log('6. Rating the prompt...');
    await library.ratings.ratePrompt(prompt.id, 'demo-user', {
      user: 'demo-user',
      score: 5,
      note: 'Excellent prompt for email generation!',
      created_at: new Date().toISOString()
    });

    const ratings = await library.ratings.getPromptRatings(prompt.id);
    const averageRating = await library.ratings.getAverageRating(prompt.id);
    console.log(`✅ Added rating: ${ratings.length} rating(s), average: ${averageRating}/5\n`);

    // Show prompt history
    console.log('7. Prompt history:');
    const history = await library.prompts.getPromptHistory(prompt.id);
    history.versions.forEach((version, index) => {
      console.log(`   Version ${version.version}: ${version.message} (${version.author})`);
    });
    console.log('');

    // List all prompts
    console.log('8. All prompts in library:');
    const allPrompts = await library.prompts.listPrompts();
    allPrompts.forEach(p => {
      console.log(`   - ${p.metadata.title} (v${p.version}) - ${p.status}`);
    });
    console.log('');

    // Cleanup
    await library.shutdown();
    console.log('✅ Demo completed successfully!');
    console.log(`📁 Demo data saved in: ${demoDir}`);
    console.log('\n🎉 You can now explore the generated files and use the library in your own projects!');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the demo
runDemo().catch(console.error);