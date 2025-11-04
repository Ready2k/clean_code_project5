# Template Management User Guide

This guide provides comprehensive instructions for managing LLM prompt templates through the Admin interface.

## Overview

The Template Management system allows administrators to customize all LLM prompts used throughout the system without requiring code changes. Templates are organized by category and support variable substitution for dynamic content.

## Accessing Template Management

1. **Login to Admin Interface**
   - Navigate to `http://localhost:8000/admin`
   - Login with your administrator credentials

2. **Navigate to Templates**
   - Click on the "Prompt Templates" tab in the main navigation
   - You'll see the template management dashboard

## Template Categories

Templates are organized into the following categories:

### Enhancement Templates
- **Purpose**: Used by the AI Enhancement Agent to improve user prompts
- **Key Templates**:
  - `main_enhancement_prompt`: Primary enhancement instruction
  - `system_enhancement_prompt`: System-level enhancement guidelines
- **Usage**: Automatically used when users request prompt enhancements

### Question Generation Templates
- **Purpose**: Generate contextual questions to help users improve their prompts
- **Key Templates**:
  - `analysis_questions`: Questions for analysis tasks
  - `generation_questions`: Questions for content generation
  - `transformation_questions`: Questions for data transformation
- **Usage**: Used by the Intelligent Question Generator

### System Prompts
- **Purpose**: Core system instructions that define AI behavior
- **Key Templates**:
  - `assistant_role`: Defines the AI assistant's role and behavior
  - `safety_guidelines`: Safety and ethical guidelines
- **Usage**: Applied to all AI interactions

### Mock Response Templates (Development Only)
- **Purpose**: Provide realistic mock responses for testing
- **Key Templates**:
  - `blog_post_example`: Example blog post responses
  - `analysis_example`: Example analysis responses
- **Usage**: Only active in development and testing environments

### Custom Templates
- **Purpose**: User-created templates for specific use cases
- **Usage**: Created by administrators for specialized scenarios

## Template Management Interface

### Template List View

The main template list shows:

- **Template Name**: Human-readable name
- **Category**: Template category badge
- **Status**: Active/Inactive indicator
- **Usage Count**: Number of times used
- **Last Modified**: When template was last updated
- **Actions**: Edit, Test, Analytics, History buttons

#### Filtering and Search

- **Category Filter**: Filter templates by category
- **Search**: Search by template name or description
- **Status Filter**: Show only active or inactive templates
- **Sort Options**: Sort by name, usage count, or last modified date

### Template Detail View

Click on any template to view detailed information:

#### Template Information
- **Basic Details**: Name, description, category
- **Status**: Active/inactive toggle
- **Version**: Current version number
- **Usage Statistics**: Total usage count and recent activity
- **Metadata**: Provider optimizations, complexity level

#### Template Content
- **Content Editor**: Rich text editor with syntax highlighting
- **Variable Highlighting**: Template variables are highlighted in the editor
- **Preview Panel**: Real-time preview of rendered template

#### Variables Section
- **Variable List**: All defined variables with types and descriptions
- **Required/Optional**: Clear indication of required vs optional variables
- **Default Values**: Default values for optional variables
- **Validation Rules**: Any validation constraints

## Working with Templates

### Creating a New Template

1. **Click "Create Template" Button**
   - Located in the top-right of the template list

2. **Fill Basic Information**
   ```
   Category: Select from dropdown (enhancement, question_generation, etc.)
   Key: Unique identifier within category (e.g., "my_custom_prompt")
   Name: Human-readable name (e.g., "My Custom Prompt")
   Description: Brief description of template purpose
   ```

3. **Write Template Content**
   - Use the rich text editor to write your template
   - Include variable placeholders using `{{variable_name}}` syntax
   - Use conditional logic with `{{#if condition}}...{{/if}}`

4. **Define Variables**
   - Click "Add Variable" for each template variable
   - Specify variable name, type, description, and whether it's required
   - Set default values for optional variables

5. **Save Template**
   - Click "Save" to create the template
   - Template will be created in inactive state for testing

### Editing an Existing Template

1. **Select Template**
   - Click on template name or "Edit" button

2. **Make Changes**
   - Update template content, variables, or metadata
   - Changes are tracked and versioned automatically

3. **Add Change Message**
   - Provide a brief description of what you changed
   - This helps with version history tracking

4. **Save Changes**
   - Click "Save Changes"
   - New version is created automatically

### Template Variables

Variables make templates dynamic and reusable. Here's how to work with them:

#### Variable Syntax
```
{{variable_name}}           # Simple variable substitution
{{#if condition}}...{{/if}} # Conditional content
{{#each items}}...{{/each}} # Loop over arrays
```

#### Variable Types
- **String**: Text content (most common)
- **Number**: Numeric values
- **Boolean**: True/false values
- **Array**: Lists of items
- **Object**: Complex structured data

#### Example Template with Variables
```
You are a {{role}} assistant specialized in {{domain}}.

User request: {{user_input}}

{{#if output_format}}
Please provide your response in {{output_format}} format.
{{/if}}

{{#if include_examples}}
Include relevant examples in your response.
{{/if}}
```

#### Corresponding Variables
```
role: string, required, "Assistant role (e.g., helpful, expert)"
domain: string, required, "Domain of expertise"
user_input: string, required, "The user's request or question"
output_format: string, optional, "Desired output format"
include_examples: boolean, optional, default: false
```

### Testing Templates

Before activating a template, always test it:

1. **Click "Test Template" Button**
   - Opens the template testing interface

2. **Provide Test Data**
   - Fill in values for all required variables
   - Optionally provide values for optional variables

3. **Select Target Provider** (Optional)
   - Choose which LLM provider to test against
   - Helps ensure compatibility

4. **Run Test**
   - Click "Run Test" to render the template
   - View the rendered output in the results panel

5. **Review Results**
   - Check that variables are substituted correctly
   - Ensure the rendered content makes sense
   - Look for any warnings or errors

#### Test Results Panel
- **Rendered Content**: Final template with variables substituted
- **Execution Time**: How long rendering took
- **Errors**: Any syntax or validation errors
- **Warnings**: Potential issues or improvements
- **Provider Response**: If tested against an LLM provider

### Template Validation

The system automatically validates templates:

#### Syntax Validation
- Checks for proper variable syntax (`{{variable_name}}`)
- Validates conditional logic structure
- Ensures all opening tags have closing tags

#### Variable Validation
- Verifies all used variables are defined
- Checks for unused variable definitions
- Validates variable types and constraints

#### Security Validation
- Scans for potential code injection patterns
- Ensures templates don't expose sensitive information
- Validates against security best practices

#### Common Validation Errors
- **Missing Variable**: Template uses `{{variable}}` but variable isn't defined
- **Unused Variable**: Variable is defined but not used in template
- **Syntax Error**: Malformed variable syntax or conditional logic
- **Security Issue**: Template contains potentially dangerous patterns

### Version History

Every template change creates a new version:

1. **View History**
   - Click "History" button on template detail page
   - See chronological list of all versions

2. **Compare Versions**
   - Select two versions to see differences
   - Changes are highlighted in diff view

3. **Revert to Previous Version**
   - Click "Revert" next to any previous version
   - Confirm the reversion in the dialog
   - Creates a new version with previous content

#### Version Information
- **Version Number**: Incremental version number
- **Change Message**: Description of what changed
- **Author**: Who made the changes
- **Timestamp**: When changes were made
- **Content Diff**: What specifically changed

### Template Analytics

Monitor template performance and usage:

1. **Access Analytics**
   - Click "Analytics" button on template detail page
   - View comprehensive usage and performance data

2. **Usage Statistics**
   - **Total Usage**: How many times template has been used
   - **Unique Users**: Number of different users
   - **Usage Trends**: Usage over time graphs
   - **Provider Breakdown**: Usage by LLM provider

3. **Performance Metrics**
   - **Render Time**: Average time to process template
   - **Success Rate**: Percentage of successful renderings
   - **Error Rate**: Percentage of failed renderings
   - **Quality Score**: Overall template effectiveness rating

4. **Time Range Selection**
   - View analytics for different time periods
   - Options: 1 day, 7 days, 30 days, 90 days, 1 year

## Template Best Practices

### Writing Effective Templates

1. **Clear Instructions**
   - Be specific about what you want the AI to do
   - Use clear, unambiguous language
   - Provide context and background information

2. **Proper Variable Usage**
   - Use descriptive variable names
   - Provide clear descriptions for each variable
   - Set sensible default values for optional variables

3. **Conditional Logic**
   - Use conditionals to handle optional content
   - Keep conditional logic simple and readable
   - Test all conditional branches

4. **Provider Optimization**
   - Consider different LLM provider capabilities
   - Test templates with multiple providers
   - Use provider-specific optimizations when needed

### Template Organization

1. **Naming Conventions**
   - Use descriptive, consistent names
   - Include purpose in the name
   - Use underscores for multi-word names

2. **Categorization**
   - Place templates in appropriate categories
   - Use custom category for specialized templates
   - Keep related templates together

3. **Documentation**
   - Write clear descriptions
   - Document variable purposes
   - Include usage examples in descriptions

### Security Considerations

1. **Input Validation**
   - Validate all variable inputs
   - Use appropriate variable types
   - Set validation rules for sensitive variables

2. **Content Safety**
   - Avoid templates that could generate harmful content
   - Include safety guidelines in system prompts
   - Review templates for potential misuse

3. **Access Control**
   - Only grant template editing permissions to trusted users
   - Regularly audit template changes
   - Monitor template usage for anomalies

## Bulk Operations

### Exporting Templates

1. **Select Templates**
   - Use checkboxes to select multiple templates
   - Or use "Select All" for bulk operations

2. **Choose Export Options**
   - **Format**: JSON or YAML
   - **Include History**: Whether to include version history
   - **Include Analytics**: Whether to include usage data

3. **Download Export**
   - Click "Export Selected"
   - Download generated file

### Importing Templates

1. **Prepare Import File**
   - Use exported template format
   - Ensure all required fields are present
   - Validate JSON/YAML syntax

2. **Upload File**
   - Click "Import Templates"
   - Select file to upload
   - Choose import options

3. **Review Import Results**
   - See summary of imported templates
   - Review any errors or conflicts
   - Resolve conflicts if needed

### Resetting to Defaults

1. **Access Reset Options**
   - Click "Reset to Defaults" in template list
   - Choose which categories to reset

2. **Confirm Reset**
   - Review what will be changed
   - Confirm the reset operation
   - Backup custom templates if needed

## Troubleshooting

### Common Issues

#### Template Not Rendering
- **Check Variable Definitions**: Ensure all used variables are defined
- **Validate Syntax**: Look for syntax errors in template content
- **Test with Simple Data**: Use basic test values to isolate issues

#### Variables Not Substituting
- **Check Variable Names**: Ensure exact match between template and definition
- **Verify Data Types**: Make sure provided values match expected types
- **Test Individual Variables**: Test each variable separately

#### Performance Issues
- **Simplify Templates**: Reduce complexity of conditional logic
- **Optimize Variables**: Remove unused variables
- **Check Analytics**: Review performance metrics for bottlenecks

#### Permission Errors
- **Verify Role**: Ensure you have template management permissions
- **Check Authentication**: Confirm you're logged in with correct account
- **Contact Administrator**: Request appropriate permissions if needed

### Getting Help

1. **In-App Help**
   - Click "?" icons for contextual help
   - Use tooltips for field explanations
   - Check validation messages for guidance

2. **Documentation**
   - Refer to this user guide
   - Check API documentation for technical details
   - Review template examples

3. **Support**
   - Contact system administrator
   - Report bugs through proper channels
   - Request new features or improvements

## Advanced Features

### A/B Testing Templates

1. **Create Template Variants**
   - Create multiple versions of the same template
   - Use different approaches or wording
   - Keep the same variable structure

2. **Monitor Performance**
   - Compare analytics between variants
   - Look at success rates and quality scores
   - Gather user feedback

3. **Choose Winner**
   - Activate the best-performing template
   - Deactivate or archive other variants
   - Document lessons learned

### Custom Template Categories

1. **Request New Category**
   - Contact system administrator
   - Provide justification for new category
   - Suggest category name and description

2. **Organize Templates**
   - Move related templates to new category
   - Update template metadata
   - Maintain consistent organization

### Integration with External Systems

1. **API Access**
   - Use REST API for programmatic access
   - Automate template updates
   - Integrate with external tools

2. **Webhook Notifications**
   - Set up notifications for template changes
   - Monitor template usage programmatically
   - Integrate with monitoring systems

This user guide provides comprehensive coverage of the template management system. For additional help or advanced use cases, consult the API documentation or contact your system administrator.