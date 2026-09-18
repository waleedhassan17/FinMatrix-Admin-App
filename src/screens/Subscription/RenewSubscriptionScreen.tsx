// ═══════════════════════════════════════════════════════
// FinMatrix — Renew / Choose Plan (Flow 2 landing + Flow 3 plan chooser)
// When accountStatus='inactive' this is the ONLY reachable screen (renew-only).
// From Settings it is opened as a plan chooser (mode='change').
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import {
  AuthLayout,
  AuthHeader,
  AuthFooterBar
} from '../../components/auth/AuthUI';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { isLapsedTrial } from '../../utils/trial';
import { useSignOut } from '../../hooks/useSignOut';
import { bootstrapSession } from '../../components/app-container/appContainerSlice';
import { THEME } from '../../theme';

// Design-system tokens (see src/theme/theme.ts).
const { colors, typography } = THEME;
import {
  getBillingStatusAPI,
  getPlansForTypeAPI,
  type BillingStatus,
  type TierPlanCard
} from '../../networks/billing/billingNetwork';

const DS = {
  navy: THEME.colors.neutral900,
  primary: THEME.colors.actionGreen,
  amber: THEME.colors.warningHover,
  bg: THEME.colors.background,
  surface: THEME.colors.neutral0,
  border: THEME.colors.border,
  text: { h: THEME.colors.textPrimary, sub: THEME.colors.textSecondary, muted: THEME.colors.textTertiary, inv: THEME.colors.neutral0 }
};

// Plan cards come from GET /billing/plans — the two tier plans (3mo + 6mo)
// for THIS company's type, with server-set prices. The legacy standard/pro
// cards that used to be hardcoded here are no longer offered anywhere (the
// backend also rejects them for tier companies with PLAN_TYPE_MISMATCH).
const PLAN_ACCENTS = [THEME.colors.success, THEME.colors.secondary];

const perksFor = (p: TierPlanCard): string[] => {
  const perks = ['Full accounting suite'];
  if (p.deliveryPersonnelLimit > 0) {
    perks.push(`Up to ${p.deliveryPersonnelLimit} delivery personnel`);
  }
  if (p.monthlySavingsLabel) {
    perks.push(`Save ${p.monthlySavingsLabel}/month vs the 3-month plan`);
  }
  return perks;
};

type Props = NativeStackScreenProps<RootStackParamList, 'RenewSubscription'>;

const RenewSubscriptionScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const mode = route.params?.mode ?? 'renew';
  const companyStatus = useAppSelector(s => s.auth.user?.companyStatus ?? null);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [plans, setPlans] = useState<TierPlanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const resyncing = useRef(false);

  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        getBillingStatusAPI(),
        getPlansForTypeAPI().then(r => r.plans).catch(() => [] as TierPlanCard[]),
      ]);
      setStatus(s);
      if (p.length > 0) setPlans(p);
      // Approved while we sat here (renew-only gate): billing says the
      // account is active again but Redux still holds the stale 'inactive'
      // companyStatus that keeps this gate mounted. Re-run the session
      // bootstrap — /auth/me refreshes the user and the navigator swaps
      // straight back into the app. Without this the user stayed stuck on
      // this screen until a full app restart.
      if (
        mode === 'renew' &&
        s.accountStatus === 'active' &&
        companyStatus !== 'active' &&
        !resyncing.current
      ) {
        resyncing.current = true;
        dispatch(bootstrapSession());
      }
    } catch {
      /* keep last */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode, companyStatus, dispatch]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const awaiting = status?.lastSubmission?.status === 'submitted';
  // A rejected TRIAL request is not a failed payment; this screen only speaks
  // about payments.
  const rejected =
    status?.lastSubmission?.status === 'rejected' && status.lastSubmission.kind !== 'TRIAL';
  // Copy only: a company that is (or was) on a free trial has never paid, so
  // "renew" is the wrong word for it — it is subscribing for the first time.
  const trial = isLapsedTrial(status);

  // While a submission is with the admin, poll so approval lands without the
  // user having to pull-to-refresh (20s is plenty for a manual review flow).
  useEffect(() => {
    if (!awaiting) return;
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [awaiting, load]);

  const choose = (plan: string) => {
    if (awaiting) return; // a submission is already with the admin — no double-pay
    navigation.navigate('SubscriptionPay', { plan, mode: mode === 'renew' ? 'renew' : 'change' });
  };

  // Shared hook: confirm → clear local state → land on sign-in immediately
  // (the network revoke is fire-and-forget). See hooks/useSignOut.ts.
  const { confirmSignOut } = useSignOut();

  if (loading) {
    return (
      <View style={[S.root, S.center]}>
        <ActivityIndicator size="large" color={DS.primary} />
      </View>
    );
  }

  return (
    <AuthLayout
      header={
        <AuthHeader
          pill={
            trial
              ? mode === 'renew' ? 'Free Trial Ended' : 'Subscribe'
              : mode === 'renew' ? 'Renew Subscription' : 'Change Plan'
          }
          title={
            trial
              ? mode === 'renew' ? 'Your trial has ended' : 'Choose a plan'
              : mode === 'renew' ? 'Renew your subscription' : 'Choose a plan'
          }
          subtitle={
            trial
              ? mode === 'renew'
                ? 'Subscribe to keep your data active and switch everything back on.'
                : 'Subscribe any time to add riders and keep going after your trial. Your plan starts as soon as the payment is verified.'
              : mode === 'renew'
                ? 'Your subscription has expired and your account is paused. Renew to restore full access.'
                : 'Upgrade or change your plan at any time.'
          }
          onBack={mode === 'change' ? () => navigation.goBack() : undefined}
        />
      }
      footer={
        mode === 'renew'
          ? (
            <AuthFooterBar
              primary={{ label: 'Refresh status', onPress: load }}
              secondary={{ label: 'Sign out', onPress: confirmSignOut }}
            />
          )
          : undefined
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }>
      <>
        {mode === 'renew' && (
          <View style={S.reassure}>
            <Feather name="shield" size={18} color={DS.primary} />
            <Text style={S.reassureText}>
              {trial
                ? 'Your data is safe. Everything you set up during your trial — invoices, ledger, inventory and delivery records — is intact and will be exactly as you left it once you subscribe.'
                : 'Your data is safe. All your invoices, ledger, inventory and delivery records are intact and will be exactly as you left them after you renew.'}
            </Text>
          </View>
        )}

        {/* Current plan snapshot */}
        {status && (
          <View style={S.currentCard}>
            <Text style={S.currentLabel}>CURRENT PLAN</Text>
            <View style={S.currentRow}>
              <Text style={S.currentPlan}>{status.planLabel}</Text>
              <View style={[S.pill, statusPill(status.subscriptionStatus)]}>
                <Text style={S.pillText}>{status.subscriptionStatus.toUpperCase()}</Text>
              </View>
            </View>
            {status.expiryDate && (
              <Text style={S.currentMeta}>
                {trial
                  ? status.subscriptionStatus === 'expired' || status.accountStatus === 'inactive'
                    ? 'Trial ended on '
                    : 'Trial ends on '
                  : status.subscriptionStatus === 'expired'
                    ? 'Expired on '
                    : 'Renews / expires on '}
                {new Date(status.expiryDate).toDateString()}
              </Text>
            )}
          </View>
        )}

        {awaiting && (
          <View style={[S.banner, { backgroundColor: THEME.colors.warningLighter, borderColor: THEME.colors.warningLight }]}>
            <Feather name="clock" size={16} color={DS.amber} />
            <Text style={[S.bannerText, { color: DS.amber }]}>
              Bill submitted successfully — waiting for admin approval. Your plan activates
              automatically once the payment is verified.
            </Text>
          </View>
        )}
        {rejected && !awaiting && (
          <View style={[S.banner, { backgroundColor: colors.dangerLighter, borderColor: colors.dangerLight }]}>
            <Feather name="alert-circle" size={16} color={THEME.colors.danger} />
            <Text style={[S.bannerText, { color: THEME.colors.dangerHover }]}>
              Your last payment could not be verified
              {status?.lastSubmission?.rejectionReason
                ? `: ${status.lastSubmission.rejectionReason}`
                : ''}
              . Please submit again.
            </Text>
          </View>
        )}

        <Text style={S.pickHeading}>
          {mode === 'renew'
            ? trial ? 'Select a plan to subscribe' : 'Select a plan to renew'
            : 'Available plans'}
        </Text>
        {plans.length === 0 ? (
          <View style={S.banner}>
            <Feather name="wifi-off" size={16} color={DS.text.sub} />
            <Text style={[S.bannerText, { color: DS.text.sub }]}>
              Could not load the plans. Pull down to try again.
            </Text>
          </View>
        ) : (
          plans.map((p, i) => (
            <TouchableOpacity
              key={p.key}
              style={[S.planCard, awaiting && S.planCardDisabled]}
              activeOpacity={0.85}
              disabled={awaiting}
              onPress={() => choose(p.key)}
            >
              <View style={[S.planStripe, { backgroundColor: PLAN_ACCENTS[i % PLAN_ACCENTS.length] }]} />
              <View style={{ flex: 1 }}>
                <View style={S.planHeaderRow}>
                  <Text style={S.planName}>{p.durationMonths} months</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={S.planPrice}>
                      {p.monthlyLabel} <Text style={S.planDuration}>/ month</Text>
                    </Text>
                    <Text style={S.planTotal}>
                      {p.durationMonths} months · {p.totalLabel} total
                    </Text>
                  </View>
                </View>
                {perksFor(p).map((perk) => (
                  <View key={perk} style={S.perkRow}>
                    <Feather name="check" size={13} color={DS.primary} />
                    <Text style={S.perkText}>{perk}</Text>
                  </View>
                ))}
              </View>
              <Feather name="chevron-right" size={20} color={DS.text.muted} />
            </TouchableOpacity>
          ))
        )}

        <Text style={S.footnote}>
          {"Prices are for your company's tier. All features of your tier stay available for the whole subscription period, and your data is never deleted between renewals."}
        </Text>

      </>
    </AuthLayout>
  );
};

function statusPill(s: string) {
  if (s === 'expired') return { backgroundColor: colors.dangerLight };
  if (s === 'expiring') return { backgroundColor: colors.warningLighter };
  return { backgroundColor: colors.successLighter };
}

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { backgroundColor: DS.navy, paddingHorizontal: 20, paddingBottom: 22 },
  back: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 12,
  },
  brandRow: { marginBottom: 14, marginTop: 4 },
  brand: { ...THEME.typography.h3, fontWeight: typography.labelLg.fontWeight },
  headerTitle: { ...THEME.typography.displaySm, color: colors.neutral0 },
  headerSub: { ...THEME.typography.bodySm, color: 'rgba(255,255,255,0.7)', marginTop: 6, lineHeight: 19 },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },

  reassure: {
    flexDirection: 'row', gap: 10, backgroundColor: colors.actionGreenLighter, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: THEME.colors.successLight,
  },
  reassureText: { ...THEME.typography.bodySm, flex: 1, color: THEME.colors.successHover, lineHeight: 19 },

  currentCard: { backgroundColor: DS.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: DS.border },
  currentLabel: { ...THEME.typography.overline, color: DS.text.muted, letterSpacing: 1 },
  currentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  currentPlan: { ...THEME.typography.h3, color: DS.text.h },
  currentMeta: { ...THEME.typography.caption, color: DS.text.sub, marginTop: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillText: { ...THEME.typography.overline, color: DS.text.h },

  banner: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1 },
  bannerText: { ...THEME.typography.caption, flex: 1, lineHeight: 17 },

  pickHeading: { ...THEME.typography.h5, color: DS.text.h, marginTop: 4 },
  planCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: DS.surface,
    borderRadius: 14, padding: 16, borderWidth: 1, borderColor: DS.border,
  },
  planCardDisabled: { opacity: 0.45 },
  planStripe: { width: 4, alignSelf: 'stretch', borderRadius: 3 },
  planHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  planName: { ...THEME.typography.h4, color: DS.text.h },
  planPrice: { ...THEME.typography.labelLg, color: DS.primary },
  planDuration: { ...THEME.typography.labelSm, color: DS.text.muted },
  planTotal: { ...THEME.typography.overline, color: DS.text.sub, marginTop: 2 },
  perkRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 2 },
  perkText: { ...THEME.typography.caption, color: DS.text.sub },

  footnote: { ...THEME.typography.caption, color: DS.text.muted, textAlign: 'center', lineHeight: 16, marginTop: 4 },
  signOut: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  signOutText: { ...THEME.typography.bodySm, color: DS.text.sub, fontWeight: typography.labelLg.fontWeight }
});

export default RenewSubscriptionScreen;
