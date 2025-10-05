# MCP Tools Usage Guidelines

## Chrome DevTools MCP Tools

### When to Use Chrome DevTools
Chrome DevTools MCP tools are ideal for:

#### Web Development & Testing
- **UI/UX Testing**: Take screenshots, interact with elements, test responsive design
- **Form Testing**: Fill forms, test validation, simulate user interactions
- **Performance Analysis**: Run performance traces, analyze Core Web Vitals, identify bottlenecks
- **Network Debugging**: Monitor API calls, inspect request/response data, test different network conditions
- **Browser Automation**: Automate repetitive testing tasks, create test scenarios

#### Specific Use Cases
- **Visual Regression Testing**: Take screenshots before/after changes
- **Cross-browser Compatibility**: Test functionality across different viewport sizes
- **Performance Optimization**: Identify slow-loading resources, analyze rendering performance
- **User Experience Validation**: Simulate real user interactions and workflows
- **API Integration Testing**: Monitor network requests during development

### Chrome DevTools Best Practices
- Always take a snapshot before interacting with elements to get current UIDs
- Use `mcp_chrome_devtools_take_screenshot` for visual documentation
- Leverage `mcp_chrome_devtools_performance_start_trace` for performance insights
- Monitor console messages with `mcp_chrome_devtools_list_console_messages` for debugging
- Use network request monitoring to validate API integrations

## Context7 MCP Tools

### When to Use Context7
Context7 tools are perfect for:

#### Documentation & Learning
- **Library Research**: Find and explore documentation for any JavaScript/TypeScript library
- **Code Examples**: Get practical, up-to-date code snippets and usage patterns
- **API Reference**: Access comprehensive API documentation with type definitions
- **Best Practices**: Learn recommended patterns and avoid common pitfalls

#### Development Workflow Integration
- **Dependency Selection**: Research libraries before adding them to projects
- **Implementation Guidance**: Get specific examples for complex integrations
- **Troubleshooting**: Find solutions to common issues with specific libraries
- **Version Migration**: Understand breaking changes between library versions

### Context7 Best Practices
- Always use `resolve_library_id` first to find the correct library identifier
- Specify focused topics (e.g., "hooks", "routing", "authentication") for targeted results
- Adjust token limits based on complexity - use 2000-5000 for focused queries
- Prioritize libraries with high trust scores (8-10) for production use
- Check for version-specific documentation when working with specific library versions

## Tool Selection Decision Matrix

### Choose Chrome DevTools When:
- ✅ Testing web applications or websites
- ✅ Need visual feedback or screenshots
- ✅ Debugging browser-specific issues
- ✅ Performance analysis required
- ✅ Automating user interactions
- ✅ Network request monitoring needed

### Choose Context7 When:
- ✅ Learning new libraries or frameworks
- ✅ Need code examples and documentation
- ✅ Researching implementation approaches
- ✅ Troubleshooting library-specific issues
- ✅ Comparing different libraries
- ✅ Understanding API usage patterns

### Use Both Together When:
- 🔄 Building web applications with new libraries (Context7 for docs, Chrome for testing)
- 🔄 Debugging integration issues (Context7 for expected behavior, Chrome for actual behavior)
- 🔄 Performance optimization (Context7 for best practices, Chrome for measurement)
- 🔄 Learning through practice (Context7 for theory, Chrome for hands-on testing)

## Integration Workflows

### Development Workflow
1. **Research Phase**: Use Context7 to understand library capabilities and patterns
2. **Implementation Phase**: Code based on Context7 examples and documentation
3. **Testing Phase**: Use Chrome DevTools to validate functionality and performance
4. **Debugging Phase**: Combine both tools to identify and resolve issues

### Learning Workflow
1. **Discovery**: Context7 to find relevant libraries and understand concepts
2. **Practice**: Chrome DevTools to test examples in real browser environment
3. **Validation**: Context7 to verify best practices and common patterns
4. **Optimization**: Chrome DevTools to measure and improve performance

## Common Patterns

### Library Integration Pattern
```
1. Context7: Research library documentation and examples
2. Implement: Write code based on Context7 guidance
3. Chrome DevTools: Test implementation in browser
4. Context7: Troubleshoot any issues with additional examples
5. Chrome DevTools: Validate final performance and functionality
```

### Debugging Pattern
```
1. Chrome DevTools: Identify the issue (console errors, network failures, performance)
2. Context7: Research expected behavior and common solutions
3. Chrome DevTools: Test potential fixes
4. Context7: Verify solution follows best practices
```

### Performance Optimization Pattern
```
1. Chrome DevTools: Measure current performance with traces
2. Context7: Research optimization techniques for specific libraries
3. Implement: Apply optimizations based on Context7 guidance
4. Chrome DevTools: Measure improved performance
5. Context7: Validate optimizations follow recommended patterns
```

## Tool Limitations

### Chrome DevTools Limitations
- Requires a running web application or accessible URL
- Limited to browser-based testing and debugging
- Cannot provide implementation guidance or documentation
- Performance traces require page reloads for accurate measurement

### Context7 Limitations
- Provides documentation and examples, not live testing
- Cannot interact with running applications
- Limited to available library documentation in the system
- Cannot validate actual implementation behavior

## Security Considerations

### Chrome DevTools Security
- Be cautious when testing on production sites
- Avoid exposing sensitive data in screenshots or traces
- Use appropriate network throttling for realistic testing
- Clear sensitive form data after testing

### Context7 Security
- Verify library recommendations against security best practices
- Check library trust scores and maintenance status
- Cross-reference security advisories for recommended libraries
- Validate code examples for security vulnerabilities before implementation

This guidance should be used in conjunction with existing project standards and security requirements.