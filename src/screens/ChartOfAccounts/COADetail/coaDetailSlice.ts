// ═══════════════════════════════════════════════════════
// FinMatrix — COA Detail Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Co-located with COADetailScreen.tsx
// Manages detail-screen UI state: active tab.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

export type DetailTab = 'transactions' | 'info';

export interface COADetailSliceState {
  activeTab: DetailTab;
  status: 'idle' | 'loading' | 'failed';
  error: string;
}

const initialState: COADetailSliceState = {
  activeTab: 'transactions',
  status: 'idle',
  error: '',
};

export const coaDetailSlice = createAppSlice({
  name: 'coaDetail',
  initialState,
  reducers: create => ({
    setActiveTab: create.reducer((state, action: PayloadAction<DetailTab>) => {
      state.activeTab = action.payload;
    }),
    resetCoaDetail: create.reducer(state => {
      state.activeTab = 'transactions';
      state.status = 'idle';
      state.error = '';
    }),
  }),

  selectors: {
    selectActiveTab: state => state.activeTab,
    selectCoaDetailStatus: state => state.status,
    selectCoaDetailError: state => state.error,
  },
});

export const { setActiveTab, resetCoaDetail } = coaDetailSlice.actions;

export const {
  selectActiveTab,
  selectCoaDetailStatus,
  selectCoaDetailError,
} = coaDetailSlice.selectors;
