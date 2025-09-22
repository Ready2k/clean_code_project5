import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Backup as BackupIcon,
  CleaningServices as CleanupIcon,
} from '@mui/icons-material';
import { SystemStats } from '../../types/system';

interface MaintenancePanelProps {
  stats: SystemStats | null;
  isCreatingBackup: boolean;
  isCleaningUp: boolean;
  backupResult: any;
  cleanupResult: any;
  onCreateBackup: () => void;
  onCleanupSystem: () => void;
}

export const MaintenancePanel: React.FC<MaintenancePanelProps> = ({
  stats,
  isCreatingBackup,
  isCleaningUp,
  backupResult,
  cleanupResult,
  onCreateBackup,
  onCleanupSystem,
}) => {
  return (
    <Box>
      <Grid container spacing={3}>
        {/* Backup Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <BackupIcon sx={{ mr: 1 }} />
                <Typography variant="h6">System Backup</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Create a complete backup of system configuration and data.
              </Typography>
              <Button
                variant="contained"
                startIcon={isCreatingBackup ? <CircularProgress size={20} /> : <BackupIcon />}
                onClick={onCreateBackup}
                disabled={isCreatingBackup}
                fullWidth
              >
                {isCreatingBackup ? 'Creating Backup...' : 'Create Backup'}
              </Button>
              
              {backupResult && (
                <Alert 
                  severity={backupResult.error ? 'error' : 'success'} 
                  sx={{ mt: 2 }}
                >
                  {backupResult.error || `Backup created successfully: ${backupResult.backup?.id}`}
                  {backupResult.backup && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" display="block">
                        Size: {(backupResult.backup.size / 1024 / 1024).toFixed(2)} MB
                      </Typography>
                      <Typography variant="caption" display="block">
                        Created: {new Date(backupResult.backup.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Cleanup Section */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CleanupIcon sx={{ mr: 1 }} />
                <Typography variant="h6">System Cleanup</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Clean up temporary files, old logs, and cached data.
              </Typography>
              <Button
                variant="outlined"
                startIcon={isCleaningUp ? <CircularProgress size={20} /> : <CleanupIcon />}
                onClick={onCleanupSystem}
                disabled={isCleaningUp}
                fullWidth
              >
                {isCleaningUp ? 'Cleaning Up...' : 'Cleanup System'}
              </Button>
              
              {cleanupResult && (
                <Alert 
                  severity={cleanupResult.error ? 'error' : 'success'} 
                  sx={{ mt: 2 }}
                >
                  {cleanupResult.error || 'Cleanup completed successfully'}
                  {cleanupResult.results && (
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" display="block">
                        Temp files removed: {cleanupResult.results.tempFilesRemoved || 0}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Old metrics removed: {cleanupResult.results.oldMetricsRemoved || 0}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Old events removed: {cleanupResult.results.oldEventsRemoved || 0}
                      </Typography>
                    </Box>
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Storage Information */}
        {stats && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Storage Information</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {stats.services.prompts.total}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Prompts
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {stats.services.prompts.totalRatings}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Ratings
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary">
                        {stats.services.connections.total}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        LLM Connections
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};