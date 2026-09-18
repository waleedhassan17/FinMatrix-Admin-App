import dayjs from 'dayjs';
import React, { useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { PieChart } from 'react-native-chart-kit';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  fetchDeliveryDailyReport,
  setDeliveryDailyDate, refreshDeliveryDailyDate,
  selectDeliveryDailyReportState
} from './deliveryDailyReportSlice';
import type { DeliveryPersonnelStat } from '../../../models/deliveryDailyReportModel';
import {
  ReportContainer,
  ReportHeader,
  Card,
  SectionCard,
  KpiGrid,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
  TCell,
  tableStyles,
  ACCENT,
  CHART_SERIES,
  reportContentStyle
} from '../../../components/reports/ReportUI';

const CHART_WIDTH = Dimensions.get('window').width - THEME.spacing.md * 4;

// The day-back / day-forward arrows. `new Date('YYYY-MM-DD')` parses as UTC
// midnight while setDate/getDate work in local time, so formatting the result
// with toISOString() shifted the answer a day in PKT (UTC+5) — the arrows
// skipped or repeated a day. dayjs stays in local time throughout.
const shiftDate = (dateStr: string, days: number): string =>
  dayjs(dateStr).add(days, 'day').format('YYYY-MM-DD');

const formatDateLabel = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const PersonRow: React.FC<{ stat: DeliveryPersonnelStat; alt: boolean }> = ({ stat, alt }) => (
  <View style={[tableStyles.row, alt && tableStyles.rowAlt]}>
    <TCell flex={2}>{stat.name}</TCell>
    <TCell flex={1} align="center">{String(stat.total)}</TCell>
    <TCell flex={1} align="center" color={THEME.colors.success}>{String(stat.delivered)}</TCell>
    <TCell flex={1} align="center" color={stat.failed > 0 ? THEME.colors.danger : THEME.colors.textSecondary}>
      {String(stat.failed)}
    </TCell>
    <TCell flex={1} align="center">{stat.onTimeRate}%</TCell>
  </View>
);

const DeliveryDailyReportScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const { report, date, isLoading, error } = useAppSelector(selectDeliveryDailyReportState);

  // Bring the window up to today every time the screen is opened.
  //
  // The default is seeded in the slice's initialState, which is evaluated once
  // at bundle startup — so on a device left running for days it silently keeps
  // asking for a window that ended when the app launched, and the report looks
  // like the books stopped. The reducer leaves a range the user chose alone.
  useFocusEffect(
    useCallback(() => {
      dispatch(refreshDeliveryDailyDate());
    }, [dispatch]),
  );

  useEffect(() => {
    dispatch(fetchDeliveryDailyReport(date));
  }, [dispatch, date]);

  const pieData = useMemo(
    () =>
      (report?.agencyDistribution ?? []).map((item, idx) => ({
        name: item.agencyName.split(' ').slice(0, 2).join(' '),
        population: item.count,
        color: CHART_SERIES[idx % CHART_SERIES.length],
        legendFontColor: THEME.colors.textSecondary,
        legendFontSize: 11
      })),
    [report?.agencyDistribution],
  );

  return (
    <ReportContainer>
      <ReportHeader title="Daily Delivery" subtitle="Operations summary" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={reportContentStyle} showsVerticalScrollIndicator={false}>
        {/* Date stepper */}
        <Card padded={false}>
          <View style={styles.dateStepper}>
            <TouchableOpacity
              onPress={() => dispatch(setDeliveryDailyDate(shiftDate(date, -1)))}
              style={styles.dateArrow}
              activeOpacity={0.7}
            >
              <Feather name="chevron-left" size={20} color={THEME.colors.primary} />
            </TouchableOpacity>
            <Text style={styles.dateText}>{formatDateLabel(date)}</Text>
            <TouchableOpacity
              onPress={() => dispatch(setDeliveryDailyDate(shiftDate(date, 1)))}
              style={styles.dateArrow}
              activeOpacity={0.7}
            >
              <Feather name="chevron-right" size={20} color={THEME.colors.primary} />
            </TouchableOpacity>
          </View>
        </Card>

        {isLoading && <LoadingBlock label="Loading deliveries…" />}
        {!!error && <ErrorBlock message={error} onRetry={() => dispatch(fetchDeliveryDailyReport(date))} />}

        {report && !isLoading && (
          <>
            <KpiGrid
              items={[
                { label: 'Total', value: String(report.total), accent: ACCENT.blue, icon: 'package' },
                { label: 'Completed', value: String(report.completed), accent: ACCENT.green, icon: 'check-circle' },
                { label: 'Failed', value: String(report.failed), accent: ACCENT.red, icon: 'x-circle' },
                { label: 'On-Time', value: `${report.onTimePercent}%`, accent: ACCENT.amber, icon: 'clock' },
              ]}
            />

            <SectionCard title="Personnel Performance" icon="users">
              <View style={tableStyles.head}>
                <TCell flex={2} head>Name</TCell>
                <TCell flex={1} head align="center">Total</TCell>
                <TCell flex={1} head align="center">Done</TCell>
                <TCell flex={1} head align="center">Failed</TCell>
                <TCell flex={1} head align="center">On-Time</TCell>
              </View>
              {!report.personnelStats || report.personnelStats.length === 0 ? (
                <Text style={styles.empty}>No personnel assigned for this date</Text>
              ) : (
                report.personnelStats.map((p, idx) => <PersonRow key={p.personId} stat={p} alt={idx % 2 === 1} />)
              )}
            </SectionCard>

            {(report.agencyDistribution?.length ?? 0) > 0 && (
              <SectionCard title="Agency Distribution" icon="pie-chart">
                <PieChart
                  data={pieData}
                  width={CHART_WIDTH}
                  height={200}
                  chartConfig={{
                    color: (opacity = 1) => `rgba(5,150,105,${opacity})`,
                    labelColor: () => THEME.colors.textSecondary
                  }}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="10"
                  absolute
                />
              </SectionCard>
            )}

            {report.total === 0 && (
              <Card>
                <EmptyBlock icon="truck" title="No deliveries scheduled" hint="Nothing planned for this date." />
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  dateStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.sm,
    paddingVertical: 6,
  },
  dateArrow: {
    width: 36,
    height: 36,
    borderRadius: THEME.radius.md,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: { flex: 1, textAlign: 'center', ...THEME.typography.labelLg, color: THEME.colors.textPrimary },
  empty: { ...THEME.typography.bodySm, color: THEME.colors.textTertiary, textAlign: 'center', paddingVertical: 14 }
});

export default DeliveryDailyReportScreen;
