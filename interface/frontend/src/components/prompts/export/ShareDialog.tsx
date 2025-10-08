import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Divider,
  InputAdornment,
  Tooltip,
  Snackbar
} from '@mui/material';
import {
  Share as ShareIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Link as LinkIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../../hooks/redux';
import {
  closeShareDialog,
  createShareLink,
  fetchShareLinks,
  deleteShareLink
} from '../../../store/slices/exportSlice';

const ShareDialog: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    shareDialogOpen,
    selectedPromptIds,
    shareLinks,
    error
  } = useAppSelector((state) => state.export);

  const [expiresIn, setExpiresIn] = useState<number>(24); // hours
  const [maxAccess, setMaxAccess] = useState<number | ''>('');
  const [password, setPassword] = useState('');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const promptId = selectedPromptIds[0]; // Share dialog is for single prompts

  useEffect(() => {
    if (shareDialogOpen && promptId) {
      dispatch(fetchShareLinks(promptId));
    }
  }, [shareDialogOpen, promptId, dispatch]);

  const handleClose = () => {
    dispatch(closeShareDialog());
    setExpiresIn(24);
    setMaxAccess('');
    setPassword('');
    setIncludeMetadata(true);
    setShowPassword(false);
  };

  const handleCreateShareLink = () => {
    if (!promptId) return;

    dispatch(createShareLink({
      promptId,
      expiresIn: expiresIn > 0 ? expiresIn : undefined,
      maxAccess: maxAccess ? Number(maxAccess) : undefined,
      password: password || undefined,
      includeMetadata
    }));

    // Reset form
    setExpiresIn(24);
    setMaxAccess('');
    setPassword('');
    setIncludeMetadata(true);
  };

  const handleDeleteShareLink = (linkId: string) => {
    dispatch(deleteShareLink(linkId));
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const formatExpiryDate = (expiresAt: string) => {
    const date = new Date(expiresAt);
    const now = new Date();
    const diffHours = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      return 'Expires soon';
    } else if (diffHours < 24) {
      return `Expires in ${diffHours} hours`;
    } else {
      const diffDays = Math.ceil(diffHours / 24);
      return `Expires in ${diffDays} days`;
    }
  };

  const currentLinks = shareLinks.filter(link => link.promptId === promptId);

  return (
    <>
      <Dialog
        open={shareDialogOpen}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '600px' }
        }}
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Share Prompt</Typography>
            <Button
              onClick={handleClose}
              size="small"
              startIcon={<CloseIcon />}
            >
              Close
            </Button>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Create New Share Link */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Create Share Link
              </Typography>
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Expiration */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Link Expiration
                  </Typography>
                  <FormControl fullWidth>
                    <InputLabel>Expires In</InputLabel>
                    <Select
                      value={expiresIn}
                      label="Expires In"
                      onChange={(e) => setExpiresIn(Number(e.target.value))}
                    >
                      <MenuItem value={1}>1 Hour</MenuItem>
                      <MenuItem value={6}>6 Hours</MenuItem>
                      <MenuItem value={24}>24 Hours</MenuItem>
                      <MenuItem value={72}>3 Days</MenuItem>
                      <MenuItem value={168}>1 Week</MenuItem>
                      <MenuItem value={720}>30 Days</MenuItem>
                      <MenuItem value={0}>Never</MenuItem>
                    </Select>
                  </FormControl>
                </Box>

                {/* Access Limit */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Access Limit (Optional)
                  </Typography>
                  <TextField
                    fullWidth
                    type="number"
                    value={maxAccess}
                    onChange={(e) => setMaxAccess(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Unlimited"
                    helperText="Maximum number of times this link can be accessed"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <VisibilityIcon />
                        </InputAdornment>
                      )
                    }}
                  />
                </Box>

                {/* Password Protection */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Password Protection (Optional)
                  </Typography>
                  <TextField
                    fullWidth
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password to protect link"
                    helperText="Leave empty for public access"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SecurityIcon />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                  />
                </Box>

                {/* Include Options */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Share Options
                  </Typography>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={includeMetadata}
                        onChange={(e) => setIncludeMetadata(e.target.checked)}
                      />
                    }
                    label="Include prompt metadata (title, description, tags)"
                  />
                </Box>

                <Button
                  variant="contained"
                  startIcon={<ShareIcon />}
                  onClick={handleCreateShareLink}
                  disabled={!promptId}
                  fullWidth
                >
                  Create Share Link
                </Button>
              </Box>
            </Paper>

            {/* Existing Share Links */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Active Share Links ({currentLinks.length})
              </Typography>
              
              {currentLinks.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <LinkIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary">
                    No active share links for this prompt
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Create a share link above to allow others to access this prompt
                  </Typography>
                </Box>
              ) : (
                <List>
                  {currentLinks.map((link, index) => (
                    <React.Fragment key={link.id}>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                              <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                                {link.url}
                              </Typography>
                              <Tooltip title="Copy link">
                                <IconButton
                                  size="small"
                                  onClick={() => handleCopyLink(link.url)}
                                >
                                  <CopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                              <Chip
                                icon={<VisibilityIcon />}
                                label={`${link.accessCount} views`}
                                size="small"
                                variant="outlined"
                              />
                              {link.expiresAt && (
                                <Chip
                                  icon={<ScheduleIcon />}
                                  label={formatExpiryDate(link.expiresAt)}
                                  size="small"
                                  variant="outlined"
                                  color={new Date(link.expiresAt) < new Date() ? 'error' : 'default'}
                                />
                              )}
                              {link.maxAccess && (
                                <Chip
                                  label={`Max: ${link.maxAccess}`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                              {link.password && (
                                <Chip
                                  icon={<SecurityIcon />}
                                  label="Password protected"
                                  size="small"
                                  variant="outlined"
                                  color="primary"
                                />
                              )}
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title="Delete share link">
                            <IconButton
                              edge="end"
                              onClick={() => handleDeleteShareLink(link.id)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                      {index < currentLinks.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Paper>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            Share links allow others to view and download this prompt
          </Typography>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={copySuccess}
        autoHideDuration={3000}
        onClose={() => setCopySuccess(false)}
        message="Link copied to clipboard"
      />
    </>
  );
};

export default ShareDialog;