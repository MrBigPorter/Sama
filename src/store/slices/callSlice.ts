/**
 * Redux slice for call history records.
 *
 * Stores a log of completed/missed/rejected calls for display
 * in the chat list and call history UI.
 */
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { CallRecord } from '@/types/graphql';

interface CallState {
  records: CallRecord[];
  incomingCall: {
    sessionId: string;
    senderId: string;
    mediaType: 'audio' | 'video';
    conversationId?: string;
  } | null;
}

const initialState: CallState = {
  records: [],
  incomingCall: null,
};

const callSlice = createSlice({
  name: 'call',
  initialState,
  reducers: {
    addCallRecord(state, action: PayloadAction<CallRecord>) {
      state.records.unshift(action.payload);
      // Keep last 50 records
      if (state.records.length > 50) {
        state.records = state.records.slice(0, 50);
      }
    },
    setIncomingCall(state, action: PayloadAction<CallState['incomingCall']>) {
      state.incomingCall = action.payload;
    },
    clearIncomingCall(state) {
      state.incomingCall = null;
    },
    updateCallStatus(
      state,
      action: PayloadAction<{ sessionId: string; status: CallRecord['status']; endedAt?: string; duration?: number }>,
    ) {
      const record = state.records.find((r) => r.sessionId === action.payload.sessionId);
      if (record) {
        record.status = action.payload.status;
        if (action.payload.endedAt) record.endedAt = action.payload.endedAt;
        if (action.payload.duration !== undefined) record.duration = action.payload.duration;
      }
    },
  },
});

export const { addCallRecord, setIncomingCall, clearIncomingCall, updateCallStatus } = callSlice.actions;
export default callSlice.reducer;
