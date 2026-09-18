// ═══════════════════════════════════════════════════════
// FinMatrix — Email Verification gate
// ═══════════════════════════════════════════════════════
// Reached after signup (tokens are stored but the account is unverified) and
// from the finmatrix://verify-email deep link, which carries a token and
// auto-verifies on mount.
//
// Feedback renders inline rather than as a floating toast: <Toast/> is
// mounted without a toastConfig, so its default styling sits outside this
// flow's design language and drifts away from the action that produced it.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList, UserRole } from '../../../types';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { setUser, selectSelectedRole } from '../authSlice';
import {
  authResendVerification,
  authVerifyEmail,
  authMe
} from '../../../networks/auth/authNetwork';
import { setStoredCompanyId } from '../../../utils/storageUtils';
import { useSignOut } from '../../../hooks/useSignOut';
import { THEME } from '../../../theme';

// Design-system tokens (see src/theme/theme.ts).
const { typography } = THEME;
import {
  AuthLayout,
  AuthHeader,
  AuthFooterBar,
  AuthIconTile,
  AuthNotice,
  AuthHelpCard,
  AUTH,
  type AuthTone
} from '../../../components/auth/AuthUI';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'EmailVerification'>;
type RouteProps = RouteProp<RootStackParamList, 'EmailVerification'>;

const RESEND_COOLDOWN = 60;

const EmailVerificationScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const dispatch = useAppDispatch();
  const { signOutNow } = useSignOut();

  const isAuthenticated = useAppSelector(s => s.auth.isAuthenticated);
  const user = useAppSelector(s => s.auth.user);
  const selectedRole = useAppSelector(selectSelectedRole);
  const role: UserRole = selectedRole ?? 'admin';
  const email = route.params?.email ?? user?.email ?? '';
  const token = route.params?.token;

  const [verified, setVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState<{ tone: AuthTone; message: string } | null>(
    null,
  );

  const refreshSession = useCallback(async () => {
    try {
      const { data } = await authMe();
      if (data.companyId) await setStoredCompanyId(data.companyId);
      dispatch(setUser(data.user));
      return data.user;
    } catch {
      return null;
    }
  }, [dispatch]);

  // ─── Auto-verify when opened from a deep link with a token ──────────────
  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      setIsVerifying(true);
      try {
        await authVerifyEmail(token);
        if (!active) return;
        setVerified(true);
        setNotice({ tone: 'success', message: 'Email verified!' });
        await refreshSession();
      } catch (e: any) {
        if (!active) return;
        setNotice({ tone: 'error', message: e?.message ?? 'Verification failed' });
      } finally {
        if (active) setIsVerifying(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token, refreshSession]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || isResending || !email) return;
    setIsResending(true);
    try {
      await authResendVerification({ resendInfo: { email } });
      setCooldown(RESEND_COOLDOWN);
      setNotice({ tone: 'success', message: 'Verification email sent!' });
    } catch (e: any) {
      setNotice({ tone: 'error', message: e?.message ?? 'Failed to resend' });
    } finally {
      setIsResending(false);
    }
  };

  const handleContinue = async () => {
    setIsChecking(true);
    const u = await refreshSession();
    setIsChecking(false);
    if (!u) {
      navigation.navigate('SignIn', { role });
      return;
    }
    if (!u.isEmailVerified) {
      setNotice({ tone: 'info', message: 'Not verified yet — check your email.' });
    }
  };

  // Signup stores tokens before the email is verified, so returning to
  // sign-in must clear that half-session or a cold start would restore it.
  const handleBackToSignIn = () => signOutNow();

  return (
    <AuthLayout
      header={
        <AuthHeader
          pill="Verify Email"
          title={verified ? 'Email verified' : 'Verify your email'}
          subtitle={
            verified
              ? 'Your email has been verified. Continue to finish setting up your company.'
              : 'Open the verification link on this device to activate your account.'
          }
        />
      }
      footer={
        <AuthFooterBar
          primary={{
            label: verified
              ? isAuthenticated
                ? 'Continue'
                : 'Go to Sign In'
              : "I've verified — continue",
            onPress: handleContinue,
            loading: isChecking,
            loadingLabel: 'Checking',
            disabled: isVerifying,
          }}
          secondary={{ label: 'Back to Sign In', onPress: handleBackToSignIn }}
        />
      }>
      {notice ? (
        <AuthNotice
          tone={notice.tone}
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      ) : null}

      <AuthIconTile
        icon={verified ? 'check-circle' : 'mail'}
        tone={verified ? 'success' : 'brand'}
        style={styles.tile}
      />

      {isVerifying ? (
        <ActivityIndicator color={AUTH.brand} style={styles.spinner} />
      ) : null}

      {email ? (
        <View style={styles.sentTo}>
          <Text style={styles.sentToLabel}>Sent to</Text>
          <Text style={styles.sentToValue} numberOfLines={1}>
            {email}
          </Text>
        </View>
      ) : null}

      {!verified ? (
        <AuthHelpCard
          message={
            cooldown > 0
              ? `You can request another email in ${cooldown}s. Check your spam folder if it hasn't arrived.`
              : isResending
              ? 'Sending…'
              : "Didn't get it? Tap Resend below after checking your spam folder."
          }
        />
      ) : null}

      {!verified ? (
        <Text
          style={[styles.resend, (cooldown > 0 || isResending) && styles.resendOff]}
          onPress={cooldown > 0 || isResending ? undefined : handleResend}
          accessibilityRole="button">
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
        </Text>
      ) : null}
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  tile: { marginBottom: AUTH.space.xl },
  spinner: { marginBottom: AUTH.space.lg },
  // Label above value, both left-aligned. Pushing the address to the right
  // edge squeezes long ones and forces the eye across the card to read the
  // one thing that matters here.
  sentTo: {
    gap: 2,
    backgroundColor: AUTH.surface,
    borderWidth: 1,
    borderColor: AUTH.line,
    borderRadius: AUTH.radius.lg,
    paddingVertical: AUTH.space.lg,
    paddingHorizontal: AUTH.space.lg,
    marginBottom: AUTH.space.lg,
  },
  sentToLabel: { ...THEME.typography.caption, fontFamily: AUTH.font, color: AUTH.ink[500] },
  sentToValue: {
    ...THEME.typography.labelLg,
    fontFamily: AUTH.font,
    color: AUTH.ink[900],
  },
  resend: {
    ...THEME.typography.h5,
    fontFamily: AUTH.font,
    color: AUTH.brand,
    textAlign: 'center',
    paddingVertical: AUTH.space.xl,
  },
  resendOff: { color: AUTH.ink[400], fontWeight: typography.labelLg.fontWeight }
});

export default EmailVerificationScreen;
