#!/usr/bin/env tsx

/**
 * Export functionality demonstration script
 * This script demonstrates the export and integration endpoints functionality
 */

import { ExportService } from '../services/export-service.js';
import { PromptRecord } from '../services/prompt-library-service.js';
import { promises as fs } from 'fs';
import path from 'path';

// Mock prompt data for demonstration
const mockPrompt: PromptRecord = {
  id: 'demo-prompt-123',
  version: 1,
  metadata: {
    title: 'Code Review Assistant',
    summary: 'A comprehensive prompt for reviewing code and providing constructive feedback',
    tags: ['code-review', 'development', 'feedback', 'quality-assurance'],
    owner: 'demo-user',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  humanPrompt: {
    goal: 'Review the provided code and give constructive, actionable feedback to help improve code quality',
    audience: 'Software developers and code reviewers',
    steps: [
      'Analyze the code structure, logic, and organization',
      'Identify potential bugs, security issues, and performance problems',
      'Check for adherence to coding standards and best practices',
      'Provide specific, actionable suggestions for improvement',
      'Highlight positive aspects and good practices found in the code'
    ],
    output_expectations: {
      format: 'Structured feedback with clear sections and actionable recommendations',
      fields: ['strengths', 'issues', 'suggestions', 'security_concerns', 'performance_notes', 'best_practices']
    }
  },
  variables: [
    {
      key: 'code',
      label: 'Code to Review',
      type: 'string',
      required: true,
      sensitive: false
    },
    {
      key: 'language',
      label: 'Programming Language',
      type: 'select',
      required: true,
      sensitive: false,
      options: ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'Go', 'Rust', 'Other']
    },
    {
      key: 'context',
      label: 'Additional Context',
      type: 'string',
      required: false,
      sensitive: false
    }
  ],
  history: [
    {
      version: 0,
      message: 'Initial prompt creation',
      author: 'demo-user',
      timestamp: '2024-01-01T00:00:00Z',
      changes: { created: true }
    }
  ]
};

// Mock the prompt library service
const mockPromptLibraryService = {
  getPrompt: async (id: string) => {
    if (id === mockPrompt.id) {
      return mockPrompt;
    }
    throw new Error(`Prompt ${id} not found`);
  },
  getPromptRatings: async () => [
    {
      id: 'rating-1',
      prompt_id: mockPrompt.id,
      user_id: 'user-1',
      score: 5,
      note: 'Excellent prompt for code reviews!',
      timestamp: new Date('2024-01-02T00:00:00Z')
    },
    {
      id: 'rating-2',
      prompt_id: mockPrompt.id,
      user_id: 'user-2',
      score: 4,
      note: 'Very helpful, could use more examples',
      timestamp: new Date('2024-01-03T00:00:00Z')
    }
  ],
  renderPrompt: async (id: string, provider: string) => {
    const baseMessages = [
      {
        role: 'system',
        content: `You are a code review assistant. ${mockPrompt.humanPrompt.goal}`
      },
      {
        role: 'user',
        content: `Please review this ${provider === 'openai' ? '{{language}}' : 'code'}: {{code}}\n\nContext: {{context}}`
      }
    ];

    switch (provider) {
      case 'openai':
        return {
          provider: 'openai',
          model: 'gpt-4',
          messages: baseMessages,
          parameters: { temperature: 0.7, max_tokens: 2000 },
          formatted_prompt: baseMessages.map(m => `${m.role}: ${m.content}`).join('\n\n')
        };
      case 'anthropic':
        return {
          provider: 'anthropic',
          model: 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: `Human: ${mockPrompt.humanPrompt.goal}\n\nCode: {{code}}\n\nAssistant: I'll review this code for you.` }],
          parameters: { temperature: 0.7, max_tokens: 2000 },
          formatted_prompt: `Human: ${mockPrompt.humanPrompt.goal}\n\nCode: {{code}}\n\nAssistant: I'll review this code for you.`
        };
      case 'meta':
        return {
          provider: 'meta',
          model: 'llama-2-70b-chat',
          messages: [{ role: 'user', content: `[INST] ${mockPrompt.humanPrompt.goal}\n\nCode: {{code}} [/INST]` }],
          parameters: { temperature: 0.7, max_tokens: 2000 },
          formatted_prompt: `[INST] ${mockPrompt.humanPrompt.goal}\n\nCode: {{code}} [/INST]`
        };
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
};

// Mock the service
jest.mock('../services/prompt-library-service.js', () => ({
  getPromptLibraryService: () => mockPromptLibraryService
}));

async function demonstrateExportFunctionality() {
  console.log('🚀 Export and Integration Endpoints Demonstration\n');
  console.log('=' .repeat(60));

  try {
    // Initialize export service
    const exportService = new ExportService({ tempDir: './demo-exports' });
    await exportService.initialize();

    console.log('✅ Export service initialized successfully\n');

    // 1. Demonstrate supported formats
    console.log('📋 Supported Export Formats:');
    const formats = exportService.getSupportedFormats();
    formats.forEach(format => {
      console.log(`  • ${format.name} (${format.id}): ${format.description}`);
    });
    console.log();

    // 2. Demonstrate JSON export
    console.log('📄 JSON Export Example:');
    const jsonExport = await exportService.exportPrompt(mockPrompt.id, {
      format: 'json',
      includeMetadata: true,
      includeHistory: true,
      includeRatings: true
    });
    console.log(`  Filename: ${jsonExport.filename}`);
    console.log(`  Size: ${jsonExport.size} bytes`);
    console.log(`  MIME Type: ${jsonExport.mimeType}`);
    console.log(`  Preview: ${jsonExport.content.substring(0, 200)}...`);
    console.log();

    // Save JSON export to file
    await fs.writeFile(path.join('./demo-exports', jsonExport.filename), jsonExport.content);

    // 3. Demonstrate YAML export
    console.log('📄 YAML Export Example:');
    const yamlExport = await exportService.exportPrompt(mockPrompt.id, {
      format: 'yaml',
      includeMetadata: true,
      template: 'full'
    });
    console.log(`  Filename: ${yamlExport.filename}`);
    console.log(`  Size: ${yamlExport.size} bytes`);
    console.log(`  Preview:\n${yamlExport.content.substring(0, 300)}...`);
    console.log();

    // Save YAML export to file
    await fs.writeFile(path.join('./demo-exports', yamlExport.filename), yamlExport.content);

    // 4. Demonstrate provider-specific exports
    const providers = ['openai', 'anthropic', 'meta'];
    console.log('🔌 Provider-Specific Export Examples:');
    
    for (const provider of providers) {
      const providerExport = await exportService.exportPrompt(mockPrompt.id, {
        format: provider as any,
        includeMetadata: true,
        substituteVariables: true,
        variableValues: {
          code: 'function hello(name) {\n  console.log("Hello, " + name);\n}',
          language: 'JavaScript',
          context: 'This is a simple greeting function'
        }
      });
      
      console.log(`  ${provider.toUpperCase()}:`);
      console.log(`    Filename: ${providerExport.filename}`);
      console.log(`    Size: ${providerExport.size} bytes`);
      
      // Save provider export to file
      await fs.writeFile(path.join('./demo-exports', providerExport.filename), providerExport.content);
    }
    console.log();

    // 5. Demonstrate minimal template
    console.log('📋 Minimal Template Export:');
    const minimalExport = await exportService.exportPrompt(mockPrompt.id, {
      format: 'json',
      template: 'minimal'
    });
    console.log(`  Size: ${minimalExport.size} bytes (vs ${jsonExport.size} bytes for full)`);
    console.log(`  Content: ${minimalExport.content}`);
    console.log();

    // 6. Demonstrate bulk export
    console.log('📦 Bulk Export Example:');
    const bulkExport = await exportService.bulkExport({
      promptIds: [mockPrompt.id], // In real scenario, this would be multiple IDs
      format: 'json',
      archiveFormat: 'zip',
      filename: 'demo-prompts-export.zip',
      includeMetadata: true,
      includeRatings: true
    });
    
    console.log(`  Archive: ${bulkExport.filename}`);
    console.log(`  Total prompts: ${bulkExport.totalPrompts}`);
    console.log(`  MIME type: ${bulkExport.mimeType}`);
    
    // Save the archive
    const archivePath = path.join('./demo-exports', bulkExport.filename);
    const writeStream = require('fs').createWriteStream(archivePath);
    bulkExport.stream.pipe(writeStream);
    
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    console.log(`  ✅ Archive saved to: ${archivePath}`);
    console.log();

    // 7. Demonstrate variable substitution
    console.log('🔄 Variable Substitution Example:');
    const substitutedExport = await exportService.exportPrompt(mockPrompt.id, {
      format: 'json',
      substituteVariables: true,
      variableValues: {
        code: 'const greeting = (name) => `Hello, ${name}!`;',
        language: 'JavaScript',
        context: 'Modern ES6 arrow function example'
      }
    });
    
    const substitutedData = JSON.parse(substitutedExport.content);
    console.log('  Original goal:', mockPrompt.humanPrompt.goal);
    console.log('  Substituted content available in renderedContent field');
    console.log();

    // 8. Show service status
    console.log('📊 Export Service Status:');
    const status = await exportService.getStatus();
    console.log(`  Initialized: ${status.initialized}`);
    console.log(`  Healthy: ${status.healthy}`);
    console.log(`  Temp directory: ${status.tempDir}`);
    console.log(`  Supported formats: ${status.supportedFormats}`);
    console.log();

    console.log('🎉 Export functionality demonstration completed successfully!');
    console.log('\nGenerated files:');
    const files = await fs.readdir('./demo-exports');
    files.forEach(file => {
      console.log(`  • ${file}`);
    });

    // Cleanup
    await exportService.shutdown();
    console.log('\n✅ Export service shut down gracefully');

  } catch (error) {
    console.error('❌ Error during demonstration:', error);
    process.exit(1);
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateExportFunctionality().catch(console.error);
}

export { demonstrateExportFunctionality };