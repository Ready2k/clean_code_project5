import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  Avatar,
  Tooltip,
  Typography,
  Fade,
  Paper
} from '@mui/material';
import { Edit as EditIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { useWebSocket } from '../../hooks/useWebSocket';

interface ActiveEditor {
  userId: string;
  username: string;
  timestamp: string;
}

interface CollaborativeEditingIndicatorProps {
  promptId: string;
  isEditing?: boolean;
  onStartEditing?: () => void;
  onStopEditing?: () => void;
}

export const CollaborativeEditingIndicator: React.FC<CollaborativeEditingIndicatorProps> = ({
  promptId,
  isEditing = false,
  onStartEditing,
  onStopEditing
}) => {
  const { addEventListener, startEditing, stopEditing } = useWebSocket();
  const [activeEditors, setActiveEditors] = useState<ActiveEditor[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<Array<{
    userId: string;
    username: string;
    timestamp: string;
  }>>([]);

  useEffect(() => {
    // Listen for collaborative editing events
    const unsubscribeEditingStarted = addEventListener('prompt:editing:started', (data) => {
      if (data.promptId === promptId) {
        setActiveEditors(prev => {
          const existing = prev.find(editor => editor.userId === data.userId);
          if (existing) {
            return prev.map(editor => 
              editor.userId === data.userId 
                ? { ...editor, timestamp: data.timestamp }
                : editor
            );
          }
          return [...prev, {
            userId: data.userId,
            username: data.username,
            timestamp: data.timestamp
          }];
        });
      }
    });

    const unsubscribeEditingStopped = addEventListener('prompt:editing:stopped', (data) => {
      if (data.promptId === promptId) {
        setActiveEditors(prev => prev.filter(editor => editor.userId !== data.userId));
      }
    });

    const unsubscribePromptUpdated = addEventListener('prompt:updated', (data) => {
      if (data.promptId === promptId) {
        setRecentUpdates(prev => {
          const newUpdate = {
            userId: data.userId,
            username: data.username,
            timestamp: data.timestamp
          };
          
          // Keep only the last 3 updates and remove duplicates from same user
          const filtered = prev.filter(update => update.userId !== data.userId);
          return [newUpdate, ...filtered].slice(0, 3);
        });

        // Clear the update after 10 seconds
        setTimeout(() => {
          setRecentUpdates(prev => 
            prev.filter(update => update.timestamp !== data.timestamp)
          );
        }, 10000);
      }
    });

    return () => {
      unsubscribeEditingStarted();
      unsubscribeEditingStopped();
      unsubscribePromptUpdated();
    };
  }, [promptId, addEventListener]);

  useEffect(() => {
    // Notify when user starts/stops editing
    if (isEditing) {
      startEditing(promptId);
      if (onStartEditing) onStartEditing();
    } else {
      stopEditing(promptId);
      if (onStopEditing) onStopEditing();
    }

    // Cleanup on unmount
    return () => {
      if (isEditing) {
        stopEditing(promptId);
      }
    };
  }, [isEditing, promptId, startEditing, stopEditing, onStartEditing, onStopEditing]);

  // Clean up stale editors (older than 5 minutes)
  useEffect(() => {
    const interval = setInterval(() => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      setActiveEditors(prev => 
        prev.filter(editor => new Date(editor.timestamp).getTime() > fiveMinutesAgo)
      );
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const getAvatarColor = (userId: string): string => {
    const colors = [
      '#f44336', '#e91e63', '#9c27b0', '#673ab7',
      '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
      '#009688', '#4caf50', '#8bc34a', '#cddc39',
      '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'
    ];
    
    const hash = userId.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
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

  if (activeEditors.length === 0 && recentUpdates.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Active Editors */}
      {activeEditors.length > 0 && (
        <Fade in={true}>
          <Paper
            elevation={2}
            sx={{
              p: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              backgroundColor: 'warning.light',
              color: 'warning.contrastText',
              borderRadius: 2
            }}
          >
            <EditIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Currently editing:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {activeEditors.map((editor) => (
                <Tooltip
                  key={editor.userId}
                  title={`${editor.username} (${formatTimeAgo(editor.timestamp)})`}
                  arrow
                >
                  <Chip
                    avatar={
                      <Avatar
                        sx={{
                          bgcolor: getAvatarColor(editor.userId),
                          width: 24,
                          height: 24,
                          fontSize: '0.75rem'
                        }}
                      >
                        {editor.username.charAt(0).toUpperCase()}
                      </Avatar>
                    }
                    label={editor.username}
                    size="small"
                    variant="outlined"
                    sx={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      color: 'text.primary',
                      '& .MuiChip-avatar': {
                        marginLeft: 0.5
                      }
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Paper>
        </Fade>
      )}

      {/* Recent Updates */}
      {recentUpdates.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {recentUpdates.map((update, index) => (
            <Fade key={`${update.userId}-${update.timestamp}`} in={true}>
              <Paper
                elevation={1}
                sx={{
                  p: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  backgroundColor: 'info.light',
                  color: 'info.contrastText',
                  borderRadius: 1,
                  opacity: 1 - (index * 0.2) // Fade older updates
                }}
              >
                <ViewIcon fontSize="small" />
                <Typography variant="body2">
                  <strong>{update.username}</strong> updated this prompt
                </Typography>
                <Typography variant="caption" sx={{ ml: 'auto', opacity: 0.8 }}>
                  {formatTimeAgo(update.timestamp)}
                </Typography>
              </Paper>
            </Fade>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default CollaborativeEditingIndicator;