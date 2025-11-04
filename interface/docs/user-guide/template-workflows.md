# Template Management Workflows

This document provides step-by-step workflows for common template management tasks with visual guides.

## Workflow 1: Creating Your First Custom Template

### Overview
This workflow guides you through creating a custom template for a specific use case.

### Prerequisites
- Administrator access to the system
- Understanding of your use case requirements
- Basic knowledge of template variables

### Steps

#### Step 1: Access Template Management
1. Navigate to the admin interface at `http://localhost:8000/admin`
2. Click on the "Prompt Templates" tab
3. You'll see the template dashboard

*[Screenshot: Admin interface with Prompt Templates tab highlighted]*

#### Step 2: Start Template Creation
1. Click the "Create Template" button (top-right corner)
2. The template creation form will open

*[Screenshot: Template creation form with empty fields]*

#### Step 3: Fill Basic Information
1. **Category**: Select "Custom" from dropdown
2. **Key**: Enter unique identifier (e.g., "code_review_assistant")
3. **Name**: Enter descriptive name (e.g., "Code Review Assistant")
4. **Description**: Describe the template's purpose

```
Example:
Category: Custom
Key: code_review_assistant
Name: Code Review Assistant
Description: Helps developers review code and provide constructive feedback
```

*[Screenshot: Form with basic information filled out]*

#### Step 4: Write Template Content
1. In the content editor, write your template:

```
You are an expert {{language}} developer and code reviewer.

Please review the following {{code_type}} code:

```{{language}}
{{code_content}}
```

Focus on:
{{#if check_security}}
- Security vulnerabilities and best practices
{{/if}}
{{#if check_performance}}
- Performance optimizations
{{/if}}
{{#if check_style}}
- Code style and readability
{{/if}}

Provide your feedback in {{output_format}} format with:
1. Summary of overall code quality
2. Specific issues found (if any)
3. Recommendations for improvement
4. Positive aspects worth highlighting

{{#if include_examples}}
Include code examples for your suggestions where helpful.
{{/if}}
```

*[Screenshot: Content editor with template code]*

#### Step 5: Define Variables
Click "Add Variable" for each variable and fill in details:

1. **language**
   - Type: String
   - Required: Yes
   - Description: Programming language (e.g., Python, JavaScript)

2. **code_type**
   - Type: String
   - Required: Yes
   - Description: Type of code (function, class, module, etc.)

3. **code_content**
   - Type: String
   - Required: Yes
   - Description: The actual code to review

4. **check_security**
   - Type: Boolean
   - Required: No
   - Default: true
   - Description: Whether to focus on security aspects

5. **check_performance**
   - Type: Boolean
   - Required: No
   - Default: true
   - Description: Whether to analyze performance

6. **check_style**
   - Type: Boolean
   - Required: No
   - Default: true
   - Description: Whether to check code style

7. **output_format**
   - Type: String
   - Required: No
   - Default: "markdown"
   - Description: Format for the response

8. **include_examples**
   - Type: Boolean
   - Required: No
   - Default: false
   - Description: Whether to include code examples

*[Screenshot: Variables section with all variables defined]*

#### Step 6: Test the Template
1. Click "Test Template" button
2. Fill in test values:

```
language: Python
code_type: function
code_content: def calculate_total(items):
    total = 0
    for item in items:
        total = total + item.price
    return total
check_security: true
check_performance: true
check_style: true
output_format: markdown
include_examples: true
```

3. Click "Run Test"
4. Review the rendered output

*[Screenshot: Test interface with sample data and results]*

#### Step 7: Save and Activate
1. If test results look good, click "Save Template"
2. Template is created in inactive state
3. Click "Activate" to make it available for use

*[Screenshot: Template saved successfully with activation option]*

### Expected Outcome
You now have a custom code review template that can be used throughout the system.

---

## Workflow 2: Updating an Enhancement Template

### Overview
This workflow shows how to modify existing enhancement templates to improve AI prompt enhancement.

### Prerequisites
- Administrator access
- Understanding of current enhancement behavior
- Knowledge of desired improvements

### Steps

#### Step 1: Locate Enhancement Template
1. Go to Prompt Templates dashboard
2. Filter by "Enhancement" category
3. Find "Main Enhancement Instruction" template
4. Click to open template details

*[Screenshot: Template list filtered by Enhancement category]*

#### Step 2: Review Current Template
1. Examine current template content
2. Check usage analytics to understand impact
3. Review recent version history
4. Note any user feedback or issues

*[Screenshot: Template detail view showing content and analytics]*

#### Step 3: Plan Your Changes
Common enhancement template improvements:
- Add provider-specific optimizations
- Include domain-specific instructions
- Improve variable handling
- Add safety guidelines

#### Step 4: Edit Template Content
1. Click "Edit Template" button
2. Modify the template content:

```
Please enhance the following human-readable prompt into a structured format optimized for {{target_provider}}.

HUMAN PROMPT:
Goal: {{goal}}
Audience: {{audience}}
Steps: {{steps}}
Output Format: {{output_format}}
Expected Fields: {{expected_fields}}

{{#if domain_knowledge}}
DOMAIN CONTEXT:
{{domain_knowledge}}
{{/if}}

REQUIREMENTS:
- Convert to structured format with system instructions, user template, rules, and capabilities
- Extract variables using {{variable_name}} syntax where content should be dynamic
- Preserve the original intent and goal
- Make the prompt clear, specific, and actionable
{{#if target_provider}}
- Optimize for {{target_provider}} provider characteristics
{{/if}}
{{#if complexity_level}}
- Adjust complexity for {{complexity_level}} level users
{{/if}}

SAFETY GUIDELINES:
- Ensure the enhanced prompt promotes helpful, harmless, and honest responses
- Avoid prompts that could generate inappropriate or harmful content
- Include appropriate disclaimers for sensitive topics

Respond with a JSON object containing the structured prompt format.
```

*[Screenshot: Template editor with updated content]*

#### Step 5: Update Variables
Add new variables for the enhancements:

1. **target_provider**
   - Type: String
   - Required: No
   - Description: Target LLM provider (openai, anthropic, meta)

2. **domain_knowledge**
   - Type: String
   - Required: No
   - Description: Specific domain context or expertise area

3. **complexity_level**
   - Type: String
   - Required: No
   - Default: "intermediate"
   - Description: User expertise level (beginner, intermediate, advanced)

*[Screenshot: Variables section with new variables added]*

#### Step 6: Test Changes
1. Use the existing test data plus new variables
2. Test with different provider values
3. Verify all conditional logic works correctly
4. Check that output quality improves

*[Screenshot: Test results showing improved output]*

#### Step 7: Document Changes
1. Add change message: "Added provider optimization and domain context support"
2. Update template description if needed
3. Save changes

*[Screenshot: Save dialog with change message]*

#### Step 8: Monitor Impact
1. Activate the updated template
2. Monitor usage analytics
3. Gather user feedback
4. Be prepared to revert if issues arise

### Expected Outcome
Enhanced template provides better, more targeted prompt improvements.

---

## Workflow 3: Setting Up A/B Testing for Templates

### Overview
This workflow demonstrates how to test different template variations to optimize performance.

### Prerequisites
- Two or more template variants to test
- Ability to monitor analytics
- Understanding of success metrics

### Steps

#### Step 1: Create Template Variants
1. Start with your base template
2. Create a copy with "_variant_a" suffix
3. Create another copy with "_variant_b" suffix
4. Modify each variant with different approaches

*[Screenshot: Template list showing base template and variants]*

#### Step 2: Design Variations
Example variations for a question generation template:

**Variant A: Direct Approach**
```
Generate {{question_count}} specific questions about {{topic}} that will help improve the user's prompt.

Focus on:
- Clarity and specificity
- Missing information
- Potential ambiguities

Questions should be actionable and help the user provide better context.
```

**Variant B: Structured Approach**
```
As an expert prompt engineer, analyze the {{topic}} and generate {{question_count}} strategic questions.

For each question, consider:
1. What information is missing?
2. How will this improve the prompt?
3. What specific details are needed?

Format: Provide questions that guide the user toward more effective prompts.
```

*[Screenshot: Side-by-side comparison of variant templates]*

#### Step 3: Configure Test Parameters
1. Set equal usage distribution (50/50)
2. Define success metrics:
   - User engagement with questions
   - Prompt improvement quality
   - User satisfaction ratings
3. Set test duration (e.g., 2 weeks)

#### Step 4: Activate Both Variants
1. Activate Variant A
2. Activate Variant B
3. Deactivate original template
4. Monitor system to ensure proper distribution

*[Screenshot: Template status showing both variants active]*

#### Step 5: Monitor Performance
1. Check analytics daily
2. Compare key metrics:
   - Usage frequency
   - Success rates
   - User feedback scores
   - Question response rates

*[Screenshot: Analytics dashboard comparing variants]*

#### Step 6: Analyze Results
After test period:
1. Export analytics data
2. Compare performance metrics
3. Identify statistical significance
4. Consider qualitative feedback

Example results:
```
Variant A:
- Usage: 1,247 times
- Success Rate: 87.3%
- Avg Response Time: 1.2s
- User Rating: 4.2/5

Variant B:
- Usage: 1,198 times
- Success Rate: 91.7%
- Avg Response Time: 1.4s
- User Rating: 4.6/5
```

#### Step 7: Implement Winner
1. Choose the better-performing variant (Variant B in example)
2. Deactivate the losing variant
3. Rename winner to remove "_variant_b" suffix
4. Document lessons learned

*[Screenshot: Final template with winning variant content]*

### Expected Outcome
Optimized template based on real usage data and performance metrics.

---

## Workflow 4: Migrating from Hardcoded Prompts

### Overview
This workflow guides you through replacing hardcoded prompts with manageable templates.

### Prerequisites
- Identification of hardcoded prompts in the system
- Understanding of current prompt behavior
- Access to development environment for testing

### Steps

#### Step 1: Audit Existing Prompts
1. Review system code for hardcoded prompts
2. Document current prompt content
3. Identify variable elements
4. Note usage contexts

Example hardcoded prompt:
```typescript
const enhancementPrompt = `Please enhance this prompt for ${provider}:
${userPrompt}
Make it more specific and actionable.`;
```

*[Screenshot: Code editor showing hardcoded prompt]*

#### Step 2: Extract Variables
Identify dynamic elements:
- `provider`: LLM provider name
- `userPrompt`: User's original prompt
- Static instruction text

#### Step 3: Create Template
1. Create new template in appropriate category
2. Convert hardcoded text to template format:

```
Please enhance this prompt for {{provider}}:

{{user_prompt}}

Make it more specific and actionable for {{provider}} capabilities.

{{#if include_examples}}
Include relevant examples to illustrate the desired output format.
{{/if}}

{{#if target_audience}}
Consider that the target audience is {{target_audience}}.
{{/if}}
```

*[Screenshot: Template creation form with converted content]*

#### Step 4: Define Variables
1. **provider**: String, required, "LLM provider name"
2. **user_prompt**: String, required, "User's original prompt"
3. **include_examples**: Boolean, optional, default false
4. **target_audience**: String, optional, "Intended audience"

#### Step 5: Test Template
1. Use same test data as original hardcoded prompt
2. Verify output matches or improves upon original
3. Test edge cases and error conditions

*[Screenshot: Test comparison showing original vs template output]*

#### Step 6: Update Application Code
Replace hardcoded prompt with template call:

```typescript
// Before
const enhancementPrompt = `Please enhance this prompt for ${provider}:
${userPrompt}
Make it more specific and actionable.`;

// After
const enhancementPrompt = await templateManager.getTemplate(
  'enhancement',
  'main_enhancement_prompt',
  {
    provider: provider,
    user_prompt: userPrompt,
    include_examples: shouldIncludeExamples,
    target_audience: context.audience
  }
);
```

#### Step 7: Deploy and Monitor
1. Deploy updated code to staging environment
2. Test thoroughly with real scenarios
3. Monitor for any regressions
4. Deploy to production when confident

*[Screenshot: Deployment pipeline showing successful tests]*

#### Step 8: Cleanup
1. Remove old hardcoded prompt code
2. Update documentation
3. Train team on new template system
4. Archive old implementation notes

### Expected Outcome
Flexible, manageable template system replacing rigid hardcoded prompts.

---

## Workflow 5: Troubleshooting Template Issues

### Overview
This workflow helps diagnose and fix common template problems.

### Common Issues and Solutions

#### Issue 1: Template Not Rendering

**Symptoms:**
- Template returns empty or error content
- Variables not being substituted
- System errors in logs

**Diagnosis Steps:**
1. Check template syntax validation
2. Verify all variables are defined
3. Test with minimal data set
4. Review error logs

*[Screenshot: Template validation showing syntax errors]*

**Solution:**
1. Fix syntax errors highlighted in validator
2. Add missing variable definitions
3. Test incrementally with simple content

#### Issue 2: Poor Template Performance

**Symptoms:**
- Slow template rendering
- High CPU usage during template processing
- User complaints about response times

**Diagnosis Steps:**
1. Check template analytics for render times
2. Review template complexity
3. Identify performance bottlenecks
4. Test with different data sizes

*[Screenshot: Analytics showing high render times]*

**Solution:**
1. Simplify complex conditional logic
2. Reduce number of variables
3. Optimize template content
4. Consider caching strategies

#### Issue 3: Variable Substitution Failures

**Symptoms:**
- Variables appear as `{{variable_name}}` in output
- Partial variable substitution
- Type conversion errors

**Diagnosis Steps:**
1. Verify variable names match exactly
2. Check data types of provided values
3. Test individual variables
4. Review variable validation rules

*[Screenshot: Test output showing unsubstituted variables]*

**Solution:**
1. Correct variable name mismatches
2. Convert data to expected types
3. Add proper default values
4. Update validation rules

### Troubleshooting Checklist

#### Before Making Changes
- [ ] Backup current template version
- [ ] Document the issue clearly
- [ ] Identify affected users/systems
- [ ] Plan rollback strategy

#### During Troubleshooting
- [ ] Test changes in isolation
- [ ] Use minimal test data
- [ ] Check each variable individually
- [ ] Validate syntax after each change

#### After Fixing Issues
- [ ] Test with full data set
- [ ] Monitor performance metrics
- [ ] Gather user feedback
- [ ] Document solution for future reference

### Getting Additional Help

#### Internal Resources
1. **System Logs**: Check application logs for detailed error messages
2. **Analytics Dashboard**: Review performance and usage metrics
3. **Version History**: Compare with previous working versions
4. **Team Knowledge**: Consult with other administrators

#### External Resources
1. **Documentation**: Refer to API documentation and user guides
2. **Community**: Check community forums for similar issues
3. **Support**: Contact technical support for complex problems

*[Screenshot: Help resources and contact information]*

---

## Best Practices Summary

### Template Design
- Keep templates focused and single-purpose
- Use clear, descriptive variable names
- Include helpful descriptions and examples
- Test thoroughly before activation

### Variable Management
- Define all variables explicitly
- Use appropriate data types
- Provide sensible defaults
- Validate input data

### Performance Optimization
- Monitor template analytics regularly
- Optimize slow-performing templates
- Use caching where appropriate
- Keep templates as simple as possible

### Change Management
- Always test changes before deployment
- Document all modifications
- Use version control effectively
- Plan for rollback scenarios

### Security Considerations
- Validate all input data
- Avoid exposing sensitive information
- Follow security best practices
- Regular security audits

This workflow documentation provides practical, step-by-step guidance for managing templates effectively. Each workflow includes visual cues and expected outcomes to ensure successful completion.