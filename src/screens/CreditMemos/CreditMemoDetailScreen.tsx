import Toast from 'react-native-toast-message';
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import {
  fetchCreditMemo, selectCreditMemoState, applyCreditMemo, refundCreditMemo, voidCreditMemo, removeCreditMemo,
} from './creditMemoSlice';
import { getInvoicesAPI } from '../../networks/sales/invoiceNetwork';
import { invoiceListSerializer } from '../../serializers/invoiceSerializer';
import { formatCurrency } from '../../utils/formatters';
import CustomButton from '../../Custom-Components/CustomButton';
import { ReportContainer, ReportHeader, Card, SectionCard, Badge, LoadingBlock, ErrorBlock } from '../../components/reports/ReportUI';
import { txnStatusColor } from '../../components/transactions/txnStatus';
import { titleCase } from '../../components/transactions/TxnListUI';
import type { TransactionsStackParamList } from '../../navigators/stacks/TransactionsStack';
import type { Invoice } from '../../types';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
type Rt = RouteProp<TransactionsStackParamList, 'CreditMemoDetail'>;
const rs = (n: number) => formatCurrency(n, 'Rs ');

const CreditMemoDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { creditMemoId } = route.params;
  const dispatch = useAppDispatch();
  const { current: c, isLoading, error } = useAppSelector(selectCreditMemoState);
  const [showApply, setShowApply] = useState(false);
  const [openInvoices, setOpenInvoices] = useState<Invoice[]>([]);

  useFocusEffect(useCallback(() => { dispatch(fetchCreditMemo(creditMemoId)); }, [dispatch, creditMemoId]));

  const openApply = async () => {
    if (!c) return;
    try {
      const res = await getInvoicesAPI({ customerId: c.customerId } as any);
      const list = invoiceListSerializer(res).invoices.filter(i => i.total - i.amountPaid > 0.01 && i.status !== 'void' && i.status !== 'draft');
      setOpenInvoices(list);
      setShowApply(true);
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Could not load invoices'); }
  };

  const applyTo = async (inv: Invoice) => {
    if (!c) return;
    const invBalance = inv.total - inv.amountPaid;
    const amount = Math.min(c.balance, invBalance);
    const r: any = await dispatch(applyCreditMemo({ id: creditMemoId, invoiceId: inv.id, amount: amount.toFixed(2) }));
    if (r.meta.requestStatus === 'fulfilled') { setShowApply(false); Alert.alert('Applied', `${rs(amount)} applied to ${inv.invoiceNumber}.`); }
    else Alert.alert('Failed', r.error?.message ?? 'Could not apply credit');
  };

  if (isLoading && !c) return <ReportContainer><ReportHeader title="Credit Memo" onBack={() => navigation.goBack()} /><LoadingBlock label="Loading…" /></ReportContainer>;
  if (error && !c) return <ReportContainer><ReportHeader title="Credit Memo" onBack={() => navigation.goBack()} /><ErrorBlock message={error} onRetry={() => dispatch(fetchCreditMemo(creditMemoId))} /></ReportContainer>;
  if (!c) return <ReportContainer><ReportHeader title="Credit Memo" onBack={() => navigation.goBack()} /></ReportContainer>;

  const hasBalance = c.balance > 0.01 && c.status !== 'void' && c.status !== 'refunded';

  // These post journal entries and move stock. Dispatching without inspecting
  // the result meant a rejected void looked identical to a successful one, and
  // Delete navigated back whether or not the row was gone.
  const run = async (action: any, okMessage: string, leaveOnSuccess = false) => {
    try {
      await dispatch(action).unwrap();
      Toast.show({ type: 'success', text1: okMessage });
      if (leaveOnSuccess) navigation.goBack();
      else dispatch(fetchCreditMemo(creditMemoId));
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Action failed', text2: e?.message ?? 'Please try again.' });
    }
  };

  return (
    <ReportContainer>
      <ReportHeader title={c.creditMemoNumber} subtitle={c.customerName} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.headRow}>
            <Badge label={titleCase(c.status)} color={txnStatusColor(c.status)} dot />
            <Text style={styles.total}>{rs(c.total)}</Text>
          </View>
          <Info label="Date" value={c.date} />
          {!!c.reason && <Info label="Reason" value={c.reason} />}
          <Info label="Applied" value={rs(c.amountApplied)} />
          <Info label="Available credit" value={rs(c.balance)} strong />
        </Card>

        <SectionCard title="Credited Items" icon="list">
          {c.lines.map((l, i) => (
            <View key={l.id ?? i} style={styles.lineRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineDesc}>{l.description}</Text>
                <Text style={styles.lineMeta}>{l.quantity} × {rs(l.unitPrice)}{l.taxRate ? ` · ${l.taxRate}% tax` : ''}</Text>
              </View>
              <Text style={styles.lineTotal}>{rs(l.lineTotal)}</Text>
            </View>
          ))}
        </SectionCard>

        {showApply && (
          <SectionCard title="Apply to Invoice" icon="link">
            {openInvoices.length === 0 && <Text style={styles.lineMeta}>No outstanding invoices for this customer.</Text>}
            {openInvoices.map(inv => (
              <TouchableOpacity key={inv.id} style={styles.invRow} onPress={() => applyTo(inv)}>
                <Text style={styles.lineDesc}>{inv.invoiceNumber}</Text>
                <Text style={styles.lineTotal}>{rs(inv.total - inv.amountPaid)}</Text>
              </TouchableOpacity>
            ))}
          </SectionCard>
        )}

        <View style={styles.actions}>
          {hasBalance && <CustomButton title="Apply to Invoice" variant="primary" onPress={openApply} fullWidth />}
          {hasBalance && <CustomButton title="Refund Remaining" variant="secondary" onPress={() => run(refundCreditMemo(creditMemoId), 'Refund recorded')} fullWidth />}
          {c.status === 'open' && c.amountApplied < 0.01 && <CustomButton title="Void" variant="secondary" onPress={() => run(voidCreditMemo(creditMemoId), 'Credit memo voided')} fullWidth />}
          {c.status === 'open' && c.amountApplied < 0.01 && <CustomButton title="Delete" variant="danger" onPress={() => run(removeCreditMemo(creditMemoId), 'Credit memo deleted', true)} fullWidth />}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </ReportContainer>
  );
};

const Info: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={[styles.infoValue, strong && styles.bold]}>{value}</Text></View>
);

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  total: { ...THEME.typography.h4, color: THEME.colors.textPrimary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary },
  infoValue: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  bold: { ...THEME.typography.labelLg },
  lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight },
  invRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight },
  lineDesc: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  lineMeta: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  lineTotal: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  actions: { gap: 10 },
});

export default CreditMemoDetailScreen;
