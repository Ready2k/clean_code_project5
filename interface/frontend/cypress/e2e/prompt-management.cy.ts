describe('Prompt Management', () => {
  beforeEach(() => {
    // Login before each test
    cy.login('test@example.com', 'password123');
    cy.visit('/prompts');
  });

  it('should display prompts list', () => {
    cy.get('[data-testid="prompts-page"]').should('be.visible');
    cy.get('[data-testid="prompt-card"]').should('have.length.at.least', 1);
    
    // Check prompt card content
    cy.get('[data-testid="prompt-card"]').first().within(() => {
      cy.get('[data-testid="prompt-title"]').should('be.visible');
      cy.get('[data-testid="prompt-summary"]').should('be.visible');
      cy.get('[data-testid="prompt-tags"]').should('be.visible');
      cy.get('[data-testid="prompt-rating"]').should('be.visible');
    });
  });

  it('should create a new prompt', () => {
    // Click create button
    cy.get('[data-testid="create-prompt-button"]').click();

    // Fill in creation form
    cy.get('[data-testid="prompt-title-input"]').type('E2E Test Prompt');
    cy.get('[data-testid="prompt-summary-input"]').type('A prompt created during E2E testing');
    cy.get('[data-testid="prompt-tags-input"]').type('e2e,test{enter}');
    
    // Fill in human prompt details
    cy.get('[data-testid="prompt-goal-input"]').type('Test the prompt creation flow');
    cy.get('[data-testid="prompt-audience-input"]').type('QA Engineers');
    cy.get('[data-testid="prompt-steps-input"]').type('1. Open application\n2. Create prompt\n3. Verify creation');
    cy.get('[data-testid="prompt-output-input"]').type('Successful prompt creation');

    // Submit form
    cy.get('[data-testid="create-prompt-submit"]').click();

    // Should show success message
    cy.get('[data-testid="success-message"]')
      .should('be.visible')
      .and('contain', 'Prompt created successfully');

    // Should redirect to prompts list
    cy.url().should('include', '/prompts');

    // New prompt should appear in list
    cy.get('[data-testid="prompt-card"]')
      .contains('E2E Test Prompt')
      .should('be.visible');
  });

  it('should edit an existing prompt', () => {
    // Click edit button on first prompt
    cy.get('[data-testid="prompt-card"]').first().within(() => {
      cy.get('[data-testid="edit-prompt-button"]').click();
    });

    // Update title
    cy.get('[data-testid="prompt-title-input"]')
      .clear()
      .type('Updated E2E Test Prompt');

    // Update summary
    cy.get('[data-testid="prompt-summary-input"]')
      .clear()
      .type('An updated prompt description');

    // Save changes
    cy.get('[data-testid="save-prompt-button"]').click();

    // Should show success message
    cy.get('[data-testid="success-message"]')
      .should('be.visible')
      .and('contain', 'Prompt updated successfully');

    // Updated prompt should appear in list
    cy.get('[data-testid="prompt-card"]')
      .contains('Updated E2E Test Prompt')
      .should('be.visible');
  });

  it('should delete a prompt', () => {
    // Click delete button on first prompt
    cy.get('[data-testid="prompt-card"]').first().within(() => {
      cy.get('[data-testid="delete-prompt-button"]').click();
    });

    // Confirm deletion
    cy.get('[data-testid="confirm-delete-dialog"]').should('be.visible');
    cy.get('[data-testid="confirm-delete-button"]').click();

    // Should show success message
    cy.get('[data-testid="success-message"]')
      .should('be.visible')
      .and('contain', 'Prompt deleted successfully');

    // Prompt should be removed from list
    cy.get('[data-testid="prompt-card"]').should('have.length.lessThan', 10);
  });

  it('should search and filter prompts', () => {
    // Test search functionality
    cy.get('[data-testid="search-input"]').type('test');
    cy.get('[data-testid="search-button"]').click();

    // Should filter results
    cy.get('[data-testid="prompt-card"]').each(($card) => {
      cy.wrap($card).should('contain.text', 'test');
    });

    // Clear search
    cy.get('[data-testid="clear-search-button"]').click();
    cy.get('[data-testid="search-input"]').should('have.value', '');

    // Test tag filter
    cy.get('[data-testid="tag-filter"]').click();
    cy.get('[data-testid="tag-option-test"]').click();

    // Should filter by tag
    cy.get('[data-testid="prompt-card"]').each(($card) => {
      cy.wrap($card).find('[data-testid="prompt-tags"]').should('contain', 'test');
    });
  });

  it('should enhance a prompt with AI', () => {
    // Click enhance button on first prompt
    cy.get('[data-testid="prompt-card"]').first().within(() => {
      cy.get('[data-testid="enhance-prompt-button"]').click();
    });

    // Enhancement dialog should open
    cy.get('[data-testid="enhancement-dialog"]').should('be.visible');

    // Select provider
    cy.get('[data-testid="provider-select"]').click();
    cy.get('[data-testid="provider-option-openai"]').click();

    // Select model
    cy.get('[data-testid="model-select"]').click();
    cy.get('[data-testid="model-option-gpt-3.5-turbo"]').click();

    // Start enhancement
    cy.get('[data-testid="start-enhancement-button"]').click();

    // Should show progress
    cy.get('[data-testid="enhancement-progress"]').should('be.visible');

    // Wait for completion (with timeout)
    cy.get('[data-testid="enhancement-results"]', { timeout: 30000 })
      .should('be.visible');

    // Should show enhanced prompt
    cy.get('[data-testid="enhanced-prompt"]').should('be.visible');
    cy.get('[data-testid="enhancement-rationale"]').should('be.visible');

    // Accept enhancement
    cy.get('[data-testid="accept-enhancement-button"]').click();

    // Should show success message
    cy.get('[data-testid="success-message"]')
      .should('be.visible')
      .and('contain', 'Prompt enhanced successfully');
  });

  it('should render a prompt for different providers', () => {
    // Click render button on first prompt
    cy.get('[data-testid="prompt-card"]').first().within(() => {
      cy.get('[data-testid="render-prompt-button"]').click();
    });

    // Render dialog should open
    cy.get('[data-testid="render-dialog"]').should('be.visible');

    // Select provider
    cy.get('[data-testid="provider-select"]').click();
    cy.get('[data-testid="provider-option-openai"]').click();

    // Configure render options
    cy.get('[data-testid="temperature-slider"]').invoke('val', 0.7).trigger('input');

    // Render prompt
    cy.get('[data-testid="render-button"]').click();

    // Should show rendered output
    cy.get('[data-testid="rendered-output"]').should('be.visible');
    cy.get('[data-testid="copy-output-button"]').should('be.visible');

    // Test copy functionality
    cy.get('[data-testid="copy-output-button"]').click();
    cy.get('[data-testid="copy-success-message"]')
      .should('be.visible')
      .and('contain', 'Copied to clipboard');
  });

  it('should rate a prompt', () => {
    // Click on rating widget
    cy.get('[data-testid="prompt-card"]').first().within(() => {
      cy.get('[data-testid="rating-widget"]').should('be.visible');
      cy.get('[data-testid="star-5"]').click();
    });

    // Rating dialog should open
    cy.get('[data-testid="rating-dialog"]').should('be.visible');

    // Add optional note
    cy.get('[data-testid="rating-note-input"]').type('Excellent prompt for testing!');

    // Submit rating
    cy.get('[data-testid="submit-rating-button"]').click();

    // Should show success message
    cy.get('[data-testid="success-message"]')
      .should('be.visible')
      .and('contain', 'Rating submitted successfully');

    // Rating should be updated in the card
    cy.get('[data-testid="prompt-card"]').first().within(() => {
      cy.get('[data-testid="rating-display"]').should('contain', '5');
    });
  });

  it('should handle pagination', () => {
    // Assuming there are multiple pages of prompts
    cy.get('[data-testid="pagination"]').should('be.visible');

    // Check current page
    cy.get('[data-testid="current-page"]').should('contain', '1');

    // Go to next page
    cy.get('[data-testid="next-page-button"]').click();

    // Should load next page
    cy.get('[data-testid="current-page"]').should('contain', '2');
    cy.url().should('include', 'page=2');

    // Go back to previous page
    cy.get('[data-testid="prev-page-button"]').click();

    // Should return to first page
    cy.get('[data-testid="current-page"]').should('contain', '1');
  });

  it('should handle errors gracefully', () => {
    // Simulate network error
    cy.intercept('GET', '/api/prompts', { forceNetworkError: true }).as('getPromptsError');

    cy.visit('/prompts');
    cy.wait('@getPromptsError');

    // Should show error message
    cy.get('[data-testid="error-message"]')
      .should('be.visible')
      .and('contain', 'Failed to load prompts');

    // Should show retry button
    cy.get('[data-testid="retry-button"]').should('be.visible');
  });

  it('should be accessible', () => {
    cy.injectAxe();
    cy.checkA11y();

    // Test keyboard navigation
    cy.get('[data-testid="create-prompt-button"]').focus();
    cy.focused().should('have.attr', 'data-testid', 'create-prompt-button');

    // Tab through prompt cards
    cy.get('[data-testid="prompt-card"]').first().focus();
    cy.focused().tab();
    cy.focused().should('have.attr', 'data-testid', 'edit-prompt-button');
  });

  it('should work on mobile devices', () => {
    // Test mobile viewport
    cy.viewport('iphone-x');

    // Should show mobile-optimized layout
    cy.get('[data-testid="mobile-menu-button"]').should('be.visible');
    cy.get('[data-testid="desktop-sidebar"]').should('not.be.visible');

    // Prompt cards should stack vertically
    cy.get('[data-testid="prompt-card"]').should('have.css', 'width').and('match', /100%|full/);

    // Mobile menu should work
    cy.get('[data-testid="mobile-menu-button"]').click();
    cy.get('[data-testid="mobile-menu"]').should('be.visible');
  });
});