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
  Switch,
  FormControlLabel,
  Tooltip,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  GetApp as ExportIcon,
  History as HistoryIcon,
  CheckBox as SelectIcon,
  Upload as ImportIcon,
  ViewModule as CardViewIcon,
  ViewList as ListViewIcon,
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
  PromptFilters,
  PromptCreationWizard,
  PromptDetailView,
  PromptEditor,
  MultiProviderRendererDialog,
  ImportDialog,
} from '../../components/prompts';
import { EnhancedPromptCard } from '../../components/prompts/EnhancedPromptCard';
import { QuickRenderDialog } from '../../components/prompts/QuickRenderDialog';
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

interface GroupedPrompt {
  basePrompt: PromptRecord;
  variants: PromptRecord[];
}

export const EnhancedPromptsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const {
    items: prompts,
    filters,
    isLoading,
    error,
    pagination,
  } = useAppSelector((state) => state.prompts);

  const [selectedPrompt, setSelectedPrompt] = React.useState<PromptRecord | null>(null);
  const [selectedVariant, setSelectedVariant] = React.useState<PromptRecord | null>(null);
  const [showCreateWizard, setShowCreateWizard] = React.useState(false);
  const [showDetailView, setShowDetailView] = React.useState(false);
  const [showEditor, setShowEditor] = React.useState(false);
  const [showEnhancementWorkflow, setShowEnhancementWorkflow] = React.useState(false);
  const [showRenderer, setShowRenderer] = React.useState(false);
  const [showQuickRender, setShowQuickRender] = React.useState(false);
  const [showComparison, setShowComparison] = React.useState(false);
  const [showImportDialog, setShowImportDialog] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [promptToDelete, setPromptToDelete] = React.useState<PromptRecord | null>(null);
  const [ratingFilters, setRatingFilters] = React.useState<any>({});
  const [showRatingFilters, setShowRatingFilters] = React.useState(false);
  const [selectionMode, setSelectionMode] = React.useState(false);
  const [showVariantsInline, setShowVariantsInline] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<'card' | 'list'>('card');
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

  // Group prompts with their variants
  const groupedPrompts = React.useMemo(() => {
    if (!prompts) return [];

    const groups: GroupedPrompt[] = [];
    const processedIds = new Set<string>();

    // Helper function to check if a prompt is a variant
    const isVariantPrompt = (prompt: PromptRecord) => {
      if (!prompt.metadata?.tags) return false;

      const hasProviderModelTag = prompt.metadata.tags.some(tag => {
        const lowerTag = tag.toLowerCase();
        return (
          (lowerTag.startsWith('openai-') && lowerTag.includes('gpt')) ||
          (lowerTag.startsWith('anthropic-') && lowerTag.includes('claude')) ||
          (lowerTag.startsWith('meta-') && lowerTag.includes('llama')) ||
          lowerTag === 'enhanced' ||
          lowerTag.includes('variant')
        );
      });

      const hasTunedProvider = !!(prompt.metadata as any)?.tuned_for_provider;
      const hasVariantOf = !!(prompt.metadata as any)?.variant_of;
      const titleIndicatesVariant = prompt.metadata.title?.includes('Enhanced') ||
        prompt.metadata.title?.includes('(') ||
        prompt.metadata.summary?.includes('Enhanced using') ||
        prompt.metadata.summary?.includes('Optimized for');

      return hasProviderModelTag || hasTunedProvider || hasVariantOf || titleIndicatesVariant;
    };

    // Helper function to find base prompt name from variant
    const getBasePromptName = (variantPrompt: PromptRecord): string => {
      let baseName = variantPrompt.metadata.title;

      // Remove common variant indicators
      baseName = baseName.replace(/\s*\([^)]*\)\s*/g, ''); // Remove parentheses content
      baseName = baseName.replace(/\s*Enhanced\s*/gi, ''); // Remove "Enhanced"
      baseName = baseName.replace(/\s*-\s*Optimized for.*$/gi, ''); // Remove optimization text

      return baseName.trim();
    };

    // First pass: identify base prompts
    const basePrompts = prompts.filter(prompt => !isVariantPrompt(prompt));

    // Second pass: group variants with base prompts
    basePrompts.forEach(basePrompt => {
      if (processedIds.has(basePrompt.id)) return;

      const variants = prompts.filter(prompt => {
        if (prompt.id === basePrompt.id || processedIds.has(prompt.id)) return false;
        if (!isVariantPrompt(prompt)) return false;

        // Check if this variant belongs to this base prompt
        const variantBaseName = getBasePromptName(prompt);
        const basePromptName = basePrompt.metadata.title;

        // Match by name similarity or explicit variant_of field
        const nameMatch = variantBaseName.toLowerCase() === basePromptName.toLowerCase();
        const explicitMatch = (prompt.metadata as any)?.variant_of === basePrompt.id;

        return nameMatch || explicitMatch;
      });

      groups.push({
        basePrompt,
        variants: variants.sort((a, b) => {
          // Sort variants by rating (highest first), then by creation date
          const ratingDiff = (b.averageRating || 0) - (a.averageRating || 0);
          if (ratingDiff !== 0) return ratingDiff;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
      });

      processedIds.add(basePrompt.id);
      variants.forEach(v => processedIds.add(v.id));
    });

    // Third pass: handle orphaned variants (variants without clear base prompts)
    const orphanedVariants = prompts.filter(prompt =>
      isVariantPrompt(prompt) && !processedIds.has(prompt.id)
    );

    orphanedVariants.forEach(variant => {
      groups.push({
        basePrompt: variant,
        variants: []
      });
      processedIds.add(variant.id);
    });

    return groups.sort((a, b) => {
      // Sort groups by base prompt update date
      return new Date(b.basePrompt.updatedAt).getTime() - new Date(a.basePrompt.updatedAt).getTime();
    });
  }, [prompts]);

  // Derived data for filters
  const availableTags = React.useMemo(() => {
    const tags = new Set<string>();
    groupedPrompts.forEach((group: any) => {
      group.basePrompt.metadata?.tags?.forEach((tag: string) => tags.add(tag));
      group.variants.forEach((variant: any) => {
        variant.metadata?.tags?.forEach((tag: string) => tags.add(tag));
      });
    });
    return Array.from(tags).sort();
  }, [groupedPrompts]);

  const availableOwners = React.useMemo(() => {
    const owners = new Set<string>();
    groupedPrompts.forEach((group: any) => {
      if (group.basePrompt.metadata?.owner) {
        owners.add(group.basePrompt.metadata.owner);
      }
      group.variants.forEach((variant: any) => {
        if (variant.metadata?.owner) {
          owners.add(variant.metadata.owner);
        }
      });
    });
    return Array.from(owners).sort();
  }, [groupedPrompts]);

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
      dispatch(fetchPrompts(filters));
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

  const handleQuickRender = (prompt: PromptRecord, variant?: PromptRecord) => {
    setSelectedPrompt(prompt);
    setSelectedVariant(variant || null);
    setShowQuickRender(true);
  };

  const handleQuickRenderExecute = async (prompt: PromptRecord, variant?: PromptRecord, variables?: Record<string, any>) => {
    try {
      // Close the quick render dialog
      setShowQuickRender(false);

      // Show the advanced renderer with the selected prompt and variant
      setSelectedPrompt(prompt);
      setShowRenderer(true);

      // Show info message
      setSnackbar({
        open: true,
        message: `Opening renderer for ${variant ? `${variant.metadata.title}` : prompt.metadata.title}...`,
        severity: 'info',
      });

    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to open renderer',
        severity: 'error',
      });
    }
  };

  const handleEnhancePrompt = (prompt: PromptRecord) => {
    setSelectedPrompt(prompt);
    setShowEnhancementWorkflow(true);
  };

  const handleSharePrompt = (prompt: PromptRecord) => {
    dispatch(openShareDialog(prompt.id));
  };

  const handleExportPrompt = (prompt: PromptRecord) => {
    dispatch(openExportDialog(prompt.id));
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

  const handleCloseSnackbar = () => {
    setSnackbar((prev: any) => ({ ...prev, open: false }));
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
              Manage and organize your AI prompts with variants
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
            
            <FormControlLabel
              control={
                <Switch
                  checked={showVariantsInline}
                  onChange={(e) => setShowVariantsInline(e.target.checked)}
                  size="small"
                />
              }
              label="Show Variants Inline"
            />
            
            <Tooltip title={viewMode === 'card' ? 'Switch to List View' : 'Switch to Card View'}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setViewMode(viewMode === 'card' ? 'list' : 'card')}
                startIcon={viewMode === 'card' ? <ListViewIcon /> : <CardViewIcon />}
              >
                {viewMode === 'card' ? 'List' : 'Cards'}
              </Button>
            </Tooltip>
            
            <Button
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={isLoading}
              variant="outlined"
              size="small"
            >
              Refresh
            </Button>
          </Box>

          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowComparison(true)}
            >
              Compare Ratings
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<SelectIcon />}
              onClick={handleToggleSelection}
              color={selectionMode ? 'primary' : 'inherit'}
              size="small"
            >
              {selectionMode ? 'Exit Selection' : 'Select'}
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
      {!isLoading && groupedPrompts.length === 0 && !error && (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          py={8}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No prompts found
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {filters.search || filters.tags?.length || filters.status?.length
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
      {!isLoading && groupedPrompts.length > 0 && (
        <>
          <Grid container spacing={3}>
            {groupedPrompts.map((group: any) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={group.basePrompt.id}>
                <EnhancedPromptCard
                  prompt={group.basePrompt}
                  variants={showVariantsInline ? group.variants : []}
                  onView={handleViewPrompt}
                  onEdit={handleEditPrompt}
                  onDelete={handleDeletePrompt}
                  onRender={handleRenderPrompt}
                  onQuickRender={handleQuickRender}
                  onEnhance={handleEnhancePrompt}
                  onShare={handleSharePrompt}
                  onExport={handleExportPrompt}
                  selectionMode={selectionMode}
                  selected={selectedPromptIds.includes(group.basePrompt.id)}
                  onSelectionChange={(selected: boolean) => handlePromptSelection(group.basePrompt.id, selected)}
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
                Showing {groupedPrompts.length} prompt groups of {pagination.total} total prompts
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
                  `Load More Prompts (${pagination.total - groupedPrompts.length} remaining)`
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
      />

      <MultiProviderRendererDialog
        open={showRenderer}
        prompt={selectedPrompt}
        onClose={() => {
          setShowRenderer(false);
          setSelectedPrompt(null);
        }}
      />

      <QuickRenderDialog
        open={showQuickRender}
        prompt={selectedPrompt as any}
        variants={selectedPrompt ? groupedPrompts.find((g: any) => g.basePrompt.id === selectedPrompt.id)?.variants || [] : []}
        selectedVariant={selectedVariant as any}
        onClose={() => {
          setShowQuickRender(false);
          setSelectedPrompt(null);
          setSelectedVariant(null);
        }}
        onRender={handleQuickRenderExecute}
        onAdvancedRender={handleRenderPrompt}
        isLoading={isLoading}
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