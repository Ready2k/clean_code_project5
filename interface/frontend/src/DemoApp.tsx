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
  Fab,
  Paper,
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

const DRAWER_WIDTH = 240;

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
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Prompts
              </Typography>
              <Typography variant="h5" component="div">
                {mockPrompts.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Connections
              </Typography>
              <Typography variant="h5" component="div">
                {mockConnections.filter(c => c.status === 'active').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Average Rating
              </Typography>
              <Typography variant="h5" component="div">
                4.5
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Recent Activity
              </Typography>
              <Typography variant="h5" component="div">
                12
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );

  const renderPrompts = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Prompts Library
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreatePromptOpen(true)}
        >
          Create Prompt
        </Button>
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
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          LLM Connections
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          Add Connection
        </Button>
      </Box>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Provider</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Tested</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {mockConnections.map((connection) => (
              <TableRow key={connection.id}>
                <TableCell>{connection.name}</TableCell>
                <TableCell>{connection.provider}</TableCell>
                <TableCell>
                  <Chip 
                    label={connection.status} 
                    color={connection.status === 'active' ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {new Date(connection.lastTested).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Button size="small" sx={{ mr: 1 }}>Test</Button>
                  <Button size="small" startIcon={<EditIcon />} sx={{ mr: 1 }}>
                    Edit
                  </Button>
                  <Button size="small" startIcon={<DeleteIcon />} color="error">
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );

  const renderSettings = () => (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            User Preferences
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Display Name"
                defaultValue="Demo User"
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                defaultValue="demo@example.com"
                variant="outlined"
              />
            </Grid>
            <Grid item xs={12}>
              <Button variant="contained">
                Save Changes
              </Button>
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
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div">
            Prompt Library Professional Interface - DEMO
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuItems.map((item) => (
              <ListItem
                button
                key={item.id}
                selected={currentPage === item.id}
                onClick={() => setCurrentPage(item.id)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
      
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {renderContent()}
      </Box>
    </Box>
  );
};

export default DemoApp;