-- Rollback Script for Dynamic Provider Management
-- This script safely rolls back the dynamic provider management migration
-- Use this script if you need to revert to the previous system state

-- WARNING: This will remove all dynamic provider configurations
-- Make sure to export provider configurations before running this script

-- Begin transaction for atomic rollback
BEGIN;

-- Step 1: Create backup of current state before rollback
CREATE TABLE IF NOT EXISTS providers_rollback_backup AS SELECT * FROM providers;
CREATE TABLE IF NOT EXISTS models_rollback_backup AS SELECT * FROM models;
CREATE TABLE IF NOT EXISTS provider_templates_rollback_backup AS SELECT * FROM provider_templates;

-- Step 2: Update any connections that reference dynamic providers
-- Set provider_id to NULL for connections using dynamic providers
UPDATE connections 
SET provider_id = NULL 
WHERE provider_id IS NOT NULL;

-- Step 3: Remove foreign key constraint from connections table
ALTER TABLE connections DROP CONSTRAINT IF EXISTS fk_connections_provider_id;

-- Step 4: Remove the provider_id column from connections table
ALTER TABLE connections DROP COLUMN IF EXISTS provider_id;

-- Step 5: Remove indexes
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

-- Step 6: Remove triggers
DROP TRIGGER IF EXISTS update_provider_templates_updated_at ON provider_templates;
DROP TRIGGER IF EXISTS update_models_updated_at ON models;
DROP TRIGGER IF EXISTS update_providers_updated_at ON providers;

-- Step 7: Drop tables in correct order (respecting foreign key dependencies)
DROP TABLE IF EXISTS models;
DROP TABLE IF EXISTS provider_templates;
DROP TABLE IF EXISTS providers;

-- Step 8: Restore original connections table constraint if it existed
-- Note: You may need to adjust this based on your original schema
-- ALTER TABLE connections ADD CONSTRAINT connections_provider_check 
--     CHECK (provider IN ('openai', 'bedrock', 'anthropic', 'microsoft-copilot'));

-- Step 9: Log the rollback
INSERT INTO migration_audit (migration_name, executed_by, status, details) VALUES (
    'dynamic_provider_management_rollback',
    current_user,
    'completed',
    '{"action": "rollback", "tables_dropped": ["providers", "models", "provider_templates"], "connections_table_reverted": true, "backup_tables_created": true}'
);

-- Commit the transaction
COMMIT;

-- Post-rollback verification queries
-- Run these to verify the rollback was successful:

-- Check that dynamic provider tables are gone
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_name IN ('providers', 'models', 'provider_templates');

-- Check that connections table no longer has provider_id column
-- SELECT column_name 
-- FROM information_schema.columns 
-- WHERE table_name = 'connections' AND column_name = 'provider_id';

-- Check that backup tables were created
-- SELECT table_name 
-- FROM information_schema.tables 
-- WHERE table_name LIKE '%_rollback_backup';

-- Verify connections table structure
-- \d connections;

-- IMPORTANT NOTES FOR MANUAL STEPS AFTER ROLLBACK:
-- 1. Restart the application to ensure it uses the hardcoded provider system
-- 2. Verify that existing connections still work with the original provider system
-- 3. If you had custom provider configurations, you'll need to implement them in code
-- 4. Consider keeping the backup tables for a period in case you need to restore data
-- 5. Update any documentation to reflect the rollback to hardcoded providers

-- To clean up backup tables later (after confirming rollback success):
-- DROP TABLE IF EXISTS providers_rollback_backup;
-- DROP TABLE IF EXISTS models_rollback_backup;
-- DROP TABLE IF EXISTS provider_templates_rollback_backup;
-- DROP TABLE IF EXISTS connections_backup_pre_dynamic;