/**
 * Template List Page Component
 * 
 * Displays a list of all prompt templates with filtering, searching, and management capabilities.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../hooks/redux';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Checkbox,
  Toolbar,
  Tooltip,
  Alert,
  CircularProgress,
  Grid,
  Paper,
  Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
  Visibility as ViewIcon,
  MoreVert as MoreIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon,
  Star as DefaultIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material';

// Types
interface TemplateInfo {
  id: string;
  category: string;
  key: string;
  name: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
  version: number;
  lastModified: Date;
  usageCount: number;
  metadata: {
    complexity_level?: 'basic' | 'intermediate' | 'advanced';
    tags?: string[];
    provider_optimized?: string[];
  };
}

interface TemplateFilters {
  category?: string;
  isActive?: boolean;
  isDefault?: boolean;
  search?: string;
  tags?: string[];
  provider?: string;
}

const TEMPLATE_CATEGORIES = [
  { value: 'enhancement', label: 'Enhancement' },
  { value: 'question_generation', label: 'Question Generation' },
  { value: 'system_prompts', label: 'System Prompts' },
  { value: 'mock_responses', label: 'Mock Responses' },
  { value: 'custom', label: 'Custom' },
];

const COMPLEXITY_COLORS = {
  basic: 'success',
  intermediate: 'warning',
  advanced: 'error',
} as const;

export const TemplateListPage: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAppSelector((state) => state.auth);
  
  // State
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [filters, setFilters] = useState<TemplateFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if user is authenticated
      if (!token) {
        setError('Please log in to access templates');
        return;
      }
      
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.isActive !== undefined) params.append('isActive', filters.isActive.toString());
      if (filters.isDefault !== undefined) params.append('isDefault', filters.isDefault.toString());
      if (filters.search) params.append('search', filters.search);
      if (filters.provider) params.append('provider', filters.provider);
      params.append('limit', rowsPerPage.toString());
      params.append('offset', (page * rowsPerPage).toString());

      const response = await fetch(`http://localhost:8000/api/admin/prompt-templates?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to load templates');
      }

      const data = await response.json();
      setTemplates(data.data?.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [filters, page, rowsPerPage, token]);

  useEffect(() => {
    if (token) {
      loadTemplates();
    }
  }, [loadTemplates, token]);

  // Handlers
  const handleFilterChange = (key: keyof TemplateFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(0); // Reset to first page when filtering
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelected(templates.map(t => t.id));
    } else {
      setSelected([]);
    }
  };

  const handleSelectOne = (templateId: string) => {
    setSelected(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleEdit = (templateId: string) => {
    navigate(`/admin/prompt-templates/editor/${templateId}`);
  };

  const handleTest = (templateId: string) => {
    navigate(`/admin/prompt-templates/testing/${templateId}`);
  };

  const handleView = (templateId: string) => {
    navigate(`/admin/prompt-templates/editor/${templateId}?mode=view`);
  };

  const handleCreate = () => {
    navigate('/admin/prompt-templates/editor/new');
  };

  const handleBulkDelete = async () => {
    if (selected.length === 0) return;
    
    try {
      const response = await fetch('http://localhost:8000/api/admin/prompt-templates/bulk-delete', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ templateIds: selected }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete templates');
      }

      setSelected([]);
      loadTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete templates');
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      enhancement: 'primary',
      question_generation: 'secondary',
      system_prompts: 'info',
      mock_responses: 'warning',
      custom: 'default',
    };
    return colors[category] || 'default';
  };

  // Check authentication
  if (!token) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Authentication Required
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please log in to access the template management system.
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/login')}
          >
            Go to Login
          </Button>
        </Card>
      </Box>
    );
  }

  if (loading && templates.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" component="h2">
          Template Library
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Create Template
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search templates..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={filters.category || ''}
                  label="Category"
                  onChange={(e) => handleFilterChange('category', e.target.value || undefined)}
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {TEMPLATE_CATEGORIES.map(cat => (
                    <MenuItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.isActive === undefined ? '' : filters.isActive.toString()}
                  label="Status"
                  onChange={(e) => handleFilterChange('isActive', e.target.value === '' ? undefined : e.target.value === 'true')}
                >
                  <MenuItem value="">All Status</MenuItem>
                  <MenuItem value="true">Active</MenuItem>
                  <MenuItem value="false">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={filters.isDefault === undefined ? '' : filters.isDefault.toString()}
                  label="Type"
                  onChange={(e) => handleFilterChange('isDefault', e.target.value === '' ? undefined : e.target.value === 'true')}
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="true">Default</MenuItem>
                  <MenuItem value="false">Custom</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
                onClick={() => setShowFilters(!showFilters)}
              >
                Filters
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Bulk Actions Toolbar */}
      {selected.length > 0 && (
        <Paper sx={{ mb: 2 }}>
          <Toolbar>
            <Typography variant="subtitle1" component="div" sx={{ flex: '1 1 100%' }}>
              {selected.length} selected
            </Typography>
            <Tooltip title="Delete selected">
              <IconButton onClick={handleBulkDelete}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>
        </Paper>
      )}

      {/* Templates Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selected.length > 0 && selected.length < templates.length}
                    checked={templates.length > 0 && selected.length === templates.length}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Complexity</TableCell>
                <TableCell>Usage</TableCell>
                <TableCell>Last Modified</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.map((template) => (
                <TableRow
                  key={template.id}
                  hover
                  selected={selected.includes(template.id)}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selected.includes(template.id)}
                      onChange={() => handleSelectOne(template.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2">
                          {template.name}
                        </Typography>
                        {template.isDefault && (
                          <Tooltip title="Default template">
                            <DefaultIcon color="warning" fontSize="small" />
                          </Tooltip>
                        )}
                      </Stack>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {template.description}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={TEMPLATE_CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                      color={getCategoryColor(template.category) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      {template.isActive ? (
                        <ActiveIcon color="success" fontSize="small" />
                      ) : (
                        <InactiveIcon color="error" fontSize="small" />
                      )}
                      <Typography variant="body2">
                        {template.isActive ? 'Active' : 'Inactive'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {template.metadata.complexity_level && (
                      <Chip
                        label={template.metadata.complexity_level}
                        color={COMPLEXITY_COLORS[template.metadata.complexity_level]}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {template.usageCount.toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(template.lastModified)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => handleView(template.id)}>
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEdit(template.id)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Test">
                        <IconButton size="small" onClick={() => handleTest(template.id)}>
                          <TestIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Analytics">
                        <IconButton 
                          size="small" 
                          onClick={() => navigate(`/admin/prompt-templates/analytics/${template.id}`)}
                        >
                          <AnalyticsIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={-1} // We'll need to get total count from API
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Card>
    </Box>
  );
};