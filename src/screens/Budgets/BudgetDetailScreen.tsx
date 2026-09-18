import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import { Alert } from '../../utils/alert';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { fetchBudget, selectBudgetState, removeBudget } from './budgetSlice';
import { formatCurrency } from '../../utils/formatters';
import { favourableVariance, isFavourableVariance, splitBudgetTotals, varianceLabel } from '../../utils/budgetMath';
import CustomButton from '../../Custom-Components/CustomButton';
import { ReportContainer, ReportHeader, Card, SectionCard, KpiGrid, ProgressBar, LoadingBlock, ErrorBlock, ACCENT } from '../../components/reports/ReportUI';
import type { ReportsStackParamList } from '../../navigators/stacks/ReportsStack';

// Design-system tokens (see src/theme/theme.ts).
const { typography } = THEME;

type Nav = NativeStackNavigationProp<ReportsStackParamList>;
type Rt = RouteProp<Record<string, { budgetId: string }>, string>;
const rs = (n: number) => formatCurrency(n, 'Rs ');
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const BudgetDetailScreen: React.FC = () => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { budgetId } = route.params;
  const dispatch = useAppDispatch();
  const { current: b, vsActual, isLoading, error } = useAppSelector(selectBudgetState);

  useFocusEffect(useCallback(() => { dispatch(fetchBudget(budgetId)); }, [dispatch, budgetId]));

  const doDelete = () => Alert.alert('Delete budget', 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await dispatch(removeBudget(budgetId)); navigation.goBack(); } },
  ]);

  if (isLoading && !b) return <ReportContainer><ReportHeader title="Budget" onBack={() => navigation.goBack()} /><LoadingBlock label="Loading…" /></ReportContainer>;
  if (error && !b) return <ReportContainer><ReportHeader title="Budget" onBack={() => navigation.goBack()} /><ErrorBlock message={error} onRetry={() => dispatch(fetchBudget(budgetId))} /></ReportContainer>;
  if (!b) return <ReportContainer><ReportHeader title="Budget" onBack={() => navigation.goBack()} /></ReportContainer>;

  // Revenue and spending kept apart: the server's single total adds a sales
  // target to a rent budget, which is not a figure anyone can act on.
  const totals = splitBudgetTotals(vsActual?.rows ?? []);

  return (
    <ReportContainer>
      <ReportHeader title={b.name} subtitle={`FY ${b.fiscalYear}`} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {vsActual && (
          <KpiGrid items={[
            { label: 'Revenue target', value: rs(totals.revenue.budgeted), accent: ACCENT.blue, icon: 'target' },
            { label: 'Revenue actual', value: rs(totals.revenue.actual), accent: totals.revenue.actual >= totals.revenue.budgeted ? ACCENT.green : ACCENT.red, icon: 'trending-up' },
            { label: 'Spending budget', value: rs(totals.spending.budgeted), accent: ACCENT.violet, icon: 'target' },
            { label: 'Spending actual', value: rs(totals.spending.actual), accent: totals.spending.actual <= totals.spending.budgeted ? ACCENT.green : ACCENT.red, icon: 'activity' },
          ]} />
        )}

        <SectionCard title="Budget vs Actual" subtitle="By account — tap a row for the monthly breakdown" icon="bar-chart-2">
          {(vsActual?.rows ?? []).map(r => {
            const pct = r.budgeted > 0 ? Math.min(1, r.actual / r.budgeted) : 0;
            // Coloured by whether the variance is GOOD, not by whether actual
            // passed budget: revenue above target is good, spending above
            // budget is not.
            const favourable = isFavourableVariance(r);
            const open = expanded === r.accountId;
            const months = r.months ?? [];
            return (
              <TouchableOpacity
                key={r.accountId}
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => setExpanded(open ? null : r.accountId)}
              >
                <View style={styles.rowTop}>
                  <Text style={styles.acctName}>{r.accountCode} {r.accountName}</Text>
                  <Text style={styles.acctVar}>{r.percentUsed}%</Text>
                </View>
                <Text style={styles.acctMeta}>{rs(r.actual)} of {rs(r.budgeted)} · {varianceLabel(r, rs)}</Text>
                <ProgressBar pct={pct} color={favourable ? ACCENT.green : ACCENT.red} />
                {open && months.length > 0 && (
                  <View style={styles.monthTable}>
                    <View style={styles.monthHead}>
                      <Text style={[styles.monthCell, styles.monthHeadText]}>Month</Text>
                      <Text style={[styles.monthCellNum, styles.monthHeadText]}>Budget</Text>
                      <Text style={[styles.monthCellNum, styles.monthHeadText]}>Actual</Text>
                      <Text style={[styles.monthCellNum, styles.monthHeadText]}>Var</Text>
                    </View>
                    {months.map(m => {
                      // Same reading per month: positive is good for this account's type.
                      const mv = favourableVariance({ accountType: r.accountType, budgeted: m.budgeted, actual: m.actual });
                      return (
                        <View key={m.month} style={styles.monthRow}>
                          <Text style={styles.monthCell}>{MONTH_NAMES[m.month - 1]}</Text>
                          <Text style={styles.monthCellNum}>{rs(m.budgeted)}</Text>
                          <Text style={styles.monthCellNum}>{rs(m.actual)}</Text>
                          <Text style={[styles.monthCellNum, { color: mv >= 0 ? ACCENT.green : ACCENT.red }]}>{rs(mv)}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
          {!vsActual && <Text style={styles.acctMeta}>Comparison unavailable.</Text>}
        </SectionCard>

        <Card>
          {vsActual ? (
            <>
              <View style={styles.totalRow}><Text style={styles.bold}>Budgeted revenue</Text><Text style={styles.bold}>{rs(totals.revenue.budgeted)}</Text></View>
              <View style={styles.totalRow}><Text style={styles.bold}>Budgeted spending</Text><Text style={styles.bold}>{rs(totals.spending.budgeted)}</Text></View>
            </>
          ) : (
            <View style={styles.totalRow}><Text style={styles.bold}>Total Budget</Text><Text style={styles.bold}>{rs(b.totalBudget)}</Text></View>
          )}
        </Card>

        <CustomButton title="Delete Budget" variant="danger" onPress={doDelete} fullWidth />
        <View style={{ height: 24 }} />
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  row: { paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight, gap: 5 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  acctName: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary, flex: 1 },
  acctVar: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary, fontWeight: typography.labelLg.fontWeight },
  acctMeta: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  monthTable: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.border },
  monthHead: { flexDirection: 'row', paddingVertical: 5 },
  monthHeadText: { fontWeight: THEME.typography.labelMd.fontWeight, textTransform: 'uppercase' },
  monthRow: { flexDirection: 'row', paddingVertical: 3 },
  monthCell: { flex: 1, ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  monthCellNum: { flex: 1.2, textAlign: 'right', ...THEME.typography.labelSm, color: THEME.colors.textPrimary },
  bold: { ...THEME.typography.labelLg,  color: THEME.colors.textPrimary }
});

export default BudgetDetailScreen;
