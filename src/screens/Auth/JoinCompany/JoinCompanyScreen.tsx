import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import CustomButton from '../../../Custom-Components/CustomButton';
import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { setUser } from '../authSlice';
import {
  addMember,
  setActiveCompany,
  type CompanyMember
} from '../companySlice';
import type { RootStackParamList } from '../../../types';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Props = NativeStackScreenProps<RootStackParamList, 'JoinCompany'>;

const JoinCompanyScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);
  const companies = useAppSelector(state => state.company.companies);

  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [matchedCompany, setMatchedCompany] = useState<{
    companyId: string;
    name: string;
    memberCount: number;
  } | null>(null);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleCodeChange = (text: string, index: number) => {
    const char = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-1);
    const newCode = [...code];
    newCode[index] = char;
    setCode(newCode);
    setError('');
    setMatchedCompany(null);

    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = useCallback(() => {
    const fullCode = code.join('');
    if (fullCode.length < 6) {
      setError('Please enter the full 6-character code');
      triggerShake();
      return;
    }

    setIsLoading(true);
    const found = companies.find(
      c => c.inviteCode.toUpperCase() === fullCode.toUpperCase(),
    );

    setTimeout(() => {
      setIsLoading(false);
      if (found) {
        setMatchedCompany({
          companyId: found.companyId,
          name: found.name,
          memberCount: found.members.length,
        });
      } else {
        setError('Invalid code. Please check with your administrator.');
        triggerShake();
      }
    }, 600);
  }, [code, companies]);

  const handleJoin = useCallback(() => {
    if (!matchedCompany || !user) return;
    setIsLoading(true);

    const member: CompanyMember = {
      userId: user.uid,
      role: user.role as 'admin' | 'delivery',
      displayName: user.displayName,
      email: user.email,
      phone: user.phoneNumber,
      joinedAt: new Date().toISOString(),
    };

    dispatch(addMember({ companyId: matchedCompany.companyId, member }));
    dispatch(setActiveCompany(matchedCompany.companyId));
    // Set the status alongside the id: a joiner still carrying the
    // 'email_verified' they had before joining would otherwise be mistaken
    // for the OWNER of a draft company and routed into plan selection.
    dispatch(
      setUser({
        ...user,
        companyId: matchedCompany.companyId,
        companyStatus: 'active',
      }),
    );

    setIsLoading(false);
  }, [matchedCompany, user, dispatch]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <View style={styles.backIconContainer}>
              <Feather name="arrow-left" size={20} color={colors.textPrimary} />
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join Company</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.iconCircle}>
            <View style={styles.iconInner}>
              <Text style={styles.iconText}>{'#'}</Text>
            </View>
          </View>
          <Text style={styles.title}>Enter invite code</Text>
          <Text style={styles.subtitle}>
            Enter the 6-character code shared by your company administrator
          </Text>

          {/* Code Input */}
          <Animated.View
            style={[styles.codeRow, { transform: [{ translateX: shakeAnim }] }]}>
            {code.map((char, i) => (
              <TextInput
                key={i}
                ref={ref => { inputRefs.current[i] = ref; }}
                style={[
                  styles.codeBox,
                  char ? styles.codeBoxFilled : null,
                  error ? styles.codeBoxError : null,
                ]}
                value={char}
                onChangeText={text => handleCodeChange(text, i)}
                onKeyPress={e => handleKeyPress(e, i)}
                maxLength={1}
                autoCapitalize="characters"
                textAlign="center"
                returnKeyType={i < 5 ? 'next' : 'done'}
              />
            ))}
          </Animated.View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Matched Company */}
          {matchedCompany ? (
            <View style={styles.confirmationCard}>
              <View style={styles.companyBadge}>
                <Text style={styles.companyBadgeText}>
                  {matchedCompany.name.charAt(0)}
                </Text>
              </View>
              <Text style={styles.confirmationName}>{matchedCompany.name}</Text>
              <Text style={styles.confirmationMeta}>
                {matchedCompany.memberCount} member{matchedCompany.memberCount !== 1 ? 's' : ''}
              </Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>
                  Joining as {user?.role === 'delivery' ? 'Delivery Personnel' : 'Administrator'}
                </Text>
              </View>
              <View style={styles.confirmationButtons}>
                <CustomButton
                  title="Cancel"
                  onPress={() => setMatchedCompany(null)}
                  variant="secondary"
                  size="md"
                />
                <View style={{ width: spacing.xs }} />
                <CustomButton
                  title="Confirm & Join"
                  onPress={handleJoin}
                  variant="primary"
                  size="md"
                  isLoading={isLoading}
                />
              </View>
            </View>
          ) : (
            <View style={styles.buttonContainer}>
              <CustomButton
                title="Verify Code"
                onPress={handleVerifyCode}
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isLoading}
                disabled={code.join('').length < 6}
              />
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs + 4,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {},
  backIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    ...typography.displaySm,
    color: colors.textPrimary,
    marginTop: -2,
  },
  headerTitle: {
    ...typography.h3,
    flex: 1,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  headerSpacer: { width: 36 },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl + 4,
    paddingTop: spacing.xxl + 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.secondary + '0A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1.5,
    borderColor: colors.secondary + '20',
  },
  iconInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.secondary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    ...typography.h2,
    color: colors.secondary,
  },
  title: {
    ...typography.displaySm,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  codeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  codeBox: {
    ...typography.h2,
    width: 48,
    height: 56,
    borderRadius: radius.sm + 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  codeBoxFilled: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondary + '06',
  },
  codeBoxError: {
    borderColor: colors.danger,
  },
  errorText: {
    ...typography.bodyMd,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  buttonContainer: {
    width: '100%',
    marginTop: spacing.xl,
  },
  confirmationCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg + 4,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  companyBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.actionGreen + '0C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs + 4,
  },
  companyBadgeText: {
    ...typography.h2,
    color: colors.actionGreen,
  },
  confirmationName: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  confirmationMeta: {
    ...typography.bodyMd,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  roleBadge: {
    backgroundColor: colors.actionGreen + '0A',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs + 2,
    borderRadius: 8,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.actionGreen + '15',
  },
  roleBadgeText: {
    ...typography.bodyMd,
    color: colors.actionGreen,
  },
  confirmationButtons: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  }
});

export default JoinCompanyScreen;