// ═══════════════════════════════════════════════════════
// FinMatrix — Subscription Plans Screen (Super Admin)
// ═══════════════════════════════════════════════════════

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { THEME, statusStyle } from '../../../theme';
import { AdminScreenHeader } from '../../../components/admin/AdminUI';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;
import {
  WAREHOUSE_ONLY_BUILD,
  DEFAULT_COMPANY_TYPE,
} from '../../../utils/featureGates';
import { resolvePlanFeatures } from '../../../utils/planFeatures';
import {
  loadPlans,
  selectPlans,
  selectPlansStatus,
} from '../superAdminSlice';

const PLAN_GRADIENTS: readonly [string, string][] = [
  [colors.primary, colors.primaryDark],
  [colors.info, colors.primaryDark],
  [colors.success, colors.successHover],
  [colors.warning, colors.warningHover],
  [colors.secondary, colors.secondary],
];

// NOTE: the plan create/edit modal that used to live here was removed.
// Plans are defined in the server config (billing/plan-config.ts); the
// API rejects create/update/delete with PLANS_CONFIG_DEFINED, so the form
// could never save. It was unreachable dead code and held the screen's
// only lint error (setState called synchronously inside an effect).
// This screen is therefore read-only: change pricing in the server config.

/**
 * The plan shape GET /super-admin/plans actually returns. The slice's
 * SubscriptionPlan type predates tiering and omits these fields, which is why
 * this screen used to cast everything through `any`.
 * Source: super-admin.service.ts → listPlans().
 */
interface ServerPlan {
  name: string;
  description?: string | null;
  priceMonthly: number | string;
  features?: string[] | null;
  maxInvoices: number | null;
  companyType?: string | null;
  durationMonths?: number;
  monthlyLabel?: string;
  totalLabel?: string;
  deliveryPersonnelLimit?: number;
}

interface DisplayPlan {
  name: string;
  description: string;
  isFree: boolean;
  priceLabel: string;
  durationLabel?: string;
  totalLabel?: string;
  companyType?: string | null;
  features: string[];
  maxInvoices: number | null;
  /** Active delivery riders allowed. The only thing separating warehouse plans. */
  deliveryPersonnelLimit?: number;
  disabled: boolean;
}

/** "12 months" reads as a count; "1 year" reads as a plan. */
const formatDuration = (months?: number): string =>
  months === 12
    ? '1 year'
    : months && months % 12 === 0
    ? `${months / 12} years`
    : `${months} months`;

const TIER_LABELS: Record<string, string> = {
  small_business: 'Small Business',
  large_org: 'Large Organization',
  warehouse: 'Warehouse',
};

const CANONICAL_PLANS: DisplayPlan[] = [
  {
    name: 'Free',
    description: 'Everything you need to start running your books.',
    isFree: true,
    priceLabel: 'Free',
    features: ['Full accounting', 'Invoices & bills', 'Reports'],
    maxInvoices: null,
    disabled: false,
  },
  {
    name: 'Standard',
    description: 'For growing teams — more seats and volume.',
    isFree: false,
    priceLabel: 'Rs 1,000',
    durationLabel: '/ 6 months',
    // Named explicitly rather than "Everything in <plan>", which points at a
    // plan the reader may not be looking at.
    features: ['Full accounting, invoices & bills', 'Priority support', 'Higher limits'],
    maxInvoices: null,
    disabled: true,
  },
  {
    name: 'Pro',
    description: 'For established businesses that need it all.',
    isFree: false,
    priceLabel: 'Rs 2,000',
    durationLabel: '/ 3 months',
    features: ['Full accounting, invoices & bills', 'Advanced analytics', 'Dedicated support'],
    maxInvoices: null,
    disabled: true,
  },
];

// ── Plan Card (display-only; same UI used in signup) ──
const PlanCard: React.FC<{ plan: DisplayPlan; gradientIdx: number }> = ({ plan, gradientIdx }) => {
  const gradient = PLAN_GRADIENTS[gradientIdx % PLAN_GRADIENTS.length];

  return (
    <View style={[S.planCard, plan.disabled && S.planCardInactive]}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.planGrad}>
        <View style={S.planDecor} />
        <View style={S.planHeaderRow}>
          <Text style={S.planName}>{plan.name}</Text>
          <View style={[S.statusBadge, plan.disabled && S.statusBadgeMuted]}>
            <Text style={S.statusBadgeText}>{plan.disabled ? 'Coming soon' : 'Active'}</Text>
          </View>
        </View>
        {plan.description ? (
          <Text style={S.planDesc} numberOfLines={2}>{plan.description}</Text>
        ) : null}
        <View style={S.planPriceRow}>
          <Text style={S.planPrice}>{plan.priceLabel}</Text>
          {!!plan.durationLabel && <Text style={S.planPriceFreq}>{plan.durationLabel}</Text>}
        </View>
      </LinearGradient>

      <View style={S.planBody}>
        {/* Delivery-personnel allowance is the ONLY thing separating the
            plans, so it is the only limit shown. A seat count would imply a
            difference that does not exist. */}
        {plan.deliveryPersonnelLimit ? (
          <View style={S.planMetaRow}>
            <View style={S.planMeta}>
              <Feather name="truck" size={13} color={colors.textSecondary} />
              <Text style={S.planMetaText}>
                Up to {plan.deliveryPersonnelLimit} delivery personnel
              </Text>
            </View>
          </View>
        ) : null}

        {plan.features.length > 0 && (
          <View style={S.featuresList}>
            {plan.features.slice(0, 4).map(f => (
              <View key={f} style={S.featureItem}>
                <Feather name="check" size={12} color={THEME.colors.success} />
                <Text style={S.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        )}

        {/* The old third branch printed "<n> companies on this plan" from a
            companyCount nothing ever computed, so it could only ever render a
            false "0 companies". Dropped rather than left lying. */}
        {plan.totalLabel || plan.disabled ? (
          <View style={S.planCountRow}>
            <Feather name="briefcase" size={13} color={colors.textTertiary} />
            <Text style={S.planCountText}>
              {plan.totalLabel
                ? `${plan.totalLabel} billed once for the full period`
                : 'Not yet available'}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
const SubscriptionPlansScreen: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const plans = useAppSelector(selectPlans);
  const plansStatus = useAppSelector(selectPlansStatus);

  useEffect(() => {
    dispatch(loadPlans());
  }, [dispatch]);

  // The six tier plans from the server's PLAN_CONFIG (single source of
  // truth); falls back to the legacy canonical cards only if the API gave
  // nothing (old server).
  const displayPlans: DisplayPlan[] = React.useMemo(() => {
    // WAREHOUSE-ONLY BUILD: the server still defines small_business and
    // large_org plans so the two existing companies on them keep renewing,
    // but they are no longer sold — so they are not shown here either.
    // Drop the second predicate to list every tier again.
    const tierPlans = (plans as ServerPlan[] | undefined ?? []).filter(
      p =>
        p.companyType &&
        (!WAREHOUSE_ONLY_BUILD || p.companyType === DEFAULT_COMPANY_TYPE),
    );
    if (tierPlans.length === 0) {
      return CANONICAL_PLANS;
    }
    return tierPlans.map(p => ({
      name: p.name,
      description:
        p.description ?? `${TIER_LABELS[p.companyType ?? ''] ?? ''} plan`,
      isFree: false,
      priceLabel: p.monthlyLabel ?? `Rs ${Number(p.priceMonthly).toLocaleString()}`,
      durationLabel: `/month · ${formatDuration(p.durationMonths)}`,
      totalLabel: p.totalLabel,
      companyType: p.companyType,
      // Never a line naming a plan that is not on this screen.
      features: resolvePlanFeatures(p.features),
      deliveryPersonnelLimit: p.deliveryPersonnelLimit,
      maxInvoices: p.maxInvoices,
      disabled: false,
    }));
  }, [plans]);

  const isLoading = plansStatus === 'loading' && displayPlans.length === 0;

  return (
    <SafeAreaView style={S.container} edges={['top']}>
      <AdminScreenHeader
        title="Subscription Plans"
        subtitle={
          WAREHOUSE_ONLY_BUILD
            ? 'Six warehouse plans · 3 / 5 / 10 delivery personnel · PKR · defined in server config'
            : 'Six plans · two per business type · PKR · defined in server config'
        }
        left={
          <TouchableOpacity onPress={() => (navigation as any).goBack()} style={S.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        }
      />

      {isLoading ? (
        <View style={S.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={S.loadingText}>Loading plans...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={S.listContent} showsVerticalScrollIndicator={false}>
          {['small_business', 'large_org', 'warehouse'].some(t => displayPlans.some(p => p.companyType === t)) ? (
            ['small_business', 'large_org', 'warehouse'].map(tier => {
              const tierPlans = displayPlans.filter(p => p.companyType === tier);
              if (tierPlans.length === 0) return null;
              return (
                <View key={tier} style={{ gap: spacing.sm }}>
                  <Text style={S.tierHeading}>{TIER_LABELS[tier]}</Text>
                  {tierPlans.map((p, index) => (
                    <PlanCard key={p.name} plan={p} gradientIdx={index} />
                  ))}
                </View>
              );
            })
          ) : (
            displayPlans.map((p, index) => (
              <PlanCard key={p.name} plan={p} gradientIdx={index} />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  backBtn: { padding: spacing.xxs },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { ...typography.bodySm, color: colors.textSecondary },

  listContent: { padding: spacing.md, gap: spacing.md, paddingBottom: 30 },
  tierHeading: {
    ...typography.labelMd, color: colors.textSecondary,
    letterSpacing: 0.6, textTransform: 'uppercase', marginTop: spacing.xxs,
  },
  planCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  planCardInactive: { opacity: 0.7 },
  planGrad: { padding: 18, position: 'relative', overflow: 'hidden' },
  planDecor: {
    position: 'absolute', right: -20, top: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  planHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planName: { ...typography.h3, color: colors.neutral0 },
  statusBadge: {
    paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  statusBadgeMuted: { backgroundColor: 'rgba(255,255,255,0.18)' },
  statusBadgeText: { ...typography.overline, color: colors.neutral0 },
  planDesc: { ...typography.caption, color: 'rgba(255,255,255,0.85)', marginTop: spacing.xxs },
  planPriceRow: {
    flexDirection: 'row', alignItems: 'flex-end', marginTop: 14, gap: 6,
  },
  planPrice: { ...typography.h2, color: colors.neutral0 },
  planPriceFreq: { ...typography.bodySm, color: 'rgba(255,255,255,0.75)', marginBottom: 3 },
  planCountRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm,
  },
  planCountText: { ...typography.labelSm, color: colors.textSecondary },

  planBody: { padding: 14 },
  planMetaRow: { flexDirection: 'row', gap: spacing.md, marginBottom: 10 },
  planMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  planMetaText: { ...typography.caption, color: colors.textSecondary },
  featuresList: { gap: 5, marginBottom: spacing.sm },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { ...typography.caption, color: colors.textPrimary },

  // Form Modal

});

export default SubscriptionPlansScreen;
