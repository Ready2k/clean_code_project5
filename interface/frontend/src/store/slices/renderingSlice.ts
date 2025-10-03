import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { promptsAPI } from '../../services/api/promptsAPI';
import { RenderOptions, RenderResult } from '../../types/prompts';

interface RenderingState {
  renders: Record<string, RenderResult>; // keyed by render ID
  activeRenders: string[]; // currently rendering
  isLoading: boolean;
  error: string | null;
  compareMode: boolean;
  selectedRenders: string[]; // for comparison
}

const initialState: RenderingState = {
  renders: {},
  activeRenders: [],
  isLoading: false,
  error: null,
  compareMode: false,
  selectedRenders: [],
};

// Track active render requests to prevent duplicates
const activeRenderRequests = new Map<string, Promise<any>>();

// Async thunks
export const renderPrompt = createAsyncThunk(
  'rendering/renderPrompt',
  async (
    { promptId, connectionId, provider, options }: 
    { promptId: string; connectionId: string; provider: string; options: RenderOptions },
    { rejectWithValue, getState }
  ) => {
    // Create a unique key for this render request
    const renderKey = `${promptId}-${connectionId}-${provider}`;
    
    // Check if this exact render is already in progress
    if (activeRenderRequests.has(renderKey)) {
      console.log('Duplicate render request detected, waiting for existing request', {
        promptId,
        connectionId,
        provider
      });
      
      try {
        // Wait for the existing request to complete
        const existingResult = await activeRenderRequests.get(renderKey);
        return existingResult;
      } catch (error) {
        // If the existing request failed, we'll proceed with a new one
        activeRenderRequests.delete(renderKey);
      }
    }

    // Create the render promise
    const renderPromise = (async () => {
      try {
        console.log('Starting new render request', {
          promptId,
          connectionId,
          provider
        });

        const result = await promptsAPI.renderPrompt(promptId, provider, {
          connectionId,
          ...options,
        });

        const renderResult = {
          id: `${promptId}-${connectionId}-${Date.now()}`,
          promptId,
          connectionId,
          provider,
          model: result.metadata?.model || options.model,
          targetModel: result.metadata?.targetModel || options.targetModel,
          payload: result.payload,
          variables: options.variables || {},
          createdAt: new Date().toISOString(),
          success: true,
        } as RenderResult;

        console.log('Render request completed successfully', {
          promptId,
          connectionId,
          provider
        });

        return renderResult;
      } finally {
        // Always clean up the active request entry
        activeRenderRequests.delete(renderKey);
      }
    })();

    // Store the promise in the active requests map
    activeRenderRequests.set(renderKey, renderPromise);

    try {
      return await renderPromise;
    } catch (error: any) {
      return rejectWithValue({
        id: `${promptId}-${connectionId}-${Date.now()}`,
        promptId,
        connectionId,
        provider,
        error: error.response?.data?.message || 'Failed to render prompt',
        createdAt: new Date().toISOString(),
        success: false,
      });
    }
  }
);

export const renderMultipleProviders = createAsyncThunk(
  'rendering/renderMultipleProviders',
  async (
    { promptId, renders }: 
    { 
      promptId: string; 
      renders: Array<{ connectionId: string; provider: string; options: RenderOptions }> 
    },
    { dispatch }
  ) => {
    const promises = renders.map(({ connectionId, provider, options }) =>
      dispatch(renderPrompt({ promptId, connectionId, provider, options }))
    );
    
    const results = await Promise.allSettled(promises);
    return results;
  }
);

const renderingSlice = createSlice({
  name: 'rendering',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearRenders: (state) => {
      state.renders = {};
      state.activeRenders = [];
      state.selectedRenders = [];
    },
    removeRender: (state, action: PayloadAction<string>) => {
      delete state.renders[action.payload];
      state.activeRenders = state.activeRenders.filter(id => id !== action.payload);
      state.selectedRenders = state.selectedRenders.filter(id => id !== action.payload);
    },
    toggleCompareMode: (state) => {
      state.compareMode = !state.compareMode;
      if (!state.compareMode) {
        state.selectedRenders = [];
      }
    },
    toggleRenderSelection: (state, action: PayloadAction<string>) => {
      const renderId = action.payload;
      const index = state.selectedRenders.indexOf(renderId);
      if (index === -1) {
        state.selectedRenders.push(renderId);
      } else {
        state.selectedRenders.splice(index, 1);
      }
    },
    clearRenderSelection: (state) => {
      state.selectedRenders = [];
    },
    addPreviewRender: (state, action: PayloadAction<RenderResult>) => {
      const render = action.payload;
      state.renders[render.id] = render;
      state.activeRenders.push(render.id);
    },
  },
  extraReducers: (builder) => {
    builder
      // Render prompt
      .addCase(renderPrompt.pending, (state, action) => {
        state.isLoading = true;
        state.error = null;
        const { promptId, connectionId } = action.meta.arg;
        const tempId = `${promptId}-${connectionId}-pending`;
        // Only add if not already present to prevent duplicates
        if (!state.activeRenders.includes(tempId)) {
          state.activeRenders.push(tempId);
        }
      })
      .addCase(renderPrompt.fulfilled, (state, action) => {
        state.isLoading = false;
        const result = action.payload;
        state.renders[result.id] = result;
        const { promptId, connectionId } = action.meta.arg;
        const tempId = `${promptId}-${connectionId}-pending`;
        state.activeRenders = state.activeRenders.filter(id => id !== tempId);
      })
      .addCase(renderPrompt.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to render prompt';
        const result = action.payload as RenderResult;
        if (result) {
          state.renders[result.id] = result;
        }
        const { promptId, connectionId } = action.meta.arg;
        const tempId = `${promptId}-${connectionId}-pending`;
        state.activeRenders = state.activeRenders.filter(id => id !== tempId);
      });
  },
});

export const {
  clearError,
  clearRenders,
  removeRender,
  toggleCompareMode,
  toggleRenderSelection,
  clearRenderSelection,
  addPreviewRender,
} = renderingSlice.actions;

export default renderingSlice.reducer;