# Dynamic Provider Management Integration Guide

## Overview

This guide provides comprehensive information for integrating with the Dynamic Provider Management API, including setup, authentication, common workflows, and best practices.

## Table of Contents

1. [Authentication](#authentication)
2. [Common Workflows](#common-workflows)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [Best Practices](#best-practices)
6. [Code Examples](#code-examples)
7. [Troubleshooting](#troubleshooting)

## Authentication

All Dynamic Provider Management endpoints require admin-level authentication using JWT Bearer tokens.

### Getting an Admin Token

```bash
# Login with admin credentials
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin@example.com",
    "password": "your-admin-password"
  }'

# Response includes JWT token
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh-token-here",
  "user": {
    "id": "user-id",
    "username": "admin",
    "role": "admin"
  },
  "expiresIn": 3600
}
```

### Using the Token

Include the JWT token in the Authorization header for all API requests:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     http://localhost:8000/api/admin/providers
```

## Common Workflows

### 1. Setting Up a New Provider

#### Step 1: Create Provider Configuration

```bash
curl -X POST http://localhost:8000/api/admin/providers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "custom-openai",
    "name": "Custom OpenAI Provider",
    "description": "Custom OpenAI configuration for our organization",
    "apiEndpoint": "https://api.openai.com/v1",
    "authMethod": "api_key",
    "authConfig": {
      "type": "api_key",
      "fields": {
        "apiKey": "sk-your-api-key-here"
      },
      "headers": {
        "Authorization": "Bearer {{apiKey}}"
      }
    },
    "capabilities": {
      "supportsSystemMessages": true,
      "maxContextLength": 128000,
      "supportedRoles": ["system", "user", "assistant"],
      "supportsStreaming": true,
      "supportsTools": true,
      "supportedAuthMethods": ["api_key"]
    }
  }'
```

#### Step 2: Test Provider Connectivity

```bash
curl -X POST http://localhost:8000/api/admin/providers/{provider-id}/test \
  -H "Authorization: Bearer <token>"
```

#### Step 3: Add Models to Provider

```bash
curl -X POST http://localhost:8000/api/admin/providers/{provider-id}/models \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "gpt-4",
    "name": "GPT-4",
    "description": "OpenAI GPT-4 model",
    "contextLength": 8192,
    "capabilities": {
      "supportsSystemMessages": true,
      "maxContextLength": 8192,
      "supportedRoles": ["system", "user", "assistant"],
      "supportsStreaming": true,
      "supportsTools": true,
      "supportsFunctionCalling": true
    },
    "pricingInfo": {
      "inputTokenPrice": 0.03,
      "outputTokenPrice": 0.06,
      "currency": "USD"
    }
  }'
```

#### Step 4: Test Model Availability

```bash
curl -X POST http://localhost:8000/api/admin/models/{model-id}/test \
  -H "Authorization: Bearer <token>"
```

### 2. Using Provider Templates

#### List Available Templates

```bash
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/admin/provider-templates
```

#### Apply Template to Create Provider

```bash
curl -X POST http://localhost:8000/api/admin/provider-templates/{template-id}/apply \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "my-openai-provider",
    "name": "My OpenAI Provider",
    "customizations": {
      "apiKey": "sk-your-api-key-here",
      "organizationId": "org-your-org-id"
    }
  }'
```

### 3. Bulk Operations

#### Export Provider Configurations

```bash
curl -X POST http://localhost:8000/api/admin/providers/export \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "includeModels": true,
    "includeTemplates": false
  }' > provider-backup.json
```

#### Import Provider Configurations

```bash
curl -X POST http://localhost:8000/api/admin/providers/import \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d @provider-backup.json
```

### 4. Monitoring and Maintenance

#### Check Registry Status

```bash
curl -H "Authorization: Bearer <token>" \
     http://localhost:8000/api/admin/providers/registry-status
```

#### Refresh Provider Registry

```bash
curl -X POST http://localhost:8000/api/admin/providers/refresh-registry \
  -H "Authorization: Bearer <token>"
```

## Error Handling

The API uses standard HTTP status codes and provides detailed error information:

### Common Error Responses

#### 400 Bad Request
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Provider identifier must be lowercase alphanumeric with hyphens only",
    "field": "identifier",
    "suggestions": ["Use format: my-provider-name"]
  },
  "timestamp": "2025-02-10T12:00:00Z",
  "requestId": "req-123456"
}
```

#### 401 Unauthorized
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired JWT token"
  },
  "timestamp": "2025-02-10T12:00:00Z",
  "requestId": "req-123456"
}
```

#### 403 Forbidden
```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "Admin role required for provider management"
  },
  "timestamp": "2025-02-10T12:00:00Z",
  "requestId": "req-123456"
}
```

#### 422 Validation Error
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "validationErrors": [
      {
        "field": "authConfig.fields.apiKey",
        "message": "API key is required for api_key authentication",
        "value": null
      }
    ]
  },
  "timestamp": "2025-02-10T12:00:00Z",
  "requestId": "req-123456"
}
```

### Error Handling Best Practices

1. **Always check status codes** before processing responses
2. **Log request IDs** for debugging and support
3. **Handle rate limiting** with exponential backoff
4. **Validate input** before sending requests
5. **Use error suggestions** when provided

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- **100 requests per 15-minute window** per IP address
- **Rate limit headers** included in responses:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining in window
  - `X-RateLimit-Reset`: Time when window resets

### Handling Rate Limits

```javascript
async function makeAPIRequest(url, options) {
  const response = await fetch(url, options);
  
  if (response.status === 429) {
    const resetTime = response.headers.get('X-RateLimit-Reset');
    const waitTime = new Date(resetTime) - new Date();
    
    console.log(`Rate limited. Waiting ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Retry the request
    return makeAPIRequest(url, options);
  }
  
  return response;
}
```

## Best Practices

### 1. Provider Configuration

- **Use descriptive identifiers**: Choose clear, consistent naming conventions
- **Test before deployment**: Always test provider connectivity before making it active
- **Secure credentials**: Never log or expose API keys in client-side code
- **Monitor health**: Regularly check provider status and performance

### 2. Model Management

- **Keep models updated**: Regularly sync with provider's available models
- **Set appropriate limits**: Configure context lengths based on actual model capabilities
- **Use pricing info**: Include pricing information for cost tracking
- **Test model availability**: Verify models are accessible before making them available

### 3. Template Usage

- **Create reusable templates**: Build templates for common provider configurations
- **Document customizations**: Clearly document required customization parameters
- **Version templates**: Keep track of template versions for consistency
- **Test template applications**: Verify templates create working providers

### 4. Security

- **Rotate credentials**: Regularly rotate API keys and authentication tokens
- **Use environment variables**: Store sensitive configuration in environment variables
- **Audit access**: Monitor who creates and modifies provider configurations
- **Validate inputs**: Always validate configuration data before saving

## Code Examples

### JavaScript/Node.js Integration

```javascript
class DynamicProviderClient {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async createProvider(config) {
    const response = await fetch(`${this.baseURL}/admin/providers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create provider: ${error.error.message}`);
    }

    return response.json();
  }

  async testProvider(providerId) {
    const response = await fetch(`${this.baseURL}/admin/providers/${providerId}/test`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    return response.json();
  }

  async addModel(providerId, modelConfig) {
    const response = await fetch(`${this.baseURL}/admin/providers/${providerId}/models`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(modelConfig)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to add model: ${error.error.message}`);
    }

    return response.json();
  }
}

// Usage example
const client = new DynamicProviderClient('http://localhost:8000/api', 'your-jwt-token');

async function setupNewProvider() {
  try {
    // Create provider
    const provider = await client.createProvider({
      identifier: 'my-anthropic',
      name: 'My Anthropic Provider',
      apiEndpoint: 'https://api.anthropic.com',
      authMethod: 'api_key',
      authConfig: {
        type: 'api_key',
        fields: { apiKey: process.env.ANTHROPIC_API_KEY },
        headers: { 'x-api-key': '{{apiKey}}' }
      },
      capabilities: {
        supportsSystemMessages: true,
        maxContextLength: 200000,
        supportedRoles: ['system', 'user', 'assistant'],
        supportsStreaming: true,
        supportsTools: true
      }
    });

    // Test connectivity
    const testResult = await client.testProvider(provider.id);
    if (!testResult.success) {
      throw new Error(`Provider test failed: ${testResult.errors.join(', ')}`);
    }

    // Add models
    await client.addModel(provider.id, {
      identifier: 'claude-3-opus-20240229',
      name: 'Claude 3 Opus',
      contextLength: 200000,
      capabilities: {
        supportsSystemMessages: true,
        maxContextLength: 200000,
        supportedRoles: ['system', 'user', 'assistant'],
        supportsStreaming: true,
        supportsTools: true,
        supportsFunctionCalling: true
      }
    });

    console.log('Provider setup completed successfully');
  } catch (error) {
    console.error('Provider setup failed:', error.message);
  }
}
```

### Python Integration

```python
import requests
import json
from typing import Dict, Any, Optional

class DynamicProviderClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    def create_provider(self, config: Dict[str, Any]) -> Dict[str, Any]:
        response = requests.post(
            f'{self.base_url}/admin/providers',
            headers=self.headers,
            json=config
        )
        response.raise_for_status()
        return response.json()

    def test_provider(self, provider_id: str) -> Dict[str, Any]:
        response = requests.post(
            f'{self.base_url}/admin/providers/{provider_id}/test',
            headers=self.headers
        )
        return response.json()

    def add_model(self, provider_id: str, model_config: Dict[str, Any]) -> Dict[str, Any]:
        response = requests.post(
            f'{self.base_url}/admin/providers/{provider_id}/models',
            headers=self.headers,
            json=model_config
        )
        response.raise_for_status()
        return response.json()

    def export_providers(self, include_models: bool = True) -> Dict[str, Any]:
        response = requests.post(
            f'{self.base_url}/admin/providers/export',
            headers=self.headers,
            json={'includeModels': include_models}
        )
        response.raise_for_status()
        return response.json()

# Usage example
client = DynamicProviderClient('http://localhost:8000/api', 'your-jwt-token')

def setup_openai_provider():
    try:
        provider_config = {
            'identifier': 'my-openai',
            'name': 'My OpenAI Provider',
            'apiEndpoint': 'https://api.openai.com/v1',
            'authMethod': 'api_key',
            'authConfig': {
                'type': 'api_key',
                'fields': {'apiKey': os.environ['OPENAI_API_KEY']},
                'headers': {'Authorization': 'Bearer {{apiKey}}'}
            },
            'capabilities': {
                'supportsSystemMessages': True,
                'maxContextLength': 128000,
                'supportedRoles': ['system', 'user', 'assistant'],
                'supportsStreaming': True,
                'supportsTools': True
            }
        }

        provider = client.create_provider(provider_config)
        print(f"Created provider: {provider['id']}")

        # Test the provider
        test_result = client.test_provider(provider['id'])
        if not test_result['success']:
            raise Exception(f"Provider test failed: {test_result['errors']}")

        print("Provider setup completed successfully")
        return provider

    except requests.exceptions.HTTPError as e:
        print(f"HTTP error: {e.response.status_code} - {e.response.text}")
    except Exception as e:
        print(f"Error: {str(e)}")
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Authentication Failures

**Problem**: Getting 401 Unauthorized errors

**Solutions**:
- Verify JWT token is valid and not expired
- Check that user has admin role
- Ensure Authorization header format is correct: `Bearer <token>`
- Try refreshing the token using `/auth/refresh` endpoint

#### 2. Provider Connectivity Issues

**Problem**: Provider test fails with connection errors

**Solutions**:
- Verify API endpoint URL is correct and accessible
- Check authentication credentials are valid
- Ensure network connectivity to provider's API
- Verify provider's API is operational
- Check for rate limiting or IP restrictions

#### 3. Model Configuration Errors

**Problem**: Models not appearing or failing tests

**Solutions**:
- Verify model identifier matches provider's API
- Check model capabilities are correctly configured
- Ensure context length is within provider limits
- Verify model is active and available from provider

#### 4. Import/Export Issues

**Problem**: Import fails with validation errors

**Solutions**:
- Validate JSON format before importing
- Check for missing required fields
- Ensure identifiers don't conflict with existing providers
- Verify authentication configurations are complete

#### 5. Registry Synchronization Issues

**Problem**: Changes not reflected in provider registry

**Solutions**:
- Manually refresh registry using `/admin/providers/refresh-registry`
- Check registry status for errors
- Verify database connectivity
- Restart application if registry is corrupted

### Debug Mode

Enable debug logging to get more detailed error information:

```bash
# Set environment variable for debug logging
export DEBUG=dynamic-providers:*

# Or in your application
process.env.DEBUG = 'dynamic-providers:*';
```

### Support and Contact

For additional support:
- Check the API documentation for endpoint details
- Review error messages and suggestions
- Contact support with request IDs for faster resolution
- Submit bug reports with reproduction steps

## Changelog

### Version 1.0.0 (2025-02-10)
- Initial release of Dynamic Provider Management API
- Support for provider, model, and template management
- Import/export functionality
- Registry management endpoints
- Comprehensive error handling and validation