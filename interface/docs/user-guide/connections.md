# Managing LLM Connections

This guide covers everything you need to know about setting up and managing connections to Large Language Model (LLM) providers in the Professional Interface.

## Overview

LLM connections allow you to integrate with various AI providers to enhance prompts and generate provider-specific outputs. The system supports dynamic provider management, allowing administrators to configure new providers without code changes. Currently available providers include:

- **OpenAI** - GPT models including GPT-4, GPT-3.5-turbo, and newer variants
- **Anthropic** - Claude models (Opus, Sonnet, Haiku) with large context windows
- **AWS Bedrock** - Claude, Titan, Jurassic, and other foundation models
- **Azure OpenAI** - Microsoft's hosted OpenAI models
- **Google AI Platform** - PaLM and other Google models
- **Cohere** - Command and other Cohere models
- **Custom Providers** - Any OpenAI-compatible API or custom LLM service

> **Note**: Available providers depend on your system configuration. Contact your administrator to add new providers or if you need access to specific models.

## Understanding LLM Connections

### What are LLM Connections?

LLM connections are secure configurations that store:
- **Provider credentials** (API keys, access tokens)
- **Model preferences** and availability
- **Connection settings** (timeouts, regions)
- **Usage quotas** and rate limits

### Security Features

- **Encryption at Rest** - All credentials encrypted with AES-256-GCM
- **Secure Transmission** - TLS 1.3 for all API communications
- **Access Control** - Only you and admins can view your connections
- **Audit Logging** - All connection activities are logged

## Dynamic Provider System

### How It Works

The system now uses a dynamic provider management approach:

1. **Administrators Configure Providers**: System admins set up and manage available providers
2. **Users Create Connections**: You create connections using the configured providers
3. **Automatic Updates**: New models and capabilities are automatically available
4. **Centralized Management**: Consistent configuration across all users

### Provider vs Connection

- **Provider**: The LLM service configuration (managed by admins)
- **Connection**: Your personal credentials and preferences for using a provider

For detailed provider setup information, see the [Provider Setup Tutorials](provider-setup-tutorials.md).

## Setting Up OpenAI Connections

### Prerequisites

Before setting up an OpenAI connection, you need:
1. **OpenAI Account** - Sign up at [platform.openai.com](https://platform.openai.com)
2. **API Key** - Generate from your OpenAI dashboard
3. **Organization ID** (optional) - For organization-based billing

### Step-by-Step Setup

#### 1. Navigate to Connections
1. Click **"Connections"** in the sidebar
2. Click **"Add Connection"** button
3. Select **"OpenAI"** as the provider

#### 2. Basic Configuration
- **Connection Name**: Give it a descriptive name (e.g., "My OpenAI GPT-4")
- **Description**: Optional description for team members

#### 3. Authentication Settings
- **API Key**: Paste your OpenAI API key
  ```
  sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```
- **Organization ID** (optional): Your OpenAI organization ID
  ```
  org-xxxxxxxxxxxxxxxxxxxxxxxx
  ```

#### 4. Model Configuration
- **Available Models**: The system will auto-detect available models
- **Default Model**: Choose your preferred default (e.g., `gpt-4`, `gpt-3.5-turbo`)
- **Custom Base URL** (optional): For OpenAI-compatible APIs

#### 5. Advanced Settings
- **Request Timeout**: Default 30 seconds
- **Max Retries**: Number of retry attempts (default: 3)
- **Rate Limiting**: Requests per minute (optional)

#### 6. Test and Save
1. Click **"Test Connection"** to verify setup
2. Review test results (latency, available models)
3. Click **"Save"** to store the connection

### OpenAI Configuration Examples

#### Basic Configuration
```
Name: OpenAI GPT-4
API Key: sk-proj-abc123...
Organization ID: (leave blank for personal accounts)
Default Model: gpt-4
```

#### Organization Configuration
```
Name: Company OpenAI Account
API Key: sk-proj-xyz789...
Organization ID: org-company123
Default Model: gpt-4-turbo-preview
```

#### Custom Endpoint Configuration
```
Name: Azure OpenAI Service
API Key: your-azure-key
Base URL: https://your-resource.openai.azure.com/
Default Model: gpt-4
```

## Setting Up AWS Bedrock Connections

### Prerequisites

Before setting up AWS Bedrock, you need:
1. **AWS Account** with Bedrock access
2. **IAM User** with appropriate permissions
3. **Access Keys** (Access Key ID and Secret Access Key)
4. **Region** where Bedrock is available

### Required AWS Permissions

Your IAM user needs these permissions:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:ListFoundationModels",
                "bedrock:GetFoundationModel"
            ],
            "Resource": "*"
        }
    ]
}
```

### Step-by-Step Setup

#### 1. Create Connection
1. Go to **Connections** page
2. Click **"Add Connection"**
3. Select **"AWS Bedrock"** as provider

#### 2. Basic Information
- **Connection Name**: Descriptive name (e.g., "AWS Bedrock Claude")
- **Description**: Optional team description

#### 3. AWS Credentials
- **Access Key ID**: Your AWS access key
  ```
  AKIAIOSFODNN7EXAMPLE
  ```
- **Secret Access Key**: Your AWS secret key
  ```
  wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
  ```
- **Region**: AWS region (e.g., `us-east-1`, `us-west-2`)

#### 4. Model Selection
- **Available Models**: Auto-detected based on region and permissions
- **Default Model**: Choose preferred model (e.g., `anthropic.claude-v2`)

#### 5. Advanced Configuration
- **Request Timeout**: Default 60 seconds (Bedrock can be slower)
- **Max Tokens**: Default maximum tokens per request
- **Temperature**: Default creativity setting (0.0-1.0)

#### 6. Test and Save
1. Click **"Test Connection"**
2. Verify model access and latency
3. Save the connection

### AWS Bedrock Configuration Examples

#### Basic Claude Configuration
```
Name: AWS Bedrock Claude
Access Key ID: AKIA...
Secret Access Key: wJal...
Region: us-east-1
Default Model: anthropic.claude-v2
```

#### Multi-Model Configuration
```
Name: AWS Bedrock Multi-Model
Access Key ID: AKIA...
Secret Access Key: wJal...
Region: us-west-2
Default Model: anthropic.claude-instant-v1
Available Models: Claude, Titan, Jurassic
```

## Managing Existing Connections

### Viewing Connections

The Connections page shows all your configured connections with:
- **Status Indicators**: Green (active), Yellow (warning), Red (error)
- **Last Test Results**: When connection was last verified
- **Usage Statistics**: Recent activity and performance
- **Model Information**: Available and default models

### Connection Status Indicators

#### 🟢 Active (Green)
- Connection tested successfully
- All credentials valid
- Models accessible
- Good performance

#### 🟡 Warning (Yellow)
- Connection works but has issues
- Slow response times
- Limited model access
- Quota warnings

#### 🔴 Error (Red)
- Connection failed
- Invalid credentials
- Network issues
- Service unavailable

### Editing Connections

#### To Edit a Connection:
1. Find the connection in the list
2. Click the **"Edit"** button (pencil icon)
3. Modify settings as needed
4. Test the updated configuration
5. Save changes

#### Common Edits:
- **Update API keys** when they expire or rotate
- **Change default models** based on needs
- **Adjust timeouts** for performance
- **Update descriptions** for team clarity

### Testing Connections

#### Manual Testing
1. Click **"Test"** button next to any connection
2. View real-time test results:
   - **Connectivity**: Can reach the provider
   - **Authentication**: Credentials are valid
   - **Model Access**: Available models list
   - **Performance**: Response time and latency

#### Automatic Testing
- Connections are tested automatically every 24 hours
- Failed tests trigger notifications
- Test history is maintained for troubleshooting

### Deleting Connections

#### Before Deleting:
- Ensure no prompts depend on this connection
- Export any important configurations
- Notify team members if shared

#### To Delete:
1. Click **"Delete"** button (trash icon)
2. Confirm deletion in the dialog
3. Connection is permanently removed

> **Warning**: Deleting a connection cannot be undone. Any prompts configured to use this connection will need to be updated.

## Connection Best Practices

### Security Best Practices

#### API Key Management
- **Rotate keys regularly** (every 90 days recommended)
- **Use separate keys** for different environments
- **Monitor usage** for unusual activity
- **Revoke compromised keys** immediately

#### Access Control
- **Limit sharing** of connection details
- **Use descriptive names** without sensitive info
- **Regular audits** of who has access
- **Document usage** for compliance

### Performance Optimization

#### Model Selection
- **Choose appropriate models** for your use case
- **Consider cost vs. performance** trade-offs
- **Test different models** for comparison
- **Monitor usage patterns** and costs

#### Configuration Tuning
- **Adjust timeouts** based on typical response times
- **Set appropriate retry limits** to handle failures
- **Configure rate limits** to avoid quota issues
- **Monitor and optimize** based on usage patterns

### Team Collaboration

#### Naming Conventions
Use consistent naming patterns:
```
[Provider]-[Model]-[Environment]-[Purpose]
Examples:
- OpenAI-GPT4-Prod-Marketing
- Bedrock-Claude-Dev-Testing
- OpenAI-GPT35-Shared-General
```

#### Documentation
- **Document purpose** and intended use
- **Note any limitations** or special configurations
- **Keep contact info** for key owners
- **Maintain change logs** for important updates

## Troubleshooting Connection Issues

### Common Problems and Solutions

#### "Invalid API Key" Error
**Symptoms**: Authentication fails, 401 errors
**Solutions**:
1. Verify API key is correct and complete
2. Check if key has expired or been revoked
3. Ensure proper permissions are granted
4. Try regenerating the API key

#### "Connection Timeout" Error
**Symptoms**: Requests hang, timeout errors
**Solutions**:
1. Check internet connectivity
2. Increase timeout values
3. Verify provider service status
4. Test from different network

#### "Model Not Available" Error
**Symptoms**: Specific models can't be accessed
**Solutions**:
1. Check model availability in your region
2. Verify account has access to the model
3. Update to supported model names
4. Contact provider support for access

#### "Rate Limit Exceeded" Error
**Symptoms**: Too many requests error, 429 status
**Solutions**:
1. Reduce request frequency
2. Implement request queuing
3. Upgrade account limits
4. Distribute load across multiple connections

### Getting Help

#### Self-Diagnosis
1. **Test connection** using built-in test feature
2. **Check provider status** pages for outages
3. **Review error logs** in the interface
4. **Try different models** or settings

#### Support Resources
- **Provider documentation** (OpenAI, AWS)
- **System administrator** for account issues
- **Technical support** for interface problems
- **Community forums** for general questions

---

*Next: Learn about [Prompt Management](prompts.md) to start creating and organizing your prompts.*