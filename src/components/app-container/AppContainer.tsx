// ═══════════════════════════════════════════════════════
// FinMatrix — Root AppContainer
// ═══════════════════════════════════════════════════════
// Top-level app shell rendered inside Provider/PersistGate
// (Consultant_Mobile convention). Owns: session bootstrap (fetch-me),
// the renderNavigator() role/tier switch, navigation container, deep
// linking, status bar, splash overlay, and toast notifications.

import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import {
  NavigationContainer,
  LinkingOptions,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import type { RootStackParamList } from '../../types';

import BaseNavigator from '../../navigators/BaseNavigator';
import AdminTabNavigator from '../../navigators/AdminTabNavigator';
import DeliveryTabNavigator from '../../navigators/DeliveryTabNavigator';
import StaffTabNavigator from '../../navigators/StaffTabNavigator';
import SuperAdminNavigator from '../../navigators/SuperAdminNavigator';
import SmallBusinessNavigator from '../../navigators/tiers/SmallBusinessNavigator';
import LargeOrgNavigator from '../../navigators/tiers/LargeOrgNavigator';
import SplashOverlay from '../../screens/Splash/SplashScreen';
import TrialBanner from '../shared/TrialBanner';

import { bootstrapSession, selectIsAppReady } from './appContainerSlice';
import {
  selectIsAuthenticated,
  selectUser,
  signOut,
} from '../../screens/Auth/authSlice';
import {
  setSessionExpiredHandler,
  setCompanyStatusStaleHandler,
  setRiderSeatLockedHandler,
} from '../../utils/authEvents';
import { clearTokens } from '../../utils/storageUtils';
import { WAREHOUSE_ONLY_BUILD } from '../../utils/featureGates';
import { resetSignInForm } from '../../screens/Auth/SignIn/signInSlice';
import { resetSignUpForm } from '../../screens/Auth/SignUp/signUpSlice';
import { resetForgotPasswordForm } from '../../screens/Auth/ForgotPassword/forgotPasswordSlice';
import { resetVerificationForm } from '../../screens/Auth/EmailVerification/emailVerificationSlice';
import { THEME } from '../../theme';

// Design-system tokens (see src/theme/theme.ts).
const { colors } = THEME;

// Lets chrome that sits OUTSIDE the navigators (the trial banner) navigate.
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// ─── Deep linking (Stage 1) ──────────────────────────
// finmatrix://verify-email?token=...  → Email verification screen
// finmatrix://reset-password          → Forgot-password (OTP) screen
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['finmatrix://'],
  config: {
    screens: {
      EmailVerification: 'verify-email',
      ForgotPassword: 'reset-password',
    },
  },
};

// Splash plays only once per app cold start (module-level flag survives
// AppContainer remounts, resets on process restart).
let splashHasPlayed = false;

export const AppContainer: React.FC = () => {
  const dispatch = useAppDispatch();
  const isAppReady = useAppSelector(selectIsAppReady);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const user = useAppSelector(selectUser);
  const [showSplash, setShowSplash] = React.useState(!splashHasPlayed);

  // ─── Session restore on cold start (Consultant_Mobile fetchMe pattern):
  // stored token → GET /auth/me refreshes the user and the app opens on
  // their view; missing/invalid token → sign-in. Sets isAppReady when done.
  useEffect(() => {
    dispatch(bootstrapSession());
  }, [dispatch]);

  // ─── Session-expired bridge: when the axios 401-refresh flow gives up it
  // has already cleared the stored tokens; this handler resets the store so
  // the navigator switches back to sign-in instead of leaving the user on
  // authenticated screens whose every request fails.
  useEffect(() => {
    setSessionExpiredHandler(() => {
      dispatch(signOut());
      Toast.show({
        type: 'info',
        text1: 'Session expired',
        text2: 'Please sign in again.',
      });
    });
    return () => setSessionExpiredHandler(null);
  }, [dispatch]);

  // ─── Company-status-stale bridge: a business request 403'd with
  // COMPANY_NOT_ACTIVE (subscription expired mid-session, account
  // deactivated, …). Re-run the session bootstrap — /auth/me returns the
  // fresh companyStatus, setUser updates Redux, and renderNavigator swaps to
  // the matching gate (RenewSubscription for inactive). Debounced: a screen
  // firing several requests at once must trigger only one refresh.
  const statusRefreshAt = React.useRef(0);
  useEffect(() => {
    setCompanyStatusStaleHandler(() => {
      const now = Date.now();
      if (now - statusRefreshAt.current < 5000) return;
      statusRefreshAt.current = now;
      dispatch(bootstrapSession());
    });
    return () => setCompanyStatusStaleHandler(null);
  }, [dispatch]);

  // ─── Rider-seat-locked bridge: a rider's request 403'd with
  // RIDER_SEAT_LOCKED — the company's plan no longer covers their seat. The
  // rider can do nothing in the app until the owner frees a seat, so sign
  // them out and say why (the server's message names the fix).
  useEffect(() => {
    setRiderSeatLockedHandler(message => {
      void clearTokens().finally(() => {
        dispatch(signOut());
        Toast.show({ type: 'info', text1: 'Signed out', text2: message });
      });
    });
    return () => setRiderSeatLockedHandler(null);
  }, [dispatch]);

  // One /auth/me re-read when a trialing owner returns to the app, so an
  // approval or conversion that happened meanwhile is reflected.
  const refreshSession = React.useCallback(() => {
    dispatch(bootstrapSession());
  }, [dispatch]);

  // The trial banner's Subscribe → the plan chooser in the More stack.
  const openSubscribe = React.useCallback(() => {
    if (!navigationRef.isReady()) return;
    (navigationRef.navigate as (...args: unknown[]) => void)('MoreStack', {
      screen: 'RenewSubscription',
      params: { mode: 'change' },
    });
  }, []);

  // ─── Clear auth form slices when user becomes authenticated ──
  useEffect(() => {
    if (isAuthenticated && user) {
      dispatch(resetSignInForm());
      dispatch(resetSignUpForm());
      dispatch(resetForgotPasswordForm());
      dispatch(resetVerificationForm());
    }
  }, [isAuthenticated, user, dispatch]);

  // ─── Which top-level navigator mounts (was BaseNavigator's role switch).
  // Role first (riders/super-admins have no company gates); an approved,
  // email-verified admin gets their tier's app; every other state —
  // unauthenticated, email verify, pending, inactive, rejected, draft,
  // onboarding — is a session gate handled inside BaseNavigator.
  const renderNavigator = () => {
    if (!isAuthenticated || !user) {
      return <BaseNavigator key="base-unauthenticated" />;
    }
    if (user.role === 'super_admin') {
      return <SuperAdminNavigator key="super-admin" />;
    }
    if (user.role === 'delivery') {
      return <DeliveryTabNavigator key="delivery" />;
    }
    // Staff belong to a company like an owner does, but they get their own
    // navigator rather than the owner's with items hidden — StaffMoreStack
    // simply does not register Settings, User management, Chart of Accounts or
    // the approvals inbox, so those screens are unreachable rather than merely
    // invisible. Placed before the tier block because the role decides the app,
    // and the company's tier only decides what is inside it.
    if (user.role === 'staff') {
      return <StaffTabNavigator key="staff" />;
    }

    const companyStatus = user.companyStatus ?? null;
    const emailVerified = user.isEmailVerified !== false; // default true (legacy)
    const isApproved =
      companyStatus === 'approved' || companyStatus === 'active';

    if (emailVerified && isApproved) {
      // ── WAREHOUSE-ONLY BUILD ──────────────────────────────────────────
      // Every approved admin mounts the full AdminTabNavigator, which ships
      // the complete warehouse route set. Existing small_business/large_org
      // companies land here too and keep working — AdminTabNavigator is a
      // superset of what their tier navigators offered.
      //
      // Restore the three-tier switch by flipping WAREHOUSE_ONLY_BUILD in
      // utils/featureGates.ts and un-commenting the block below.
      if (WAREHOUSE_ONLY_BUILD) {
        return (
          <TrialBanner
            key="tier-admin"
            subscription={user.subscription}
            onSubscribe={openSubscribe}
            onForegroundRefresh={refreshSession}
          >
            <AdminTabNavigator />
          </TrialBanner>
        );
      }

      // ── Three-tier model (FinMatrix.md): small_business / large_org mount
      // their own navigators; warehouse and legacy (no companyType) keep the
      // full AdminTabNavigator. Server-side FeatureGuard 403s remain the real
      // enforcement — this is the matching UX.
      switch (user.companyType ?? null) {
        case 'small_business':
          return <SmallBusinessNavigator key="tier-small-business" />;
        case 'large_org':
          return <LargeOrgNavigator key="tier-large-org" />;
        default:
          return <AdminTabNavigator key="tier-admin" />;
      }
    }

    return <BaseNavigator key="base-gates" />;
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        {isAppReady ? (
          <NavigationContainer ref={navigationRef} linking={linking}>
            {renderNavigator()}
          </NavigationContainer>
        ) : (
          // Session restore still in flight after the splash finished.
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.actionGreen} />
          </View>
        )}
        {showSplash && (
          <SplashOverlay
            onFinish={() => {
              splashHasPlayed = true;
              setShowSplash(false);
            }}
          />
        )}
      </View>
      <Toast />
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral50,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

export default AppContainer;
