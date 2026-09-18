// ═══════════════════════════════════════════════════════
// FinMatrix — Admin Settings Screen (Super Admin)
// Platform configuration and profile management
// ═══════════════════════════════════════════════════════

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
  Linking,
} from 'react-native';
import { Alert } from '../../../utils/alert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useAppSelector } from '../../../hooks/useReduxHooks';
import { useSignOut } from '../../../hooks/useSignOut';
import { selectUser } from '../../Auth/authSlice';
import { authForgotPassword } from '../../../networks/auth/authNetwork';
import { NOTIFICATION_ICON_NAME } from '../../../components/shared/NotificationIcon';
import { THEME, statusStyle } from '../../../theme';
import { AdminScreenHeader } from '../../../components/admin/AdminUI';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

// Real destinations for the support links.
const DOCS_URL = 'https://github.com/waleedhassan17/FinMatrix';
const SUPPORT_EMAIL = 'waleedhassansfd@gmail.com';
const NOTIF_PREFS_KEY = 'superadmin.notifPrefs';

// ── Reusable Section ──────────────────────────────────
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={S.section}>
    <Text style={S.sectionTitle}>{title}</Text>
    <View style={S.sectionCard}>{children}</View>
  </View>
);

// ── Setting Row ───────────────────────────────────────
const SettingRow: React.FC<{
  icon: string;
  iconColor?: string;
  label: string;
  value?: string;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  isLast?: boolean;
  danger?: boolean;
  disabled?: boolean; // feature not available yet → greyed, non-tappable, "Soon" tag
}> = ({
  icon, iconColor, label, value, toggle, toggleValue,
  onToggle, onPress, isLast, danger, disabled,
}) => (
  <TouchableOpacity
    style={[S.settingRow, !isLast && S.settingRowBorder, disabled && { opacity: 0.55 }]}
    onPress={disabled ? undefined : onPress}
    activeOpacity={toggle || disabled ? 1 : 0.7}
    disabled={disabled || (toggle && !onToggle) || (!onPress && !toggle)}
  >
    <View style={[S.settingIconWrap, { backgroundColor: danger ? colors.dangerLighter : colors.primaryLighter }]}>
      <Feather name={icon as any} size={16} color={danger ? colors.danger : (iconColor ?? colors.primary)} />
    </View>
    <Text style={[S.settingLabel, danger && { color: colors.danger }]}>{label}</Text>
    <View style={S.settingRight}>
      {value ? <Text style={S.settingValue}>{value}</Text> : null}
      {disabled ? (
        <View style={S.soonTag}><Text style={S.soonTagText}>Soon</Text></View>
      ) : toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: colors.neutral200, true: `${colors.primary}80` }}
          thumbColor={toggleValue ? colors.primary : colors.neutral400}
        />
      ) : onPress && !danger ? (
        <Feather name="chevron-right" size={16} color={colors.textTertiary} />
      ) : null}
    </View>
  </TouchableOpacity>
);

// ── Info Badge ────────────────────────────────────────
const InfoBadge: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <View style={S.infoBadge}>
    <Text style={S.infoBadgeLabel}>{label}</Text>
    <Text style={[S.infoBadgeValue, { color }]}>{value}</Text>
  </View>
);

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
const AdminSettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const user = useAppSelector(selectUser);
  const displayName = user?.displayName ?? 'Admin';

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [sendingReset, setSendingReset] = useState(false);

  // Notification preferences are a real (locally persisted) setting.
  useEffect(() => {
    AsyncStorage.getItem(NOTIF_PREFS_KEY).then(raw => {
      if (!raw) return;
      try {
        const p = JSON.parse(raw);
        if (typeof p.email === 'boolean') setEmailAlerts(p.email);
        if (typeof p.push === 'boolean') setPushAlerts(p.push);
      } catch { /* ignore */ }
    });
  }, []);

  const persistPrefs = (email: boolean, push: boolean) => {
    AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify({ email, push })).catch(() => {});
  };
  const onEmailAlerts = (v: boolean) => { setEmailAlerts(v); persistPrefs(v, pushAlerts); };
  const onPushAlerts = (v: boolean) => { setPushAlerts(v); persistPrefs(emailAlerts, v); };

  const { signingOut, confirmSignOut } = useSignOut();

  // Real: sends a password-reset code to the super-admin's email.
  const handleChangePassword = () => {
    if (!user?.email) { Alert.alert('No email', 'No email on file for this account.'); return; }
    Alert.alert('Change Password', `Send a password reset code to ${user.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          setSendingReset(true);
          try {
            await authForgotPassword({ forgotPasswordInfo: { email: user.email! } });
            Alert.alert('Check your email', `A reset code has been sent to ${user.email}.`);
          } catch (e: any) {
            Alert.alert('Failed', e?.message ?? 'Could not send reset code.');
          } finally {
            setSendingReset(false);
          }
        },
      },
    ]);
  };

  const openUrl = (url: string) =>
    Linking.openURL(url).catch(() => Alert.alert('Unavailable', 'Could not open the link on this device.'));

  return (
    <SafeAreaView style={S.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
      <AdminScreenHeader title="Settings" subtitle="Platform configuration" />

      <ScrollView
        contentContainerStyle={[S.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={S.profileCard}
        >
          <View style={S.profileDecor} />
          <View style={S.profileAvatar}>
            <Text style={S.profileAvatarText}>
              {displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={S.profileInfo}>
            <Text style={S.profileName}>{displayName}</Text>
            <Text style={S.profileEmail}>{user?.email}</Text>
            <View style={S.profileRolePill}>
              <Text style={S.profileRoleText}>Super Admin</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Platform Status */}
        <View style={S.statusBar}>
          <InfoBadge label="API" value="Online" color={colors.success} />
          <View style={S.statusDivider} />
          <InfoBadge label="Version" value="2.4.1" color={colors.primary} />
          <View style={S.statusDivider} />
          <InfoBadge label="Mode" value="Live" color={colors.success} />
          <View style={S.statusDivider} />
          <InfoBadge label="Region" value="US-East" color={colors.textSecondary} />
        </View>

        {/* Account */}
        <Section title="Account">
          <SettingRow icon="mail" label="Email Address" value={user?.email ?? ''} />
          <SettingRow icon="phone" label="Phone Number" value={user?.phoneNumber ?? '—'} />
          <SettingRow
            icon="lock"
            label="Change Password"
            value={sendingReset ? 'Sending…' : undefined}
            onPress={handleChangePassword}
            isLast
          />
        </Section>

        {/* Platform (read-only status) */}
        <Section title="Platform">
          <SettingRow icon="database" iconColor={THEME.colors.success} label="Database" value="PostgreSQL" />
          <SettingRow icon="server" iconColor={THEME.colors.secondary} label="API Endpoint" value="Heroku" />
          {/* No backend yet → clearly disabled rather than a fake toggle. */}
          <SettingRow icon="tool" iconColor={THEME.colors.warning} label="Maintenance Mode" disabled />
          <SettingRow icon="key" iconColor={THEME.colors.warning} label="API Keys" disabled isLast />
        </Section>

        {/* Notifications (locally persisted preferences) */}
        <Section title="Notifications">
          <SettingRow
            icon="mail"
            iconColor={THEME.colors.info}
            label="Email Alerts"
            toggle
            toggleValue={emailAlerts}
            onToggle={onEmailAlerts}
          />
          <SettingRow
            icon={NOTIFICATION_ICON_NAME}
            iconColor={THEME.colors.secondary}
            label="Push Notifications"
            toggle
            toggleValue={pushAlerts}
            onToggle={onPushAlerts}
            isLast
          />
        </Section>

        {/* Security */}
        <Section title="Security">
          <SettingRow icon="shield" iconColor={colors.textTertiary} label="Two-Factor Auth" disabled />
          <SettingRow icon="activity" iconColor={colors.primary} label="Audit Log" disabled isLast />
        </Section>

        {/* Support */}
        <Section title="Support">
          <SettingRow icon="book-open" iconColor={colors.primary} label="Documentation" onPress={() => openUrl(DOCS_URL)} />
          <SettingRow icon="message-circle" iconColor={colors.success} label="Contact Support" onPress={() => openUrl(`mailto:${SUPPORT_EMAIL}?subject=FinMatrix%20Support`)} />
          <SettingRow icon="info" iconColor={colors.textTertiary} label="About FinMatrix" value="v2.4.1" isLast />
        </Section>

        {/* Sign Out */}
        <View style={S.section}>
          <View style={S.sectionCard}>
            <SettingRow
              icon="log-out"
              label={signingOut ? 'Signing Out…' : 'Sign Out'}
              onPress={confirmSignOut}
              isLast
              danger
            />
          </View>
        </View>

        {/* Footer */}
        <Text style={S.footer}>
          FinMatrix Platform © {new Date().getFullYear()}{'\n'}
          All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  content: { padding: spacing.md, gap: spacing.md },

  // Profile card
  profileCard: {
    borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row',
    alignItems: 'center', gap: 14, overflow: 'hidden',
  },
  profileDecor: {
    position: 'absolute', right: -20, top: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  profileAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: { ...typography.h3, color: colors.neutral0 },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { ...typography.h4, color: colors.neutral0 },
  profileEmail: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
  profileRolePill: {
    alignSelf: 'flex-start', marginTop: spacing.xxs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: radius.sm,
  },
  profileRoleText: { ...typography.overline, color: colors.neutral0 },

  // Status bar
  statusBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  statusDivider: { width: 1, backgroundColor: colors.border, marginVertical: 2 },
  infoBadge: { flex: 1, alignItems: 'center', gap: 3 },
  infoBadgeLabel: { ...typography.overline, color: colors.textTertiary },
  infoBadgeValue: { ...typography.labelSm },

  // Section
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.labelSm, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.6, paddingLeft: spacing.xxs },
  sectionCard: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },

  // Setting row
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 13, gap: spacing.sm,
  },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  settingIconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  settingLabel: { flex: 1, ...typography.h5, color: colors.textPrimary },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  settingValue: { ...typography.labelSm, color: colors.textSecondary },
  soonTag: { backgroundColor: colors.neutral100, borderRadius: radius.xs, paddingHorizontal: 7, paddingVertical: 2 },
  soonTagText: { ...typography.overline, color: colors.textTertiary, letterSpacing: 0.4 },

  footer: {
    textAlign: 'center', ...typography.caption, color: colors.textTertiary,
    lineHeight: 18, marginTop: spacing.xxs,
  },
});

export default AdminSettingsScreen;
