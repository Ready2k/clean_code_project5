import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { DashboardPage } from '../DashboardPage';
import authReducer from '../../store/slices/authSlice';
import uiReducer from '../../store/slices/uiSlice';
import promptsReducer from '../../store/slices/promptsSlice';
import connectionsReducer from '../../store/slices/connectionsSlice';
import systemReducer from '../../store/slices/systemSlice';
import adminReducer from '../../store/slices/adminSlice';

// Mock the API calls
vi.mock('../../store/slices/systemSlice', async () => {
  const actual = await vi.importActual('../../store/slices/systemSlice');
  return {
    ...actual,
    fetchSystemStatus: vi.fn(() => ({ type: 'system/fetchSystemStatus/pending' })),
    fetchSystemStats: vi.fn(() => ({ type: 'system/fetchSystemStats/pending' })),
  };
});

vi.mock('../../store/slices/promptsSlice', async () => {
  const actual = await vi.importActual('../../store/slices/promptsSlice');
  return {
    ...actual,
    fetchPrompts: vi.fn(() => ({ type: 'prompts/fetchPrompts/pending' })),
  };
});

vi.mock('../../store/slices/connectionsSlice', async () => {
  const actual = await vi.importActual('../../store/slices/connectionsSlice');
  return {
    ...actual,
    fetchConnections: vi.fn(() => ({ type: 'connections/fetchConnections/pending' })),
    testConnection: vi.fn(() => ({ type: 'connections/testConnection/pending' })),
  };
});

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      ui: uiReducer,
      prompts: promptsReducer,
      connections: connectionsReducer,
      system: systemReducer,
      admin: adminReducer,
    },
    preloadedState: {
      auth: {
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      },
      system: {
        status: {
          status: 'healthy' as const,
          services: {
            api: { status: 'up' as const, responseTime: 50 },
            database: { status: 'up' as const, responseTime: 25 },
            storage: { status: 'up' as const, responseTime: 10 },
            llm: { status: 'up' as const, responseTime: 200 },
          },
          uptime: 86400,
          version: '1.0.0',
        },
        stats: {
          prompts: {
            total: 25,
            active: 20,
            draft: 3,
            archived: 2,
            lastWeek: 20,
          },
          users: {
            total: 10,
            active: 8,
            lastWeek: 7,
          },
          connections: {
            total: 3,
            active: 2,
            providers: { openai: 2, bedrock: 1 },
          },
          storage: {
            used: 150,
            available: 1000,
            percentage: 15,
          },
          performance: {
            averageResponseTime: 120,
            requestsPerMinute: 45,
            errorRate: 1.2,
          },
        },
        isLoading: false,
        error: null,
        lastUpdated: new Date().toISOString(),
      },
      prompts: {
        items: [
          {
            id: '1',
            metadata: {
              title: 'Test Prompt',
              summary: 'A test prompt',
              tags: ['test'],
              owner: 'testuser',
            },
            humanPrompt: {
              goal: 'Test goal',
              audience: 'Test audience',
              steps: ['Step 1'],
              outputExpectations: 'Test output',
            },
            variables: [],
            status: 'active' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
            ratings: [],
            averageRating: 4.5,
          },
        ],
        currentPrompt: null,
        filters: {
          page: 1,
          limit: 20,
          sortBy: 'updated_at' as const,
          sortOrder: 'desc' as const,
        },
        isLoading: false,
        error: null,
        pagination: {
          page: 1,
          limit: 20,
          total: 25,
          totalPages: 2,
        },
      },
      connections: {
        items: [
          {
            id: '1',
            name: 'OpenAI GPT-4',
            provider: 'openai' as const,
            status: 'active' as const,
            config: {
              apiKey: 'encrypted-key',
              models: ['gpt-4', 'gpt-3.5-turbo'],
              defaultModel: 'gpt-4',
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastTested: new Date().toISOString(),
          },
          {
            id: '2',
            name: 'AWS Bedrock',
            provider: 'bedrock' as const,
            status: 'error' as const,
            config: {
              accessKeyId: 'encrypted-key',
              secretAccessKey: 'encrypted-secret',
              region: 'us-east-1',
              models: ['claude-v2'],
              defaultModel: 'claude-v2',
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastTested: new Date().toISOString(),
          },
        ],
        isLoading: false,
        error: null,
        testResults: {
          '1': {
            success: true,
            latency: 150,
            testedAt: new Date().toISOString(),
          },
          '2': {
            success: false,
            error: 'Invalid credentials',
            testedAt: new Date().toISOString(),
          },
        },
      },
      ...initialState,
    },
  });
};

const renderWithProviders = (component: React.ReactElement, initialState = {}) => {
  const store = createTestStore(initialState);
  return render(
    <Provider store={store}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('DashboardPage', () => {
  it('renders dashboard with all main sections', () => {
    renderWithProviders(<DashboardPage />);

    // Check main title
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Welcome to your Prompt Library management interface')).toBeInTheDocument();

    // Check stat cards
    expect(screen.getByText('Total Prompts')).toBeInTheDocument();
    expect(screen.getByText('Active Connections')).toBeInTheDocument();
    expect(screen.getByText('Average Rating')).toBeInTheDocument();
    expect(screen.getByText('System Status')).toBeInTheDocument();

    // Check widgets
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('Provider Connections')).toBeInTheDocument();
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('shows loading states initially', () => {
    renderWithProviders(<DashboardPage />);

    // Should show loading indicators for stat cards
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBeGreaterThan(0);
  });

  it('shows quick action buttons', () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText('Create Prompt')).toBeInTheDocument();
    expect(screen.getByText('Manage Connections')).toBeInTheDocument();
    expect(screen.getByText('Browse Library')).toBeInTheDocument();
    expect(screen.getByText('System Settings')).toBeInTheDocument();
  });
});