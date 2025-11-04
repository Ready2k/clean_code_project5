import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type FontSize = 'small' | 'medium' | 'large' | 'extraLarge';

interface UIState {
  themeMode: ThemeMode;
  highContrast: boolean;
  fontSize: FontSize;
  reducedMotion: boolean;
  sidebarOpen: boolean;
  loading: {
    global: boolean;
    [key: string]: boolean;
  };
  notifications: Notification[];
  modals: {
    [key: string]: boolean;
  };
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  autoHide?: boolean;
  duration?: number;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

// Safe localStorage access for SSR compatibility
const getStoredValue = (key: string, defaultValue: any) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = localStorage.getItem(key);
    return stored !== null ? stored : defaultValue;
  }
  return defaultValue;
};

const initialState: UIState = {
  themeMode: (getStoredValue('themeMode', 'auto') as ThemeMode),
  highContrast: getStoredValue('highContrast', 'false') === 'true',
  fontSize: (getStoredValue('fontSize', 'medium') as FontSize),
  reducedMotion: getStoredValue('reducedMotion', 'false') === 'true',
  sidebarOpen: true,
  loading: {
    global: false,
  },
  notifications: [],
  modals: {},
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setThemeMode: (state, action: PayloadAction<ThemeMode>) => {
      state.themeMode = action.payload;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('themeMode', action.payload);
      }
    },
    setHighContrast: (state, action: PayloadAction<boolean>) => {
      state.highContrast = action.payload;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('highContrast', action.payload.toString());
      }
    },
    setFontSize: (state, action: PayloadAction<FontSize>) => {
      state.fontSize = action.payload;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('fontSize', action.payload);
      }
    },
    setReducedMotion: (state, action: PayloadAction<boolean>) => {
      state.reducedMotion = action.payload;
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('reducedMotion', action.payload.toString());
      }
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setLoading: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      state.loading[action.payload.key] = action.payload.loading;
    },
    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.loading.global = action.payload;
    },
    addNotification: (state, action: PayloadAction<Notification>) => {
      // Prevent duplicate notifications with the same message and type
      const existingNotification = state.notifications.find(
        n => n.message === action.payload.message && n.type === action.payload.type
      );
      
      // Special handling for rate limit notifications - prevent multiple within 5 seconds
      if (action.payload.title === 'Rate Limited') {
        const recentRateLimit = state.notifications.find(
          n => n.title === 'Rate Limited' && 
               Date.now() - new Date(n.timestamp).getTime() < 5000
        );
        
        if (recentRateLimit) {
          return; // Don't add duplicate rate limit notification
        }
      }
      
      if (!existingNotification) {
        state.notifications.push(action.payload);
      }
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    clearRateLimitNotifications: (state) => {
      state.notifications = state.notifications.filter(
        n => !n.message.includes('Rate Limited') && !n.message.includes('Too many requests')
      );
    },
    setModal: (state, action: PayloadAction<{ key: string; open: boolean }>) => {
      state.modals[action.payload.key] = action.payload.open;
    },
    closeAllModals: (state) => {
      Object.keys(state.modals).forEach((key) => {
        state.modals[key] = false;
      });
    },
    setNavigation: (_state, _action: PayloadAction<string>) => {
      // This is a dummy reducer, the actual navigation will be handled by a middleware
    },
  },
});

export const {
  setThemeMode,
  setHighContrast,
  setFontSize,
  setReducedMotion,
  toggleSidebar,
  setSidebarOpen,
  setLoading,
  setGlobalLoading,
  addNotification,
  removeNotification,
  clearNotifications,
  clearRateLimitNotifications,
  setModal,
  closeAllModals,
} = uiSlice.actions;

export default uiSlice.reducer;