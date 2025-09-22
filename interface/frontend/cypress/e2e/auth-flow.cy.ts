describe('Authentication Flow', () => {
  beforeEach(() => {
    // Clear any existing auth state
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  it('should allow user to login and logout', () => {
    cy.visit('/');

    // Should redirect to login page
    cy.url().should('include', '/login');
    cy.get('[data-testid="login-form"]').should('be.visible');

    // Fill in login form
    cy.get('[data-testid="email-input"]').type('test@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    
    // Submit login
    cy.get('[data-testid="login-button"]').click();

    // Should redirect to dashboard
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid="dashboard"]').should('be.visible');

    // Should show user info
    cy.get('[data-testid="user-menu"]').should('contain', 'testuser');

    // Logout
    cy.get('[data-testid="user-menu"]').click();
    cy.get('[data-testid="logout-button"]').click();

    // Should redirect to login
    cy.url().should('include', '/login');
  });

  it('should handle login errors', () => {
    cy.visit('/login');

    // Try invalid credentials
    cy.get('[data-testid="email-input"]').type('wrong@example.com');
    cy.get('[data-testid="password-input"]').type('wrongpassword');
    cy.get('[data-testid="login-button"]').click();

    // Should show error message
    cy.get('[data-testid="error-message"]')
      .should('be.visible')
      .and('contain', 'Invalid credentials');

    // Should stay on login page
    cy.url().should('include', '/login');
  });

  it('should validate form fields', () => {
    cy.visit('/login');

    // Try to submit empty form
    cy.get('[data-testid="login-button"]').click();

    // Should show validation errors
    cy.get('[data-testid="email-error"]')
      .should('be.visible')
      .and('contain', 'Email is required');
    
    cy.get('[data-testid="password-error"]')
      .should('be.visible')
      .and('contain', 'Password is required');
  });

  it('should redirect to intended page after login', () => {
    // Try to access protected route
    cy.visit('/prompts');

    // Should redirect to login with return URL
    cy.url().should('include', '/login');
    cy.url().should('include', 'returnTo=%2Fprompts');

    // Login
    cy.get('[data-testid="email-input"]').type('test@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="login-button"]').click();

    // Should redirect to original intended page
    cy.url().should('include', '/prompts');
  });

  it('should maintain session across page refreshes', () => {
    // Login first
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').type('test@example.com');
    cy.get('[data-testid="password-input"]').type('password123');
    cy.get('[data-testid="login-button"]').click();

    // Navigate to prompts page
    cy.visit('/prompts');
    cy.get('[data-testid="prompts-page"]').should('be.visible');

    // Refresh page
    cy.reload();

    // Should still be authenticated
    cy.get('[data-testid="prompts-page"]').should('be.visible');
    cy.url().should('include', '/prompts');
  });

  it('should handle session expiration', () => {
    // Mock expired session
    cy.window().then((win) => {
      win.localStorage.setItem('auth_token', 'expired-token');
    });

    cy.visit('/dashboard');

    // Should redirect to login due to expired token
    cy.url().should('include', '/login');
    cy.get('[data-testid="error-message"]')
      .should('contain', 'Session expired');
  });

  it('should support keyboard navigation', () => {
    cy.visit('/login');

    // Tab through form fields
    cy.get('body').tab();
    cy.focused().should('have.attr', 'data-testid', 'email-input');

    cy.focused().tab();
    cy.focused().should('have.attr', 'data-testid', 'password-input');

    cy.focused().tab();
    cy.focused().should('have.attr', 'data-testid', 'login-button');

    // Submit with Enter key
    cy.get('[data-testid="email-input"]').type('test@example.com');
    cy.get('[data-testid="password-input"]').type('password123{enter}');

    // Should login successfully
    cy.url().should('include', '/dashboard');
  });

  it('should be accessible', () => {
    cy.visit('/login');
    cy.injectAxe();
    cy.checkA11y();
  });
});