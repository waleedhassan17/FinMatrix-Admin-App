import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '../../utils/theme';
import { ROUTES } from '../../navigations-maps/Base';
import { useAppDispatch } from '../../hooks/useReduxHooks';
import { setRole } from './roleSelectionSlice';
import { setSelectedRole } from '../Auth/authSlice';
import type { UserRole } from '../../types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

/* ── Brand Colors ───────────────────────────────────── */
const BRAND = {
  navy: colors.neutral900,
  navyDark: colors.neutral900,
  blue: colors.actionGreen,
  blueLight: colors.actionGreenLighter,
  coral: colors.danger,
  coralLight: colors.dangerLighter,
  bg: colors.background,
  card: colors.neutral0,
  textDark: colors.textPrimary,
  textMid: colors.textSecondary,
  textLight: colors.textTertiary,
  border: colors.border
};

type RoleSelectionNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RoleSelection'
>;

interface Props {
  navigation: RoleSelectionNavigationProp;
}

/* ── Role Card ──────────────────────────────────────── */
interface RoleCardProps {
  letter: string;
  letterBg: string;
  letterColor: string;
  accentColor: string;
  title: string;
  subtitle: string;
  description: string;
  onPress: () => void;
}

const RoleCard: React.FC<RoleCardProps> = ({
  letter,
  letterBg,
  letterColor,
  accentColor,
  title,
  subtitle,
  description,
  onPress
}) => (
  <TouchableOpacity
    style={cardStyles.wrapper}
    onPress={onPress}
    activeOpacity={0.75}>
    {/* Left accent border */}
    <View style={[cardStyles.accentBar, { backgroundColor: accentColor }]} />

    <View style={cardStyles.body}>
      {/* Letter avatar */}
      <View style={[cardStyles.letterCircle, { backgroundColor: letterBg }]}>
        <Text style={[cardStyles.letterText, { color: letterColor }]}>
          {letter}
        </Text>
      </View>

      {/* Text content */}
      <View style={cardStyles.textBlock}>
        <Text style={cardStyles.title}>{title}</Text>
        <Text style={[cardStyles.subtitle, { color: accentColor }]}>
          {subtitle}
        </Text>
        <Text style={cardStyles.description}>{description}</Text>
      </View>

      {/* Arrow */}
      <View style={cardStyles.arrowWrap}>
        <Text style={[cardStyles.arrow, { color: accentColor }]}>{'>'}</Text>
      </View>
    </View>
  </TouchableOpacity>
);

/* ── Main Screen ────────────────────────────────────── */
const RoleSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();

  const handleRoleSelect = (role: UserRole) => {
    dispatch(setRole(role));
    dispatch(setSelectedRole(role));
    navigation.navigate(ROUTES.SIGN_IN, { role });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BRAND.bg} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Text style={styles.logoTitle}>
            <Text style={styles.logoFin}>Fin</Text>
            <Text style={styles.logoMatrix}>Matrix</Text>
          </Text>
          <Text style={styles.logoSubtitle}>
            Enterprise Accounting & Delivery Platform
          </Text>
        </View>

        {/* Heading */}
        <View style={styles.headingSection}>
          <Text style={styles.headingTitle}>Select Your Role</Text>
          <Text style={styles.headingSubtitle}>
            Choose how you want to access FinMatrix
          </Text>
        </View>

        {/* Role Cards */}
        <View style={styles.cardsSection}>
          <RoleCard
            letter="A"
            letterBg={BRAND.blueLight}
            letterColor={BRAND.navy}
            accentColor={BRAND.navy}
            title="Administrator"
            subtitle="Full Access"
            description="Complete control over accounting, inventory, payroll, reports, and delivery management. Manage your entire business operations."
            onPress={() => handleRoleSelect('admin')}
          />

          {/* One card for both owner-created roles. Staff and riders are
              created BY a company — they never sign themselves up — and both
              sign in with a username and password handed to them, so they
              share an entry point and pick their portal on the next screen. */}
          <RoleCard
            letter="U"
            letterBg={BRAND.blueLight}
            letterColor={BRAND.blue}
            accentColor={BRAND.blue}
            title="User"
            subtitle="Staff & Delivery Personnel"
            description="Sign in with the username and password your company gave you. Staff run day-to-day sales and warehouse work; riders manage their assigned deliveries."
            onPress={() => handleRoleSelect('staff')}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerPowered}>
            Powered by FinMatrix Cloud Platform
          </Text>
          <Text style={styles.footerVersion}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

/* ── Card Styles ────────────────────────────────────── */
const cardStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: BRAND.card,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    ...shadows.sm,
    elevation: 2,
    shadowColor: colors.neutral900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingLeft: 16,
    paddingRight: 14
  },
  letterCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    alignSelf: 'flex-start',
    marginTop: 2
  },
  letterText: {
    ...typography.h2
    
  },
  textBlock: {
    flex: 1,
    marginRight: 8
  },
  title: {
    ...typography.h4,
    color: BRAND.textDark,
    marginBottom: 2
  },
  subtitle: {
    ...typography.labelMd,
    marginBottom: 8
  },
  description: {
    ...typography.bodySm,
    color: BRAND.textMid,
    lineHeight: 19
  },
  arrowWrap: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
    alignSelf: 'center'
  },
  arrow: {
    ...typography.h3
    
  },
});

/* ── Main Styles ────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },

  /* Logo */
  logoSection: {
    alignItems: 'center',
    paddingTop: 40,
    marginBottom: 36,
  },
  logoTitle: {
    ...typography.displayMd,
    marginBottom: 6,
  },
  logoFin: {
    color: colors.success,
  },
  logoMatrix: {
    color: BRAND.textDark,
  },
  logoSubtitle: {
    ...typography.bodySm,
    color: BRAND.textMid,
  },

  /* Heading */
  headingSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  headingTitle: {
    ...typography.h2,
    color: BRAND.textDark,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  headingSubtitle: {
    ...typography.bodySm,
    color: BRAND.textMid,
  },

  /* Cards */
  cardsSection: {
    gap: 16,
    marginBottom: 40,
  },

  /* Footer */
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 24,
  },
  footerPowered: {
    ...typography.bodySm,
    color: BRAND.textLight,
    marginBottom: 4,
  },
  footerVersion: {
    ...typography.caption,
    color: BRAND.textLight + 'AA',
  }
});

export default RoleSelectionScreen;