import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { authLogin, authDeliveryLogin, AuthError } from '@networks/auth/authNetwork';
import type { SignInPayload, DeliverySignInPayload } from '@networks/auth/authNetwork';
import type { User } from '@/types';

export interface SignInSliceState {
  email: string;
  username: string;
  password: string;
  rememberMe: boolean;
  error: string;
  status: 'idle' | 'loading' | 'failed';
}

const initialState: SignInSliceState = {
  email: '',
  username: '',
  password: '',
  rememberMe: false,
  error: '',
  status: 'idle',
};

export const signInSlice = createAppSlice({
  name: 'signIn',
  initialState,
  reducers: create => ({
    setEmail: create.reducer((state, action: PayloadAction<string>) => {
      state.email = action.payload;
    }),
    setUsername: create.reducer((state, action: PayloadAction<string>) => {
      state.username = action.payload;
    }),
    setPassword: create.reducer((state, action: PayloadAction<string>) => {
      state.password = action.payload;
    }),
    setRememberMe: create.reducer((state, action: PayloadAction<boolean>) => {
      state.rememberMe = action.payload;
    }),
    clearSignInError: create.reducer(state => {
      state.error = '';
    }),
    resetSignInForm: create.reducer(state => {
      state.email = '';
      state.username = '';
      state.password = '';
      state.rememberMe = false;
      state.error = '';
      state.status = 'idle';
    }),

    submitSignInAsync: create.asyncThunk(
      async (
        { email, password }: { email: string; password: string },
        { rejectWithValue },
      ) => {
        const payload: SignInPayload = { email, password };
        try {
          const result = await authLogin({ signInInfo: payload });
          return result?.data;
        } catch (e: any) {
          // Preserve the structured login-gate info (code + reason) through the
          // thunk; the default error serialization would drop custom fields.
          if (e instanceof AuthError) {
            return rejectWithValue({
              code: e.code,
              message: e.message,
              email: e.email,
              companyStatus: e.companyStatus,
              rejectionReason: e.rejectionReason,
              pendingKind: e.pendingKind,
            });
          }
          return rejectWithValue({ message: e?.message ?? 'Sign in failed' });
        }
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = '';
        },
        fulfilled: (state, _action) => {
          state.status = 'idle';
          state.error = '';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          const payload = action.payload as { message?: string } | undefined;
          state.error = payload?.message ?? action.error.message ?? 'Sign in failed';
        },
      },
    ),

    submitDeliverySignInAsync: create.asyncThunk(
      async ({ username, password }: { username: string; password: string }) => {
        const payload: DeliverySignInPayload = { username, password };
        const result = await authDeliveryLogin({ signInInfo: payload });
        return result?.data;
      },
      {
        pending: state => {
          state.status = 'loading';
          state.error = '';
        },
        fulfilled: (state, _action) => {
          state.status = 'idle';
          state.error = '';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = action.error.message ?? 'Sign in failed';
        },
      },
    ),
  }),

  selectors: {
    selectSignInEmail: state => state.email,
    selectSignInUsername: state => state.username,
    selectSignInPassword: state => state.password,
    selectSignInRememberMe: state => state.rememberMe,
    selectSignInStatus: state => state.status,
    selectSignInError: state => state.error,
  },
});

export const {
  setEmail,
  setUsername,
  setPassword,
  setRememberMe,
  clearSignInError,
  resetSignInForm,
  submitSignInAsync,
  submitDeliverySignInAsync,
} = signInSlice.actions;

export const {
  selectSignInEmail,
  selectSignInUsername,
  selectSignInPassword,
  selectSignInRememberMe,
  selectSignInStatus,
  selectSignInError,
} = signInSlice.selectors;
