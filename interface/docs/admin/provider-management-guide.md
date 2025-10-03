# Provider Management Admin Guide

## Overview

The Dynamic Provider Management system allows administrators to configure and manage LLM providers without requiring code changes. This guide covers all aspects of provider management, from initial setup to ongoing maintenance.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Provider Management](#provider-management)
3. [Model Management](#model-management)
4. [Template Management](#template-management)
5. [Monitoring and Health](#monitoring-and-health)
6. [Import/Export](#import-export)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

## Getting Started

### Prerequisites

- Admin role in the Prompt Library system
- Valid JWT authentication token
- Access to provider API credentials (API keys, etc.)
- Understanding of LLM provider capabilities

### Accessing Provider Management

1. **Web Interface**: Navigate to Admin → Provider Management
2. **API Access**: Use the `/api/admin/providers` endpoints
3. **Required Permissions**: Admin role is required for all provider management operations

### Initial Setup

The system comes with pre-configured system providers (OpenAI, Anthropic, etc.). You can:
- Modify system provider configurations
- Add new custom providers
- Create provider templates for reuse

## Provider Management

### Understanding Providers

A provider represents an LLM service (like OpenAI, Anthropic, etc.) with:
- **Identifier**: Unique code name (e.g., `openai-custom`)
- **Configuration**: API endpoint, authentication, capabilities
- **Models**: List of available models from this provider
- **Status**: Active, inactive, or testing

### Creating a New Provider

#### Using the Web Interface

1. Navigate to **Admin → Provider Management**
2. Click **"Add New Provider"**
3. Choose setup method:
   - **From Template**: Use pre-built configuration
   - **Custom Setup**: Manual configuration

#### Step-by-Step Provider Setup

**Step 1: Basic Information**
```
Provider Identifier: my-openai-provider
Display Name: My OpenAI Provider
Description: Custom OpenAI configuration for our organization
```

**Step 2: API Configuration**
```
API Endpoint: https://api.openai.com/v1
Authentication Method: API Key
```

**Step 3: Authentication Setup**
```
API Key: sk-your-api-key-here
Additional Headers: (optional)
  - Organization: org-your-org-id
```

**Step 4: Capabilities Configuration**
```
✅ Supports System Messages
✅ Supports Streaming
✅ Supports Tools/Functions
Max Context Length: 128000
Supported Roles: system, user, assistant
```

**Step 5: Test and Save**
- Click **"Test Connection"** to verify setup
- Review test results
- Click **"Save Provider"** if test passes

#### Using Templates

Templates provide pre-configured settings for popular providers:

1. **Select Template**: Choose from available templates (OpenAI, Anthropic, etc.)
2. **Customize Settings**: Provide required values (API keys, endpoints)
3. **Review Configuration**: Verify all settings are correct
4. **Test and Save**: Test connectivity and save

### Managing Existing Providers

#### Provider Dashboard

The provider dashboard shows:
- **Status Indicators**: Green (healthy), Yellow (degraded), Red (error)
- **Model Count**: Number of configured models
- **Last Tested**: When connectivity was last verified
- **Usage Statistics**: Request counts and performance metrics

#### Provider Actions

**Edit Provider**
- Modify configuration, credentials, or capabilities
- Changes trigger automatic registry refresh
- Test connectivity after changes

**Test Provider**
- Verify API connectivity and authentication
- Check available models from provider
- Validate configured capabilities

**Delete Provider**
- Only possible if no active connections exist
- System providers cannot be deleted
- Confirmation required for safety

**Enable/Disable Provider**
- Temporarily disable without deleting
- Disabled providers don't appear in connection options
- Can be re-enabled at any time

### Provider Status Management

#### Status Types

- **Active**: Provider is operational and available for use
- **Inactive**: Provider is disabled and not available
- **Testing**: Provider is being validated (temporary status)

#### Health Monitoring

The system automatically monitors provider health:
- **Periodic Health Checks**: Every 5 minutes
- **Response Time Tracking**: Monitor API performance
- **Error Rate Monitoring**: Track failed requests
- **Automatic Status Updates**: Update status based on health

#### Alerts and Notifications

Configure alerts for:
- Provider connectivity failures
- Performance degradation
- Authentication errors
- Rate limit warnings

## Model Management

### Understanding Models

Models represent specific AI models available from a provider:
- **Identifier**: Model name used in API calls (e.g., `gpt-4`)
- **Capabilities**: What the model can do (context length, features)
- **Pricing**: Cost information for usage tracking
- **Status**: Active, inactive, or deprecated

### Adding Models to Providers

#### Automatic Model Discovery

When testing a provider, the system can automatically discover available models:

1. **Test Provider**: Click "Test Connection" on provider
2. **Review Discovered Models**: See list of available models
3. **Select Models**: Choose which models to add
4. **Configure Capabilities**: Set context length and features
5. **Save Models**: Add selected models to provider

#### Manual Model Addition

For custom or specialized models:

1. **Navigate to Provider**: Go to provider details page
2. **Click "Add Model"**: Start model creation process
3. **Configure Model**:
   ```
   Model Identifier: gpt-4-turbo
   Display Name: GPT-4 Turbo
   Description: Latest GPT-4 model with improved performance
   Context Length: 128000
   ```
4. **Set Capabilities**:
   ```
   ✅ System Messages
   ✅ Streaming
   ✅ Function Calling
   ✅ Tool Use
   ❌ Vision (if not supported)
   ❌ Audio (if not supported)
   ```
5. **Add Pricing** (optional):
   ```
   Input Token Price: $0.01 per 1K tokens
   Output Token Price: $0.03 per 1K tokens
   Currency: USD
   ```

### Model Configuration Best Practices

#### Context Length Settings

- **Use Actual Limits**: Set context length to model's actual capacity
- **Consider Performance**: Larger contexts may be slower
- **Test Thoroughly**: Verify context length with actual usage

#### Capability Configuration

- **Be Accurate**: Only enable capabilities the model actually supports
- **Test Features**: Verify each capability works correctly
- **Update Regularly**: Keep capabilities current with model updates

#### Pricing Information

- **Include All Costs**: Input tokens, output tokens, additional features
- **Keep Updated**: Regularly update pricing as providers change rates
- **Use for Budgeting**: Help users understand usage costs

### Bulk Model Operations

#### Adding Multiple Models

Use the bulk import feature to add many models at once:

1. **Prepare CSV/JSON**: Create file with model definitions
2. **Use Import Tool**: Navigate to Models → Import
3. **Map Fields**: Ensure all required fields are mapped
4. **Validate Data**: Review import preview
5. **Execute Import**: Import all models

#### Model Synchronization

Keep models synchronized with provider changes:

1. **Regular Sync**: Schedule periodic model list updates
2. **Deprecation Handling**: Mark old models as deprecated
3. **New Model Detection**: Automatically detect new models
4. **Capability Updates**: Update model capabilities as needed

## Template Management

### Understanding Templates

Templates are pre-configured provider setups that can be reused:
- **System Templates**: Built-in templates for popular providers
- **Custom Templates**: User-created templates for specific needs
- **Parameterized**: Allow customization during application

### Using System Templates

System templates are provided for popular providers:

#### Available System Templates

- **OpenAI Template**: Standard OpenAI configuration
- **Anthropic Template**: Claude API configuration
- **AWS Bedrock Template**: Amazon Bedrock setup
- **Azure OpenAI Template**: Microsoft Azure OpenAI
- **Google AI Template**: Google AI Platform
- **Cohere Template**: Cohere API configuration

#### Applying System Templates

1. **Select Template**: Choose from template library
2. **Provide Credentials**: Enter API keys and authentication
3. **Customize Settings**: Modify endpoints or capabilities if needed
4. **Test Configuration**: Verify setup works correctly
5. **Save Provider**: Create provider from template

### Creating Custom Templates

Create reusable templates for your organization:

#### Template Creation Process

1. **Start from Existing**: Use working provider as base
2. **Parameterize Values**: Replace specific values with parameters
3. **Define Parameters**: Specify required customization fields
4. **Test Template**: Verify template application works
5. **Save Template**: Make available for reuse

#### Template Configuration Example

```json
{
  "name": "Custom OpenAI Template",
  "description": "OpenAI template with organization settings",
  "providerConfig": {
    "apiEndpoint": "https://api.openai.com/v1",
    "authMethod": "api_key",
    "authConfig": {
      "type": "api_key",
      "fields": {
        "apiKey": "{{API_KEY}}",
        "organizationId": "{{ORG_ID}}"
      },
      "headers": {
        "Authorization": "Bearer {{API_KEY}}",
        "OpenAI-Organization": "{{ORG_ID}}"
      }
    },
    "capabilities": {
      "supportsSystemMessages": true,
      "maxContextLength": 128000,
      "supportsStreaming": true,
      "supportsTools": true
    }
  },
  "defaultModels": [
    {
      "identifier": "gpt-4",
      "name": "GPT-4",
      "contextLength": 8192
    },
    {
      "identifier": "gpt-3.5-turbo",
      "name": "GPT-3.5 Turbo",
      "contextLength": 4096
    }
  ],
  "parameters": [
    {
      "name": "API_KEY",
      "description": "OpenAI API Key",
      "required": true,
      "type": "string",
      "sensitive": true
    },
    {
      "name": "ORG_ID",
      "description": "OpenAI Organization ID",
      "required": false,
      "type": "string"
    }
  ]
}
```

### Template Management Best Practices

#### Template Organization

- **Categorize Templates**: Group by provider type or use case
- **Version Control**: Track template versions and changes
- **Documentation**: Document template purpose and usage
- **Testing**: Regularly test templates to ensure they work

#### Parameter Design

- **Clear Names**: Use descriptive parameter names
- **Required vs Optional**: Clearly mark required parameters
- **Validation**: Add validation rules for parameters
- **Sensitive Data**: Mark sensitive parameters appropriately

## Monitoring and Health

### Provider Health Dashboard

The health dashboard provides real-time monitoring:

#### Key Metrics

- **Response Time**: Average API response times
- **Success Rate**: Percentage of successful requests
- **Error Rate**: Frequency of failed requests
- **Availability**: Uptime percentage over time periods

#### Health Status Indicators

- **🟢 Healthy**: All systems operational
- **🟡 Degraded**: Some issues but functional
- **🔴 Error**: Significant problems or offline

### Setting Up Monitoring

#### Health Check Configuration

Configure automatic health monitoring:

1. **Check Frequency**: Set how often to test providers (default: 5 minutes)
2. **Timeout Settings**: Configure request timeout limits
3. **Retry Logic**: Set retry attempts for failed checks
4. **Alert Thresholds**: Define when to trigger alerts

#### Alert Configuration

Set up alerts for various conditions:

**Connectivity Alerts**
- Provider becomes unreachable
- Authentication failures
- SSL/TLS certificate issues

**Performance Alerts**
- Response time exceeds threshold
- Error rate above acceptable level
- Rate limiting detected

**Configuration Alerts**
- Model availability changes
- Capability mismatches detected
- Configuration validation failures

### Performance Optimization

#### Response Time Optimization

- **Connection Pooling**: Reuse HTTP connections
- **Request Batching**: Combine multiple operations
- **Caching**: Cache provider responses when appropriate
- **Geographic Proximity**: Use regional endpoints when available

#### Error Rate Reduction

- **Retry Logic**: Implement exponential backoff
- **Circuit Breakers**: Prevent cascade failures
- **Graceful Degradation**: Handle provider outages gracefully
- **Fallback Providers**: Configure backup providers

## Import/Export

### Exporting Provider Configurations

Export configurations for backup or migration:

#### Export Options

**Full Export**
- All providers and models
- Templates and configurations
- Excludes sensitive credentials

**Selective Export**
- Choose specific providers
- Include/exclude models
- Include/exclude templates

#### Export Process

1. **Navigate to Export**: Admin → Provider Management → Export
2. **Select Options**: Choose what to export
3. **Generate Export**: Create export file
4. **Download File**: Save configuration backup

#### Export File Format

```json
{
  "metadata": {
    "exportedAt": "2025-02-10T12:00:00Z",
    "exportedBy": "admin@example.com",
    "version": "1.0.0"
  },
  "providers": [
    {
      "identifier": "my-openai",
      "name": "My OpenAI Provider",
      "apiEndpoint": "https://api.openai.com/v1",
      "authMethod": "api_key",
      "capabilities": {...},
      "models": [...]
    }
  ],
  "templates": [...]
}
```

### Importing Provider Configurations

Import configurations from backup or other systems:

#### Import Process

1. **Prepare Import File**: Ensure file is in correct format
2. **Navigate to Import**: Admin → Provider Management → Import
3. **Upload File**: Select configuration file
4. **Review Preview**: Check what will be imported
5. **Configure Options**: Set conflict resolution
6. **Execute Import**: Import configurations

#### Conflict Resolution Options

**Merge** (Default)
- Update existing providers with new data
- Keep existing data where not specified
- Add new providers and models

**Replace**
- Completely replace existing providers
- Remove data not in import file
- Use with caution

**Skip**
- Skip providers that already exist
- Only import new providers
- Safest option for partial imports

#### Import Validation

The system validates all imported data:
- **Schema Validation**: Ensures correct data format
- **Identifier Conflicts**: Checks for duplicate identifiers
- **Capability Validation**: Verifies capability configurations
- **Authentication Validation**: Checks auth config completeness

### Backup and Recovery

#### Regular Backups

Set up automated backups:

1. **Schedule Exports**: Automate regular configuration exports
2. **Store Securely**: Keep backups in secure, accessible location
3. **Test Restores**: Regularly test backup restoration
4. **Version Control**: Keep multiple backup versions

#### Disaster Recovery

Plan for system recovery:

1. **Document Process**: Create step-by-step recovery procedures
2. **Test Procedures**: Regularly test recovery processes
3. **Backup Credentials**: Securely store authentication credentials
4. **Communication Plan**: Define who to notify during recovery

## Best Practices

### Security Best Practices

#### Credential Management

- **Secure Storage**: Use environment variables or secure vaults
- **Regular Rotation**: Rotate API keys and credentials regularly
- **Least Privilege**: Use credentials with minimal required permissions
- **Audit Access**: Monitor who accesses and modifies credentials

#### Access Control

- **Admin Only**: Restrict provider management to admin users
- **Audit Logging**: Log all provider configuration changes
- **Change Approval**: Consider approval workflows for changes
- **Regular Reviews**: Periodically review admin access

### Operational Best Practices

#### Configuration Management

- **Documentation**: Document all provider configurations
- **Change Control**: Use controlled process for changes
- **Testing**: Test all changes in non-production first
- **Rollback Plans**: Have rollback procedures ready

#### Monitoring and Alerting

- **Comprehensive Monitoring**: Monitor all critical metrics
- **Appropriate Alerts**: Set meaningful alert thresholds
- **Response Procedures**: Define response to different alerts
- **Regular Reviews**: Review and update monitoring setup

#### Performance Management

- **Capacity Planning**: Monitor usage and plan for growth
- **Resource Optimization**: Optimize provider configurations
- **Cost Management**: Track and optimize provider costs
- **User Experience**: Monitor impact on user experience

### Maintenance Best Practices

#### Regular Tasks

**Daily**
- Check provider health dashboard
- Review any alerts or errors
- Monitor performance metrics

**Weekly**
- Review provider usage statistics
- Check for new models or capabilities
- Update any deprecated configurations

**Monthly**
- Review and update provider credentials
- Analyze performance trends
- Update documentation as needed

**Quarterly**
- Comprehensive security review
- Backup and recovery testing
- Provider cost analysis and optimization

#### Change Management

**Planning Changes**
- Document proposed changes
- Assess impact and risks
- Plan testing procedures
- Prepare rollback plans

**Implementing Changes**
- Test in development environment
- Use staged rollout approach
- Monitor during and after changes
- Document actual results

**Post-Change Review**
- Verify changes work as expected
- Monitor for any issues
- Update documentation
- Learn from any problems

## Troubleshooting

### Common Issues

#### Provider Connection Failures

**Symptoms**: Provider tests fail, connection errors

**Troubleshooting Steps**:
1. Verify API endpoint URL is correct
2. Check authentication credentials
3. Test network connectivity
4. Review provider's service status
5. Check for rate limiting

**Solutions**:
- Update credentials if expired
- Fix network or firewall issues
- Contact provider support if needed

#### Model Availability Issues

**Symptoms**: Models not appearing, test failures

**Troubleshooting Steps**:
1. Check model identifier spelling
2. Verify model is available from provider
3. Test model directly with provider API
4. Check model status in system

**Solutions**:
- Correct model identifier
- Update to available model version
- Contact provider about model access

#### Performance Problems

**Symptoms**: Slow responses, timeouts

**Troubleshooting Steps**:
1. Check system resource usage
2. Monitor database performance
3. Review network connectivity
4. Check provider API performance

**Solutions**:
- Optimize database queries
- Increase system resources
- Implement caching
- Contact provider about performance

### Getting Help

#### Support Resources

- **Documentation**: Comprehensive guides and references
- **API Documentation**: Detailed endpoint documentation
- **Troubleshooting Guide**: Common issues and solutions
- **Community Forums**: User community discussions

#### Contacting Support

When contacting support, include:
- Detailed error messages
- Steps to reproduce the issue
- System configuration details
- Recent changes made

#### Diagnostic Information

Useful information for troubleshooting:
- Provider test results
- System health status
- Recent error logs
- Network connectivity tests

This admin guide provides comprehensive information for managing the Dynamic Provider Management system. Regular review and updates ensure optimal system performance and security.