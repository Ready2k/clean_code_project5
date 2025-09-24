---
inclusion: fileMatch
fileMatchPattern: "**/*.ts"
---

# API Design Guidelines

## Interface Design Principles

### Service Interfaces
- All services should implement clear interfaces
- Use dependency injection for testability
- Return Result types or throw meaningful errors
- Include proper JSDoc documentation

### Method Naming
- Use verb-noun patterns: `createPrompt`, `enhancePrompt`, `renderPrompt`
- Be explicit about async operations: all async methods return Promise
- Use consistent parameter ordering: id first, then options/data

### Error Handling
- Use custom error types for different failure modes
- Include context in error messages
- Never expose internal implementation details in errors
- Log errors appropriately for debugging

## Data Models

### Core Models
- `PromptRecord`: Complete prompt with metadata and history
- `HumanPrompt`: User-friendly prompt definition
- `StructuredPrompt`: AI-enhanced prompt with variables
- `Variable`: Dynamic placeholder with type and validation
- `Rating`: User evaluation with score and notes

### API Responses
- Use consistent response shapes
- Include metadata (timestamps, versions, etc.)
- Support pagination for list endpoints
- Provide clear error response format

## Provider Integration

### Adapter Pattern
- Each provider implements `ProviderAdapter` interface
- Isolate provider-specific logic in adapters
- Support model-specific configurations
- Handle provider errors gracefully

### Extensibility
- New providers should be addable without core changes
- Support custom model configurations
- Allow provider-specific options in render calls