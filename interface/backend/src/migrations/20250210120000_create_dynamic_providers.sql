-- UP
-- Create providers table for dynamic provider management
CREATE TABLE IF NOT EXISTS providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    api_endpoint VARCHAR(500) NOT NULL,
    auth_method VARCHAR(50) NOT NULL CHECK (auth_method IN ('api_key', 'oauth2', 'aws_iam', 'custom')),
    auth_config JSONB NOT NULL,
    capabilities JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'testing')),
    is_system BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_tested TIMESTAMP WITH TIME ZONE,
    test_result JSONB
);

-- Create models table for provider models
CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID REFERENCES providers(id) ON DELETE CASCADE,
    identifier VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    context_length INTEGER NOT NULL DEFAULT 4096,
    capabilities JSONB NOT NULL,
    pricing_info JSONB,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_id, identifier)
);

-- Create provider_templates table for quick provider setup
CREATE TABLE IF NOT EXISTS provider_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    provider_config JSONB NOT NULL,
    default_models JSONB NOT NULL,
    is_system BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_providers_identifier ON providers(identifier);
CREATE INDEX IF NOT EXISTS idx_providers_status ON providers(status);
CREATE INDEX IF NOT EXISTS idx_providers_is_system ON providers(is_system);
CREATE INDEX IF NOT EXISTS idx_providers_created_by ON providers(created_by);
CREATE INDEX IF NOT EXISTS idx_providers_created_at ON providers(created_at);

CREATE INDEX IF NOT EXISTS idx_models_provider_id ON models(provider_id);
CREATE INDEX IF NOT EXISTS idx_models_identifier ON models(identifier);
CREATE INDEX IF NOT EXISTS idx_models_status ON models(status);
CREATE INDEX IF NOT EXISTS idx_models_is_default ON models(is_default);
CREATE INDEX IF NOT EXISTS idx_models_created_at ON models(created_at);

CREATE INDEX IF NOT EXISTS idx_provider_templates_name ON provider_templates(name);
CREATE INDEX IF NOT EXISTS idx_provider_templates_is_system ON provider_templates(is_system);
CREATE INDEX IF NOT EXISTS idx_provider_templates_created_by ON provider_templates(created_by);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_templates_updated_at BEFORE UPDATE ON provider_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update connections table to support dynamic providers
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_provider_check;
ALTER TABLE connections ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES providers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_connections_provider_id ON connections(provider_id);

-- DOWN
-- Remove indexes
DROP INDEX IF EXISTS idx_connections_provider_id;
DROP INDEX IF EXISTS idx_provider_templates_created_by;
DROP INDEX IF EXISTS idx_provider_templates_is_system;
DROP INDEX IF EXISTS idx_provider_templates_name;
DROP INDEX IF EXISTS idx_models_created_at;
DROP INDEX IF EXISTS idx_models_is_default;
DROP INDEX IF EXISTS idx_models_status;
DROP INDEX IF EXISTS idx_models_identifier;
DROP INDEX IF EXISTS idx_models_provider_id;
DROP INDEX IF EXISTS idx_providers_created_at;
DROP INDEX IF EXISTS idx_providers_created_by;
DROP INDEX IF EXISTS idx_providers_is_system;
DROP INDEX IF EXISTS idx_providers_status;
DROP INDEX IF EXISTS idx_providers_identifier;

-- Remove triggers
DROP TRIGGER IF EXISTS update_provider_templates_updated_at ON provider_templates;
DROP TRIGGER IF EXISTS update_models_updated_at ON models;
DROP TRIGGER IF EXISTS update_providers_updated_at ON providers;

-- Remove column from connections table
ALTER TABLE connections DROP COLUMN IF EXISTS provider_id;

-- Drop tables
DROP TABLE IF EXISTS provider_templates;
DROP TABLE IF EXISTS models;
DROP TABLE IF EXISTS providers;