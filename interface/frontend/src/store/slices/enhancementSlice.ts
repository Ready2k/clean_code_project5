import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { enhancementAPI } from '../../services/api/enhancementAPI';
import { 
  EnhancementProgress, 
  EnhancementStartRequest
} from '../../types/enhancement';

interface EnhancementState {
  jobs: Record<string, EnhancementProgress>;
  activeJobId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: EnhancementState = {
  jobs: {},
  activeJobId: null,
  isLoading: false,
  error: null,
};

// Async thunks
export const startEnhancement = createAsyncThunk(
  'enhancement/startEnhancement',
  async ({ promptId, options }: { promptId: string; options?: EnhancementStartRequest }, { rejectWithValue }) => {
    try {
      const response = await enhancementAPI.startEnhancement(promptId, options);
      return { promptId, ...response };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to start enhancement');
    }
  }
);

export const fetchEnhancementStatus = createAsyncThunk(
  'enhancement/fetchEnhancementStatus',
  async ({ promptId, jobId }: { promptId: string; jobId: string }, { rejectWithValue }) => {
    try {
      const response = await enhancementAPI.getEnhancementStatus(promptId, jobId);
      return response as EnhancementProgress;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch enhancement status');
    }
  }
);

export const submitQuestionnaireResponse = createAsyncThunk(
  'enhancement/submitQuestionnaireResponse',
  async ({ promptId, jobId, answers }: { promptId: string; jobId: string; answers: Record<string, any> }, { rejectWithValue }) => {
    try {
      await enhancementAPI.submitQuestionnaireResponse(promptId, jobId, answers);
      return { jobId };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to submit questionnaire response');
    }
  }
);

export const cancelEnhancement = createAsyncThunk(
  'enhancement/cancelEnhancement',
  async ({ promptId, jobId }: { promptId: string; jobId: string }, { rejectWithValue }) => {
    try {
      await enhancementAPI.cancelEnhancement(promptId, jobId);
      return { jobId };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cancel enhancement');
    }
  }
);

const enhancementSlice = createSlice({
  name: 'enhancement',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setActiveJob: (state, action: PayloadAction<string | null>) => {
      state.activeJobId = action.payload;
    },
    updateJobProgress: (state, action: PayloadAction<EnhancementProgress>) => {
      const progress = action.payload;
      state.jobs[progress.jobId] = progress;
      
      // If this is the active job, keep it active
      if (state.activeJobId === progress.jobId) {
        // Job completed or failed, clear active job
        if (progress.status === 'complete' || progress.status === 'failed') {
          state.activeJobId = null;
        }
      }
    },
    clearJobs: (state) => {
      state.jobs = {};
      state.activeJobId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Start enhancement
      .addCase(startEnhancement.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(startEnhancement.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activeJobId = action.payload.jobId;
        // Initialize job progress
        state.jobs[action.payload.jobId] = {
          jobId: action.payload.jobId,
          promptId: action.payload.promptId,
          status: 'pending',
          progress: 0,
          message: 'Enhancement job started',
        };
      })
      .addCase(startEnhancement.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch enhancement status
      .addCase(fetchEnhancementStatus.fulfilled, (state, action) => {
        const progress = action.payload;
        state.jobs[progress.jobId] = progress;
      })
      .addCase(fetchEnhancementStatus.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // Submit questionnaire response
      .addCase(submitQuestionnaireResponse.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(submitQuestionnaireResponse.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(submitQuestionnaireResponse.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Cancel enhancement
      .addCase(cancelEnhancement.fulfilled, (state, action) => {
        const { jobId } = action.payload;
        if (state.jobs[jobId]) {
          state.jobs[jobId].status = 'failed';
          state.jobs[jobId].message = 'Enhancement cancelled by user';
        }
        if (state.activeJobId === jobId) {
          state.activeJobId = null;
        }
      });
  },
});

export const { clearError, setActiveJob, updateJobProgress, clearJobs } = enhancementSlice.actions;
export default enhancementSlice.reducer;