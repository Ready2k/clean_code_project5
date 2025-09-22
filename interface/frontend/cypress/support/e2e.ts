// Import commands.js using ES2015 syntax:
import './commands';
import 'cypress-axe';

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Global before hook
beforeEach(() => {
  // Clear application state
  cy.clearLocalStorage();
  cy.clearCookies();
  
  // Set up API mocking
  cy.intercept('GET', '/api/system/status', {
    statusCode: 200,
    body: {
      status: 'healthy',
      services: {
        api: { status: 'up', responseTime: 50 },
        database: { status: 'up', responseTime: 25 },
        storage: { status: 'up', responseTime: 10 },
        llm: { status: 'up', responseTime: 200 },
      },
      uptime: 86400,
      version: '1.0.0',
    },
  }).as('getSystemStatus');

  cy.intercept('POST', '/api/auth/login', (req) => {
    const { email, password } = req.body;
    
    if (email === 'test@example.com' && password === 'password123') {
      req.reply({
        statusCode: 200,
        body: {
          user: {
            id: '1',
            username: 'testuser',
            email: 'test@example.com',
            role: 'user',
          },
          token: 'mock-jwt-token',
        },
      });
    } else {
      req.reply({
        statusCode: 401,
        body: { error: 'Invalid credentials' },
      });
    }
  }).as('login');

  cy.intercept('GET', '/api/auth/me', (req) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.includes('mock-jwt-token')) {
      req.reply({
        statusCode: 200,
        body: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          role: 'user',
        },
      });
    } else {
      req.reply({
        statusCode: 401,
        body: { error: 'Unauthorized' },
      });
    }
  }).as('getMe');

  cy.intercept('GET', '/api/prompts*', {
    statusCode: 200,
    body: {
      prompts: [
        {
          id: '1',
          metadata: {
            title: 'Test Prompt',
            summary: 'A test prompt for E2E testing',
            tags: ['test', 'e2e'],
            owner: 'testuser',
            status: 'active',
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-01-01T00:00:00Z',
          },
          humanPrompt: {
            goal: 'Test the application',
            audience: 'QA Engineers',
            steps: ['Step 1', 'Step 2'],
            output_expectations: {
              format: 'Successful test',
              fields: [],
            },
          },
          variables: [],
          ratings: { average: 4.5, count: 10 },
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    },
  }).as('getPrompts');
});

// Global error handling
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing on uncaught exceptions
  // that we expect in our error handling tests
  if (err.message.includes('Network Error') || 
      err.message.includes('ChunkLoadError')) {
    return false;
  }
  
  // Let other errors fail the test
  return true;
});