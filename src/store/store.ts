import { configureStore, combineReducers } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import autoMergeLevel2 from 'redux-persist/lib/stateReconciler/autoMergeLevel2';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Global slices ──
import authReducer from '../screens/Auth/authSlice';

// ── App-level slices ──
import { appContainerSlice } from '../components/app-container/appContainerSlice';
import { realtimeMiddleware } from './realtimeMiddleware';

// ── Per-screen slices ──
import { signInSlice } from '../screens/Auth/SignIn/signInSlice';
import { forgotPasswordSlice } from '../screens/Auth/ForgotPassword/forgotPasswordSlice';
import { superAdminSlice } from '../screens/SuperAdmin/superAdminSlice';

// The tenant app registers ~114 reducers here, one per screen. Because
// hooks/useReduxHooks types itself against RootState, this file is a dominator
// of the whole module graph: every screen that imports useAppSelector
// transitively reaches every slice listed here. That is why it is rewritten
// before any screen directory is deleted rather than after — shrinking this
// list is what actually severs the graph.
//
// `company` is gone along with the rest: a platform admin has no company, and
// the slice's last console-side consumer was components/reports/ReportUI,
// which the SuperAdmin screens no longer import (CHART_SERIES and HEADER_NAVY
// moved to theme/, where a palette belongs).
const rootReducer = combineReducers({
  auth: authReducer,
  appContainer: appContainerSlice.reducer,
  signIn: signInSlice.reducer,
  forgotPassword: forgotPasswordSlice.reducer,
  superAdmin: superAdminSlice.reducer,
});

// Sign-out must wipe the WHOLE store, not just the auth slice: superAdmin
// caches the previous admin's platform data (companies, the payment queue,
// revenue), and none of it may leak into the next session. Handing
// combineReducers only the auth slice resets every other slice to its initial
// state, while authSlice's own signOut reducer still runs. redux-persist then
// flushes the reset whitelist slices back to AsyncStorage.
//
// `appContainer` must SURVIVE the wipe alongside `auth`. It holds no user data
// — only app-shell readiness — and AppContainer dispatches bootstrapSession()
// once, on mount. Resetting the slice to its initialState (isAppReady: false)
// while AppContainer stays mounted left the app on a permanent spinner that
// only a manual reload could clear, on every sign-out AND on the 401
// session-expired bridge.
const appReducer: typeof rootReducer = (state, action) => {
  if (state && action.type === 'auth/signOut') {
    state = {
      auth: state.auth,
      appContainer: state.appContainer,
    } as typeof state;
  }
  return rootReducer(state, action);
};

const persistConfig = {
  // Distinct from the tenant app's 'finmatrix-root'. On web the two share a
  // localStorage origin, and rehydrating a tenant session into the console
  // would half-authenticate it instead of failing cleanly.
  key: 'finmatrix-admin-root',
  storage: AsyncStorage,
  // Only `auth`, so a cold start opens on the console rather than on sign-in.
  // `superAdmin` is deliberately absent: it is all server state, and a stale
  // company list or payment queue read from disk is worse than a spinner.
  whitelist: ['auth'],
  stateReconciler: autoMergeLevel2 as any,
};

const persistedReducer = persistReducer(persistConfig, appReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      // Dev-only safety scans. These middlewares are stripped from production
      // builds automatically.
      immutableCheck: { warnAfter: 128 },
      serializableCheck: {
        warnAfter: 128,
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(realtimeMiddleware),
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
