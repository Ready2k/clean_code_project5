---
inclusion: always
---

# Project Standards and Guidelines

## Code Quality Standards

### TypeScript Best Practices
- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use proper error handling with Result types or try/catch
- Document public APIs with JSDoc comments
- Use meaningful variable and function names

### Testing Requirements
- Maintain >80% test coverage
- Write unit tests for all services and utilities
- Include integration tests for critical workflows
- Use descriptive test names that explain the scenario
- Mock external dependencies appropriately

### File Organization
- Follow the established directory structure:
  - `src/` - Core library code
  - `src/services/` - Business logic services
  - `src/adapters/` - Provider-specific implementations
  - `src/models/` - Data models and interfaces
  - `interface/` - Web interface application
- Use consistent naming conventions (kebab-case for files, PascalCase for classes)

## Development Workflow

### Git Practices
- Use conventional commit messages (feat:, fix:, docs:, etc.)
- Create feature branches from main
- Require PR reviews for main branch
- Keep commits atomic and focused

### Documentation Requirements
- Update README.md for major changes
- Maintain USAGE.md with current examples
- Document breaking changes in commit messages
- Keep inline code documentation current

## Architecture Principles

### Provider Agnostic Design
- Core library should work without specific AI providers
- Use adapter pattern for provider integrations
- Keep provider-specific logic isolated in adapters
- Support extensibility for new providers

### Data Persistence
- Use YAML for human-readable prompt storage
- Use JSON for API responses and caches
- Implement proper error handling for file operations
- Support both filesystem and database storage options

### Security Considerations
- Never commit API keys or secrets
- Use environment variables for configuration
- Validate all user inputs
- Implement proper error handling without exposing internals