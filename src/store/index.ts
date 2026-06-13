/**
 * Sama Redux store.
 *
 * Now exclusively for UI state management (loading, toasts, bottom sheets, call records).
 * All API/data operations have been migrated to Apollo Client (see @/lib/apollo.ts).
 *
 * Migration note:
 * - RTK Query (samaApi) was the previous API layer, now replaced by Apollo Client.
 * - If any legacy code still references samaApi, update it to use Apollo hooks.
 */
import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import callReducer from './slices/callSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    call: callReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
