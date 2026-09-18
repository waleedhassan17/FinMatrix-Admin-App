// ═══════════════════════════════════════════════════════
// FinMatrix — Subscription Plan Selection Screen
// QuickBooks-inspired plan chooser for new companies
// ═══════════════════════════════════════════════════════

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { Alert } from '../../../utils/alert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../types';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { selectUser, setUser } from '../authSlice';
import { getPublicPlansAPI, selfSubscribeAPI } from '../../../networks/billing/superAdminNetwork';
import { authMe, submitCompanyAPI } from '../../../networks/auth/authNetwork';
import {
  getBillingStatusAPI,
  getPlansForTypeAPI,
  startTrialAPI,
  type BillingStatus,
  type TierPlanCard,
} from '../../../networks/billing/billingNetwork';
import { getStoredCompanyId, setStoredCompanyId } from '../../../utils/storageUtils';
import { prefetchBankDetails } from '../../../networks/billing/billingNetwork';
import {
  AuthHeader,
  AuthFooterBar,
  AuthOptionCard,
  AUTH
} from '../../../components/auth/AuthUI';
import {
  WAREHOUSE_ONLY_BUILD,
  DEFAULT_COMPANY_TYPE
} from '../../../utils/featureGates';
import { THEME } from '../../../utils/theme';

// Design-system tokens (see src/theme/theme.ts).
const { colors } = THEME;

// ── Design tokens ─────────────────────────────────────
const DS = {
  navy: colors.neutral900,
  primary: colors.actionGreen,
  primaryDark: colors.actionGreenDark,
  green: colors.actionGreenDark,
  amber: colors.warning,
  purple: colors.secondary,
  bg: colors.background,
  surface: colors.neutral0,
  border: colors.neutral200,
  text: { h: colors.textPrimary, sub: colors.neutral500, muted: colors.textTertiary, inv: colors.neutral0 },
  radius: { sm: 8, md: 12, lg: 16, xl: 20 }
};

const PLAN_COLORS: Record<string, { gradient: [string, string]; badge: string; accent: string }> = {
  Free:         { gradient: [colors.neutral25, colors.border],   badge: colors.neutral500, accent: colors.neutral700 },
  Standard:     { gradient: [colors.actionGreenLighter, colors.successLight],   badge: colors.actionGreen, accent: colors.actionGreenDark },
  Pro:          { gradient: [colors.secondaryLight, colors.secondaryLight],   badge: colors.secondary, accent: colors.secondary },
  Starter:      { gradient: [colors.actionGreenLighter, colors.successLight],   badge: colors.actionGreen, accent: colors.actionGreenDark },
  Professional: { gradient: [colors.actionGreenLighter, colors.successLight],   badge: colors.actionGreenDark, accent: colors.primaryDark },
  Enterprise:   { gradient: [colors.secondaryLight, colors.secondaryLight],   badge: colors.secondary, accent: colors.secondary }
};

interface Plan {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: string;
  priceYearly: string;
  maxUsers: number;
  maxInvoices: number | null;
  features: string[] | null;
  isActive: boolean;
  sortOrder: number;
  // Display overrides (Phase1.md: Rs pricing; paid tiers disabled).
  priceLabel?: string;
  durationLabel?: string;
  disabled?: boolean;
}

type Props = NativeStackScreenProps<RootStackParamList, 'SubscriptionSelect'>;

// Gradient per tier — matches the Super-Admin Subscription Plans card style.
const PLAN_GRADIENTS: Record<string, [string, string]> = {
  Free: [colors.neutral600, colors.neutral700],
  Standard: [colors.actionGreenDark, colors.successHover],
  Pro: [colors.secondary, colors.secondary]
};

// ── Plan Card (same UI/UX as Super-Admin Subscription Plans) ──
const PlanCard: React.FC<{
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
  isPopular?: boolean;
}> = ({ plan, selected, onSelect, isPopular }) => {
  const gradient = PLAN_GRADIENTS[plan.name] ?? PLAN_GRADIENTS.Free;
  const price = parseFloat(plan.priceMonthly);
  const isFree = price === 0;

  return (
    <TouchableOpacity
      activeOpacity={plan.disabled ? 1 : 0.85}
      onPress={() => { if (!plan.disabled) onSelect(); }}
    >
      <View
        style={[
          S.planCard,
          selected && S.planCardSelected,
          plan.disabled && S.planCardInactive,
        ]}
      >
        {/* Gradient header */}
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={S.planGrad}>
          <View style={S.planDecor} />
          <View style={S.planHeaderRow}>
            <Text style={S.planName}>{plan.name}</Text>
            {plan.disabled ? (
              <View style={S.tagBadge}><Text style={S.tagBadgeText}>Coming soon</Text></View>
            ) : isPopular ? (
              <View style={S.tagBadge}><Text style={S.tagBadgeText}>Popular</Text></View>
            ) : selected ? (
              <Feather name="check-circle" size={22} color={colors.neutral0} />
            ) : (
              <Feather name="circle" size={22} color="rgba(255,255,255,0.7)" />
            )}
          </View>
          {plan.description ? (
            <Text style={S.planDesc} numberOfLines={2}>{plan.description}</Text>
          ) : null}
          <View style={S.planPriceRow}>
            {isFree ? (
              <Text style={S.planPrice}>Free</Text>
            ) : (
              <>
                <Text style={S.planPrice}>{plan.priceLabel ?? `Rs ${Math.round(price).toLocaleString()}`}</Text>
                {!!plan.durationLabel && <Text style={S.planPriceFreq}>{plan.durationLabel}</Text>}
              </>
            )}
          </View>
        </LinearGradient>

        {/* Body */}
        <View style={S.planBody}>
          {/* No seat or invoice counts: access is by role — owner, staff and
              delivery personnel — and neither is a limit a buyer chooses. */}

          {plan.features && plan.features.length > 0 && (
            <View style={S.featuresList}>
              {plan.features.slice(0, 4).map((f, i) => (
                <View key={i} style={S.featureItem}>
                  <Feather name="check" size={12} color={THEME.colors.success} />
                  <Text style={S.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Footer: select state / coming soon */}
          <View style={S.planFooter}>
            {plan.disabled ? (
              <View style={S.footerDisabled}>
                <Feather name="clock" size={14} color={DS.text.muted} />
                <Text style={S.footerDisabledText}>Coming soon</Text>
              </View>
            ) : selected ? (
              <View style={S.footerSelected}>
                <Feather name="check" size={14} color={colors.neutral0} />
                <Text style={S.footerSelectedText}>Selected</Text>
              </View>
            ) : (
              <View style={S.footerSelect}>
                <Text style={S.footerSelectText}>Select plan</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ── Tier plan card (three-tier model: 3mo vs 6mo side by side) ──
/**
 * Plan identity is derived from the delivery-personnel allowance rather than
 * parsed out of the server label, so renaming a plan server-side cannot
 * break the UI.
 */
const RUNG_META: Record<number, { name: string; tagline: string }> = {
  3: { name: 'Starter', tagline: 'For a small delivery team finding its feet' },
  5: { name: 'Growth', tagline: 'For a growing operation running daily routes' },
  10: { name: 'Scale', tagline: 'For a full fleet with high delivery volume' }
};
const rungName = (limit: number) => RUNG_META[limit]?.name ?? `Up to ${limit}`;
const rungTagline = (limit: number) =>
  RUNG_META[limit]?.tagline ?? `Up to ${limit} active delivery personnel`;

const TIER_TITLES: Record<string, string> = {
  small_business: 'Small Business',
  large_org: 'Large Organization',
  warehouse: 'Warehouse'
};

/** "12 months" reads as a count; "1 year" reads as a plan. */
const formatDuration = (months: number): string =>
  months === 12 ? '1 year' : months % 12 === 0 ? `${months / 12} years` : `${months} months`;

const TierCard: React.FC<{
  plan: TierPlanCard;
  selected: boolean;
  onSelect: () => void;
}> = ({ plan, selected, onSelect }) => {
  // The longer period carries the savings badge. Comparing against a
  // hardcoded month count would break again the next time the offered
  // durations change, so key off the badge the server computed.
  const isLonger = !!plan.monthlySavingsLabel;
  const durationLabel = formatDuration(plan.durationMonths);
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onSelect} style={{ flex: 1 }}>
      <View style={[S.tierCard, selected && S.tierCardSelected]}>
        {isLonger ? (
          <View style={S.saveBadge}>
            <Feather name="zap" size={10} color={colors.neutral0} />
            <Text style={S.saveBadgeText}>Save {plan.monthlySavingsLabel}</Text>
          </View>
        ) : (
          <View style={S.saveBadgeSpacer} />
        )}
        <Text style={S.tierDuration}>{durationLabel}</Text>
        <View style={S.tierPriceRow}>
          <Text style={S.tierPrice}>{plan.monthlyLabel}</Text>
          <Text style={S.tierPriceUnit}>/mo</Text>
        </View>
        <Text style={S.tierTotal}>
          {plan.totalLabel} billed once{'\n'}for {durationLabel}
        </Text>
        <View style={[S.tierSelect, selected && S.tierSelectOn]}>
          <Feather name={selected ? 'check-circle' : 'circle'} size={15} color={selected ? colors.neutral0 : DS.text.muted} />
          <Text style={[S.tierSelectText, selected && S.tierSelectTextOn]}>
            {selected ? 'Selected' : 'Select'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
const SubscriptionSelectScreen: React.FC<Props> = ({ navigation, route }) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const user = useAppSelector(selectUser);

  // Three-tier flow (FinMatrix.md): when the company registered with a type,
  // show ONLY that type's TWO plans (3-month and 6-month) from the server's
  // PLAN_CONFIG, then hand off to the bank-transfer payment screen. The
  // legacy plan list below remains for pre-tiering drafts (no companyType).
  // WAREHOUSE-ONLY BUILD: fall back to warehouse rather than null, so a
  // pre-tiering draft shows the two warehouse plans instead of the legacy
  // Free/Standard/Pro list. Drop the last fallback to restore three tiers.
  const companyType =
    route.params?.companyType ??
    (user as any)?.companyType ??
    (WAREHOUSE_ONLY_BUILD ? DEFAULT_COMPANY_TYPE : null);
  const [tierPlans, setTierPlans] = useState<TierPlanCard[]>([]);
  // Two steps: choose the rider tier, then the billing period for it.
  // Presenting six priced cards at once asks the user to weigh team size and
  // commitment length simultaneously; splitting them makes each a single
  // decision.
  const [tierStep, setTierStep] = useState<'tier' | 'period'>('tier');
  // Read once on mount; the Continue tap must not await AsyncStorage.
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(null);
  const [selectedLimit, setSelectedLimit] = useState<number | null>(null);

  // Group the offered plans by delivery-personnel allowance, cheapest rung
  // first, so each rung shows its 3-month / 6-month pair together.
  const personnelRungs = React.useMemo(() => {
    const byLimit = new Map<number, TierPlanCard[]>();
    for (const p of tierPlans) {
      const list = byLimit.get(p.deliveryPersonnelLimit) ?? [];
      list.push(p);
      byLimit.set(p.deliveryPersonnelLimit, list);
    }
    return [...byLimit.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([limit, plans]) => ({
        limit,
        plans: [...plans].sort((a, b) => a.durationMonths - b.durationMonths),
      }));
  }, [tierPlans]);
  const [selectedTierKey, setSelectedTierKey] = useState<string | null>(null);

  // Free trial: the request itself (not best-effort — it IS the action), and
  // the company's billing status so a previous trial outcome can be shown.
  const [trialBusy, setTrialBusy] = useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submitting, setSubmitting] = useState(false);


  const loadTierPlans = async () => {
    try {
      const data = await getPlansForTypeAPI(companyType);
      const list = data?.plans ?? [];
      setTierPlans(list);
      // Pre-select the 6-month plan (best value).
      setSelectedTierKey(list.find(p => !!p.monthlySavingsLabel)?.key ?? list[0]?.key ?? null);
    } catch {
      // Empty state below
    } finally {
      setLoadingPlans(false);
    }
  };

  /** Step 1 advances to the period picker; step 2 goes to payment. */
  const handleTierPrimary = async () => {
    if (tierStep === 'tier') {
      if (!selectedLimit) return;
      // Preselect the better-value period so the step is one tap for anyone
      // who does not want to compare.
      const rung = personnelRungs.find(r => r.limit === selectedLimit);
      const best = rung?.plans.find(p => !!p.monthlySavingsLabel) ?? rung?.plans[0];
      setSelectedTierKey(best?.key ?? null);
      // Warm the payment screen's bank details now. The user spends a few
      // seconds on the period step, which covers the round-trip, so
      // "Continue to payment" lands on a rendered screen instead of a
      // spinner. Fire-and-forget: the payment screen still fetches on mount.
      rung?.plans.forEach(p => prefetchBankDetails(p.key));
      setTierStep('period');
      return;
    }
    await handleContinueTier();
  };

  const handleContinueTier = async () => {
    if (!selectedTierKey) {
      Alert.alert('Select a Plan', 'Please choose a subscription plan to continue.');
      return;
    }
    // resolvedCompanyId was read on mount, so the tap does not wait on
    // AsyncStorage before navigating.
    const companyId =
      resolvedCompanyId ?? route.params?.companyId ?? user?.companyId ?? '';
    navigation.navigate('SubscriptionPay', {
      plan: selectedTierKey,
      mode: 'signup',
      companyId,
    });
  };

  /**
   * Request the 30-day free trial. It does not start anything: the company
   * moves to "awaiting review", BaseNavigator shows the pending screen, and
   * the 30 days begin when a super-admin approves.
   *
   * Every refusal is shown exactly as the server words it — "already used
   * with this phone number", "verify your email first" — because a generic
   * "something went wrong" would leave the owner with no idea what to fix.
   */
  const handleStartTrial = async () => {
    if (trialBusy) return;
    // Same resolution as handleContinueTier.
    const companyId =
      resolvedCompanyId ?? route.params?.companyId ?? user?.companyId ?? '';
    if (!companyId) {
      Alert.alert('Company required', 'Set up your company before requesting a free trial.');
      return;
    }
    setTrialBusy(true);
    try {
      await startTrialAPI(companyId);
      // Refresh the session so the gate sees the request. The server reports
      // `pending` while it is in review, which swaps the navigator straight to
      // the pending screen — the same path a submitted payment takes.
      try {
        const me = await authMe();
        if (me.data.companyId) await setStoredCompanyId(me.data.companyId);
        dispatch(
          setUser({ ...me.data.user, companyId: me.data.companyId ?? me.data.user.companyId ?? companyId }),
        );
      } catch {
        // Refresh failed, but the request is in. Move the gate locally to the
        // state the server reports for it, so the owner is not left here.
        if (user) dispatch(setUser({ ...user, companyId, companyStatus: 'pending' }));
      }
    } catch (e: any) {
      Alert.alert('Free trial not available', e?.message ?? 'Please try again.');
    } finally {
      setTrialBusy(false);
    }
  };

  const loadPlans = async () => {
    try {
      const data = await getPublicPlansAPI();
      const list: Plan[] = Array.isArray(data) ? data : (data?.data ?? []);
      // Canonical signup tiers (Phase1.md): only Free is selectable; Standard &
      // Pro are display-only ("Coming soon"). Free is backed by the real free
      // plan so the subscription is created for real.
      const realFree = list.find(p => parseFloat(p.priceMonthly) === 0 && p.isActive);
      const freeId = realFree?.id ?? 'free';
      const cards: Plan[] = [
        {
          id: freeId,
          name: 'Free',
          description: 'Everything you need to start running your books.',
          priceMonthly: '0',
          priceYearly: '0',
          maxUsers: realFree?.maxUsers ?? 3,
          maxInvoices: realFree?.maxInvoices ?? null,
          features: realFree?.features ?? ['Full accounting', 'Invoices & bills', 'Reports'],
          isActive: true,
          sortOrder: 0,
        },
        {
          id: 'standard',
          name: 'Standard',
          description: 'For growing teams — more seats and volume.',
          priceMonthly: '1000',
          priceYearly: '6000',
          maxUsers: 10,
          maxInvoices: null,
          // Named explicitly rather than "Everything in <plan>", which points
          // at a plan the reader may not be looking at.
          features: ['Full accounting, invoices & bills', 'Priority support', 'Higher limits'],
          isActive: true,
          sortOrder: 1,
          priceLabel: 'Rs 1,000',
          durationLabel: '/ 6 months',
          disabled: true,
        },
        {
          id: 'pro',
          name: 'Pro',
          description: 'For established businesses that need it all.',
          priceMonthly: '2000',
          priceYearly: '8000',
          maxUsers: 999,
          maxInvoices: null,
          features: ['Full accounting, invoices & bills', 'Advanced analytics', 'Dedicated support'],
          isActive: true,
          sortOrder: 2,
          priceLabel: 'Rs 2,000',
          durationLabel: '/ 3 months',
          disabled: true,
        },
      ];
      setPlans(cards);
      setSelectedId(freeId); // pre-select Free (the only selectable tier)
    } catch {
      // Fallback: will show empty state
    } finally {
      setLoadingPlans(false);
    }
  };

  // The header entrance animation went with the old bespoke header. Its two
  // Animated.Values were the source of this file's "cannot access refs during
  // render" lint errors, so they are gone rather than left orphaned.
  useEffect(() => {
    // Resolve the stored company id once so the Continue tap is synchronous.
    void getStoredCompanyId().then(setResolvedCompanyId).catch(() => {});
    if (companyType) {
      loadTierPlans();
      // Best-effort: only decides whether to show a past trial decision and
      // whether the trial card applies at all. The server re-checks everything
      // when the trial is actually requested.
      void getBillingStatusAPI().then(setBillingStatus).catch(() => {});
    } else loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = async () => {
    if (!selectedId) {
      Alert.alert('Select a Plan', 'Please choose a subscription plan to continue.');
      return;
    }
    setSubmitting(true);
    // Real backend company id (set during CreateCompany); the x-company-id
    // header also carries it, but submit needs it in the URL.
    const storedId = await getStoredCompanyId();
    const companyId = storedId ?? route.params?.companyId ?? user?.companyId ?? '';
    try {
      // Step B: choose plan.
      await selfSubscribeAPI(selectedId);
      // Step C: submit company onboarding for platform-admin approval.
      let status = 'pending_approval';
      try {
        const res = await submitCompanyAPI(companyId);
        status = res?.status ?? 'pending_approval';
      } catch (submitErr: any) {
        Alert.alert(
          'Almost there',
          submitErr?.message ??
            'Your plan was saved but submission failed. Please try again.',
        );
      }
      if (user) {
        dispatch(setUser({ ...user, companyId, companyStatus: status }));
      }
    } catch (e: any) {
      Alert.alert('Subscription Failed', e?.message ?? 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    // A plan is required before submitting, so "skip" keeps the company as a
    // draft and returns the admin to plan selection.
    if (user) {
      const companyId = route.params?.companyId ?? user.companyId;
      dispatch(setUser({ ...user, companyId, companyStatus: 'email_verified' }));
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedId);

  return (
    <View style={S.rootShell}>
      <AuthHeader
        pill="Choose a Plan"
        title={tierStep === 'period' ? 'Choose a billing period' : 'Choose your plan'}
        subtitle={'Select the plan that best fits your business.\nYou can upgrade anytime.'}
        onBack={
          tierStep === 'period'
            ? () => setTierStep('tier')
            : navigation.canGoBack()
            ? () => navigation.goBack()
            : undefined
        }
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={S.scroll}
        showsVerticalScrollIndicator={false}>
        {/* Plans */}
        <View style={S.content}>
          {loadingPlans ? (
            <View style={S.loaderWrap}>
              <ActivityIndicator size="large" color={DS.primary} />
              <Text style={S.loadingText}>Loading plans…</Text>
            </View>
          ) : companyType ? (
            tierPlans.length === 0 ? (
              <View style={S.loaderWrap}>
                <Text style={S.loadingText}>Could not load plans. Check your connection and try again.</Text>
              </View>
            ) : (
              <>
                {tierStep === 'tier' ? (
                  <>
                    {billingStatus?.lastSubmission?.kind === 'TRIAL' &&
                    billingStatus.lastSubmission.status === 'rejected' ? (
                      <View style={S.trialNotice}>
                        <Feather name="info" size={14} color={colors.warning} />
                        <Text style={S.trialNoticeText}>
                          We couldn’t activate a free trial
                          {billingStatus.lastSubmission.rejectionReason
                            ? `: ${billingStatus.lastSubmission.rejectionReason}`
                            : '.'}{' '}
                          You can choose a plan below to get started.
                        </Text>
                      </View>
                    ) : null}
                    {!billingStatus?.isTrial ? (
                      <View style={S.trialCard}>
                        <View style={S.trialHead}>
                          <View style={S.trialIcon}>
                            <Feather name="gift" size={18} color={DS.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={S.trialTitle}>Try FinMatrix free for 30 days</Text>
                            <Text style={S.trialBody}>
                              Every accounting and warehouse feature, with one delivery rider.
                              Choose a plan whenever you’re ready.
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={[S.trialBtn, trialBusy && S.trialBtnBusy]}
                          onPress={handleStartTrial}
                          disabled={trialBusy}
                          accessibilityRole="button"
                          accessibilityState={{ busy: trialBusy, disabled: trialBusy }}
                        >
                          {trialBusy ? (
                            <ActivityIndicator size="small" color={colors.neutral0} />
                          ) : (
                            <Text style={S.trialBtnText}>Start 30-day free trial</Text>
                          )}
                        </TouchableOpacity>
                        <Text style={S.trialFine}>
                          No credit card required. Your trial is activated after a quick review — usually
                          within 24 hours.
                        </Text>
                      </View>
                    ) : null}
                    <Text style={S.tierHeading}>
                      How big is your delivery team?
                    </Text>
                    <Text style={S.tierSubheading}>
                      Every plan includes the full accounting and warehouse
                      feature set. Only the number of active delivery
                      personnel changes.
                    </Text>
                    {personnelRungs.map(rung => {
                      const cheapest = rung.plans.reduce((a, b) =>
                        a.monthlyMinorUnits <= b.monthlyMinorUnits ? a : b,
                      );
                      return (
                        <AuthOptionCard
                          key={rung.limit}
                          icon="truck"
                          title={rungName(rung.limit)}
                          tagline={rungTagline(rung.limit)}
                          badge={`Up to ${rung.limit}`}
                          features={[
                            `Up to ${rung.limit} active delivery personnel`,
                            `From ${cheapest.monthlyLabel}/month`,
                            // No team-member claim: access is by role
                            // (owner, staff, delivery personnel), not by seats.
                            'Unlimited customers and vendors',
                          ]}
                          selected={selectedLimit === rung.limit}
                          onPress={() => {
                            setSelectedLimit(rung.limit);
                            setSelectedTierKey(null);
                          }}
                        />
                      );
                    })}
                  </>
                ) : (
                  <>
                    <Text style={S.tierHeading}>
                      {rungName(selectedLimit ?? 0)} — choose a billing period
                    </Text>
                    <Text style={S.tierSubheading}>
                      Up to {selectedLimit} active delivery personnel. Paying
                      for the year costs less per month.
                    </Text>
                    <View style={S.tierRow}>
                      {(personnelRungs.find(r => r.limit === selectedLimit)?.plans ?? []).map(
                        p => (
                          <TierCard
                            key={p.key}
                            plan={p}
                            selected={selectedTierKey === p.key}
                            onSelect={() => setSelectedTierKey(p.key)}
                          />
                        ),
                      )}
                    </View>
                    <View style={S.tierNote}>
                      <Feather name="info" size={13} color={DS.primary} />
                      <Text style={S.tierNoteText}>
                        Pay once by bank transfer and upload the receipt — your company activates as
                        soon as an administrator verifies the payment.
                      </Text>
                    </View>
                  </>
                )}
              </>
            )
          ) : plans.length === 0 ? (
            <View style={S.loaderWrap}>
              <Text style={S.loadingText}>Could not load plans. Tap Continue to proceed.</Text>
            </View>
          ) : (
            plans.map(p => (
              <PlanCard
                key={p.id}
                plan={p}
                selected={selectedId === p.id}
                onSelect={() => setSelectedId(p.id)}
                isPopular={p.name === 'Standard'}
              />
            ))
          )}

          <Text style={S.legalText}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
            Plans are paid once per term. Nothing renews automatically.
          </Text>
        </View>
      </ScrollView>

      <AuthFooterBar
        primary={{
          label: companyType
            ? tierStep === 'tier'
              ? selectedLimit
                ? 'Continue'
                : 'Select a plan'
              : selectedTierKey
              ? 'Continue to payment'
              : 'Select a billing period'
            : selectedPlan && parseFloat(selectedPlan.priceMonthly) === 0
            ? 'Continue with Free Plan'
            : selectedPlan
            ? `Start ${selectedPlan.name} Plan`
            : 'Continue',
          onPress: companyType ? handleTierPrimary : handleContinue,
          loading: submitting,
          loadingLabel: 'Setting up',
          disabled: !!companyType && (tierStep === 'tier' ? !selectedLimit : !selectedTierKey)
        }}
        secondary={
          companyType && tierStep === 'period'
            ? { label: 'Back to plans', onPress: () => setTierStep('tier') }
            : { label: 'Skip for now', onPress: handleSkip }
        }
      />
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────
const S = StyleSheet.create({
  // Shared auth shell: flat navy header, light canvas, sticky footer.
  rootShell: { flex: 1, backgroundColor: AUTH.canvas },
  root: { flex: 1, backgroundColor: DS.bg },
  scroll: { flexGrow: 1 },

  // Header
  header: { position: 'relative', overflow: 'hidden' },
  orbTR: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    top: -70, right: -60, backgroundColor: 'rgba(99,102,241,0.12)'
  },
  orbBL: {
    position: 'absolute', width: 140, height: 140, borderRadius: 70,
    bottom: -40, left: -40, backgroundColor: 'rgba(16,185,129,0.08)'
  },
  headerContent: { paddingHorizontal: 24, paddingBottom: 36, paddingTop: 12 },
  logoRow: { marginBottom: 20 },
  brand: { ...THEME.typography.h2 },
  headerTitle: {
    ...THEME.typography.h1,
    color: DS.text.inv, letterSpacing: -0.5,
    marginBottom: 10
  },
  headerSub: {
    ...THEME.typography.bodySm,
    color: 'rgba(255,255,255,0.6)', lineHeight: 22,
    marginBottom: 16
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20
  },
  pillText: { ...THEME.typography.overline, color: 'rgba(255,255,255,0.7)' },

  // Content
  content: { padding: 16, gap: 12 },
  loaderWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  loadingText: { ...THEME.typography.bodySm, color: DS.text.sub },

  // Plan Card
  // ── Plan card (matches Super-Admin Subscription Plans) ──
  planCard: {
    backgroundColor: DS.surface, borderRadius: 16, overflow: 'hidden',
    borderWidth: 1.5, borderColor: DS.border,
    shadowColor: colors.info, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3
  },
  planCardSelected: { borderColor: DS.primary, borderWidth: 2.5 },
  planCardInactive: { opacity: 0.65 },
  planGrad: { padding: 18, position: 'relative', overflow: 'hidden' },
  planDecor: {
    position: 'absolute', right: -20, top: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)'
  },
  planHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planName: { ...THEME.typography.h3, color: colors.neutral0 },
  tagBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.25)'
  },
  tagBadgeText: { ...THEME.typography.overline, color: colors.neutral0 },
  planDesc: { ...THEME.typography.caption, color: 'rgba(255,255,255,0.85)', marginTop: 4, lineHeight: 17 },
  planPriceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 14, gap: 6 },
  planPrice: { ...THEME.typography.h2, color: colors.neutral0 },
  planPriceFreq: { ...THEME.typography.bodySm, color: 'rgba(255,255,255,0.75)', marginBottom: 3 },

  planBody: { padding: 14 },
  planMetaRow: { flexDirection: 'row', gap: 16, marginBottom: 10, flexWrap: 'wrap' },
  planMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  planMetaText: { ...THEME.typography.caption, color: DS.text.sub },
  featuresList: { gap: 5, marginBottom: 12 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { ...THEME.typography.caption, color: colors.textPrimary },

  planFooter: { borderTopWidth: 1, borderTopColor: DS.border, paddingTop: 12 },
  footerSelect: {
    alignItems: 'center', paddingVertical: 9, borderRadius: 8,
    backgroundColor: colors.infoLight, borderWidth: 1, borderColor: colors.infoLight
  },
  footerSelectText: { ...THEME.typography.labelMd, color: DS.primary },
  footerSelected: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: 8, backgroundColor: DS.primary
  },
  footerSelectedText: { ...THEME.typography.labelMd, color: colors.neutral0 },
  footerDisabled: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, borderRadius: 8, backgroundColor: colors.neutral100
  },
  footerDisabledText: { ...THEME.typography.labelMd, color: DS.text.muted },

  // CTA
  ctaSection: { marginTop: 8, gap: 10 },
  cta: {
    height: 54, borderRadius: DS.radius.lg,
    backgroundColor: DS.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: DS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6
  },
  ctaDisabled: { opacity: 0.7 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ctaLabel: {
    ...THEME.typography.h4,
    color: colors.neutral0,
    letterSpacing: 0.3
  },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipText: {
    ...THEME.typography.h5,
    color: DS.text.muted
  },

  // ── Tier plan cards (three-tier model) ──
  tierHeading: {
    ...THEME.typography.labelLg,
    color: DS.text.h,
    marginBottom: 2
  },
  tierRow: { flexDirection: 'row', gap: 12 },
  tierSubheading: {
    ...THEME.typography.bodySm,
    lineHeight: 20,
    color: DS.text.sub,
    marginTop: -6,
    marginBottom: 16
  },
  rungBlock: { marginBottom: 18 },
  rungHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 9 },
  rungTitle: {
    ...THEME.typography.labelMd,
    color: DS.text.h,
    letterSpacing: 0.2
  },
  tierCard: {
    backgroundColor: DS.surface, borderRadius: 16, borderWidth: 1.5, borderColor: DS.border,
    padding: 14, alignItems: 'center',
    shadowColor: colors.info, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3
  },
  tierCardSelected: { borderColor: DS.primary, borderWidth: 2.5 },
  saveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: DS.amber, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3, marginBottom: 8
  },
  saveBadgeText: { ...THEME.typography.overline, color: colors.neutral0 },
  saveBadgeSpacer: { height: 19, marginBottom: 8 },
  tierDuration: { ...THEME.typography.labelMd, color: DS.text.sub },
  tierPriceRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  tierPrice: { ...THEME.typography.displaySm, color: DS.text.h },
  tierPriceUnit: { ...THEME.typography.bodySm, color: DS.text.muted, marginBottom: 3 },
  tierTotal: {
    ...THEME.typography.caption,
    color: DS.text.muted, textAlign: 'center', lineHeight: 16, marginTop: 6
  },
  tierSelect: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    alignSelf: 'stretch', paddingVertical: 8, borderRadius: 8, marginTop: 12,
    backgroundColor: colors.neutral100
  },
  tierSelectOn: { backgroundColor: DS.primary },
  tierSelectText: { ...THEME.typography.labelSm, color: DS.text.sub },
  tierSelectTextOn: { color: colors.neutral0 },
  tierNote: {
    flexDirection: 'row', gap: 8, backgroundColor: colors.actionGreenLighter, borderRadius: 10, padding: 12
  },
  tierNoteText: { ...THEME.typography.caption, flex: 1, color: DS.text.sub, lineHeight: 18 },

  trialCard: {
    backgroundColor: DS.surface, borderRadius: DS.radius.lg, padding: 16, gap: 12,
    borderWidth: 1.5, borderColor: DS.primary,
  },
  trialHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  trialIcon: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.actionGreenLighter,
  },
  trialTitle: { ...THEME.typography.labelLg, color: DS.text.h },
  trialBody: { ...THEME.typography.bodySm, color: DS.text.sub, marginTop: 2 },
  trialBtn: {
    height: 46, borderRadius: DS.radius.md, backgroundColor: DS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  trialBtnBusy: { opacity: 0.8 },
  trialBtnText: { ...THEME.typography.labelMd, color: colors.neutral0, fontSize: 15 },
  trialFine: { ...THEME.typography.caption, color: DS.text.sub, lineHeight: 18, textAlign: 'center' },
  trialNotice: {
    flexDirection: 'row', gap: 8, backgroundColor: colors.warningLighter, borderRadius: 10, padding: 12,
  },
  trialNoticeText: { ...THEME.typography.caption, flex: 1, color: DS.text.h, lineHeight: 18 },

  legalText: {
    ...THEME.typography.overline,
    color: DS.text.muted, textAlign: 'center',
    lineHeight: 16, marginTop: 4
  },
});

export default SubscriptionSelectScreen;
