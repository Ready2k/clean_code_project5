import React from 'react';
import { Box, Card, CardContent, Grid } from '@mui/material';
import { LoadingSkeleton } from './LoadingSpinner';

export function PromptCardSkeleton() {
  return (
    <Card>
      <CardContent>
        <LoadingSkeleton variant="text" width="80%" height={24} />
        <LoadingSkeleton variant="text" lines={2} height={16} />
        <Box display="flex" gap={1} mt={2}>
          <LoadingSkeleton variant="rectangular" width={60} height={24} />
          <LoadingSkeleton variant="rectangular" width={80} height={24} />
          <LoadingSkeleton variant="rectangular" width={70} height={24} />
        </Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
          <LoadingSkeleton variant="text" width={100} height={20} />
          <LoadingSkeleton variant="circular" width={40} height={40} />
        </Box>
      </CardContent>
    </Card>
  );
}

export function PromptListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: count }).map((_, index) => (
        <Grid item xs={12} sm={6} md={4} key={index}>
          <PromptCardSkeleton />
        </Grid>
      ))}
    </Grid>
  );
}

export function ConnectionCardSkeleton() {
  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={2}>
          <LoadingSkeleton variant="circular" width={48} height={48} />
          <Box flex={1}>
            <LoadingSkeleton variant="text" width="60%" height={20} />
            <LoadingSkeleton variant="text" width="40%" height={16} />
          </Box>
          <LoadingSkeleton variant="rectangular" width={80} height={32} />
        </Box>
        <Box mt={2}>
          <LoadingSkeleton variant="text" lines={2} height={14} />
        </Box>
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <LoadingSkeleton variant="text" width="30%" height={32} />
        <LoadingSkeleton variant="text" width="50%" height={20} />
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} mb={3}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <LoadingSkeleton variant="text" width="70%" height={20} />
                <LoadingSkeleton variant="text" width="40%" height={32} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Main Content */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <LoadingSkeleton variant="text" width="40%" height={24} />
              <Box mt={2}>
                <LoadingSkeleton variant="rectangular" width="100%" height={200} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <LoadingSkeleton variant="text" width="50%" height={24} />
              <Box mt={2}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Box key={index} display="flex" alignItems="center" gap={2} mb={2}>
                    <LoadingSkeleton variant="circular" width={32} height={32} />
                    <Box flex={1}>
                      <LoadingSkeleton variant="text" width="80%" height={16} />
                      <LoadingSkeleton variant="text" width="60%" height={14} />
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <Box>
      {/* Table Header */}
      <Box display="flex" gap={2} mb={2} p={2}>
        {Array.from({ length: columns }).map((_, index) => (
          <LoadingSkeleton key={index} variant="text" width="20%" height={20} />
        ))}
      </Box>
      
      {/* Table Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <Box key={rowIndex} display="flex" gap={2} mb={1} p={2}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <LoadingSkeleton key={colIndex} variant="text" width="20%" height={16} />
          ))}
        </Box>
      ))}
    </Box>
  );
}