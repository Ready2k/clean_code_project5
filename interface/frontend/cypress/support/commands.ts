/// <reference types="cypress" />

// Custom command for login
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').type(email);
    cy.get('[data-testid="password-input"]').type(password);
    cy.get('[data-testid="login-button"]').click();
    
    // Wait for successful login
    cy.url().should('not.include', '/login');
    cy.window().its('localStorage.auth_token').should('exist');
  });
});

// Custom command for logout
Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click();
  cy.get('[data-testid="logout-button"]').click();
  cy.url().should('include', '/login');
});

// Custom command for creating a prompt
Cypress.Commands.add('createPrompt', (promptData: {
  title: string;
  summary: string;
  goal: string;
  audience: string;
  tags?: string[];
}) => {
  cy.get('[data-testid="create-prompt-button"]').click();
  
  cy.get('[data-testid="prompt-title-input"]').type(promptData.title);
  cy.get('[data-testid="prompt-summary-input"]').type(promptData.summary);
  cy.get('[data-testid="prompt-goal-input"]').type(promptData.goal);
  cy.get('[data-testid="prompt-audience-input"]').type(promptData.audience);
  
  if (promptData.tags) {
    promptData.tags.forEach(tag => {
      cy.get('[data-testid="prompt-tags-input"]').type(`${tag}{enter}`);
    });
  }
  
  cy.get('[data-testid="create-prompt-submit"]').click();
  
  // Wait for success message
  cy.get('[data-testid="success-message"]').should('be.visible');
});

// Custom command for waiting for loading to complete
Cypress.Commands.add('waitForLoading', () => {
  cy.get('[data-testid="loading-spinner"]').should('not.exist');
  cy.get('[data-testid="loading-skeleton"]').should('not.exist');
});

// Custom command for checking accessibility
Cypress.Commands.add('checkAccessibility', (options?: any) => {
  cy.injectAxe();
  cy.checkA11y(undefined, options);
});

// Custom command for testing responsive design
Cypress.Commands.add('testResponsive', (callback: () => void) => {
  const viewports = [
    { width: 320, height: 568 }, // iPhone SE
    { width: 768, height: 1024 }, // iPad
    { width: 1280, height: 720 }, // Desktop
    { width: 1920, height: 1080 }, // Large Desktop
  ];
  
  viewports.forEach(viewport => {
    cy.viewport(viewport.width, viewport.height);
    callback();
  });
});

// Custom command for handling API errors
Cypress.Commands.add('mockApiError', (endpoint: string, statusCode: number = 500) => {
  cy.intercept('GET', endpoint, {
    statusCode,
    body: { error: 'Internal server error' },
  }).as('apiError');
});

// Custom command for performance testing
Cypress.Commands.add('measurePerformance', (name: string, callback: () => void) => {
  cy.window().then((win) => {
    win.performance.mark(`${name}-start`);
  });
  
  callback();
  
  cy.window().then((win) => {
    win.performance.mark(`${name}-end`);
    win.performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = win.performance.getEntriesByName(name)[0];
    cy.log(`Performance: ${name} took ${measure.duration}ms`);
    
    // Assert performance threshold (adjust as needed)
    expect(measure.duration).to.be.lessThan(5000);
  });
});

// Custom command for testing keyboard navigation
Cypress.Commands.add('testKeyboardNavigation', (selector: string) => {
  cy.get(selector).first().focus();
  
  // Test Tab navigation
  cy.focused().tab();
  cy.focused().should('not.have.attr', 'data-testid', selector);
  
  // Test Shift+Tab navigation
  cy.focused().tab({ shift: true });
  cy.focused().should('have.attr', 'data-testid', selector);
  
  // Test Enter activation
  cy.focused().type('{enter}');
});

// Custom command for drag and drop
Cypress.Commands.add('dragAndDrop', (sourceSelector: string, targetSelector: string) => {
  cy.get(sourceSelector).trigger('mousedown', { button: 0 });
  cy.get(targetSelector).trigger('mousemove').trigger('mouseup');
});

// Extend Cypress namespace for TypeScript
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
      logout(): Chainable<void>;
      createPrompt(promptData: {
        title: string;
        summary: string;
        goal: string;
        audience: string;
        tags?: string[];
      }): Chainable<void>;
      waitForLoading(): Chainable<void>;
      checkAccessibility(options?: any): Chainable<void>;
      testResponsive(callback: () => void): Chainable<void>;
      mockApiError(endpoint: string, statusCode?: number): Chainable<void>;
      measurePerformance(name: string, callback: () => void): Chainable<void>;
      testKeyboardNavigation(selector: string): Chainable<void>;
      dragAndDrop(sourceSelector: string, targetSelector: string): Chainable<void>;
    }
  }
}