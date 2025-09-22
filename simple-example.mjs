#!/usr/bin/env node

// Simple working example of the Prompt Library
// Run with: node simple-example.mjs

console.log('🚀 Simple Prompt Library Example\n');

// Since the module system is complex, let's show the conceptual usage
console.log('This is how you would use the Prompt Library:\n');

console.log('1. Initialize the library:');
console.log(`
import { PromptLibrary } from './src/prompt-library';

const library = new PromptLibrary({
  storageDir: './my-prompts',
  enableCache: true,
  enableFileWatcher: false,
  llmService: {
    provider: 'mock',  // or 'openai', 'anthropic'
    model: 'gpt-4'
  }
});

await library.initialize();
`);

console.log('2. Create a prompt:');
console.log(`
const prompt = await library.prompts.createPrompt({
  goal: 'Generate a product description',
  audience: 'E-commerce customers',
  steps: ['Analyze features', 'Write compelling copy'],
  output_expectations: {
    format: 'HTML',
    fields: ['title', 'description', 'features']
  }
}, {
  title: 'Product Description Generator',
  summary: 'Creates compelling product descriptions',
  tags: ['ecommerce', 'copywriting'],
  owner: 'user@example.com'
});
`);

console.log('3. Enhance with AI:');
console.log(`
const enhancement = await library.prompts.enhancePrompt(prompt.id);
console.log('Enhancement confidence:', enhancement.confidence);
`);

console.log('4. Render for different providers:');
console.log(`
// For OpenAI
const openaiRender = await library.prompts.renderPrompt(prompt.id, 'openai', {
  model: 'gpt-4',
  variables: { product_name: 'Wireless Headphones' }
});

// For Anthropic
const anthropicRender = await library.prompts.renderPrompt(prompt.id, 'anthropic', {
  model: 'claude-3-sonnet-20240229',
  variables: { product_name: 'Wireless Headphones' }
});
`);

console.log('5. Export and rate:');
console.log(`
// Export
const exportService = new ExportService(library.providers);
const exported = await exportService.exportPrompt(prompt, {
  provider: 'openai',
  model: 'gpt-4',
  variables: { product_name: 'Wireless Headphones' }
});

// Rate
await library.ratings.ratePrompt(prompt.id, 'user123', {
  user: 'user123',
  score: 5,
  note: 'Excellent prompt!'
});
`);

console.log('✅ That\'s the basic workflow!\n');

console.log('📚 For more details, check out:');
console.log('   - USAGE.md - Comprehensive usage guide');
console.log('   - README.md - Project overview');
console.log('   - src/examples/ - Detailed examples');
console.log('   - Tests in src/__tests__/ - Working code examples\n');

console.log('🧪 To see the system in action, run the tests:');
console.log('   npm test -- --run src/__tests__/end-to-end.test.ts\n');

console.log('🎉 Happy prompting!');