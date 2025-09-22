# Testing Guide

This document provides comprehensive information about the testing strategy and implementation for the Professional Interface project.

## Overview

The project implements a multi-layered testing approach covering:

- **Unit Tests**: Individual component and function testing
- **Integration Tests**: API endpoints and user workflow testing  
- **End-to-End Tests**: Complete user journey testing with Cypress
- **Performance Tests**: Large dataset and concurrent operation testing
- **Accessibility Tests**: WCAG compliance and screen reader support

## Test Structure

```
interface/
├── frontend/
│   ├── src/
│   │   ├── __tests__/
│   │   │   ├── integration/          # Integration tests
│   │   │   ├── performance/          # Performance tests
│   │   │   └── accessibility/        # Accessibility tests
│   │   ├── components/
│   │   │   └── **/__tests__/         # Component unit tests
│   │   └── test/
│   │       ├── setup.ts              # Test configuration
│   │       ├── test-utils.tsx        # Testing utilities
│   │       └── mocks/                # Mock data and handlers
│   └── cypress/
│       ├── e2e/                      # End-to-end tests
│       └── support/                  # Cypress configuration
└── backend/
    └── src/
        └── __tests__/
            ├── integration/          # API integration tests
            └── **/*.test.ts          # Unit tests
```

## Running Tests

### Frontend Tests

```bash
# Run all tests
npm run test:all

# Run specific test types
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests only
npm run test:performance       # Performance tests only
npm run test:accessibility     # Accessibility tests only

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test

# End-to-end tests
npm run test:e2e              # Headless mode
npm run test:e2e:open         # Interactive mode
```

### Backend Tests

```bash
# Run all tests
npm run test:all

# Run specific test types
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests only

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test
```

## Test Categories

### Unit Tests

Unit tests focus on individual components and functions in isolation.

**Location**: `src/components/**/__tests__/`

**Example**:
```typescript
describe('PromptCard', () => {
  it('renders prompt information correctly', () => {
    render(<PromptCard prompt={mockPrompt} {...handlers} />);
    
    expect(screen.getByText('Test Prompt')).toBeInTheDocument();
    expect(screen.getByText('A test prompt')).toBeInTheDocument();
  });
});
```

**Coverage**:
- Component rendering
- User interactions
- Props handling
- Error states
- Loading states

### Integration Tests

Integration tests verify that multiple components work together correctly.

**Location**: `src/__tests__/integration/`

**Example**:
```typescript
describe('Authentication Flow Integration', () => {
  it('allows user to login and access protected routes', async () => {
    render(<App />);
    
    // Login process
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    // Verify redirect to dashboard
    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });
  });
});
```

**Coverage**:
- Authentication flows
- API interactions
- State management
- Route navigation
- Error handling

### End-to-End Tests

E2E tests simulate real user interactions across the entire application.

**Location**: `cypress/e2e/`

**Example**:
```typescript
describe('Prompt Management', () => {
  beforeEach(() => {
    cy.login('test@example.com', 'password123');
    cy.visit('/prompts');
  });

  it('should create a new prompt', () => {
    cy.get('[data-testid="create-prompt-button"]').click();
    cy.get('[data-testid="prompt-title-input"]').type('E2E Test Prompt');
    cy.get('[data-testid="create-prompt-submit"]').click();
    
    cy.get('[data-testid="success-message"]')
      .should('contain', 'Prompt created successfully');
  });
});
```

**Coverage**:
- Complete user workflows
- Cross-browser compatibility
- Real API interactions
- Performance validation
- Accessibility compliance

### Performance Tests

Performance tests ensure the application handles large datasets and concurrent operations efficiently.

**Location**: `src/__tests__/performance/`

**Example**:
```typescript
describe('Performance Tests - Large Datasets', () => {
  it('should handle rendering 1000 prompts efficiently', async () => {
    const renderTime = await measurePerformance(async () => {
      render(<PromptsPage />);
      await waitFor(() => {
        expect(screen.getByText('Test Prompt 0')).toBeInTheDocument();
      });
    });

    expect(renderTime).toBeLessThan(2000); // 2 seconds
  });
});
```

**Coverage**:
- Large dataset rendering
- Search and filtering performance
- Bulk operations
- Memory usage
- Concurrent interactions

### Accessibility Tests

Accessibility tests ensure WCAG compliance and screen reader support.

**Location**: `src/__tests__/accessibility/`

**Example**:
```typescript
describe('Accessibility Tests', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<App />);
    const results = await axe(container, axeConfig);
    expect(results).toHaveNoViolations();
  });

  it('should support keyboard navigation', async () => {
    render(<DashboardPage />);
    
    await user.tab();
    expect(screen.getByLabelText(/search/i)).toHaveFocus();
  });
});
```

**Coverage**:
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- Color contrast
- Focus management
- ARIA attributes

## Testing Utilities

### Test Utils (`src/test/test-utils.tsx`)

Provides common testing utilities and setup:

```typescript
// Custom render with providers
export const render = (ui: ReactElement, options?: CustomRenderOptions) => {
  return customRender(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders>{children}</AllTheProviders>
    ),
    ...options,
  });
};

// Performance measurement
export const measurePerformance = async (fn: () => Promise<void> | void) => {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
};
```

### Mock Service Worker (MSW)

API mocking for consistent test data:

```typescript
// Mock handlers
export const handlers = [
  rest.get('/api/prompts', (req, res, ctx) => {
    return res(ctx.json({ prompts: [mockPrompt], total: 1 }));
  }),
  
  rest.post('/api/auth/login', (req, res, ctx) => {
    return res(ctx.json({ user: mockUser, token: 'mock-token' }));
  }),
];
```

### Cypress Commands

Custom commands for common E2E operations:

```typescript
// Login command
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').type(email);
    cy.get('[data-testid="password-input"]').type(password);
    cy.get('[data-testid="login-button"]').click();
  });
});

// Accessibility testing
Cypress.Commands.add('checkAccessibility', (options?: any) => {
  cy.injectAxe();
  cy.checkA11y(undefined, options);
});
```

## Test Data Management

### Mock Data

Consistent mock data across tests:

```typescript
export const mockUser = {
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user' as const,
  // ... other properties
};

export const mockPrompt = {
  id: '1',
  metadata: {
    title: 'Test Prompt',
    summary: 'A test prompt for testing',
    // ... other properties
  },
  // ... other properties
};
```

### Test Database

For integration tests requiring persistent data:

```typescript
beforeEach(async () => {
  // Set up test database
  await setupTestDatabase();
  
  // Create test user
  testUser = await UserService.createUser({
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    role: 'user',
  });
});
```

## Best Practices

### Test Organization

1. **Group related tests** using `describe` blocks
2. **Use descriptive test names** that explain the expected behavior
3. **Follow AAA pattern**: Arrange, Act, Assert
4. **Keep tests independent** - each test should be able to run in isolation

### Test Data

1. **Use factories** for generating test data
2. **Keep mock data minimal** but realistic
3. **Reset state** between tests
4. **Use meaningful test IDs** for element selection

### Assertions

1. **Test user-visible behavior** rather than implementation details
2. **Use semantic queries** (getByRole, getByLabelText) over test IDs when possible
3. **Assert on multiple aspects** when appropriate
4. **Provide clear error messages** in custom matchers

### Performance

1. **Set reasonable thresholds** for performance tests
2. **Test with realistic data sizes**
3. **Monitor memory usage** in long-running tests
4. **Use appropriate timeouts** for async operations

### Accessibility

1. **Test with actual assistive technologies** when possible
2. **Include keyboard navigation** in all interactive tests
3. **Verify ARIA attributes** are correct
4. **Test color contrast** programmatically

## Continuous Integration

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Run E2E tests
        run: npm run test:e2e:ci
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Test Reports

- **Coverage reports** generated in `coverage/` directory
- **E2E test videos** saved in `cypress/videos/`
- **Screenshots** for failed tests in `cypress/screenshots/`
- **Performance metrics** logged to console

## Troubleshooting

### Common Issues

1. **Flaky tests**: Use proper waits and avoid hardcoded delays
2. **Memory leaks**: Clean up event listeners and subscriptions
3. **Timeout errors**: Increase timeouts for slow operations
4. **Mock conflicts**: Reset mocks between tests

### Debugging

1. **Use `screen.debug()`** to see current DOM state
2. **Add `cy.pause()`** in Cypress tests for debugging
3. **Check browser console** for JavaScript errors
4. **Use `--verbose`** flag for detailed test output

### Performance Issues

1. **Profile test execution** with `--reporter=verbose`
2. **Reduce test data size** for faster execution
3. **Parallelize tests** where possible
4. **Use `cy.session()`** for authentication caching

## Maintenance

### Regular Tasks

1. **Update test dependencies** monthly
2. **Review and update mock data** as API changes
3. **Add tests for new features** as part of development
4. **Monitor test execution time** and optimize slow tests

### Metrics to Track

1. **Test coverage percentage**
2. **Test execution time**
3. **Flaky test rate**
4. **Accessibility violation count**

This comprehensive testing strategy ensures high code quality, user experience, and accessibility compliance across the entire application.