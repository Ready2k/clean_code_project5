---
inclusion: fileMatch
fileMatchPattern: "**/*.test.*"
---

# Testing Standards and Guidelines

## Testing Strategy

### Test Coverage Requirements
- Maintain >90% test coverage for core library services
- Maintain >80% test coverage for web interface components
- Include both unit tests and integration tests
- Test error conditions and edge cases thoroughly
- Use mutation testing to validate test quality

### Test Organization
- Co-locate test files with source code using `.test.ts` suffix
- Group related tests using `describe` blocks
- Use descriptive test names that explain the scenario
- Follow AAA pattern: Arrange, Act, Assert
- Keep tests focused and independent

## Unit Testing

### Core Library Testing
- Test all service methods with various input scenarios
- Mock external dependencies (file system, HTTP calls, AI providers)
- Test error handling and validation logic
- Use dependency injection for better testability
- Test async operations with proper await/async patterns

### Frontend Component Testing
- Use React Testing Library for component testing
- Test user interactions and state changes
- Mock API calls and external dependencies
- Test accessibility features and keyboard navigation
- Test responsive design behavior

### Backend API Testing
- Test all REST endpoints with various payloads
- Test authentication and authorization scenarios
- Test error responses and status codes
- Test database operations with test database
- Test WebSocket connections and real-time features

## Integration Testing

### End-to-End Testing
- Test complete user workflows from frontend to backend
- Test multi-provider prompt rendering scenarios
- Test collaborative editing features
- Test file upload and export functionality
- Use test databases and mock external services

### Database Integration
- Test database migrations and rollbacks
- Test complex queries and performance
- Test transaction handling and rollback scenarios
- Test connection pooling and timeout handling
- Use database fixtures for consistent test data

## Testing Tools and Configuration

### Core Library Testing
- Use Vitest for fast unit testing
- Use MSW (Mock Service Worker) for API mocking
- Use test containers for database integration tests
- Configure proper test timeouts for async operations

### Frontend Testing
- Use Jest and React Testing Library
- Use MSW for API mocking in frontend tests
- Use Playwright for end-to-end testing
- Test in multiple browsers and viewport sizes

### Backend Testing
- Use Jest for Node.js testing
- Use Supertest for HTTP endpoint testing
- Use test containers for database and Redis testing
- Use Socket.io client for WebSocket testing

## Test Data Management

### Test Fixtures
- Use factory functions for creating test data
- Maintain realistic test data that reflects production scenarios
- Use database seeders for integration test setup
- Clean up test data after each test run

### Mock Strategies
- Mock external AI provider APIs with realistic responses
- Mock file system operations for consistent testing
- Mock time-dependent operations for deterministic tests
- Use dependency injection to make mocking easier

## Continuous Integration

### Automated Testing
- Run all tests on every pull request
- Include linting and formatting checks
- Run security scans on dependencies
- Generate and publish test coverage reports
- Fail builds on test failures or coverage drops

### Performance Testing
- Include performance benchmarks for critical operations
- Test database query performance
- Test API response times under load
- Monitor memory usage during test runs