# Provider Setup Tutorials

## Overview

This guide provides step-by-step tutorials for setting up popular LLM providers in the Dynamic Provider Management system. Each tutorial includes specific configuration details, common pitfalls, and best practices.

## Table of Contents

1. [OpenAI Setup](#openai-setup)
2. [Anthropic (Claude) Setup](#anthropic-claude-setup)
3. [AWS Bedrock Setup](#aws-bedrock-setup)
4. [Azure OpenAI Setup](#azure-openai-setup)
5. [Google AI Platform Setup](#google-ai-platform-setup)
6. [Cohere Setup](#cohere-setup)
7. [Custom Provider Setup](#custom-provider-setup)
8. [Troubleshooting Common Issues](#troubleshooting-common-issues)

## OpenAI Setup

### Prerequisites

- OpenAI account with API access
- Valid API key from OpenAI dashboard
- (Optional) Organization ID for team accounts

### Step-by-Step Setup

#### Method 1: Using Template (Recommended)

1. **Navigate to Provider Management**
   - Go to Admin → Provider Management
   - Click "Add New Provider"
   - Select "Use Template"

2. **Choose OpenAI Template**
   - Select "OpenAI" from template list
   - Click "Use This Template"

3. **Configure Provider Details**
   ```
   Provider Identifier: openai-main
   Display Name: OpenAI Main
   Description: Primary OpenAI provider for the organization
   ```

4. **Enter Authentication Details**
   ```
   API Key: sk-your-api-key-here
   Organization ID: org-your-org-id (optional)
   ```

5. **Review Configuration**
   - API Endpoint: `https://api.openai.com/v1`
   - Authentication Method: API Key
   - Capabilities: All OpenAI features enabled

6. **Test and Save**
   - Click "Test Connection"
   - Verify test passes
   - Click "Save Provider"

#### Method 2: Manual Configuration

1. **Basic Information**
   ```
   Provider Identifier: openai-custom
   Display Name: Custom OpenAI
   Description: Custom OpenAI configuration
   API Endpoint: https://api.openai.com/v1
   Authentication Method: API Key
   ```

2. **Authentication Configuration**
   ```json
   {
     "type": "api_key",
     "fields": {
       "apiKey": "sk-your-api-key-here",
       "organizationId": "org-your-org-id"
     },
     "headers": {
       "Authorization": "Bearer {{apiKey}}",
       "OpenAI-Organization": "{{organizationId}}"
     }
   }
   ```

3. **Capabilities Configuration**
   ```
   ✅ Supports System Messages
   ✅ Supports Streaming
   ✅ Supports Tools/Functions
   Max Context Length: 128000
   Supported Roles: system, user, assistant
   Rate Limits: 3500 RPM, 90000 TPM (adjust based on your plan)
   ```

### Adding OpenAI Models

The system will automatically discover available models when testing the provider. Common models include:

```
gpt-4-turbo-preview (128K context)
gpt-4 (8K context)
gpt-3.5-turbo (4K context)
gpt-3.5-turbo-16k (16K context)
```

### OpenAI Best Practices

- **API Key Security**: Store API keys securely, rotate regularly
- **Rate Limiting**: Configure appropriate rate limits based on your plan
- **Cost Monitoring**: Enable usage tracking to monitor costs
- **Model Selection**: Choose appropriate models for different use cases

### Common OpenAI Issues

**Issue**: Authentication failures
**Solution**: Verify API key is correct and has proper permissions

**Issue**: Rate limiting errors
**Solution**: Adjust rate limits in configuration or upgrade OpenAI plan

**Issue**: Model not available
**Solution**: Check if model is available in your OpenAI account

## Anthropic (Claude) Setup

### Prerequisites

- Anthropic account with API access
- Valid API key from Anthropic Console
- Understanding of Claude's capabilities and limitations

### Step-by-Step Setup

#### Using Anthropic Template

1. **Select Template**
   - Choose "Anthropic" template
   - Click "Use This Template"

2. **Configure Provider**
   ```
   Provider Identifier: anthropic-main
   Display Name: Anthropic Claude
   Description: Anthropic Claude API provider
   ```

3. **Authentication Setup**
   ```
   API Key: your-anthropic-api-key
   ```

4. **Review Configuration**
   - API Endpoint: `https://api.anthropic.com`
   - Authentication Method: API Key (x-api-key header)
   - Max Context: 200,000 tokens

#### Manual Configuration

1. **Basic Setup**
   ```
   Provider Identifier: anthropic-custom
   Display Name: Custom Anthropic
   API Endpoint: https://api.anthropic.com
   Authentication Method: API Key
   ```

2. **Authentication Configuration**
   ```json
   {
     "type": "api_key",
     "fields": {
       "apiKey": "your-anthropic-api-key"
     },
     "headers": {
       "x-api-key": "{{apiKey}}",
       "anthropic-version": "2023-06-01"
     }
   }
   ```

3. **Capabilities**
   ```
   ✅ Supports System Messages
   ✅ Supports Streaming
   ✅ Supports Tools (limited)
   Max Context Length: 200000
   Supported Roles: system, user, assistant
   ```

### Anthropic Models

Common Claude models:
```
claude-3-opus-20240229 (200K context)
claude-3-sonnet-20240229 (200K context)
claude-3-haiku-20240307 (200K context)
claude-2.1 (200K context)
claude-2.0 (100K context)
```

### Anthropic Best Practices

- **System Messages**: Use system messages effectively for better results
- **Context Management**: Leverage large context window for complex tasks
- **Safety Guidelines**: Follow Anthropic's usage policies
- **Version Headers**: Always include anthropic-version header

## AWS Bedrock Setup

### Prerequisites

- AWS account with Bedrock access
- IAM user or role with Bedrock permissions
- AWS credentials (Access Key ID and Secret Access Key)
- Enabled model access in AWS Bedrock console

### Step-by-Step Setup

#### Using AWS Bedrock Template

1. **Select Template**
   - Choose "AWS Bedrock" template
   - Click "Use This Template"

2. **Configure Provider**
   ```
   Provider Identifier: aws-bedrock
   Display Name: AWS Bedrock
   Description: AWS Bedrock managed AI service
   ```

3. **AWS Authentication**
   ```
   AWS Access Key ID: AKIA...
   AWS Secret Access Key: your-secret-key
   AWS Region: us-east-1
   ```

#### Manual Configuration

1. **Basic Setup**
   ```
   Provider Identifier: bedrock-custom
   Display Name: Custom AWS Bedrock
   API Endpoint: https://bedrock-runtime.us-east-1.amazonaws.com
   Authentication Method: AWS IAM
   ```

2. **Authentication Configuration**
   ```json
   {
     "type": "aws_iam",
     "fields": {
       "accessKeyId": "AKIA...",
       "secretAccessKey": "your-secret-key",
       "region": "us-east-1"
     }
   }
   ```

3. **Capabilities**
   ```
   ✅ Supports System Messages (model dependent)
   ✅ Supports Streaming
   ❌ Supports Tools (limited model support)
   Max Context Length: varies by model
   ```

### AWS Bedrock Models

Available models (must be enabled in AWS console):
```
anthropic.claude-3-opus-20240229-v1:0
anthropic.claude-3-sonnet-20240229-v1:0
anthropic.claude-v2:1
amazon.titan-text-express-v1
ai21.j2-ultra-v1
cohere.command-text-v14
meta.llama2-70b-chat-v1
```

### AWS Bedrock Best Practices

- **IAM Permissions**: Use least privilege IAM policies
- **Region Selection**: Choose region closest to your users
- **Model Access**: Enable only needed models to reduce costs
- **Cost Monitoring**: Set up CloudWatch billing alerts

### Required IAM Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:ListFoundationModels"
      ],
      "Resource": "*"
    }
  ]
}
```

## Azure OpenAI Setup

### Prerequisites

- Azure subscription with OpenAI service enabled
- Azure OpenAI resource created
- API key and endpoint from Azure portal
- Deployed models in Azure OpenAI Studio

### Step-by-Step Setup

#### Using Azure OpenAI Template

1. **Select Template**
   - Choose "Azure OpenAI" template
   - Click "Use This Template"

2. **Configure Provider**
   ```
   Provider Identifier: azure-openai
   Display Name: Azure OpenAI
   Description: Microsoft Azure OpenAI Service
   ```

3. **Azure Configuration**
   ```
   API Endpoint: https://your-resource.openai.azure.com
   API Key: your-azure-api-key
   API Version: 2023-12-01-preview
   ```

#### Manual Configuration

1. **Basic Setup**
   ```
   Provider Identifier: azure-openai-custom
   Display Name: Custom Azure OpenAI
   API Endpoint: https://your-resource.openai.azure.com
   Authentication Method: API Key
   ```

2. **Authentication Configuration**
   ```json
   {
     "type": "api_key",
     "fields": {
       "apiKey": "your-azure-api-key"
     },
     "headers": {
       "api-key": "{{apiKey}}"
     }
   }
   ```

### Azure OpenAI Models

Models must be deployed in Azure OpenAI Studio:
```
gpt-4 (deployment name: gpt-4)
gpt-35-turbo (deployment name: gpt-35-turbo)
text-embedding-ada-002 (deployment name: text-embedding-ada-002)
```

### Azure OpenAI Best Practices

- **Deployment Names**: Use consistent deployment names
- **Regional Availability**: Check model availability in your region
- **Quota Management**: Monitor and manage token quotas
- **Content Filtering**: Configure appropriate content filters

## Google AI Platform Setup

### Prerequisites

- Google Cloud Platform account
- AI Platform API enabled
- Service account with appropriate permissions
- Service account key file (JSON)

### Step-by-Step Setup

#### Using Google AI Template

1. **Select Template**
   - Choose "Google AI Platform" template
   - Click "Use This Template"

2. **Configure Provider**
   ```
   Provider Identifier: google-ai
   Display Name: Google AI Platform
   Description: Google AI Platform services
   ```

3. **Authentication Setup**
   ```
   Service Account Key: (upload JSON file or paste content)
   Project ID: your-gcp-project-id
   ```

#### Manual Configuration

1. **Basic Setup**
   ```
   Provider Identifier: google-ai-custom
   Display Name: Custom Google AI
   API Endpoint: https://aiplatform.googleapis.com
   Authentication Method: OAuth2
   ```

2. **Authentication Configuration**
   ```json
   {
     "type": "oauth2",
     "fields": {
       "serviceAccountKey": "service-account-json-content",
       "projectId": "your-gcp-project-id"
     }
   }
   ```

### Google AI Models

Available models:
```
text-bison@001
chat-bison@001
code-bison@001
codechat-bison@001
```

### Google AI Best Practices

- **Service Account Security**: Secure service account keys
- **Project Organization**: Use separate projects for different environments
- **API Quotas**: Monitor API usage and quotas
- **Regional Endpoints**: Use regional endpoints for better performance

## Cohere Setup

### Prerequisites

- Cohere account with API access
- Valid API key from Cohere dashboard
- Understanding of Cohere's model capabilities

### Step-by-Step Setup

#### Using Cohere Template

1. **Select Template**
   - Choose "Cohere" template
   - Click "Use This Template"

2. **Configure Provider**
   ```
   Provider Identifier: cohere-main
   Display Name: Cohere
   Description: Cohere language models
   ```

3. **Authentication Setup**
   ```
   API Key: your-cohere-api-key
   ```

#### Manual Configuration

1. **Basic Setup**
   ```
   Provider Identifier: cohere-custom
   Display Name: Custom Cohere
   API Endpoint: https://api.cohere.ai
   Authentication Method: API Key
   ```

2. **Authentication Configuration**
   ```json
   {
     "type": "api_key",
     "fields": {
       "apiKey": "your-cohere-api-key"
     },
     "headers": {
       "Authorization": "Bearer {{apiKey}}"
     }
   }
   ```

### Cohere Models

Available models:
```
command (4K context)
command-nightly (4K context)
command-light (4K context)
command-light-nightly (4K context)
```

### Cohere Best Practices

- **Model Selection**: Choose appropriate model for your use case
- **Rate Limiting**: Respect Cohere's rate limits
- **Cost Optimization**: Monitor usage to optimize costs
- **Feature Usage**: Leverage Cohere's unique features like embeddings

## Custom Provider Setup

### When to Use Custom Setup

- Provider not covered by existing templates
- Specialized or internal LLM services
- Custom authentication requirements
- Unique API endpoints or protocols

### Custom Provider Configuration

#### 1. Basic Information

```
Provider Identifier: custom-llm
Display Name: Custom LLM Provider
Description: Internal or specialized LLM service
API Endpoint: https://api.custom-llm.com/v1
```

#### 2. Authentication Methods

**API Key Authentication**
```json
{
  "type": "api_key",
  "fields": {
    "apiKey": "your-api-key"
  },
  "headers": {
    "Authorization": "Bearer {{apiKey}}"
  }
}
```

**Custom Header Authentication**
```json
{
  "type": "custom",
  "fields": {
    "token": "your-token",
    "clientId": "your-client-id"
  },
  "headers": {
    "X-API-Token": "{{token}}",
    "X-Client-ID": "{{clientId}}"
  }
}
```

**OAuth2 Authentication**
```json
{
  "type": "oauth2",
  "fields": {
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "tokenUrl": "https://auth.provider.com/token"
  }
}
```

#### 3. Capability Configuration

Define what your custom provider supports:

```json
{
  "supportsSystemMessages": true,
  "maxContextLength": 8192,
  "supportedRoles": ["system", "user", "assistant"],
  "supportsStreaming": false,
  "supportsTools": false,
  "supportedAuthMethods": ["api_key"],
  "rateLimits": {
    "requestsPerMinute": 60,
    "tokensPerMinute": 10000
  }
}
```

#### 4. Model Configuration

Add models available from your custom provider:

```json
{
  "identifier": "custom-model-v1",
  "name": "Custom Model v1",
  "description": "First version of custom model",
  "contextLength": 8192,
  "capabilities": {
    "supportsSystemMessages": true,
    "maxContextLength": 8192,
    "supportedRoles": ["system", "user", "assistant"],
    "supportsStreaming": false,
    "supportsTools": false,
    "supportsFunctionCalling": false
  }
}
```

### Testing Custom Providers

1. **Connectivity Test**: Verify basic API connectivity
2. **Authentication Test**: Confirm authentication works
3. **Model Test**: Test actual model inference
4. **Capability Verification**: Verify all claimed capabilities work

### Custom Provider Best Practices

- **Documentation**: Document all custom configurations
- **Testing**: Thoroughly test all capabilities
- **Monitoring**: Set up monitoring for custom providers
- **Versioning**: Version your custom provider configurations
- **Security**: Follow security best practices for authentication

## Troubleshooting Common Issues

### Authentication Problems

#### Issue: Invalid API Key
**Symptoms**: 401 Unauthorized errors
**Solutions**:
- Verify API key is correct
- Check key hasn't expired
- Ensure key has proper permissions
- Try regenerating the key

#### Issue: Wrong Authentication Method
**Symptoms**: Authentication failures despite correct credentials
**Solutions**:
- Verify authentication method matches provider requirements
- Check header format and names
- Review provider's authentication documentation

### Connectivity Issues

#### Issue: Connection Timeouts
**Symptoms**: Requests timeout, no response
**Solutions**:
- Check network connectivity
- Verify API endpoint URL
- Test from different network
- Check firewall settings

#### Issue: SSL/TLS Errors
**Symptoms**: Certificate errors, SSL handshake failures
**Solutions**:
- Update CA certificates
- Check system time/date
- Verify endpoint supports TLS 1.2+
- Test with curl or similar tool

### Configuration Problems

#### Issue: Model Not Found
**Symptoms**: Model tests fail, model unavailable
**Solutions**:
- Verify model identifier is correct
- Check model is available from provider
- Ensure model access permissions
- Update model list from provider

#### Issue: Capability Mismatches
**Symptoms**: Features don't work as expected
**Solutions**:
- Review provider documentation
- Test capabilities directly with provider API
- Update capability configuration
- Contact provider support

### Performance Issues

#### Issue: Slow Response Times
**Symptoms**: Long delays, timeouts
**Solutions**:
- Check provider service status
- Monitor network latency
- Optimize request size
- Consider regional endpoints

#### Issue: Rate Limiting
**Symptoms**: 429 errors, throttling
**Solutions**:
- Check rate limit configuration
- Implement exponential backoff
- Upgrade provider plan
- Distribute load across multiple providers

### Getting Help

#### Diagnostic Information

When seeking help, provide:
- Provider configuration (without sensitive data)
- Error messages and codes
- Test results and logs
- Network connectivity test results

#### Support Resources

- Provider documentation and support
- System troubleshooting guide
- Community forums and discussions
- Professional support services

This tutorial guide provides comprehensive setup instructions for popular LLM providers and guidance for custom configurations. Regular updates ensure compatibility with provider changes and new features.