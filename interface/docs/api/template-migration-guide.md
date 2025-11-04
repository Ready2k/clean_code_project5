# Migration Guide: From Hardcoded Prompts to Template System

This guide helps developers migrate from hardcoded LLM prompts to the new customizable template system.

## Overview

The template system replaces hardcoded prompt strings with a flexible, database-driven approach that allows:

- **Runtime Customization**: Modify prompts without code changes
- **Version Control**: Track changes and revert to previous versions
- **A/B Testing**: Compare different prompt variations
- **Analytics**: Monitor prompt performance and usage
- **Provider Optimization**: Customize prompts for different LLM providers

## Migration Strategy

### Phase 1: Identify Hardcoded Prompts

First, identify all hardcoded prompts in your codebase:

```bash
# Search for common prompt patterns
grep -r "Please " src/ --include="*.ts" --include="*.js"
grep -r "You are " src/ --include="*.ts" --include="*.js"
grep -r "Generate " src/ --include="*.ts" --include="*.js"
grep -r "template literal" src/ --include="*.ts" --include="*.js"
```

### Phase 2: Extract and Categorize Prompts

#### Current Hardcoded Locations

1. **Enhancement Agent** (`src/services/enhancement-agent.ts`)
   - `buildEnhancementPrompt()` method
   - `getEnhancementSystemPrompt()` method

2. **Question Generator** (`src/services/intelligent-question-generator.ts`)
   - Task-specific question templates
   - Context-aware question generation

3. **Mock LLM Service** (`src/services/mock-llm-service.ts`)
   - Example response templates
   - Provider-specific mock responses

#### Template Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| `enhancement` | Prompt improvement and structuring | Main enhancement prompt, system instructions |
| `question_generation` | Contextual question creation | Task-specific templates, analysis questions |
| `mock_responses` | Testing and development | Example responses, provider simulations |
| `system_prompts` | Core system instructions | Role definitions, behavior guidelines |
| `custom` | User-created templates | Domain-specific prompts, specialized use cases |

### Phase 3: Create Template Definitions

#### Step 1: Extract Variables

Identify dynamic content that should become template variables:

**Before (Hardcoded):**
```typescript
private buildEnhancementPrompt(humanPrompt: HumanPrompt, context?: EnhancementContext): string {
  return `Please enhance the following human-readable prompt into a structured format.

HUMAN PROMPT:
Goal: ${humanPrompt.goal}
Audience: ${humanPrompt.audience}
Steps: ${humanPrompt.steps.join(', ')}
Output Format: ${humanPrompt.outputExpectations}

REQUIREMENTS:
- Convert to structured format with system instructions, user template, rules, and capabilities
- Extract variables using {{variable_name}} syntax where content should be dynamic
- Preserve the original intent and goal
${context?.provider ? `- Optimize for ${context.provider} provider` : ''}

Respond with a JSON object containing the structured prompt format.`;
}
```

**After (Template):**
```yaml
# Template Content
content: |
  Please enhance the following human-readable prompt into a structured format.

  HUMAN PROMPT:
  Goal: {{goal}}
  Audience: {{audience}}
  Steps: {{steps}}
  Output Format: {{output_format}}
  Expected Fields: {{expected_fields}}

  REQUIREMENTS:
  - Convert to structured format with system instructions, user template, rules, and capabilities
  - Extract variables using {{variable_name}} syntax where content should be dynamic
  - Preserve the original intent and goal
  {{#if target_provider}}- Optimize for {{target_provider}} provider{{/if}}
  {{#if domain_knowledge}}- Consider this domain context: {{domain_knowledge}}{{/if}}

  Respond with a JSON object containing the structured prompt format.

# Template Variables
variables:
  - name: goal
    type: string
    description: The main goal of the prompt
    required: true
  - name: audience
    type: string
    description: Target audience
    required: true
  - name: steps
    type: string
    description: Comma-separated list of steps
    required: true
  - name: output_format
    type: string
    description: Expected output format
    required: true
  - name: expected_fields
    type: string
    description: Expected output fields
    required: true
  - name: target_provider
    type: string
    description: Target LLM provider
    required: false
  - name: domain_knowledge
    type: string
    description: Domain-specific context
    required: false
```

#### Step 2: Create Template Records

Use the API to create template records:

```typescript
// Create enhancement template
const enhancementTemplate = await templateAPI.createTemplate({
  category: 'enhancement',
  key: 'main_enhancement_prompt',
  name: 'Main Enhancement Instruction',
  description: 'Primary template for converting human prompts to structured format',
  content: `Please enhance the following human-readable prompt into a structured format.

HUMAN PROMPT:
Goal: {{goal}}
Audience: {{audience}}
Steps: {{steps}}
Output Format: {{output_format}}
Expected Fields: {{expected_fields}}

REQUIREMENTS:
- Convert to structured format with system instructions, user template, rules, and capabilities
- Extract variables using {{variable_name}} syntax where content should be dynamic
- Preserve the original intent and goal
{{#if target_provider}}- Optimize for {{target_provider}} provider{{/if}}
{{#if domain_knowledge}}- Consider this domain context: {{domain_knowledge}}{{/if}}

Respond with a JSON object containing the structured prompt format.`,
  variables: [
    {
      name: 'goal',
      type: 'string',
      description: 'The main goal of the prompt',
      required: true
    },
    {
      name: 'audience',
      type: 'string',
      description: 'Target audience',
      required: true
    },
    {
      name: 'steps',
      type: 'string',
      description: 'Comma-separated list of steps',
      required: true
    },
    {
      name: 'output_format',
      type: 'string',
      description: 'Expected output format',
      required: true
    },
    {
      name: 'expected_fields',
      type: 'string',
      description: 'Expected output fields',
      required: true
    },
    {
      name: 'target_provider',
      type: 'string',
      description: 'Target LLM provider',
      required: false
    },
    {
      name: 'domain_knowledge',
      type: 'string',
      description: 'Domain-specific context',
      required: false
    }
  ],
  metadata: {
    providerOptimized: ['openai', 'anthropic', 'meta'],
    complexityLevel: 'intermediate'
  }
});
```

### Phase 4: Update Service Code

#### Step 1: Inject Template Manager

Update service constructors to accept the template manager:

```typescript
// Before
class EnhancementAgent {
  constructor(
    private llmService: LLMService,
    private logger: Logger
  ) {}
}

// After
class EnhancementAgent {
  constructor(
    private llmService: LLMService,
    private logger: Logger,
    private templateManager: SystemPromptManager  // Add this
  ) {}
}
```

#### Step 2: Replace Hardcoded Methods

Replace hardcoded prompt methods with template calls:

```typescript
// Before
class EnhancementAgent {
  private buildEnhancementPrompt(humanPrompt: HumanPrompt, context?: EnhancementContext): string {
    return `Please enhance the following human-readable prompt...`;
  }

  private getEnhancementSystemPrompt(): string {
    return `You are an expert prompt engineer...`;
  }
}

// After
class EnhancementAgent {
  private async buildEnhancementPrompt(
    humanPrompt: HumanPrompt, 
    context?: EnhancementContext
  ): Promise<string> {
    return await this.templateManager.getTemplate(
      'enhancement',
      'main_enhancement_prompt',
      {
        goal: humanPrompt.goal,
        audience: humanPrompt.audience,
        steps: humanPrompt.steps.join(', '),
        output_format: humanPrompt.outputExpectations,
        expected_fields: this.extractExpectedFields(humanPrompt),
        target_provider: context?.provider,
        domain_knowledge: context?.domainKnowledge
      }
    );
  }

  private async getEnhancementSystemPrompt(): Promise<string> {
    return await this.templateManager.getTemplate(
      'enhancement',
      'system_enhancement_prompt'
    );
  }

  // Helper method to maintain compatibility
  private extractExpectedFields(humanPrompt: HumanPrompt): string {
    // Extract or derive expected fields from the human prompt
    return humanPrompt.outputExpectations || 'structured response';
  }
}
```

#### Step 3: Update Method Signatures

Update method signatures to be async where needed:

```typescript
// Before
public enhance(humanPrompt: HumanPrompt, context?: EnhancementContext): Promise<EnhancementResult> {
  const prompt = this.buildEnhancementPrompt(humanPrompt, context);
  const systemPrompt = this.getEnhancementSystemPrompt();
  // ... rest of method
}

// After
public async enhance(humanPrompt: HumanPrompt, context?: EnhancementContext): Promise<EnhancementResult> {
  const prompt = await this.buildEnhancementPrompt(humanPrompt, context);
  const systemPrompt = await this.getEnhancementSystemPrompt();
  // ... rest of method
}
```

### Phase 5: Maintain Backward Compatibility

#### Compatibility Layer

Create a compatibility layer to ensure existing code continues to work:

```typescript
class EnhancementAgentCompatibility {
  private templateManager: SystemPromptManager;
  
  constructor(templateManager: SystemPromptManager) {
    this.templateManager = templateManager;
  }

  // Legacy method - maintained for compatibility
  private buildEnhancementPrompt(humanPrompt: HumanPrompt, context?: EnhancementContext): string {
    // Synchronous wrapper that uses cached templates
    try {
      return this.templateManager.getTemplateSync(
        'enhancement',
        'main_enhancement_prompt',
        this.buildTemplateContext(humanPrompt, context)
      );
    } catch (error) {
      // Fallback to hardcoded prompt if template system fails
      return this.getHardcodedFallback(humanPrompt, context);
    }
  }

  private buildTemplateContext(humanPrompt: HumanPrompt, context?: EnhancementContext): TemplateContext {
    return {
      goal: humanPrompt.goal,
      audience: humanPrompt.audience,
      steps: humanPrompt.steps.join(', '),
      output_format: humanPrompt.outputExpectations,
      expected_fields: this.extractExpectedFields(humanPrompt),
      target_provider: context?.provider,
      domain_knowledge: context?.domainKnowledge
    };
  }

  private getHardcodedFallback(humanPrompt: HumanPrompt, context?: EnhancementContext): string {
    // Original hardcoded implementation as fallback
    return `Please enhance the following human-readable prompt...`;
  }
}
```

#### Gradual Migration

Implement feature flags to gradually roll out template usage:

```typescript
class EnhancementAgent {
  constructor(
    private llmService: LLMService,
    private logger: Logger,
    private templateManager: SystemPromptManager,
    private config: { useTemplateSystem: boolean }
  ) {}

  private async buildEnhancementPrompt(
    humanPrompt: HumanPrompt, 
    context?: EnhancementContext
  ): Promise<string> {
    if (this.config.useTemplateSystem) {
      try {
        return await this.templateManager.getTemplate(
          'enhancement',
          'main_enhancement_prompt',
          this.buildTemplateContext(humanPrompt, context)
        );
      } catch (error) {
        this.logger.warn('Template system failed, falling back to hardcoded prompt', error);
        return this.getHardcodedPrompt(humanPrompt, context);
      }
    } else {
      return this.getHardcodedPrompt(humanPrompt, context);
    }
  }
}
```

### Phase 6: Testing Migration

#### Unit Tests

Update unit tests to work with the template system:

```typescript
describe('EnhancementAgent with Templates', () => {
  let agent: EnhancementAgent;
  let mockTemplateManager: jest.Mocked<SystemPromptManager>;

  beforeEach(() => {
    mockTemplateManager = {
      getTemplate: jest.fn(),
    } as any;

    agent = new EnhancementAgent(
      mockLLMService,
      mockLogger,
      mockTemplateManager
    );
  });

  it('should use template system for enhancement prompts', async () => {
    const humanPrompt = {
      goal: 'Create a blog post',
      audience: 'developers',
      steps: ['Research', 'Write', 'Edit'],
      outputExpectations: 'markdown'
    };

    const expectedTemplate = 'Please enhance the following...';
    mockTemplateManager.getTemplate.mockResolvedValue(expectedTemplate);

    const result = await agent.enhance(humanPrompt);

    expect(mockTemplateManager.getTemplate).toHaveBeenCalledWith(
      'enhancement',
      'main_enhancement_prompt',
      expect.objectContaining({
        goal: 'Create a blog post',
        audience: 'developers',
        steps: 'Research, Write, Edit',
        output_format: 'markdown'
      })
    );
  });

  it('should fallback to hardcoded prompt on template failure', async () => {
    mockTemplateManager.getTemplate.mockRejectedValue(new Error('Template not found'));

    const result = await agent.enhance(humanPrompt);

    // Should still work with fallback
    expect(result).toBeDefined();
  });
});
```

#### Integration Tests

Test the complete template system integration:

```typescript
describe('Template System Integration', () => {
  let templateManager: SystemPromptManager;
  let enhancementAgent: EnhancementAgent;

  beforeEach(async () => {
    // Set up real template manager with test database
    templateManager = new SystemPromptManager(testDbConnection, testCache);
    enhancementAgent = new EnhancementAgent(llmService, logger, templateManager);

    // Seed test templates
    await seedTestTemplates(templateManager);
  });

  it('should enhance prompts using database templates', async () => {
    const humanPrompt = createTestHumanPrompt();
    const result = await enhancementAgent.enhance(humanPrompt);

    expect(result.enhancedPrompt).toBeDefined();
    expect(result.rationale).toContain('structured format');
  });

  it('should track template usage analytics', async () => {
    const humanPrompt = createTestHumanPrompt();
    await enhancementAgent.enhance(humanPrompt);

    const analytics = await templateManager.getTemplateAnalytics(
      'enhancement',
      'main_enhancement_prompt',
      { timeRange: '1d' }
    );

    expect(analytics.usageStats.totalUsage).toBeGreaterThan(0);
  });
});
```

### Phase 7: Deployment and Monitoring

#### Database Migration

Create database migration scripts:

```sql
-- Create template tables
CREATE TABLE prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,
    key VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    
    UNIQUE(category, key)
);

-- Seed default templates
INSERT INTO prompt_templates (category, key, name, description, content, variables, is_default) VALUES
('enhancement', 'main_enhancement_prompt', 'Main Enhancement Instruction', 
 'Primary template for converting human prompts to structured format',
 'Please enhance the following human-readable prompt into a structured format...', 
 '[{"name": "goal", "type": "string", "required": true}]', true);
```

#### Environment Configuration

Add template system configuration:

```bash
# Environment variables
TEMPLATE_CACHE_TTL=3600
TEMPLATE_CACHE_SIZE=1000
ENABLE_TEMPLATE_ANALYTICS=true
TEMPLATE_FALLBACK_ENABLED=true
```

#### Monitoring and Alerts

Set up monitoring for the template system:

```typescript
// Template performance monitoring
class TemplateMonitoring {
  trackTemplateUsage(templateId: string, renderTime: number, success: boolean) {
    metrics.increment('template.usage', {
      template_id: templateId,
      success: success.toString()
    });
    
    metrics.histogram('template.render_time', renderTime, {
      template_id: templateId
    });
  }

  trackTemplateCacheHit(templateId: string, hit: boolean) {
    metrics.increment('template.cache', {
      template_id: templateId,
      hit: hit.toString()
    });
  }
}
```

## Migration Checklist

### Pre-Migration
- [ ] Audit all hardcoded prompts in codebase
- [ ] Categorize prompts by function and usage
- [ ] Design template variable structure
- [ ] Plan backward compatibility strategy
- [ ] Set up test environment with template system

### Migration Implementation
- [ ] Create database schema and migrations
- [ ] Implement SystemPromptManager service
- [ ] Create default template definitions
- [ ] Update service constructors for dependency injection
- [ ] Replace hardcoded methods with template calls
- [ ] Implement compatibility layer for gradual rollout
- [ ] Update method signatures to async where needed

### Testing and Validation
- [ ] Update unit tests for template integration
- [ ] Create integration tests for template system
- [ ] Test fallback mechanisms
- [ ] Validate template rendering performance
- [ ] Test admin interface for template management

### Deployment
- [ ] Deploy database migrations
- [ ] Seed default templates
- [ ] Configure environment variables
- [ ] Set up monitoring and alerting
- [ ] Deploy application with feature flags
- [ ] Gradually enable template system

### Post-Migration
- [ ] Monitor template usage and performance
- [ ] Gather feedback from administrators
- [ ] Optimize templates based on analytics
- [ ] Remove hardcoded fallbacks after validation
- [ ] Document new template management workflows

## Troubleshooting Common Issues

### Template Not Found Errors
```typescript
// Add proper error handling
try {
  const template = await templateManager.getTemplate(category, key, context);
  return template;
} catch (error) {
  if (error instanceof TemplateNotFoundError) {
    logger.warn(`Template not found: ${category}/${key}, using fallback`);
    return getFallbackTemplate(category, key, context);
  }
  throw error;
}
```

### Variable Substitution Issues
```typescript
// Validate variables before rendering
const validationResult = await templateManager.validateTemplate(templateId);
if (!validationResult.isValid) {
  throw new TemplateValidationError(validationResult.errors);
}
```

### Performance Issues
```typescript
// Implement caching and preloading
await templateManager.warmCache(['enhancement/*', 'question_generation/*']);
```

### Rollback Strategy
```typescript
// Implement rollback to previous version
if (templatePerformance.errorRate > 5) {
  await templateManager.revertTemplate(templateId, previousVersion);
  logger.warn(`Reverted template ${templateId} due to high error rate`);
}
```

This migration guide provides a comprehensive approach to transitioning from hardcoded prompts to the flexible template system while maintaining system stability and backward compatibility.