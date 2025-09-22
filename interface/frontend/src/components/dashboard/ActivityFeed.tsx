import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  Box,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  CloudUpload as CloudUploadIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  type: 'prompt_created' | 'prompt_updated' | 'prompt_deleted' | 'prompt_rated' | 'connection_added' | 'system_updated';
  user: string;
  description: string;
  timestamp: string;
  metadata?: {
    promptTitle?: string;
    rating?: number;
    connectionName?: string;
  };
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  isLoading?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  activities,
  isLoading = false,
}) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'prompt_created':
        return <AddIcon />;
      case 'prompt_updated':
        return <EditIcon />;
      case 'prompt_deleted':
        return <DeleteIcon />;
      case 'prompt_rated':
        return <StarIcon />;
      case 'connection_added':
        return <CloudUploadIcon />;
      case 'system_updated':
        return <SettingsIcon />;
      default:
        return <AddIcon />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'prompt_created':
        return 'success';
      case 'prompt_updated':
        return 'info';
      case 'prompt_deleted':
        return 'error';
      case 'prompt_rated':
        return 'warning';
      case 'connection_added':
        return 'primary';
      case 'system_updated':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const formatActivityDescription = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'prompt_created':
        return `Created prompt "${activity.metadata?.promptTitle}"`;
      case 'prompt_updated':
        return `Updated prompt "${activity.metadata?.promptTitle}"`;
      case 'prompt_deleted':
        return `Deleted prompt "${activity.metadata?.promptTitle}"`;
      case 'prompt_rated':
        return `Rated prompt "${activity.metadata?.promptTitle}" (${activity.metadata?.rating}/5)`;
      case 'connection_added':
        return `Added connection "${activity.metadata?.connectionName}"`;
      case 'system_updated':
        return activity.description;
      default:
        return activity.description;
    }
  };

  // Mock data for demonstration if no activities provided
  const mockActivities: ActivityItem[] = [
    {
      id: '1',
      type: 'prompt_created',
      user: 'john.doe',
      description: 'Created new prompt',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
      metadata: { promptTitle: 'Customer Support Assistant' },
    },
    {
      id: '2',
      type: 'prompt_rated',
      user: 'jane.smith',
      description: 'Rated prompt',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      metadata: { promptTitle: 'Code Review Helper', rating: 5 },
    },
    {
      id: '3',
      type: 'connection_added',
      user: 'admin',
      description: 'Added new connection',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
      metadata: { connectionName: 'OpenAI GPT-4' },
    },
    {
      id: '4',
      type: 'prompt_updated',
      user: 'bob.wilson',
      description: 'Updated prompt',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
      metadata: { promptTitle: 'Data Analysis Assistant' },
    },
  ];

  const displayActivities = activities.length > 0 ? activities : mockActivities;

  return (
    <Card>
      <CardHeader
        title="Recent Activity"
        action={
          <Chip
            label={`${displayActivities.length} items`}
            size="small"
            variant="outlined"
          />
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <Typography color="textSecondary">Loading activities...</Typography>
          </Box>
        ) : displayActivities.length > 0 ? (
          <List disablePadding>
            {displayActivities.slice(0, 8).map((activity, index) => (
              <React.Fragment key={activity.id}>
                <ListItem disableGutters>
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: `${getActivityColor(activity.type)}.main`,
                        width: 32,
                        height: 32,
                      }}
                    >
                      {getActivityIcon(activity.type)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" component="span">
                          <strong>{activity.user}</strong>
                        </Typography>
                        <Typography variant="body2" component="span" color="textSecondary">
                          {formatActivityDescription(activity)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="textSecondary">
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </Typography>
                    }
                  />
                </ListItem>
                {index < displayActivities.length - 1 && <Divider variant="inset" component="li" />}
              </React.Fragment>
            ))}
          </List>
        ) : (
          <Typography color="textSecondary" textAlign="center" py={2}>
            No recent activity
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};