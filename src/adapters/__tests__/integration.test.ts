// Integration tests for provider adapter system

import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderFactory } from '../provider-factory';
import { OpenAIAdapter } from '../openai-adapter';
import { AnthropicAdapter } from '../anthropic-adapter';
import { MetaAdapter } from '../meta-adapter';
import { MicrosoftCopilotAdapter } from '../microsoft-copilot-adapter';
import { StructuredPrompt } from '../../models/prompt';
import { RenderOptions } from '../../types/common';

describe('Provider Adapter System Integration', () => {
  beforeEach(() => {
    ProviderFactory.resetRegistry();
  });

  it('should register and use multiple providers', () => {
    const registry = ProviderFactory.createRegistry();
    
    // Register all adapters
    const openaiAdapter = new OpenAIAdapter();
    const anthropicAdapter = new AnthropicAdapter();
    const metaAdapter = new MetaAdapter();
    const microsoftCopilotAdapter = new MicrosoftCopilotAdapter();
    
    registry.registerAdapter(openaiAdapter);
    registry.registerAdapter(anthropicAdapter);
    registry.registerAdapter(metaAdapter);
    registry.registerAdapter(microsoftCopilotAdapter);

    // Verify all providers are registered
    expect(registry.hasProvider('openai')).toBe(true);
    expect(registry.hasProvider('anthropic')).toBe(true);
    expect(registry.hasProvider('meta')).toBe(true);
    expect(registry.hasProvider('microsoft-copilot')).toBe(true);

    // List all providers
    const providers = registry.listProviders();
    expect(providers).toHaveLength(4);
    expect(providers.map(p => p.id)).toEqual(['openai', 'anthropic', 'meta', 'microsoft-copilot']);
  });

  it('should render same prompt across different providers', () => {
    const registry = ProviderFactory.configureDefaultRegistry([
      new OpenAIAdapter(),
      new AnthropicAdapter(),
      new MetaAdapter(),
      new MicrosoftCopilotAdapter()
    ]);

    const prompt: StructuredPrompt = {
      system: ['You are a helpful assistant'],
      user_template: 'Explain {{topic}} in simple terms',
      capabilities: [],
      rules: [],
      variables: []
    };

    const variables = { topic: 'quantum computing' };

    // Render for OpenAI
    const openaiAdapter = registry.getAdapter('openai');
    const openaiOptions: RenderOptions = { model: 'gpt-4-turbo', variables };
    const openaiResult = openaiAdapter.render(prompt, openaiOptions);

    expect(openaiResult.provider).toBe('openai');
    expect(openaiResult.content).toHaveProperty('messages');
    expect((openaiResult.content as any).messages).toHaveLength(2);
    expect((openaiResult.content as any).messages[1].content).toContain('quantum computing');

    // Render for Anthropic
    const anthropicAdapter = registry.getAdapter('anthropic');
    const anthropicOptions: RenderOptions = { 
      model: 'claude-3-5-sonnet-20241022', 
      variables,
      maxTokens: 4096 
    };
    const anthropicResult = anthropicAdapter.render(prompt, anthropicOptions);

    expect(anthropicResult.provider).toBe('anthropic');
    expect(anthropicResult.content).toHaveProperty('system');
    expect(anthropicResult.content).toHaveProperty('messages');
    expect((anthropicResult.content as any).messages).toHaveLength(1);
    expect((anthropicResult.content as any).messages[0].content).toContain('quantum computing');

    // Render for Meta
    const metaAdapter = registry.getAdapter('meta');
    const metaOptions: RenderOptions = { model: 'llama-3.1-70b-instruct', variables };
    const metaResult = metaAdapter.render(prompt, metaOptions);

    expect(metaResult.provider).toBe('meta');
    expect(metaResult.content).toHaveProperty('messages');
    expect((metaResult.content as any).messages).toHaveLength(2);
    expect((metaResult.content as any).messages[1].content).toContain('quantum computing');
  });

  it('should find providers by model support', () => {
    const registry = ProviderFactory.configureDefaultRegistry([
      new OpenAIAdapter(),
      new AnthropicAdapter(),
      new MetaAdapter()
    ]);

    // Find providers for OpenAI model
    const gpt4Providers = registry.supportsModel('gpt-4-turbo');
    expect(gpt4Providers).toHaveLength(1);
    expect(gpt4Providers[0].id).toBe('openai');

    // Find providers for Anthropic model
    const claudeProviders = registry.supportsModel('claude-3-5-sonnet-20241022');
    expect(claudeProviders).toHaveLength(1);
    expect(claudeProviders[0].id).toBe('anthropic');

    // Find providers for Meta model
    const llamaProviders = registry.supportsModel('llama-3.1-70b-instruct');
    expect(llamaProviders).toHaveLength(1);
    expect(llamaProviders[0].id).toBe('meta');

    // Find providers for non-existent model
    const unknownProviders = registry.supportsModel('unknown-model');
    expect(unknownProviders).toHaveLength(0);
  });

  it('should get provider recommendations based on requirements', () => {
    const registry = ProviderFactory.configureDefaultRegistry([
      new OpenAIAdapter(),
      new AnthropicAdapter(),
      new MetaAdapter()
    ]);

    // Find providers that support system messages
    const systemMessageProviders = registry.getRecommendations({
      supportsSystemMessages: true
    });
    expect(systemMessageProviders).toHaveLength(3); // All support system messages

    // Find providers with high context length
    const highContextProviders = registry.getRecommendations({
      maxContextLength: 100000
    });
    expect(highContextProviders).toHaveLength(3); // All providers have >= 128k context

    // Find providers with specific role support
    const specificRoleProviders = registry.getRecommendations({
      supportedRoles: ['system', 'user', 'assistant']
    });
    expect(specificRoleProviders).toHaveLength(2); // OpenAI and Meta (Anthropic has separate system)
  });

  it('should validate payloads correctly across providers', () => {
    const registry = ProviderFactory.configureDefaultRegistry([
      new OpenAIAdapter(),
      new AnthropicAdapter(),
      new MetaAdapter()
    ]);

    // Valid OpenAI payload
    const openaiPayload = {
      provider: 'openai',
      model: 'gpt-4-turbo',
      content: {
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      }
    };
    const openaiAdapter = registry.getAdapter('openai');
    expect(openaiAdapter.validate(openaiPayload).isValid).toBe(true);

    // Valid Anthropic payload
    const anthropicPayload = {
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      content: {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 4096
      }
    };
    const anthropicAdapter = registry.getAdapter('anthropic');
    expect(anthropicAdapter.validate(anthropicPayload).isValid).toBe(true);

    // Valid Meta payload
    const metaPayload = {
      provider: 'meta',
      model: 'llama-3.1-70b-instruct',
      content: {
        model: 'llama-3.1-70b-instruct',
        messages: [{ role: 'user', content: 'Hello' }]
      }
    };
    const metaAdapter = registry.getAdapter('meta');
    expect(metaAdapter.validate(metaPayload).isValid).toBe(true);
  });

  it('should handle provider-specific features correctly', () => {
    const registry = ProviderFactory.configureDefaultRegistry([
      new OpenAIAdapter(),
      new AnthropicAdapter(),
      new MetaAdapter()
    ]);

    const prompt: StructuredPrompt = {
      system: ['You are helpful'],
      user_template: 'Hello',
      capabilities: [],
      rules: [],
      variables: []
    };

    // OpenAI: supports system messages in messages array
    const openaiResult = registry.getAdapter('openai').render(prompt, { model: 'gpt-4-turbo' });
    const openaiContent = openaiResult.content as any;
    expect(openaiContent.messages[0].role).toBe('system');

    // Anthropic: system message is separate field
    const anthropicResult = registry.getAdapter('anthropic').render(prompt, { 
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096 
    });
    const anthropicContent = anthropicResult.content as any;
    expect(anthropicContent.system).toBe('You are helpful');
    expect(anthropicContent.messages[0].role).toBe('user');

    // Meta: system message in messages array (like OpenAI)
    const metaResult = registry.getAdapter('meta').render(prompt, { model: 'llama-3.1-70b-instruct' });
    const metaContent = metaResult.content as any;
    expect(metaContent.messages[0].role).toBe('system');
  });

  it('should provide consistent model information', () => {
    const registry = ProviderFactory.configureDefaultRegistry([
      new OpenAIAdapter(),
      new AnthropicAdapter(),
      new MetaAdapter()
    ]);

    // Check model info for each provider
    const openaiInfo = registry.getAdapter('openai').getModelInfo('gpt-4-turbo');
    expect(openaiInfo).toEqual({
      maxTokens: 4096,
      contextLength: 128000,
      supportsSystemMessages: true
    });

    const anthropicInfo = registry.getAdapter('anthropic').getModelInfo('claude-3-5-sonnet-20241022');
    expect(anthropicInfo).toEqual({
      maxTokens: 8192,
      contextLength: 200000,
      supportsSystemMessages: true
    });

    const metaInfo = registry.getAdapter('meta').getModelInfo('llama-3.1-70b-instruct');
    expect(metaInfo).toEqual({
      maxTokens: 4096,
      contextLength: 128000,
      supportsSystemMessages: true
    });
  });
});