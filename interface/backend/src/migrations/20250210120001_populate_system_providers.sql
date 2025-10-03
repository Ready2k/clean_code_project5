-- UP
-- Insert system providers based on existing hardcoded configurations

-- OpenAI Provider
INSERT INTO providers (
    identifier, 
    name, 
    description, 
    api_endpoint, 
    auth_method, 
    auth_config, 
    capabilities, 
    status, 
    is_system
) VALUES (
    'openai',
    'OpenAI',
    'OpenAI GPT models including GPT-4, GPT-4 Turbo, and GPT-3.5 Turbo',
    'https://api.openai.com/v1',
    'api_key',
    '{
        "type": "api_key",
        "fields": {
            "apiKey": {"required": true, "description": "OpenAI API Key"},
            "organizationId": {"required": false, "description": "Organization ID (optional)"},
            "baseUrl": {"required": false, "description": "Custom base URL (optional)"}
        },
        "headers": {
            "Authorization": "Bearer {{apiKey}}",
            "OpenAI-Organization": "{{organizationId}}"
        },
        "testEndpoint": "/models"
    }',
    '{
        "supportsSystemMessages": true,
        "maxContextLength": 128000,
        "supportedRoles": ["system", "user", "assistant"],
        "supportsStreaming": true,
        "supportsTools": true,
        "supportedAuthMethods": ["api_key"],
        "rateLimits": {
            "requestsPerMinute": 3500,
            "tokensPerMinute": 90000
        }
    }',
    'active',
    true
) ON CONFLICT (identifier) DO NOTHING;

-- Anthropic Provider (via AWS Bedrock)
INSERT INTO providers (
    identifier, 
    name, 
    description, 
    api_endpoint, 
    auth_method, 
    auth_config, 
    capabilities, 
    status, 
    is_system
) VALUES (
    'anthropic',
    'Anthropic',
    'Anthropic Claude models via direct API',
    'https://api.anthropic.com/v1',
    'api_key',
    '{
        "type": "api_key",
        "fields": {
            "apiKey": {"required": true, "description": "Anthropic API Key"}
        },
        "headers": {
            "x-api-key": "{{apiKey}}",
            "anthropic-version": "2023-06-01"
        },
        "testEndpoint": "/messages"
    }',
    '{
        "supportsSystemMessages": true,
        "maxContextLength": 200000,
        "supportedRoles": ["system", "user", "assistant"],
        "supportsStreaming": true,
        "supportsTools": true,
        "supportedAuthMethods": ["api_key"],
        "rateLimits": {
            "requestsPerMinute": 1000,
            "tokensPerMinute": 40000
        }
    }',
    'active',
    true
) ON CONFLICT (identifier) DO NOTHING;

-- AWS Bedrock Provider
INSERT INTO providers (
    identifier, 
    name, 
    description, 
    api_endpoint, 
    auth_method, 
    auth_config, 
    capabilities, 
    status, 
    is_system
) VALUES (
    'bedrock',
    'AWS Bedrock',
    'AWS Bedrock service with multiple model providers including Anthropic, Amazon Titan, AI21, Cohere, and Meta',
    'https://bedrock-runtime.{region}.amazonaws.com',
    'aws_iam',
    '{
        "type": "aws_iam",
        "fields": {
            "accessKeyId": {"required": true, "description": "AWS Access Key ID"},
            "secretAccessKey": {"required": true, "description": "AWS Secret Access Key"},
            "region": {"required": true, "description": "AWS Region"}
        },
        "testEndpoint": "/model/anthropic.claude-3-sonnet-20240229-v1:0/invoke"
    }',
    '{
        "supportsSystemMessages": true,
        "maxContextLength": 200000,
        "supportedRoles": ["system", "user", "assistant"],
        "supportsStreaming": true,
        "supportsTools": false,
        "supportedAuthMethods": ["aws_iam"],
        "rateLimits": {
            "requestsPerMinute": 1000,
            "tokensPerMinute": 50000
        }
    }',
    'active',
    true
) ON CONFLICT (identifier) DO NOTHING;

-- Microsoft Copilot (Azure OpenAI) Provider
INSERT INTO providers (
    identifier, 
    name, 
    description, 
    api_endpoint, 
    auth_method, 
    auth_config, 
    capabilities, 
    status, 
    is_system
) VALUES (
    'microsoft-copilot',
    'Microsoft Copilot (Azure OpenAI)',
    'Azure OpenAI Service with GPT models',
    'https://{endpoint}.openai.azure.com',
    'api_key',
    '{
        "type": "api_key",
        "fields": {
            "apiKey": {"required": true, "description": "Azure OpenAI API Key"},
            "endpoint": {"required": true, "description": "Azure OpenAI Endpoint"},
            "apiVersion": {"required": false, "description": "API Version", "default": "2023-12-01-preview"},
            "deploymentName": {"required": false, "description": "Deployment Name"}
        },
        "headers": {
            "api-key": "{{apiKey}}"
        },
        "testEndpoint": "/openai/deployments/{{deploymentName}}/chat/completions?api-version={{apiVersion}}"
    }',
    '{
        "supportsSystemMessages": true,
        "maxContextLength": 128000,
        "supportedRoles": ["system", "user", "assistant"],
        "supportsStreaming": true,
        "supportsTools": true,
        "supportedAuthMethods": ["api_key"],
        "rateLimits": {
            "requestsPerMinute": 3000,
            "tokensPerMinute": 80000
        }
    }',
    'active',
    true
) ON CONFLICT (identifier) DO NOTHING;

-- Insert models for OpenAI
DO $$
DECLARE
    openai_provider_id UUID;
BEGIN
    SELECT id INTO openai_provider_id FROM providers WHERE identifier = 'openai';
    
    INSERT INTO models (provider_id, identifier, name, description, context_length, capabilities, status, is_default) VALUES
    (openai_provider_id, 'gpt-4', 'GPT-4', 'Most capable GPT-4 model', 8192, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": true, "supportsFunctionCalling": true}', 'active', false),
    (openai_provider_id, 'gpt-4-turbo', 'GPT-4 Turbo', 'Latest GPT-4 Turbo model with improved performance', 128000, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": true, "supportsFunctionCalling": true, "supportsVision": true}', 'active', true),
    (openai_provider_id, 'gpt-4-turbo-preview', 'GPT-4 Turbo Preview', 'Preview version of GPT-4 Turbo', 128000, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": true, "supportsFunctionCalling": true}', 'active', false),
    (openai_provider_id, 'gpt-3.5-turbo', 'GPT-3.5 Turbo', 'Fast and efficient GPT-3.5 model', 16385, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": true, "supportsFunctionCalling": true}', 'active', false),
    (openai_provider_id, 'gpt-3.5-turbo-16k', 'GPT-3.5 Turbo 16K', 'GPT-3.5 with extended context length', 16385, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": true, "supportsFunctionCalling": true}', 'active', false),
    (openai_provider_id, 'text-davinci-003', 'Text Davinci 003', 'Legacy GPT-3 model', 4097, '{"supportsSystemMessages": false, "supportsStreaming": false, "supportsTools": false, "supportsFunctionCalling": false}', 'deprecated', false),
    (openai_provider_id, 'text-davinci-002', 'Text Davinci 002', 'Legacy GPT-3 model', 4097, '{"supportsSystemMessages": false, "supportsStreaming": false, "supportsTools": false, "supportsFunctionCalling": false}', 'deprecated', false)
    ON CONFLICT (provider_id, identifier) DO NOTHING;
END $$;

-- Insert models for Anthropic
DO $$
DECLARE
    anthropic_provider_id UUID;
BEGIN
    SELECT id INTO anthropic_provider_id FROM providers WHERE identifier = 'anthropic';
    
    INSERT INTO models (provider_id, identifier, name, description, context_length, capabilities, status, is_default) VALUES
    (anthropic_provider_id, 'claude-3-opus', 'Claude 3 Opus', 'Most capable Claude 3 model', 200000, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": true, "supportsFunctionCalling": true, "supportsVision": true}', 'active', false),
    (anthropic_provider_id, 'claude-3-sonnet', 'Claude 3 Sonnet', 'Balanced Claude 3 model', 200000, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": true, "supportsFunctionCalling": true, "supportsVision": true}', 'active', true),
    (anthropic_provider_id, 'claude-3-haiku', 'Claude 3 Haiku', 'Fast and efficient Claude 3 model', 200000, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": true, "supportsFunctionCalling": true}', 'active', false)
    ON CONFLICT (provider_id, identifier) DO NOTHING;
END $$;

-- Insert models for AWS Bedrock
DO $$
DECLARE
    bedrock_provider_id UUID;
BEGIN
    SELECT id INTO bedrock_provider_id FROM providers WHERE identifier = 'bedrock';
    
    INSERT INTO models (provider_id, identifier, name, description, context_length, capabilities, status, is_default) VALUES
    (bedrock_provider_id, 'anthropic.claude-3-sonnet-20240229-v1:0', 'Claude 3 Sonnet (Bedrock)', 'Claude 3 Sonnet via AWS Bedrock', 200000, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": false, "supportsFunctionCalling": false}', 'active', true),
    (bedrock_provider_id, 'anthropic.claude-3-haiku-20240307-v1:0', 'Claude 3 Haiku (Bedrock)', 'Claude 3 Haiku via AWS Bedrock', 200000, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": false, "supportsFunctionCalling": false}', 'active', false),
    (bedrock_provider_id, 'anthropic.claude-v2:1', 'Claude 2.1 (Bedrock)', 'Claude 2.1 via AWS Bedrock', 100000, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": false, "supportsFunctionCalling": false}', 'active', false),
    (bedrock_provider_id, 'anthropic.claude-v2', 'Claude 2 (Bedrock)', 'Claude 2 via AWS Bedrock', 100000, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": false, "supportsFunctionCalling": false}', 'active', false),
    (bedrock_provider_id, 'anthropic.claude-instant-v1', 'Claude Instant (Bedrock)', 'Claude Instant via AWS Bedrock', 100000, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": false, "supportsFunctionCalling": false}', 'active', false),
    (bedrock_provider_id, 'amazon.titan-text-express-v1', 'Titan Text Express', 'Amazon Titan Text Express model', 8000, '{"supportsSystemMessages": false, "supportsStreaming": false, "supportsTools": false, "supportsFunctionCalling": false}', 'active', false),
    (bedrock_provider_id, 'amazon.titan-text-lite-v1', 'Titan Text Lite', 'Amazon Titan Text Lite model', 4000, '{"supportsSystemMessages": false, "supportsStreaming": false, "supportsTools": false, "supportsFunctionCalling": false}', 'active', false),
    (bedrock_provider_id, 'ai21.j2-ultra-v1', 'Jurassic-2 Ultra', 'AI21 Jurassic-2 Ultra model', 8192, '{"supportsSystemMessages": false, "supportsStreaming": false, "supportsTools": false, "supportsFunctionCalling": false}', 'active', false),
    (bedrock_provider_id, 'ai21.j2-mid-v1', 'Jurassic-2 Mid', 'AI21 Jurassic-2 Mid model', 8192, '{"supportsSystemMessages": false, "supportsStreaming": false, "supportsTools": false, "supportsFunctionCalling": false}', 'active', false),
    (bedrock_provider_id, 'cohere.command-text-v14', 'Command Text', 'Cohere Command Text model', 4096, '{"supportsSystemMessages": false, "supportsStreaming": false, "supportsTools": false, "supportsFunctionCalling": false}', 'active', false),
    (bedrock_provider_id, 'cohere.command-light-text-v14', 'Command Light Text', 'Cohere Command Light Text model', 4096, '{"supportsSystemMessages": false, "supportsStreaming": false, "supportsTools": false, "supportsFunctionCalling": false}', 'active', false),
    (bedrock_provider_id, 'meta.llama2-13b-chat-v1', 'Llama 2 13B Chat', 'Meta Llama 2 13B Chat model', 4096, '{"supportsSystemMessages": true, "supportsStreaming": false, "supportsTools": false, "supportsFunctionCalling": false}', 'active', false),
    (bedrock_provider_id, 'meta.llama2-70b-chat-v1', 'Llama 2 70B Chat', 'Meta Llama 2 70B Chat model', 4096, '{"supportsSystemMessages": true, "supportsStreaming": false, "supportsTools": false, "supportsFunctionCalling": false}', 'active', false)
    ON CONFLICT (provider_id, identifier) DO NOTHING;
END $$;

-- Insert models for Microsoft Copilot
DO $$
DECLARE
    copilot_provider_id UUID;
BEGIN
    SELECT id INTO copilot_provider_id FROM providers WHERE identifier = 'microsoft-copilot';
    
    INSERT INTO models (provider_id, identifier, name, description, context_length, capabilities, status, is_default) VALUES
    (copilot_provider_id, 'gpt-4', 'GPT-4 (Azure)', 'GPT-4 via Azure OpenAI', 8192, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": true, "supportsFunctionCalling": true}', 'active', true),
    (copilot_provider_id, 'gpt-4-turbo', 'GPT-4 Turbo (Azure)', 'GPT-4 Turbo via Azure OpenAI', 128000, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": true, "supportsFunctionCalling": true}', 'active', false),
    (copilot_provider_id, 'gpt-4-32k', 'GPT-4 32K (Azure)', 'GPT-4 with 32K context via Azure OpenAI', 32768, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": true, "supportsFunctionCalling": true}', 'active', false),
    (copilot_provider_id, 'gpt-35-turbo', 'GPT-3.5 Turbo (Azure)', 'GPT-3.5 Turbo via Azure OpenAI', 4096, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": true, "supportsFunctionCalling": true}', 'active', false),
    (copilot_provider_id, 'gpt-35-turbo-16k', 'GPT-3.5 Turbo 16K (Azure)', 'GPT-3.5 Turbo with 16K context via Azure OpenAI', 16385, '{"supportsSystemMessages": true, "supportsStreaming": true, "supportsTools": true, "supportsFunctionCalling": true}', 'active', false),
    (copilot_provider_id, 'text-davinci-003', 'Text Davinci 003 (Azure)', 'Legacy GPT-3 model via Azure OpenAI', 4097, '{"supportsSystemMessages": false, "supportsStreaming": false, "supportsTools": false, "supportsFunctionCalling": false}', 'deprecated', false),
    (copilot_provider_id, 'code-davinci-002', 'Code Davinci 002 (Azure)', 'Code-focused GPT model via Azure OpenAI', 8001, '{"supportsSystemMessages": false, "supportsStreaming": false, "supportsTools": false, "supportsFunctionCalling": false}', 'deprecated', false)
    ON CONFLICT (provider_id, identifier) DO NOTHING;
END $$;

-- Insert system provider templates
INSERT INTO provider_templates (
    name,
    description,
    provider_config,
    default_models,
    is_system
) VALUES
(
    'OpenAI Template',
    'Template for setting up OpenAI provider',
    '{
        "name": "OpenAI",
        "description": "OpenAI GPT models",
        "api_endpoint": "https://api.openai.com/v1",
        "auth_method": "api_key",
        "auth_config": {
            "type": "api_key",
            "fields": {
                "apiKey": {"required": true, "description": "OpenAI API Key"},
                "organizationId": {"required": false, "description": "Organization ID (optional)"}
            },
            "headers": {
                "Authorization": "Bearer {{apiKey}}",
                "OpenAI-Organization": "{{organizationId}}"
            }
        }
    }',
    '[
        {"identifier": "gpt-4-turbo", "name": "GPT-4 Turbo", "context_length": 128000, "is_default": true},
        {"identifier": "gpt-4", "name": "GPT-4", "context_length": 8192, "is_default": false},
        {"identifier": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "context_length": 16385, "is_default": false}
    ]',
    true
),
(
    'Anthropic Template',
    'Template for setting up Anthropic provider',
    '{
        "name": "Anthropic",
        "description": "Anthropic Claude models",
        "api_endpoint": "https://api.anthropic.com/v1",
        "auth_method": "api_key",
        "auth_config": {
            "type": "api_key",
            "fields": {
                "apiKey": {"required": true, "description": "Anthropic API Key"}
            },
            "headers": {
                "x-api-key": "{{apiKey}}",
                "anthropic-version": "2023-06-01"
            }
        }
    }',
    '[
        {"identifier": "claude-3-sonnet", "name": "Claude 3 Sonnet", "context_length": 200000, "is_default": true},
        {"identifier": "claude-3-opus", "name": "Claude 3 Opus", "context_length": 200000, "is_default": false},
        {"identifier": "claude-3-haiku", "name": "Claude 3 Haiku", "context_length": 200000, "is_default": false}
    ]',
    true
),
(
    'AWS Bedrock Template',
    'Template for setting up AWS Bedrock provider',
    '{
        "name": "AWS Bedrock",
        "description": "AWS Bedrock multi-model service",
        "api_endpoint": "https://bedrock-runtime.{region}.amazonaws.com",
        "auth_method": "aws_iam",
        "auth_config": {
            "type": "aws_iam",
            "fields": {
                "accessKeyId": {"required": true, "description": "AWS Access Key ID"},
                "secretAccessKey": {"required": true, "description": "AWS Secret Access Key"},
                "region": {"required": true, "description": "AWS Region"}
            }
        }
    }',
    '[
        {"identifier": "anthropic.claude-3-sonnet-20240229-v1:0", "name": "Claude 3 Sonnet", "context_length": 200000, "is_default": true},
        {"identifier": "anthropic.claude-3-haiku-20240307-v1:0", "name": "Claude 3 Haiku", "context_length": 200000, "is_default": false}
    ]',
    true
) ON CONFLICT DO NOTHING;

-- DOWN
-- Remove system provider templates
DELETE FROM provider_templates WHERE is_system = true;

-- Remove models for all system providers
DELETE FROM models WHERE provider_id IN (
    SELECT id FROM providers WHERE is_system = true
);

-- Remove system providers
DELETE FROM providers WHERE is_system = true;