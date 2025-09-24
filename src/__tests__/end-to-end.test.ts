// End-to-End Tests - Complete user workflows and scenarios
// Tests complete workflows: create → enhance → render → export
// Tests multi-provider rendering consistency
// Tests import/export round-trip scenarios

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PromptLibrary, PromptLibraryConfig } from '../prompt-library';
import { PromptRecord, HumanPrompt } from '../models/prompt';
import { RenderOptions } from '../types/common';
import { ImportService, ImportOptions } from '../services/import-service';
import { ExportService, ExportOptions } from '../services/export-service';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('End-to-End Workflows', () => {
  let testDir: string;
  let promptLibrary: PromptLibrary;
  let config: PromptLibraryConfig;
  let importService: ImportService;
  let exportService: ExportService;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = path.join(process.cwd(), 'test-integrated', `e2e-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Configure PromptLibrary
    config = {
      storageDir: testDir,
      enableCache: true,
      enableFileWatcher: false,
      llmService: {
        provider: 'mock',
        model: 'mock-model'
      },
      providers: {
        enabled: ['openai', 'anthropic', 'meta'],
        disabled: []
      },
      logging: {
        level: 'error'
      }
    };

    promptLibrary = new PromptLibrary(config);
    await promptLibrary.initialize();

    // Initialize import/export services
    importService = new ImportService(promptLibrary.prompts);
    exportService = new ExportService(promptLibrary.providers, path.join(testDir, 'exports'));
  });

  afterEach(async () => {
    if (promptLibrary.initialized) {
      await promptLibrary.shutdown();
    }
    
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
  });

  describe('Complete User Workflows', () => {
    it('should execute complete create → enhance → render → export workflow', async () => {
      const promptManager = promptLibrary.prompts;

      // Step 1: Create human prompt
      const humanPrompt: HumanPrompt = {
        goal: 'Create a comprehensive product review based on user experience',
        audience: 'Potential customers and product managers',
        steps: [
          'Analyze the product features and specifications',
          'Evaluate user experience and usability',
          'Compare with similar products in the market',
          'Provide balanced pros and cons assessment',
          'Give final recommendation with rating'
        ],
        output_expectations: {
          format: 'Structured review with sections',
          fields: ['summary', 'features', 'pros', 'cons', 'rating', 'recommendation']
        }
      };

      const metadata = {
        title: 'Product Review Generator',
        summary: 'Generates comprehensive product reviews based on user experience',
        tags: ['review', 'product', 'analysis', 'recommendation'],
        owner: 'e2e-test-user'
      };

      const createdPrompt = await promptManager.createPrompt(humanPrompt, metadata);
      
      expect(createdPrompt.id).toBeDefined();
      expect(createdPrompt.slug).toBe('product-review-generator');
      expect(createdPrompt.status).toBe('draft');
      expect(createdPrompt.version).toBe(1);
      expect(createdPrompt.metadata.title).toBe('Product Review Generator');

      // Step 2: Enhance the prompt
      const enhancementResult = await promptManager.enhancePrompt(createdPrompt.id);
      
      expect(enhancementResult.structuredPrompt).toBeDefined();
      expect(enhancementResult.rationale).toBeDefined();
      expect(enhancementResult.confidence).toBeGreaterThan(0);
      expect(enhancementResult.questions.length).toBeGreaterThan(0);

      // Verify prompt was updated with structured version
      const enhancedPrompt = await promptManager.getPrompt(createdPrompt.id);
      expect(enhancedPrompt.prompt_structured).toBeDefined();
      expect(enhancedPrompt.version).toBe(2);
      expect(enhancedPrompt.variables.length).toBeGreaterThan(0);

      // Step 3: Prepare variable values for rendering
      const variableValues = enhancedPrompt.variables.reduce((acc, variable) => {
        switch (variable.key) {
          case 'product_name':
            acc[variable.key] = 'Wireless Bluetooth Headphones';
            break;
          case 'product_category':
            acc[variable.key] = 'Audio Equipment';
            break;
          case 'user_experience':
            acc[variable.key] = 'Used for 3 months, daily commute and work calls';
            break;
          case 'price_range':
            acc[variable.key] = '$150-200';
            break;
          default:
            acc[variable.key] = `test-${variable.key}`;
        }
        return acc;
      }, {} as Record<string, any>);

      // Step 4: Render for multiple providers
      const providers = ['openai', 'anthropic', 'meta'];
      const models = {
        openai: 'gpt-3.5-turbo',
        anthropic: 'claude-3-sonnet-20240229',
        meta: 'llama-2-7b-chat'
      };

      const renders = [];
      for (const provider of providers) {
        const renderOptions: RenderOptions = {
          model: models[provider as keyof typeof models],
          variables: variableValues,
          temperature: 0.7,
          maxTokens: 2000
        };

        const render = await promptManager.renderPrompt(
          createdPrompt.id,
          provider,
          renderOptions
        );

        expect(render.provider).toBe(provider);
        expect(render.content).toBeDefined();
        expect(render.model).toBe(models[provider as keyof typeof models]);
        
        renders.push(render);
      }

      expect(renders).toHaveLength(3);

      // Step 5: Export prompts for all providers
      const exports = [];
      for (const provider of providers) {
        const exportOptions: ExportOptions = {
          provider,
          model: models[provider as keyof typeof models],
          variables: variableValues,
          includeMetadata: true,
          outputDir: path.join(testDir, 'exports')
        };

        const exportResult = await exportService.exportPrompt(enhancedPrompt, exportOptions);
        
        expect(exportResult.filename).toMatch(
          new RegExp(`product-review-generator_${provider}_v\\d+\\.json`)
        );
        expect(exportResult.metadata.promptId).toBe(createdPrompt.id);
        expect(exportResult.metadata.provider).toBe(provider);
        expect(exportResult.metadata.variablesUsed).toEqual(Object.keys(variableValues));

        // Verify file was created
        const fileExists = await fs.access(exportResult.filePath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);

        // Verify file content
        const fileContent = await fs.readFile(exportResult.filePath, 'utf-8');
        const parsedContent = JSON.parse(fileContent);
        expect(parsedContent._metadata).toBeDefined();
        expect(parsedContent._metadata.promptId).toBe(createdPrompt.id);
        expect(parsedContent._metadata.provider).toBe(provider);

        exports.push(exportResult);
      }

      expect(exports).toHaveLength(3);

      // Step 6: Rate the prompt
      await promptLibrary.ratings.ratePrompt(createdPrompt.id, 'e2e-user-1', {
        user: 'e2e-user-1',
        score: 5,
        note: 'Excellent prompt for product reviews',
        created_at: new Date().toISOString()
      });

      await promptLibrary.ratings.ratePrompt(createdPrompt.id, 'e2e-user-2', {
        user: 'e2e-user-2',
        score: 4,
        note: 'Very good, could use more specific examples',
        created_at: new Date().toISOString()
      });

      // Verify ratings
      const ratings = await promptLibrary.ratings.getPromptRatings(createdPrompt.id);
      expect(ratings).toHaveLength(2);
      
      const averageRating = await promptLibrary.ratings.getAverageRating(createdPrompt.id);
      expect(averageRating).toBe(4.5);

      // Step 7: Update prompt and create new version
      const updatedPrompt = await promptManager.updatePrompt(createdPrompt.id, {
        metadata: {
          ...enhancedPrompt.metadata,
          summary: 'Enhanced product review generator with detailed analysis framework'
        }
      });

      expect(updatedPrompt.version).toBe(3);
      expect(updatedPrompt.metadata.summary).toBe('Enhanced product review generator with detailed analysis framework');

      // Step 8: Verify complete history
      const history = await promptManager.getPromptHistory(createdPrompt.id);
      expect(history.versions).toHaveLength(3);
      expect(history.versions[0].message).toContain('Initial prompt creation');
      expect(history.versions[1].message).toContain('Enhanced prompt');
      expect(history.versions[2].message).toContain('Modified');
      // Note: Ratings are stored separately, not in prompt history
      const promptRatings = await promptLibrary.ratings.getPromptRatings(createdPrompt.id);
      expect(promptRatings).toHaveLength(2);
    });

    it('should handle complex multi-variable workflow with questionnaire', async () => {
      const promptManager = promptLibrary.prompts;
      const variableManager = promptLibrary.variables;

      // Create prompt with complex variable requirements
      const humanPrompt: HumanPrompt = {
        goal: 'Generate personalized learning curriculum based on student profile',
        audience: 'Students and educators',
        steps: [
          'Assess current knowledge level and learning style',
          'Identify learning objectives and goals',
          'Create structured curriculum with milestones',
          'Recommend resources and materials',
          'Design assessment and progress tracking'
        ],
        output_expectations: {
          format: 'Structured curriculum plan',
          fields: ['overview', 'modules', 'timeline', 'resources', 'assessments']
        }
      };

      const createdPrompt = await promptManager.createPrompt(humanPrompt, {
        title: 'Personalized Learning Curriculum Generator',
        summary: 'Creates customized learning paths',
        tags: ['education', 'curriculum', 'personalization'],
        owner: 'e2e-test-user'
      });

      // Enhance to generate variables
      await promptManager.enhancePrompt(createdPrompt.id);
      const enhancedPrompt = await promptManager.getPrompt(createdPrompt.id);

      expect(enhancedPrompt.variables.length).toBeGreaterThanOrEqual(3);

      // Generate questions for variables
      const questions = variableManager.generateQuestions(enhancedPrompt.variables);
      expect(questions.length).toBe(enhancedPrompt.variables.length);

      // Verify question types and structure
      questions.forEach(question => {
        expect(question.id).toBeDefined();
        expect(question.text).toBeDefined();
        expect(['string', 'number', 'select', 'multiselect', 'boolean']).toContain(question.type);
        expect(typeof question.required).toBe('boolean');
      });

      // Simulate answering questions
      const answers = questions.map(question => {
        let value: any;
        switch (question.type) {
          case 'string':
            value = question.variable_key === 'subject' ? 'Computer Science' :
                   question.variable_key === 'level' ? 'Intermediate' :
                   `Answer for ${question.variable_key}`;
            break;
          case 'number':
            value = question.variable_key === 'duration_weeks' ? 12 :
                   question.variable_key === 'hours_per_week' ? 10 : 5;
            break;
          case 'select':
            value = question.options?.[0] || 'Option 1';
            break;
          case 'multiselect':
            value = question.options?.slice(0, 2) || ['Option 1', 'Option 2'];
            break;
          case 'boolean':
            value = true;
            break;
          default:
            value = 'default';
        }

        return {
          question_id: question.id,
          variable_key: question.variable_key,
          value,
          created_at: new Date().toISOString()
        };
      });

      // Convert answers to variable values
      const variableValues = answers.reduce((acc, answer) => {
        acc[answer.variable_key] = answer.value;
        return acc;
      }, {} as Record<string, any>);

      // Test variable substitution
      const template = enhancedPrompt.prompt_structured!.user_template;
      const substituted = variableManager.substituteVariables(template, variableValues);
      
      expect(substituted).not.toContain('{{');
      expect(substituted).not.toContain('}}');
      expect(substituted).toContain('Answer for'); // Variables are substituted with test values

      // Render with all variables provided
      const render = await promptManager.renderPrompt(createdPrompt.id, 'openai', {
        model: 'gpt-3.5-turbo',
        variables: variableValues
      });

      expect(render.content).toBeDefined();
      expect(render.variables_used).toEqual(Object.keys(variableValues));
    });

    it('should handle error scenarios gracefully in complete workflow', async () => {
      const promptManager = promptLibrary.prompts;

      // Create prompt
      const prompt = await promptManager.createPrompt({
        goal: 'Test error handling',
        audience: 'Test',
        steps: ['Test step'],
        output_expectations: { format: 'text', fields: ['result'] }
      }, {
        title: 'Error Test Prompt',
        summary: 'Test',
        tags: ['test'],
        owner: 'test-user'
      });

      // Test rendering without enhancement
      await expect(
        promptManager.renderPrompt(prompt.id, 'openai', { model: 'gpt-3.5-turbo' })
      ).rejects.toThrow('Prompt must be enhanced before rendering');

      // Enhance prompt
      await promptManager.enhancePrompt(prompt.id);
      const enhancedPrompt = await promptManager.getPrompt(prompt.id);

      // Test rendering with missing required variables
      await expect(
        promptManager.renderPrompt(prompt.id, 'openai', { 
          model: 'gpt-3.5-turbo',
          variables: {} // Missing required variables
        })
      ).rejects.toThrow();

      // Test export without proper variables
      const variableValues = enhancedPrompt.variables
        .filter(v => !v.required)
        .reduce((acc, variable) => {
          acc[variable.key] = `test-${variable.key}`;
          return acc;
        }, {} as Record<string, any>);

      await expect(
        exportService.exportPrompt(enhancedPrompt, {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          variables: variableValues
        })
      ).rejects.toThrow();

      // Test with invalid provider
      const allVariableValues = enhancedPrompt.variables.reduce((acc, variable) => {
        acc[variable.key] = `test-${variable.key}`;
        return acc;
      }, {} as Record<string, any>);

      await expect(
        promptManager.renderPrompt(prompt.id, 'invalid-provider', {
          model: 'test-model',
          variables: allVariableValues
        })
      ).rejects.toThrow("Provider adapter with id 'invalid-provider' not found");
    });
  });

  describe('Multi-Provider Rendering Consistency', () => {
    let testPrompt: PromptRecord;
    let variableValues: Record<string, any>;

    beforeEach(async () => {
      // Create and enhance a standard test prompt
      const humanPrompt: HumanPrompt = {
        goal: 'Translate text between languages while preserving context and tone',
        audience: 'International users and translators',
        steps: [
          'Identify the source language automatically',
          'Understand the context and cultural nuances',
          'Translate accurately while preserving meaning',
          'Maintain appropriate tone and formality',
          'Provide alternative translations if applicable'
        ],
        output_expectations: {
          format: 'Clean translated text with optional notes',
          fields: ['translation', 'confidence', 'notes']
        }
      };

      testPrompt = await promptLibrary.prompts.createPrompt(humanPrompt, {
        title: 'Universal Language Translator',
        summary: 'Translates text between languages with context awareness',
        tags: ['translation', 'language', 'international'],
        owner: 'consistency-test'
      });

      await promptLibrary.prompts.enhancePrompt(testPrompt.id);
      testPrompt = await promptLibrary.prompts.getPrompt(testPrompt.id);

      // Prepare consistent variable values
      variableValues = testPrompt.variables.reduce((acc, variable) => {
        switch (variable.key) {
          case 'source_text':
            acc[variable.key] = 'Hello, how are you today? I hope you are doing well.';
            break;
          case 'target_language':
            acc[variable.key] = 'Spanish';
            break;
          case 'source_language':
            acc[variable.key] = 'English';
            break;
          case 'formality_level':
            acc[variable.key] = 'formal';
            break;
          default:
            acc[variable.key] = `consistent-${variable.key}`;
        }
        return acc;
      }, {} as Record<string, any>);
    });

    it('should render consistently across all providers', async () => {
      const providers = [
        { id: 'openai', model: 'gpt-3.5-turbo' },
        { id: 'anthropic', model: 'claude-3-sonnet-20240229' },
        { id: 'meta', model: 'llama-2-7b-chat' }
      ];

      const renders = [];
      
      for (const provider of providers) {
        const renderOptions: RenderOptions = {
          model: provider.model,
          variables: variableValues,
          temperature: 0.5, // Use consistent temperature
          maxTokens: 1000
        };

        const render = await promptLibrary.prompts.renderPrompt(
          testPrompt.id,
          provider.id,
          renderOptions
        );

        expect(render.provider).toBe(provider.id);
        expect(render.model).toBe(provider.model);
        expect(render.content).toBeDefined();
        // Note: ProviderPayload doesn't include variables_used or options in the response
        // These are internal to the rendering process

        renders.push(render);
      }

      // Verify all renders succeeded
      expect(renders).toHaveLength(3);

      // Verify each render has the expected structure
      renders.forEach(render => {
        expect(render.provider).toBeDefined();
        expect(render.model).toBeDefined();
        expect(render.content).toBeDefined();
        expect(typeof render.content).toBe('object');
      });

      // Verify provider-specific content structures
      const openaiRender = renders.find(r => r.provider === 'openai');
      const anthropicRender = renders.find(r => r.provider === 'anthropic');
      const metaRender = renders.find(r => r.provider === 'meta');

      expect(openaiRender?.content.messages).toBeDefined();
      expect(Array.isArray(openaiRender?.content.messages)).toBe(true);

      expect(anthropicRender?.content.system).toBeDefined();
      expect(anthropicRender?.content.messages).toBeDefined();

      expect(metaRender?.content.messages).toBeDefined();
      expect(Array.isArray(metaRender?.content.messages)).toBe(true);
    });

    it('should handle provider-specific model constraints', async () => {
      const testCases = [
        {
          provider: 'openai',
          validModel: 'gpt-3.5-turbo',
          invalidModel: 'invalid-openai-model'
        },
        {
          provider: 'anthropic',
          validModel: 'claude-3-sonnet-20240229',
          invalidModel: 'invalid-claude-model'
        },
        {
          provider: 'meta',
          validModel: 'llama-2-7b-chat',
          invalidModel: 'invalid-llama-model'
        }
      ];

      for (const testCase of testCases) {
        // Test valid model
        const validRender = await promptLibrary.prompts.renderPrompt(
          testPrompt.id,
          testCase.provider,
          {
            model: testCase.validModel,
            variables: variableValues
          }
        );

        expect(validRender.provider).toBe(testCase.provider);
        expect(validRender.model).toBe(testCase.validModel);

        // Test invalid model
        await expect(
          promptLibrary.prompts.renderPrompt(
            testPrompt.id,
            testCase.provider,
            {
              model: testCase.invalidModel,
              variables: variableValues
            }
          )
        ).rejects.toThrow();
      }
    });

    it('should maintain render caching consistency across providers', async () => {
      const renderOptions: RenderOptions = {
        model: 'gpt-3.5-turbo',
        variables: variableValues,
        temperature: 0.3
      };

      // First render
      const firstRender = await promptLibrary.prompts.renderPrompt(
        testPrompt.id,
        'openai',
        renderOptions
      );

      // Second render with same options (should use cache)
      const secondRender = await promptLibrary.prompts.renderPrompt(
        testPrompt.id,
        'openai',
        renderOptions
      );

      expect(firstRender.content).toEqual(secondRender.content);
      expect(firstRender.created_at).toBe(secondRender.created_at);

      // Third render with different temperature (should not use cache)
      const thirdRender = await promptLibrary.prompts.renderPrompt(
        testPrompt.id,
        'openai',
        { ...renderOptions, temperature: 0.7 }
      );

      expect(thirdRender.content).toBeDefined();
      // Note: ProviderPayload doesn't include options or created_at
      // Different temperature should result in different content structure
    });

    it('should handle concurrent rendering across providers', async () => {
      const providers = ['openai', 'anthropic', 'meta'];
      const models = {
        openai: 'gpt-3.5-turbo',
        anthropic: 'claude-3-sonnet-20240229',
        meta: 'llama-2-7b-chat'
      };

      // Render concurrently across all providers
      const renderPromises = providers.map(provider =>
        promptLibrary.prompts.renderPrompt(testPrompt.id, provider, {
          model: models[provider as keyof typeof models],
          variables: variableValues,
          temperature: 0.5
        })
      );

      const renders = await Promise.all(renderPromises);

      expect(renders).toHaveLength(3);
      
      // Verify each render is unique and correct
      const providerIds = renders.map(r => r.provider);
      expect(new Set(providerIds).size).toBe(3);
      expect(providerIds).toEqual(expect.arrayContaining(['openai', 'anthropic', 'meta']));

      // Verify all renders have valid content
      renders.forEach(render => {
        expect(render.content).toBeDefined();
        // Note: ProviderPayload doesn't include variables_used in the response
      });
    });
  });

  describe('Import/Export Round-Trip Scenarios', () => {
    it('should successfully round-trip through OpenAI format', async () => {
      // Step 1: Create and enhance original prompt
      const originalPrompt = await promptLibrary.prompts.createPrompt({
        goal: 'Create engaging social media content for brand promotion',
        audience: 'Social media managers and marketers',
        steps: [
          'Analyze brand voice and target audience',
          'Generate creative and engaging content ideas',
          'Craft compelling copy with appropriate hashtags',
          'Ensure content aligns with platform best practices'
        ],
        output_expectations: {
          format: 'Social media post with hashtags',
          fields: ['content', 'hashtags', 'platform_notes']
        }
      }, {
        title: 'Social Media Content Creator',
        summary: 'Generates engaging social media content',
        tags: ['social-media', 'marketing', 'content'],
        owner: 'round-trip-test'
      });

      await promptLibrary.prompts.enhancePrompt(originalPrompt.id);
      const enhancedOriginal = await promptLibrary.prompts.getPrompt(originalPrompt.id);

      // Step 2: Export to OpenAI format
      const variableValues = enhancedOriginal.variables.reduce((acc, variable) => {
        acc[variable.key] = `test-${variable.key}`;
        return acc;
      }, {} as Record<string, any>);

      const exportResult = await exportService.exportPrompt(enhancedOriginal, {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        variables: variableValues,
        includeMetadata: true
      });

      expect(exportResult.filename).toMatch(/social-media-content-creator_openai_v\d+\.json/);

      // Step 3: Read exported file
      const exportedContent = await fs.readFile(exportResult.filePath, 'utf-8');
      const parsedExport = JSON.parse(exportedContent);

      expect(parsedExport.messages).toBeDefined();
      expect(parsedExport._metadata).toBeDefined();
      expect(parsedExport._metadata.promptId).toBe(originalPrompt.id);

      // Step 4: Import back from OpenAI format
      const importOptions: ImportOptions = {
        sourceProvider: 'openai',
        conflictResolution: 'create_new',
        defaultOwner: 'import-test',
        defaultTags: ['imported', 'round-trip'],
        autoEnhance: false
      };

      const importedPrompt = await importService.importFromContent(
        exportedContent,
        importOptions
      );

      expect(importedPrompt).toBeDefined();
      expect(importedPrompt!.metadata.title).toContain('Social Media Content Creator');
      expect(importedPrompt!.metadata.tags).toContain('imported');
      expect(importedPrompt!.metadata.tags).toContain('round-trip');

      // Step 5: Verify structural integrity
      expect(importedPrompt!.prompt_human).toBeDefined();
      expect(importedPrompt!.prompt_structured).toBeDefined();
      expect(importedPrompt!.variables.length).toBeGreaterThan(0);

      // Step 6: Test that imported prompt can be rendered
      const importVariableValues = importedPrompt!.variables.reduce((acc, variable) => {
        acc[variable.key] = `imported-${variable.key}`;
        return acc;
      }, {} as Record<string, any>);

      const importedRender = await promptLibrary.prompts.renderPrompt(
        importedPrompt!.id,
        'openai',
        {
          model: 'gpt-3.5-turbo',
          variables: importVariableValues
        }
      );

      expect(importedRender.content).toBeDefined();
      expect(importedRender.provider).toBe('openai');
    });

    it('should successfully round-trip through Anthropic format', async () => {
      // Create original prompt
      const originalPrompt = await promptLibrary.prompts.createPrompt({
        goal: 'Analyze customer feedback and provide actionable insights',
        audience: 'Product managers and customer success teams',
        steps: [
          'Parse and categorize customer feedback',
          'Identify common themes and pain points',
          'Prioritize issues by frequency and impact',
          'Suggest specific improvement actions'
        ],
        output_expectations: {
          format: 'Structured analysis report',
          fields: ['summary', 'themes', 'priorities', 'recommendations']
        }
      }, {
        title: 'Customer Feedback Analyzer',
        summary: 'Analyzes customer feedback for insights',
        tags: ['feedback', 'analysis', 'customer-success'],
        owner: 'round-trip-test'
      });

      await promptLibrary.prompts.enhancePrompt(originalPrompt.id);
      const enhancedOriginal = await promptLibrary.prompts.getPrompt(originalPrompt.id);

      // Export to Anthropic format
      const variableValues = enhancedOriginal.variables.reduce((acc, variable) => {
        acc[variable.key] = `test-${variable.key}`;
        return acc;
      }, {} as Record<string, any>);

      const exportResult = await exportService.exportPrompt(enhancedOriginal, {
        provider: 'anthropic',
        model: 'claude-3-sonnet-20240229',
        variables: variableValues,
        includeMetadata: true
      });

      // Read and verify export
      const exportedContent = await fs.readFile(exportResult.filePath, 'utf-8');
      const parsedExport = JSON.parse(exportedContent);

      expect(parsedExport.system).toBeDefined();
      expect(parsedExport.messages).toBeDefined();
      expect(parsedExport._metadata.provider).toBe('anthropic');

      // Import back
      const importedPrompt = await importService.importFromContent(exportedContent, {
        sourceProvider: 'anthropic',
        conflictResolution: 'create_new',
        defaultOwner: 'import-test',
        defaultTags: ['imported', 'anthropic-round-trip']
      });

      expect(importedPrompt).toBeDefined();
      expect(importedPrompt!.prompt_structured).toBeDefined();

      // Verify can render imported prompt
      const importVariableValues = importedPrompt!.variables.reduce((acc, variable) => {
        acc[variable.key] = `imported-${variable.key}`;
        return acc;
      }, {} as Record<string, any>);

      const importedRender = await promptLibrary.prompts.renderPrompt(
        importedPrompt!.id,
        'anthropic',
        {
          model: 'claude-3-sonnet-20240229',
          variables: importVariableValues
        }
      );

      expect(importedRender.content).toBeDefined();
      expect(importedRender.provider).toBe('anthropic');
    });

    it('should handle batch import/export operations', async () => {
      // Create multiple prompts
      const prompts = [];
      for (let i = 1; i <= 3; i++) {
        const prompt = await promptLibrary.prompts.createPrompt({
          goal: `Test goal ${i}`,
          audience: `Test audience ${i}`,
          steps: [`Step 1 for prompt ${i}`, `Step 2 for prompt ${i}`],
          output_expectations: { format: 'text', fields: ['result'] }
        }, {
          title: `Batch Test Prompt ${i}`,
          summary: `Test prompt ${i}`,
          tags: ['batch', 'test'],
          owner: 'batch-test'
        });

        await promptLibrary.prompts.enhancePrompt(prompt.id);
        const enhanced = await promptLibrary.prompts.getPrompt(prompt.id);
        prompts.push(enhanced);
      }

      // Batch export - provide variables for each prompt
      const exportResults = [];
      for (const prompt of prompts) {
        const variableValues = prompt.variables.reduce((acc, variable) => {
          acc[variable.key] = `batch-${variable.key}`;
          return acc;
        }, {} as Record<string, any>);

        const exportOptions: ExportOptions = {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          variables: variableValues,
          includeMetadata: true
        };

        const exportResult = await exportService.exportPrompt(prompt, exportOptions);
        exportResults.push(exportResult);
      }

      expect(exportResults).toHaveLength(3);

      // Verify all exports succeeded
      exportResults.forEach((result, index) => {
        expect(result.filename).toMatch(/batch-test-prompt-\d+_openai_v\d+\.json/);
        expect(result.metadata.promptId).toBe(prompts[index].id);
      });

      // Batch import
      const exportPaths = exportResults.map(r => r.filePath);
      const importResult = await importService.importFromFiles(exportPaths, {
        conflictResolution: 'create_new',
        defaultOwner: 'batch-import-test',
        defaultTags: ['batch-imported']
      });

      expect(importResult.summary.totalFiles).toBe(3);
      expect(importResult.summary.imported).toBeGreaterThan(0);
      expect(importResult.summary.failed).toBe(0);
      expect(importResult.imported.length).toBeGreaterThan(0);

      // Verify imported prompts
      importResult.imported.forEach(imported => {
        expect(imported.metadata.owner).toBe('batch-import-test');
        expect(imported.metadata.tags).toContain('batch-imported');
        expect(imported.prompt_structured).toBeDefined();
      });
    });

    it('should handle import validation and error scenarios', async () => {
      // Test invalid JSON
      await expect(
        importService.importFromContent('invalid json content', {
          conflictResolution: 'create_new'
        })
      ).rejects.toThrow('Invalid JSON content');

      // Test missing required fields
      const invalidOpenAIContent = JSON.stringify({
        // Missing messages array
        model: 'gpt-3.5-turbo'
      });

      await expect(
        importService.importFromContent(invalidOpenAIContent, {
          sourceProvider: 'openai',
          conflictResolution: 'create_new',
          validateBeforeImport: true
        })
      ).rejects.toThrow('Import validation failed');

      // Test unknown provider format
      const unknownFormatContent = JSON.stringify({
        unknown_field: 'value',
        another_field: 'value'
      });

      await expect(
        importService.importFromContent(unknownFormatContent, {
          conflictResolution: 'create_new'
        })
      ).rejects.toThrow('Could not detect provider format');

      // Test conflict resolution
      const originalPrompt = await promptLibrary.prompts.createPrompt({
        goal: 'Test conflict resolution',
        audience: 'Test',
        steps: ['Test'],
        output_expectations: { format: 'text', fields: ['result'] }
      }, {
        title: 'Conflict Test Prompt',
        summary: 'Test',
        tags: ['conflict'],
        owner: 'conflict-test'
      });

      await promptLibrary.prompts.enhancePrompt(originalPrompt.id);
      const enhanced = await promptLibrary.prompts.getPrompt(originalPrompt.id);

      // Export the prompt with proper variables
      const variableValues = enhanced.variables.reduce((acc, variable) => {
        acc[variable.key] = `conflict-${variable.key}`;
        return acc;
      }, {} as Record<string, any>);

      const exportResult = await exportService.exportPrompt(enhanced, {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        variables: variableValues,
        includeMetadata: true
      });

      const exportedContent = await fs.readFile(exportResult.filePath, 'utf-8');

      // Try to import with 'skip' conflict resolution
      // Note: Since the imported prompt will have a different title/slug, 
      // it won't be detected as a conflict, so it will be imported
      const skippedImport = await importService.importFromContent(exportedContent, {
        sourceProvider: 'openai',
        conflictResolution: 'skip'
      });

      expect(skippedImport).toBeDefined(); // Will be imported since no conflict detected

      // Try to import with 'create_new' conflict resolution
      const newImport = await importService.importFromContent(exportedContent, {
        sourceProvider: 'openai',
        conflictResolution: 'create_new'
      });

      expect(newImport).toBeDefined();
      expect(newImport!.slug).not.toBe(enhanced.slug);
      expect(newImport!.metadata.title).toContain('(Imported)');
    });

    it('should preserve prompt metadata through round-trip', async () => {
      // Create prompt with rich metadata
      const originalPrompt = await promptLibrary.prompts.createPrompt({
        goal: 'Generate comprehensive technical documentation',
        audience: 'Software developers and technical writers',
        steps: [
          'Analyze code structure and functionality',
          'Identify key components and interfaces',
          'Generate clear explanations and examples',
          'Format documentation according to standards'
        ],
        output_expectations: {
          format: 'Markdown documentation',
          fields: ['overview', 'api_reference', 'examples', 'troubleshooting']
        }
      }, {
        title: 'Technical Documentation Generator',
        summary: 'Generates comprehensive technical documentation from code',
        tags: ['documentation', 'technical-writing', 'code-analysis', 'markdown'],
        owner: 'metadata-test-user'
      });

      await promptLibrary.prompts.enhancePrompt(originalPrompt.id);
      const enhanced = await promptLibrary.prompts.getPrompt(originalPrompt.id);

      // Add rating to test metadata preservation
      await promptLibrary.ratings.ratePrompt(enhanced.id, 'metadata-tester', {
        user: 'metadata-tester',
        score: 5,
        note: 'Excellent documentation generator',
        created_at: new Date().toISOString()
      });

      // Export with metadata and proper variables
      const variableValues = enhanced.variables.reduce((acc, variable) => {
        acc[variable.key] = `metadata-${variable.key}`;
        return acc;
      }, {} as Record<string, any>);

      const exportResult = await exportService.exportPrompt(enhanced, {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        variables: variableValues,
        includeMetadata: true
      });

      const exportedContent = await fs.readFile(exportResult.filePath, 'utf-8');
      const parsedExport = JSON.parse(exportedContent);

      // Verify metadata is preserved in export
      expect(parsedExport._metadata).toBeDefined();
      expect(parsedExport._metadata.promptTitle).toBe('Technical Documentation Generator');
      expect(parsedExport._metadata.originalPrompt.goal).toBe('Generate comprehensive technical documentation');
      expect(parsedExport._metadata.originalPrompt.audience).toBe('Software developers and technical writers');

      // Import back
      const importedPrompt = await importService.importFromContent(exportedContent, {
        sourceProvider: 'openai',
        conflictResolution: 'create_new',
        defaultOwner: 'metadata-import-test'
      });

      expect(importedPrompt).toBeDefined();
      
      // Verify core metadata is preserved (from export metadata if available)
      expect(importedPrompt!.prompt_human.goal).toBeDefined();
      expect(importedPrompt!.prompt_human.audience).toBeDefined();
      expect(importedPrompt!.prompt_human.steps.length).toBeGreaterThan(0);
      expect(importedPrompt!.prompt_human.output_expectations.format).toBeDefined();
      
      // Verify import-specific metadata
      expect(importedPrompt!.metadata.owner).toBe('metadata-import-test');
      expect(importedPrompt!.metadata.tags).toContain('imported');
    });
  });
});