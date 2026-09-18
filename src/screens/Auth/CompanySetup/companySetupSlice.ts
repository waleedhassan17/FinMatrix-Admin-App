import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

export interface CompanySetupSliceState {
  status: 'idle' | 'loading' | 'failed';
  error: string;
}

const initialState: CompanySetupSliceState = {
  status: 'idle',
  error: '',
};

export const companySetupSlice = createAppSlice({
  name: 'companySetup',
  initialState,
  reducers: create => ({
    setCompanySetupLoading: create.reducer(state => {
      state.status = 'loading';
      state.error = '';
    }),
    setCompanySetupError: create.reducer(
      (state, action: PayloadAction<string>) => {
        state.status = 'failed';
        state.error = action.payload;
      },
    ),
    resetCompanySetup: create.reducer(state => {
      state.status = 'idle';
      state.error = '';
    }),
  }),

  selectors: {
    selectCompanySetupStatus: state => state.status,
    selectCompanySetupError: state => state.error,
  },
});

export const {
  setCompanySetupLoading,
  setCompanySetupError,
  resetCompanySetup,
} = companySetupSlice.actions;

export const {
  selectCompanySetupStatus,
  selectCompanySetupError,
} = companySetupSlice.selectors;
