import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Alert } from '../../utils/alert';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import {
  fetchSalesOrder, selectSalesOrderState, fulfillSalesOrder,
  convertSalesOrderInvoice, cancelSalesOrder, removeSalesOrder,
} from './salesOrderSlice';
import { formatCurrency } from '../../utils/formatters';
import CreditLimitModal from '../../components/shared/CreditLimitModal';
import { creditAssessmentFrom, type CreditAssessment } from '../../models/creditModel';

import CustomButton from '../../Custom-Components/CustomButton';
import { ReportContainer, ReportHeader, Card, SectionCard, Badge, ProgressBar, LoadingBlock, ErrorBlock } from '../../components/reports/ReportUI';
import { txnStatusColor } from '../../components/transactions/txnStatus';
import { titleCase } from '../../components/transactions/TxnListUI';
import type { TransactionsStackParamList } from '../../navigators/stacks/TransactionsStack';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
type Rt = RouteProp<TransactionsStackParamList, 'SalesOrderDetail'>;
const rs = (n: number) => formatCurrency(n, 'Rs ');
/** What the server said about a rejected thunk. These thunks rejectWithValue
 *  (keeping the code and details), so the message is on `payload`. */
const failureText = (r: any) => r?.payload?.message ?? r?.error?.message ?? 'Please try again.';


const SalesOrderDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { salesOrderId } = route.params;
  const dispatch = useAppDispatch();
  const { current: o, isLoading, isSaving, error } = useAppSelector(selectSalesOrderState);

  useFocusEffect(useCallback(() => { dispatch(fetchSalesOrder(salesOrderId)); }, [dispatch, salesOrderId]));

  // Shipping and invoicing are checked against the customer's credit limit.
  // A refusal carries the breakdown; the retry is the same action with the
  // owner's reason.
  const [creditRefusal, setCreditRefusal] = useState<{ assessment: CreditAssessment; retry: (reason: string) => void } | null>(null);

  const markFulfilled = async (overrideReason?: string) => {
    if (!o) return;
    const r: any = await dispatch(fulfillSalesOrder({
      id: salesOrderId,
      lines: o.lines.map(l => ({ lineId: l.id!, quantityFulfilled: String(l.quantity) })),
      ...(overrideReason ? { overrideReason } : {}),
    }));
    if (r.meta.requestStatus === 'fulfilled') return;
    const assessment = creditAssessmentFrom(r.payload);
    if (assessment) { setCreditRefusal({ assessment, retry: reason => { void markFulfilled(reason); } }); return; }
    // Short stock lands here too: an order cannot ship more than is on hand.
    Alert.alert('Could not fulfil', failureText(r));
  };
  const runConvert = async (overrideReason?: string) => {
    const r: any = await dispatch(convertSalesOrderInvoice({ id: salesOrderId, overrideReason }));
    if (r.meta.requestStatus === 'fulfilled') {
      const pending = r.payload?.pending ?? r.payload?.data?.pending;
      Alert.alert(pending ? 'Sent for approval' : 'Done', pending ? 'The owner approves before the invoice is raised.' : 'Invoice created from sales order.');
      return;
    }
    const assessment = creditAssessmentFrom(r.payload);
    if (assessment) { setCreditRefusal({ assessment, retry: reason => { void runConvert(reason); } }); return; }
    Alert.alert('Could not create invoice', failureText(r));
  };
  const convert = () => {
    Alert.alert('Create Invoice', 'Invoice this sales order?', [
      { text: 'Cancel', style: 'cancel' },
      // Invoicing POSTS: it moves stock and books COGS, so it can be refused —
      // short stock, a closed period, the credit limit. runConvert says why.
      { text: 'Create', onPress: () => { void runConvert(); } },
    ]);
  };
  const doDelete = () => {
    Alert.alert('Delete sales order', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await dispatch(removeSalesOrder(salesOrderId)); navigation.goBack(); } },
    ]);
  };

  if (isLoading && !o) return <ReportContainer><ReportHeader title="Sales Order" onBack={() => navigation.goBack()} /><LoadingBlock label="Loading…" /></ReportContainer>;
  if (error && !o) return <ReportContainer><ReportHeader title="Sales Order" onBack={() => navigation.goBack()} /><ErrorBlock message={error} onRetry={() => dispatch(fetchSalesOrder(salesOrderId))} /></ReportContainer>;
  if (!o) return <ReportContainer><ReportHeader title="Sales Order" onBack={() => navigation.goBack()} /></ReportContainer>;

  const active = o.status !== 'invoiced' && o.status !== 'cancelled';
  const canInvoice = o.status === 'fulfilled' || o.status === 'partial';

  return (
    <ReportContainer>
      <ReportHeader title={o.orderNumber} subtitle={o.customerName} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.headRow}>
            <Badge label={titleCase(o.status)} color={txnStatusColor(o.status)} dot />
            <Text style={styles.total}>{rs(o.total)}</Text>
          </View>
          <Info label="Order date" value={o.orderDate} />
          {!!o.expectedDate && <Info label="Expected date" value={o.expectedDate} />}
          {o.invoiceId && <Info label="Invoiced" value="Yes" />}
        </Card>

        <SectionCard title="Items & Fulfillment" icon="package">
          {o.lines.map((l, i) => {
            const pct = l.quantity > 0 ? Math.min(1, l.quantityFulfilled / l.quantity) : 0;
            return (
              <View key={l.id ?? i} style={styles.lineRow}>
                <View style={styles.lineTop}>
                  <Text style={styles.lineDesc}>{l.description}</Text>
                  <Text style={styles.lineTotal}>{rs(l.lineTotal)}</Text>
                </View>
                <Text style={styles.lineMeta}>
                  {l.quantityFulfilled}/{l.quantity} fulfilled · {rs(l.unitPrice)} ea
                  {!l.itemId ? ' · service' : l.onHand != null ? ` · on hand ${l.onHand}` : ''}
                </Text>
                {(l.backorderQty ?? 0) > 0 && (
                  <Text style={[styles.lineMeta, { color: THEME.colors.warning }]}>Backorder {l.backorderQty} — ships when stock arrives</Text>
                )}
                <ProgressBar pct={pct} color={pct >= 1 ? THEME.colors.success : THEME.colors.warning} />
              </View>
            );
          })}
          <View style={styles.divider} />
          <Info label="Subtotal" value={rs(o.subtotal)} />
          {o.discountAmount > 0 && <Info label="Discount" value={`- ${rs(o.discountAmount)}`} />}
          <Info label="Tax" value={rs(o.taxAmount)} />
          <Info label="Total" value={rs(o.total)} strong />
        </SectionCard>

        {!!o.notes && <Card><Text style={styles.notes}>{o.notes}</Text></Card>}

        <View style={styles.actions}>
          {o.status === 'open' && <CustomButton title="Edit Sales Order" variant="secondary" onPress={() => navigation.navigate('SalesOrderForm', { salesOrderId })} fullWidth />}
          {active && o.status !== 'fulfilled' && <CustomButton title="Mark Fully Fulfilled" variant="primary" onPress={() => { void markFulfilled(); }} isLoading={isSaving} fullWidth />}
          {canInvoice && <CustomButton title="Convert to Invoice" variant="primary" onPress={convert} isLoading={isSaving} fullWidth />}
          {active && <CustomButton title="Cancel Order" variant="secondary" onPress={() => dispatch(cancelSalesOrder(salesOrderId))} fullWidth />}
          {active && <CustomButton title="Delete" variant="danger" onPress={doDelete} fullWidth />}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
      <CreditLimitModal
        assessment={creditRefusal?.assessment ?? null}
        busy={isSaving}
        onClose={() => setCreditRefusal(null)}
        onOverride={reason => { const retry = creditRefusal?.retry; setCreditRefusal(null); retry?.(reason); }}
        onRecordAdvance={a => { setCreditRefusal(null); navigation.navigate('ReceivePayment', { customerId: a.customerId }); }}
      />
    </ReportContainer>
  );
};

const Info: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, strong && styles.bold]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  total: { ...THEME.typography.h4, color: THEME.colors.textPrimary },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary },
  infoValue: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  bold: { ...THEME.typography.labelLg },
  lineRow: { paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight, gap: 5 },
  lineTop: { flexDirection: 'row', justifyContent: 'space-between' },
  lineDesc: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary, flex: 1 },
  lineMeta: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  lineTotal: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  divider: { height: 1, backgroundColor: THEME.colors.border, marginVertical: 8 },
  notes: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary },
  actions: { gap: 10 },
});

export default SalesOrderDetailScreen;
