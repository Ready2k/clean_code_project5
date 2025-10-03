-- Production Migration Script for Dynamic Provider Management
-- This script safely migrates the production database to support dynamic providers
-- Run this script during deployment to production

-- Begin transaction for atomic migration
BEGIN;

-- Create a backup table for existing connections before migration
CREATE TABLE IF NOT EXISTS connections_backup_pre_dynamic AS 
SELECT * FROM connections;

-- Step 1: Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 2: Create providers table for dynamic provider management
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

-- Step 3: Create models table for provider models
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

-- Step 4: Create provider_templates table for quick provider setup
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

-- Step 5: Create indexes for better performance
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

-- Step 6: Add triggers for updated_at timestamps
DROP TRIGGER IF EXISTS update_providers_updated_at ON providers;
CREATE TRIGGER update_providers_updated_at BEFORE UPDATE ON providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_models_updated_at ON models;
CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_provider_templates_updated_at ON provider_templates;
CREATE TRIGGER update_provider_templates_updated_at BEFORE UPDATE ON provider_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Update connections table to support dynamic providers
-- First, remove the old constraint if it exists
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_provider_check;

-- Add the new provider_id column if it doesn't exist
ALTER TABLE connections ADD COLUMN IF NOT EXISTS provider_id UUID;

-- Add foreign key constraint
ALTER TABLE connections DROP CONSTRAINT IF EXISTS fk_connections_provider_id;
ALTER TABLE connections ADD CONSTRAINT fk_connections_provider_id 
    FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL;

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_connections_provider_id ON connections(provider_id);

-- Step 8: Populate system providers (this will be done by the application)
-- Note: System providers will be populated by the application startup process
-- to ensure they match the current codebase configuration

-- Step 9: Create audit log for migration
CREATE TABLE IF NOT EXISTS migration_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_name VARCHAR(255) NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_by VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    details JSONB
);

-- Log this migration
INSERT INTO migration_audit (migration_name, executed_by, status, details) VALUES (
    'dynamic_provider_management_production',
    current_user,
    'completed',
    '{"tables_created": ["providers", "models", "provider_templates"], "connections_table_updated": true, "indexes_created": true, "triggers_created": true}'
);

-- Commit the transaction
COMMIT;

-- Verification queries (run these after migration to verify success)
-- SELECT 'providers' as table_name, count(*) as row_count FROM providers
-- UNION ALL
-- SELECT 'models' as table_name, count(*) as row_count FROM models
-- UNION ALL
-- SELECT 'provider_templates' as table_name, count(*) as row_count FROM provider_templates
-- UNION ALL
-- SELECT 'connections' as table_name, count(*) as row_count FROM connections;

-- Check if provider_id column was added to connections
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'connections' AND column_name = 'provider_id';

-- Verify indexes were created
-- SELECT indexname, tablename 
-- FROM pg_indexes 
-- WHERE tablename IN ('providers', 'models', 'provider_templates', 'connections')
-- AND indexname LIKE 'idx_%';