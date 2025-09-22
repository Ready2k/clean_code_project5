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

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role requirements
  if (requiredRole) {
    const roleHierarchy = { viewer: 0, user: 1, admin: 2 };
    const userRoleLevel = roleHierarchy[user.role];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    if (userRoleLevel < requiredRoleLevel) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Check permission requirements
  if (requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(permission =>
      user.permissions?.includes(permission)
    );

    if (!hasAllPermissions) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};