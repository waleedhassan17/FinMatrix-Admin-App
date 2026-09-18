import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  fetchProfitLossReport,
  selectProfitLossState,
  setProfitLossComparisonEnabled,
  setProfitLossRange, refreshProfitLossRange
} from './profitLossSlice';
import { formatCurrency } from '../../../utils/formatters';
import type { ProfitLossReport } from '../../../models/profitLossModel';
import type { ReportsStackParamList } from '../../../navigators/stacks/ReportsStack';
import {
  ReportContainer,
  ReportHeader,
  Card,
  SectionCard,
  KpiGrid,
  DateField,
  LoadingBlock,
  ErrorBlock,
  ACCENT,
  reportContentStyle,
  ReportTitleBlock,
  StatementRow,
  useStatementCompany,
  rangeLabel,
  reconcile
} from '../../../components/reports/ReportUI';

type ReportsNav = NativeStackNavigationProp<ReportsStackParamList>;

const rs = (n: number) => formatCurrency(n, 'Rs ');

/**
 * Per-account detail and the operating / non-operating split. The API returns
 * these alongside the five scalars the screen has always used, and the
 * serializer passes the whole object through untouched — but a deployment that
 * predates them returns only the scalars, so every field is optional and the
 * statement falls back to group rows when they are absent.
 *
 * Declared here rather than in profitLossModel so this presentation refactor
 * changes no shared type.
 */
type PnlLine = { accountCode: string; accountName: string; amount: number };
type PnlDetail = {
  income?: PnlLine[];
  cogsLines?: PnlLine[];
  expenseLines?: PnlLine[];
  otherIncome?: PnlLine[];
  otherExpense?: PnlLine[];
  totalIncome?: number;
  totalCogs?: number;
  totalExpenses?: number;
  netOperatingIncome?: number;
  netOtherIncome?: number;
};

const lines = (v: PnlLine[] | undefined): PnlLine[] => (Array.isArray(v) ? v : []);
const sum = (v: PnlLine[]): number => v.reduce((t, l) => t + (l.amount || 0), 0);

const ProfitLossScreen: React.FC = () => {
  const navigation = useNavigation<ReportsNav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectProfitLossState);
  const company = useStatementCompany();

  // Bring the window up to today every time the screen is opened.
  //
  // The default is seeded in the slice's initialState, which is evaluated once
  // at bundle startup — so on a device left running for days it silently keeps
  // asking for a window that ended when the app launched, and the report looks
  // like the books stopped. The reducer leaves a range the user chose alone.
  useFocusEffect(
    useCallback(() => {
      dispatch(refreshProfitLossRange());
    }, [dispatch]),
  );

  useEffect(() => {
    dispatch(fetchProfitLossReport({ range: state.range, comparisonEnabled: state.comparisonEnabled }));
  }, [dispatch, state.range.startDate, state.range.endDate, state.comparisonEnabled]);

  const report = state.report as (ProfitLossReport & PnlDetail) | null;
  const netPositive = (report?.netIncome ?? 0) >= 0;
  const showPrior = state.comparisonEnabled;

  // Detail is present only once the backend that returns it is deployed.
  const income = lines(report?.income);
  const cogsLines = lines(report?.cogsLines);
  const expenseLines = lines(report?.expenseLines);
  const otherIncome = lines(report?.otherIncome);
  const otherExpense = lines(report?.otherExpense);
  const hasDetail = income.length + cogsLines.length + expenseLines.length > 0;

  return (
    <ReportContainer>
      <ReportHeader
        title="Profit & Loss"
        subtitle="Income statement"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={reportContentStyle} showsVerticalScrollIndicator={false}>
        {/* Filter */}
        <Card>
          <View style={styles.filterRow}>
            <DateField
              label="From"
              value={state.range.startDate}
              onChangeText={text => dispatch(setProfitLossRange({ ...state.range, startDate: text }))}
            />
            <DateField
              label="To"
              value={state.range.endDate}
              onChangeText={text => dispatch(setProfitLossRange({ ...state.range, endDate: text }))}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Compare with prior period</Text>
            <Switch
              value={state.comparisonEnabled}
              onValueChange={value => {
                dispatch(setProfitLossComparisonEnabled(value));
              }}
              trackColor={{ false: THEME.colors.neutral200, true: THEME.colors.primary + '66' }}
              thumbColor={state.comparisonEnabled ? THEME.colors.primary : THEME.colors.neutral50}
            />
          </View>
        </Card>

        {state.isLoading && <LoadingBlock label="Calculating profit & loss…" />}
        {!!state.error && (
          <ErrorBlock
            message={state.error}
            onRetry={() =>
              dispatch(fetchProfitLossReport({ range: state.range, comparisonEnabled: state.comparisonEnabled }))
            }
          />
        )}

        {report && !state.isLoading && (
          <>
            {/* Headline KPIs */}
            <KpiGrid
              items={[
                { label: 'Revenue', value: rs(report.revenue), accent: ACCENT.brand, icon: 'trending-up' },
                { label: 'Gross Profit', value: rs(report.grossProfit), accent: ACCENT.blue, icon: 'bar-chart-2' },
                { label: 'Expenses', value: rs(report.expenses), accent: ACCENT.amber, icon: 'arrow-down-circle' },
                {
                  label: 'Net Income',
                  value: rs(report.netIncome),
                  accent: netPositive ? ACCENT.green : ACCENT.red,
                  icon: 'dollar-sign',
                },
              ]}
            />

            <ReportTitleBlock
              company={company}
              report="Profit and Loss"
              periodLabel={rangeLabel(state.range.startDate, state.range.endDate)}
            />

            {/*
              Every subtotal below is a scalar the API returned — nothing is
              subtracted or re-summed on the client. `reconcile` compares the
              rendered lines against the server figure and warns a developer in
              dev if they disagree; the server figure is what gets shown.
            */}
            <SectionCard
              title="Statement"
              subtitle={showPrior ? 'Current vs prior period' : undefined}
              icon="file-text"
            >
              {showPrior && (
                <View style={styles.headRow}>
                  <Text style={[styles.colMetric, styles.headText]} />
                  <Text style={[styles.colHead, styles.headText]}>Current</Text>
                  <Text style={[styles.colHead, styles.headText]}>Prior</Text>
                </View>
              )}

              <StatementRow label="Income" bold />
              {hasDetail ? (
                income.map(l => (
                  <StatementRow key={l.accountCode} label={`${l.accountCode}  ${l.accountName}`} amount={l.amount} depth={1} />
                ))
              ) : (
                <StatementRow label="Sales Revenue" amount={report.revenue} depth={1} />
              )}
              <StatementRow
                label="Total Income"
                amount={
                  hasDetail && report.totalIncome !== undefined
                    ? reconcile(sum(income), report.totalIncome, 'P&L — income')
                    : report.revenue
                }
                prior={report.comparison?.revenue}
                showPrior={showPrior}
                bold
                isTotal
              />

              <StatementRow label="Cost of Goods Sold" bold />
              {cogsLines.length > 0 ? (
                cogsLines.map(l => (
                  <StatementRow key={l.accountCode} label={`${l.accountCode}  ${l.accountName}`} amount={l.amount} depth={1} />
                ))
              ) : (
                <StatementRow label="Cost of Goods Sold" amount={report.cogs} depth={1} />
              )}
              <StatementRow
                label="Total Cost of Goods Sold"
                amount={
                  cogsLines.length > 0 && report.totalCogs !== undefined
                    ? reconcile(sum(cogsLines), report.totalCogs, 'P&L — COGS')
                    : report.cogs
                }
                prior={report.comparison?.cogs}
                showPrior={showPrior}
                bold
                isTotal
              />

              <StatementRow
                label="Gross Profit"
                amount={report.grossProfit}
                prior={report.comparison?.grossProfit}
                showPrior={showPrior}
                bold
                isTotal
              />

              <StatementRow label="Expenses" bold />
              {expenseLines.length > 0 ? (
                expenseLines.map(l => (
                  <StatementRow key={l.accountCode} label={`${l.accountCode}  ${l.accountName}`} amount={l.amount} depth={1} />
                ))
              ) : (
                <StatementRow label="Operating Expenses" amount={report.expenses} depth={1} />
              )}
              <StatementRow
                label="Total Expenses"
                amount={
                  expenseLines.length > 0 && report.totalExpenses !== undefined
                    ? reconcile(sum(expenseLines), report.totalExpenses, 'P&L — expenses')
                    : report.expenses
                }
                prior={report.comparison?.expenses}
                showPrior={showPrior}
                bold
                isTotal
              />

              {/*
                Only rendered when the server supplies the figure. Without the
                operating split, "Net Operating Income" would equal Net Income
                exactly, and deriving it here would mean doing arithmetic the
                server has not sanctioned.
              */}
              {report.netOperatingIncome !== undefined && (
                <StatementRow label="Net Operating Income" amount={report.netOperatingIncome} bold isTotal />
              )}

              {otherIncome.length > 0 && (
                <>
                  <StatementRow label="Other Income" bold />
                  {otherIncome.map(l => (
                    <StatementRow key={l.accountCode} label={`${l.accountCode}  ${l.accountName}`} amount={l.amount} depth={1} />
                  ))}
                </>
              )}
              {otherExpense.length > 0 && (
                <>
                  <StatementRow label="Other Expenses" bold />
                  {otherExpense.map(l => (
                    <StatementRow key={l.accountCode} label={`${l.accountCode}  ${l.accountName}`} amount={l.amount} depth={1} />
                  ))}
                </>
              )}
              {otherIncome.length + otherExpense.length > 0 && report.netOtherIncome !== undefined && (
                <StatementRow label="Net Other Income" amount={report.netOtherIncome} bold isTotal />
              )}

              <StatementRow
                label="Net Income"
                amount={report.netIncome}
                prior={report.comparison?.netIncome}
                showPrior={showPrior}
                isGrand
              />

              {!hasDetail && (
                <Text style={styles.caption}>
                  Shown at group level. Per-account detail appears once the reporting service is updated.
                </Text>
              )}
            </SectionCard>
          </>
        )}
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: THEME.spacing.sm },
  switchRow: {
    marginTop: THEME.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: { ...THEME.typography.bodyMd, color: THEME.colors.textPrimary },

  headRow: {
    gap: THEME.spacing.sm,
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.border,
  },
  headText: { ...THEME.typography.labelMd, color: THEME.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  colMetric: { flex: 1 },
  // Matches the amount gutter StatementRow reserves, so the headings line up.
  colHead: { width: 118, textAlign: 'right' },
  caption: {
    ...THEME.typography.labelSm,
    color: THEME.colors.textTertiary,
    marginTop: THEME.spacing.sm,
    fontStyle: 'italic',
  }
});

export default ProfitLossScreen;
