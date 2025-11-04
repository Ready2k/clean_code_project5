# Template API Usage Examples

This document provides comprehensive examples for using the Template Management API endpoints.

## Authentication

All template API endpoints require authentication. Include your JWT token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     http://localhost:8000/api/templates
```

## Basic Template Operations

### 1. List All Templates

```bash
# Get all templates
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8000/api/templates

# Filter by category
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "http://localhost:8000/api/templates?category=enhancement&isActive=true"

# Search templates
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "http://localhost:8000/api/templates?search=enhancement&sortBy=usage_count&sortOrder=desc"
```

**Response:**
```json
{
  "data": [
    {
      "id": "template-123",
      "category": "enhancement",
      "key": "main_enhancement_prompt",
      "name": "Main Enhancement Instruction",
      "description": "Primary template for converting human prompts to structured format",
      "isActive": true,
      "isDefault": true,
      "version": 3,
      "usageCount": 1247,
      "lastModified": "2024-01-15T10:30:00Z",
      "createdBy": "admin",
      "updatedBy": "admin"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### 2. Get Template Details

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8000/api/templates/template-123
```

**Response:**
```json
{
  "id": "template-123",
  "category": "enhancement",
  "key": "main_enhancement_prompt",
  "name": "Main Enhancement Instruction",
  "description": "Primary template for converting human prompts to structured format",
  "content": "Please enhance the following human-readable prompt into a structured format.\n\nHUMAN PROMPT:\nGoal: {{goal}}\nAudience: {{audience}}\nSteps: {{steps}}\nOutput Format: {{output_format}}\nExpected Fields: {{expected_fields}}\n\nREQUIREMENTS:\n- Convert to structured format with system instructions, user template, rules, and capabilities\n- Extract variables using {{variable_name}} syntax where content should be dynamic\n- Preserve the original intent and goal\n{{#if target_provider}}- Optimize for {{target_provider}} provider{{/if}}\n\nRespond with a JSON object containing the structured prompt format.",
  "variables": [
    {
      "name": "goal",
      "type": "string",
      "description": "The main goal of the prompt",
      "required": true
    },
    {
      "name": "audience",
      "type": "string",
      "description": "Target audience",
      "required": true
    },
    {
      "name": "target_provider",
      "type": "string",
      "description": "Target LLM provider",
      "required": false,
      "defaultValue": null
    }
  ],
  "metadata": {
    "providerOptimized": ["openai", "anthropic", "meta"],
    "complexityLevel": "intermediate"
  },
  "isActive": true,
  "isDefault": true,
  "version": 3,
  "usageCount": 1247,
  "lastModified": "2024-01-15T10:30:00Z",
  "createdBy": "admin",
  "updatedBy": "admin"
}
```

### 3. Create New Template

```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "category": "custom",
       "key": "my_custom_template",
       "name": "My Custom Template",
       "description": "A custom template for specific use case",
       "content": "You are a {{role}} assistant. Help the user with {{task_type}} tasks.\n\nUser request: {{user_input}}\n\nProvide a {{output_format}} response.",
       "variables": [
         {
           "name": "role",
           "type": "string",
           "description": "Assistant role",
           "required": true
         },
         {
           "name": "task_type",
           "type": "string",
           "description": "Type of task to help with",
           "required": true
         },
         {
           "name": "user_input",
           "type": "string",
           "description": "User input or request",
           "required": true
         },
         {
           "name": "output_format",
           "type": "string",
           "description": "Expected output format",
           "required": false,
           "defaultValue": "detailed"
         }
       ],
       "metadata": {
         "complexityLevel": "basic"
       }
     }' \
     http://localhost:8000/api/templates
```

### 4. Update Template

```bash
curl -X PUT \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Updated Custom Template",
       "description": "Updated description with more details",
       "content": "You are a {{role}} assistant specialized in {{domain}}. Help the user with {{task_type}} tasks.\n\nUser request: {{user_input}}\n\nProvide a {{output_format}} response with {{detail_level}} detail.",
       "variables": [
         {
           "name": "role",
           "type": "string",
           "description": "Assistant role",
           "required": true
         },
         {
           "name": "domain",
           "type": "string",
           "description": "Domain of expertise",
           "required": true
         },
         {
           "name": "task_type",
           "type": "string",
           "description": "Type of task to help with",
           "required": true
         },
         {
           "name": "user_input",
           "type": "string",
           "description": "User input or request",
           "required": true
         },
         {
           "name": "output_format",
           "type": "string",
           "description": "Expected output format",
           "required": false,
           "defaultValue": "structured"
         },
         {
           "name": "detail_level",
           "type": "string",
           "description": "Level of detail in response",
           "required": false,
           "defaultValue": "moderate"
         }
       ],
       "changeMessage": "Added domain specialization and detail level control"
     }' \
     http://localhost:8000/api/templates/template-456
```

## Template Testing and Validation

### 5. Validate Template

```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8000/api/templates/template-123/validate
```

**Response:**
```json
{
  "isValid": true,
  "errors": [],
  "warnings": [
    {
      "type": "PERFORMANCE",
      "message": "Template contains many conditional statements which may impact rendering performance",
      "suggestion": "Consider simplifying conditional logic or splitting into multiple templates"
    }
  ]
}
```

### 6. Test Template with Sample Data

```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "testData": {
         "role": "helpful",
         "domain": "software development",
         "task_type": "code review",
         "user_input": "Please review this Python function for best practices",
         "output_format": "markdown",
         "detail_level": "comprehensive"
       },
       "provider": "openai"
     }' \
     http://localhost:8000/api/templates/template-456/test
```

**Response:**
```json
{
  "success": true,
  "renderedContent": "You are a helpful assistant specialized in software development. Help the user with code review tasks.\n\nUser request: Please review this Python function for best practices\n\nProvide a markdown response with comprehensive detail.",
  "executionTime": 12.5,
  "errors": [],
  "warnings": [],
  "providerResponse": {
    "status": "success",
    "responseTime": 1250,
    "tokenCount": 45
  }
}
```

## Version Management

### 7. Get Template History

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "http://localhost:8000/api/templates/template-123/history?page=1&limit=5"
```

**Response:**
```json
{
  "data": [
    {
      "id": "version-789",
      "templateId": "template-123",
      "versionNumber": 3,
      "content": "Current template content...",
      "changeMessage": "Added provider optimization",
      "createdAt": "2024-01-15T10:30:00Z",
      "createdBy": "admin"
    },
    {
      "id": "version-788",
      "templateId": "template-123",
      "versionNumber": 2,
      "content": "Previous template content...",
      "changeMessage": "Updated variable descriptions",
      "createdAt": "2024-01-10T14:20:00Z",
      "createdBy": "admin"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 3,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### 8. Revert Template to Previous Version

```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8000/api/templates/template-123/revert/2
```

## Analytics and Performance

### 9. Get Template Analytics

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "http://localhost:8000/api/templates/template-123/analytics?timeRange=30d"
```

**Response:**
```json
{
  "templateId": "template-123",
  "timeRange": "30d",
  "usageStats": {
    "totalUsage": 1247,
    "uniqueUsers": 89,
    "averageUsagePerDay": 41.6,
    "peakUsageDay": "2024-01-12",
    "usageByProvider": {
      "openai": 756,
      "anthropic": 321,
      "meta": 170
    }
  },
  "performanceMetrics": {
    "averageRenderTime": 8.3,
    "successRate": 98.7,
    "errorRate": 1.3,
    "averageResponseTime": 1450,
    "qualityScore": 87.5
  },
  "trends": {
    "usageGrowth": 15.2,
    "performanceImprovement": 5.8
  }
}
```

## Bulk Operations

### 10. Get Template Categories

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8000/api/templates/categories
```

**Response:**
```json
[
  {
    "name": "enhancement",
    "displayName": "Enhancement Templates",
    "description": "Templates for AI-powered prompt enhancement",
    "templateCount": 5,
    "activeCount": 4
  },
  {
    "name": "question_generation",
    "displayName": "Question Generation",
    "description": "Templates for generating contextual questions",
    "templateCount": 8,
    "activeCount": 7
  },
  {
    "name": "custom",
    "displayName": "Custom Templates",
    "description": "User-created custom templates",
    "templateCount": 12,
    "activeCount": 10
  }
]
```

### 11. Export Templates

```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "templateIds": ["template-123", "template-456"],
       "format": "json",
       "includeHistory": true
     }' \
     http://localhost:8000/api/templates/export
```

### 12. Import Templates

```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "version": "1.0",
       "templates": [
         {
           "category": "custom",
           "key": "imported_template",
           "name": "Imported Template",
           "description": "Template imported from backup",
           "content": "Template content here...",
           "variables": []
         }
       ],
       "options": {
         "overwriteExisting": false,
         "preserveIds": false
       }
     }' \
     http://localhost:8000/api/templates/import
```

### 13. Reset to Default Templates

```bash
# Reset all templates to defaults
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:8000/api/templates/defaults

# Reset specific categories only
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "categories": ["enhancement", "question_generation"]
     }' \
     http://localhost:8000/api/templates/defaults
```

## Error Handling

### Common Error Responses

**400 Bad Request - Validation Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Template validation failed",
    "details": {
      "errors": [
        {
          "type": "MISSING_VARIABLE",
          "message": "Variable 'required_field' is used in template but not defined",
          "line": 5,
          "column": 12,
          "suggestion": "Add 'required_field' to the variables array"
        }
      ]
    }
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-12345"
}
```

**404 Not Found:**
```json
{
  "error": {
    "code": "TEMPLATE_NOT_FOUND",
    "message": "Template with ID 'template-999' not found"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-12346"
}
```

**403 Forbidden:**
```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You do not have permission to modify system templates"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req-12347"
}
```

## JavaScript/TypeScript SDK Examples

### Using with Fetch API

```typescript
interface TemplateInfo {
  id: string;
  category: string;
  key: string;
  name: string;
  description: string;
  isActive: boolean;
  version: number;
  usageCount: number;
}

class TemplateAPI {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async listTemplates(params?: {
    category?: string;
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: TemplateInfo[]; pagination: any }> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }

    return this.request(`/templates?${queryParams}`);
  }

  async getTemplate(id: string): Promise<TemplateDetail> {
    return this.request(`/templates/${id}`);
  }

  async createTemplate(template: CreateTemplateRequest): Promise<TemplateInfo> {
    return this.request('/templates', {
      method: 'POST',
      body: JSON.stringify(template),
    });
  }

  async updateTemplate(id: string, updates: UpdateTemplateRequest): Promise<TemplateDetail> {
    return this.request(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async testTemplate(id: string, testData: any, provider?: string): Promise<TemplateTestResult> {
    return this.request(`/templates/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ testData, provider }),
    });
  }

  async getAnalytics(id: string, timeRange: string = '30d'): Promise<TemplateAnalytics> {
    return this.request(`/templates/${id}/analytics?timeRange=${timeRange}`);
  }
}

// Usage example
const api = new TemplateAPI('http://localhost:8000/api', 'your-jwt-token');

// List enhancement templates
const enhancementTemplates = await api.listTemplates({ 
  category: 'enhancement', 
  isActive: true 
});

// Test a template
const testResult = await api.testTemplate('template-123', {
  goal: 'Create a blog post',
  audience: 'developers',
  steps: ['Research topic', 'Write outline', 'Draft content'],
  output_format: 'markdown'
});

console.log('Rendered template:', testResult.renderedContent);
```

## Migration from Hardcoded Prompts

### Before (Hardcoded)

```typescript
// Old hardcoded approach
class EnhancementAgent {
  private buildEnhancementPrompt(humanPrompt: HumanPrompt): string {
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

Respond with a JSON object containing the structured prompt format.`;
  }
}
```

### After (Template-based)

```typescript
// New template-based approach
class EnhancementAgent {
  constructor(private templateManager: SystemPromptManager) {}

  private async buildEnhancementPrompt(humanPrompt: HumanPrompt, context?: EnhancementContext): Promise<string> {
    return await this.templateManager.getTemplate(
      'enhancement',
      'main_enhancement_prompt',
      {
        goal: humanPrompt.goal,
        audience: humanPrompt.audience,
        steps: humanPrompt.steps,
        output_format: humanPrompt.outputExpectations,
        target_provider: context?.provider,
        domain_knowledge: context?.domainKnowledge
      }
    );
  }
}
```

This migration allows for:
- Runtime customization without code changes
- A/B testing different prompt variations
- Provider-specific optimizations
- Performance monitoring and analytics
- Version control and rollback capabilities