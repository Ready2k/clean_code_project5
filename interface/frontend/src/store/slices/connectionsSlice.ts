import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { connectionsAPI } from '../../services/api/connectionsAPI';
import { LLMConnection, CreateConnectionRequest, UpdateConnectionRequest, ConnectionTestResult } from '../../types/connections';

interface ConnectionsState {
  items: LLMConnection[];
  isLoading: boolean;
  error: string | null;
  testResults: Record<string, ConnectionTestResult>;
}

const initialState: ConnectionsState = {
  items: [],
  isLoading: false,
  error: null,
  testResults: {},
};

// Async thunks
export const fetchConnections = createAsyncThunk(
  'connections/fetchConnections',
  async (_, { rejectWithValue }) => {
    try {
      const connections = await connectionsAPI.getConnections();
      return connections;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch connections');
    }
  }
);

export const createConnection = createAsyncThunk(
  'connections/createConnection',
  async (data: CreateConnectionRequest, { rejectWithValue }) => {
    try {
      const connection = await connectionsAPI.createConnection(data);
      return connection;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create connection');
    }
  }
);

export const updateConnection = createAsyncThunk(
  'connections/updateConnection',
  async ({ id, data }: { id: string; data: UpdateConnectionRequest }, { rejectWithValue }) => {
    try {
      const connection = await connectionsAPI.updateConnection(id, data);
      return connection;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update connection');
    }
  }
);

export const deleteConnection = createAsyncThunk(
  'connections/deleteConnection',
  async (id: string, { rejectWithValue }) => {
    try {
      await connectionsAPI.deleteConnection(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete connection');
    }
  }
);

export const testConnection = createAsyncThunk(
  'connections/testConnection',
  async (id: string, { rejectWithValue }) => {
    try {
      const result = await connectionsAPI.testConnection(id);
      return { id, result };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to test connection');
    }
  }
);

const connectionsSlice = createSlice({
  name: 'connections',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearTestResults: (state) => {
      state.testResults = {};
    },
    setConnectionStatus: (state, action: PayloadAction<{ id: string; status: LLMConnection['status'] }>) => {
      const connection = state.items.find(item => item.id === action.payload.id);
      if (connection) {
        connection.status = action.payload.status;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch connections
      .addCase(fetchConnections.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchConnections.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload;
        state.error = null;
      })
      .addCase(fetchConnections.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Create connection
      .addCase(createConnection.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      // Update connection
      .addCase(updateConnection.fulfilled, (state, action) => {
        const index = state.items.findIndex(item => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
      })
      // Delete connection
      .addCase(deleteConnection.fulfilled, (state, action) => {
        state.items = state.items.filter(item => item.id !== action.payload);
        delete state.testResults[action.payload];
      })
      // Test connection
      .addCase(testConnection.fulfilled, (state, action) => {
        state.testResults[action.payload.id] = action.payload.result;
        // Update connection status based on test result
        const connection = state.items.find(item => item.id === action.payload.id);
        if (connection) {
          connection.status = action.payload.result.success ? 'active' : 'error';
          connection.lastTested = action.payload.result.testedAt;
        }
      });
  },
});

export const { clearError, clearTestResults, setConnectionStatus } = connectionsSlice.actions;
export default connectionsSlice.reducer;