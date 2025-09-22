import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Chip,
} from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  isLoading?: boolean;
  trend?: {
    value: number;
    label: string;
    direction: 'up' | 'down' | 'neutral';
  };
  sx?: SxProps<Theme>;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = 'primary',
  isLoading = false,
  trend,
  sx,
}) => {
  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'up':
        return 'success';
      case 'down':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Card sx={{ height: '100%', ...sx }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
          <Typography color="textSecondary" variant="body2">
            {title}
          </Typography>
          {icon && (
            <Box color={`${color}.main`}>
              {icon}
            </Box>
          )}
        </Box>
        
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <>
            <Typography variant="h4" component="div" color={`${color}.main`} sx={{ mb: 0.5 }}>
              {value}
            </Typography>
            
            {subtitle && (
              <Typography variant="body2" color="textSecondary" sx={{ mb: trend ? 0.5 : 0 }}>
                {subtitle}
              </Typography>
            )}
            
            {trend && (
              <Box mt={0.5}>
                <Chip
                  label={`${trend.direction === 'up' ? '+' : trend.direction === 'down' ? '-' : ''}${trend.value}% ${trend.label}`}
                  size="small"
                  color={getTrendColor(trend.direction) as any}
                  variant="outlined"
                />
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};