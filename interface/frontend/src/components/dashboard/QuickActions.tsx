import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Grid,
  Button,
  Box,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  CloudUpload as CloudUploadIcon,
  Assessment as AssessmentIcon,
  Settings as SettingsIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  path: string;
  disabled?: boolean;
}

export const QuickActions: React.FC = () => {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    {
      id: 'create-prompt',
      title: 'Create Prompt',
      description: 'Start building a new AI prompt',
      icon: <AddIcon />,
      color: 'primary',
      path: '/prompts/new',
    },
    {
      id: 'manage-connections',
      title: 'Manage Connections',
      description: 'Configure LLM providers',
      icon: <CloudUploadIcon />,
      color: 'secondary',
      path: '/connections',
    },
    {
      id: 'browse-prompts',
      title: 'Browse Library',
      description: 'Explore existing prompts',
      icon: <SearchIcon />,
      color: 'info',
      path: '/prompts',
    },
    {
      id: 'view-analytics',
      title: 'View Analytics',
      description: 'Check performance metrics',
      icon: <AssessmentIcon />,
      color: 'success',
      path: '/analytics',
      disabled: true, // Not implemented yet
    },
    {
      id: 'export-data',
      title: 'Export Data',
      description: 'Download prompts and data',
      icon: <DownloadIcon />,
      color: 'warning',
      path: '/export',
      disabled: true, // Not implemented yet
    },
    {
      id: 'system-settings',
      title: 'System Settings',
      description: 'Configure application',
      icon: <SettingsIcon />,
      color: 'error',
      path: '/settings',
    },
  ];

  const handleActionClick = (action: QuickAction) => {
    if (!action.disabled) {
      navigate(action.path);
    }
  };

  return (
    <Card>
      <CardHeader title="Quick Actions" sx={{ pb: 0.5 }} />
      <CardContent sx={{ pt: 1 }}>
        <Grid container spacing={2}>
          {actions.map((action) => (
            <Grid item xs={12} sm={6} md={4} key={action.id}>
              <Button
                fullWidth
                variant="outlined"
                color={action.color}
                disabled={action.disabled}
                onClick={() => handleActionClick(action)}
                sx={{
                  height: 100,
                  flexDirection: 'column',
                  gap: 1,
                  textTransform: 'none',
                  p: 2,
                  '&:hover': {
                    backgroundColor: action.disabled ? 'transparent' : `${action.color}.light`,
                    opacity: action.disabled ? 0.6 : 1,
                  },
                }}
              >
                <Box 
                  color={action.disabled ? 'text.disabled' : `${action.color}.main`}
                  sx={{ mb: 1 }}
                >
                  {action.icon}
                </Box>
                <Box textAlign="center" sx={{ width: '100%' }}>
                  <Typography
                    variant="body2"
                    fontWeight="medium"
                    color={action.disabled ? 'text.disabled' : 'text.primary'}
                    sx={{ mb: 0.5, lineHeight: 1.2 }}
                  >
                    {action.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={action.disabled ? 'text.disabled' : 'text.secondary'}
                    sx={{ lineHeight: 1.2, display: 'block' }}
                  >
                    {action.description}
                  </Typography>
                </Box>
              </Button>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
};