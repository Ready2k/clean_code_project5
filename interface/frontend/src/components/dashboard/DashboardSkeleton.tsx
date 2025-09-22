import React from 'react';
import { Grid, Skeleton, Card, CardContent, Box } from '@mui/material';

export const DashboardSkeleton: React.FC = () => {
  return (
    <Grid container spacing={3}>
      {/* Statistics Cards Skeleton */}
      {[1, 2, 3, 4].map((index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
                <Skeleton variant="text" width="60%" />
              </Box>
              <Skeleton variant="text" width="40%" height={32} />
              <Skeleton variant="text" width="80%" />
            </CardContent>
          </Card>
        </Grid>
      ))}
      
      {/* Additional Stats Row Skeleton */}
      {[1, 2, 3, 4].map((index) => (
        <Grid item xs={12} sm={6} md={3} key={`additional-${index}`}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Skeleton variant="circular" width={24} height={24} sx={{ mr: 1 }} />
                <Skeleton variant="text" width="60%" />
              </Box>
              <Skeleton variant="text" width="40%" height={32} />
              <Skeleton variant="text" width="80%" />
            </CardContent>
          </Card>
        </Grid>
      ))}
      
      {/* Main Content Skeleton */}
      <Grid item xs={12} lg={8}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="30%" height={32} sx={{ mb: 2 }} />
                <Grid container spacing={2}>
                  {[1, 2, 3, 4].map((index) => (
                    <Grid item xs={6} sm={3} key={index}>
                      <Skeleton variant="rectangular" height={80} />
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="40%" height={24} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={200} />
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="40%" height={24} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={200} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Grid>
      
      {/* Right Column Skeleton */}
      <Grid item xs={12} lg={4}>
        <Card>
          <CardContent>
            <Skeleton variant="text" width="50%" height={24} sx={{ mb: 2 }} />
            {[1, 2, 3, 4, 5].map((index) => (
              <Box key={index} sx={{ mb: 2 }}>
                <Skeleton variant="text" width="100%" />
                <Skeleton variant="text" width="80%" />
              </Box>
            ))}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};