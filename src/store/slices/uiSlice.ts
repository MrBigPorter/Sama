import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface UiState {
  isLoading: boolean;
  toast: ToastState;
  bottomSheet: {
    visible: boolean;
    content: string | null;
  };
}

const initialState: UiState = {
  isLoading: false,
  toast: {
    visible: false,
    message: '',
    type: 'info',
  },
  bottomSheet: {
    visible: false,
    content: null,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    showToast(state, action: PayloadAction<Omit<ToastState, 'visible'>>) {
      state.toast = { ...action.payload, visible: true };
    },
    hideToast(state) {
      state.toast.visible = false;
      state.toast.message = '';
    },
    showBottomSheet(state, action: PayloadAction<string>) {
      state.bottomSheet = { visible: true, content: action.payload };
    },
    hideBottomSheet(state) {
      state.bottomSheet = { visible: false, content: null };
    },
  },
});

export const { setLoading, showToast, hideToast, showBottomSheet, hideBottomSheet } = uiSlice.actions;
export default uiSlice.reducer;
