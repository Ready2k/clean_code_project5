/**
 * Admin Page Component
 * 
 * Main admin page that handles routing to different admin sections
 * including provider management, user management, and system settings.
 */

import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  CloudSync as CloudSyncIcon,
} from '@mui/icons-material';

import { ProviderManagementPage } from './ProviderManagementPage';
import { AdminDashboard } from './AdminDashboard';

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation items for admin sections
  const adminSections = [
    { path: '/admin', label: 'Dashboard', icon: <DashboardIcon /> },
    { path: '/admin/providers', label: 'Providers', icon: <CloudSyncIcon /> },
  ];

  // Get current section based on path
  const getCurrentSection = () => {
    const path = location.pathname;
    if (path === '/admin' || path === '/admin/') return 0;
    if (path.startsWith('/admin/providers')) return 1;
    return 0;
  };

  const handleSectionChange = (_event: React.SyntheticEvent, newValue: number) => {
    const section = adminSections[newValue];
    if (section) {
      navigate(section.path);
    }
  };

  return (
    <Box>
      {/* Admin Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={getCurrentSection()} onChange={handleSectionChange}>
          {adminSections.map((section, index) => (
            <Tab
              key={section.path}
              icon={section.icon}
              label={section.label}
              id={`admin-tab-${index}`}
              aria-controls={`admin-tabpanel-${index}`}
            />
          ))}
        </Tabs>
      </Box>

      {/* Admin Routes */}
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/providers/*" element={<ProviderManagementPage />} />
      </Routes>
    </Box>
  );
};