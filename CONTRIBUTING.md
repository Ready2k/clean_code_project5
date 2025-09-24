# Contributing to Prompt Library

We welcome contributions to the Prompt Library project! This document provides guidelines for contributing code, documentation, and other improvements.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ with npm
- Git for version control
- TypeScript knowledge for core library development
- React/TypeScript for web interface development

### Development Setup
```bash
# Clone the repository
git clone <repository-url>
cd prompt-library

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start development (if working on web interface)
cd interface && npm run dev
```

## 📋 How to Contribute

### 1. Code Contributions

#### Before You Start
- Check existing issues and PRs to avoid duplicating work
- For major changes, open an issue first to discuss the approach
- Follow the established architecture patterns and coding standards

#### Development Process
1. **Fork the repository** and create a feature branch
2. **Follow naming conventions**: `feat/feature-name`, `fix/bug-name`, `docs/update-name`
3. **Write tests** for new functionality (maintain >80% coverage)
4. **Update documentation** for any API changes
5. **Follow commit conventions**: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`
6. **Submit a pull request** with clear description

#### Code Standards
- **TypeScript**: Use strict configuration, proper types, meaningful names
- **Testing**: Unit tests for services, integration tests for workflows
- **Documentation**: JSDoc for public APIs, README updates for features
- **Error Handling**: Use Result types or proper try/catch with meaningful errors
- **Security**: Never commit secrets, validate inputs, handle errors securely

### 2. Documentation Contributions

We especially welcome improvements to:
- **User guides** and tutorials
- **API documentation** and examples
- **Troubleshooting guides**
- **Architecture documentation**
- **Code comments** and inline documentation

### 3. Bug Reports

When reporting bugs, please include:
- **Clear description** of the issue
- **Steps to reproduce** the problem
- **Expected vs actual behavior**
- **Environment details** (Node.js version, OS, etc.)
- **Error messages** and stack traces if applicable
- **Minimal reproduction case** if possible

### 4. Feature Requests

For new features, please provide:
- **Clear use case** and motivation
- **Detailed description** of the proposed feature
- **Examples** of how it would be used
- **Consideration of alternatives** and trade-offs
- **Willingness to contribute** the implementation

## 🏗️ Architecture Guidelines

### Core Principles
- **Provider Agnostic**: Core library works without specific AI providers
- **Spec-Driven**: All behavior derived from schemas and interfaces
- **Human-Readable**: YAML for storage, clear APIs, good documentation
- **Extensible**: Easy to add new providers, features, and integrations
- **Testable**: Dependency injection, mocking, comprehensive test coverage

### Key Components
- **PromptLibrary**: Main orchestration class
- **Services**: Business logic (PromptManager, EnhancementAgent, etc.)
- **Adapters**: Provider-specific implementations
- **Models**: Data structures and interfaces
- **Storage**: File-based with optional database support

### Adding New Providers
1. Implement the `ProviderAdapter` interface
2. Add provider-specific rendering logic
3. Include model support and configuration options
4. Add comprehensive tests
5. Update documentation and examples

## 🧪 Testing Guidelines

### Test Requirements
- **Unit Tests**: All services and utilities
- **Integration Tests**: Critical workflows and provider integrations
- **Coverage**: Maintain >80% test coverage
- **Naming**: Descriptive test names that explain the scenario
- **Mocking**: Mock external dependencies appropriately

### Running Tests
```bash
# Run all tests
npm test

# Run specific test files
npm test -- src/services/__tests__/prompt-manager.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 📝 Documentation Standards

### Code Documentation
- **JSDoc comments** for all public APIs
- **Inline comments** for complex logic
- **README updates** for new features
- **Type definitions** with clear descriptions

### User Documentation
- **Clear examples** with real-world use cases
- **Step-by-step guides** for common tasks
- **Troubleshooting sections** for known issues
- **API reference** with complete parameter descriptions

## 🔍 Code Review Process

### What We Look For
- **Functionality**: Does the code work as intended?
- **Tests**: Are there appropriate tests with good coverage?
- **Documentation**: Are changes documented appropriately?
- **Style**: Does the code follow project conventions?
- **Security**: Are there any security concerns?
- **Performance**: Are there any performance implications?

### Review Timeline
- **Initial response**: Within 2-3 business days
- **Full review**: Within 1 week for most PRs
- **Complex changes**: May require additional discussion and iteration

## 🚀 Release Process

### Versioning
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes to public APIs
- **MINOR**: New features, backward compatible
- **PATCH**: Bug fixes, backward compatible

### Release Checklist
- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped appropriately
- [ ] Release notes prepared

## 💬 Community Guidelines

### Communication
- **Be respectful** and constructive in all interactions
- **Ask questions** if anything is unclear
- **Provide context** when reporting issues or requesting features
- **Help others** when you can share knowledge

### Code of Conduct
- **Inclusive environment**: Welcome contributors of all backgrounds
- **Professional behavior**: Keep discussions focused and respectful
- **Constructive feedback**: Focus on the code and ideas, not the person
- **Learning mindset**: We're all here to learn and improve

## 🆘 Getting Help

### Resources
- **Documentation**: Start with README.md and USAGE.md
- **Examples**: Check the test files for usage patterns
- **Issues**: Search existing issues for similar problems
- **Discussions**: Use GitHub Discussions for questions

### Contact
- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Pull Requests**: For code contributions and documentation improvements

## 🙏 Recognition

Contributors will be recognized in:
- **CHANGELOG.md**: For significant contributions
- **README.md**: Contributors section
- **Release notes**: For major features and fixes

Thank you for contributing to the Prompt Library project! Your contributions help make AI prompt management better for everyone.