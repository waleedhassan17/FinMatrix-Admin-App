// ═══════════════════════════════════════════════════════
// FinMatrix — Sign In
// ═══════════════════════════════════════════════════════
// Serves both portals: `role === 'delivery'` signs in with a username against
// the delivery endpoint, everyone else with an email. The server's gate codes
// (unverified email, pending/rejected/inactive company) route to the matching
// screen rather than surfacing as a generic error.

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, Animated } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ROUTES } from '../../../navigations-maps/Base';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { setUser, selectSelectedRole } from '../authSlice';
import {
  setEmail,
  setUsername,
  setPassword,
  setRememberMe,
  clearSignInError,
  submitSignInAsync,
  submitDeliverySignInAsync,
  selectSignInEmail,
  selectSignInUsername,
  selectSignInPassword,
  selectSignInRememberMe,
  selectSignInStatus,
  selectSignInError
} from './signInSlice';
import { validateSignIn, validateDeliverySignIn } from '../../../models/authModel';
import type { RootStackParamList, UserRole } from '../../../types';
import { THEME } from '../../../theme';

// Design-system tokens (see src/theme/theme.ts).
const { colors } = THEME;
import {
  AuthLayout,
  AuthHeader,
  AuthFooterBar,
  AuthField,
  AuthNotice,
  AUTH
} from '../../../components/auth/AuthUI';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

const SignInScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  // Never destructure route.params directly: screens that send the user back
  // here (password reset, "Back to Sign In") pass no params, and RN v7 pushes
  // a fresh route rather than reusing the one RoleSelection created. Fall back
  // to the role the user picked on RoleSelection so a delivery user isn't
  // silently downgraded to the admin portal.
  const selectedRole = useAppSelector(selectSelectedRole);
  const role: UserRole = route.params?.role ?? selectedRole ?? 'admin';

  const email = useAppSelector(selectSignInEmail);
  const username = useAppSelector(selectSignInUsername);
  const password = useAppSelector(selectSignInPassword);
  const rememberMe = useAppSelector(selectSignInRememberMe);
  const status = useAppSelector(selectSignInStatus);
  const signInError = useAppSelector(selectSignInError);

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // useMemo, not useRef: reading .current during render is what the React
  // refs lint rule forbids, and the value is create-once either way.
  const shakeAnim = useMemo(() => new Animated.Value(0), []);

  // Owner-created accounts — staff and riders — both sign in with a username
  // and a password their company handed them, against the same endpoint. The
  // tab below only sets expectations and wording: the SERVER decides the
  // actual role from the account, so picking the wrong tab still signs the
  // user into the right app.
  const isUserPortal = role === 'delivery' || role === 'staff';
  const [portalTab, setPortalTab] = React.useState<'staff' | 'delivery'>(
    role === 'delivery' ? 'delivery' : 'staff',
  );
  const isDelivery = isUserPortal;
  const roleLabel = isUserPortal ? 'User Portal' : 'Business Portal';

  // A short nudge on validation failure — the one motion in the flow, and it
  // carries meaning rather than decorating the entrance.
  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleSignIn = async () => {
    dispatch(clearSignInError());

    if (isDelivery) {
      const validationErrors = validateDeliverySignIn({ username, password });
      setErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) {
        triggerShake();
        return;
      }
      try {
        const user = await dispatch(
          submitDeliverySignInAsync({ username: username.trim(), password }),
        ).unwrap();
        dispatch(setUser(user));
      } catch {
        /* handled by slice */
      }
      return;
    }

    const validationErrors = validateSignIn({ email, password });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      triggerShake();
      return;
    }
    try {
      const user = await dispatch(
        submitSignInAsync({ email: email.trim(), password }),
      ).unwrap();
      dispatch(setUser(user));
    } catch (err) {
      const e = err as {
        code?: string;
        rejectionReason?: string | null;
        pendingKind?: 'trial' | 'payment' | null;
      };
      // Route the server's gate codes to the screen that explains them.
      if (e?.code === 'EMAIL_NOT_VERIFIED') {
        navigation.navigate('EmailVerification', { email: email.trim() });
      } else if (e?.code === 'COMPANY_PENDING') {
        navigation.navigate('PendingApproval', {
          fromLogin: true,
          pendingKind: e?.pendingKind ?? undefined,
        });
      } else if (e?.code === 'COMPANY_INACTIVE') {
        navigation.navigate('CompanyRejected', { fromLogin: true, mode: 'inactive' });
      } else if (e?.code === 'COMPANY_REJECTED') {
        navigation.navigate('CompanyRejected', {
          fromLogin: true,
          mode: 'rejected',
          reason: e?.rejectionReason ?? undefined,
        });
      }
      /* other errors handled by slice */
    }
  };

  const isLoading = status === 'loading';

  return (
    <AuthLayout
      header={
        <AuthHeader
          pill={roleLabel}
          title="Welcome back"
          subtitle={
            isDelivery
              ? 'Sign in with your company credentials'
              : 'Sign in to manage your business'
          }
        />
      }
      footer={
        <AuthFooterBar
          primary={{
            label: 'Sign In',
            onPress: handleSignIn,
            loading: isLoading,
            loadingLabel: 'Signing in',
          }}
          note="256-bit SSL encrypted connection"
        />
      }>
      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        {signInError ? (
          <AuthNotice tone="error" title="Authentication failed" message={signInError} />
        ) : null}

        {isUserPortal ? (
          <View style={s.portalTabs}>
            {(
              [
                { key: 'staff' as const, label: 'Staff' },
                { key: 'delivery' as const, label: 'Delivery Personnel' },
              ]
            ).map(t => (
              <TouchableOpacity
                key={t.key}
                style={[
                  s.portalTab,
                  portalTab === t.key && s.portalTabActive,
                ]}
                onPress={() => setPortalTab(t.key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    s.portalTabText,
                    portalTab === t.key && s.portalTabTextActive,
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {isDelivery ? (
          <AuthField
            label="Username"
            value={username}
            onChangeText={t => {
              dispatch(setUsername(t));
              if (errors.username) setErrors(p => ({ ...p, username: '' }));
            }}
            placeholder="Enter your username"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.username}
          />
        ) : (
          <AuthField
            label="Email address"
            value={email}
            onChangeText={t => {
              dispatch(setEmail(t));
              if (errors.email) setErrors(p => ({ ...p, email: '' }));
            }}
            placeholder="name@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.email}
          />
        )}

        <AuthField
          label="Password"
          value={password}
          onChangeText={t => {
            dispatch(setPassword(t));
            if (errors.password) setErrors(p => ({ ...p, password: '' }));
          }}
          placeholder="Enter your password"
          secure
          autoCapitalize="none"
          error={errors.password}
          onSubmitEditing={handleSignIn}
          returnKeyType="go"
        />

        <View style={s.optRow}>
          <Pressable
            style={s.remRow}
            onPress={() => dispatch(setRememberMe(!rememberMe))}
            hitSlop={6}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: rememberMe }}>
            <View style={[s.checkbox, rememberMe && s.checkboxOn]}>
              {rememberMe ? <Feather name="check" size={12} color={colors.neutral0} /> : null}
            </View>
            <Text style={s.remLabel}>Remember me</Text>
          </Pressable>

          {!isDelivery && (
            <Text
              style={s.link}
              onPress={() => navigation.navigate(ROUTES.FORGOT_PASSWORD)}
              accessibilityRole="button">
              Forgot password?
            </Text>
          )}
        </View>

        {!isDelivery && (
          <View style={s.bottomRow}>
            <Text style={s.bottomText}>Don&apos;t have an account? </Text>
            <Text
              style={s.link}
              onPress={() => navigation.navigate(ROUTES.SIGN_UP, { role })}
              accessibilityRole="button">
              Create account
            </Text>
          </View>
        )}
      </Animated.View>
    </AuthLayout>
  );
};

const s = StyleSheet.create({
  // Which portal the user is signing into. Cosmetic: the server resolves the
  // real role from the account either way.
  portalTabs: {
    flexDirection: 'row',
    gap: AUTH.space.sm,
    marginBottom: AUTH.space.lg,
  },
  portalTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: AUTH.space.md,
    borderRadius: AUTH.radius.md,
    borderWidth: 1,
    borderColor: AUTH.line,
    backgroundColor: AUTH.surface,
  },
  portalTabActive: {
    borderColor: AUTH.mintBorder,
    backgroundColor: AUTH.mint,
  },
  portalTabText: { ...THEME.typography.labelMd, color: AUTH.ink[500] },
  portalTabTextActive: { color: AUTH.brandDark },
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -AUTH.space.xs,
  },
  remRow: { flexDirection: 'row', alignItems: 'center', gap: AUTH.space.md },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: AUTH.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: AUTH.brand, borderColor: AUTH.brand },
  remLabel: { ...THEME.typography.bodySm, fontFamily: AUTH.font, color: AUTH.ink[700] },
  link: {
    ...THEME.typography.h5,
    fontFamily: AUTH.font,
    color: AUTH.brand,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: AUTH.space.xxl,
  },
  bottomText: { ...THEME.typography.bodySm, fontFamily: AUTH.font, color: AUTH.ink[500] }
});

export default SignInScreen;
