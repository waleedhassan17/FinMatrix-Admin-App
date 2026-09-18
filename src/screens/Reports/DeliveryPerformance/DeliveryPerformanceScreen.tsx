import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { BarChart } from 'react-native-chart-kit';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  fetchDeliveryPerformance,
  setDeliveryPerformanceRange, refreshDeliveryPerformanceRange,
  selectDeliveryPerformanceState
} from './deliveryPerformanceSlice';
import { getLastNDaysRange } from '../../../models/reportModel';
import type { DeliveryPerformanceRow } from '../../../models/deliveryPerformanceModel';

// Design-system tokens (see src/theme/theme.ts).
const { typography } = THEME;
import {
  ReportContainer,
  ReportHeader,
  Card,
  SectionCard,
  Segmented,
  Badge,
  ProgressBar,
  TCell,
  tableStyles,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
  ACCENT,
  reportContentStyle
} from '../../../components/reports/ReportUI';

const CHART_WIDTH = Dimensions.get('window').width - THEME.spacing.md * 4;

const PERIOD_OPTIONS = [
  { label: '7 Days', days: 7 },
  { label: '14 Days', days: 14 },
  { label: '30 Days', days: 30 },
];

const Metric: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }) => (
  <View style={styles.metricItem}>
    <Text style={[styles.metricValue, { color }]}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const PersonCard: React.FC<{ row: DeliveryPerformanceRow }> = ({ row }) => {
  const deliveredPct = row.total > 0 ? Math.round((row.delivered / row.total) * 100) : 0;
  const onTimeColor = row.onTimeRate >= 90 ? THEME.colors.success : THEME.colors.warning;

  return (
    <Card style={styles.personCard}>
      <View style={styles.personHeader}>
        <Text style={styles.personName}>{row.name}</Text>
        <Badge label={`${row.onTimeRate}% on-time`} color={onTimeColor} dot={false} />
      </View>
      <View style={styles.metricsRow}>
        <Metric label="Total" value={row.total} color={THEME.colors.primary} />
        <Metric label="Delivered" value={row.delivered} color={ACCENT.green} />
        <Metric label="Failed" value={row.failed} color={ACCENT.red} />
        <Metric label="Rate" value={row.total > 0 ? `${deliveredPct}%` : '—'} color={ACCENT.violet} />
      </View>
      <ProgressBar pct={deliveredPct} color={THEME.colors.success} />
    </Card>
  );
};

const DeliveryPerformanceScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { report, range, isLoading, error } = useAppSelector(selectDeliveryPerformanceState);
  const [activePeriod, setActivePeriod] = useState(1);

  // Bring the window up to today every time the screen is opened.
  //
  // The default is seeded in the slice's initialState, which is evaluated once
  // at bundle startup — so on a device left running for days it silently keeps
  // asking for a window that ended when the app launched, and the report looks
  // like the books stopped. The reducer leaves a range the user chose alone.
  useFocusEffect(
    useCallback(() => {
      dispatch(refreshDeliveryPerformanceRange());
    }, [dispatch]),
  );

  useEffect(() => {
    dispatch(fetchDeliveryPerformance(range));
  }, [dispatch, range]);

  const handlePeriodChange = (idx: number) => {
    setActivePeriod(idx);
    dispatch(setDeliveryPerformanceRange(getLastNDaysRange(PERIOD_OPTIONS[idx].days)));
  };

  const barData = useMemo(() => {
    const trend = report?.dailyTrend ?? [];
    if (trend.length === 0) return null;
    return {
      labels: trend.map(p => p.label),
      datasets: [{ data: trend.map(p => p.delivered + p.failed) }]
    };
  }, [report?.dailyTrend]);

  return (
    <ReportContainer>
      <ReportHeader title="Delivery Performance" subtitle="Rider productivity" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={reportContentStyle} showsVerticalScrollIndicator={false}>
        <Segmented options={PERIOD_OPTIONS.map(o => o.label)} activeIndex={activePeriod} onChange={handlePeriodChange} />

        {isLoading && <LoadingBlock label="Loading performance…" />}
        {!!error && <ErrorBlock message={error} onRetry={() => dispatch(fetchDeliveryPerformance(range))} />}

        {report && !isLoading && (
          <>
            <Text style={styles.sectionTitle}>Personnel Breakdown</Text>
            {!report.rows || report.rows.length === 0 ? (
              <Card>
                <EmptyBlock icon="users" title="No assignments" hint="No deliveries in this period." />
              </Card>
            ) : (
              report.rows.map(row => <PersonCard key={row.personId} row={row} />)
            )}

            {barData && barData.labels.length > 0 && (
              <SectionCard title="Daily Activity" icon="bar-chart-2">
                <BarChart
                  data={barData}
                  width={CHART_WIDTH}
                  height={200}
                  yAxisLabel=""
                  yAxisSuffix=""
                  chartConfig={{
                    backgroundGradientFrom: THEME.colors.surface,
                    backgroundGradientTo: THEME.colors.surface,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(5,150,105,${opacity})`,
                    labelColor: () => THEME.colors.textSecondary,
                    barPercentage: 0.6
                  }}
                  style={{ borderRadius: THEME.radius.sm, marginLeft: -THEME.spacing.sm }}
                  showValuesOnTopOfBars
                  fromZero
                />
                <View style={tableStyles.head}>
                  <TCell flex={1} head>Date</TCell>
                  <TCell flex={1} head align="center">Delivered</TCell>
                  <TCell flex={1} head align="center">Failed</TCell>
                  <TCell flex={1} head align="center">Total</TCell>
                </View>
                {(report.dailyTrend ?? []).map((pt, i) => (
                  <View key={pt.label} style={[tableStyles.row, i % 2 === 1 && tableStyles.rowAlt]}>
                    <TCell flex={1}>{pt.label}</TCell>
                    <TCell flex={1} align="center" color={THEME.colors.success}>{String(pt.delivered)}</TCell>
                    <TCell flex={1} align="center" color={pt.failed > 0 ? THEME.colors.danger : THEME.colors.textSecondary}>
                      {String(pt.failed)}
                    </TCell>
                    <TCell flex={1} align="center" strong>{String(pt.delivered + pt.failed)}</TCell>
                  </View>
                ))}
              </SectionCard>
            )}
          </>
        )}
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { ...THEME.typography.h4, color: THEME.colors.textPrimary, marginTop: 2, marginBottom: 2 },
  personCard: { padding: THEME.spacing.md, gap: THEME.spacing.sm },
  personHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  personName: { ...THEME.typography.h5, color: THEME.colors.textPrimary },
  metricsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  metricItem: { alignItems: 'center' },
  metricValue: { ...THEME.typography.h4, fontWeight: typography.labelLg.fontWeight },
  metricLabel: { ...THEME.typography.caption, color: THEME.colors.textSecondary, marginTop: 2 }
});

export default DeliveryPerformanceScreen;
