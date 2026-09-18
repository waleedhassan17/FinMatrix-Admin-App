import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { authForgotPassword } from '@networks/auth/authNetwork';
import type { ForgotPasswordPayload } from '@networks/auth/authNetwork';

export interface ForgotPasswordSliceState {
  email: string;
  emailSent: boolean;
  sentEmail: string;
  resendCooldown: number;
  error: string;
  status: 'idle' | 'loading' | 'failed';
}

const initialState: ForgotPasswordSliceState = {
  email: '',
  emailSent: false,
  sentEmail: '',
  resendCooldown: 0,
  error: '',
  status: 'idle',
};

export const forgotPasswordSlice = createAppSlice({
  name: 'forgotPassword',
  initialState,
  reducers: create => ({
    setForgotEmail: create.reducer(
      (state, action: PayloadAction<string>) => {
        state.email = action.payload;
      },
    ),
    setEmailSent: create.reducer(
      (state, action: PayloadAction<boolean>) => {
        state.emailSent = action.payload;
      },
    ),
    setSentEmail: create.reducer(
      (state, action: PayloadAction<string>) => {
        state.sentEmail = action.payload;
      },
    ),
    setResendCooldown: create.reducer(
      (state, action: PayloadAction<number>) => {
        state.resendCooldown = action.payload;
      },
    ),
    decrementCooldown: create.reducer(state => {
      if (state.resendCooldown > 0) {
        state.resendCooldown -= 1;
      }
    }),
    clearForgotPasswordError: create.reducer(state => {
      state.error = '';
    }),
    resetForgotPasswordForm: create.reducer(state => {
      Object.assign(state, initialState);
    }),

    submitForgotPasswordAsync: create.asyncThunk(
      async ({ email }: { email: string }) => {
        const payload: ForgotPasswordPayload = { email };
        const result = await authForgotPassword({
          forgotPasswordInfo: payload,
        });
        return result?.data;
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = '';
        },
        fulfilled: (state, _action) => {
          state.status = 'idle';
          state.emailSent = true;
          state.sentEmail = state.email.trim();
          state.resendCooldown = 30;
          state.error = '';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error =
            action.error.message ?? 'Failed to send reset instructions';
        },
      },
    ),
  }),

  selectors: {
    selectForgotEmail: state => state.email,
    selectEmailSent: state => state.emailSent,
    selectSentEmail: state => state.sentEmail,
    selectForgotResendCooldown: state => state.resendCooldown,
    selectForgotPasswordStatus: state => state.status,
    selectForgotPasswordError: state => state.error,
    selectForgotPasswordIsLoading: state => state.status === 'loading',
    selectIsFormComplete: state => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return (
        state.email.trim().length > 0 && emailRegex.test(state.email.trim())
      );
    },
  },
});

export const {
  setForgotEmail,
  setEmailSent,
  setSentEmail,
  setResendCooldown,
  decrementCooldown,
  clearForgotPasswordError,
  resetForgotPasswordForm,
  submitForgotPasswordAsync,
} = forgotPasswordSlice.actions;

export const {
  selectForgotEmail,
  selectEmailSent,
  selectSentEmail,
  selectForgotResendCooldown,
  selectForgotPasswordStatus,
  selectForgotPasswordError,
  selectForgotPasswordIsLoading,
  selectIsFormComplete,
} = forgotPasswordSlice.selectors;
