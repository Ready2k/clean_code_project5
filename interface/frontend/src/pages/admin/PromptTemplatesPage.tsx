/**
 * Prompt Templates Page Component
 * 
 * Main page for managing LLM prompt templates in the admin interface.
 * Provides navigation between different template management sections.
 */

import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  List as ListIcon,
  Edit as EditIcon,
  PlayArrow as TestIcon,
  Analytics as AnalyticsIcon,
  Home as HomeIcon,
} from '@mui/icons-material';

import { TemplateListPage } from './templates/TemplateListPage';
import { TemplateEditorPage } from './templates/TemplateEditorPage';
import { TemplateTestingPage } from './templates/TemplateTestingPage';
import { TemplateAnalyticsPage } from './templates/TemplateAnalyticsPage';

export const PromptTemplatesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Navigation items for template sections
  const templateSections = [
    { path: '/admin/prompt-templates', label: 'Templates', icon: <ListIcon /> },
    { path: '/admin/prompt-templates/editor', label: 'Editor', icon: <EditIcon /> },
    { path: '/admin/prompt-templates/testing', label: 'Testing', icon: <TestIcon /> },
    { path: '/admin/prompt-templates/analytics', label: 'Analytics', icon: <AnalyticsIcon /> },
  ];

  // Get current section based on path
  const getCurrentSection = () => {
    const path = location.pathname;
    if (path === '/admin/prompt-templates' || path === '/admin/prompt-templates/') return 0;
    if (path.startsWith('/admin/prompt-templates/editor')) return 1;
    if (path.startsWith('/admin/prompt-templates/testing')) return 2;
    if (path.startsWith('/admin/prompt-templates/analytics')) return 3;
    return 0;
  };

  const handleSectionChange = (_event: React.SyntheticEvent, newValue: number) => {
    const section = templateSections[newValue];
    if (section) {
      navigate(section.path);
    }
  };

  const handleBreadcrumbClick = (path: string) => {
    navigate(path);
  };

  return (
    <Box>
      {/* Breadcrumbs */}
      <Box sx={{ mb: 2 }}>
        <Breadcrumbs aria-label="breadcrumb">
          <Link
            component="button"
            variant="body2"
            onClick={() => handleBreadcrumbClick('/admin')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              color: 'text.secondary',
              '&:hover': { color: 'primary.main' }
            }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Admin
          </Link>
          <Typography color="text.primary" variant="body2">
            Prompt Templates
          </Typography>
        </Breadcrumbs>
      </Box>

      {/* Page Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Prompt Templates Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage and customize LLM prompt templates for enhanced AI interactions
        </Typography>
      </Box>

      {/* Template Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs 
          value={getCurrentSection()} 
          onChange={handleSectionChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          {templateSections.map((section, index) => (
            <Tab
              key={section.path}
              icon={section.icon}
              label={section.label}
              id={`template-tab-${index}`}
              aria-controls={`template-tabpanel-${index}`}
              sx={{ minWidth: 120 }}
            />
          ))}
        </Tabs>
      </Box>

      {/* Template Routes */}
      <Routes>
        <Route path="/" element={<TemplateListPage />} />
        <Route path="/editor" element={<TemplateEditorPage />} />
        <Route path="/editor/:templateId" element={<TemplateEditorPage />} />
        <Route path="/testing" element={<TemplateTestingPage />} />
        <Route path="/testing/:templateId" element={<TemplateTestingPage />} />
        <Route path="/analytics" element={<TemplateAnalyticsPage />} />
        <Route path="/analytics/:templateId" element={<TemplateAnalyticsPage />} />
      </Routes>
    </Box>
  );
};