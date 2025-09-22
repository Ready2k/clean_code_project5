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
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Skip Navigation Links */}
      <SkipNavigation />

      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          ...(sidebar && !isMobile && sidebarOpen && {
            width: `calc(100% - ${DRAWER_WIDTH}px)`,
            ml: `${DRAWER_WIDTH}px`,
          }),
        }}
      >
        <Toolbar>
          {sidebar && (
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
        <>
          {/* Mobile Drawer */}
          <Drawer
            variant="temporary"
            open={sidebarOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile
            }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: MOBILE_DRAWER_WIDTH,
              },
            }}
          >
            {drawerContent}
          </Drawer>

          {/* Desktop Drawer */}
          <Drawer
            variant="persistent"
            open={sidebarOpen}
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: DRAWER_WIDTH,
              },
            }}
          >
            {drawerContent}
          </Drawer>
        </>
      )}

      {/* Main Content */}
      <Box
        component="main"
        id="main-content"
        tabIndex={-1}
        sx={{
          flexGrow: 1,
          width: '100%',
          minHeight: '100vh',
          ...(sidebar && !isMobile && sidebarOpen && {
            width: `calc(100% - ${DRAWER_WIDTH}px)`,
          }),
        }}
      >
        {/* Toolbar spacer */}
        <Toolbar />

        {/* Content Container */}
        <Container
          maxWidth={false}
          sx={{
            py: { xs: 2, sm: 3 },
            px: { xs: 1, sm: 2, md: 3 },
            maxWidth: {
              xs: '100%',
              sm: '100%',
              md: isTablet ? '100%' : '1200px',
              lg: '1400px',
              xl: '1600px',
            },
          }}
        >
          {children}
        </Container>

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