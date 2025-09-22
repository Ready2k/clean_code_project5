-- Initialize the Prompt Library database
-- This script runs when PostgreSQL container starts for the first time

-- Create the main database (already created by POSTGRES_DB env var)
-- CREATE DATABASE promptlib;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    preferences JSONB DEFAULT '{}'::jsonb
);

-- Create prompts table
CREATE TABLE IF NOT EXISTS prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    tags TEXT[] DEFAULT '{}',
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    metadata JSONB DEFAULT '{}'::jsonb,
    human_prompt JSONB DEFAULT '{}'::jsonb,
    variables JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create connections table
CREATE TABLE IF NOT EXISTS connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'bedrock')),
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    config JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_tested TIMESTAMP WITH TIME ZONE
);

-- Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL CHECK (score >= 1 AND score <= 5),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(prompt_id, user_id)
);

-- Create sessions table for JWT refresh tokens
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prompts_owner_id ON prompts(owner_id);
CREATE INDEX IF NOT EXISTS idx_prompts_status ON prompts(status);
CREATE INDEX IF NOT EXISTS idx_prompts_tags ON prompts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at);
CREATE INDEX IF NOT EXISTS idx_connections_owner_id ON connections(owner_id);
CREATE INDEX IF NOT EXISTS idx_connections_provider ON connections(provider);
CREATE INDEX IF NOT EXISTS idx_ratings_prompt_id ON ratings(prompt_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON prompts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connections_updated_at BEFORE UPDATE ON connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert a default admin user (password: admin123)
-- Password hash for 'admin123' using bcrypt with 12 rounds
INSERT INTO users (username, email, password_hash, role) 
VALUES (
    'admin', 
    'admin@promptlibrary.com', 
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VjPoyNdO2', 
    'admin'
) ON CONFLICT (username) DO NOTHING;

-- Insert a demo user (password: demo123)
-- Password hash for 'demo123' using bcrypt with 12 rounds
INSERT INTO users (username, email, password_hash, role) 
VALUES (
    'demo', 
    'demo@promptlibrary.com', 
    '$2b$12$8Y8.5QzqVQzqVQzqVQzqVOzqVQzqVQzqVQzqVQzqVQzqVQzqVQzqV', 
    'user'
) ON CONFLICT (username) DO NOTHING;

-- Insert some sample prompts
DO $$
DECLARE
    admin_user_id UUID;
    demo_user_id UUID;
BEGIN
    -- Get user IDs
    SELECT id INTO admin_user_id FROM users WHERE username = 'admin';
    SELECT id INTO demo_user_id FROM users WHERE username = 'demo';
    
    -- Insert sample prompts
    INSERT INTO prompts (title, summary, tags, owner_id, status, metadata, human_prompt, variables)
    VALUES 
    (
        'Email Marketing Campaign Generator',
        'Creates compelling email marketing campaigns for products and services',
        ARRAY['marketing', 'email', 'copywriting'],
        admin_user_id,
        'published',
        '{"category": "marketing", "difficulty": "intermediate"}'::jsonb,
        '{
            "goal": "Generate a compelling email marketing campaign that drives engagement and conversions",
            "audience": "Marketing professionals and business owners",
            "steps": [
                "Analyze the target audience and their pain points",
                "Craft an attention-grabbing subject line",
                "Write engaging email content with clear value proposition",
                "Include a strong call-to-action",
                "Optimize for mobile and accessibility"
            ],
            "outputExpectations": "Complete email campaign including subject line, body content, and CTA"
        }'::jsonb,
        '[
            {"name": "product_name", "description": "Name of the product or service", "type": "string", "required": true},
            {"name": "target_audience", "description": "Primary target audience", "type": "string", "required": true},
            {"name": "key_benefits", "description": "Main benefits to highlight", "type": "array", "required": true}
        ]'::jsonb
    ),
    (
        'Code Review Assistant',
        'Provides comprehensive code review feedback and suggestions for improvement',
        ARRAY['development', 'code-review', 'quality'],
        demo_user_id,
        'published',
        '{"category": "development", "difficulty": "advanced"}'::jsonb,
        '{
            "goal": "Conduct thorough code review focusing on quality, security, and best practices",
            "audience": "Software developers and development teams",
            "steps": [
                "Analyze code structure and organization",
                "Check for security vulnerabilities",
                "Review performance implications",
                "Verify adherence to coding standards",
                "Suggest improvements and optimizations"
            ],
            "outputExpectations": "Detailed review with specific feedback, suggestions, and priority levels"
        }'::jsonb,
        '[
            {"name": "code_snippet", "description": "Code to be reviewed", "type": "string", "required": true},
            {"name": "programming_language", "description": "Programming language used", "type": "string", "required": true},
            {"name": "review_focus", "description": "Specific areas to focus on", "type": "array", "required": false}
        ]'::jsonb
    );
END $$;

COMMIT;