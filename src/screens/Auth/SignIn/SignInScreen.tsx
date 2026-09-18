// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Sign In
// ═══════════════════════════════════════════════════════
// One portal, one credential shape: a platform admin's email and password.
// The tenant app serves staff and riders from this same screen behind a portal
// tab strip and routes the server's company gate codes (unverified email,
// pending/rejected/inactive company) to the screen that explains each one. None
// of that applies here — a platform admin has no company — so a gate code that
// somehow arrives is shown as a plain authentication failure.
//
// The request still sends portal: 'admin'. That is the door the server already
// admits both company owners and the platform console through; the role check
// below is what keeps owners out of this app.

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ROUTES } from '../../../navigations-maps/Base';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { setUser } from '../authSlice';
import {
  setEmail,
  setPassword,
  setRememberMe,
  clearSignInError,
  submitSignInAsync,
  selectSignInEmail,
  selectSignInPassword,
  selectSignInRememberMe,
  selectSignInStatus,
  selectSignInError
} from './signInSlice';
import { validateSignIn } from '../../../models/authModel';
import { clearTokens } from '../../../utils/storageUtils';
import type { RootStackParamList } from '../../../types';
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

const WRONG_APP_MESSAGE =
  'This console is for platform administrators. Please use the FinMatrix app to sign in to your business account.';

type Props = NativeStackScreenProps<RootStackParamList, 'SignIn'>;

const SignInScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();

  const email = useAppSelector(selectSignInEmail);
  const password = useAppSelector(selectSignInPassword);
  const rememberMe = useAppSelector(selectSignInRememberMe);
  const status = useAppSelector(selectSignInStatus);
  const signInError = useAppSelector(selectSignInError);

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  // Set when the credentials were valid but the account is not a console
  // account. The slice's own error covers every failure the THUNK saw; this
  // covers the one we reject after it succeeded.
  const [gateError, setGateError] = React.useState('');

  // useMemo, not useRef: reading .current during render is what the React
  // refs lint rule forbids, and the value is create-once either way.
  const shakeAnim = useMemo(() => new Animated.Value(0), []);

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
    setGateError('');

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

      // THE gate for this app. The server issues a valid token to any owner
      // who signs in through the admin portal, so without this a company owner
      // would land inside the platform console. Reject BEFORE setUser: once the
      // user reaches Redux the navigator has already swapped.
      if (user.role !== 'super_admin') {
        void clearTokens();
        setGateError(WRONG_APP_MESSAGE);
        triggerShake();
        return;
      }

      dispatch(setUser(user));
    } catch {
      // Every failure the thunk saw is already in `signInError`. The tenant
      // app additionally routes COMPANY_PENDING / COMPANY_INACTIVE /
      // COMPANY_REJECTED / EMAIL_NOT_VERIFIED to dedicated screens; the
      // console has no such screens and no company, so they surface as a
      // plain authentication failure.
    }
  };

  const isLoading = status === 'loading';
  const notice = gateError || signInError;

  return (
    <AuthLayout
      header={
        <AuthHeader
          pill="Platform Console"
          title="Welcome back"
          subtitle="Sign in to manage the FinMatrix platform"
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
        {notice ? (
          <AuthNotice tone="error" title="Authentication failed" message={notice} />
        ) : null}

        <AuthField
          label="Email address"
          value={email}
          onChangeText={t => {
            dispatch(setEmail(t));
            if (errors.email) setErrors(p => ({ ...p, email: '' }));
            if (gateError) setGateError('');
          }}
          placeholder="name@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.email}
        />

        <AuthField
          label="Password"
          value={password}
          onChangeText={t => {
            dispatch(setPassword(t));
            if (errors.password) setErrors(p => ({ ...p, password: '' }));
            if (gateError) setGateError('');
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

          <Text
            style={s.link}
            onPress={() => navigation.navigate(ROUTES.FORGOT_PASSWORD)}
            accessibilityRole="button">
            Forgot password?
          </Text>
        </View>
      </Animated.View>
    </AuthLayout>
  );
};

const s = StyleSheet.create({
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
});

export default SignInScreen;
