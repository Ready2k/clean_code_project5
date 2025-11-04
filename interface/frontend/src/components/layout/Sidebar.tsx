import React from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
} from '@mui/material';
import {
  Dashboard,
  Description,
  Link,
  Settings,
  AdminPanelSettings,
  Logout,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import { logout } from '../../store/slices/authSlice';

interface NavigationItem {
  text: string;
  icon: React.ReactElement;
  path: string;
  requiredRole?: 'admin' | 'user' | 'viewer';
  ariaLabel?: string;
}

const navigationItems: NavigationItem[] = [
  {
    text: 'Dashboard',
    icon: <Dashboard />,
    path: '/dashboard',
    ariaLabel: 'Navigate to dashboard overview',
  },
  {
    text: 'Prompts',
    icon: <Description />,
    path: '/prompts',
    ariaLabel: 'Navigate to prompt library management',
  },
  {
    text: 'Connections',
    icon: <Link />,
    path: '/connections',
    ariaLabel: 'Navigate to LLM connection management',
  },
  {
    text: 'Settings',
    icon: <Settings />,
    path: '/settings',
    ariaLabel: 'Navigate to application settings',
  },
  {
    text: 'Administration',
    icon: <AdminPanelSettings />,
    path: '/admin',
    requiredRole: 'admin',
    ariaLabel: 'Navigate to system administration',
  },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  
  const { user } = useAppSelector((state) => state.auth);

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const isItemVisible = (item: NavigationItem) => {
    if (!item.requiredRole) return true;
    // Temporarily show all items for debugging
    return true;
    
    // Original logic (commented out for debugging):
    // if (!user) return false;
    // const roleHierarchy = { viewer: 0, user: 1, admin: 2 };
    // const userRoleLevel = roleHierarchy[user.role];
    // const requiredRoleLevel = roleHierarchy[item.requiredRole];
    // return userRoleLevel >= requiredRoleLevel;
  };

  return (
    <Box 
      sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      role="navigation"
      aria-label="Main navigation"
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
          Prompt Library
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Professional Interface
        </Typography>
      </Box>
      
      <List 
        sx={{ flexGrow: 1, pt: 1 }}
        component="nav"
        aria-label="Main navigation menu"
      >
        {navigationItems
          .filter(isItemVisible)
          .map((item, index) => {
            const isActive = location.pathname.startsWith(item.path);
            
            return (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  selected={isActive}
                  onClick={() => handleNavigate(item.path)}
                  aria-label={item.ariaLabel || `Navigate to ${item.text}`}
                  aria-current={isActive ? 'page' : undefined}
                  sx={{
                    mx: 1,
                    borderRadius: 1,
                    minHeight: 48, // Minimum touch target size
                    '&.Mui-selected': {
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                      },
                      '& .MuiListItemIcon-root': {
                        color: 'primary.contrastText',
                      },
                    },
                    '&:focus-visible': {
                      outline: '2px solid currentColor',
                      outlineOffset: '2px',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: isActive ? 'inherit' : 'text.secondary',
                      minWidth: 40,
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText 
                    primary={item.text}
                    primaryTypographyProps={{
                      fontWeight: isActive ? 'medium' : 'normal',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
      </List>
      
      <Divider />
      
      {/* Logout Button */}
      <ListItem disablePadding>
        <ListItemButton
          onClick={handleLogout}
          aria-label="Logout from application"
          sx={{
            mx: 1,
            borderRadius: 1,
            minHeight: 48,
            color: 'error.main',
            '&:hover': {
              backgroundColor: 'error.light',
              color: 'error.contrastText',
              '& .MuiListItemIcon-root': {
                color: 'error.contrastText',
              },
            },
            '&:focus-visible': {
              outline: '2px solid currentColor',
              outlineOffset: '2px',
            },
          }}
        >
          <ListItemIcon
            sx={{
              color: 'error.main',
              minWidth: 40,
            }}
          >
            <Logout />
          </ListItemIcon>
          <ListItemText 
            primary="Logout"
            primaryTypographyProps={{
              fontWeight: 'medium',
            }}
          />
        </ListItemButton>
      </ListItem>
      
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Version 1.0.0
        </Typography>
      </Box>
    </Box>
  );
};