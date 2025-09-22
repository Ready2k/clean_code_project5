import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Rating,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,

  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Description as PromptsIcon,
  Link as ConnectionsIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  Star as StarIcon,
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

const DRAWER_WIDTH = 280;

// Mock data
const mockPrompts = [
  {
    id: '1',
    title: 'Email Marketing Campaign Generator',
    summary: 'Creates compelling email marketing campaigns for products',
    tags: ['marketing', 'email', 'copywriting'],
    rating: 4.5,
    ratingCount: 23,
    owner: 'john.doe',
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    title: 'Code Review Assistant',
    summary: 'Provides detailed code review feedback and suggestions',
    tags: ['development', 'code-review', 'quality'],
    rating: 4.8,
    ratingCount: 45,
    owner: 'jane.smith',
    createdAt: '2024-01-10',
  },
  {
    id: '3',
    title: 'Blog Post Outline Creator',
    summary: 'Generates structured outlines for blog posts on any topic',
    tags: ['content', 'blogging', 'writing'],
    rating: 4.2,
    ratingCount: 18,
    owner: 'mike.wilson',
    createdAt: '2024-01-08',
  },
];

const mockConnections = [
  {
    id: '1',
    name: 'OpenAI GPT-4',
    provider: 'OpenAI',
    status: 'active',
    lastTested: '2024-01-15T10:30:00Z',
  },
  {
    id: '2',
    name: 'AWS Bedrock Claude',
    provider: 'AWS Bedrock',
    status: 'active',
    lastTested: '2024-01-15T09:15:00Z',
  },
];

const DemoApp: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [createPromptOpen, setCreatePromptOpen] = useState(false);
  const [newPromptTitle, setNewPromptTitle] = useState('');

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { id: 'prompts', label: 'Prompts', icon: <PromptsIcon /> },
    { id: 'connections', label: 'Connections', icon: <ConnectionsIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  ];

  const renderDashboard = () => (
    <Container maxWidth={false} sx={{ py: 3, px: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome to your Prompt Library management interface
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            '&:hover': { transform: 'translateY(-2px)', transition: 'transform 0.2s' }
          }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
                    Total Prompts
                  </Typography>
                  <Typography variant="h3" component="div" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {mockPrompts.length}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    0 active
                  </Typography>
                </Box>
                <PromptsIcon sx={{ fontSize: 40, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            '&:hover': { transform: 'translateY(-2px)', transition: 'transform 0.2s' }
          }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
                    Active Connections
                  </Typography>
                  <Typography variant="h3" component="div" sx={{ fontWeight: 700, mb: 0.5 }}>
                    {mockConnections.filter(c => c.status === 'active').length}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    1 total configured
                  </Typography>
                </Box>
                <ConnectionsIcon sx={{ fontSize: 40, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%',
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            color: 'white',
            '&:hover': { transform: 'translateY(-2px)', transition: 'transform 0.2s' }
          }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
                    Average Rating
                  </Typography>
                  <Typography variant="h3" component="div" sx={{ fontWeight: 700, mb: 0.5 }}>
                    0.0
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Based on user feedback
                  </Typography>
                </Box>
                <StarIcon sx={{ fontSize: 40, opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ 
            height: '100%',
            background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            color: 'white',
            '&:hover': { transform: 'translateY(-2px)', transition: 'transform 0.2s' }
          }}>
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
                    System Status
                  </Typography>
                  <Typography variant="h6" component="div" sx={{ fontWeight: 600, mb: 0.5 }}>
                    HEALTHY
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    0h uptime
                  </Typography>
                </Box>
                <Box sx={{ 
                  width: 12, 
                  height: 12, 
                  borderRadius: '50%', 
                  bgcolor: '#4caf50',
                  boxShadow: '0 0 10px rgba(76, 175, 80, 0.5)'
                }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Secondary Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2.5, textAlign: 'center' }}>
              <Typography variant="h4" color="primary" sx={{ fontWeight: 600, mb: 0.5 }}>
                1
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Active Users
              </Typography>
              <Typography variant="caption" color="text.secondary">
                1 total users
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2.5, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main" sx={{ fontWeight: 600, mb: 0.5 }}>
                50.0%
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Storage Used
              </Typography>
              <Typography variant="caption" color="text.secondary">
                477MB used
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2.5, textAlign: 'center' }}>
              <Typography variant="h4" color="info.main" sx={{ fontWeight: 600, mb: 0.5 }}>
                192.7ms
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Avg Response Time
              </Typography>
              <Typography variant="caption" color="text.secondary">
                API performance
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ height: '100%', border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 2.5, textAlign: 'center' }}>
              <Typography variant="h4" color="success.main" sx={{ fontWeight: 600, mb: 0.5 }}>
                0%
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Error Rate
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Last 24 hours
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 2.5, fontWeight: 600 }}>
                Quick Actions
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={6}>
                  <Card sx={{ 
                    height: '100%', 
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { 
                      transform: 'translateY(-2px)',
                      boxShadow: 3
                    }
                  }}>
                    <CardContent sx={{ p: 2.5, textAlign: 'center' }}>
                      <Box sx={{ mb: 1.5 }}>
                        <AddIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                      </Box>
                      <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>
                        Create Prompt
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Start building a new AI prompt
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <Card sx={{ 
                    height: '100%', 
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { 
                      transform: 'translateY(-2px)',
                      boxShadow: 3
                    }
                  }}>
                    <CardContent sx={{ p: 2.5, textAlign: 'center' }}>
                      <Box sx={{ mb: 1.5 }}>
                        <ConnectionsIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                      </Box>
                      <Typography variant="h6" sx={{ mb: 0.5, fontWeight: 600 }}>
                        Manage Connections
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Configure LLM providers
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
              
              {/* Secondary Actions */}
              <Box sx={{ mt: 2.5 }}>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <Button
                      variant="text"
                      fullWidth
                      startIcon={<SettingsIcon />}
                      sx={{ py: 1, justifyContent: 'flex-start' }}
                    >
                      System Settings
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Button
                      variant="text"
                      fullWidth
                      startIcon={<UploadIcon />}
                      sx={{ py: 1, justifyContent: 'flex-start' }}
                    >
                      View Analytics
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Button
                      variant="text"
                      fullWidth
                      startIcon={<DownloadIcon />}
                      sx={{ py: 1, justifyContent: 'flex-start' }}
                    >
                      Export Data
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 2.5, fontWeight: 600 }}>
                Live Activity
              </Typography>
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No recent activity
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );

  const renderPrompts = () => (
    <Container maxWidth="xl" sx={{ py: 3, px: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
              Prompts Library
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage and organize your AI prompts
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<AddIcon />}
            onClick={() => setCreatePromptOpen(true)}
            sx={{ px: 3, py: 1.5 }}
          >
            Create Prompt
          </Button>
        </Box>
      </Box>
      
      <Grid container spacing={3}>
        {mockPrompts.map((prompt) => (
          <Grid item xs={12} md={6} lg={4} key={prompt.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography gutterBottom variant="h6" component="div">
                  {prompt.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {prompt.summary}
                </Typography>
                <Box mb={2}>
                  {prompt.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </Box>
                <Box display="flex" alignItems="center" gap={1}>
                  <Rating value={prompt.rating} precision={0.1} readOnly size="small" />
                  <Typography variant="body2" color="text.secondary">
                    ({prompt.ratingCount})
                  </Typography>
                </Box>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  By {prompt.owner} • {prompt.createdAt}
                </Typography>
              </CardContent>
              <Box p={2} pt={0}>
                <Button size="small" startIcon={<EditIcon />} sx={{ mr: 1 }}>
                  Edit
                </Button>
                <Button size="small" startIcon={<UploadIcon />} sx={{ mr: 1 }}>
                  Enhance
                </Button>
                <Button size="small" startIcon={<DownloadIcon />}>
                  Export
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={createPromptOpen} onClose={() => setCreatePromptOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Prompt</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Prompt Title"
            fullWidth
            variant="outlined"
            value={newPromptTitle}
            onChange={(e) => setNewPromptTitle(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Summary"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Tags (comma separated)"
            fullWidth
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreatePromptOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setCreatePromptOpen(false)}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );

  const renderConnections = () => (
    <Container maxWidth="xl" sx={{ py: 3, px: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
              LLM Connections
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Configure and manage your AI provider connections
            </Typography>
          </Box>
          <Button 
            variant="contained" 
            size="large"
            startIcon={<AddIcon />}
            sx={{ px: 3, py: 1.5 }}
          >
            Add Connection
          </Button>
        </Box>
      </Box>
      
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ fontWeight: 600, py: 2 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 2 }}>Provider</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 2 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 2 }}>Last Tested</TableCell>
                <TableCell sx={{ fontWeight: 600, py: 2 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockConnections.map((connection) => (
                <TableRow 
                  key={connection.id}
                  sx={{ 
                    '&:hover': { bgcolor: 'action.hover' },
                    '&:last-child td, &:last-child th': { border: 0 }
                  }}
                >
                  <TableCell sx={{ py: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {connection.name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {connection.provider}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Chip 
                      label={connection.status.toUpperCase()} 
                      color={connection.status === 'active' ? 'success' : 'default'}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(connection.lastTested).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button 
                        size="small" 
                        variant="outlined"
                        sx={{ minWidth: 'auto', px: 2 }}
                      >
                        Test
                      </Button>
                      <Button 
                        size="small" 
                        variant="outlined"
                        startIcon={<EditIcon />}
                        sx={{ minWidth: 'auto', px: 2 }}
                      >
                        Edit
                      </Button>
                      <Button 
                        size="small" 
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        sx={{ minWidth: 'auto', px: 2 }}
                      >
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Container>
  );

  const renderSettings = () => (
    <Container maxWidth="xl" sx={{ py: 3, px: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 1 }}>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure your account and application preferences
        </Typography>
      </Box>
      
      <Card sx={{ maxWidth: 800 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
            User Preferences
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Display Name"
                defaultValue="Demo User"
                variant="outlined"
                size="medium"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                defaultValue="demo@example.com"
                variant="outlined"
                size="medium"
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ pt: 2 }}>
                <Button 
                  variant="contained" 
                  size="large"
                  sx={{ px: 4, py: 1.5 }}
                >
                  Save Changes
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Container>
  );

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return renderDashboard();
      case 'prompts':
        return renderPrompts();
      case 'connections':
        return renderConnections();
      case 'settings':
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar 
        position="fixed" 
        sx={{ 
          zIndex: (theme) => theme.zIndex.drawer + 1,
          width: `calc(100% - ${DRAWER_WIDTH}px)`,
          ml: `${DRAWER_WIDTH}px`,
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Toolbar sx={{ px: 3, minHeight: '64px !important' }}>
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600, flexGrow: 1 }}>
            Prompt Library Professional Interface
          </Typography>
          <Chip 
            label="DEMO" 
            size="small" 
            color="warning" 
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        </Toolbar>
      </AppBar>
      
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { 
            width: DRAWER_WIDTH, 
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            position: 'fixed',
            height: '100%'
          },
        }}
      >
        <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
            Prompt Library
          </Typography>
        </Box>
        <Box sx={{ overflow: 'auto', p: 2 }}>
          <List sx={{ p: 0 }}>
            {menuItems.map((item) => (
              <ListItem
                button
                key={item.id}
                selected={currentPage === item.id}
                onClick={() => setCurrentPage(item.id)}
                sx={{
                  borderRadius: 2,
                  mb: 1,
                  px: 2,
                  py: 1.5,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                    '& .MuiListItemIcon-root': {
                      color: 'primary.contrastText',
                    },
                  },
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <ListItemIcon 
                  sx={{ 
                    color: currentPage === item.id ? 'inherit' : 'text.secondary',
                    minWidth: 40
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: currentPage === item.id ? 600 : 500,
                    fontSize: '0.95rem'
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          ml: `${DRAWER_WIDTH}px`,
          minHeight: '100vh',
          bgcolor: 'grey.50',
          pt: '64px'
        }}
      >
        {renderContent()}
      </Box>
    </Box>
  );
};

export default DemoApp;