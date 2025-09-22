import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { configureStore } from '@reduxjs/toolkit';

import App from './App';
import { theme } from './theme';
import authReducer from './store/slices/authSlice';
import uiReducer from './store/slices/uiSlice';
import promptsReducer from './store/slices/promptsSlice';
import connectionsReducer from './store/slices/connectionsSlice';
import systemReducer from './store/slices/systemSlice';

// Mock the API client
vi.mock('./services/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      ui: uiReducer,
      prompts: promptsReducer,
      connections: connectionsReducer,
      system: systemReducer,
    },
    preloadedState: initialState,
  });
};

const renderWithProviders = (
  ui: React.ReactElement,
  {
    initialState = {},
    store = createTestStore(initialState),
    ...renderOptions
  } = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          {children}
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  );

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
};

describe('App', () => {
  it('renders login page when not authenticated', () => {
    const initialState = {
      auth: {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      },
    };

    renderWithProviders(<App />, { initialState });
    
    expect(screen.getByText('Prompt Library')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
  });

  it('renders dashboard when authenticated', () => {
    const initialState = {
      auth: {
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          role: 'user' as const,
          createdAt: '2023-01-01',
          lastLogin: '2023-01-01',
          preferences: {
            theme: 'light' as const,
            language: 'en',
            defaultProvider: 'openai',
            notifications: {
              email: true,
              push: true,
              enhancement: true,
              system: true,
            },
          },
        },
        token: 'test-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
      },
    };

    renderWithProviders(<App />, { initialState });
    
    // Should redirect to dashboard and show the layout
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});