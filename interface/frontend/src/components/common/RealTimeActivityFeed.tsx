import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Fade,
  Divider
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Star as StarIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useWebSocket } from '../../hooks/useWebSocket';

interface ActivityItem {
  id: string;
  userId: string;
  username: string;
  action: string;
  resource: string;
  timestamp: string;
  type: 'user' | 'system' | 'enhancement' | 'export' | 'rating';
}

const MAX_ACTIVITIES = 20;

export const RealTimeActivityFeed: React.FC = () => {
  const { addEventListener } = useWebSocket();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [newActivityCount, setNewActivityCount] = useState(0);

  useEffect(() => {
    // Listen for various real-time events and convert them to activity items
    const unsubscribeUserActivity = addEventListener('user:activity', (activity) => {
      const newActivity: ActivityItem = {
        id: `${activity.userId}-${activity.timestamp}`,
        userId: activity.userId,
        username: activity.username,
        action: activity.action,
        resource: activity.resource,
        timestamp: activity.timestamp,
        type: 'user'
      };
      
      addActivity(newActivity);
    });

    const unsubscribePromptUpdated = addEventListener('prompt:updated', (data) => {
      const newActivity: ActivityItem = {
        id: `prompt-update-${data.promptId}-${data.timestamp}`,
        userId: data.userId,
        username: data.username,
        action: 'updated prompt',
        resource: data.promptId,
        timestamp: data.timestamp,
        type: 'user'
      };
      
      addActivity(newActivity);
    });

    const unsubscribeEnhancementCompleted = addEventListener('enhancement:completed', (data) => {
      const newActivity: ActivityItem = {
        id: `enhancement-${data.jobId}-${Date.now()}`,
        userId: 'system',
        username: 'AI Assistant',
        action: 'completed enhancement for',
        resource: data.promptId,
        timestamp: new Date().toISOString(),
        type: 'enhancement'
      };
      
      addActivity(newActivity);
    });

    const unsubscribeExportCompleted = addEventListener('export:completed', (data) => {
      const newActivity: ActivityItem = {
        id: `export-${data.exportId}-${data.timestamp}`,
        userId: 'system',
        username: 'Export Service',
        action: 'completed export',
        resource: data.exportId,
        timestamp: data.timestamp,
        type: 'export'
      };
      
      addActivity(newActivity);
    });

    const unsubscribeRatingUpdated = addEventListener('rating:updated', (data) => {
      const newActivity: ActivityItem = {
        id: `rating-${data.promptId}-${data.timestamp}`,
        userId: data.userId,
        username: 'User', // Username not provided in rating events
        action: 'rated prompt',
        resource: data.promptId,
        timestamp: data.timestamp,
        type: 'rating'
      };
      
      addActivity(newActivity);
    });

    return () => {
      unsubscribeUserActivity();
      unsubscribePromptUpdated();
      unsubscribeEnhancementCompleted();
      unsubscribeExportCompleted();
      unsubscribeRatingUpdated();
    };
  }, [addEventListener]);

  const addActivity = (newActivity: ActivityItem) => {
    setActivities(prev => {
      // Check if activity already exists
      const exists = prev.some(activity => activity.id === newActivity.id);
      if (exists) return prev;
      
      // Add new activity and keep only the latest MAX_ACTIVITIES
      const updated = [newActivity, ...prev].slice(0, MAX_ACTIVITIES);
      setNewActivityCount(count => count + 1);
      
      // Auto-reset new activity count after 5 seconds
      setTimeout(() => {
        setNewActivityCount(count => Math.max(0, count - 1));
      }, 5000);
      
      return updated;
    });
  };

  const getActivityIcon = (type: string, action: string) => {
    switch (type) {
      case 'enhancement':
        return <EditIcon color="primary" />;
      case 'export':
        return <DownloadIcon color="secondary" />;
      case 'rating':
        return <StarIcon color="warning" />;
      case 'system':
        return <SettingsIcon color="info" />;
      default:
        if (action.includes('created')) return <AddIcon color="success" />;
        if (action.includes('deleted')) return <DeleteIcon color="error" />;
        if (action.includes('updated')) return <EditIcon color="primary" />;
        if (action.includes('viewed')) return <ViewIcon color="info" />;
        return <PersonIcon color="action" />;
    }
  };

  const getActivityColor = (type: string): string => {
    switch (type) {
      case 'enhancement':
        return '#2196f3';
      case 'export':
        return '#9c27b0';
      case 'rating':
        return '#ff9800';
      case 'system':
        return '#607d8b';
      default:
        return '#4caf50';
    }
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = Date.now();
    const time = new Date(timestamp).getTime();
    const diff = now - time;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const formatResourceName = (resource: string, type: string): string => {
    if (type === 'export') return 'Export';
    if (resource.length > 20) return `${resource.substring(0, 20)}...`;
    return resource;
  };

  const handleRefresh = () => {
    setNewActivityCount(0);
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title="Live Activity"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {newActivityCount > 0 && (
              <Chip
                label={`${newActivityCount} new`}
                color="primary"
                size="small"
                variant="filled"
              />
            )}
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        }
        sx={{ pb: 1 }}
      />
      
      <CardContent sx={{ flex: 1, overflow: 'hidden', pt: 0 }}>
        {activities.length === 0 ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'text.secondary'
            }}
          >
            <PersonIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
            <Typography variant="body2">
              No recent activity
            </Typography>
          </Box>
        ) : (
          <List sx={{ height: '100%', overflow: 'auto', p: 0 }}>
            {activities.map((activity, index) => (
              <Fade key={activity.id} in={true} timeout={300}>
                <Box>
                  <ListItem
                    sx={{
                      px: 0,
                      py: 1,
                      '&:hover': {
                        backgroundColor: 'action.hover',
                        borderRadius: 1
                      }
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        sx={{
                          bgcolor: getActivityColor(activity.type),
                          width: 32,
                          height: 32
                        }}
                      >
                        {activity.type === 'system' ? (
                          getActivityIcon(activity.type, activity.action)
                        ) : (
                          activity.username.charAt(0).toUpperCase()
                        )}
                      </Avatar>
                    </ListItemAvatar>
                    
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" component="span">
                            <strong>{activity.username}</strong> {activity.action}
                          </Typography>
                          {getActivityIcon(activity.type, activity.action)}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="text.secondary">
                            {formatResourceName(activity.resource, activity.type)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatTimeAgo(activity.timestamp)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  
                  {index < activities.length - 1 && (
                    <Divider variant="inset" component="li" />
                  )}
                </Box>
              </Fade>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default RealTimeActivityFeed;