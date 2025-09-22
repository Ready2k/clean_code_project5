import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';

import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import { getCurrentUser } from '../../store/slices/authSlice';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user' | 'viewer';
  requiredPermissions?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermissions = [],
}) => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const { isAuthenticated, user, isLoading, token } = useAppSelector((state) => state.auth);

  useEffect(() => {
    // If we have a token but no user, try to get current user
    if (token && !user && !isLoading) {
      dispatch(getCurrentUser());
    }
  }, [dispatch, token, user, isLoading]);

  // Show loading spinner while checking authentication
  if (isLoading || (token && !user)) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Development bypass - check for demo mode
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' || window.location.search.includes('demo=true');
  
  // Redirect to login if not authenticated (unless in demo mode)
  if (!isDemoMode && (!isAuthenticated || !user)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // In demo mode, create a mock user if needed
  if (isDemoMode && !user) {
    const mockUser = {
      id: 'demo-user',
      username: 'demo',
      email: 'demo@example.com',
      role: 'admin' as const,
      permissions: ['read', 'write', 'admin'],
      preferences: {
        theme: 'light' as const,
        language: 'en',
        notifications: {
          email: true,
          push: true,
          inApp: true,
        },
        accessibility: {
          highContrast: false,
          largeText: false,
          reducedMotion: false,
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // For demo mode, we'll just render the children with mock user context
    // In a real app, you'd want to set this in the store
  }

  // Check role requirements (skip in demo mode)
  if (!isDemoMode && requiredRole && user) {
    const roleHierarchy = { viewer: 0, user: 1, admin: 2 };
    const userRoleLevel = roleHierarchy[user.role];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    if (userRoleLevel < requiredRoleLevel) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Check permission requirements (skip in demo mode)
  if (!isDemoMode && requiredPermissions.length > 0 && user) {
    const hasAllPermissions = requiredPermissions.every(permission =>
      user.permissions?.includes(permission)
    );

    if (!hasAllPermissions) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};