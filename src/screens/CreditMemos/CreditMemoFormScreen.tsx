import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { fetchCustomers, selectCustomers } from '../Customers/CustomerList/customerListSlice';
import { selectInventoryItems, fetchInventoryItems } from '../Inventory/InventoryList/inventoryListSlice';
import { selectFeatures } from '../Auth/authSlice';
import { createCreditMemoAPI } from '../../networks/sales/creditMemoNetwork';
import {
  fetchCreditMemoDraft,
  type DeliveryCreditMemoDraft,
} from '../../networks/delivery/deliveryNetwork';
import { useCapability } from '../../hooks/useCapability';
import { formatCurrency } from '../../utils/formatters';
import CustomDropdown from '../../Custom-Components/CustomDropdown';
import CustomInput from '../../Custom-Components/CustomInput';
import CustomButton from '../../Custom-Components/CustomButton';
import { AddButton } from '../../components/form/FormUI';
import LineItemRow from '../../components/shared/LineItemRow';
import { ReportContainer, ReportHeader, Card, SectionCard, DateField } from '../../components/reports/ReportUI';
import type { TransactionsStackParamList } from '../../navigators/stacks/TransactionsStack';
import { toIsoDate } from '../../models/reportModel';
import { lineTaxError } from '../../models/taxRate';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
type FormRoute = RouteProp<TransactionsStackParamList, 'CreditMemoForm'>;
interface LineDraft { itemId: string; description: string; quantity: string; unitPrice: string; taxRate: string; }
// Blank rather than '1' / '0' — see the note in SalesOrderFormScreen. Lines
// pre-filled from a delivery reversal carry real figures and are unaffected.
const blankLine = (): LineDraft => ({ itemId: '', description: '', quantity: '', unitPrice: '', taxRate: '0' });
const rs = (n: number) => formatCurrency(n, 'Rs ');

const CreditMemoFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<FormRoute>();
  const dispatch = useAppDispatch();
  // Reversing an approved delivery: the form arrives pre-filled from the
  // delivery's own figures rather than making somebody re-key them.
  const fromDeliveryRequestId = route.params?.fromDeliveryRequestId;
  const customers = useAppSelector(selectCustomers);
  const inventory = useAppSelector(selectInventoryItems);

  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [reversal, setReversal] = useState<DeliveryCreditMemoDraft | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(!!fromDeliveryRequestId);

  const features = useAppSelector(selectFeatures);
  // Staff prepare the reversal; the owner approves it before anything posts.
  const memoCap = useCapability('creditMemo.manage');

  useEffect(() => {
    dispatch(fetchCustomers());
    // Inventory is tier-gated (FinMatrix.md): small_business/large_org have it
    // disabled, so the fetch would be a guaranteed 403 — skip it and the memo
    // lines stay free-text (linking an item is optional anyway).
    if (features?.inventory !== false) {
      dispatch(fetchInventoryItems());
    }
  }, [dispatch, features?.inventory]);

  // Seed the form from the delivery being reversed. Fetched by id so the draft
  // is always current — a serialised payload sitting in a navigation param
  // could be minutes old by the time somebody submits it.
  useEffect(() => {
    if (!fromDeliveryRequestId) return;
    let cancelled = false;
    (async () => {
      try {
        const draft = await fetchCreditMemoDraft(fromDeliveryRequestId);
        if (cancelled) return;
        setReversal(draft);
        setCustomerId(draft.customerId);
        setDate(draft.date);
        setReason(draft.reason);
        setLines(
          draft.lines.length
            ? draft.lines.map(l => ({
                itemId: l.itemId,
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                taxRate: l.taxRate,
              }))
            : [blankLine()],
        );
      } catch (e: any) {
        if (cancelled) return;
        // The server refuses a delivery that never posted a sale. Say why and
        // go back rather than leaving a blank form that looks ready to use.
        Toast.show({
          type: 'error',
          text1: 'Cannot reverse this delivery',
          text2: e?.message ?? 'Please try again.',
        });
        navigation.goBack();
      } finally {
        if (!cancelled) setLoadingDraft(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromDeliveryRequestId, navigation]);

  // Linking an inventory item restocks the returned quantity and reverses its
  // cost out of COGS on the backend. Auto-fills description + price.
  const selectItem = (i: number, itemId: string) => {
    const it: any = inventory.find((x: any) => x.id === itemId);
    updateLine(i, {
      itemId,
      description: it?.name ?? lines[i]?.description ?? '',
      unitPrice: it ? String(it.sellingPrice) : lines[i]?.unitPrice ?? '0',
    });
  };

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    lines.forEach(l => {
      const base = (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
      subtotal += base; tax += base * (parseFloat(l.taxRate) || 0) / 100;
    });
    return { subtotal, tax, total: subtotal + tax };
  }, [lines]);

  const updateLine = (i: number, patch: Partial<LineDraft>) =>
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = async () => {
    if (!customerId) { Toast.show({ type: 'error', text1: 'Missing customer', text2: 'Please select a customer.' }); return; }
    const valid = lines.filter(l => l.description.trim());
    if (valid.length === 0) { Toast.show({ type: 'error', text1: 'No items', text2: 'Add at least one credited item.' }); return; }
    // The fields start empty now — refuse a described but unpriced line rather
    // than posting an empty string as the quantity.
    if (valid.some(l => !(parseFloat(l.quantity) > 0) || !(parseFloat(l.unitPrice) > 0))) {
      Toast.show({ type: 'error', text1: 'Incomplete line', text2: 'Every item needs a quantity and a rate.' });
      return;
    }
    const taxError = lineTaxError(lines);
    if (taxError) {
      Toast.show({ type: 'error', text1: 'Check the tax %', text2: taxError });
      return;
    }
    setSaving(true);
    try {
      const res: any = await createCreditMemoAPI({
        customerId, date, reason: reason || undefined,
        // Tie the credit to the invoice it reverses, and settle that invoice
        // in the same action — otherwise the invoice keeps showing a balance
        // beside a floating credit and the customer appears to owe money they
        // do not. The server applies only what the invoice can absorb.
        ...(reversal
          ? {
              originalInvoiceId: reversal.originalInvoiceId ?? undefined,
              // What the customer still owes is cleared from the invoice; what
              // they already paid (advance, cash at the door, a later receipt)
              // goes back out as cash — without the refund the credit would
              // leave accounts receivable negative until somebody raised a
              // separate one. A part-paid delivery needs both.
              ...(reversal.settlement !== 'refund_cash' && reversal.originalInvoiceId
                ? { applyToInvoiceId: reversal.originalInvoiceId }
                : {}),
              ...(reversal.settlement !== 'apply_to_invoice' || !reversal.originalInvoiceId
                ? { refundRemainderToCash: true }
                : {}),
              // Recorded on the delivery so it cannot be reversed twice.
              reversesDeliveryRequestId: reversal.deliveryRequestId,
            }
          : {}),
        lines: valid.map(l => ({
          description: l.description, quantity: l.quantity || '0', unitPrice: l.unitPrice || '0', taxRate: l.taxRate,
          ...(l.itemId ? { itemId: l.itemId } : {}),
        })),
      });

      // Staff get a pending request, not a credit memo. Nothing has reversed
      // yet, and saying otherwise would have them believe the customer had
      // been credited.
      if (res?.data?.pending ?? res?.pending) {
        Toast.show({
          type: 'success',
          text1: 'Sent to the owner for approval',
          text2: 'Nothing is credited until they approve it.',
        });
      }
      navigation.goBack();
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Save failed', text2: e?.message ?? 'Could not save credit memo' }); }
    finally { setSaving(false); }
  };

  return (
    <ReportContainer>
      <ReportHeader
        title={reversal ? 'Reverse Delivery' : 'New Credit Memo'}
        subtitle={reversal ? 'Credit the customer back' : 'Customer credit / return'}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!!reversal && (
          <View style={styles.reversalBanner}>
            <Text style={styles.reversalTitle}>
              Reversing delivery {reversal.deliveryReference ?? ''}
              {reversal.invoiceNumber ? ` · invoice ${reversal.invoiceNumber}` : ''}
            </Text>
            <Text style={styles.reversalBody}>
              {memoCap.needsApproval
                ? 'The owner approves this before anything is credited.'
                : 'This credits the customer and settles the invoice.'}
              {' '}
              {reversal.settlement === 'apply_to_invoice'
                ? `This settles invoice ${reversal.invoiceNumber ?? ''}.`
                : reversal.settlement === 'apply_then_refund'
                ? `This clears what is still owing on invoice ${reversal.invoiceNumber ?? ''} and refunds what the customer already paid in cash.`
                // Prepaid or collected at the door: the customer has the goods
                // and the business has their money, so reversing means giving
                // it back.
                : 'That invoice is already paid, so this refunds the customer in cash.'}
            </Text>
            <Text style={styles.reversalBody}>
              Remove or reduce a line if the customer kept part of the delivery.
            </Text>
          </View>
        )}
        <Card>
          {reversal ? (
            // Read-only rather than a disabled dropdown: a credit can only
            // settle its own customer's invoice, and the server enforces it —
            // offering the choice would only let someone pick a value that
            // gets rejected.
            <View style={styles.lockedField}>
              <Text style={styles.lockedLabel}>Customer</Text>
              <Text style={styles.lockedValue}>
                {reversal.customerName ??
                  customers.find((c: any) => c.id === customerId)?.name ??
                  'Customer on the delivery'}
              </Text>
            </View>
          ) : (
            <CustomDropdown label="Customer" placeholder="Select customer"
              options={customers.map((c: any) => ({ label: c.name, value: c.id }))} value={customerId} onChange={setCustomerId} />
          )}
          <DateField label="Date" value={date} onChangeText={setDate} />
          <CustomInput label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. returned goods" />
        </Card>

        <SectionCard title="Credited Items" icon="list">
          {lines.map((l, i) => (
            <View key={i} style={styles.lineWrap}>
              <CustomDropdown
                label="Inventory Item (optional)"
                placeholder="Free-text line — no restock"
                options={inventory.map((it: any) => ({ label: it.name, value: it.id }))}
                value={l.itemId}
                onChange={v => selectItem(i, v)}
              />
              <LineItemRow index={i} description={l.description} quantity={l.quantity} unitPrice={l.unitPrice} taxRate={l.taxRate}
                lineAmount={(parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0)}
                onDescriptionChange={v => updateLine(i, { description: v })}
                onQuantityChange={v => updateLine(i, { quantity: v })}
                onUnitPriceChange={v => updateLine(i, { unitPrice: v })}
                onTaxRateChange={v => updateLine(i, { taxRate: v })}
                onDelete={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
                // Removable down to zero; save refuses an empty document.
                canDelete />
            </View>
          ))}
          <AddButton label="Add Item" onPress={() => setLines(prev => [...prev, blankLine()])} />
        </SectionCard>

        <Card>
          <Row label="Subtotal" value={rs(totals.subtotal)} />
          <Row label="Tax" value={rs(totals.tax)} />
          <Row label="Total Credit" value={rs(totals.total)} strong />
        </Card>

        <CustomButton
          title={memoCap.submitLabel(reversal ? 'Reverse Delivery' : 'Issue Credit Memo')}
          onPress={save}
          // Submitting before the draft lands would post a blank memo against
          // the delivery it is meant to reverse.
          isLoading={saving || loadingDraft}
          disabled={saving || loadingDraft}
          fullWidth
        />
        <View style={{ height: 24 }} />
      </ScrollView>
    </ReportContainer>
  );
};

const Row: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <View style={styles.totalRow}>
    <Text style={[styles.totalLabel, strong && styles.bold]}>{label}</Text>
    <Text style={[styles.totalValue, strong && styles.bold]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  reversalBanner: {
    backgroundColor: THEME.colors.warningLighter,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  reversalTitle: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  reversalBody: {
    ...THEME.typography.bodySm,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  lockedField: { marginBottom: THEME.spacing.md },
  lockedLabel: { ...THEME.typography.labelSm, color: THEME.colors.textSecondary },
  lockedValue: {
    ...THEME.typography.bodyMd,
    color: THEME.colors.textPrimary,
    marginTop: 4,
  },
  content: { padding: 16, gap: 14 },
  lineWrap: { gap: 6, marginBottom: 6 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalLabel: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary },
  totalValue: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  bold: { ...THEME.typography.labelLg, color: THEME.colors.textPrimary },
});

export default CreditMemoFormScreen;
