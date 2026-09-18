import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { fetchCashFlowReport, selectCashFlowState, setCashFlowRange, refreshCashFlowRange } from './cashFlowSlice';
import { formatCurrency } from '../../../utils/formatters';
import type { CashFlowSection } from '../../../models/cashFlowModel';
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
  rangeLabel
} from '../../../components/reports/ReportUI';

type ReportsNav = NativeStackNavigationProp<ReportsStackParamList>;

const rs = (n: number) => formatCurrency(n, 'Rs ');

/**
 * One activities section, in the order the statement presents it. The line
 * items are ledger-derived and rendered exactly as the API returned them —
 * label and amount both — and the subtotal is `section.total`, never a re-sum.
 */
const Section: React.FC<{ activity: string; section: CashFlowSection }> = ({ activity, section }) => (
  <SectionCard title={`Cash Flows from ${activity} Activities`} icon="activity">
    {section.lines.length === 0 && <Text style={styles.noneText}>No activity in this period.</Text>}
    {section.lines.map((l, i) => (
      <StatementRow key={`${l.label}-${i}`} label={l.label} amount={l.amount} depth={1} />
    ))}
    <StatementRow
      label={`Net cash provided by ${activity.toLowerCase()} activities`}
      amount={section.total}
      bold
      isTotal
    />
  </SectionCard>
);

const CashFlowScreen: React.FC = () => {
  const navigation = useNavigation<ReportsNav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectCashFlowState);
  const company = useStatementCompany();

  // Bring the window up to today every time the screen is opened.
  //
  // The default is seeded in the slice's initialState, which is evaluated once
  // at bundle startup — so on a device left running for days it silently keeps
  // asking for a window that ended when the app launched, and the report looks
  // like the books stopped. The reducer leaves a range the user chose alone.
  useFocusEffect(
    useCallback(() => {
      dispatch(refreshCashFlowRange());
    }, [dispatch]),
  );

  useEffect(() => {
    dispatch(fetchCashFlowReport(state.range));
  }, [dispatch, state.range.startDate, state.range.endDate]);

  const report = state.report;
  const positive = (report?.netChange ?? 0) >= 0;

  return (
    <ReportContainer>
      <ReportHeader title="Cash Flow" subtitle="Operating · Investing · Financing" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={reportContentStyle} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.filterRow}>
            <DateField
              label="From"
              value={state.range.startDate}
              onChangeText={text => dispatch(setCashFlowRange({ ...state.range, startDate: text }))}
            />
            <DateField
              label="To"
              value={state.range.endDate}
              onChangeText={text => dispatch(setCashFlowRange({ ...state.range, endDate: text }))}
            />
          </View>
        </Card>

        {state.isLoading && <LoadingBlock label="Calculating cash flow…" />}
        {!!state.error && <ErrorBlock message={state.error} onRetry={() => dispatch(fetchCashFlowReport(state.range))} />}

        {report && !state.isLoading && (
          <>
            <KpiGrid
              items={[
                { label: 'Beginning Cash', value: rs(report.beginningCash), accent: ACCENT.teal, icon: 'circle' },
                { label: 'Net Change', value: rs(report.netChange), accent: positive ? ACCENT.green : ACCENT.red, icon: positive ? 'trending-up' : 'trending-down' },
                { label: 'Ending Cash', value: rs(report.endingCash), accent: ACCENT.blue, icon: 'dollar-sign' },
              ]}
            />

            <ReportTitleBlock
              company={company}
              report="Statement of Cash Flows"
              periodLabel={rangeLabel(state.range.startDate, state.range.endDate)}
            />

            <Section activity="Operating" section={report.operating} />
            <Section activity="Investing" section={report.investing} />
            <Section activity="Financing" section={report.financing} />

            <SectionCard title="Cash at End of Period" icon="repeat">
              <StatementRow label="Net cash increase for period" amount={report.netChange} bold isTotal />
              <StatementRow label="Cash at beginning of period" amount={report.beginningCash} />
              <StatementRow label="Cash at end of period" amount={report.endingCash} isGrand />
            </SectionCard>
          </>
        )}
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: THEME.spacing.sm },
  noneText: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary, fontStyle: 'italic' }
});

export default CashFlowScreen;
