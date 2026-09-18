import React, { useEffect, useCallback } from 'react';
import { View, ScrollView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { fetchARAgingReport, selectAPAgingState, setAPAgingAsOfDate, refreshAPAgingAsOfDate } from './apAgingSlice';
import { formatCurrency } from '../../../utils/formatters';
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
  EmptyBlock,
  TCell,
  tableStyles,
  ACCENT,
  reportContentStyle,
  ReportTitleBlock,
  useStatementCompany,
  asOfLabel
} from '../../../components/reports/ReportUI';

type ReportsNav = NativeStackNavigationProp<ReportsStackParamList>;

const rs = (n: number) => formatCurrency(n, 'Rs ');

const APAgingScreen: React.FC = () => {
  const navigation = useNavigation<ReportsNav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectAPAgingState);
  const company = useStatementCompany();

  // Bring the window up to today every time the screen is opened.
  //
  // The default is seeded in the slice's initialState, which is evaluated once
  // at bundle startup — so on a device left running for days it silently keeps
  // asking for a window that ended when the app launched, and the report looks
  // like the books stopped. The reducer leaves a range the user chose alone.
  useFocusEffect(
    useCallback(() => {
      dispatch(refreshAPAgingAsOfDate());
    }, [dispatch]),
  );

  useEffect(() => {
    dispatch(fetchARAgingReport(state.asOfDate));
  }, [dispatch, state.asOfDate]);

  const report = state.report;
  const t = report?.totals;
  const overdue = t ? t.bucket31to60 + t.bucket61to90 + t.bucket90Plus : 0;
  const hasRows = (report?.rows?.length ?? 0) > 0;

  return (
    <ReportContainer>
      <ReportHeader title="A/P Aging" subtitle="Outstanding payables" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={reportContentStyle} showsVerticalScrollIndicator={false}>
        <Card>
          <DateField label="As of date" value={state.asOfDate} onChangeText={text => dispatch(setAPAgingAsOfDate(text))} />
        </Card>

        {state.isLoading && <LoadingBlock label="Aging receivables…" />}
        {!!state.error && (
          <ErrorBlock message={state.error} onRetry={() => dispatch(fetchARAgingReport(state.asOfDate))} />
        )}

        {report && !state.isLoading && (
          <>
            <ReportTitleBlock
              company={company}
              report="A/P Aging Summary"
              periodLabel={asOfLabel(state.asOfDate)}
            />

            <KpiGrid
              items={[
                { label: 'Total Outstanding', value: rs(t?.total ?? 0), accent: ACCENT.blue, icon: 'inbox' },
                { label: 'Current', value: rs(t?.current ?? 0), accent: ACCENT.green, icon: 'check-circle' },
                { label: 'Overdue', value: rs(overdue), accent: ACCENT.red, icon: 'alert-circle' },
              ]}
            />

            {!hasRows ? (
              <Card>
                <EmptyBlock icon="inbox" title="No outstanding payables" hint="Every vendor bill is settled." />
              </Card>
            ) : (
              <SectionCard title="By Vendor" icon="users">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View style={tableStyles.head}>
                      <TCell width={170} head>Vendor</TCell>
                      <TCell width={110} head align="right">Current</TCell>
                      <TCell width={100} head align="right">1–30</TCell>
                      <TCell width={100} head align="right">31–60</TCell>
                      <TCell width={100} head align="right">61–90</TCell>
                      <TCell width={116} head align="right">91 and over</TCell>
                      <TCell width={130} head align="right">Total</TCell>
                    </View>

                    {report.rows.map((row, i) => (
                      <View key={row.customerId} style={[tableStyles.row, i % 2 === 1 && tableStyles.rowAlt]}>
                        <TCell width={170}>{row.customerName}</TCell>
                        <TCell width={110} align="right">{rs(row.current)}</TCell>
                        <TCell width={100} align="right">{rs(row.bucket1to30)}</TCell>
                        <TCell width={100} align="right">{rs(row.bucket31to60)}</TCell>
                        <TCell width={100} align="right">{rs(row.bucket61to90)}</TCell>
                        <TCell width={116} align="right" color={row.bucket90Plus > 0 ? ACCENT.red : undefined}>
                          {rs(row.bucket90Plus)}
                        </TCell>
                        <TCell width={130} align="right" strong>{rs(row.total)}</TCell>
                      </View>
                    ))}

                    <View style={tableStyles.totalRow}>
                      <TCell width={170} strong>TOTAL</TCell>
                      <TCell width={110} align="right" strong>{rs(t!.current)}</TCell>
                      <TCell width={100} align="right" strong>{rs(t!.bucket1to30)}</TCell>
                      <TCell width={100} align="right" strong>{rs(t!.bucket31to60)}</TCell>
                      <TCell width={100} align="right" strong>{rs(t!.bucket61to90)}</TCell>
                      <TCell width={116} align="right" strong>{rs(t!.bucket90Plus)}</TCell>
                      <TCell width={130} align="right" strong>{rs(t!.total)}</TCell>
                    </View>
                  </View>
                </ScrollView>
              </SectionCard>
            )}
          </>
        )}
      </ScrollView>
    </ReportContainer>
  );
};

export default APAgingScreen;
