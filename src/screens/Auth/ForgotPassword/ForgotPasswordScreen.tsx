// ═══════════════════════════════════════════════════════
// FinMatrix — Forgot Password (3 steps in one screen)
// ═══════════════════════════════════════════════════════
//   request → email in, 6-digit code out
//   otp     → verify the code, receive a single-use reset token
//   reset   → set the new password, then back to sign-in
//
// The success path deliberately routes to SignIn WITH an explicit role and
// via reset(): the user has no session here, so nothing in this flow may
// touch a screen that reads a signed-in user's role, and Back must not
// return to a form holding a spent reset token.

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  authForgotPassword,
  authVerifyOtp,
  authResetPassword
} from '../../../networks/auth/authNetwork';
import { useAppSelector } from '../../../hooks/useReduxHooks';
import { selectSelectedRole } from '../authSlice';
import {
  AuthLayout,
  AuthHeader,
  AuthFooterBar,
  AuthField,
  AuthIconTile,
  AuthNotice,
  AuthHelpCard,
  AuthChecklist,
  PasswordStrength,
  OtpInput,
  AUTH
} from '../../../components/auth/AuthUI';
import type { RootStackParamList, UserRole } from '../../../types';
import { THEME } from '../../../theme';

const { typography } = THEME;

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

type Step = 'request' | 'otp' | 'reset';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8}$/;
const RESEND_COOLDOWN = 60;

const STEP_INDEX: Record<Step, number> = { request: 1, otp: 2, reset: 3 };

const STRENGTH_LABELS = ['Empty', 'Weak', 'Good', 'Strong'] as const;

const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);

  // Keep the portal the user originally chose — landing them on the admin
  // sign-in after resetting a delivery account would be wrong.
  const selectedRole = useAppSelector(selectSelectedRole);
  const role: UserRole = selectedRole ?? 'admin';

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const goToSignIn = () => {
    // reset(), not navigate(): the reset token is spent, so Back must not
    // return to this form. reset() throws if SignIn is not in the current
    // navigator's route list (it is only registered while unauthenticated),
    // so fall back to navigate() — and if even that fails, go back rather
    // than let the error escape and take the screen down.
    try {
      navigation.reset({ index: 0, routes: [{ name: 'SignIn', params: { role } }] });
    } catch {
      try {
        navigation.navigate('SignIn', { role });
      } catch {
        if (navigation.canGoBack()) navigation.goBack();
      }
    }
  };

  const handleRequest = async () => {
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authForgotPassword({ forgotPasswordInfo: { email: email.trim() } });
      setStep('otp');
      setCooldown(RESEND_COOLDOWN);
      setNotice('If an account exists, a 6-digit code was sent.');
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError('');
    try {
      await authForgotPassword({ forgotPasswordInfo: { email: email.trim() } });
      setCooldown(RESEND_COOLDOWN);
      setNotice('Code resent');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to resend');
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from your email');
      return;
    }
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const { resetToken: rt } = await authVerifyOtp(email.trim(), otp);
      setResetToken(rt);
      setStep('reset');
    } catch (e: any) {
      setError(e?.message ?? 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!PASSWORD_REGEX.test(password)) {
      setError('Password must be 8+ chars with upper, lower and a number');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authResetPassword(email.trim(), resetToken, password);
      // Navigate straight away. The previous version showed a banner and
      // deferred the navigation on a 900ms timer, which meant state updates
      // and a navigation dispatch could land after the screen had gone —
      // and left the user staring at a form that looked like it had hung.
      setLoading(false);
      goToSignIn();
      return;
    } catch (e: any) {
      setError(e?.message ?? 'Could not reset password');
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'otp' || step === 'reset') {
      setStep(step === 'reset' ? 'otp' : 'request');
      setError('');
      setNotice('');
      return;
    }
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('RoleSelection');
  };

  const clearError = () => {
    if (error) setError('');
  };

  // ── Password rules, shown as a live checklist ──
  const rules = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    {
      label: 'An uppercase and a lowercase letter',
      met: /[a-z]/.test(password) && /[A-Z]/.test(password)
    },
    { label: 'At least one number', met: /\d/.test(password) },
  ];
  const score = rules.filter(r => r.met).length as 0 | 1 | 2 | 3;

  const COPY: Record<Step, { title: string; subtitle: string }> = {
    request: {
      title: 'Reset password',
      subtitle: "Enter your email and we'll send you a 6-digit code.",
    },
    otp: {
      title: 'Enter code',
      subtitle: 'We sent a 6-digit code to your email address.',
    },
    reset: {
      title: 'New password',
      subtitle: 'Choose a strong password for your account.',
    }
  };

  const primary =
    step === 'request'
      ? { label: 'Send code', onPress: handleRequest, loading, loadingLabel: 'Sending' }
      : step === 'otp'
      ? { label: 'Verify code', onPress: handleVerifyOtp, loading, loadingLabel: 'Verifying' }
      : { label: 'Update password', onPress: handleReset, loading, loadingLabel: 'Updating' };

  return (
    <AuthLayout
      header={
        <AuthHeader
          pill="Reset Password"
          title={COPY[step].title}
          subtitle={COPY[step].subtitle}
          onBack={step === 'request' ? handleBack : handleBack}
          step={{ current: STEP_INDEX[step], total: 3 }}
        />
      }
      footer={
        <AuthFooterBar
          primary={primary}
          secondary={{ label: 'Back to Sign In', onPress: goToSignIn }}
        />
      }>
      {error ? <AuthNotice tone="error" message={error} /> : null}
      {!error && notice ? (
        <AuthNotice
          tone={step === 'reset' ? 'success' : 'info'}
          message={notice}
        />
      ) : null}

      {step === 'request' && (
        <>
          <AuthIconTile icon="mail" style={styles.tile} />
          <AuthField
            label="Email address"
            value={email}
            onChangeText={t => {
              setEmail(t);
              clearError();
            }}
            placeholder="you@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={handleRequest}
            returnKeyType="send"
          />
          <AuthHelpCard message="Codes expire after 10 minutes. Use the address tied to your FinMatrix workspace." />
        </>
      )}

      {step === 'otp' && (
        <>
          <Text style={styles.label}>6-digit code</Text>
          <OtpInput
            value={otp}
            onChange={t => {
              setOtp(t);
              clearError();
            }}
            error={!!error}
            autoFocus
          />
          <View style={styles.resendRow}>
            <Text style={styles.resendHint}>Didn&apos;t get the code?</Text>
            <Text
              style={[styles.resendAction, cooldown > 0 && styles.resendDisabled]}
              onPress={cooldown > 0 ? undefined : handleResend}
              accessibilityRole="button">
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </Text>
          </View>
        </>
      )}

      {step === 'reset' && (
        <>
          <AuthField
            label="New password"
            value={password}
            onChangeText={t => {
              setPassword(t);
              clearError();
            }}
            placeholder="Enter a new password"
            secure
            autoCapitalize="none"
          />
          <PasswordStrength score={score} label={STRENGTH_LABELS[score]} />
          <AuthChecklist items={rules} />
          <View style={styles.gap} />
          <AuthField
            label="Confirm password"
            value={confirm}
            onChangeText={t => {
              setConfirm(t);
              clearError();
            }}
            placeholder="Re-enter your password"
            secure
            autoCapitalize="none"
            onSubmitEditing={handleReset}
            returnKeyType="done"
          />
        </>
      )}
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  tile: { marginBottom: AUTH.space.xl },
  label: {
    ...THEME.typography.labelMd,
    fontFamily: AUTH.font,
    color: AUTH.ink[700],
    marginBottom: AUTH.space.md,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: AUTH.space.lg,
  },
  resendHint: { ...THEME.typography.bodySm, fontFamily: AUTH.font, color: AUTH.ink[500] },
  resendAction: {
    ...THEME.typography.labelMd,
    fontFamily: AUTH.font,
    color: AUTH.brand,
  },
  resendDisabled: { ...typography.labelSm, color: AUTH.ink[400] },
  gap: { height: AUTH.space.xl }
});

export default ForgotPasswordScreen;
