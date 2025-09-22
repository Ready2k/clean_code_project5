import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import { theme } from '@/theme';
import authSlice from '@/store/slices/authSlice';
import promptsSlice from '@/store/slices/promptsSlice';
import connectionsSlice from '@/store/slices/connectionsSlice';
import uiSlice from '@/store/slices/uiSlice';
import systemSlice from '@/store/slices/systemSlice';
import renderingSlice from '@/store/slices/renderingSlice';
import adminSlice from '@/store/slices/adminSlice';

// Create a test store
export const createTestStore = (preloadedState?: any) => {
  return configureStore({
    reducer: {
      auth: authSlice,
      prompts: promptsSlice,
      connections: connectionsSlice,
      ui: uiSlice,
      system: systemSlice,
      rendering: renderingSlice,
      admin: adminSlice,
    },
    preloadedState,
  });
};

// Create a test query client
export const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });
};

interface AllTheProvidersProps {
  children: React.ReactNode;
  store?: ReturnType<typeof createTestStore>;
  queryClient?: QueryClient;
}

const AllTheProviders = ({ 
  children, 
  store = createTestStore(),
  queryClient = createTestQueryClient()
}: AllTheProvidersProps) => {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider theme={theme}>
            {children}
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  );
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  store?: ReturnType<typeof createTestStore>;
  queryClient?: QueryClient;
}

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { store, queryClient, ...renderOptions } = options;
  
  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders store={store} queryClient={queryClient}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
};

// Mock user data
export const mockUser = {
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  role: 'user' as const,
  createdAt: '2023-01-01T00:00:00Z',
  lastLogin: '2023-01-01T00:00:00Z',
  preferences: {
    theme: 'light' as const,
    language: 'en',
    defaultProvider: 'openai',
    notifications: {
      email: true,
      push: false,
    },
  },
};

// Mock prompt data
export const mockPrompt = {
  id: '1',
  metadata: {
    title: 'Test Prompt',
    summary: 'A test prompt for testing',
    tags: ['test', 'example'],
    owner: 'testuser',
    status: 'active' as const,
    createdAt: '2023-01-01T00:00:00Z',
    updatedAt: '2023-01-01T00:00:00Z',
  },
  humanPrompt: {
    goal: 'Test goal',
    audience: 'Test audience',
    steps: ['Step 1', 'Step 2'],
    outputExpectations: 'Test output',
  },
  variables: [],
  ratings: {
    average: 4.5,
    count: 10,
  },
};

// Mock connection data
export const mockConnection = {
  id: '1',
  name: 'Test OpenAI Connection',
  provider: 'openai' as const,
  status: 'active' as const,
  config: {
    apiKey: 'test-key',
    models: ['gpt-3.5-turbo', 'gpt-4'],
    defaultModel: 'gpt-3.5-turbo',
  },
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  lastTested: '2023-01-01T00:00:00Z',
};

// Accessibility testing helper
export const axeConfig = {
  rules: {
    // Disable color-contrast rule for tests (can be flaky)
    'color-contrast': { enabled: false },
  },
};

// Performance testing helper
export const measurePerformance = async (fn: () => Promise<void> | void) => {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };