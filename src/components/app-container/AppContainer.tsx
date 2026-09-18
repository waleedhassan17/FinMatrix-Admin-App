// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Root AppContainer
// ═══════════════════════════════════════════════════════
// Top-level app shell rendered inside Provider/PersistGate
// (Consultant_Mobile convention). Owns: session bootstrap (fetch-me),
// the renderNavigator() switch, navigation container, deep linking,
// status bar, splash overlay, and toast notifications.
//
// The tenant app branches five ways here — rider, staff, and an approved
// admin's company tier, each behind an email-verification and company-status
// gate. The console has none of that: a platform admin has no company, so
// there is nothing to gate on. Signed out → sign-in; signed in as a platform
// admin → the console. The third branch is a dead end, not a gate.

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
import SuperAdminNavigator from '../../navigators/SuperAdminNavigator';
import SplashOverlay from '../../screens/Splash/SplashScreen';
import NotAuthorizedScreen from './NotAuthorizedScreen';

import { bootstrapSession, selectIsAppReady } from './appContainerSlice';
import {
  selectIsAuthenticated,
  selectUser,
  signOut,
} from '../../screens/Auth/authSlice';
import { setSessionExpiredHandler } from '../../utils/authEvents';
import { resetSignInForm } from '../../screens/Auth/SignIn/signInSlice';
import { resetForgotPasswordForm } from '../../screens/Auth/ForgotPassword/forgotPasswordSlice';
import { THEME } from '../../theme';

// Design-system tokens (see src/theme/theme.ts).
const { colors } = THEME;

const navigationRef = createNavigationContainerRef<RootStackParamList>();

// ─── Deep linking ────────────────────────────────────
// finmatrixadmin://reset-password → Forgot-password (OTP) screen
// The scheme differs from the tenant app's: two installed APKs both claiming
// `finmatrix://` would put an Android disambiguation chooser in front of every
// reset-password link.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['finmatrixadmin://'],
  config: {
    screens: {
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
  // the console; missing/invalid token → sign-in. Sets isAppReady when done.
  useEffect(() => {
    dispatch(bootstrapSession());
  }, [dispatch]);

  // ─── Session-expired bridge: when the axios 401-refresh flow gives up it
  // has already cleared the stored tokens; this handler resets the store so
  // the navigator switches back to sign-in instead of leaving the user on
  // authenticated screens whose every request fails.
  //
  // This is the only authEvents bridge the console registers. The tenant app
  // also handles COMPANY_NOT_ACTIVE and RIDER_SEAT_LOCKED, but a platform
  // admin has neither a company nor a rider seat, so neither 403 can be
  // raised for them. utils/authEvents keeps both handler slots — an
  // unregistered handler is a no-op.
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

  // ─── Clear auth form slices when user becomes authenticated ──
  useEffect(() => {
    if (isAuthenticated && user) {
      dispatch(resetSignInForm());
      dispatch(resetForgotPasswordForm());
    }
  }, [isAuthenticated, user, dispatch]);

  // ─── Which top-level navigator mounts.
  const renderNavigator = () => {
    if (!isAuthenticated || !user) {
      return <BaseNavigator key="base-unauthenticated" />;
    }
    if (user.role === 'super_admin') {
      return <SuperAdminNavigator key="super-admin" />;
    }
    // A non-console account holding a valid token — a session persisted from
    // before the sign-in gate existed. Deliberately NOT BaseNavigator: that
    // would land them on sign-in, let them authenticate, and bounce them back
    // here forever. NotAuthorizedScreen says so and offers sign-out.
    return <NotAuthorizedScreen key="not-authorized" />;
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
