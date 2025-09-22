import React from 'react';
import {
  IconButton,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Typography,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  AccountCircle,
  Brightness4,
  Brightness7,
  Logout,
  Settings,
  Accessibility,
  Contrast,
} from '@mui/icons-material';

import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import { setThemeMode, setHighContrast } from '../../store/slices/uiSlice';
import { logout } from '../../store/slices/authSlice';

export const Header: React.FC = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { themeMode, highContrast } = useAppSelector((state) => state.ui);
  
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    dispatch(logout());
    handleClose();
  };

  const handleThemeToggle = () => {
    const newMode = themeMode === 'light' ? 'dark' : 'light';
    dispatch(setThemeMode(newMode));
  };

  const handleContrastToggle = () => {
    dispatch(setHighContrast(!highContrast));
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip title={`Switch to ${themeMode === 'light' ? 'dark' : 'light'} theme`}>
        <IconButton 
          color="inherit" 
          onClick={handleThemeToggle}
          aria-label={`Switch to ${themeMode === 'light' ? 'dark' : 'light'} theme`}
        >
          {themeMode === 'dark' ? <Brightness7 /> : <Brightness4 />}
        </IconButton>
      </Tooltip>

      <Tooltip title={`${highContrast ? 'Disable' : 'Enable'} high contrast mode`}>
        <IconButton 
          color="inherit" 
          onClick={handleContrastToggle}
          aria-label={`${highContrast ? 'Disable' : 'Enable'} high contrast mode`}
          sx={{ 
            backgroundColor: highContrast ? 'rgba(255, 255, 255, 0.1)' : 'transparent' 
          }}
        >
          <Contrast />
        </IconButton>
      </Tooltip>

      <IconButton
        size="large"
        aria-label={`Account menu for ${user?.username || 'user'}`}
        aria-controls={open ? 'account-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
        onClick={handleMenu}
        color="inherit"
      >
        <Avatar sx={{ width: 32, height: 32 }}>
          {user?.username?.charAt(0).toUpperCase() || <AccountCircle />}
        </Avatar>
      </IconButton>
      
      <Menu
        id="account-menu"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'account-button',
          role: 'menu',
        }}
      >
        <MenuItem disabled role="none">
          <Box>
            <Typography variant="body2" fontWeight="medium">
              {user?.username}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.role}
            </Typography>
          </Box>
        </MenuItem>
        
        <Divider />
        
        <MenuItem 
          onClick={handleClose}
          role="menuitem"
          aria-label="Open settings"
        >
          <Settings sx={{ mr: 2 }} />
          Settings
        </MenuItem>
        
        <MenuItem 
          onClick={handleClose}
          role="menuitem"
          aria-label="Open accessibility settings"
        >
          <Accessibility sx={{ mr: 2 }} />
          Accessibility
        </MenuItem>
        
        <Divider />
        
        <MenuItem 
          onClick={handleLogout}
          role="menuitem"
          aria-label="Logout from account"
        >
          <Logout sx={{ mr: 2 }} />
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
};