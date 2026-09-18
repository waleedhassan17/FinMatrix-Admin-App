import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

export interface AdminDeliveryDetailSliceState {
  showReassignPanel: boolean;
  reassignPersonnelId: string;
  showCancelConfirm: boolean;
}

const initialState: AdminDeliveryDetailSliceState = {
  showReassignPanel: false,
  reassignPersonnelId: '',
  showCancelConfirm: false,
};

export const adminDeliveryDetailSlice = createAppSlice({
  name: 'adminDeliveryDetail',
  initialState,
  reducers: create => ({
    toggleReassignPanel: create.reducer(state => {
      state.showReassignPanel = !state.showReassignPanel;
      if (!state.showReassignPanel) state.reassignPersonnelId = '';
    }),
    setReassignPersonnelId: create.reducer((state, action: PayloadAction<string>) => {
      state.reassignPersonnelId = action.payload;
    }),
    toggleCancelConfirm: create.reducer(state => {
      state.showCancelConfirm = !state.showCancelConfirm;
    }),
    resetDetailUIState: create.reducer(() => initialState),
  }),
  selectors: {
    selectDetailUIState: state => state,
  },
});

export const {
  toggleReassignPanel,
  setReassignPersonnelId,
  toggleCancelConfirm,
  resetDetailUIState,
} = adminDeliveryDetailSlice.actions;

export const { selectDetailUIState } = adminDeliveryDetailSlice.selectors;
