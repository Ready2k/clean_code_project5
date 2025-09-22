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

const initialState: UIState = {
  themeMode: (localStorage.getItem('themeMode') as ThemeMode) || 'auto',
  highContrast: localStorage.getItem('highContrast') === 'true',
  fontSize: (localStorage.getItem('fontSize') as FontSize) || 'medium',
  reducedMotion: localStorage.getItem('reducedMotion') === 'true',
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
      localStorage.setItem('themeMode', action.payload);
    },
    setHighContrast: (state, action: PayloadAction<boolean>) => {
      state.highContrast = action.payload;
      localStorage.setItem('highContrast', action.payload.toString());
    },
    setFontSize: (state, action: PayloadAction<FontSize>) => {
      state.fontSize = action.payload;
      localStorage.setItem('fontSize', action.payload);
    },
    setReducedMotion: (state, action: PayloadAction<boolean>) => {
      state.reducedMotion = action.payload;
      localStorage.setItem('reducedMotion', action.payload.toString());
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
      state.notifications.push(action.payload);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    setModal: (state, action: PayloadAction<{ key: string; open: boolean }>) => {
      state.modals[action.payload.key] = action.payload.open;
    },
    closeAllModals: (state) => {
      Object.keys(state.modals).forEach((key) => {
        state.modals[key] = false;
      });
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
  setModal,
  closeAllModals,
} = uiSlice.actions;

export default uiSlice.reducer;