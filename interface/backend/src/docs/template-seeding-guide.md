# Template Seeding Guide

This guide covers the template seeding system for migrating hardcoded prompts to the database-driven template system.

## Overview

The template seeding system provides:
- **Automated Migration**: Convert hardcoded prompts to database templates
- **Validation**: Ensure template integrity before seeding
- **Rollback**: Safely revert seeding operations
- **Version Management**: Track template changes and history
- **Metrics Initialization**: Set up analytics for templates

## Quick Start

### 1. Check Current Status
```bash
npm run seed-templates status
```

### 2. Seed Default Templates
```bash
# Preview changes (dry run)
npm run seed-templates seed --dry-run

# Seed templates
npm run seed-templates seed

# Overwrite existing templates
npm run seed-templates seed --overwrite
```

### 3. Rollback if Needed
```bash
npm run seed-templates rollback --seeding-id seed-1234567890
```

## CLI Commands

### Seed Templates
```bash
npm run seed-templates seed [options]
```

**Options:**
- `--overwrite, -o`: Overwrite existing templates
- `--dry-run, -d`: Preview changes without making them
- `--skip-validation`: Skip template validation
- `--skip-versions`: Skip creating version entries
- `--skip-metrics`: Skip initializing metrics
- `--verbose, -v`: Show detailed output

**Examples:**
```bash
# Basic seeding
npm run seed-templates seed

# Preview seeding
npm run seed-templates seed --dry-run

# Overwrite existing templates
npm run seed-templates seed --overwrite

# Fast seeding (skip optional steps)
npm run seed-templates seed --skip-versions --skip-metrics
```

### Rollback Seeding
```bash
npm run seed-templates rollback --seeding-id <id>
```

**Examples:**
```bash
# Rollback specific seeding
npm run seed-templates rollback --seeding-id seed-1641234567890

# Check status first
npm run seed-templates status
```

### Check Status
```bash
npm run seed-templates status [options]
```

**Options:**
- `--verbose, -v`: Show detailed status information

## Template Sources

The seeding system extracts templates from these hardcoded locations:

### Enhancement Agent (`src/services/enhancement-agent.ts`)
- **main_enhancement_prompt**: Primary enhancement instruction template
- **system_enhancement_prompt**: System-level enhancement instructions

### Question Generator (`src/services/intelligent-question-generator.ts`)
- **analysis_questions**: Questions for analysis tasks
- **generation_questions**: Questions for content generation
- **code_questions**: Questions for coding tasks

### Mock LLM Service (`src/services/mock-llm-service.ts`)
- **enhancement_response**: Default enhancement mock response
- **blog_post_response**: Blog post generation mock response
- **data_analysis_response**: Data analysis mock response

## Template Structure

Each template includes:

```typescript
{
  category: TemplateCategory,
  key: string,
  name: string,
  description: string,
  content: string,
  variables: TemplateVariable[],
  metadata: TemplateMetadata
}
```

### Template Categories
- **ENHANCEMENT**: Templates for prompt enhancement
- **QUESTION_GENERATION**: Templates for generating contextual questions
- **MOCK_RESPONSES**: Mock response templates (development only)
- **SYSTEM_PROMPTS**: System-level prompts and instructions
- **CUSTOM**: User-created templates

### Variable Types
- **string**: Text input
- **number**: Numeric input
- **boolean**: True/false input
- **array**: List of items
- **object**: Complex object
- **select**: Single choice from options
- **multiselect**: Multiple choices from options

## Validation Rules

Templates are validated for:

### Content Validation
- Minimum length: 10 characters
- Maximum length: 10,000 characters
- No forbidden patterns (script tags, eval, etc.)

### Variable Validation
- Valid variable names (alphanumeric + underscore)
- Proper type definitions
- Required vs optional variables
- Default value type matching

### Security Validation
- No code injection patterns
- No sensitive data exposure
- Proper variable sanitization

## Database Schema

### Tables Used
- **prompt_templates**: Main template storage
- **prompt_template_versions**: Version history
- **prompt_template_metrics**: Usage and performance metrics
- **prompt_template_usage**: Usage tracking

### Seeding Metadata
Each seeded template includes metadata:
```json
{
  "seeding_id": "seed-1641234567890",
  "seeded_at": "2024-01-01T12:00:00.000Z",
  "source": "enhancement-agent.ts buildEnhancementPrompt method"
}
```

## Environment Configuration

Set these environment variables:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=prompt_library
DB_USER=postgres
DB_PASSWORD=password
```

## Error Handling

### Common Issues

**1. Database Connection Failed**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
- Check database is running
- Verify connection parameters
- Ensure database exists

**2. Template Validation Failed**
```
Template main_enhancement_prompt: Template content is required
```
- Check template definitions in `src/data/default-templates.ts`
- Verify all required fields are present

**3. User Not Found**
```
No admin user found and unable to create system user
```
- Ensure users table exists
- Create an admin user manually
- Run user migrations first

### Recovery Steps

1. **Check database status**:
   ```bash
   npm run db:test
   ```

2. **Verify migrations**:
   ```bash
   npm run migrate:status
   ```

3. **Check template definitions**:
   ```bash
   npm run seed-templates status --verbose
   ```

4. **Rollback and retry**:
   ```bash
   npm run seed-templates rollback --seeding-id <id>
   npm run seed-templates seed --dry-run
   ```

## Integration with Services

### System Prompt Manager
The seeded templates integrate with the System Prompt Manager:

```typescript
// Before (hardcoded)
const prompt = "You are an expert prompt engineer...";

// After (template-based)
const prompt = await systemPromptManager.getTemplate(
  TemplateCategory.ENHANCEMENT,
  'system_enhancement_prompt'
);
```

### Backward Compatibility
The seeding maintains backward compatibility:
- Existing hardcoded prompts remain as fallbacks
- Template system gracefully degrades if templates unavailable
- No breaking changes to existing APIs

## Monitoring and Maintenance

### Regular Tasks
1. **Check seeding status** monthly
2. **Validate template integrity** after updates
3. **Monitor template usage** via analytics
4. **Update templates** based on performance data

### Performance Monitoring
- Template loading times
- Cache hit rates
- Usage patterns
- Error rates

### Backup and Recovery
- Templates are backed up with regular database backups
- Seeding operations are atomic (all-or-nothing)
- Rollback capability for failed seedings
- Version history for template changes

## Troubleshooting

### Debug Mode
Enable verbose logging:
```bash
npm run seed-templates seed --verbose --dry-run
```

### Manual Verification
Check seeded templates in database:
```sql
SELECT category, key, name, is_default, created_at 
FROM prompt_templates 
WHERE is_default = true 
ORDER BY category, key;
```

### Template Testing
Test templates after seeding:
```bash
# Run template service tests
npm run test src/__tests__/template-services-integration.test.ts
```

## Best Practices

### Before Seeding
1. **Backup database** before major seeding operations
2. **Run dry-run** to preview changes
3. **Check status** to understand current state
4. **Validate environment** configuration

### During Seeding
1. **Monitor progress** with verbose output
2. **Check for warnings** and address them
3. **Verify completion** with status command
4. **Test functionality** after seeding

### After Seeding
1. **Document seeding ID** for potential rollback
2. **Test template functionality** in application
3. **Monitor performance** metrics
4. **Update documentation** if needed

## Support

For issues with template seeding:
1. Check this guide for common solutions
2. Review error messages and logs
3. Use dry-run mode to debug issues
4. Check database connectivity and permissions
5. Verify template definitions are valid