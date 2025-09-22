import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
  Container,
  Fab,
  Zoom,
} from '@mui/material';
import {
  Menu as MenuIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { setSidebarOpen } from '../../store/slices/uiSlice';
import SkipNavigation from '../common/SkipNavigation';

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  title?: string;
}

const DRAWER_WIDTH = 280;
const MOBILE_DRAWER_WIDTH = 280;

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  sidebar,
  header,
  title = 'Prompt Library',
}) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Handle scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      dispatch(setSidebarOpen(false));
    }
  }, [isMobile, dispatch]);

  const handleDrawerToggle = () => {
    dispatch(setSidebarOpen(!sidebarOpen));
  };

  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const drawerContent = sidebar && (
    <Box
      sx={{
        width: isMobile ? MOBILE_DRAWER_WIDTH : DRAWER_WIDTH,
        height: '100%',
        overflow: 'auto',
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      {sidebar}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {/* Skip Navigation Links */}
      <SkipNavigation />

      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          width: '100%',
          left: 0,
        }}
      >
        <Toolbar sx={{ minHeight: '64px !important' }}>
          {sidebar && (isMobile || !sidebarOpen) && (
            <IconButton
              color="inherit"
              aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography
            variant="h6"
            noWrap
            component="h1"
            sx={{ flexGrow: 1 }}
          >
            {title}
          </Typography>
          {header}
        </Toolbar>
      </AppBar>

      {/* Sidebar Navigation */}
      {sidebar && (
        <Drawer
          variant={isMobile ? 'temporary' : 'persistent'}
          open={sidebarOpen}
          onClose={isMobile ? handleDrawerToggle : undefined}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              position: 'fixed',
              top: '64px',
              height: 'calc(100vh - 64px)',
              zIndex: theme.zIndex.drawer,
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main Content */}
      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        {/* Toolbar spacer */}
        <Toolbar />

        {/* Content Container */}
        <Box
          sx={{
            py: { xs: 1, sm: 1 },
            px: { xs: 2, sm: 2, md: 2 },
            maxWidth: '100%',
          }}
        >
          {children}
        </Box>

        {/* Scroll to Top Button */}
        <Zoom in={showScrollTop}>
          <Fab
            color="primary"
            size="medium"
            aria-label="Scroll to top"
            onClick={handleScrollToTop}
            sx={{
              position: 'fixed',
              bottom: { xs: 16, sm: 24 },
              right: { xs: 16, sm: 24 },
              zIndex: theme.zIndex.fab,
            }}
          >
            <KeyboardArrowUpIcon />
          </Fab>
        </Zoom>
      </Box>
    </Box>
  );
};

export default ResponsiveLayout;