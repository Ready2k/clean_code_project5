/**
 * Provider Filters Panel Component
 * 
 * Advanced filtering interface for providers with multiple
 * filter criteria and real-time updates.
 */

import React from 'react';
import {
  Box,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Switch,
  FormControlLabel,
  Typography,
  Divider,
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';

import { ProviderFilters, ProviderStatus, AuthMethod } from '../../../types/providers';

interface ProviderFiltersPanelProps {
  filters: ProviderFilters;
  onChange: (filters: Partial<ProviderFilters>) => void;
}

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

export const ProviderFiltersPanel: React.FC<ProviderFiltersPanelProps> = ({
  filters,
  onChange,
}) => {
  // Status options
  const statusOptions: { value: ProviderStatus; label: string; color: string }[] = [
    { value: 'active', label: 'Active', color: 'success' },
    { value: 'inactive', label: 'Inactive', color: 'default' },
    { value: 'testing', label: 'Testing', color: 'info' },
  ];

  // Auth method options
  const authMethodOptions: { value: AuthMethod; label: string; description: string }[] = [
    { value: 'api_key', label: 'API Key', description: 'Simple API key authentication' },
    { value: 'oauth2', label: 'OAuth 2.0', description: 'OAuth 2.0 flow authentication' },
    { value: 'aws_iam', label: 'AWS IAM', description: 'AWS IAM role-based authentication' },
    { value: 'custom', label: 'Custom', description: 'Custom authentication method' },
  ];

  // Handle status filter change
  const handleStatusChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    const statusArray = typeof value === 'string' ? value.split(',') : value;
    onChange({
      status: statusArray.length > 0 ? statusArray as ProviderStatus[] : undefined,
    });
  };

  // Handle auth method filter change
  const handleAuthMethodChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    const authArray = typeof value === 'string' ? value.split(',') : value;
    onChange({
      authMethod: authArray.length > 0 ? authArray as AuthMethod[] : undefined,
    });
  };

  // Handle system provider filter change
  const handleSystemProviderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    onChange({
      isSystem: checked,
    });
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Filter Providers
      </Typography>

      <Grid container spacing={3}>
        {/* Status Filter */}
        <Grid item xs={12} sm={6} md={4}>
          <FormControl fullWidth>
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              multiple
              value={filters.status || []}
              onChange={handleStatusChange}
              input={<OutlinedInput label="Status" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => {
                    const option = statusOptions.find(opt => opt.value === value);
                    return (
                      <Chip
                        key={value}
                        label={option?.label || value}
                        size="small"
                        color={option?.color as any}
                      />
                    );
                  })}
                </Box>
              )}
              MenuProps={MenuProps}
            >
              {statusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={option.label}
                      size="small"
                      color={option.color as any}
                      variant="outlined"
                    />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Auth Method Filter */}
        <Grid item xs={12} sm={6} md={4}>
          <FormControl fullWidth>
            <InputLabel id="auth-method-filter-label">Authentication</InputLabel>
            <Select
              labelId="auth-method-filter-label"
              multiple
              value={filters.authMethod || []}
              onChange={handleAuthMethodChange}
              input={<OutlinedInput label="Authentication" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => {
                    const option = authMethodOptions.find(opt => opt.value === value);
                    return (
                      <Chip
                        key={value}
                        label={option?.label || value}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    );
                  })}
                </Box>
              )}
              MenuProps={MenuProps}
            >
              {authMethodOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {option.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.description}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Provider Type Filter */}
        <Grid item xs={12} sm={6} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Provider Type
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={filters.isSystem === true}
                  onChange={handleSystemProviderChange}
                  color="primary"
                />
              }
              label="System Providers Only"
            />
            
            <Typography variant="caption" color="text.secondary">
              Show only built-in system providers
            </Typography>
          </Box>
        </Grid>
      </Grid>

      <Divider sx={{ my: 3 }} />

      {/* Filter Summary */}
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Active Filters
        </Typography>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {/* Status filters */}
          {filters.status?.map((status) => {
            const option = statusOptions.find(opt => opt.value === status);
            return (
              <Chip
                key={`status-${status}`}
                label={`Status: ${option?.label || status}`}
                color={option?.color as any}
                size="small"
                onDelete={() => {
                  const newStatus = filters.status?.filter(s => s !== status);
                  onChange({ status: newStatus?.length ? newStatus : undefined });
                }}
              />
            );
          })}

          {/* Auth method filters */}
          {filters.authMethod?.map((method) => {
            const option = authMethodOptions.find(opt => opt.value === method);
            return (
              <Chip
                key={`auth-${method}`}
                label={`Auth: ${option?.label || method}`}
                color="primary"
                size="small"
                variant="outlined"
                onDelete={() => {
                  const newMethods = filters.authMethod?.filter(m => m !== method);
                  onChange({ authMethod: newMethods?.length ? newMethods : undefined });
                }}
              />
            );
          })}

          {/* System provider filter */}
          {filters.isSystem !== undefined && (
            <Chip
              label={`${filters.isSystem ? 'System' : 'Custom'} Providers`}
              color="info"
              size="small"
              variant="outlined"
              onDelete={() => onChange({ isSystem: undefined })}
            />
          )}

          {/* No filters message */}
          {!filters.status?.length && 
           !filters.authMethod?.length && 
           filters.isSystem === undefined && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No filters applied
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ProviderFiltersPanel;