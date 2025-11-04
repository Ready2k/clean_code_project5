-- UP
-- Seed default prompt templates from existing hardcoded prompts
-- This is the original 002_seed_default_templates.sql with proper timestamp naming

DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Get admin user ID for template ownership
    SELECT id INTO admin_user_id FROM users WHERE username = 'admin' LIMIT 1;
    
    -- If no admin user exists, create a system user for template ownership
    IF admin_user_id IS NULL THEN
        INSERT INTO users (username, email, password_hash, role)
        VALUES ('system', 'system@promptlibrary.com', 'system', 'admin')
        ON CONFLICT (username) DO NOTHING
        RETURNING id INTO admin_user_id;
        
        -- If still null, get the first admin user or create one
        IF admin_user_id IS NULL THEN
            SELECT id INTO admin_user_id FROM users WHERE role = 'admin' LIMIT 1;
        END IF;
    END IF;

    -- Insert Enhancement Templates
    INSERT INTO prompt_templates (category, key, name, description, content, variables, metadata, is_default, created_by, updated_by)
    VALUES 
    (
        'enhancement',
        'main_enhancement_prompt',
        'Main Enhancement Instruction',
        'Primary template for converting human prompts to structured format using LLM enhancement',
        'Please enhance the following human-readable prompt into a structured format.

HUMAN PROMPT:
Goal: {{goal}}
Audience: {{audience}}
Steps: {{steps}}
Output Format: {{output_format}}
Expected Fields: {{expected_fields}}

REQUIREMENTS:
- Convert to structured format with system instructions, user template, rules, and capabilities
- Extract variables using {{variable_name}} syntax where content should be dynamic
- Preserve the original intent and goal
- Make the prompt clear, specific, and actionable
- Include appropriate rules and constraints
{{#if target_provider}}- Optimize for {{target_provider}} provider{{/if}}
{{#if domain_knowledge}}- Consider this domain context: {{domain_knowledge}}{{/if}}

Respond with a JSON object containing:
{
  "structured": {
    "schema_version": 1,
    "system": ["instruction1", "instruction2"],
    "capabilities": ["capability1", "capability2"],
    "user_template": "template with {{variables}}",
    "rules": [{"name": "rule1", "description": "desc1"}],
    "variables": ["var1", "var2"]
  },
  "changes_made": ["change1", "change2"],
  "warnings": ["warning1", "warning2"]
}',
        '[
            {"name": "goal", "type": "string", "description": "The main goal of the prompt", "required": true},
            {"name": "audience", "type": "string", "description": "Target audience", "required": true},
            {"name": "steps", "type": "string", "description": "List of steps (formatted as string)", "required": true},
            {"name": "output_format", "type": "string", "description": "Expected output format", "required": true},
            {"name": "expected_fields", "type": "string", "description": "Expected output fields", "required": true},
            {"name": "target_provider", "type": "string", "description": "Target LLM provider", "required": false},
            {"name": "domain_knowledge", "type": "string", "description": "Domain-specific context", "required": false}
        ]'::jsonb,
        '{
            "provider_optimized": ["openai", "anthropic", "meta"],
            "complexity_level": "intermediate",
            "source": "enhancement-agent.ts buildEnhancementPrompt method"
        }'::jsonb,
        true,
        admin_user_id,
        admin_user_id
    ),
    (
        'enhancement',
        'system_enhancement_prompt',
        'Enhancement System Instructions',
        'System-level instructions for the enhancement agent that define the AI role and behavior',
        'You are an expert prompt engineer specializing in converting human-readable prompts into structured, reusable formats. Your goal is to:

1. Preserve the original intent and meaning
2. Create clear, actionable system instructions
3. Design flexible user templates with appropriate variables
4. Define specific rules and constraints
5. Identify required capabilities
6. Ensure the result is provider-agnostic and reusable

Focus on clarity, specificity, and maintainability. Extract variables for any content that should be dynamic or reusable.',
        '[]'::jsonb,
        '{
            "complexity_level": "basic",
            "source": "enhancement-agent.ts getEnhancementSystemPrompt method"
        }'::jsonb,
        true,
        admin_user_id,
        admin_user_id
    );

    -- Create initial version entries for all default templates
    INSERT INTO prompt_template_versions (template_id, version_number, content, variables, metadata, change_message, created_by)
    SELECT 
        id,
        1,
        content,
        variables,
        metadata,
        'Initial default template version',
        created_by
    FROM prompt_templates 
    WHERE is_default = true;

    -- Initialize basic metrics for default templates
    INSERT INTO prompt_template_metrics (template_id, metric_type, metric_value, metadata)
    SELECT 
        id,
        'usage_count',
        0,
        '{"initial": true}'::jsonb
    FROM prompt_templates 
    WHERE is_default = true;

    INSERT INTO prompt_template_metrics (template_id, metric_type, metric_value, metadata)
    SELECT 
        id,
        'success_rate',
        1.0,
        '{"initial": true}'::jsonb
    FROM prompt_templates 
    WHERE is_default = true;

END $$;

-- DOWN
-- Remove all default templates and their associated data
DELETE FROM prompt_template_metrics WHERE template_id IN (
    SELECT id FROM prompt_templates WHERE is_default = true
);

DELETE FROM prompt_template_versions WHERE template_id IN (
    SELECT id FROM prompt_templates WHERE is_default = true
);

DELETE FROM prompt_template_usage WHERE template_id IN (
    SELECT id FROM prompt_templates WHERE is_default = true
);

DELETE FROM prompt_templates WHERE is_default = true;