import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LineChart, PieChart } from 'react-native-chart-kit';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { fetchAnalyticsDashboard, selectAnalyticsDashboardState } from './analyticsDashboardSlice';
import type { ReportsStackParamList } from '../../../navigators/stacks/ReportsStack';
import { formatCurrency } from '../../../utils/formatters';

// Design-system tokens (see src/theme/theme.ts).
const { colors } = THEME;
import {
  ReportContainer,
  ReportHeader,
  SectionCard,
  KpiGrid,
  LoadingBlock,
  ErrorBlock,
  ACCENT,
  CHART_SERIES,
  reportContentStyle
} from '../../../components/reports/ReportUI';

type AnalyticsDashboardScreenProps = NativeStackScreenProps<ReportsStackParamList, 'AnalyticsDashboard'>;

const CHART_WIDTH = Dimensions.get('window').width - THEME.spacing.md * 4;

const sum = (arr: { value: number }[]) => arr.reduce((s, p) => s + p.value, 0);

// Compact PKR for KPI tiles, e.g. "Rs 1.2M" / "Rs 84.5K"
const fmtRsCompact = (amount: number): string => {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}Rs ${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}Rs ${(abs / 1_000).toFixed(1)}K`;
  return `${sign}Rs ${Math.round(abs)}`;
};

const AnalyticsDashboardScreen: React.FC<AnalyticsDashboardScreenProps> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectAnalyticsDashboardState);
  const [selection, setSelection] = useState<string>('');

  useEffect(() => {
    dispatch(fetchAnalyticsDashboard());
  }, [dispatch]);

  const data = state.data;
  const revenueTrend = Array.isArray(data?.revenueTrend) ? data.revenueTrend : [];
  const cashFlowTrend = Array.isArray(data?.cashFlowTrend) ? data.cashFlowTrend : [];
  const topCustomers = Array.isArray(data?.topCustomers) ? data.topCustomers : [];
  const arAgingTrend = Array.isArray(data?.arAgingTrend) ? data.arAgingTrend : [];
  const expenseCategories = Array.isArray(data?.expenseCategories) ? data.expenseCategories : [];
  const safeRevenueTrend = revenueTrend.filter(point => Number.isFinite(point.value));
  const safeCashFlowTrend = cashFlowTrend.filter(point => Number.isFinite(point.value));
  const safeTopCustomers = topCustomers.filter(customer => Number.isFinite(customer.value));
  const safeArAgingTrend = arAgingTrend.filter(point =>
    [point.current, point.bucket1to30, point.bucket31to60, point.bucket61to90, point.bucket90Plus].every(value =>
      Number.isFinite(value),
    ),
  );

  // ── Derived enterprise KPIs ─────────────────────────
  const kpis = useMemo(() => {
    const months = safeRevenueTrend.length;
    const totalRevenue = sum(safeRevenueTrend);
    const avgRevenue = months > 0 ? totalRevenue / months : 0;
    const lastRev = safeRevenueTrend[months - 1]?.value ?? 0;
    const prevRev = safeRevenueTrend[months - 2]?.value ?? 0;
    const revMoM = prevRev > 0 ? ((lastRev - prevRev) / prevRev) * 100 : 0;

    const totalExpenses = sum(expenseCategories.filter(e => Number.isFinite(e.value)));
    const totalCashFlow = sum(safeCashFlowTrend);
    const lastCF = safeCashFlowTrend[safeCashFlowTrend.length - 1]?.value ?? 0;
    const prevCF = safeCashFlowTrend[safeCashFlowTrend.length - 2]?.value ?? 0;
    const cfMoM = prevCF !== 0 ? ((lastCF - prevCF) / Math.abs(prevCF)) * 100 : 0;

    const latestAging = safeArAgingTrend[safeArAgingTrend.length - 1];
    const outstanding = latestAging
      ? latestAging.current +
        latestAging.bucket1to30 +
        latestAging.bucket31to60 +
        latestAging.bucket61to90 +
        latestAging.bucket90Plus
      : 0;
    const overdue = latestAging
      ? latestAging.bucket31to60 + latestAging.bucket61to90 + latestAging.bucket90Plus
      : 0;

    const topCustomer = [...safeTopCustomers].sort((a, b) => b.value - a.value)[0];

    return {
      months,
      totalRevenue,
      avgRevenue,
      revMoM,
      totalExpenses,
      totalCashFlow,
      cfMoM,
      outstanding,
      overdue,
      topCustomer,
    };
  }, [safeRevenueTrend, safeCashFlowTrend, safeTopCustomers, safeArAgingTrend, expenseCategories]);

  const pieData = useMemo(
    () =>
      expenseCategories.map((item, idx) => ({
        name: item.label,
        amount: item.value,
        color: CHART_SERIES[idx % CHART_SERIES.length],
        legendFontColor: THEME.colors.textSecondary,
        legendFontSize: 11
      })),
    [expenseCategories],
  );

  const AGING_COLORS = [ACCENT.green, ACCENT.blue, ACCENT.amber, THEME.colors.warning, ACCENT.red];
  const hasData = !!data && kpis.months > 0;

  return (
    <ReportContainer>
      <ReportHeader title="Analytics" subtitle="Business intelligence · last 6 months" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={reportContentStyle} showsVerticalScrollIndicator={false}>
        {state.isLoading && <LoadingBlock label="Crunching analytics…" />}
        {!!state.error && <ErrorBlock message={state.error} onRetry={() => dispatch(fetchAnalyticsDashboard())} />}

        {data && !state.isLoading && (
          <>
            {/* ── Revenue hero ── */}
            <LinearGradient
              colors={[THEME.colors.actionGreenDark, THEME.colors.actionGreen]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroDecor1} />
              <View style={styles.heroDecor2} />
              <View style={styles.heroRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroLabel}>Total Revenue · {kpis.months} mo</Text>
                  <Text style={styles.heroValue}>{formatCurrency(kpis.totalRevenue, 'Rs ')}</Text>
                  <View style={styles.heroDeltaRow}>
                    <View style={styles.heroDeltaPill}>
                      <Feather
                        name={kpis.revMoM >= 0 ? 'trending-up' : 'trending-down'}
                        size={12}
                        color={colors.neutral0}
                      />
                      <Text style={styles.heroDeltaText}>
                        {kpis.revMoM >= 0 ? '+' : ''}{kpis.revMoM.toFixed(1)}%
                      </Text>
                    </View>
                    <Text style={styles.heroDeltaCaption}>vs last month</Text>
                  </View>
                </View>
                <View style={styles.heroAside}>
                  <Text style={styles.heroAsideLabel}>Avg / mo</Text>
                  <Text style={styles.heroAsideValue}>{fmtRsCompact(kpis.avgRevenue)}</Text>
                </View>
              </View>
            </LinearGradient>

            {/* ── KPI grid ── */}
            <KpiGrid
              items={[
                {
                  label: 'Net Cash Flow',
                  value: fmtRsCompact(kpis.totalCashFlow),
                  accent: ACCENT.blue,
                  icon: 'activity',
                  delta: { text: `${kpis.cfMoM >= 0 ? '+' : ''}${kpis.cfMoM.toFixed(0)}%`, positive: kpis.cfMoM >= 0 },
                },
                {
                  label: 'Total Expenses',
                  value: fmtRsCompact(kpis.totalExpenses),
                  accent: ACCENT.amber,
                  icon: 'arrow-down-circle'
                },
                {
                  label: 'Outstanding A/R',
                  value: fmtRsCompact(kpis.outstanding),
                  accent: kpis.overdue > 0 ? ACCENT.red : ACCENT.teal,
                  icon: 'inbox',
                  delta: kpis.overdue > 0 ? { text: `${fmtRsCompact(kpis.overdue)} overdue`, positive: false } : undefined,
                },
                {
                  label: kpis.topCustomer ? `Top: ${kpis.topCustomer.label}` : 'Top Customer',
                  value: kpis.topCustomer ? fmtRsCompact(kpis.topCustomer.value) : '—',
                  accent: ACCENT.violet,
                  icon: 'award'
                },
              ]}
            />

            {/* ── Charts ── */}
            <SectionCard
              title="Revenue Trend"
              subtitle={`Total ${fmtRsCompact(kpis.totalRevenue)} · avg ${fmtRsCompact(kpis.avgRevenue)}/mo`}
              icon="trending-up"
            >
              {safeRevenueTrend.length > 0 ? (
                <>
                  <View style={styles.axisHint}>
                    <Text style={styles.axisHintText}>Amounts in Rs</Text>
                  </View>
                  <TrendLineChart
                    labels={safeRevenueTrend.map(point => point.label)}
                    values={safeRevenueTrend.map(point => point.value)}
                    color={ACCENT.blue}
                    fill={ACCENT.blue}
                    fromZero
                    onPointPress={(index, value) =>
                      setSelection(`Revenue ${safeRevenueTrend[index]?.label ?? ''}: ${formatCurrency(value, 'Rs ')}`)
                    }
                  />
                  {!!selection && (
                    <View style={styles.tooltip}>
                      <Feather name="info" size={12} color={THEME.colors.primary} />
                      <Text style={styles.tooltipText}>{selection}</Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={styles.empty}>No revenue data available.</Text>
              )}
            </SectionCard>

            <SectionCard
              title="Cash Flow"
              subtitle={`Net ${fmtRsCompact(kpis.totalCashFlow)} · ${kpis.cfMoM >= 0 ? '▲' : '▼'} ${Math.abs(kpis.cfMoM).toFixed(0)}% MoM`}
              icon="activity"
            >
              {safeCashFlowTrend.length > 0 ? (
                <>
                  <View style={styles.axisHint}>
                    <Text style={styles.axisHintText}>Amounts in Rs</Text>
                  </View>
                  <TrendLineChart
                    labels={safeCashFlowTrend.map(point => point.label)}
                    values={safeCashFlowTrend.map(point => point.value)}
                    color={THEME.colors.primary}
                    fill={THEME.colors.primary}
                  />
                </>
              ) : (
                <Text style={styles.empty}>No cash flow data available.</Text>
              )}
            </SectionCard>

            <SectionCard title="Expense Categories" subtitle={`Total ${fmtRsCompact(kpis.totalExpenses)}`} icon="pie-chart">
              {pieData.length > 0 ? (
                <PieChart
                  data={pieData}
                  width={CHART_WIDTH}
                  height={210}
                  accessor="amount"
                  backgroundColor="transparent"
                  paddingLeft="8"
                  absolute
                  chartConfig={{ color: () => THEME.colors.textPrimary, labelColor: () => THEME.colors.textSecondary }}
                />
              ) : (
                <Text style={styles.empty}>No expense data available.</Text>
              )}
            </SectionCard>

            <SectionCard title="Top Customers" subtitle="By revenue contribution" icon="award">
              {safeTopCustomers.length > 0 ? (
                <View style={{ gap: 12 }}>
                  {[...safeTopCustomers].sort((a, b) => b.value - a.value).map((customer, idx) => {
                    const max = Math.max(...safeTopCustomers.map(item => item.value), 1);
                    const widthPct = (customer.value / max) * 100;
                    const active = selection === customer.label;
                    return (
                      <TouchableOpacity
                        key={customer.label}
                        activeOpacity={0.75}
                        onPress={() => setSelection(customer.label)}
                        style={{ gap: 6 }}
                      >
                        <View style={styles.barTop}>
                          <View style={styles.barRank}>
                            <Text style={styles.barRankText}>{idx + 1}</Text>
                          </View>
                          <Text style={styles.barLabel} numberOfLines={1}>{customer.label}</Text>
                          <Text style={styles.barValue}>{formatCurrency(customer.value, 'Rs ')}</Text>
                        </View>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { width: `${widthPct}%` }, active && styles.barFillActive]} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.empty}>No customer data available.</Text>
              )}
            </SectionCard>

            <SectionCard title="A/R Aging Trend" subtitle={`Outstanding ${fmtRsCompact(kpis.outstanding)}`} icon="bar-chart-2">
              {safeArAgingTrend.length > 0 ? (
                <>
                  <View style={styles.stackWrap}>
                    {safeArAgingTrend.map(point => {
                      const buckets = [point.current, point.bucket1to30, point.bucket31to60, point.bucket61to90, point.bucket90Plus];
                      const total = buckets.reduce((a, b) => a + b, 0);
                      const h = 130;
                      const safeTotal = Math.max(1, total);
                      return (
                        <View key={point.label} style={styles.stackCol}>
                          {[4, 3, 2, 1, 0].map(bi => (
                            <View
                              key={bi}
                              style={{ width: 22, height: (buckets[bi] / safeTotal) * h, backgroundColor: AGING_COLORS[bi] }}
                            />
                          ))}
                          <Text style={styles.stackLabel}>{point.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.legendWrap}>
                    {['Current', '1–30', '31–60', '61–90', '90+'].map((lbl, i) => (
                      <View key={lbl} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: AGING_COLORS[i] }]} />
                        <Text style={styles.legendText}>{lbl}</Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <Text style={styles.empty}>No A/R aging data available.</Text>
              )}
            </SectionCard>
          </>
        )}

        {data && !state.isLoading && !hasData && (
          <Text style={styles.empty}>No analytics data available yet.</Text>
        )}
      </ScrollView>
    </ReportContainer>
  );
};

// Compact axis labels: 1200000 -> "1.2M", 84500 -> "85k"
const compactAxis = (raw: string): string => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${Math.round(n)}`;
};

// Shared, enterprise-styled trend line chart used by Revenue & Cash Flow.
const TrendLineChart: React.FC<{
  labels: string[];
  values: number[];
  color: string;
  fill: string;
  fromZero?: boolean;
  onPointPress?: (index: number, value: number) => void;
}> = ({ labels, values, color, fill, fromZero, onPointPress }) => (
  <LineChart
    data={{ labels, datasets: [{ data: values, color: () => color, strokeWidth: 3 }] }}
    width={CHART_WIDTH}
    height={220}
    bezier
    fromZero={fromZero}
    segments={4}
    withVerticalLines={false}
    withInnerLines
    withDots
    yAxisInterval={1}
    yLabelsOffset={10}
    formatYLabel={compactAxis}
    chartConfig={{
      backgroundGradientFrom: THEME.colors.surface,
      backgroundGradientTo: THEME.colors.surface,
      decimalPlaces: 0,
      color: () => color,
      labelColor: () => THEME.colors.textTertiary,
      // Vertical gradient area under the line
      fillShadowGradientFrom: fill,
      fillShadowGradientFromOpacity: 0.28,
      fillShadowGradientTo: THEME.colors.surface,
      fillShadowGradientToOpacity: 0.02,
      propsForBackgroundLines: { stroke: THEME.colors.borderLight, strokeDasharray: '4 7', strokeWidth: 1 },
      propsForDots: { r: '4', strokeWidth: '2', stroke: color, fill: THEME.colors.surface },
      // react-native-chart-kit config, not a RN style: it takes a raw number.
      propsForLabels: { fontSize: THEME.typography.overline.fontSize }
    }}
    style={styles.chart}
    onDataPointClick={onPointPress ? ({ index, value }) => onPointPress(index, value) : undefined}
  />
);

const styles = StyleSheet.create({
  // Hero
  hero: { borderRadius: THEME.radius.xl, padding: THEME.spacing.lg, overflow: 'hidden', ...THEME.shadows.md },
  heroDecor1: {
    position: 'absolute', right: -24, top: -34, width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroDecor2: {
    position: 'absolute', left: -30, bottom: -40, width: 110, height: 110, borderRadius: 55,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroLabel: { ...THEME.typography.labelSm, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase' },
  heroValue: { ...THEME.typography.displaySm, color: colors.neutral0, marginTop: 4 },
  heroDeltaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  heroDeltaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: THEME.radius.full,
  },
  heroDeltaText: { ...THEME.typography.labelMd, color: colors.neutral0 },
  heroDeltaCaption: { ...THEME.typography.caption, color: 'rgba(255,255,255,0.8)' },
  heroAside: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: THEME.radius.lg,
    paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center',
  },
  heroAsideLabel: { ...THEME.typography.caption, color: 'rgba(255,255,255,0.75)' },
  heroAsideValue: { ...THEME.typography.h4, color: colors.neutral0, marginTop: 2 },

  // Charts
  chart: { borderRadius: THEME.radius.md, marginLeft: -THEME.spacing.sm, marginTop: 4 },
  empty: { ...THEME.typography.bodySm, color: THEME.colors.textTertiary, textAlign: 'center', paddingVertical: 16 },
  axisHint: { alignItems: 'flex-end', marginBottom: -6 },
  axisHintText: { ...THEME.typography.overline, color: THEME.colors.textTertiary },
  tooltip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: THEME.radius.full,
    backgroundColor: THEME.colors.primaryLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: THEME.colors.primary + '33',
  },
  tooltipText: { ...THEME.typography.labelMd, color: THEME.colors.primaryHover },

  // Top customers
  barTop: { flexDirection: 'row', alignItems: 'center' },
  barRank: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  barRankText: { ...THEME.typography.labelSm, color: THEME.colors.primary, letterSpacing: 0 },
  barLabel: { ...THEME.typography.bodySm, color: THEME.colors.textPrimary, flex: 1, marginRight: 8 },
  barValue: { ...THEME.typography.labelMd, color: THEME.colors.textSecondary },
  barTrack: { height: 10, borderRadius: 6, backgroundColor: THEME.colors.neutral100, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6, backgroundColor: ACCENT.blue + 'AA' },
  barFillActive: { backgroundColor: ACCENT.blue },

  // AR aging stack
  stackWrap: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 6, minHeight: 168 },
  stackCol: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  stackLabel: { marginTop: 6, ...THEME.typography.caption, color: THEME.colors.textSecondary },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 2 },
  legendText: { ...THEME.typography.caption, color: THEME.colors.textSecondary }
});

export default AnalyticsDashboardScreen;
