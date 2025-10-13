import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { 
  exportAPI, 
  ExportOptions, 
  BulkExportOptions, 
  ExportPreview, 
  BulkExportPreview,
  ExportFormat,
  ExportTemplate,
  ShareLink,
  ShareLinkRequest,
  ExportHistory
} from '../../services/api/exportAPI';

export interface ExportProgress {
  id: string;
  type: 'single' | 'bulk';
  status: 'preparing' | 'processing' | 'completed' | 'failed';
  progress: number;
  message: string;
  filename?: string;
  size?: number;
  error?: string;
}

export interface ExportState {
  // Formats and templates
  formats: ExportFormat[];
  templates: ExportTemplate[];
  isLoadingFormats: boolean;
  
  // Export operations
  activeExports: Record<string, ExportProgress>;
  exportHistory: ExportHistory[];
  isLoadingHistory: boolean;
  
  // Previews
  currentPreview: ExportPreview | BulkExportPreview | null;
  isLoadingPreview: boolean;
  
  // Sharing
  shareLinks: ShareLink[];
  isLoadingShareLinks: boolean;
  
  // UI state
  exportDialogOpen: boolean;
  bulkExportDialogOpen: boolean;
  shareDialogOpen: boolean;
  historyDialogOpen: boolean;
  selectedPromptIds: string[];
  
  // Current export configuration
  currentExportOptions: ExportOptions;
  currentBulkExportOptions: BulkExportOptions;
  
  // Error handling
  error: string | null;
}

const initialState: ExportState = {
  formats: [],
  templates: [],
  isLoadingFormats: false,
  
  activeExports: {},
  exportHistory: [],
  isLoadingHistory: false,
  
  currentPreview: null,
  isLoadingPreview: false,
  
  shareLinks: [],
  isLoadingShareLinks: false,
  
  exportDialogOpen: false,
  bulkExportDialogOpen: false,
  shareDialogOpen: false,
  historyDialogOpen: false,
  selectedPromptIds: [],
  
  currentExportOptions: {
    format: 'json',
    includeMetadata: true,
    includeHistory: false,
    includeRatings: false,
    substituteVariables: false,
    template: 'full'
  },
  
  currentBulkExportOptions: {
    promptIds: [],
    format: 'json',
    includeMetadata: true,
    includeHistory: false,
    includeRatings: false,
    substituteVariables: false,
    template: 'full',
    archiveFormat: 'zip'
  },
  
  error: null
};

// Async thunks
export const fetchFormats = createAsyncThunk(
  'export/fetchFormats',
  async () => {
    const [formatsResponse, templatesResponse] = await Promise.all([
      exportAPI.getFormats(),
      exportAPI.getTemplates()
    ]);
    return {
      formats: formatsResponse.formats,
      templates: templatesResponse.templates
    };
  }
);

export const previewExport = createAsyncThunk(
  'export/previewExport',
  async ({ promptId, options }: { promptId: string; options: ExportOptions }) => {
    return await exportAPI.previewExport(promptId, options);
  }
);

export const previewBulkExport = createAsyncThunk(
  'export/previewBulkExport',
  async (options: BulkExportOptions) => {
    return await exportAPI.previewBulkExport(options);
  }
);

export const exportPrompt = createAsyncThunk(
  'export/exportPrompt',
  async ({ promptId, options }: { promptId: string; options: ExportOptions }, { dispatch }) => {
    const exportId = `single_${promptId}_${Date.now()}`;
    
    // Start progress tracking
    dispatch(updateExportProgress({
      id: exportId,
      type: 'single',
      status: 'preparing',
      progress: 0,
      message: 'Preparing export...'
    }));

    try {
      dispatch(updateExportProgress({
        id: exportId,
        type: 'single',
        status: 'processing',
        progress: 50,
        message: 'Generating export file...'
      }));

      const blob = await exportAPI.exportPrompt(promptId, options);
      
      // Create download
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const url = window.URL.createObjectURL(blob);
        const filename = `prompt_${promptId}.${options.format}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }

      dispatch(updateExportProgress({
        id: exportId,
        type: 'single',
        status: 'completed',
        progress: 100,
        message: 'Export completed successfully',
        filename,
        size: blob.size
      }));

      return { exportId, filename, size: blob.size };
    } catch (error) {
      dispatch(updateExportProgress({
        id: exportId,
        type: 'single',
        status: 'failed',
        progress: 0,
        message: 'Export failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
      throw error;
    }
  }
);

export const bulkExportPrompts = createAsyncThunk(
  'export/bulkExportPrompts',
  async (options: BulkExportOptions, { dispatch }) => {
    const exportId = `bulk_${Date.now()}`;
    
    // Start progress tracking
    dispatch(updateExportProgress({
      id: exportId,
      type: 'bulk',
      status: 'preparing',
      progress: 0,
      message: 'Preparing bulk export...'
    }));

    try {
      dispatch(updateExportProgress({
        id: exportId,
        type: 'bulk',
        status: 'processing',
        progress: 30,
        message: 'Processing prompts...'
      }));

      const blob = await exportAPI.bulkExport(options);
      
      dispatch(updateExportProgress({
        id: exportId,
        type: 'bulk',
        status: 'processing',
        progress: 80,
        message: 'Creating archive...'
      }));

      // Create download
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const url = window.URL.createObjectURL(blob);
        const filename = options.filename || `prompts_bulk_export.${options.archiveFormat || 'zip'}`;
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }

      dispatch(updateExportProgress({
        id: exportId,
        type: 'bulk',
        status: 'completed',
        progress: 100,
        message: 'Bulk export completed successfully',
        filename,
        size: blob.size
      }));

      return { exportId, filename, size: blob.size };
    } catch (error) {
      dispatch(updateExportProgress({
        id: exportId,
        type: 'bulk',
        status: 'failed',
        progress: 0,
        message: 'Bulk export failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
      throw error;
    }
  }
);

export const fetchShareLinks = createAsyncThunk(
  'export/fetchShareLinks',
  async (promptId?: string) => {
    return await exportAPI.getShareLinks(promptId);
  }
);

export const createShareLink = createAsyncThunk(
  'export/createShareLink',
  async (request: ShareLinkRequest) => {
    return await exportAPI.createShareLink(request);
  }
);

export const deleteShareLink = createAsyncThunk(
  'export/deleteShareLink',
  async (linkId: string) => {
    await exportAPI.deleteShareLink(linkId);
    return linkId;
  }
);

export const fetchExportHistory = createAsyncThunk(
  'export/fetchExportHistory',
  async (filters?: Parameters<typeof exportAPI.getExportHistory>[0]) => {
    return await exportAPI.getExportHistory(filters);
  }
);

const exportSlice = createSlice({
  name: 'export',
  initialState,
  reducers: {
    // Dialog management
    openExportDialog: (state, action: PayloadAction<string>) => {
      state.exportDialogOpen = true;
      state.selectedPromptIds = [action.payload];
    },
    
    openBulkExportDialog: (state, action: PayloadAction<string[]>) => {
      state.bulkExportDialogOpen = true;
      state.selectedPromptIds = action.payload;
      state.currentBulkExportOptions.promptIds = action.payload;
    },
    
    closeExportDialog: (state) => {
      state.exportDialogOpen = false;
      state.currentPreview = null;
    },
    
    closeBulkExportDialog: (state) => {
      state.bulkExportDialogOpen = false;
      state.currentPreview = null;
    },
    
    openShareDialog: (state, action: PayloadAction<string>) => {
      state.shareDialogOpen = true;
      state.selectedPromptIds = [action.payload];
    },
    
    closeShareDialog: (state) => {
      state.shareDialogOpen = false;
    },
    
    openHistoryDialog: (state) => {
      state.historyDialogOpen = true;
    },
    
    closeHistoryDialog: (state) => {
      state.historyDialogOpen = false;
    },
    
    // Export options management
    updateExportOptions: (state, action: PayloadAction<Partial<ExportOptions>>) => {
      state.currentExportOptions = { ...state.currentExportOptions, ...action.payload };
    },
    
    updateBulkExportOptions: (state, action: PayloadAction<Partial<BulkExportOptions>>) => {
      state.currentBulkExportOptions = { ...state.currentBulkExportOptions, ...action.payload };
    },
    
    // Progress tracking
    updateExportProgress: (state, action: PayloadAction<ExportProgress>) => {
      state.activeExports[action.payload.id] = action.payload;
    },
    
    removeExportProgress: (state, action: PayloadAction<string>) => {
      delete state.activeExports[action.payload];
    },
    
    clearCompletedExports: (state) => {
      Object.keys(state.activeExports).forEach(id => {
        if (state.activeExports[id].status === 'completed' || state.activeExports[id].status === 'failed') {
          delete state.activeExports[id];
        }
      });
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null;
    },
    
    // Selection management
    setSelectedPromptIds: (state, action: PayloadAction<string[]>) => {
      state.selectedPromptIds = action.payload;
    },
    
    addToSelection: (state, action: PayloadAction<string>) => {
      if (!state.selectedPromptIds.includes(action.payload)) {
        state.selectedPromptIds.push(action.payload);
      }
    },
    
    removeFromSelection: (state, action: PayloadAction<string>) => {
      state.selectedPromptIds = state.selectedPromptIds.filter(id => id !== action.payload);
    },
    
    clearSelection: (state) => {
      state.selectedPromptIds = [];
    }
  },
  extraReducers: (builder) => {
    // Fetch formats
    builder
      .addCase(fetchFormats.pending, (state) => {
        state.isLoadingFormats = true;
        state.error = null;
      })
      .addCase(fetchFormats.fulfilled, (state, action) => {
        state.isLoadingFormats = false;
        state.formats = action.payload.formats;
        state.templates = action.payload.templates;
      })
      .addCase(fetchFormats.rejected, (state, action) => {
        state.isLoadingFormats = false;
        state.error = action.error.message || 'Failed to fetch export formats';
      });

    // Preview export
    builder
      .addCase(previewExport.pending, (state) => {
        state.isLoadingPreview = true;
        state.error = null;
      })
      .addCase(previewExport.fulfilled, (state, action) => {
        state.isLoadingPreview = false;
        state.currentPreview = action.payload;
      })
      .addCase(previewExport.rejected, (state, action) => {
        state.isLoadingPreview = false;
        state.error = action.error.message || 'Failed to preview export';
      });

    // Preview bulk export
    builder
      .addCase(previewBulkExport.pending, (state) => {
        state.isLoadingPreview = true;
        state.error = null;
      })
      .addCase(previewBulkExport.fulfilled, (state, action) => {
        state.isLoadingPreview = false;
        state.currentPreview = action.payload;
      })
      .addCase(previewBulkExport.rejected, (state, action) => {
        state.isLoadingPreview = false;
        state.error = action.error.message || 'Failed to preview bulk export';
      });

    // Export prompt
    builder
      .addCase(exportPrompt.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to export prompt';
      });

    // Bulk export
    builder
      .addCase(bulkExportPrompts.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to bulk export prompts';
      });

    // Share links
    builder
      .addCase(fetchShareLinks.pending, (state) => {
        state.isLoadingShareLinks = true;
        state.error = null;
      })
      .addCase(fetchShareLinks.fulfilled, (state, action) => {
        state.isLoadingShareLinks = false;
        state.shareLinks = action.payload;
      })
      .addCase(fetchShareLinks.rejected, (state, action) => {
        state.isLoadingShareLinks = false;
        state.error = action.error.message || 'Failed to fetch share links';
      });

    builder
      .addCase(createShareLink.fulfilled, (state, action) => {
        state.shareLinks.push(action.payload);
      })
      .addCase(createShareLink.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to create share link';
      });

    builder
      .addCase(deleteShareLink.fulfilled, (state, action) => {
        state.shareLinks = state.shareLinks.filter(link => link.id !== action.payload);
      })
      .addCase(deleteShareLink.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to delete share link';
      });

    // Export history
    builder
      .addCase(fetchExportHistory.pending, (state) => {
        state.isLoadingHistory = true;
        state.error = null;
      })
      .addCase(fetchExportHistory.fulfilled, (state, action) => {
        state.isLoadingHistory = false;
        state.exportHistory = action.payload.exports;
      })
      .addCase(fetchExportHistory.rejected, (state, action) => {
        state.isLoadingHistory = false;
        state.error = action.error.message || 'Failed to fetch export history';
      });
  }
});

export const {
  openExportDialog,
  openBulkExportDialog,
  closeExportDialog,
  closeBulkExportDialog,
  openShareDialog,
  closeShareDialog,
  openHistoryDialog,
  closeHistoryDialog,
  updateExportOptions,
  updateBulkExportOptions,
  updateExportProgress,
  removeExportProgress,
  clearCompletedExports,
  clearError,
  setSelectedPromptIds,
  addToSelection,
  removeFromSelection,
  clearSelection
} = exportSlice.actions;

export default exportSlice.reducer;