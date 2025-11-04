/**
 * Integration service for connecting core services with the System Prompt Manager
 * This provides a clean way to inject the template system into existing services
 */

import { EnhancementAgentImpl, LLMService } from './enhancement-agent';
import { IntelligentQuestionGeneratorImpl } from './intelligent-question-generator';
import { MockLLMService } from './mock-llm-service';
import { TemplateCategory, TemplateContext } from '../types/prompt-templates';

// Interface for System Prompt Manager (to avoid circular dependency)
interface ISystemPromptManager {
  getTemplate(category: TemplateCategory, key: string, context?: TemplateContext): Promise<string>;
}

/**
 * Service factory that creates integrated services with template support
 */
export class PromptTemplateIntegrationService {
  private systemPromptManager?: ISystemPromptManager;

  constructor(systemPromptManager?: ISystemPromptManager) {
    this.systemPromptManager = systemPromptManager;
  }

  /**
   * Create an Enhancement Agent with template integration
   */
  createEnhancementAgent(llmService: LLMService): EnhancementAgentImpl {
    return new EnhancementAgentImpl(llmService, this.systemPromptManager);
  }

  /**
   * Create an Intelligent Question Generator with template integration
   */
  createQuestionGenerator(): IntelligentQuestionGeneratorImpl {
    return new IntelligentQuestionGeneratorImpl(this.systemPromptManager);
  }

  /**
   * Create a Mock LLM Service with template integration (dev/test only)
   */
  createMockLLMService(): MockLLMService {
    return new MockLLMService(this.systemPromptManager);
  }

  /**
   * Update the system prompt manager instance
   */
  setSystemPromptManager(systemPromptManager: ISystemPromptManager): void {
    this.systemPromptManager = systemPromptManager;
  }

  /**
   * Check if template integration is available
   */
  isTemplateIntegrationAvailable(): boolean {
    return this.systemPromptManager !== undefined;
  }
}

// Singleton instance for global use
let integrationServiceInstance: PromptTemplateIntegrationService | null = null;

/**
 * Initialize the integration service with a System Prompt Manager
 */
export function initializePromptTemplateIntegration(systemPromptManager?: ISystemPromptManager): PromptTemplateIntegrationService {
  if (!integrationServiceInstance) {
    integrationServiceInstance = new PromptTemplateIntegrationService(systemPromptManager);
  } else if (systemPromptManager) {
    integrationServiceInstance.setSystemPromptManager(systemPromptManager);
  }
  return integrationServiceInstance;
}

/**
 * Get the integration service instance
 */
export function getPromptTemplateIntegration(): PromptTemplateIntegrationService {
  if (!integrationServiceInstance) {
    // Create without template manager for backward compatibility
    integrationServiceInstance = new PromptTemplateIntegrationService();
  }
  return integrationServiceInstance;
}

/**
 * Create services with template integration (convenience functions)
 */
export function createEnhancementAgent(llmService: LLMService, systemPromptManager?: ISystemPromptManager): EnhancementAgentImpl {
  if (systemPromptManager) {
    return new EnhancementAgentImpl(llmService, systemPromptManager);
  }
  return getPromptTemplateIntegration().createEnhancementAgent(llmService);
}

export function createQuestionGenerator(systemPromptManager?: ISystemPromptManager): IntelligentQuestionGeneratorImpl {
  if (systemPromptManager) {
    return new IntelligentQuestionGeneratorImpl(systemPromptManager);
  }
  return getPromptTemplateIntegration().createQuestionGenerator();
}

export function createMockLLMService(systemPromptManager?: ISystemPromptManager): MockLLMService {
  if (systemPromptManager) {
    return new MockLLMService(systemPromptManager);
  }
  return getPromptTemplateIntegration().createMockLLMService();
}