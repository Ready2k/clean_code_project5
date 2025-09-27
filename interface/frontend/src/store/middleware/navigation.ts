import { Middleware } from '@reduxjs/toolkit';

// Navigation middleware for Redux
// Note: With React Router v6, navigation should be handled via useNavigate hook
// This middleware is kept for compatibility but should be refactored to use
// the navigate function from useNavigate hook in components
export const navigationMiddleware: Middleware = () => (next) => (action) => {
  if (action.type === 'ui/setNavigation') {
    // In React Router v6, navigation should be handled in components
    // using the useNavigate hook rather than programmatic history
    console.warn('Navigation middleware called. Consider using useNavigate hook in components instead.');
  }

  return next(action);
};