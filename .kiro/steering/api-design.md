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
- Use consistent response shapes with standard HTTP status codes
- Include metadata (timestamps, versions, pagination info)
- Support pagination for list endpoints with cursor-based pagination
- Provide clear error response format with error codes and messages
- Include request correlation IDs for debugging
- Use OpenAPI 3.0 specification for comprehensive API documentation

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
- Use plugin architecture for extending functionality
- Support middleware for request/response processing

## REST API Standards

### Endpoint Design
- Use RESTful resource-based URLs: `/api/v1/prompts/{id}`
- Support standard HTTP methods (GET, POST, PUT, DELETE, PATCH)
- Use query parameters for filtering, sorting, and pagination
- Include API versioning in URL path
- Implement proper CORS policies for web interface

### Authentication & Authorization
- Use JWT tokens for stateless authentication
- Implement refresh token rotation for security
- Support role-based access control (RBAC)
- Include proper rate limiting per user/IP
- Log all authentication attempts for security monitoring

### Real-time Features
- Use WebSocket connections for collaborative editing
- Implement proper connection management and reconnection logic
- Support room-based collaboration with proper access control
- Handle connection state synchronization gracefully