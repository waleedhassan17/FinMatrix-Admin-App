// ═══════════════════════════════════════════════════════
// FinMatrix — Revenue Analytics Screen (Super Admin)
// Driven by PLATFORM REVENUE: every approved manual bank-transfer payment
// (phase2.md billing flow) is recorded once in platform_revenue on approval
// and shows up here — totals, monthly trend, by-plan, by-company, recent.
// ═══════════════════════════════════════════════════════

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { THEME, statusStyle } from '../../../theme';
import { AdminScreenHeader } from '../../../components/admin/AdminUI';
import { CHART_SERIES } from '../../../components/reports/ReportUI';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;
import {
  loadPlatformStats,
  selectPlatformStats,
  selectStatsStatus,
} from '../superAdminSlice';
import {
  getPlatformRevenueAPI,
  type RevenueSummary,
} from '../../../networks/billing/billingNetwork';

const { width: W } = Dimensions.get('window');

// Plan badge palette (cycled in order plans appear)
const PLAN_COLORS = CHART_SERIES;

// ── Currency helpers (PKR; API amounts are minor units = paisa) ──
const toRs = (minorUnits: number): number => minorUnits / 100;

// Full amount, e.g. "Rs 12,345"
const fmtRs = (amount: number): string =>
  `Rs ${Math.round(amount).toLocaleString('en-US')}`;

// Compact, e.g. "Rs 1.2M" / "Rs 8.3K"
const fmtRsCompact = (amount: number): string => {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `Rs ${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `Rs ${(amount / 1_000).toFixed(1)}K`;
  return `Rs ${Math.round(amount)}`;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Animated Metric Card ──────────────────────────────
const MetricCard: React.FC<{
  label: string;
  value: string;
  change?: string;
  positive?: boolean;
  icon: string;
  color: string;
  delay?: number;
}> = ({ label, value, change, positive, icon, color, delay = 0 }) => {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, tension: 60, friction: 9, delay, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
    ]).start();
  }, [delay]);

  return (
    <Animated.View style={[S.metricCard, { opacity, transform: [{ scale }] }]}>
      <View style={[S.metricIconBox, { backgroundColor: `${color}18` }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <Text style={S.metricValue}>{value}</Text>
      <Text style={S.metricLabel}>{label}</Text>
      {change ? (
        <View style={S.metricChangeRow}>
          <Feather
            name={positive ? 'trending-up' : 'trending-down'}
            size={11}
            color={positive ? colors.success : colors.danger}
          />
          <Text style={[S.metricChange, { color: positive ? colors.success : colors.danger }]}>{change}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
};

// ── Bar Chart (custom, no SVG dependency) ─────────────
const RevenueBarChart: React.FC<{
  data: { month: string; revenue: number }[];
}> = ({ data }) => {
  const maxVal = Math.max(1, ...data.map(d => d.revenue));
  const bars = data.map((d, i) => ({
    ...d,
    heightPct: (d.revenue / maxVal) * 100,
    isLatest: i === data.length - 1,
  }));

  return (
    <View style={S.chartContainer}>
      {bars.map((bar, i) => (
        <View key={`${bar.month}-${i}`} style={S.barWrapper}>
          <Text style={S.barValue} numberOfLines={1}>{fmtRsCompact(bar.revenue)}</Text>
          <View style={S.barTrack}>
            <View
              style={[
                S.barFill,
                {
                  height: `${bar.heightPct}%` as any,
                  backgroundColor: bar.isLatest ? colors.primary : `${colors.primary}60`,
                },
              ]}
            />
          </View>
          <Text style={[S.barLabel, bar.isLatest && { color: colors.primary, fontWeight: typography.labelLg.fontWeight }]}>
            {bar.month}
          </Text>
        </View>
      ))}
    </View>
  );
};

// ── Plan Revenue Row ──────────────────────────────────
const PlanRow: React.FC<{
  plan: string;
  label: string;
  payments: number;
  revenue: number;
  total: number;
  color: string;
}> = ({ plan, label, payments, revenue, total, color }) => {
  const pct = total > 0 ? Math.round((revenue / total) * 100) : 0;
  const fillAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fillAnim, { toValue: pct / 100, duration: 900, delay: 200, useNativeDriver: false }).start();
  }, [pct]);

  return (
    <View style={S.planRow}>
      <View style={[S.planBadge, { backgroundColor: `${color}18` }]}>
        <Text style={[S.planBadgeText, { color }]}>{label}</Text>
      </View>
      <View style={S.planMeta}>
        <View style={S.planTopRow}>
          <Text style={S.planName}>{plan}</Text>
          <Text style={S.planRevenue}>{fmtRs(revenue)}</Text>
        </View>
        <View style={S.planTrack}>
          <Animated.View
            style={[
              S.planFill,
              {
                backgroundColor: color,
                width: fillAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${pct}%`] }),
              },
            ]}
          />
        </View>
        <Text style={S.planSub}>{payments} {payments === 1 ? 'payment' : 'payments'} · {pct}% of revenue</Text>
      </View>
    </View>
  );
};

// ── Top Company Row ────────────────────────────────────
const CompanyRow: React.FC<{
  rank: number;
  name: string;
  revenue: number;
  plan: string;
  payments: number;
}> = ({ rank, name, revenue, plan, payments }) => (
  <View style={S.coRow}>
    <View style={S.coRank}>
      <Text style={S.coRankText}>{rank}</Text>
    </View>
    <View style={S.coAvatar}>
      <Text style={S.coAvatarText}>{name.slice(0, 2).toUpperCase()}</Text>
    </View>
    <View style={S.coMeta}>
      <Text style={S.coName} numberOfLines={1}>{name}</Text>
      <Text style={S.coPlan}>{plan} · {payments} {payments === 1 ? 'payment' : 'payments'}</Text>
    </View>
    <View style={S.coRight}>
      <Text style={S.coRevenue}>{fmtRs(revenue)}</Text>
    </View>
  </View>
);

// ── Recent Payment Row ─────────────────────────────────
const PaymentRow: React.FC<{
  company: string;
  plan: string;
  amount: string;
  date: string;
}> = ({ company, plan, amount, date }) => (
  <View style={S.coRow}>
    <View style={[S.coAvatar, { backgroundColor: colors.successLighter }]}>
      <Feather name="check" size={16} color={colors.success} />
    </View>
    <View style={S.coMeta}>
      <Text style={S.coName} numberOfLines={1}>{company}</Text>
      <Text style={S.coPlan}>{plan} · {new Date(date).toLocaleDateString()}</Text>
    </View>
    <View style={S.coRight}>
      <Text style={[S.coRevenue, { color: colors.success }]}>+{amount}</Text>
    </View>
  </View>
);

// ── Empty state ───────────────────────────────────────
const EmptyHint: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={S.empty}>
    <Feather name={icon as any} size={22} color={colors.textTertiary} />
    <Text style={S.emptyText}>{text}</Text>
  </View>
);

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
const RevenueAnalyticsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const [refreshing, setRefreshing] = useState(false);

  const stats = useAppSelector(selectPlatformStats);
  const statsStatus = useAppSelector(selectStatsStatus);
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [revLoading, setRevLoading] = useState(true);

  const loadRevenue = useCallback(async () => {
    try {
      setRevenue(await getPlatformRevenueAPI());
    } catch {
      /* keep last */
    } finally {
      setRevLoading(false);
    }
  }, []);

  const loadAll = useCallback(() => {
    dispatch(loadPlatformStats());
    loadRevenue();
  }, [dispatch, loadRevenue]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([dispatch(loadPlatformStats()), loadRevenue()]);
    setRefreshing(false);
  }, [dispatch, loadRevenue]);

  // ── Derived analytics from collected platform revenue ──
  const analytics = useMemo(() => {
    const total = toRs(revenue?.totalMinorUnits ?? 0);
    const thisMonth = toRs(revenue?.thisMonthMinorUnits ?? 0);
    const paymentsCount = revenue?.paymentsCount ?? 0;
    const avgPayment = paymentsCount > 0 ? total / paymentsCount : 0;

    const byPlan = (revenue?.byPlan ?? []).map((p, i) => ({
      plan: p.planLabel,
      label: p.planLabel.slice(0, 3).toUpperCase(),
      payments: p.payments,
      revenue: toRs(p.totalMinorUnits),
      color: PLAN_COLORS[i % PLAN_COLORS.length],
    }));

    const topCompanies = (revenue?.byCompany ?? [])
      .map(c => ({
        name: c.companyName || 'Unknown',
        revenue: toRs(c.totalMinorUnits),
        plan: c.lastPlan,
        payments: c.payments,
      }))
      .slice(0, 8);

    const monthlyTrend = (revenue?.monthly ?? []).map(m => ({
      month: MONTH_LABELS[m.month],
      revenue: toRs(m.totalMinorUnits),
    }));

    const prevMonth =
      monthlyTrend.length >= 2 ? monthlyTrend[monthlyTrend.length - 2].revenue : 0;
    const growthMoM = prevMonth > 0 ? ((thisMonth - prevMonth) / prevMonth) * 100 : 0;
    const firstMonth = monthlyTrend.find(m => m.revenue > 0)?.revenue ?? 0;
    const trendPct =
      firstMonth > 0 ? Math.round(((thisMonth - firstMonth) / firstMonth) * 100) : 0;

    return {
      total,
      thisMonth,
      paymentsCount,
      avgPayment,
      byPlan,
      topCompanies,
      monthlyTrend,
      growthMoM,
      trendPct,
      recent: revenue?.entries ?? [],
      pendingSubmissions: revenue?.pendingSubmissions ?? 0,
    };
  }, [revenue]);

  const totalPlanRevenue = analytics.byPlan.reduce((s, p) => s + p.revenue, 0);
  const totalCompanies = stats?.companies.total ?? 0;

  const loading =
    (statsStatus === 'loading' || revLoading) && !refreshing && !revenue;

  return (
    <SafeAreaView style={S.root} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      {/* Header */}
      <AdminScreenHeader
        title="Revenue Analytics"
        subtitle="Platform financial overview"
        right={
          <View style={[S.headerBadge, { backgroundColor: colors.successLighter }]}>
            <View style={S.liveIndicator} />
            <Text style={S.headerBadgeText}>Live</Text>
          </View>
        }
      />

      {loading ? (
        <View style={S.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={S.loaderText}>Loading platform financials…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[S.content, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Total Revenue Banner */}
          <LinearGradient
            colors={[colors.primary, colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={S.mrrBanner}
          >
            <View style={S.mrrDecor1} />
            <View style={S.mrrDecor2} />
            <View style={S.mrrLeft}>
              <Text style={S.mrrLabel}>Total Platform Revenue</Text>
              <Text style={S.mrrValue}>{fmtRs(analytics.total)}</Text>
              <View style={S.mrrGrowthRow}>
                <Feather name="check-circle" size={14} color="rgba(255,255,255,0.9)" />
                <Text style={S.mrrGrowthText}>
                  {analytics.paymentsCount} approved{' '}
                  {analytics.paymentsCount === 1 ? 'payment' : 'payments'}
                </Text>
              </View>
            </View>
            <View style={S.mrrRight}>
              <View style={S.mrrArrBox}>
                <Text style={S.mrrArrLabel}>THIS MONTH</Text>
                <Text style={S.mrrArrValue}>{fmtRsCompact(analytics.thisMonth)}</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Key Metrics Grid */}
          <View style={S.metricsGrid}>
            <MetricCard
              label="Approved Payments"
              value={String(analytics.paymentsCount)}
              icon="check-circle"
              color={colors.primary}
              delay={0}
            />
            <MetricCard
              label="Total Companies"
              value={String(totalCompanies)}
              icon="briefcase"
              color={colors.success}
              delay={80}
            />
            <MetricCard
              label="Avg. Payment"
              value={fmtRs(analytics.avgPayment)}
              icon="dollar-sign"
              color={colors.warning}
              delay={160}
            />
            <MetricCard
              label="Pending Payments"
              value={String(analytics.pendingSubmissions)}
              icon="clock"
              color={colors.danger}
              delay={240}
            />
          </View>

          {/* Revenue Trend */}
          <View style={S.card}>
            <View style={S.cardHeader}>
              <View>
                <Text style={S.cardTitle}>Revenue Trend</Text>
                <Text style={S.cardSub}>Last 6 months · collected</Text>
              </View>
              {analytics.total > 0 && (
                <View style={S.trendBadge}>
                  <Feather
                    name={analytics.trendPct >= 0 ? 'trending-up' : 'trending-down'}
                    size={13}
                    color={analytics.trendPct >= 0 ? colors.success : colors.danger}
                  />
                  <Text style={[S.trendBadgeText, { color: analytics.trendPct >= 0 ? colors.success : colors.danger }]}>
                    {analytics.trendPct >= 0 ? '+' : ''}{analytics.trendPct}%
                  </Text>
                </View>
              )}
            </View>
            {analytics.total > 0 ? (
              <RevenueBarChart data={analytics.monthlyTrend} />
            ) : (
              <EmptyHint icon="bar-chart-2" text="No revenue collected yet" />
            )}
          </View>

          {/* Revenue by Plan */}
          <View style={S.card}>
            <View style={S.cardHeader}>
              <View>
                <Text style={S.cardTitle}>Revenue by Plan</Text>
                <Text style={S.cardSub}>Breakdown of {fmtRs(totalPlanRevenue)} collected</Text>
              </View>
            </View>
            {analytics.byPlan.length > 0 ? (
              <View style={S.plansList}>
                {analytics.byPlan.map(p => (
                  <PlanRow
                    key={p.plan}
                    plan={p.plan}
                    label={p.label}
                    payments={p.payments}
                    revenue={p.revenue}
                    total={totalPlanRevenue}
                    color={p.color}
                  />
                ))}
              </View>
            ) : (
              <EmptyHint icon="layers" text="No approved payments yet" />
            )}
          </View>

          {/* Top Revenue Companies */}
          <View style={S.card}>
            <View style={S.cardHeader}>
              <View>
                <Text style={S.cardTitle}>Top Companies by Revenue</Text>
                <Text style={S.cardSub}>Total collected per company</Text>
              </View>
            </View>
            {analytics.topCompanies.length > 0 ? (
              analytics.topCompanies.map((co, i) => (
                <CompanyRow
                  key={`${co.name}-${i}`}
                  rank={i + 1}
                  name={co.name}
                  revenue={co.revenue}
                  plan={co.plan}
                  payments={co.payments}
                />
              ))
            ) : (
              <EmptyHint icon="users" text="No paying companies yet" />
            )}
          </View>

          {/* Recent Payments */}
          <View style={S.card}>
            <View style={S.cardHeader}>
              <View>
                <Text style={S.cardTitle}>Recent Payments</Text>
                <Text style={S.cardSub}>Approved bank-transfer submissions</Text>
              </View>
            </View>
            {analytics.recent.length > 0 ? (
              analytics.recent.slice(0, 10).map(e => (
                <PaymentRow
                  key={e.id}
                  company={e.companyName}
                  plan={e.planLabel}
                  amount={e.amountLabel}
                  date={e.recordedAt}
                />
              ))
            ) : (
              <EmptyHint icon="inbox" text="Approved payments will appear here" />
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────
const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  liveIndicator: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  headerBadgeText: { ...typography.labelSm, color: colors.success },

  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loaderText: { ...typography.bodySm, color: colors.textSecondary },

  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: spacing.xs },
  emptyText: { ...typography.caption, color: colors.textTertiary },

  content: { padding: spacing.md, gap: 14 },

  // MRR Banner
  mrrBanner: {
    borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row',
    alignItems: 'center', overflow: 'hidden',
  },
  mrrDecor1: {
    position: 'absolute', right: -20, top: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  mrrDecor2: {
    position: 'absolute', left: -30, bottom: -30,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  mrrLeft: { flex: 1 },
  mrrLabel: { ...typography.caption, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: 0.8 },
  mrrValue: { ...typography.displayMd, color: colors.neutral0, marginTop: spacing.xxs },
  mrrGrowthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, marginTop: 6 },
  mrrGrowthText: { ...typography.caption, color: 'rgba(255,255,255,0.85)', fontWeight: typography.labelLg.fontWeight },
  mrrRight: { alignItems: 'flex-end' },
  mrrArrBox: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignItems: 'center',
  },
  mrrArrLabel: { ...typography.overline, color: 'rgba(255,255,255,0.7)', fontWeight: typography.labelLg.fontWeight },
  mrrArrValue: { ...typography.h3, color: colors.neutral0, marginTop: 2 },

  // Metrics grid
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: {
    width: (W - 42) / 2,
    backgroundColor: colors.surface,
    borderRadius: 14, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border,
    gap: spacing.xxs,
  },
  metricIconBox: {
    width: 34, height: 34, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxs,
  },
  metricValue: { ...typography.h2, color: colors.textPrimary },
  metricLabel: { ...typography.caption, color: colors.textSecondary },
  metricChangeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  metricChange: { ...typography.labelSm },

  // Cards
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: spacing.md, paddingBottom: spacing.sm,
  },
  cardTitle: { ...typography.h5, color: colors.textPrimary },
  cardSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  trendBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xxs,
    backgroundColor: colors.successLighter, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, borderRadius: radius.sm,
  },
  trendBadgeText: { ...typography.labelSm },

  // Bar chart
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 140,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  barWrapper: { flex: 1, alignItems: 'center', height: '100%' },
  barValue: { ...typography.overline, color: colors.textTertiary, marginBottom: 3 },
  barTrack: {
    flex: 1, width: '100%', backgroundColor: colors.neutral100,
    borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end',
  },
  barFill: { width: '100%', borderRadius: 4, minHeight: 4 },
  barLabel: { ...typography.overline, color: colors.textSecondary, marginTop: spacing.xxs },

  // Plan rows
  plansList: { padding: spacing.md, gap: 14 },
  planRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  planBadge: {
    width: 42, height: 42, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  planBadgeText: { ...typography.overline },
  planMeta: { flex: 1 },
  planTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  planName: { ...typography.bodySm, color: colors.textPrimary },
  planRevenue: { ...typography.labelMd, color: colors.textPrimary },
  planTrack: {
    height: 6, backgroundColor: colors.neutral100, borderRadius: 3, overflow: 'hidden',
  },
  planFill: { height: '100%', borderRadius: 3 },
  planSub: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xxs },

  // Company rows
  coRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  coRank: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primaryLighter, alignItems: 'center', justifyContent: 'center',
  },
  coRankText: { ...typography.overline, color: colors.primary },
  coAvatar: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.primaryLighter, alignItems: 'center', justifyContent: 'center',
  },
  coAvatarText: { ...typography.labelMd, color: colors.primary },
  coMeta: { flex: 1 },
  coName: { ...typography.labelMd, color: colors.textPrimary },
  coPlan: { ...typography.overline, color: colors.textSecondary, marginTop: 1 },
  coRight: { alignItems: 'flex-end', gap: spacing.xxs },
  coRevenue: { ...typography.bodySm, color: colors.textPrimary },

  // Forecast
});

export default RevenueAnalyticsScreen;
