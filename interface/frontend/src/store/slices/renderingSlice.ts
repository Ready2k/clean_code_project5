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

// Async thunks
export const renderPrompt = createAsyncThunk(
  'rendering/renderPrompt',
  async (
    { promptId, connectionId, provider, options }: 
    { promptId: string; connectionId: string; provider: string; options: RenderOptions },
    { rejectWithValue }
  ) => {
    try {
      const result = await promptsAPI.renderPrompt(promptId, provider, {
        connectionId,
        ...options,
      });
      return {
        id: `${promptId}-${connectionId}-${Date.now()}`,
        promptId,
        connectionId,
        provider,
        ...result,
        createdAt: new Date().toISOString(),
        success: true,
      } as RenderResult;
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
  },
  extraReducers: (builder) => {
    builder
      // Render prompt
      .addCase(renderPrompt.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        const tempId = `temp-${Date.now()}`;
        state.activeRenders.push(tempId);
      })
      .addCase(renderPrompt.fulfilled, (state, action) => {
        state.isLoading = false;
        const result = action.payload;
        state.renders[result.id] = result;
        state.activeRenders = state.activeRenders.filter(id => !id.startsWith('temp-'));
      })
      .addCase(renderPrompt.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to render prompt';
        const result = action.payload as RenderResult;
        if (result) {
          state.renders[result.id] = result;
        }
        state.activeRenders = state.activeRenders.filter(id => !id.startsWith('temp-'));
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
} = renderingSlice.actions;

export default renderingSlice.reducer;