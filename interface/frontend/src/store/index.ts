import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import authReducer from './slices/authSlice';
import uiReducer from './slices/uiSlice';
import promptsReducer from './slices/promptsSlice';
import connectionsReducer from './slices/connectionsSlice';
import systemReducer from './slices/systemSlice';
import adminReducer from './slices/adminSlice';
import enhancementReducer from './slices/enhancementSlice';
import renderingReducer from './slices/renderingSlice';
import exportReducer from './slices/exportSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    prompts: promptsReducer,
    connections: connectionsReducer,
    system: systemReducer,
    admin: adminReducer,
    enhancement: enhancementReducer,
    rendering: renderingReducer,
    export: exportReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// Enable listener behavior for the store
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;