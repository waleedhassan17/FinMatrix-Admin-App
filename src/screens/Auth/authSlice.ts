// ═══════════════════════════════════════════════════════
// FinMatrix — Global Auth Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Holds global auth state only (user session, onboarding flag, role).
// Per-screen state/thunks live in their own co-located slices.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { User, UserRole } from '../../types';

export interface AuthSliceState {
  user: User | null;
  pendingUser: User | null;
  isAuthenticated: boolean;
  hasSeenOnboarding: boolean;
  hasSeenDeliveryOnboarding: boolean;
  selectedRole: UserRole | null;
  error: string;
  status: 'idle' | 'loading' | 'failed';
}

const initialState: AuthSliceState = {
  user: null,
  pendingUser: null,
  isAuthenticated: false,
  hasSeenOnboarding: false,
  hasSeenDeliveryOnboarding: false,
  selectedRole: null,
  error: '',
  status: 'idle',
};

export const authSlice = createAppSlice({
  name: 'auth',
  initialState,
  reducers: create => ({
    setUser: create.reducer((state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.pendingUser = null;
      state.isAuthenticated = true;
      state.error = '';
    }),
    setPendingUser: create.reducer((state, action: PayloadAction<User>) => {
      state.pendingUser = action.payload;
    }),
    clearUser: create.reducer(state => {
      state.user = null;
      state.pendingUser = null;
      state.isAuthenticated = false;
      state.selectedRole = null;
    }),
    signOut: create.reducer(state => {
      state.user = null;
      state.pendingUser = null;
      state.isAuthenticated = false;
      state.selectedRole = null;
      state.hasSeenDeliveryOnboarding = false;
      state.error = '';
      state.status = 'idle';
    }),
    setOnboardingSeen: create.reducer(state => {
      state.hasSeenOnboarding = true;
    }),
    setDeliveryOnboardingSeen: create.reducer(state => {
      state.hasSeenDeliveryOnboarding = true;
    }),
    setSelectedRole: create.reducer(
      (state, action: PayloadAction<UserRole>) => {
        state.selectedRole = action.payload;
      },
    ),
    setAuthLoading: create.reducer(
      (state, action: PayloadAction<boolean>) => {
        state.status = action.payload ? 'loading' : 'idle';
      },
    ),
    setAuthError: create.reducer(
      (state, action: PayloadAction<string>) => {
        state.error = action.payload;
      },
    ),
    clearAuthError: create.reducer(state => {
      state.error = '';
    }),
  }),

  selectors: {
    selectUser: state => state.user,
    // Three-tier model: which app the user sees + what their company may do.
    selectCompanyType: state => state.user?.companyType ?? null,
    selectFeatures: state => state.user?.features ?? null,
    selectPendingUser: state => state.pendingUser,
    selectIsAuthenticated: state => state.isAuthenticated,
    selectHasSeenOnboarding: state => state.hasSeenOnboarding,
    selectHasSeenDeliveryOnboarding: state => state.hasSeenDeliveryOnboarding,
    selectSelectedRole: state => state.selectedRole,
    selectAuthStatus: state => state.status,
    selectAuthError: state => state.error,
  },
});

export const {
  setUser,
  setPendingUser,
  clearUser,
  signOut,
  setOnboardingSeen,
  setDeliveryOnboardingSeen,
  setSelectedRole,
  setAuthLoading,
  setAuthError,
  clearAuthError,
} = authSlice.actions;

export const {
  selectUser,
  selectCompanyType,
  selectFeatures,
  selectPendingUser,
  selectIsAuthenticated,
  selectHasSeenOnboarding,
  selectHasSeenDeliveryOnboarding,
  selectSelectedRole,
  selectAuthStatus,
  selectAuthError,
} = authSlice.selectors;

export default authSlice.reducer;
