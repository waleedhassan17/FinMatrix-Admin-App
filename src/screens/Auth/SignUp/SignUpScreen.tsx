// ═══════════════════════════════════════════════════════
// FinMatrix — Create Account
// ═══════════════════════════════════════════════════════
// Admin signup. On success the account exists but is unverified, so the user
// is handed to the email-verification gate with their address.

import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ROUTES } from '../../../navigations-maps/Base';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { setPendingUser, selectSelectedRole } from '../authSlice';
import {
  setFullName,
  setSignUpEmail,
  setPhone,
  setSignUpPassword,
  setConfirmPassword,
  setAcceptedTerms,
  clearSignUpError,
  submitSignUpAsync,
  selectSignUpFullName,
  selectSignUpEmail,
  selectSignUpPhone,
  selectSignUpPassword,
  selectSignUpConfirmPassword,
  selectSignUpAcceptedTerms,
  selectSignUpStatus,
  selectSignUpError
} from './signUpSlice';
import { validateSignUp } from '../../../models/authModel';
import type { RootStackParamList, UserRole } from '../../../types';
import { THEME } from '../../../theme';

// Design-system tokens (see src/theme/theme.ts).
const { colors, typography } = THEME;
import {
  AuthLayout,
  AuthHeader,
  AuthFooterBar,
  AuthField,
  AuthNotice,
  AuthChecklist,
  PasswordStrength,
  AUTH
} from '../../../components/auth/AuthUI';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

const STRENGTH_LABELS = ['Empty', 'Weak', 'Good', 'Strong'] as const;

const SignUpScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  // Same guard as SignInScreen — never assume route.params exists (see the
  // note on RootStackParamList.SignIn).
  const selectedRole = useAppSelector(selectSelectedRole);
  const role: UserRole = route.params?.role ?? selectedRole ?? 'admin';

  const fullName = useAppSelector(selectSignUpFullName);
  const email = useAppSelector(selectSignUpEmail);
  const phone = useAppSelector(selectSignUpPhone);
  const password = useAppSelector(selectSignUpPassword);
  const confirmPassword = useAppSelector(selectSignUpConfirmPassword);
  const acceptedTerms = useAppSelector(selectSignUpAcceptedTerms);
  const status = useAppSelector(selectSignUpStatus);
  const signUpError = useAppSelector(selectSignUpError);

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const shakeAnim = useMemo(() => new Animated.Value(0), []);

  const triggerShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleSignUp = async () => {
    dispatch(clearSignUpError());
    const validationErrors = validateSignUp({
      fullName, email, phone, password, confirmPassword, acceptedTerms
    });
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      triggerShake();
      return;
    }

    try {
      const user = await dispatch(
        submitSignUpAsync({
          fullName: fullName.trim(),
          email: email.trim(),
          phone,
          password,
        }),
      ).unwrap();
      dispatch(setPendingUser(user));
      navigation.navigate(ROUTES.EMAIL_VERIFICATION as any, { email: email.trim() });
    } catch {
      /* handled by slice */
    }
  };

  const clear = (field: string) => {
    if (errors[field]) setErrors(p => ({ ...p, [field]: '' }));
  };

  // The same three rules the server enforces, shown live rather than after a
  // failed submit — and identical to the reset-password screen, since both
  // ask the user to choose a password.
  const rules = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    {
      label: 'An uppercase and a lowercase letter',
      met: /[a-z]/.test(password) && /[A-Z]/.test(password)
    },
    { label: 'At least one number', met: /\d/.test(password) },
  ];
  const score = rules.filter(r => r.met).length as 0 | 1 | 2 | 3;

  const isLoading = status === 'loading';

  return (
    <AuthLayout
      header={
        <AuthHeader
          pill="New Account"
          title="Create your account"
          subtitle="Start managing your business finances with confidence."
          onBack={() => navigation.goBack()}
        />
      }
      footer={
        <AuthFooterBar
          primary={{
            label: 'Create Account',
            onPress: handleSignUp,
            loading: isLoading,
            loadingLabel: 'Creating account',
          }}
          note="Your data is encrypted and secure"
        />
      }>
      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        {signUpError ? (
          <AuthNotice tone="error" title="Registration error" message={signUpError} />
        ) : null}

        <AuthField
          label="Full name"
          value={fullName}
          onChangeText={t => {
            dispatch(setFullName(t));
            clear('fullName');
          }}
          placeholder="Your full name"
          autoCapitalize="words"
          error={errors.fullName}
        />

        <AuthField
          label="Email address"
          value={email}
          onChangeText={t => {
            dispatch(setSignUpEmail(t));
            clear('email');
          }}
          placeholder="name@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.email}
        />

        <AuthField
          label="Phone number"
          value={phone}
          onChangeText={t => {
            dispatch(setPhone(t));
            clear('phone');
          }}
          placeholder="0312 3456789"
          keyboardType="phone-pad"
          error={errors.phone}
          hint={errors.phone ? undefined : 'Optional'}
        />

        <AuthField
          label="Password"
          value={password}
          onChangeText={t => {
            dispatch(setSignUpPassword(t));
            clear('password');
          }}
          placeholder="Create a password"
          secure
          autoCapitalize="none"
          error={errors.password}
        />
        <PasswordStrength score={score} label={STRENGTH_LABELS[score]} />
        <AuthChecklist items={rules} />
        <View style={s.gap} />

        <AuthField
          label="Confirm password"
          value={confirmPassword}
          onChangeText={t => {
            dispatch(setConfirmPassword(t));
            clear('confirmPassword');
          }}
          placeholder="Re-enter your password"
          secure
          autoCapitalize="none"
          error={errors.confirmPassword}
          onSubmitEditing={handleSignUp}
          returnKeyType="go"
        />

        <Pressable
          style={s.termsRow}
          onPress={() => {
            dispatch(setAcceptedTerms(!acceptedTerms));
            clear('acceptedTerms');
          }}
          hitSlop={6}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acceptedTerms }}>
          <View style={[s.checkbox, acceptedTerms && s.checkboxOn]}>
            {acceptedTerms ? <Feather name="check" size={12} color={colors.neutral0} /> : null}
          </View>
          <Text style={s.termsText}>
            I agree to the <Text style={s.termsStrong}>Terms of Service</Text> and{' '}
            <Text style={s.termsStrong}>Privacy Policy</Text>
          </Text>
        </Pressable>
        {errors.acceptedTerms ? (
          <Text style={s.termsError}>{errors.acceptedTerms}</Text>
        ) : null}

        <View style={s.bottomRow}>
          <Text style={s.bottomText}>Already have an account? </Text>
          <Text
            style={s.link}
            onPress={() => navigation.navigate(ROUTES.SIGN_IN, { role })}
            accessibilityRole="button">
            Sign in
          </Text>
        </View>
      </Animated.View>
    </AuthLayout>
  );
};

const s = StyleSheet.create({
  gap: { height: AUTH.space.xl },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: AUTH.space.md,
    marginTop: AUTH.space.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: AUTH.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: AUTH.brand, borderColor: AUTH.brand },
  termsText: {
    ...THEME.typography.bodySm,
    flex: 1,
    fontFamily: AUTH.font,
    lineHeight: 21,
    color: AUTH.ink[500],
  },
  termsStrong: { color: AUTH.ink[900], fontWeight: typography.labelLg.fontWeight },
  termsError: {
    ...THEME.typography.caption,
    fontFamily: AUTH.font,
    color: AUTH.status.error.fg,
    marginTop: AUTH.space.sm,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: AUTH.space.xxl,
  },
  bottomText: { ...THEME.typography.bodySm, fontFamily: AUTH.font, color: AUTH.ink[500] },
  link: {
    ...THEME.typography.h5,
    fontFamily: AUTH.font,
    color: AUTH.brand,
  }
});

export default SignUpScreen;
