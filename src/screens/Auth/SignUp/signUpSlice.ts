import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { authRegister } from '@networks/auth/authNetwork';
import type { RegisterPayload } from '@networks/auth/authNetwork';
import type { User } from '@/types';

export interface SignUpSliceState {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
  error: string;
  status: 'idle' | 'loading' | 'failed';
}

const initialState: SignUpSliceState = {
  fullName: '',
  email: '',
  // Empty, not '+92 ': the prefill was submitted verbatim when the user left
  // the field alone and failed server validation. The input's placeholder
  // carries the hint instead — every PK format is accepted anyway.
  phone: '',
  password: '',
  confirmPassword: '',
  acceptedTerms: false,
  error: '',
  status: 'idle',
};

export const signUpSlice = createAppSlice({
  name: 'signUp',
  initialState,
  reducers: create => ({
    setFullName: create.reducer((state, action: PayloadAction<string>) => {
      state.fullName = action.payload;
    }),
    setSignUpEmail: create.reducer((state, action: PayloadAction<string>) => {
      state.email = action.payload;
    }),
    setPhone: create.reducer((state, action: PayloadAction<string>) => {
      state.phone = action.payload;
    }),
    setSignUpPassword: create.reducer(
      (state, action: PayloadAction<string>) => {
        state.password = action.payload;
      },
    ),
    setConfirmPassword: create.reducer(
      (state, action: PayloadAction<string>) => {
        state.confirmPassword = action.payload;
      },
    ),
    setAcceptedTerms: create.reducer(
      (state, action: PayloadAction<boolean>) => {
        state.acceptedTerms = action.payload;
      },
    ),
    clearSignUpError: create.reducer(state => {
      state.error = '';
    }),
    resetSignUpForm: create.reducer(state => {
      Object.assign(state, initialState);
    }),

    submitSignUpAsync: create.asyncThunk(
      async ({
        fullName,
        email,
        phone,
        password,
      }: {
        fullName: string;
        email: string;
        phone: string;
        password: string;
      }) => {
        const payload: RegisterPayload = {
          fullName,
          email,
          phone,
          password,
        };
        const result = await authRegister({ registerInfo: payload });
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
          state.error = action.error.message ?? 'Registration failed';
        },
      },
    ),
  }),

  selectors: {
    selectSignUpFullName: state => state.fullName,
    selectSignUpEmail: state => state.email,
    selectSignUpPhone: state => state.phone,
    selectSignUpPassword: state => state.password,
    selectSignUpConfirmPassword: state => state.confirmPassword,
    selectSignUpAcceptedTerms: state => state.acceptedTerms,
    selectSignUpStatus: state => state.status,
    selectSignUpError: state => state.error,
  },
});

export const {
  setFullName,
  setSignUpEmail,
  setPhone,
  setSignUpPassword,
  setConfirmPassword,
  setAcceptedTerms,
  clearSignUpError,
  resetSignUpForm,
  submitSignUpAsync,
} = signUpSlice.actions;

export const {
  selectSignUpFullName,
  selectSignUpEmail,
  selectSignUpPhone,
  selectSignUpPassword,
  selectSignUpConfirmPassword,
  selectSignUpAcceptedTerms,
  selectSignUpStatus,
  selectSignUpError,
} = signUpSlice.selectors;
