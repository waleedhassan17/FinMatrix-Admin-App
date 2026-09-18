// ═══════════════════════════════════════════════════════
// FinMatrix — Staff settings
// ═══════════════════════════════════════════════════════
// Deliberately small. The owner's SettingsScreen carries the plan, company
// profile, company switcher and notification preferences — all governance, all
// on the staff route allow-list's forbidden set. None of that belongs here.
//
// What is left is what a staff member legitimately has: who they are signed in
// as, and the ability to sign out. That second one was missing entirely — a
// staff member could sign in and had no way back out of the session.
//
// The account block is not decoration. Staff credentials are ISSUED BY THE
// OWNER and staff cannot reset their own password (they contact the owner
// instead), so "which username am I?" is a question they genuinely need
// answered — it is what they have to quote when asking for a reset.

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';

import { THEME } from '../../../theme';
import { useAppSelector } from '../../../hooks/useReduxHooks';
import { selectUser } from '../../Auth/authSlice';
import { selectActiveCompany } from '../../Auth/companySlice';
import { useSignOut } from '../../../hooks/useSignOut';
import { ReportContainer, ReportHeader } from '../../../components/reports/ReportUI';

const { colors, radius, spacing, typography, shadows } = THEME;

const InfoRow: React.FC<{
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
}> = ({ icon, label, value, isLast }) => (
  <View style={[styles.row, !isLast && styles.rowDivider]}>
    <Feather name={icon} size={17} color={colors.textTertiary} style={styles.rowIcon} />
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
  </View>
);

const StaffSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const user = useAppSelector(selectUser);
  const company = useAppSelector(selectActiveCompany);
  const { signingOut, confirmSignOut } = useSignOut();

  return (
    <ReportContainer>
      <ReportHeader
        title="Settings"
        subtitle="Your account"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>SIGNED IN AS</Text>
        <View style={styles.card}>
          <InfoRow icon="user" label="Name" value={user?.displayName || '—'} />
          {/* Username, not email: this is what they sign in with, and what the
              owner needs to hear when issuing a reset. */}
          <InfoRow icon="at-sign" label="Username" value={user?.username || '—'} />
          <InfoRow icon="shield" label="Role" value="Staff" />
          <InfoRow icon="briefcase" label="Company" value={company?.name || '—'} isLast />
        </View>

        <View style={styles.note}>
          <Feather name="info" size={13} color={colors.textSecondary} />
          <Text style={styles.noteText}>
            Your sign-in details are managed by the owner. Ask them if you need your
            password reset.
          </Text>
        </View>

        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.row, signingOut && styles.rowBusy]}
            activeOpacity={0.55}
            onPress={confirmSignOut}
            disabled={signingOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Feather name="log-out" size={17} color={colors.danger} style={styles.rowIcon} />
            <Text style={[styles.rowLabel, styles.signOutLabel]}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Text>
            {signingOut && <ActivityIndicator size="small" color={colors.danger} />}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>ABOUT</Text>
        <View style={styles.card}>
          <InfoRow icon="info" label="Version" value="1.0.0" isLast />
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, backgroundColor: colors.background, flexGrow: 1 },
  sectionHeader: {
    ...typography.overline,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: spacing.sm,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  rowBusy: { opacity: 0.6 },
  rowIcon: { width: 20 },
  rowLabel: { ...typography.bodyMd, color: colors.textPrimary, flex: 1 },
  rowValue: { ...typography.labelMd, color: colors.textSecondary, maxWidth: '55%' },
  signOutLabel: { color: colors.danger },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.xs,
  },
  noteText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 17 },
});

export default StaffSettingsScreen;
