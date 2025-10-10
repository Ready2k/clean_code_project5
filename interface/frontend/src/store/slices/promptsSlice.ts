import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { promptsAPI } from '../../services/api/promptsAPI';
import { PromptRecord, PromptFilters, CreatePromptRequest, UpdatePromptRequest } from '../../types/prompts';

interface PromptsState {
  items: PromptRecord[];
  currentPrompt: PromptRecord | null;
  filters: PromptFilters;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

const initialState: PromptsState = {
  items: [],
  currentPrompt: null,
  filters: {
    page: 1,
    limit: 50, // Increased default limit
    sortBy: 'updated_at',
    sortOrder: 'desc',
  },
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 50, // Increased default limit
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

// Async thunks
export const fetchPrompts = createAsyncThunk(
  'prompts/fetchPrompts',
  async (filters: PromptFilters | undefined, { rejectWithValue }) => {
    try {
      const response = await promptsAPI.getPrompts(filters);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch prompts');
    }
  }
);

export const fetchPrompt = createAsyncThunk(
  'prompts/fetchPrompt',
  async (id: string, { rejectWithValue }) => {
    try {
      const prompt = await promptsAPI.getPrompt(id);
      return prompt;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch prompt');
    }
  }
);

export const createPrompt = createAsyncThunk(
  'prompts/createPrompt',
  async (data: CreatePromptRequest, { rejectWithValue }) => {
    try {
      const prompt = await promptsAPI.createPrompt(data);
      return prompt;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create prompt');
    }
  }
);

export const updatePrompt = createAsyncThunk(
  'prompts/updatePrompt',
  async ({ id, data }: { id: string; data: UpdatePromptRequest }, { rejectWithValue }) => {
    try {
      const prompt = await promptsAPI.updatePrompt(id, data);
      return prompt;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update prompt');
    }
  }
);

export const deletePrompt = createAsyncThunk(
  'prompts/deletePrompt',
  async (id: string, { rejectWithValue }) => {
    try {
      await promptsAPI.deletePrompt(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete prompt');
    }
  }
);

export const loadMorePrompts = createAsyncThunk(
  'prompts/loadMorePrompts',
  async (filters: PromptFilters, { rejectWithValue }) => {
    try {
      const response = await promptsAPI.getPrompts(filters);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to load more prompts');
    }
  }
);

const promptsSlice = createSlice({
  name: 'prompts',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setFilters: (state, action: PayloadAction<Partial<PromptFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {
        page: 1,
        limit: 50, // Increased default limit
        sortBy: 'updated_at',
        sortOrder: 'desc',
      };
    },
    incrementPage: (state) => {
      if (state.pagination.page < state.pagination.totalPages) {
        state.filters.page = state.pagination.page + 1;
      }
    },
    setCurrentPrompt: (state, action: PayloadAction<PromptRecord | null>) => {
      state.currentPrompt = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch prompts
      .addCase(fetchPrompts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPrompts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload.items;
        state.pagination = action.payload.pagination;
        state.error = null;
      })
      .addCase(fetchPrompts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch single prompt
      .addCase(fetchPrompt.fulfilled, (state, action) => {
        state.currentPrompt = action.payload;
        // Update item in list if it exists
        const index = state.items.findIndex(item => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      // Create prompt
      .addCase(createPrompt.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
        state.pagination.total += 1;
      })
      // Update prompt
      .addCase(updatePrompt.fulfilled, (state, action) => {
        const index = state.items.findIndex(item => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        if (state.currentPrompt?.id === action.payload.id) {
          state.currentPrompt = action.payload;
        }
      })
      // Delete prompt
      .addCase(deletePrompt.fulfilled, (state, action) => {
        state.items = state.items.filter(item => item.id !== action.payload);
        if (state.currentPrompt?.id === action.payload) {
          state.currentPrompt = null;
        }
        state.pagination.total -= 1;
      })
      // Load more prompts
      .addCase(loadMorePrompts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadMorePrompts.fulfilled, (state, action) => {
        state.isLoading = false;
        // Append new items to existing ones, avoiding duplicates
        const existingIds = new Set(state.items.map(item => item.id));
        const newItems = action.payload.items.filter(item => !existingIds.has(item.id));
        state.items = [...state.items, ...newItems];
        state.pagination = action.payload.pagination;
        state.error = null;
      })
      .addCase(loadMorePrompts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setFilters, clearFilters, setCurrentPrompt, incrementPage } = promptsSlice.actions;
export default promptsSlice.reducer;