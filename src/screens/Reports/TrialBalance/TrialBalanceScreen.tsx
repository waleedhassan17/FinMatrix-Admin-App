import React, { useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { fetchTrialBalanceReport, selectTrialBalanceState, setTrialBalanceRange, refreshTrialBalanceRange } from './trialBalanceSlice';
import { formatCurrency } from '../../../utils/formatters';
import type { ReportsStackParamList } from '../../../navigators/stacks/ReportsStack';

// Design-system tokens (see src/theme/theme.ts).
const { typography } = THEME;
import {
  ReportContainer,
  ReportHeader,
  Card,
  SectionCard,
  KpiGrid,
  DateField,
  Badge,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
  ACCENT,
  reportContentStyle, amountColWidth,
  ReportTitleBlock,
  useStatementCompany,
  rangeLabel
} from '../../../components/reports/ReportUI';

type ReportsNav = NativeStackNavigationProp<ReportsStackParamList>;

const rs = (n: number) => formatCurrency(n, 'Rs ');

const TrialBalanceScreen: React.FC = () => {
  const navigation = useNavigation<ReportsNav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectTrialBalanceState);
  const company = useStatementCompany();

  // Bring the window up to today every time the screen is opened.
  //
  // The default is seeded in the slice's initialState, which is evaluated once
  // at bundle startup — so on a device left running for days it silently keeps
  // asking for a window that ended when the app launched, and the report looks
  // like the books stopped. The reducer leaves a range the user chose alone.
  useFocusEffect(
    useCallback(() => {
      dispatch(refreshTrialBalanceRange());
    }, [dispatch]),
  );

  useEffect(() => {
    dispatch(fetchTrialBalanceReport(state.range));
  }, [dispatch, state.range.startDate, state.range.endDate]);

  const report = state.report;

  // Ledger rule: complete amounts at full size — columns sized to the data,
  // table pans horizontally on narrow screens instead of shrinking figures.
  const valW = useMemo(() => {
    if (!report) return 96;
    const formatted = report.rows
      .flatMap(r => [r.debit ? rs(r.debit) : '', r.credit ? rs(r.credit) : ''])
      .concat([rs(report.totalDebits), rs(report.totalCredits)]);
    return amountColWidth(formatted);
  }, [report]);

  return (
    <ReportContainer>
      <ReportHeader title="Trial Balance" subtitle="Debits = Credits" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={reportContentStyle} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.filterRow}>
            <DateField
              label="From"
              value={state.range.startDate}
              onChangeText={text => dispatch(setTrialBalanceRange({ ...state.range, startDate: text }))}
            />
            <DateField
              label="To"
              value={state.range.endDate}
              onChangeText={text => dispatch(setTrialBalanceRange({ ...state.range, endDate: text }))}
            />
          </View>
        </Card>

        {state.isLoading && <LoadingBlock label="Calculating trial balance…" />}
        {!!state.error && <ErrorBlock message={state.error} onRetry={() => dispatch(fetchTrialBalanceReport(state.range))} />}

        {report && !state.isLoading && (
          <>
            <ReportTitleBlock
              company={company}
              report="Trial Balance"
              periodLabel={rangeLabel(state.range.startDate, state.range.endDate)}
            />

            <KpiGrid
              items={[
                { label: 'Total Debits', value: rs(report.totalDebits), accent: ACCENT.blue, icon: 'arrow-down-circle' },
                { label: 'Total Credits', value: rs(report.totalCredits), accent: ACCENT.violet, icon: 'arrow-up-circle' },
              ]}
            />

            <View style={styles.statusRow}>
              <Badge
                label={report.isBalanced ? 'In Balance' : 'Out of Balance'}
                color={report.isBalanced ? ACCENT.green : ACCENT.red}
                dot
              />
            </View>

            <SectionCard title="Accounts" icon="list">
              {report.rows.length === 0 && <EmptyBlock title="No account balances for this period." />}
              {report.rows.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tableScroll}>
                  <View style={styles.table}>
                    <View style={styles.headRow}>
                      <Text style={[styles.colAcct, styles.headText]}>Account</Text>
                      <Text style={[{ width: valW }, styles.colVal, styles.headText]}>Debit</Text>
                      <Text style={[{ width: valW }, styles.colVal, styles.headText]}>Credit</Text>
                    </View>
                    {report.rows.map(row => (
                      <View key={row.accountCode} style={styles.bodyRow}>
                        <View style={styles.colAcct}>
                          <Text style={styles.acctName}>{row.accountName}</Text>
                          <Text style={styles.acctCode}>{row.accountCode}</Text>
                        </View>
                        <Text style={[{ width: valW }, styles.colVal, styles.bodyText]}>{row.debit ? rs(row.debit) : '—'}</Text>
                        <Text style={[{ width: valW }, styles.colVal, styles.bodyText]}>{row.credit ? rs(row.credit) : '—'}</Text>
                      </View>
                    ))}
                    <View style={styles.totalRow}>
                      <Text style={[styles.colAcct, styles.totalText]}>Total</Text>
                      <Text style={[{ width: valW }, styles.colVal, styles.totalText]}>{rs(report.totalDebits)}</Text>
                      <Text style={[{ width: valW }, styles.colVal, styles.totalText]}>{rs(report.totalCredits)}</Text>
                    </View>
                  </View>
                </ScrollView>
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
  statusRow: { alignItems: 'flex-start', marginTop: THEME.spacing.sm, marginBottom: THEME.spacing.xs },
  headRow: {
    gap: 10,
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.colors.border,
  },
  headText: { ...THEME.typography.labelMd, color: THEME.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  bodyRow: {
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: THEME.colors.borderLight,
  },
  bodyText: { ...THEME.typography.bodySm, color: THEME.colors.textPrimary },
  acctName: { ...THEME.typography.bodySm, color: THEME.colors.textPrimary, fontWeight: typography.labelLg.fontWeight },
  acctCode: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  colAcct: { flex: 1, minWidth: 150 },
  colVal: { textAlign: 'right', flexShrink: 0 },
  tableScroll: { minWidth: '100%' },
  table: { flex: 1, minWidth: '100%' },
  totalRow: {
    gap: 10,
    flexDirection: 'row',
    paddingVertical: 11,
    marginTop: 2,
    borderTopWidth: 2,
    borderTopColor: THEME.colors.border,
  },
  totalText: { ...THEME.typography.bodyMd, color: THEME.colors.textPrimary, fontWeight: typography.labelLg.fontWeight }
});

export default TrialBalanceScreen;
