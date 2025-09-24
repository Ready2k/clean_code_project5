# 🚀 How to Use the Prompt Library

The Prompt Library is a comprehensive system for creating, managing, and optimizing prompts across multiple AI providers. Here's how to get started:

## 📋 Prerequisites

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## 🎯 Basic Usage

### 1. Initialize the Library

```typescript
import { PromptLibrary } from './src/prompt-library';

const library = new PromptLibrary({
  storageDir: './my-prompts',        // Where to store prompts
  enableCache: true,                 // Enable render caching
  enableFileWatcher: false,          // Watch for file changes
  llmService: {
    provider: 'mock',                // Use 'openai', 'anthropic', or 'mock'
    model: 'gpt-4',                  // Model to use for enhancement
    apiKey: 'your-api-key'           // API key (not needed for mock)
  },
  providers: {
    enabled: ['openai', 'anthropic', 'meta'],
    disabled: []
  }
});

await library.initialize();
```

### 2. Create a Prompt

```typescript
// Define what you want the prompt to do
const humanPrompt = {
  goal: 'Generate a professional email response',
  audience: 'Business professionals',
  steps: [
    'Analyze the incoming email context',
    'Determine appropriate tone and formality',
    'Craft a clear and concise response'
  ],
  output_expectations: {
    format: 'Plain text email',
    fields: ['subject', 'body', 'signature']
  }
};

// Add metadata
const metadata = {
  title: 'Professional Email Response Generator',
  summary: 'Helps generate professional email responses',
  tags: ['email', 'business', 'communication'],
  owner: 'your-email@example.com'
};

// Create the prompt
const prompt = await library.prompts.createPrompt(humanPrompt, metadata);
console.log(`Created prompt: ${prompt.id}`);
```

### 3. Enhance the Prompt with AI

```typescript
// Let AI improve your prompt
const enhancement = await library.prompts.enhancePrompt(prompt.id);
console.log(`Enhancement confidence: ${enhancement.confidence}`);
console.log(`Rationale: ${enhancement.rationale}`);

// Get the enhanced prompt with variables
const enhancedPrompt = await library.prompts.getPrompt(prompt.id);
console.log(`Generated ${enhancedPrompt.variables.length} variables`);
```

### 4. Render for Different AI Providers

```typescript
// Prepare variable values
const variableValues = {
  sender_name: 'John Smith',
  original_message: 'Thank you for your inquiry about our services.',
  response_type: 'informative'
};

// Render for OpenAI
const openaiRender = await library.prompts.renderPrompt(prompt.id, 'openai', {
  model: 'gpt-4',
  variables: variableValues,
  temperature: 0.7
});

// Render for Anthropic
const anthropicRender = await library.prompts.renderPrompt(prompt.id, 'anthropic', {
  model: 'claude-3-sonnet-20240229',
  variables: variableValues
});

// Render for Meta
const metaRender = await library.prompts.renderPrompt(prompt.id, 'meta', {
  model: 'llama-2-7b-chat',
  variables: variableValues
});
```

### 5. Export Prompts

```typescript
import { ExportService } from './src/services/export-service';

const exportService = new ExportService(library.providers);

// Export for OpenAI
const exported = await exportService.exportPrompt(enhancedPrompt, {
  provider: 'openai',
  model: 'gpt-4',
  variables: variableValues,
  includeMetadata: true
});

console.log(`Exported to: ${exported.filePath}`);
```

### 6. Rate and Manage Prompts

```typescript
// Rate a prompt
await library.ratings.ratePrompt(prompt.id, 'user123', {
  user: 'user123',
  score: 5,
  note: 'Excellent prompt!',
  created_at: new Date().toISOString()
});

// Get ratings
const ratings = await library.ratings.getPromptRatings(prompt.id);
const averageRating = await library.ratings.getAverageRating(prompt.id);

// List all prompts
const allPrompts = await library.prompts.listPrompts();

// Get prompt history
const history = await library.prompts.getPromptHistory(prompt.id);
```

### 7. Import/Export Round-Trip

```typescript
import { ImportService } from './src/services/import-service';

const importService = new ImportService(library.prompts);

// Import from OpenAI format
const importedPrompt = await importService.importFromContent(exportedContent, {
  sourceProvider: 'openai',
  conflictResolution: 'create_new',
  defaultOwner: 'imported-user'
});
```

## 🔧 Advanced Features

### Variable Management

```typescript
// Generate questions for variables
const questions = library.variables.generateQuestions(enhancedPrompt.variables);

// Substitute variables in templates
const substituted = library.variables.substituteVariables(
  template, 
  variableValues
);
```

### Provider Management

```typescript
// List available providers
const providers = library.providers.listProviders();

// Check if a provider supports a model
const supports = library.providers.getAdapter('openai').supports('gpt-4');

// Get provider information
const providerInfo = library.providers.getAdapter('openai').getModelInfo('gpt-4');
```

### Version Control

```typescript
// Update a prompt (creates new version)
const updatedPrompt = await library.prompts.updatePrompt(prompt.id, {
  metadata: {
    ...prompt.metadata,
    summary: 'Updated summary'
  }
});

// Get version history
const history = await library.prompts.getPromptHistory(prompt.id);
```

## 🧪 Testing Your Setup

Run the comprehensive test suite to verify everything works:

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- src/__tests__/end-to-end.test.ts
npm test -- src/services/__tests__/
npm test -- src/adapters/__tests__/
```

## 📁 File Structure

The library creates the following structure in your storage directory:

```
my-prompts/
├── prompts/
│   ├── my-prompt.prompt.yaml      # Human-readable prompt
│   ├── my-prompt.structured.yaml  # AI-enhanced version
│   └── my-prompt.variables.yaml   # Variable definitions
├── renders/
│   ├── my-prompt_openai_v1.json   # Cached renders
│   └── my-prompt_anthropic_v1.json
├── ratings/
│   └── my-prompt.ratings.yaml     # User ratings
└── exports/
    └── my-prompt_openai_v1.json   # Exported files
```

## 🚨 Common Issues

### 1. Module Import Errors
Make sure you've built the project first:
```bash
npm run build
```

### 2. Storage Directory Permissions
Ensure the storage directory is writable:
```bash
chmod 755 ./my-prompts
```

### 3. API Key Configuration
For real AI providers, set your API keys in environment variables:
```bash
export OPENAI_API_KEY="your-key-here"
export ANTHROPIC_API_KEY="your-key-here"
```

### 4. Provider Not Found Errors
Make sure the provider is enabled in your configuration:
```typescript
providers: {
  enabled: ['openai', 'anthropic', 'meta'],
  disabled: []
}
```

### 5. Enhancement Questions Not Appearing
The intelligent question generator only asks questions when they add value. If your prompt is already complete and specific, no questions will be generated - this is the intended behavior.

## 🎉 Next Steps

1. **Explore the Examples**: Check out `src/examples/` for more detailed usage
2. **Read the Tests**: The test files show comprehensive usage patterns
3. **Customize Providers**: Add your own AI provider adapters
4. **Build Integrations**: Use the library in your applications

## 📚 API Reference

For detailed API documentation, see:
- `src/prompt-library.ts` - Main library class
- `src/services/` - Core services
- `src/adapters/` - Provider adapters
- `src/models/` - Data models

Happy prompting! 🚀