import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

export interface JoinCompanySliceState {
  inviteCode: string;
  status: 'idle' | 'loading' | 'failed';
  error: string;
}

const initialState: JoinCompanySliceState = {
  inviteCode: '',
  status: 'idle',
  error: '',
};

export const joinCompanySlice = createAppSlice({
  name: 'joinCompany',
  initialState,
  reducers: create => ({
    setInviteCode: create.reducer(
      (state, action: PayloadAction<string>) => {
        state.inviteCode = action.payload;
      },
    ),
    setJoinCompanyError: create.reducer(
      (state, action: PayloadAction<string>) => {
        state.status = 'failed';
        state.error = action.payload;
      },
    ),
    resetJoinCompany: create.reducer(state => {
      state.inviteCode = '';
      state.status = 'idle';
      state.error = '';
    }),
  }),

  selectors: {
    selectJoinInviteCode: state => state.inviteCode,
    selectJoinCompanyStatus: state => state.status,
    selectJoinCompanyError: state => state.error,
  },
});

export const {
  setInviteCode,
  setJoinCompanyError,
  resetJoinCompany,
} = joinCompanySlice.actions;

export const {
  selectJoinInviteCode,
  selectJoinCompanyStatus,
  selectJoinCompanyError,
} = joinCompanySlice.selectors;
