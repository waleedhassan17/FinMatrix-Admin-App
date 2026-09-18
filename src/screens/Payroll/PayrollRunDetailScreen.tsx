import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity
} from 'react-native';
import { Alert } from '../../utils/alert';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { fetchPayrollRun, selectPayrollState, processRun, removeRun } from './payrollSlice';
import { formatCurrency } from '../../utils/formatters';
import CustomButton from '../../Custom-Components/CustomButton';
import { ReportContainer, ReportHeader, Card, SectionCard, KpiGrid, Badge, LoadingBlock, ErrorBlock, ACCENT } from '../../components/reports/ReportUI';
import { viewPayslipPdf, downloadPayslipPdf, sharePayslipPdf, type PayslipRef, type PayslipActionResult } from '../../utils/payslipPdf';
import type { MoreStackParamList } from '../../navigators/stacks/MoreStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;
type Rt = RouteProp<Record<string, { payrollRunId: string }>, string>;
const rs = (n: number) => formatCurrency(n, 'Rs ');
const STATUS_COLOR: Record<string, string> = { draft: THEME.colors.textSecondary, processed: ACCENT.blue, paid: ACCENT.green };

const PayrollRunDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { payrollRunId } = route.params;
  const dispatch = useAppDispatch();
  const { currentRun: r, isLoading, isSaving, error } = useAppSelector(selectPayrollState);
  // QuickBooks flow: a payslip per employee — tap a row to open it; the
  // official document is a backend-rendered PDF (view / download / share).
  const [payslipItem, setPayslipItem] = useState<any | null>(null);
  const [pdfBusy, setPdfBusy] = useState<'view' | 'download' | 'share' | null>(null);

  const runPdfAction = async (
    kind: 'view' | 'download' | 'share',
    action: (ref: PayslipRef) => Promise<PayslipActionResult>,
    it: any,
  ) => {
    if (!r || pdfBusy) return;
    setPdfBusy(kind);
    try {
      const res = await action({
        runId: payrollRunId,
        employeeId: it.employeeId,
        payPeriod: r.payPeriod,
        employeeName: it.employeeName || 'Employee',
      });
      if (!res.done && res.reason) Alert.alert('Payslip', res.reason);
    } catch (e: any) {
      Alert.alert('Payslip PDF failed', e?.message ?? 'Could not fetch the payslip PDF.');
    } finally {
      setPdfBusy(null);
    }
  };

  useFocusEffect(useCallback(() => { dispatch(fetchPayrollRun(payrollRunId)); }, [dispatch, payrollRunId]));

  const process = () => Alert.alert('Process Payroll', 'Posts one journal entry — Dr Salary Expense (6200), Cr Cash (1000) for net pay, Cr Payroll Liabilities (2310) for deductions — and marks the run paid. It cannot be edited afterwards.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Process', onPress: async () => {
      const res: any = await dispatch(processRun(payrollRunId));
      if (res.meta.requestStatus === 'fulfilled') Alert.alert('Done', 'Payroll processed and posted.');
      else Alert.alert('Failed', res.error?.message ?? 'Could not process');
    } },
  ]);

  if (isLoading && !r) return <ReportContainer><ReportHeader title="Payroll" onBack={() => navigation.goBack()} /><LoadingBlock label="Loading…" /></ReportContainer>;
  if (error && !r) return <ReportContainer><ReportHeader title="Payroll" onBack={() => navigation.goBack()} /><ErrorBlock message={error} onRetry={() => dispatch(fetchPayrollRun(payrollRunId))} /></ReportContainer>;
  if (!r) return <ReportContainer><ReportHeader title="Payroll" onBack={() => navigation.goBack()} /></ReportContainer>;

  return (
    <ReportContainer>
      <ReportHeader title={r.payPeriod} subtitle={`Pay date ${r.payDate}`} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusRow}><Badge label={r.status} color={STATUS_COLOR[r.status] ?? THEME.colors.textSecondary} dot /></View>
        <KpiGrid items={[
          { label: 'Gross', value: rs(r.totalGross), accent: ACCENT.blue, icon: 'briefcase' },
          { label: 'Deductions', value: rs(r.totalDeductions), accent: ACCENT.amber, icon: 'minus-circle' },
          { label: 'Net Pay', value: rs(r.totalNet), accent: ACCENT.green, icon: 'dollar-sign' },
        ]} />

        <SectionCard title="Pay Stubs" icon="users">
          <View style={styles.headRow}>
            <Text style={[styles.colName, styles.headText]}>Employee</Text>
            <Text style={[styles.colVal, styles.headText]}>Gross</Text>
            <Text style={[styles.colVal, styles.headText]}>Ded.</Text>
            <Text style={[styles.colVal, styles.headText]}>Net</Text>
          </View>
          {r.items.map((it, i) => (
            <TouchableOpacity key={it.id ?? i} style={styles.bodyRow} activeOpacity={0.6} onPress={() => setPayslipItem(it)}>
              <Text style={[styles.colName, styles.bodyText]}>{it.employeeName || 'Employee'}</Text>
              <Text style={[styles.colVal, styles.bodyText]}>{rs(it.gross)}</Text>
              <Text style={[styles.colVal, styles.bodyText]}>{rs(it.deductions)}</Text>
              <Text style={[styles.colVal, styles.bodyText, styles.bold]}>{rs(it.net)}</Text>
            </TouchableOpacity>
          ))}
          <Text style={styles.hint}>Tap an employee to view & share their payslip.</Text>
        </SectionCard>

        <View style={styles.actions}>
          {r.status !== 'paid' && <CustomButton title="Process Payroll" variant="primary" onPress={process} isLoading={isSaving} fullWidth />}
          {r.status !== 'paid' && (
            <CustomButton
              title="Delete"
              variant="danger"
              onPress={() => Alert.alert('Delete draft run', 'Nothing was posted for it, so deleting leaves the books unchanged.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => { dispatch(removeRun(payrollRunId)); navigation.goBack(); } },
              ])}
              fullWidth
            />
          )}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Payslip (per employee) ── */}
      <Modal visible={!!payslipItem} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPayslipItem(null)}>
        <View style={styles.slipBackdrop}>
          <View style={styles.slipCard}>
            <View style={styles.slipHead}>
              <Text style={styles.slipTitle}>Payslip</Text>
              <TouchableOpacity onPress={() => setPayslipItem(null)} style={styles.slipClose}>
                <Feather name="x" size={18} color={THEME.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {payslipItem && (
              <>
                <Text style={styles.slipEmployee}>{payslipItem.employeeName || 'Employee'}</Text>
                <Text style={styles.slipMeta}>{r.payPeriod} · paid {r.payDate}</Text>
                <View style={styles.slipDivider} />
                <SlipRow label="Gross pay" value={rs(payslipItem.gross)} />
                {Number(payslipItem.hours) > 0 && <SlipRow label="Hours" value={String(payslipItem.hours)} />}
                <SlipRow label="Tax / deductions withheld" value={`− ${rs(payslipItem.deductions)}`} />
                <View style={styles.slipDivider} />
                <SlipRow label="NET PAY" value={rs(payslipItem.net)} strong />
                {r.status === 'paid' ? (
                  <>
                    <CustomButton title="View PDF" variant="primary" isLoading={pdfBusy === 'view'} onPress={() => runPdfAction('view', viewPayslipPdf, payslipItem)} fullWidth />
                    <View style={styles.slipActionRow}>
                      <View style={styles.slipActionHalf}>
                        <CustomButton title="Download" variant="secondary" isLoading={pdfBusy === 'download'} onPress={() => runPdfAction('download', downloadPayslipPdf, payslipItem)} fullWidth />
                      </View>
                      <View style={styles.slipActionHalf}>
                        <CustomButton title="Share PDF" variant="secondary" isLoading={pdfBusy === 'share'} onPress={() => runPdfAction('share', sharePayslipPdf, payslipItem)} fullWidth />
                      </View>
                    </View>
                  </>
                ) : (
                  <Text style={styles.slipDraftHint}>
                    The official PDF payslip is issued once payroll is processed.
                  </Text>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </ReportContainer>
  );
};

const SlipRow: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <View style={styles.slipRow}>
    <Text style={[styles.slipLabel, strong && styles.bold]}>{label}</Text>
    <Text style={[styles.slipValue, strong && styles.bold]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  statusRow: { alignItems: 'flex-start' },
  headRow: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: THEME.colors.border },
  headText: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary, textTransform: 'uppercase' },
  bodyRow: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight },
  bodyText: { ...THEME.typography.bodySm, color: THEME.colors.textPrimary },
  colName: { flex: 1.4 }, colVal: { flex: 1, textAlign: 'right' },
  bold: { fontWeight: typography.labelLg.fontWeight },
  actions: { gap: 10 },
  hint: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary, paddingTop: 8 },
  slipBackdrop: { flex: 1, backgroundColor: 'rgba(9,30,66,0.5)', justifyContent: 'center', padding: 24 },
  slipCard: { backgroundColor: colors.neutral0, borderRadius: 16, padding: 18, gap: 8 },
  slipHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slipTitle: { ...THEME.typography.h4,  color: THEME.colors.textPrimary },
  slipClose: { padding: 4 },
  slipEmployee: { ...THEME.typography.h4,  color: THEME.colors.textPrimary },
  slipMeta: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  slipDivider: { height: StyleSheet.hairlineWidth, backgroundColor: THEME.colors.border, marginVertical: 6 },
  slipRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  slipActionRow: { flexDirection: 'row', gap: 10 },
  slipActionHalf: { flex: 1 },
  slipDraftHint: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary, textAlign: 'center', paddingTop: 6 },
  slipLabel: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary },
  slipValue: { ...THEME.typography.bodySm, color: THEME.colors.textPrimary }
});

export default PayrollRunDetailScreen;
