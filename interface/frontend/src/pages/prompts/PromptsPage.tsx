import React from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Pagination,
  CircularProgress,
  Alert,
  Fab,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Badge,
  Select,
  MenuItem,
  FormControlLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  GetApp as ExportIcon,
  History as HistoryIcon,
  CheckBox as SelectIcon,
  Upload as ImportIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  fetchPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  setFilters,
  clearFilters,
  loadMorePrompts,
} from '../../store/slices/promptsSlice';
import {
  openExportDialog,
  openBulkExportDialog,
  openShareDialog,
  openHistoryDialog,
  setSelectedPromptIds,
  addToSelection,
  removeFromSelection,
  clearSelection,
} from '../../store/slices/exportSlice';
import {
  PromptCard,
  PromptFilters,
  PromptCreationWizard,
  PromptDetailView,
  PromptEditor,
  MultiProviderRendererDialog,
  ImportDialog,
} from '../../components/prompts';
import { EnhancementWorkflowDialog } from '../../components/prompts/EnhancementWorkflowDialog';
import { RatingFilters, RatingComparison } from '../../components/prompts/rating';
import {
  ExportDialog,
  BulkExportDialog,
  ShareDialog,
  ExportHistoryDialog
} from '../../components/prompts/export';
import ExportProgressTracker from '../../components/prompts/export/ExportProgressTracker';
import { PromptRecord, CreatePromptRequest, UpdatePromptRequest } from '../../types/prompts';
import { promptsAPI } from '../../services/api/promptsAPI';

export const PromptsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    items: prompts,
    filters,
    isLoading,
    error,
    pagination,
  } = useAppSelector((state) => state.prompts);

  const [selectedPrompt, setSelectedPrompt] = React.useState<PromptRecord | null>(null);
  const [currentTab, setCurrentTab] = React.useState(0);
  const [showCreateWizard, setShowCreateWizard] = React.useState(false);
  const [showDetailView, setShowDetailView] = React.useState(false);
  const [showEditor, setShowEditor] = React.useState(false);
  const [showEnhancementWorkflow, setShowEnhancementWorkflow] = React.useState(false);
  const [showRenderer, setShowRenderer] = React.useState(false);
  const [showComparison, setShowComparison] = React.useState(false);
  const [showImportDialog, setShowImportDialog] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [promptToDelete, setPromptToDelete] = React.useState<PromptRecord | null>(null);
  const [ratingFilters, setRatingFilters] = React.useState<any>({});
  const [showRatingFilters, setShowRatingFilters] = React.useState(false);
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Export state
  const { selectedPromptIds } = useAppSelector((state) => state.export);

  // Check if a prompt is a variant
  const isVariantPrompt = React.useCallback((prompt: PromptRecord) => {
    if (!prompt.metadata?.tags) return false;

    // Check for provider-model tags (e.g., "openai-gpt-3.5-turbo", "anthropic-claude-3-sonnet")
    const hasProviderModelTag = prompt.metadata.tags.some(tag => {
      const lowerTag = tag.toLowerCase();
      return (
        (lowerTag.startsWith('openai-') && lowerTag.includes('gpt')) ||
        (lowerTag.startsWith('anthropic-') && lowerTag.includes('claude')) ||
        (lowerTag.startsWith('meta-') && lowerTag.includes('llama')) ||
        (lowerTag.startsWith('microsoft-copilot-') && (lowerTag.includes('gpt') || lowerTag.includes('copilot'))) ||
        lowerTag === 'enhanced' ||
        lowerTag.includes('variant')
      );
    });

    // Also check metadata for variant indicators
    const hasTunedProvider = !!(prompt.metadata as any)?.tuned_for_provider;
    const hasVariantOf = !!(prompt.metadata as any)?.variant_of;
    const titleIndicatesVariant = prompt.metadata.title?.includes('Enhanced') ||
      prompt.metadata.title?.includes('(') ||
      prompt.metadata.summary?.includes('Enhanced using') ||
      prompt.metadata.summary?.includes('Optimized for');

    return hasProviderModelTag || hasTunedProvider || hasVariantOf || titleIndicatesVariant;
  }, []);

  // Filter prompts based on current tab
  const filteredPrompts = React.useMemo(() => {
    if (!prompts) return [];

    switch (currentTab) {
      case 0: // All Prompts
        return prompts.filter(prompt => !isVariantPrompt(prompt));
      case 1: // Variants
        return prompts.filter(prompt => isVariantPrompt(prompt));
      default:
        return prompts;
    }
  }, [prompts, currentTab, isVariantPrompt]);

  // Track if variants tab has been viewed
  const [hasViewedVariants, setHasViewedVariants] = React.useState(false);

  // Count variants for badge
  const variantCount = React.useMemo(() => {
    return (prompts || []).filter(prompt => isVariantPrompt(prompt)).length;
  }, [prompts, isVariantPrompt]);

  // Show badge only if there are variants and user hasn't viewed the variants tab
  const showVariantBadge = variantCount > 0 && !hasViewedVariants;

  // Derived data for filters
  const availableTags = React.useMemo(() => {
    const tags = new Set<string>();
    filteredPrompts.forEach(prompt => {
      prompt.metadata?.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [filteredPrompts]);

  const availableOwners = React.useMemo(() => {
    const owners = new Set<string>();
    filteredPrompts.forEach(prompt => {
      if (prompt.metadata?.owner) {
        owners.add(prompt.metadata.owner);
      }
    });
    return Array.from(owners).sort();
  }, [filteredPrompts]);

  // Initialize WebSocket for real-time updates
  const { addEventListener } = useWebSocket();

  // Load prompts on mount and when filters change
  React.useEffect(() => {
    dispatch(fetchPrompts(filters));
  }, [dispatch, filters]);

  // Listen for enhancement completion to refresh prompts list
  React.useEffect(() => {
    const unsubscribe = addEventListener('enhancement:completed', (data) => {
      console.log('Enhancement completed event received:', data);
      // Refresh prompts list when enhancement completes (variant may have been created)
      dispatch(fetchPrompts(filters));
    });

    return unsubscribe;
  }, [addEventListener, dispatch, filters]);

  // Also listen for general progress events
  React.useEffect(() => {
    const unsubscribe = addEventListener('enhancement:progress', (data) => {
      console.log('Enhancement progress event received:', data);
      if (data.status === 'completed') {
        // Refresh prompts list when enhancement completes
        setTimeout(() => {
          dispatch(fetchPrompts(filters));
        }, 1000); // Small delay to ensure variant is saved
      }
    });

    return unsubscribe;
  }, [addEventListener, dispatch, filters]);

  const handleFiltersChange = (newFilters: Partial<typeof filters>) => {
    dispatch(setFilters({ ...newFilters, page: 1 }));
  };

  const handleClearFilters = () => {
    dispatch(clearFilters());
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    dispatch(setFilters({ page }));
  };

  const handleLoadMore = () => {
    const nextPage = pagination.page + 1;
    // Update filters to reflect the new page
    dispatch(setFilters({ page: nextPage }));
    // Load more prompts with the updated page
    dispatch(loadMorePrompts({ ...filters, page: nextPage }));
  };

  const handleRefresh = () => {
    console.log('Manual refresh triggered');
    dispatch(fetchPrompts(filters));
  };

  const handleCreatePrompt = async (data: CreatePromptRequest) => {
    try {
      await dispatch(createPrompt(data)).unwrap();
      setSnackbar({
        open: true,
        message: 'Prompt created successfully!',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to create prompt',
        severity: 'error',
      });
    }
  };

  const handleUpdatePrompt = async (id: string, data: UpdatePromptRequest) => {
    try {
      await dispatch(updatePrompt({ id, data })).unwrap();
      setSnackbar({
        open: true,
        message: 'Prompt updated successfully!',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to update prompt',
        severity: 'error',
      });
    }
  };

  const handleDeletePrompt = async (prompt: PromptRecord) => {
    setPromptToDelete(prompt);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!promptToDelete) return;

    try {
      await dispatch(deletePrompt(promptToDelete.id)).unwrap();
      setSnackbar({
        open: true,
        message: 'Prompt deleted successfully!',
        severity: 'success',
      });
      setDeleteDialogOpen(false);
      setPromptToDelete(null);
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to delete prompt',
        severity: 'error',
      });
    }
  };

  const handleViewPrompt = (prompt: PromptRecord) => {
    setSelectedPrompt(prompt);
    setShowDetailView(true);
  };

  const handleEditPrompt = (prompt: PromptRecord) => {
    setSelectedPrompt(prompt);
    setShowEditor(true);
  };

  const handleRenderPrompt = (prompt: PromptRecord) => {
    setSelectedPrompt(prompt);
    setShowRenderer(true);
  };

  const handleEnhancePrompt = (prompt: PromptRecord) => {
    setSelectedPrompt(prompt);
    setShowEnhancementWorkflow(true);
  };

  const handleEnhancementApprove = async (promptId: string, enhancementResult: any) => {
    try {
      // Find the current prompt to get the original human prompt
      const currentPrompt = (prompts || []).find(p => p.id === promptId);
      if (!currentPrompt) {
        throw new Error('Prompt not found');
      }

      // Apply the enhancement by updating the prompt with enhanced data
      // For now, we'll enhance the human prompt with insights from the structured prompt
      const enhancedHumanPrompt = {
        ...currentPrompt.humanPrompt,
        // Enhance the goal with system instructions if available
        goal: enhancementResult.structuredPrompt?.system?.length > 0
          ? `${currentPrompt.humanPrompt.goal}\n\nEnhanced context: ${enhancementResult.structuredPrompt.system[0]}`
          : currentPrompt.humanPrompt.goal,
        // Add any new steps from the structured template
        steps: [
          ...currentPrompt.humanPrompt.steps,
          ...(enhancementResult.changes_made || []).map((change: string) => `Enhanced: ${change}`)
        ]
      };

      const updateData: UpdatePromptRequest = {
        humanPrompt: enhancedHumanPrompt,
        // Add variables extracted from the structured prompt
        variables: enhancementResult.structuredPrompt?.variables?.map((varName: string) => ({
          key: varName,
          label: varName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          type: 'string' as const,
          required: true,
          sensitive: false
        })) || currentPrompt.variables
      };

      await dispatch(updatePrompt({ id: promptId, data: updateData })).unwrap();

      setSnackbar({
        open: true,
        message: 'Enhancement applied successfully!',
        severity: 'success',
      });
    } catch (error) {
      console.error('Enhancement application error:', error);
      setSnackbar({
        open: true,
        message: 'Failed to apply enhancement',
        severity: 'error',
      });
    }
  };

  const handleSharePrompt = (prompt: PromptRecord) => {
    dispatch(openShareDialog(prompt.id));
  };

  const handleExportPrompt = (prompt: PromptRecord) => {
    dispatch(openExportDialog(prompt.id));
  };

  const handleBulkExport = () => {
    if (selectedPromptIds.length === 0) {
      setSnackbar({
        open: true,
        message: 'Please select prompts to export',
        severity: 'warning',
      });
      return;
    }
    dispatch(openBulkExportDialog(selectedPromptIds));
  };

  const handleExportHistory = () => {
    dispatch(openHistoryDialog());
  };

  const handleToggleSelection = () => {
    if (selectionMode) {
      dispatch(clearSelection());
      setSelectionMode(false);
    } else {
      setSelectionMode(true);
    }
  };

  const handlePromptSelection = (promptId: string, selected: boolean) => {
    if (selected) {
      dispatch(addToSelection(promptId));
    } else {
      dispatch(removeFromSelection(promptId));
    }
  };

  const handleSelectAll = () => {
    const allPromptIds = filteredPrompts.map(p => p.id);
    dispatch(setSelectedPromptIds(allPromptIds));
  };

  const handleDeselectAll = () => {
    dispatch(clearSelection());
  };

  const handleRatePrompt = async (promptId: string, rating: { score: number; note?: string }) => {
    try {
      await promptsAPI.ratePrompt(promptId, rating);
      // Refresh the current prompt to get updated ratings
      dispatch(fetchPrompts(filters));

      // Update the selected prompt with fresh data
      if (selectedPrompt && selectedPrompt.id === promptId) {
        try {
          const updatedPrompt = await promptsAPI.getPrompt(promptId);
          setSelectedPrompt(updatedPrompt);
        } catch (error) {
          console.error('Failed to refresh selected prompt:', error);
        }
      }

      setSnackbar({
        open: true,
        message: 'Rating submitted successfully!',
        severity: 'success',
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to submit rating',
        severity: 'error',
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <Box>
      {/* Header */}
      <Box mb={3}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Prompt Library
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage and organize your AI prompts
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateWizard(true)}
            size="large"
          >
            Create Prompt
          </Button>
        </Box>

        {/* Toolbar */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={2}
          p={2}
          bgcolor="background.paper"
          borderRadius={1}
          border={1}
          borderColor="divider"
        >
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" color="text.secondary">
                Per page:
              </Typography>
              <Select
                size="small"
                value={filters.limit || 50}
                onChange={(e) => dispatch(setFilters({ limit: Number(e.target.value), page: 1 }))}
                sx={{ minWidth: 80 }}
              >
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
                <MenuItem value={200}>200</MenuItem>
              </Select>
            </Box>

            <Button
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={isLoading}
              variant="outlined"
              size="small"
            >
              Refresh
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowComparison(true)}
            >
              Compare Ratings
            </Button>
          </Box>

          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<SelectIcon />}
              onClick={handleToggleSelection}
              color={selectionMode ? 'primary' : 'inherit'}
              size="small"
            >
              {selectionMode ? 'Exit Selection' : 'Select'}
            </Button>

            {selectionMode && (
              <>
                <Button
                  size="small"
                  onClick={handleSelectAll}
                  disabled={selectedPromptIds.length === filteredPrompts.length}
                >
                  All
                </Button>
                <Button
                  size="small"
                  onClick={handleDeselectAll}
                  disabled={selectedPromptIds.length === 0}
                >
                  None
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<ExportIcon />}
                  onClick={handleBulkExport}
                  disabled={selectedPromptIds.length === 0}
                  size="small"
                >
                  Export ({selectedPromptIds.length})
                </Button>
              </>
            )}

            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={handleExportHistory}
              size="small"
            >
              History
            </Button>

            <Button
              variant="outlined"
              startIcon={<ImportIcon />}
              onClick={() => setShowImportDialog(true)}
              size="small"
            >
              Import
            </Button>
          </Box>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={currentTab} onChange={(_, newValue) => {
          setCurrentTab(newValue);
          // Mark variants as viewed when user clicks on variants tab
          if (newValue === 1) {
            setHasViewedVariants(true);
          }
        }}>
          <Tab label="All Prompts" />
          <Tab
            label={
              <Badge badgeContent={showVariantBadge ? variantCount : 0} color="primary" showZero={false}>
                Variants
              </Badge>
            }
          />
        </Tabs>
      </Box>

      {/* Filters */}
      <PromptFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        availableTags={availableTags}
        availableOwners={availableOwners}
      />

      {/* Rating Filters */}
      <RatingFilters
        filters={ratingFilters}
        onFiltersChange={setRatingFilters}
        expanded={showRatingFilters}
        onExpandedChange={setShowRatingFilters}
      />

      {/* Export Progress Tracker */}
      <ExportProgressTracker compact />

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty State */}
      {!isLoading && filteredPrompts.length === 0 && !error && (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          py={8}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {currentTab === 0 ? 'No prompts found' : 'No variants found'}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {currentTab === 1
              ? 'No variants have been created yet. Render a prompt with different LLMs and save successful adaptations as variants.'
              : filters.search || filters.tags?.length || filters.status?.length
                ? 'Try adjusting your filters or create a new prompt.'
                : 'Get started by creating your first prompt.'
            }
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateWizard(true)}
          >
            Create Your First Prompt
          </Button>
        </Box>
      )}

      {/* Prompts Grid */}
      {!isLoading && filteredPrompts.length > 0 && (
        <>
          <Grid container spacing={3}>
            {filteredPrompts.map((prompt) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={prompt.id}>
                <PromptCard
                  prompt={prompt}
                  onView={handleViewPrompt}
                  onEdit={handleEditPrompt}
                  onDelete={handleDeletePrompt}
                  onRender={handleRenderPrompt}
                  onEnhance={handleEnhancePrompt}
                  onShare={handleSharePrompt}
                  onExport={handleExportPrompt}
                  selectionMode={selectionMode}
                  selected={selectedPromptIds.includes(prompt.id)}
                  onSelectionChange={(selected) => handlePromptSelection(prompt.id, selected)}
                />
              </Grid>
            ))}
          </Grid>

          {/* Pagination Controls */}
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            mt={4}
            gap={3}
            p={3}
            bgcolor="background.paper"
            borderRadius={1}
            border={1}
            borderColor="divider"
          >
            {/* Results Summary */}
            <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
              <Typography variant="body2" color="text.secondary">
                Showing {filteredPrompts.length} of {pagination.total} prompts
              </Typography>
              {pagination.totalPages > 1 && (
                <Typography variant="body2" color="text.secondary">
                  • Page {pagination.page} of {pagination.totalPages}
                </Typography>
              )}
            </Box>

            {/* Load More Button */}
            {pagination.hasNextPage && (
              <Button
                variant="contained"
                size="large"
                onClick={handleLoadMore}
                disabled={isLoading}
                sx={{
                  minWidth: 200,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontSize: '1rem'
                }}
              >
                {isLoading ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Loading more prompts...
                  </>
                ) : (
                  `Load More Prompts (${pagination.total - filteredPrompts.length} remaining)`
                )}
              </Button>
            )}

            {/* Traditional Pagination */}
            {pagination.totalPages > 1 && (
              <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
                <Typography variant="caption" color="text.secondary">
                  Or jump to a specific page:
                </Typography>
                <Pagination
                  count={pagination.totalPages}
                  page={pagination.page}
                  onChange={handlePageChange}
                  color="primary"
                  size="medium"
                  showFirstButton
                  showLastButton
                  siblingCount={1}
                  boundaryCount={1}
                />
              </Box>
            )}

            {/* No More Results */}
            {!pagination.hasNextPage && pagination.total > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                You've reached the end! All {pagination.total} prompts are displayed.
              </Typography>
            )}
          </Box>
        </>
      )}

      {/* Floating Action Button for Mobile */}
      <Fab
        color="primary"
        aria-label="create prompt"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          display: { xs: 'flex', sm: 'none' },
        }}
        onClick={() => setShowCreateWizard(true)}
      >
        <AddIcon />
      </Fab>

      {/* Dialogs */}
      <PromptCreationWizard
        open={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
        onSubmit={handleCreatePrompt}
        isLoading={isLoading}
      />

      <PromptDetailView
        open={showDetailView}
        prompt={selectedPrompt}
        onClose={() => {
          setShowDetailView(false);
          setSelectedPrompt(null);
        }}
        onEdit={handleEditPrompt}
        onRender={handleRenderPrompt}
        onEnhance={handleEnhancePrompt}
        onShare={handleSharePrompt}
        onRate={handleRatePrompt}
      />

      <PromptEditor
        open={showEditor}
        prompt={selectedPrompt}
        onClose={() => {
          setShowEditor(false);
          setSelectedPrompt(null);
        }}
        onSave={handleUpdatePrompt}
        isLoading={isLoading}
      />

      <EnhancementWorkflowDialog
        open={showEnhancementWorkflow}
        prompt={selectedPrompt}
        onClose={() => {
          setShowEnhancementWorkflow(false);
          setSelectedPrompt(null);
        }}
        onApprove={handleEnhancementApprove}
      />

      <MultiProviderRendererDialog
        open={showRenderer}
        prompt={selectedPrompt}
        onClose={() => {
          setShowRenderer(false);
          setSelectedPrompt(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Prompt</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{promptToDelete?.metadata.title}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rating Comparison Dialog */}
      <Dialog
        open={showComparison}
        onClose={() => setShowComparison(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: { height: '90vh' }
        }}
      >
        <DialogTitle>Rating Comparison</DialogTitle>
        <DialogContent>
          <RatingComparison
            availablePrompts={(prompts || []).map(prompt => ({
              promptId: prompt.id,
              title: prompt.metadata.title,
              averageScore: prompt.averageRating || 0,
              totalRatings: prompt.ratings?.length || 0,
              scoreDistribution: (prompt.ratings || []).reduce((acc, rating) => {
                acc[rating.score] = (acc[rating.score] || 0) + 1;
                return acc;
              }, {} as Record<number, number>),
              tags: prompt.metadata.tags,
              category: prompt.metadata.category,
              owner: prompt.metadata.owner,
              createdAt: prompt.createdAt,
            }))}
            onLoadPromptData={async (promptId) => {
              const analytics = await promptsAPI.getPromptRatingAnalytics(promptId);
              const prompt = (prompts || []).find(p => p.id === promptId);
              if (!prompt) throw new Error('Prompt not found');

              return {
                promptId: prompt.id,
                title: prompt.metadata.title,
                averageScore: analytics.analytics.averageScore,
                totalRatings: analytics.analytics.totalRatings,
                scoreDistribution: analytics.analytics.scoreDistribution,
                tags: prompt.metadata.tags,
                category: prompt.metadata.category,
                owner: prompt.metadata.owner,
                createdAt: prompt.createdAt,
              };
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowComparison(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <ImportDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />

      {/* Export Dialogs */}
      <ExportDialog promptId={selectedPrompt?.id} />
      <BulkExportDialog />
      <ShareDialog />
      <ExportHistoryDialog />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};