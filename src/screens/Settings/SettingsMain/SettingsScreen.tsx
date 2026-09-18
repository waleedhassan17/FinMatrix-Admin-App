import React, { useEffect, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch,
  ActivityIndicator
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  getBillingStatusAPI, getPlanLimitsAPI,
  type BillingStatus, type PlanLimits
} from '../../../networks/billing/billingNetwork';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ReportHeader, HeaderAction, HEADER_NAVY } from '../../../components/reports/ReportUI';
import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { useSignOut } from '../../../hooks/useSignOut';
import { selectFeatures } from '../../Auth/authSlice';
import {
  selectPreferences, selectSettingsLoading, selectSettingsSaving,
  setPreference, loadPreferences, savePreferences
} from './settingsSlice';
import type { AppPreferences } from '../../../models/settingsModel';
import type { MoreStackParamList } from '../../../navigators/stacks/MoreStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;

const P = {
  brand: colors.actionGreen,
  brandLight: colors.actionGreenLighter,
  pageBg: colors.neutral50,
  card: colors.neutral0,
  sectionLabel: colors.neutral500,
  text: colors.neutral800,
  sub: colors.neutral400,
  divider: colors.neutral200,
  danger: colors.danger
};

/* ─── section row components ─── */
interface NavRowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
}
const NavRow: React.FC<NavRowProps> = ({ icon, label, value, onPress }) => (
  <TouchableOpacity style={s.row} activeOpacity={0.55} onPress={onPress}>
    <Feather name={icon} size={18} color={P.brand} style={s.rowIcon} />
    <Text style={s.rowLabel}>{label}</Text>
    {value ? <Text style={s.rowValue}>{value}</Text> : null}
    <Feather name="chevron-right" size={16} color={P.sub} />
  </TouchableOpacity>
);

interface ToggleRowProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}
const ToggleRow: React.FC<ToggleRowProps> = ({ icon, label, value, onChange }) => (
  <View style={s.row}>
    <Feather name={icon} size={18} color={P.brand} style={s.rowIcon} />
    <Text style={[s.rowLabel, { flex: 1 }]}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.neutral300, true: P.brand }}
      thumbColor={colors.surface}
    />
  </View>
);

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={s.sectionHeader}>{title}</Text>
);

/* ─── Subscription section (phase2.md Flow 3) ─── */
const SubscriptionSection: React.FC<{ onManage: () => void }> = ({ onManage }) => {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [st, lim] = await Promise.all([
        getBillingStatusAPI().catch((): BillingStatus | null => null),
        getPlanLimitsAPI().catch((): PlanLimits | null => null),
      ]);
      setStatus(st);
      setLimits(lim);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const subColor =
    status?.subscriptionStatus === 'expired'
      ? colors.danger
      : status?.subscriptionStatus === 'expiring'
        ? colors.warningHover
        : P.brand;

  // A payment is sitting with the super-admin — block re-submission until it
  // is approved (→ paid) or rejected (→ user may submit again).
  const awaitingApproval =
    status?.paymentStatus === 'submitted' ||
    status?.lastSubmission?.status === 'submitted';

  return (
    <>
      <SectionHeader title="SUBSCRIPTION" />
      <View style={s.card}>
        {loading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator color={P.brand} />
          </View>
        ) : (
          <>
            <View style={s.row}>
              <Feather name="award" size={18} color={P.brand} style={s.rowIcon} />
              <Text style={[s.rowLabel, { flex: 1 }]}>Current Plan</Text>
              <Text style={[s.rowValue, { color: P.text, fontWeight: typography.labelLg.fontWeight }]}>
                {status?.planLabel ?? 'Free'}
              </Text>
            </View>
            <View style={s.divider} />
            <View style={s.row}>
              <Feather name="activity" size={18} color={P.brand} style={s.rowIcon} />
              <Text style={[s.rowLabel, { flex: 1 }]}>Status</Text>
              <Text style={[s.rowValue, { color: subColor, fontWeight: THEME.typography.labelMd.fontWeight, textTransform: 'capitalize' }]}>
                {status?.subscriptionStatus ?? 'active'}
              </Text>
            </View>
            {status?.expiryDate ? (
              <>
                <View style={s.divider} />
                <View style={s.row}>
                  <Feather name="calendar" size={18} color={P.brand} style={s.rowIcon} />
                  <Text style={[s.rowLabel, { flex: 1 }]}>
                    {status.subscriptionStatus === 'expired' ? 'Expired' : 'Renews / Expires'}
                  </Text>
                  <Text style={s.rowValue}>{new Date(status.expiryDate).toDateString()}</Text>
                </View>
              </>
            ) : null}
            <View style={s.divider} />
            <View style={s.row}>
              <Feather name="truck" size={18} color={P.brand} style={s.rowIcon} />
              <Text style={[s.rowLabel, { flex: 1 }]}>Delivery Personnel</Text>
              <Text style={s.rowValue}>
                {limits ? `${limits.currentCount} of ${limits.deliveryPersonnelLimit} used` : '—'}
              </Text>
            </View>
            <View style={s.divider} />
            {awaitingApproval && (
              <View style={s.awaitCard}>
                <Feather name="clock" size={18} color={THEME.colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={s.awaitTitle}>Bill submitted successfully</Text>
                  <Text style={s.awaitText}>
                    Waiting for admin approval — your plan will activate automatically
                    once the payment is verified.
                  </Text>
                </View>
              </View>
            )}
            <TouchableOpacity
              style={[s.manageBtn, awaitingApproval && s.manageBtnDisabled]}
              activeOpacity={0.85}
              onPress={onManage}
              disabled={awaitingApproval}
            >
              <Feather name={awaitingApproval ? 'clock' : 'credit-card'} size={16} color={colors.neutral0} />
              <Text style={s.manageBtnText}>
                {awaitingApproval ? 'Awaiting Admin Approval' : 'Subscribe / Change Plan'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </>
  );
};

/* ─── main screen ─── */
const SettingsScreen: React.FC = () => {
  const nav = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const prefs = useAppSelector(selectPreferences);
  // Three-tier model: team management is large_org+ (multiUser flag).
  const features = useAppSelector(selectFeatures);
  const showUserManagement = !features || !!features.multiUser;
  const loading = useAppSelector(selectSettingsLoading);
  const saving = useAppSelector(selectSettingsSaving);

  useEffect(() => { dispatch(loadPreferences()); }, [dispatch]);

  const toggle = useCallback(
    (key: keyof AppPreferences) => (val: boolean) => {
      dispatch(setPreference({ key, value: val }));
    },
    [dispatch],
  );

  const handleSave = useCallback(() => {
    dispatch(savePreferences());
  }, [dispatch]);

  const { signingOut, confirmSignOut } = useSignOut();

  return (
    <SafeAreaView style={[s.safe, s.safeTop]} edges={['top']}>
      <View style={s.body}>
      <ReportHeader
        title="Settings"
        subtitle="Plan, company & notifications"
        onBack={() => nav.goBack()}
        right={<HeaderAction label={saving ? 'Saving…' : 'Save'} icon="check" onPress={handleSave} disabled={saving} />}
      />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Subscription (phase2.md Flow 3) */}
        <SubscriptionSection onManage={() => nav.navigate('RenewSubscription', { mode: 'change' })} />

        {/* Company */}
        <SectionHeader title="COMPANY" />
        <View style={s.card}>
          <NavRow icon="briefcase" label="Company Profile" onPress={() => nav.navigate('CompanyProfile')} />
          {showUserManagement && (
            <>
              <View style={s.divider} />
              <NavRow icon="users" label="User Management" onPress={() => nav.navigate('UserManagement')} />
            </>
          )}
        </View>

        {/* Notifications */}
        <SectionHeader title="NOTIFICATIONS" />
        <View style={s.card}>
          <ToggleRow icon="file-text" label="Invoices" value={prefs.notifyInvoice} onChange={toggle('notifyInvoice')} />
          <View style={s.divider} />
          <ToggleRow icon="credit-card" label="Payments" value={prefs.notifyPayment} onChange={toggle('notifyPayment')} />
          <View style={s.divider} />
          <ToggleRow icon="file-minus" label="Bills" value={prefs.notifyBill} onChange={toggle('notifyBill')} />
          <View style={s.divider} />
          <ToggleRow icon="package" label="Inventory" value={prefs.notifyInventory} onChange={toggle('notifyInventory')} />
          <View style={s.divider} />
          <ToggleRow icon="truck" label="Deliveries" value={prefs.notifyDelivery} onChange={toggle('notifyDelivery')} />
        </View>

        {/* About */}
        <SectionHeader title="ABOUT" />
        <View style={s.card}>
          <View style={s.row}>
            <Feather name="info" size={18} color={P.brand} style={s.rowIcon} />
            <Text style={[s.rowLabel, { flex: 1 }]}>Version</Text>
            <Text style={s.rowValue}>1.0.0</Text>
          </View>
        </View>

        {/* Account */}
        <SectionHeader title="ACCOUNT" />
        <View style={s.card}>
          <TouchableOpacity
            style={[s.row, signingOut && { opacity: 0.6 }]}
            activeOpacity={0.55}
            onPress={confirmSignOut}
            disabled={signingOut}
          >
            <Feather name="log-out" size={18} color={P.danger} style={s.rowIcon} />
            <Text style={[s.rowLabel, { flex: 1, color: P.danger }]}>
              {signingOut ? 'Signing Out…' : 'Sign Out'}
            </Text>
            {signingOut && <ActivityIndicator size="small" color={P.danger} />}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default SettingsScreen;

/* ─── styles ─── */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.pageBg },
  safeTop: { backgroundColor: HEADER_NAVY[0] },
  body: { flex: 1, backgroundColor: P.pageBg },
  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  sectionHeader: {
    ...typography.labelSm,
    color: P.sectionLabel,
    letterSpacing: 0.8,
    marginTop: spacing.xl,
    marginBottom: spacing.xxs,
    marginLeft: spacing.xxs,
  },
  card: {
    backgroundColor: P.card,
    borderRadius: radius.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  rowIcon: { marginRight: 12, width: 22 },
  rowLabel: {
    ...typography.bodyMd,
    color: P.text,
  },
  rowValue: {
    ...typography.bodySm,
    color: P.sub,
    marginRight: 6,
  },
  divider: { height: 1, backgroundColor: P.divider, marginLeft: 50 },
  manageBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: P.brand, marginHorizontal: spacing.md, marginVertical: 12,
    paddingVertical: 12, borderRadius: radius.lg,
  },
  manageBtnDisabled: { backgroundColor: colors.neutral400 },
  awaitCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: colors.warningLighter, borderWidth: 1, borderColor: colors.warningLight,
    borderRadius: radius.lg, marginHorizontal: spacing.md, marginTop: 12,
    padding: 12,
  },
  awaitTitle: {
    ...typography.h5,
    color: colors.warningHover,
  },
  awaitText: {
    ...typography.caption,
    color: colors.warningHover, lineHeight: 17, marginTop: 3,
  },
  manageBtnText: {
    ...typography.labelLg,
    color: colors.neutral0,
  }
});
