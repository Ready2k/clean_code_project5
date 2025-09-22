import React from 'react';
import {
  Box,
  Typography,
  Grid,
  TextField,
  MenuItem,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { SystemConfig } from '../../services/api/systemAPI';

interface SystemConfigurationPanelProps {
  config: SystemConfig | null;
  onUpdateConfig: (updates: Partial<SystemConfig>) => void;
  isLoading: boolean;
}

export const SystemConfigurationPanel: React.FC<SystemConfigurationPanelProps> = ({
  config,
  onUpdateConfig,
  isLoading,
}) => {
  if (!config) {
    return (
      <Box>
        <Typography variant="body1" color="text.secondary">
          No configuration data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Logging Configuration</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth disabled={isLoading}>
                <InputLabel>Log Level</InputLabel>
                <Select
                  value={config.logging.level}
                  onChange={(e) => onUpdateConfig({
                    logging: { ...config.logging, level: e.target.value }
                  })}
                >
                  <MenuItem value="debug">Debug</MenuItem>
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="warn">Warning</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.logging.enableFileLogging}
                    onChange={(e) => onUpdateConfig({
                      logging: { ...config.logging, enableFileLogging: e.target.checked }
                    })}
                    disabled={isLoading}
                  />
                }
                label="Enable File Logging"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Max Log Files"
                type="number"
                value={config.logging.maxLogFiles}
                onChange={(e) => onUpdateConfig({
                  logging: { ...config.logging, maxLogFiles: parseInt(e.target.value) }
                })}
                disabled={isLoading}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Max Log Size"
                value={config.logging.maxLogSize}
                onChange={(e) => onUpdateConfig({
                  logging: { ...config.logging, maxLogSize: e.target.value }
                })}
                disabled={isLoading}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Performance Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Request Timeout (ms)"
                type="number"
                value={config.performance.requestTimeout}
                onChange={(e) => onUpdateConfig({
                  performance: { ...config.performance, requestTimeout: parseInt(e.target.value) }
                })}
                disabled={isLoading}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Max Concurrent Requests"
                type="number"
                value={config.performance.maxConcurrentRequests}
                onChange={(e) => onUpdateConfig({
                  performance: { ...config.performance, maxConcurrentRequests: parseInt(e.target.value) }
                })}
                disabled={isLoading}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Rate Limit Window (ms)"
                type="number"
                value={config.performance.rateLimitWindow}
                onChange={(e) => onUpdateConfig({
                  performance: { ...config.performance, rateLimitWindow: parseInt(e.target.value) }
                })}
                disabled={isLoading}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Rate Limit Max Requests"
                type="number"
                value={config.performance.rateLimitMax}
                onChange={(e) => onUpdateConfig({
                  performance: { ...config.performance, rateLimitMax: parseInt(e.target.value) }
                })}
                disabled={isLoading}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Security Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="JWT Expires In"
                value={config.security.jwtExpiresIn}
                onChange={(e) => onUpdateConfig({
                  security: { ...config.security, jwtExpiresIn: e.target.value }
                })}
                disabled={isLoading}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Refresh Token Expires In"
                value={config.security.refreshTokenExpiresIn}
                onChange={(e) => onUpdateConfig({
                  security: { ...config.security, refreshTokenExpiresIn: e.target.value }
                })}
                disabled={isLoading}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Password Min Length"
                type="number"
                value={config.security.passwordMinLength}
                onChange={(e) => onUpdateConfig({
                  security: { ...config.security, passwordMinLength: parseInt(e.target.value) }
                })}
                disabled={isLoading}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Max Login Attempts"
                type="number"
                value={config.security.maxLoginAttempts}
                onChange={(e) => onUpdateConfig({
                  security: { ...config.security, maxLoginAttempts: parseInt(e.target.value) }
                })}
                disabled={isLoading}
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Feature Toggles</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.features.enableEnhancement}
                    onChange={(e) => onUpdateConfig({
                      features: { ...config.features, enableEnhancement: e.target.checked }
                    })}
                    disabled={isLoading}
                  />
                }
                label="Enable Enhancement"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.features.enableRating}
                    onChange={(e) => onUpdateConfig({
                      features: { ...config.features, enableRating: e.target.checked }
                    })}
                    disabled={isLoading}
                  />
                }
                label="Enable Rating"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.features.enableExport}
                    onChange={(e) => onUpdateConfig({
                      features: { ...config.features, enableExport: e.target.checked }
                    })}
                    disabled={isLoading}
                  />
                }
                label="Enable Export"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={config.features.enableMetrics}
                    onChange={(e) => onUpdateConfig({
                      features: { ...config.features, enableMetrics: e.target.checked }
                    })}
                    disabled={isLoading}
                  />
                }
                label="Enable Metrics"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};