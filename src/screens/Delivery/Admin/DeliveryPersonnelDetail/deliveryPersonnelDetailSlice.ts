import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

export interface DeliveryPersonnelDetailSliceState {
  activeSection: 'assignments' | 'history';
  status: 'idle' | 'loading' | 'failed';
  error: string;
}

const initialState: DeliveryPersonnelDetailSliceState = {
  activeSection: 'assignments',
  status: 'idle',
  error: '',
};

export const deliveryPersonnelDetailSlice = createAppSlice({
  name: 'deliveryPersonnelDetail',
  initialState,
  reducers: create => ({
    setActiveSection: create.reducer(
      (state, action: PayloadAction<'assignments' | 'history'>) => {
        state.activeSection = action.payload;
      },
    ),
    resetDeliveryPersonnelDetail: create.reducer(state => {
      state.activeSection = 'assignments';
      state.status = 'idle';
      state.error = '';
    }),
  }),

  selectors: {
    selectActiveSection: state => state.activeSection,
    selectDetailStatus: state => state.status,
  },
});

export const {
  setActiveSection,
  resetDeliveryPersonnelDetail,
} = deliveryPersonnelDetailSlice.actions;

export const {
  selectActiveSection,
  selectDetailStatus,
} = deliveryPersonnelDetailSlice.selectors;
