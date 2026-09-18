// ═══════════════════════════════════════════════════════
// FinMatrix — App Container Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Holds app-level state: readiness, network status, current user fetch.
// Lives alongside AppContainer.tsx in components/app-container/

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '../../store/createAppSlice';
import { authMe } from '../../networks/auth/authNetwork';
import { getAccessToken, clearTokens, setStoredCompanyId } from '../../utils/storageUtils';
import { setUser, signOut } from '../../screens/Auth/authSlice';

export interface AppContainerSliceState {
  error: string;
  status: 'idle' | 'loading' | 'failed';
  isAppReady: boolean;
  networkIsDown: boolean;
}

const initialState: AppContainerSliceState = {
  error: '',
  status: 'idle',
  isAppReady: false,
  networkIsDown: false,
};

export const appContainerSlice = createAppSlice({
  name: 'appContainer',
  initialState,
  reducers: create => ({
    setAppIsReady: create.reducer(
      (state, action: PayloadAction<boolean>) => {
        state.isAppReady = action.payload;
      },
    ),
    setNetworkIsDown: create.reducer(
      (state, action: PayloadAction<boolean>) => {
        state.networkIsDown = action.payload;
      },
    ),
    setAppError: create.reducer(
      (state, action: PayloadAction<string>) => {
        state.error = action.payload;
      },
    ),
    clearAppError: create.reducer(state => {
      state.error = '';
    }),

    /**
     * Session restore (Consultant_Mobile's fetchMe pattern): on cold start,
     * if an access token is stored, refresh the current user from
     * GET /auth/me — the user goes straight to their view without signing
     * in again until the token is invalid/expired. The axios client already
     * attaches the Bearer token and silently refreshes on 401 via the
     * stored refresh token, so this call also rolls expired access tokens.
     *
     *   token missing        → app ready, unauthenticated (sign-in)
     *   authMe OK            → auth slice hydrated with the FRESH user
     *                          (role/companyStatus/companyType/features may
     *                          have changed server-side) → straight in
     *   authMe 401/rejected  → tokens cleared, signed out → sign-in
     *   network unreachable  → keep the last persisted session (offline
     *                          tolerant); server gates re-verify on use
     */
    bootstrapSession: create.asyncThunk(
      async (_: void, { dispatch }) => {
        const token = await getAccessToken();
        if (!token) {
          // No token ⇒ no session. Also reconciles a stale persisted
          // isAuthenticated (tokens wiped outside a normal sign-out).
          dispatch(signOut());
          return { restored: false as const };
        }
        try {
          const me = await authMe();
          const user = me?.data?.user;
          if (!user) throw new Error('Empty /auth/me response');
          if (me.data.companyId) {
            await setStoredCompanyId(me.data.companyId);
          }
          dispatch(setUser({ ...user, companyId: me.data.companyId ?? user.companyId }));
          return { restored: true as const };
        } catch (e: any) {
          const message = String(e?.message ?? '');
          const isNetworkIssue = /network|timeout|abort/i.test(message);
          if (!isNetworkIssue) {
            // Invalid/expired session — clear it so the user lands on sign-in.
            await clearTokens();
            dispatch(signOut());
          }
          return { restored: false as const };
        }
      },
      {
        pending: state => {
          state.status = 'loading';
        },
        fulfilled: state => {
          state.status = 'idle';
          state.isAppReady = true;
        },
        rejected: state => {
          state.status = 'idle';
          state.isAppReady = true;
        },
      },
    ),
  }),

  // Belt-and-braces for the stuck-spinner class of bug: signing out must never
  // make the shell "not ready". store.ts already preserves this slice through
  // the sign-out wipe; this guarantees the invariant even if that changes.
  extraReducers: builder => {
    builder.addCase(signOut, state => {
      state.isAppReady = true;
      state.status = 'idle';
      state.error = '';
    });
  },

  selectors: {
    selectAppStatus: state => state.status,
    selectAppError: state => state.error,
    selectIsAppReady: state => state.isAppReady,
    selectNetworkIsDown: state => state.networkIsDown,
  },
});

export const {
  setAppIsReady,
  setNetworkIsDown,
  setAppError,
  clearAppError,
  bootstrapSession,
} = appContainerSlice.actions;

export const {
  selectAppStatus,
  selectAppError,
  selectIsAppReady,
  selectNetworkIsDown,
} = appContainerSlice.selectors;
