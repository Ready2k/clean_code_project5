# Database Migrations

This directory contains database migration files for the Prompt Library system.

## Migration File Format

Migration files should follow the naming convention:
```
YYYYMMDDHHMMSS_migration_name.sql
```

Each migration file must contain both UP and DOWN sections:

```sql
-- UP
-- Migration code to apply changes
CREATE TABLE example (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL
);

-- DOWN
-- Migration code to rollback changes
DROP TABLE IF EXISTS example;
```

## Available Commands

### Run Migrations
```bash
npm run migrate
# or
npm run migrate:up
```

### Rollback Last Migration
```bash
npm run migrate:rollback
```

### Check Migration Status
```bash
npm run migrate:status
```

### List Pending Migrations
```bash
npm run migrate:pending
```

### List Executed Migrations
```bash
npm run migrate:executed
```

### Test Database Connection
```bash
npm run db:test
```

## Environment Setup

Ensure your `.env` file contains the DATABASE_URL:
```
DATABASE_URL=postgresql://username:password@localhost:5432/promptlib
```

## Migration Files

### 20250210120000_create_dynamic_providers.sql
Creates the core tables for dynamic provider management:
- `providers` - Dynamic LLM provider configurations
- `models` - Models available for each provider
- `provider_templates` - Templates for quick provider setup
- Updates `connections` table to support dynamic providers

### 20250210120001_populate_system_providers.sql
Populates the system with default providers and models:
- OpenAI provider with GPT models
- Anthropic provider with Claude models
- AWS Bedrock provider with multiple models
- Microsoft Copilot (Azure OpenAI) provider
- System provider templates

## Development Workflow

1. **Create a new migration:**
   ```bash
   # Create file: YYYYMMDDHHMMSS_your_migration_name.sql
   # Add UP and DOWN sections
   ```

2. **Test the migration:**
   ```bash
   npm run db:test
   npm run migrate:status
   npm run migrate
   ```

3. **Verify the changes:**
   ```bash
   npm run migrate:status
   # Check database manually if needed
   ```

4. **Test rollback (optional):**
   ```bash
   npm run migrate:rollback
   npm run migrate  # Re-apply
   ```

## Best Practices

1. **Always include DOWN section** - Every migration must be reversible
2. **Test migrations thoroughly** - Test both UP and DOWN operations
3. **Use transactions** - The migration service automatically wraps each migration in a transaction
4. **Backup before production** - Always backup production data before running migrations
5. **Check dependencies** - Ensure migrations don't break existing functionality

## Troubleshooting

### Migration fails with "relation already exists"
- Use `IF NOT EXISTS` clauses in CREATE statements
- Check if the migration was partially applied

### Cannot rollback migration
- Ensure the DOWN section properly reverses all UP changes
- Check for data dependencies that prevent rollback

### Database connection issues
- Verify DATABASE_URL is correct
- Ensure PostgreSQL is running
- Check network connectivity and credentials