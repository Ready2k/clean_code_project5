import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './App';
import { store } from './store';
import { injectStoreDependencies } from './services/api/client';
import { clearCredentials, refreshToken } from './store/slices/authSlice';
import { addNotification } from './store/slices/uiSlice';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v5)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

console.log('Starting Prompt Library Professional Interface...');

// Inject store dependencies to avoid circular imports
injectStoreDependencies(store, {
  clearCredentials,
  refreshToken,
  addNotification,
});

// Inject websocket dependencies
import { injectWebSocketDependencies } from './services/websocket-service';
import { setConnectionStatus } from './store/slices/connectionsSlice';
import { updateJobProgress } from './store/slices/enhancementSlice';
import { removeNotification } from './store/slices/uiSlice';
import { updateSystemStatus } from './store/slices/systemSlice';

injectWebSocketDependencies(store, {
  setConnectionStatus,
  updateJobProgress,
  addNotification,
  removeNotification,
  updateSystemStatus,
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>
);