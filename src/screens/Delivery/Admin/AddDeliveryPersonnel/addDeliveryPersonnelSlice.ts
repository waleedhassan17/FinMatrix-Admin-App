import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

export interface AddDeliveryPersonnelSliceState {
  activeTab: 'invite' | 'quickadd';
  status: 'idle' | 'loading' | 'failed';
  error: string;
}

const initialState: AddDeliveryPersonnelSliceState = {
  activeTab: 'invite',
  status: 'idle',
  error: '',
};

export const addDeliveryPersonnelSlice = createAppSlice({
  name: 'addDeliveryPersonnel',
  initialState,
  reducers: create => ({
    setActiveTab: create.reducer(
      (state, action: PayloadAction<'invite' | 'quickadd'>) => {
        state.activeTab = action.payload;
      },
    ),
    setAddPersonnelError: create.reducer(
      (state, action: PayloadAction<string>) => {
        state.status = 'failed';
        state.error = action.payload;
      },
    ),
    resetAddDeliveryPersonnel: create.reducer(state => {
      state.activeTab = 'invite';
      state.status = 'idle';
      state.error = '';
    }),
  }),

  selectors: {
    selectActiveTab: state => state.activeTab,
    selectAddPersonnelStatus: state => state.status,
    selectAddPersonnelError: state => state.error,
  },
});

export const {
  setActiveTab,
  setAddPersonnelError,
  resetAddDeliveryPersonnel,
} = addDeliveryPersonnelSlice.actions;

export const {
  selectActiveTab,
  selectAddPersonnelStatus,
  selectAddPersonnelError,
} = addDeliveryPersonnelSlice.selectors;
