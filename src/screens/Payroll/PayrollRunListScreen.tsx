import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { Alert } from '../../utils/alert';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { fetchPayrollRuns, selectPayrollState, createRun } from './payrollSlice';
import { formatCurrency } from '../../utils/formatters';
import { payrollPeriodFor } from '../../utils/payrollMath';
import CustomButton from '../../Custom-Components/CustomButton';
import type { MoreStackParamList } from '../../navigators/stacks/MoreStack';
import { ReportContainer, ReportHeader, Badge, EmptyBlock, LoadingBlock, ErrorBlock, ACCENT } from '../../components/reports/ReportUI';

// Design-system tokens (see src/theme/theme.ts).
const { typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;
const rs = (n: number) => formatCurrency(n, 'Rs ');
const STATUS_COLOR: Record<string, string> = { draft: THEME.colors.textSecondary, processed: ACCENT.blue, paid: ACCENT.green };

const PayrollRunListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const state = useAppSelector(selectPayrollState);
  const [creating, setCreating] = useState(false);
  const load = useCallback(() => { dispatch(fetchPayrollRuns()); }, [dispatch]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const runNow = async () => {
    // Local calendar dates. toISOString() is UTC, which in PKT made the 1st the
    // last day of the previous month, and just after midnight dated the
    // payroll entry the day before. The label is built by hand so it matches
    // the web console's exactly — the server refuses a second run for a period
    // already paid by comparing it.
    const { payPeriod, periodStart, periodEnd, payDate } = payrollPeriodFor(new Date());
    setCreating(true);
    const r: any = await dispatch(createRun({ payPeriod, periodStart, periodEnd, payDate }));
    setCreating(false);
    if (r.meta.requestStatus === 'fulfilled' && r.payload?.data?.id) {
      navigation.navigate('PayrollRunDetail' as any, { payrollRunId: r.payload.data.id });
    } else if (r.meta.requestStatus === 'fulfilled') { load(); }
    else Alert.alert('Failed', r.error?.message ?? 'Could not create payroll run');
  };

  return (
    <ReportContainer>
      <ReportHeader title="Payroll" subtitle="Run & track payroll" onBack={() => navigation.goBack()} />
      <View style={styles.runBtn}><CustomButton title={creating ? 'Building…' : '+ Run Payroll (this month)'} onPress={runNow} isLoading={creating} fullWidth /></View>
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={state.isLoading} onRefresh={load} tintColor={THEME.colors.primary} />}>
        {state.isLoading && state.runs.length === 0 && <LoadingBlock label="Loading…" />}
        {!!state.error && <ErrorBlock message={state.error} onRetry={load} />}
        {!state.isLoading && state.runs.length === 0 && !state.error && (
          <EmptyBlock icon="dollar-sign" title="No payroll runs" hint="Tap Run Payroll to build a worksheet." />
        )}
        {state.runs.map(r => (
          <TouchableOpacity key={r.id} style={styles.card} activeOpacity={0.7}
            onPress={() => navigation.navigate('PayrollRunDetail' as any, { payrollRunId: r.id })}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName}>{r.payPeriod}</Text>
              <Badge label={r.status} color={STATUS_COLOR[r.status] ?? THEME.colors.textSecondary} dot />
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.cardSub}>Pay date {r.payDate}</Text>
              <Text style={styles.cardPay}>Net {rs(r.totalNet)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ReportContainer>
  );
};

const styles = StyleSheet.create({
  runBtn: { paddingHorizontal: 16, paddingTop: 8 },
  content: { padding: 16, gap: 10 },
  card: { backgroundColor: THEME.colors.surface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: THEME.colors.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { ...THEME.typography.bodyMd, color: THEME.colors.textPrimary, fontWeight: typography.labelLg.fontWeight },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  cardSub: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  cardPay: { ...THEME.typography.bodySm, color: THEME.colors.textPrimary, fontWeight: typography.labelLg.fontWeight }
});

export default PayrollRunListScreen;
