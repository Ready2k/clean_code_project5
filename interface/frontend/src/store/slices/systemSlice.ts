import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { systemAPI, SystemConfig, SystemEvent, SystemLog, SystemMetrics } from '../../services/api/systemAPI';
import { SystemStatus, SystemStats } from '../../types/system';

interface SystemState {
  status: SystemStatus | null;
  stats: SystemStats | null;
  config: SystemConfig | null;
  events: SystemEvent[];
  logs: SystemLog[];
  metrics: SystemMetrics[];
  isLoading: boolean;
  isLoadingConfig: boolean;
  isLoadingLogs: boolean;
  isLoadingEvents: boolean;
  isLoadingMetrics: boolean;
  isCreatingBackup: boolean;
  isCleaningUp: boolean;
  error: string | null;
  configError: string | null;
  logsError: string | null;
  eventsError: string | null;
  metricsError: string | null;
  backupError: string | null;
  cleanupError: string | null;
  lastUpdated: string | null;
  backupResult: any;
  cleanupResult: any;
}

const initialState: SystemState = {
  status: null,
  stats: null,
  config: null,
  events: [],
  logs: [],
  metrics: [],
  isLoading: false,
  isLoadingConfig: false,
  isLoadingLogs: false,
  isLoadingEvents: false,
  isLoadingMetrics: false,
  isCreatingBackup: false,
  isCleaningUp: false,
  error: null,
  configError: null,
  logsError: null,
  eventsError: null,
  metricsError: null,
  backupError: null,
  cleanupError: null,
  lastUpdated: null,
  backupResult: null,
  cleanupResult: null,
};

// Async thunks
export const fetchSystemStatus = createAsyncThunk(
  'system/fetchSystemStatus',
  async (_, { rejectWithValue }) => {
    try {
      const status = await systemAPI.getSystemStatus();
      return status;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch system status');
    }
  }
);

export const fetchSystemStats = createAsyncThunk(
  'system/fetchSystemStats',
  async (_, { rejectWithValue }) => {
    try {
      const stats = await systemAPI.getSystemStats();
      return stats;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch system stats');
    }
  }
);

export const fetchSystemConfig = createAsyncThunk(
  'system/fetchSystemConfig',
  async (_, { rejectWithValue }) => {
    try {
      const config = await systemAPI.getSystemConfig();
      return config;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch system config');
    }
  }
);

export const updateSystemConfig = createAsyncThunk(
  'system/updateSystemConfig',
  async (updates: Partial<SystemConfig>, { rejectWithValue }) => {
    try {
      const result = await systemAPI.updateSystemConfig(updates);
      return result.config;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update system config');
    }
  }
);

export const fetchSystemLogs = createAsyncThunk(
  'system/fetchSystemLogs',
  async (params: { level?: string; limit?: number; offset?: number } = {}, { rejectWithValue }) => {
    try {
      const result = await systemAPI.getSystemLogs(params);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch system logs');
    }
  }
);

export const fetchSystemEvents = createAsyncThunk(
  'system/fetchSystemEvents',
  async (params: { type?: string; category?: string; limit?: number } = {}, { rejectWithValue }) => {
    try {
      const result = await systemAPI.getSystemEvents(params);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch system events');
    }
  }
);

export const fetchSystemMetrics = createAsyncThunk(
  'system/fetchSystemMetrics',
  async (params: { limit?: number } = {}, { rejectWithValue }) => {
    try {
      const result = await systemAPI.getSystemMetrics(params);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch system metrics');
    }
  }
);

export const createSystemBackup = createAsyncThunk(
  'system/createSystemBackup',
  async (_, { rejectWithValue }) => {
    try {
      const result = await systemAPI.createBackup();
      return result;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create system backup');
    }
  }
);

export const cleanupSystem = createAsyncThunk(
  'system/cleanupSystem',
  async (_, { rejectWithValue }) => {
    try {
      const result = await systemAPI.cleanupSystem();
      return result;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to cleanup system');
    }
  }
);

const systemSlice = createSlice({
  name: 'system',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
      state.configError = null;
      state.logsError = null;
      state.eventsError = null;
      state.metricsError = null;
      state.backupError = null;
      state.cleanupError = null;
    },
    clearBackupResult: (state) => {
      state.backupResult = null;
      state.backupError = null;
    },
    clearCleanupResult: (state) => {
      state.cleanupResult = null;
      state.cleanupError = null;
    },
    updateStatus: (state, action: PayloadAction<SystemStatus>) => {
      state.status = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
    updateStats: (state, action: PayloadAction<SystemStats>) => {
      state.stats = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
    updateConfig: (state, action: PayloadAction<SystemConfig>) => {
      state.config = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
    updateSystemStatus: (state, action: PayloadAction<{
      status: 'healthy' | 'degraded' | 'down';
      services: Record<string, any>;
      timestamp: string;
    }>) => {
      if (state.status) {
        state.status.status = action.payload.status;
        // Update services while preserving the expected structure
        Object.assign(state.status.services, action.payload.services);
      } else {
        state.status = {
          status: action.payload.status,
          services: {
            api: { status: 'up', responseTime: 0, lastChecked: action.payload.timestamp },
            database: { status: 'up', responseTime: 0, lastChecked: action.payload.timestamp },
            storage: { status: 'up', responseTime: 0, lastChecked: action.payload.timestamp },
            llm: { status: 'up', responseTime: 0, lastChecked: action.payload.timestamp },
            redis: { status: 'up', responseTime: 0, lastChecked: action.payload.timestamp },
            ...action.payload.services
          },
          uptime: 0,
          version: '1.0.0',
          timestamp: action.payload.timestamp
        };
      }
      state.lastUpdated = action.payload.timestamp;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch system status
      .addCase(fetchSystemStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSystemStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.status = action.payload;
        state.lastUpdated = new Date().toISOString();
        state.error = null;
      })
      .addCase(fetchSystemStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch system stats
      .addCase(fetchSystemStats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSystemStats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stats = action.payload;
        state.lastUpdated = new Date().toISOString();
        state.error = null;
      })
      .addCase(fetchSystemStats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Fetch system config
      .addCase(fetchSystemConfig.pending, (state) => {
        state.isLoadingConfig = true;
        state.configError = null;
      })
      .addCase(fetchSystemConfig.fulfilled, (state, action) => {
        state.isLoadingConfig = false;
        state.config = action.payload;
        state.lastUpdated = new Date().toISOString();
        state.configError = null;
      })
      .addCase(fetchSystemConfig.rejected, (state, action) => {
        state.isLoadingConfig = false;
        state.configError = action.payload as string;
      })
      // Update system config
      .addCase(updateSystemConfig.pending, (state) => {
        state.isLoadingConfig = true;
        state.configError = null;
      })
      .addCase(updateSystemConfig.fulfilled, (state, action) => {
        state.isLoadingConfig = false;
        state.config = action.payload;
        state.lastUpdated = new Date().toISOString();
        state.configError = null;
      })
      .addCase(updateSystemConfig.rejected, (state, action) => {
        state.isLoadingConfig = false;
        state.configError = action.payload as string;
      })
      // Fetch system logs
      .addCase(fetchSystemLogs.pending, (state) => {
        state.isLoadingLogs = true;
        state.logsError = null;
      })
      .addCase(fetchSystemLogs.fulfilled, (state, action) => {
        state.isLoadingLogs = false;
        state.logs = action.payload.logs;
        state.logsError = null;
      })
      .addCase(fetchSystemLogs.rejected, (state, action) => {
        state.isLoadingLogs = false;
        state.logsError = action.payload as string;
      })
      // Fetch system events
      .addCase(fetchSystemEvents.pending, (state) => {
        state.isLoadingEvents = true;
        state.eventsError = null;
      })
      .addCase(fetchSystemEvents.fulfilled, (state, action) => {
        state.isLoadingEvents = false;
        state.events = action.payload.events;
        state.eventsError = null;
      })
      .addCase(fetchSystemEvents.rejected, (state, action) => {
        state.isLoadingEvents = false;
        state.eventsError = action.payload as string;
      })
      // Fetch system metrics
      .addCase(fetchSystemMetrics.pending, (state) => {
        state.isLoadingMetrics = true;
        state.metricsError = null;
      })
      .addCase(fetchSystemMetrics.fulfilled, (state, action) => {
        state.isLoadingMetrics = false;
        state.metrics = action.payload.metrics;
        state.metricsError = null;
      })
      .addCase(fetchSystemMetrics.rejected, (state, action) => {
        state.isLoadingMetrics = false;
        state.metricsError = action.payload as string;
      })
      // Create system backup
      .addCase(createSystemBackup.pending, (state) => {
        state.isCreatingBackup = true;
        state.backupError = null;
        state.backupResult = null;
      })
      .addCase(createSystemBackup.fulfilled, (state, action) => {
        state.isCreatingBackup = false;
        state.backupResult = action.payload;
        state.backupError = null;
      })
      .addCase(createSystemBackup.rejected, (state, action) => {
        state.isCreatingBackup = false;
        state.backupError = action.payload as string;
      })
      // Cleanup system
      .addCase(cleanupSystem.pending, (state) => {
        state.isCleaningUp = true;
        state.cleanupError = null;
        state.cleanupResult = null;
      })
      .addCase(cleanupSystem.fulfilled, (state, action) => {
        state.isCleaningUp = false;
        state.cleanupResult = action.payload;
        state.cleanupError = null;
      })
      .addCase(cleanupSystem.rejected, (state, action) => {
        state.isCleaningUp = false;
        state.cleanupError = action.payload as string;
      });
  },
});

export const { 
  clearError, 
  clearBackupResult, 
  clearCleanupResult, 
  updateStatus, 
  updateStats, 
  updateConfig,
  updateSystemStatus
} = systemSlice.actions;

export default systemSlice.reducer;