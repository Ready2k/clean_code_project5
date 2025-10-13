import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authAPI } from '../../services/api/authAPI';
import { User, LoginCredentials, AuthResponse } from '../../types/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Safe localStorage access for SSR compatibility
const getStoredToken = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('token');
  }
  return null;
};

const initialState: AuthState = {
  user: null,
  token: getStoredToken(),
  isAuthenticated: !!getStoredToken(),
  isLoading: false,
  error: null,
};

// Async thunks
export const login = createAsyncThunk(
  'auth/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await authAPI.login(credentials);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('token', response.token);
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
      }
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authAPI.logout();
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      }
    } catch (error: any) {
      // Even if logout fails on server, clear local storage
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      }
      return rejectWithValue(error.response?.data?.message || 'Logout failed');
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authAPI.refreshToken();
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('token', response.token);
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
      }
      return response;
    } catch (error: any) {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      }
      return rejectWithValue(error.response?.data?.message || 'Token refresh failed');
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const user = await authAPI.getCurrentUser();
      return user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to get user');
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData: {
    username: string;
    email: string;
    password: string;
    role: 'user' | 'viewer';
  }, { rejectWithValue }) => {
    try {
      const response = await authAPI.register(userData);
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('token', response.token);
      }
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Registration failed');
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (profileData: {
    username: string;
    email: string;
  }, { rejectWithValue }) => {
    try {
      const user = await authAPI.updateProfile(profileData);
      return user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Profile update failed');
    }
  }
);

export const updatePreferences = createAsyncThunk(
  'auth/updatePreferences',
  async (preferences: User['preferences'], { rejectWithValue }) => {
    try {
      const user = await authAPI.updatePreferences(preferences);
      return user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Preferences update failed');
    }
  }
);

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async (passwordData: {
    currentPassword: string;
    newPassword: string;
  }, { rejectWithValue }) => {
    try {
      await authAPI.changePassword(passwordData);
      return;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Password change failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCredentials: (state, action: PayloadAction<AuthResponse>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.error = null;
    },
    clearCredentials: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      // Logout
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logout.rejected, (state, action) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = action.payload as string;
      })
      // Refresh token
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(refreshToken.rejected, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      })
      // Get current user
      .addCase(getCurrentUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(getCurrentUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        // Clear invalid token
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem('token');
        }
      })
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
      })
      // Update profile
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Update preferences
      .addCase(updatePreferences.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updatePreferences.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(updatePreferences.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // Change password
      .addCase(changePassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setCredentials, clearCredentials } = authSlice.actions;
export default authSlice.reducer;