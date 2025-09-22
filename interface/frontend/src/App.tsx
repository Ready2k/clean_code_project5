import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, ThemeProvider, CssBaseline } from '@mui/material';
import { useTheme } from './theme';

import { useAppSelector } from './hooks/redux';
import { useWebSocket } from './hooks/useWebSocket';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { NotificationCenter } from './components/common/NotificationCenter';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ErrorProvider } from './providers/ErrorProvider';
import { OfflineProvider } from './contexts/OfflineContext';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { PromptsPage } from './pages/prompts/PromptsPage';
import { ConnectionsPage } from './pages/connections/ConnectionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AccessibilitySettings } from './components/common/AccessibilitySettings';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/admin/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';

const App: React.FC = () => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const theme = useTheme();
  
  // Initialize WebSocket connection
  useWebSocket();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <OfflineProvider>
        <ErrorProvider>
          <ErrorBoundary>
          <Box sx={{ display: 'flex', minHeight: '100vh' }}>
            <Routes>
              {/* Public routes */}
              <Route 
                path="/login" 
                element={
                  isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
                } 
              />
              <Route 
                path="/register" 
                element={
                  isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />
                } 
              />
              <Route 
                path="/forgot-password" 
                element={
                  isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />
                } 
              />
              <Route 
                path="/reset-password" 
                element={
                  isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />
                } 
              />
              
              {/* Root redirect */}
              <Route 
                path="/" 
                element={
                  isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
                } 
              />
              
              {/* Protected routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <DashboardPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/prompts/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <PromptsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/connections"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ConnectionsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SettingsPage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProfilePage />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/admin/*" 
                element={
                  <ProtectedRoute requiredRole="admin">
                    <Layout>
                      <AdminPage />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              
              {/* 404 fallback */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            
            {/* Global notification center */}
            <NotificationCenter />
          </Box>
          </ErrorBoundary>
        </ErrorProvider>
      </OfflineProvider>
    </ThemeProvider>
  );
};

export default App;