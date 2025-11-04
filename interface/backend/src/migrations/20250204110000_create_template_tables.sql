-- UP
-- Create prompt templates system for customizable LLM prompts
-- This is the original 001_create_template_tables.sql with proper timestamp naming

-- Main templates table
CREATE TABLE IF NOT EXISTS prompt_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL CHECK (category IN ('enhancement', 'question_generation', 'mock_responses', 'system_prompts', 'custom')),
    key VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(category, key)
);

-- Template versions for history tracking
CREATE TABLE IF NOT EXISTS prompt_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES prompt_templates(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    change_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    UNIQUE(template_id, version_number)
);

-- Template usage analytics
CREATE TABLE IF NOT EXISTS prompt_template_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES prompt_templates(id) ON DELETE CASCADE,
    usage_context JSONB DEFAULT '{}'::jsonb,
    execution_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    provider VARCHAR(50),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Template performance metrics
CREATE TABLE IF NOT EXISTS prompt_template_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES prompt_templates(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('usage_count', 'success_rate', 'avg_execution_time', 'quality_score', 'user_rating')),
    metric_value DECIMAL(10,4) NOT NULL,
    measurement_date DATE DEFAULT CURRENT_DATE,
    metadata JSONB DEFAULT '{}'::jsonb,
    
    UNIQUE(template_id, metric_type, measurement_date)
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category_key ON prompt_templates(category, key);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON prompt_templates(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_prompt_templates_default ON prompt_templates(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_prompt_templates_created_by ON prompt_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_created_at ON prompt_templates(created_at);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_updated_at ON prompt_templates(updated_at);

CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON prompt_template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_version_number ON prompt_template_versions(template_id, version_number);
CREATE INDEX IF NOT EXISTS idx_template_versions_created_at ON prompt_template_versions(created_at);

CREATE INDEX IF NOT EXISTS idx_template_usage_template_id ON prompt_template_usage(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_created_at ON prompt_template_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_template_usage_success ON prompt_template_usage(success);
CREATE INDEX IF NOT EXISTS idx_template_usage_provider ON prompt_template_usage(provider);
CREATE INDEX IF NOT EXISTS idx_template_usage_user_id ON prompt_template_usage(user_id);

CREATE INDEX IF NOT EXISTS idx_template_metrics_template_id ON prompt_template_metrics(template_id);
CREATE INDEX IF NOT EXISTS idx_template_metrics_type_date ON prompt_template_metrics(metric_type, measurement_date);
CREATE INDEX IF NOT EXISTS idx_template_metrics_template_type ON prompt_template_metrics(template_id, metric_type);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_prompt_templates_updated_at BEFORE UPDATE ON prompt_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create version history on template updates
CREATE OR REPLACE FUNCTION create_template_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create version if content actually changed
    IF OLD.content IS DISTINCT FROM NEW.content OR 
       OLD.variables IS DISTINCT FROM NEW.variables OR 
       OLD.metadata IS DISTINCT FROM NEW.metadata THEN
        
        INSERT INTO prompt_template_versions (
            template_id,
            version_number,
            content,
            variables,
            metadata,
            change_message,
            created_by
        )
        SELECT 
            NEW.id,
            COALESCE(MAX(version_number), 0) + 1,
            OLD.content,
            OLD.variables,
            OLD.metadata,
            'Automatic version created on update',
            NEW.updated_by
        FROM prompt_template_versions 
        WHERE template_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic versioning
CREATE TRIGGER create_template_version_trigger
    AFTER UPDATE ON prompt_templates
    FOR EACH ROW
    EXECUTE FUNCTION create_template_version();

-- DOWN
-- Remove triggers and functions
DROP TRIGGER IF EXISTS create_template_version_trigger ON prompt_templates;
DROP FUNCTION IF EXISTS create_template_version();
DROP TRIGGER IF EXISTS update_prompt_templates_updated_at ON prompt_templates;

-- Remove indexes
DROP INDEX IF EXISTS idx_template_metrics_template_type;
DROP INDEX IF EXISTS idx_template_metrics_type_date;
DROP INDEX IF EXISTS idx_template_metrics_template_id;
DROP INDEX IF EXISTS idx_template_usage_user_id;
DROP INDEX IF EXISTS idx_template_usage_provider;
DROP INDEX IF EXISTS idx_template_usage_success;
DROP INDEX IF EXISTS idx_template_usage_created_at;
DROP INDEX IF EXISTS idx_template_usage_template_id;
DROP INDEX IF EXISTS idx_template_versions_created_at;
DROP INDEX IF EXISTS idx_template_versions_version_number;
DROP INDEX IF EXISTS idx_template_versions_template_id;
DROP INDEX IF EXISTS idx_prompt_templates_updated_at;
DROP INDEX IF EXISTS idx_prompt_templates_created_at;
DROP INDEX IF EXISTS idx_prompt_templates_created_by;
DROP INDEX IF EXISTS idx_prompt_templates_default;
DROP INDEX IF EXISTS idx_prompt_templates_active;
DROP INDEX IF EXISTS idx_prompt_templates_category;
DROP INDEX IF EXISTS idx_prompt_templates_category_key;

-- Drop tables
DROP TABLE IF EXISTS prompt_template_metrics;
DROP TABLE IF EXISTS prompt_template_usage;
DROP TABLE IF EXISTS prompt_template_versions;
DROP TABLE IF EXISTS prompt_templates;