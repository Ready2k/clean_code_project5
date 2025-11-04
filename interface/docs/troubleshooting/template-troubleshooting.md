# Template System Troubleshooting Guide

This guide helps administrators diagnose and resolve common issues with the template management system.

## Quick Diagnostic Checklist

When experiencing template issues, start with this checklist:

- [ ] Is the template active and properly saved?
- [ ] Are all required variables defined and provided?
- [ ] Is the template syntax valid (no validation errors)?
- [ ] Do you have the necessary permissions?
- [ ] Is the system healthy (check system status)?
- [ ] Are there any recent changes that might have caused the issue?

## Common Issues and Solutions

### 1. Template Not Found Errors

#### Symptoms
- Error message: "Template not found: category/key"
- API returns 404 status
- Template appears in list but can't be accessed

#### Possible Causes
- Template was deleted or deactivated
- Incorrect category or key in API call
- Database connectivity issues
- Cache synchronization problems

#### Diagnosis Steps
1. **Verify Template Exists**
   ```bash
   # Check if template exists in database
   curl -H "Authorization: Bearer TOKEN" \
        http://localhost:8000/api/templates?search=template_name
   ```

2. **Check Template Status**
   - Navigate to template in admin interface
   - Verify it's marked as "Active"
   - Check if it's in the correct category

3. **Verify API Call**
   ```javascript
   // Correct API call format
   const template = await templateAPI.getTemplate('enhancement', 'main_enhancement_prompt');
   
   // Common mistake - wrong category
   const template = await templateAPI.getTemplate('enhancements', 'main_enhancement_prompt'); // Wrong!
   ```

#### Solutions
1. **Reactivate Template**
   - Go to template details page
   - Click "Activate" button
   - Verify status changes to "Active"

2. **Fix API Calls**
   - Use exact category and key names
   - Check for typos in template identifiers
   - Verify API endpoint URLs

3. **Clear Cache**
   ```bash
   # Clear template cache
   curl -X POST -H "Authorization: Bearer TOKEN" \
        http://localhost:8000/api/system/cache/clear
   ```

4. **Check Database Connection**
   - Verify database is accessible
   - Check connection pool status
   - Review database logs for errors

### 2. Variable Substitution Failures

#### Symptoms
- Variables appear as `{{variable_name}}` in rendered output
- Partial variable substitution
- Error: "Required variable 'X' not provided"

#### Possible Causes
- Missing variable values in template context
- Variable name mismatches
- Incorrect variable data types
- Template syntax errors

#### Diagnosis Steps
1. **Check Variable Definitions**
   ```json
   // Template variables should match usage
   {
     "variables": [
       {
         "name": "user_input",  // Must match {{user_input}} in template
         "type": "string",
         "required": true
       }
     ]
   }
   ```

2. **Verify Template Context**
   ```javascript
   // Ensure all required variables are provided
   const context = {
     user_input: "Hello world",     // Matches variable name exactly
     target_provider: "openai",     // Optional variable
     // missing_required_var: ""    // This would cause an error
   };
   ```

3. **Test Variable Rendering**
   - Use template test interface
   - Provide minimal test data
   - Check each variable individually

#### Solutions
1. **Fix Variable Names**
   ```javascript
   // Before (incorrect)
   const context = {
     userInput: "Hello"  // camelCase doesn't match {{user_input}}
   };
   
   // After (correct)
   const context = {
     user_input: "Hello"  // Matches template variable exactly
   };
   ```

2. **Provide Required Variables**
   - Check template definition for required variables
   - Ensure all required variables have values
   - Use default values for optional variables

3. **Fix Data Types**
   ```javascript
   // Ensure data types match variable definitions
   const context = {
     count: 5,              // number type
     enabled: true,         // boolean type
     items: ["a", "b"],     // array type
     config: { key: "val" } // object type
   };
   ```

### 3. Template Syntax Errors

#### Symptoms
- Validation errors when saving template
- Template fails to render
- Syntax highlighting shows errors

#### Common Syntax Issues
1. **Unmatched Braces**
   ```handlebars
   <!-- Wrong -->
   {{variable_name}
   {variable_name}}
   
   <!-- Correct -->
   {{variable_name}}
   ```

2. **Incorrect Conditional Syntax**
   ```handlebars
   <!-- Wrong -->
   {{if condition}}content{{endif}}
   
   <!-- Correct -->
   {{#if condition}}content{{/if}}
   ```

3. **Nested Conditionals**
   ```handlebars
   <!-- Wrong -->
   {{#if outer}}
     {{#if inner}}content{{/if}}
   <!-- Missing closing tag -->
   
   <!-- Correct -->
   {{#if outer}}
     {{#if inner}}content{{/if}}
   {{/if}}
   ```

#### Solutions
1. **Use Template Validator**
   - Save template to trigger validation
   - Review all error messages
   - Fix errors one by one

2. **Test Syntax Incrementally**
   - Start with simple template
   - Add complexity gradually
   - Test after each addition

3. **Use Syntax Reference**
   ```handlebars
   <!-- Variable substitution -->
   {{variable_name}}
   
   <!-- Conditional blocks -->
   {{#if condition}}
     Content when true
   {{else}}
     Content when false
   {{/if}}
   
   <!-- Loops -->
   {{#each items}}
     Item: {{this}}
   {{/each}}
   
   <!-- Comments -->
   {{!-- This is a comment --}}
   ```

### 4. Performance Issues

#### Symptoms
- Slow template rendering (>100ms)
- High CPU usage during template processing
- Timeout errors in API calls
- User complaints about response times

#### Possible Causes
- Complex template logic
- Large variable datasets
- Inefficient conditional statements
- Cache misses

#### Diagnosis Steps
1. **Check Template Analytics**
   - Review average render times
   - Identify slow-performing templates
   - Compare with baseline performance

2. **Profile Template Complexity**
   ```handlebars
   <!-- High complexity example -->
   {{#each large_array}}
     {{#if complex_condition}}
       {{#each nested_array}}
         {{#if another_condition}}
           Complex processing here
         {{/if}}
       {{/each}}
     {{/if}}
   {{/each}}
   ```

3. **Monitor System Resources**
   - Check CPU usage during rendering
   - Monitor memory consumption
   - Review database query performance

#### Solutions
1. **Simplify Template Logic**
   ```handlebars
   <!-- Before (complex) -->
   {{#each items}}
     {{#if item.type == "A"}}
       {{#if item.status == "active"}}
         {{#if item.priority > 5}}
           High priority A item: {{item.name}}
         {{/if}}
       {{/if}}
     {{/if}}
   {{/each}}
   
   <!-- After (simplified) -->
   {{#each high_priority_active_a_items}}
     High priority A item: {{name}}
   {{/each}}
   ```

2. **Optimize Variable Data**
   - Pre-process complex data structures
   - Filter arrays before passing to template
   - Use pagination for large datasets

3. **Enable Caching**
   - Cache frequently used templates
   - Implement template result caching
   - Use CDN for static template content

### 5. Permission and Access Issues

#### Symptoms
- "Access denied" or 403 errors
- Unable to edit or create templates
- Missing template management interface

#### Possible Causes
- Insufficient user permissions
- Role-based access control restrictions
- Authentication token issues
- System configuration problems

#### Diagnosis Steps
1. **Check User Permissions**
   ```bash
   # Get current user info
   curl -H "Authorization: Bearer TOKEN" \
        http://localhost:8000/api/auth/me
   ```

2. **Verify Role Assignments**
   - Check user role in admin interface
   - Verify role has template permissions
   - Review permission inheritance

3. **Test Authentication**
   - Verify JWT token is valid
   - Check token expiration
   - Test with fresh login

#### Solutions
1. **Update User Permissions**
   - Grant necessary template permissions
   - Assign appropriate role
   - Update user group memberships

2. **Refresh Authentication**
   - Log out and log back in
   - Generate new API token
   - Clear browser cache/cookies

3. **Contact Administrator**
   - Request permission elevation
   - Report access control issues
   - Verify system configuration

### 6. Database and Storage Issues

#### Symptoms
- Templates not saving
- Version history missing
- Analytics data incomplete
- Intermittent template loading failures

#### Possible Causes
- Database connectivity problems
- Storage space limitations
- Transaction conflicts
- Index corruption

#### Diagnosis Steps
1. **Check Database Status**
   ```bash
   # Check system health
   curl http://localhost:8000/api/system/health
   ```

2. **Review Database Logs**
   - Look for connection errors
   - Check for constraint violations
   - Monitor transaction timeouts

3. **Verify Storage Space**
   - Check disk space availability
   - Monitor database size growth
   - Review backup storage

#### Solutions
1. **Restart Database Connection**
   - Restart application services
   - Reset connection pools
   - Verify database server status

2. **Clean Up Storage**
   - Archive old template versions
   - Clean up temporary files
   - Optimize database indexes

3. **Contact System Administrator**
   - Report database issues
   - Request storage expansion
   - Schedule maintenance window

## Error Code Reference

### Template API Error Codes

| Code | Description | Common Causes | Solutions |
|------|-------------|---------------|-----------|
| TEMPLATE_NOT_FOUND | Template doesn't exist | Wrong ID, deleted template | Verify template exists, check ID |
| VALIDATION_ERROR | Template content invalid | Syntax errors, missing variables | Fix validation errors |
| PERMISSION_DENIED | Insufficient permissions | Wrong role, expired token | Check permissions, refresh auth |
| RENDER_ERROR | Template rendering failed | Variable issues, syntax errors | Debug variables, fix syntax |
| CACHE_ERROR | Template cache issue | Cache corruption, memory issues | Clear cache, restart service |
| DATABASE_ERROR | Database operation failed | Connection issues, constraints | Check DB status, contact admin |

### HTTP Status Codes

| Status | Meaning | Template Context |
|--------|---------|------------------|
| 200 | Success | Template operation completed |
| 201 | Created | New template created successfully |
| 400 | Bad Request | Invalid template data or parameters |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Template doesn't exist |
| 409 | Conflict | Template key already exists |
| 422 | Unprocessable Entity | Template validation failed |
| 500 | Internal Server Error | System error, contact administrator |

## Diagnostic Tools and Commands

### Template Validation
```bash
# Validate specific template
curl -X POST -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"content": "{{variable}}", "variables": [{"name": "variable", "type": "string"}]}' \
     http://localhost:8000/api/templates/validate

# Test template rendering
curl -X POST -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"testData": {"variable": "test"}}' \
     http://localhost:8000/api/templates/TEMPLATE_ID/test
```

### System Health Checks
```bash
# Overall system status
curl http://localhost:8000/api/system/status

# Template service status
curl -H "Authorization: Bearer TOKEN" \
     http://localhost:8000/api/system/services/templates

# Cache status
curl -H "Authorization: Bearer TOKEN" \
     http://localhost:8000/api/system/cache/status
```

### Performance Monitoring
```bash
# Template analytics
curl -H "Authorization: Bearer TOKEN" \
     "http://localhost:8000/api/templates/TEMPLATE_ID/analytics?timeRange=1d"

# System performance metrics
curl -H "Authorization: Bearer TOKEN" \
     http://localhost:8000/api/system/metrics
```

## Preventive Measures

### Regular Maintenance
1. **Weekly Tasks**
   - Review template performance metrics
   - Check for validation errors
   - Monitor usage patterns
   - Update documentation

2. **Monthly Tasks**
   - Archive old template versions
   - Review and optimize slow templates
   - Update default templates
   - Audit user permissions

3. **Quarterly Tasks**
   - Full system health check
   - Performance optimization review
   - Security audit
   - Backup verification

### Monitoring Setup
1. **Alerts**
   - Template rendering failures
   - Performance degradation
   - High error rates
   - System resource usage

2. **Dashboards**
   - Template usage statistics
   - Performance metrics
   - Error rate trends
   - User activity

3. **Logging**
   - Template operations
   - Performance data
   - Error details
   - User actions

## Getting Help

### Internal Resources
1. **Documentation**
   - User guide for template management
   - API documentation
   - System architecture docs

2. **Team Support**
   - Contact system administrator
   - Consult development team
   - Review team knowledge base

### External Resources
1. **Community**
   - Check community forums
   - Search for similar issues
   - Share solutions with others

2. **Professional Support**
   - Contact technical support
   - Schedule consultation
   - Request training

### Escalation Process
1. **Level 1**: Self-service using this guide
2. **Level 2**: Contact system administrator
3. **Level 3**: Engage development team
4. **Level 4**: Professional support

## Emergency Procedures

### Template System Failure
1. **Immediate Actions**
   - Check system status dashboard
   - Verify database connectivity
   - Review recent changes
   - Enable fallback mechanisms

2. **Communication**
   - Notify affected users
   - Update status page
   - Coordinate with team
   - Document incident

3. **Recovery**
   - Implement temporary fixes
   - Restore from backup if needed
   - Test system functionality
   - Monitor for stability

### Data Loss Prevention
1. **Backup Verification**
   - Test backup restoration
   - Verify data integrity
   - Check backup schedules
   - Update recovery procedures

2. **Version Control**
   - Maintain template history
   - Track all changes
   - Enable rollback capabilities
   - Document change reasons

This troubleshooting guide provides comprehensive coverage of common template system issues. Keep this guide updated as new issues are discovered and resolved.