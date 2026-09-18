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
  fetchEstimate, selectEstimateState, changeEstimateStatus,
  convertEstimateInvoice, convertEstimateSalesOrder, removeEstimate,
} from './estimateSlice';
import { formatCurrency } from '../../utils/formatters';
import CreditLimitModal from '../../components/shared/CreditLimitModal';
import { creditAssessmentFrom, type CreditAssessment } from '../../models/creditModel';
import { backorderMessage, backorderShortfalls } from '../../models/salesLineModel';
import CustomButton from '../../Custom-Components/CustomButton';
import { ReportContainer, ReportHeader, Card, SectionCard, Badge, LoadingBlock, ErrorBlock } from '../../components/reports/ReportUI';
import { txnStatusColor } from '../../components/transactions/txnStatus';
import { titleCase } from '../../components/transactions/TxnListUI';
import type { TransactionsStackParamList } from '../../navigators/stacks/TransactionsStack';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
type Rt = RouteProp<TransactionsStackParamList, 'EstimateDetail'>;
const rs = (n: number) => formatCurrency(n, 'Rs ');
/** What the server said about a rejected thunk. These convert thunks
 *  rejectWithValue (keeping code and details), so the message is on `payload`. */
const failureText = (r: any) => r?.payload?.message ?? r?.error?.message ?? 'Please try again.';

const EstimateDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { estimateId } = route.params;
  const dispatch = useAppDispatch();
  const { current: e, isLoading, isSaving, error } = useAppSelector(selectEstimateState);

  useFocusEffect(useCallback(() => { dispatch(fetchEstimate(estimateId)); }, [dispatch, estimateId]));

  const [creditRefusal, setCreditRefusal] = useState<CreditAssessment | null>(null);

  // Converting POSTS: it raises the invoice, moves stock and books COGS, so it
  // can be refused — short stock, a closed period, the credit limit.
  const runConvertInvoice = async (overrideReason?: string) => {
    const r: any = await dispatch(convertEstimateInvoice({ id: estimateId, overrideReason }));
    if (r.meta.requestStatus === 'fulfilled') {
      const pending = r.payload?.pending ?? r.payload?.data?.pending;
      Alert.alert(pending ? 'Sent for approval' : 'Done', pending ? 'The owner approves before the invoice is raised.' : 'Invoice created from estimate.');
      return;
    }
    const assessment = creditAssessmentFrom(r.payload);
    if (assessment) { setCreditRefusal(assessment); return; }
    Alert.alert('Could not convert', failureText(r));
  };
  const doConvertInvoice = () => {
    Alert.alert('Convert to Invoice', 'Create an invoice from this estimate?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Convert', onPress: () => { void runConvertInvoice(); } },
    ]);
  };
  const doConvertSO = async (acceptBackorder = false) => {
    const r: any = await dispatch(convertEstimateSalesOrder({ id: estimateId, acceptBackorder }));
    if (r.meta.requestStatus === 'fulfilled') { Alert.alert('Done', 'Sales order created from estimate.'); return; }
    const short = backorderShortfalls(r.payload);
    if (short && !acceptBackorder) {
      Alert.alert('Not enough stock', backorderMessage(short), [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create with backorder', onPress: () => { void doConvertSO(true); } },
      ]);
      return;
    }
    Alert.alert('Could not convert', failureText(r));
  };
  const doDelete = () => {
    Alert.alert('Delete estimate', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await dispatch(removeEstimate(estimateId)); navigation.goBack(); } },
    ]);
  };

  if (isLoading && !e) return <ReportContainer><ReportHeader title="Estimate" onBack={() => navigation.goBack()} /><LoadingBlock label="Loading…" /></ReportContainer>;
  if (error && !e) return <ReportContainer><ReportHeader title="Estimate" onBack={() => navigation.goBack()} /><ErrorBlock message={error} onRetry={() => dispatch(fetchEstimate(estimateId))} /></ReportContainer>;
  if (!e) return <ReportContainer><ReportHeader title="Estimate" onBack={() => navigation.goBack()} /></ReportContainer>;

  const canEdit = e.status !== 'converted';
  const canConvert = e.status === 'accepted' || e.status === 'sent';

  return (
    <ReportContainer>
      <ReportHeader title={e.estimateNumber} subtitle={e.customerName} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.headRow}>
            <Badge label={titleCase(e.status)} color={txnStatusColor(e.status)} dot />
            <Text style={styles.total}>{rs(e.total)}</Text>
          </View>
          <Info label="Estimate date" value={e.estimateDate} />
          {!!e.expiryDate && <Info label="Expiry date" value={e.expiryDate} />}
          {e.convertedToType && <Info label="Converted to" value={e.convertedToType === 'invoice' ? 'Invoice' : 'Sales Order'} />}
        </Card>

        <SectionCard title="Line Items" icon="list">
          {e.lines.map((l, i) => (
            <View key={l.id ?? i} style={styles.lineRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineDesc}>{l.description}</Text>
                <Text style={styles.lineMeta}>{l.quantity} × {rs(l.unitPrice)}{l.taxRate ? ` · ${l.taxRate}% tax` : ''}</Text>
              </View>
              <Text style={styles.lineTotal}>{rs(l.lineTotal)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <Info label="Subtotal" value={rs(e.subtotal)} />
          {e.discountAmount > 0 && <Info label="Discount" value={`- ${rs(e.discountAmount)}`} />}
          <Info label="Tax" value={rs(e.taxAmount)} />
          <Info label="Total" value={rs(e.total)} strong />
        </SectionCard>

        {!!e.notes && <Card><Text style={styles.notes}>{e.notes}</Text></Card>}

        <View style={styles.actions}>
          {e.status === 'sent' && <CustomButton title="Mark Accepted" variant="primary" onPress={() => dispatch(changeEstimateStatus({ id: estimateId, status: 'accepted' }))} fullWidth />}
          {e.status === 'sent' && <CustomButton title="Mark Declined" variant="secondary" onPress={() => dispatch(changeEstimateStatus({ id: estimateId, status: 'declined' }))} fullWidth />}
          {canConvert && <CustomButton title="Convert to Invoice" variant="primary" onPress={doConvertInvoice} isLoading={isSaving} fullWidth />}
          {canConvert && <CustomButton title="Convert to Sales Order" variant="secondary" onPress={() => { void doConvertSO(); }} isLoading={isSaving} fullWidth />}
          {canEdit && <CustomButton title="Edit" variant="secondary" onPress={() => navigation.navigate('EstimateForm', { estimateId })} fullWidth />}
          {canEdit && <CustomButton title="Delete" variant="danger" onPress={doDelete} fullWidth />}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
      <CreditLimitModal
        assessment={creditRefusal}
        busy={isSaving}
        onClose={() => setCreditRefusal(null)}
        onOverride={reason => { setCreditRefusal(null); void runConvertInvoice(reason); }}
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
  lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight },
  lineDesc: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  lineMeta: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  lineTotal: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  divider: { height: 1, backgroundColor: THEME.colors.border, marginVertical: 8 },
  notes: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary },
  actions: { gap: 10 },
});

export default EstimateDetailScreen;
