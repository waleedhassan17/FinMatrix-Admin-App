import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { fetchCustomers, selectCustomers } from '../Customers/CustomerList/customerListSlice';
import { fetchInventoryItems, selectInventoryItems } from '../Inventory/InventoryList/inventoryListSlice';
import { selectFeatures } from '../Auth/authSlice';
import { toIsoDate } from '../../models/reportModel';
import { lineTaxError } from '../../models/taxRate';
import {
  SERVICE_LINE_VALUE,
  UNCLASSIFIED_LINE_MESSAGE,
  firstUnclassifiedLine,
  kindOfStoredLine,
  salesLineKindPayload,
  salesLineOptions,
  salesLinePickerValue,
  stockHint,
  type SalesLineKind,
} from '../../models/salesLineModel';
import { getEstimateByIdAPI, createEstimateAPI, updateEstimateAPI } from '../../networks/sales/estimateNetwork';
import { estimateSingleSerializer } from '../../serializers/estimateSerializer';
import { formatCurrency } from '../../utils/formatters';
import CustomDropdown from '../../Custom-Components/CustomDropdown';
import CustomInput from '../../Custom-Components/CustomInput';
import CustomButton from '../../Custom-Components/CustomButton';
import { AddButton } from '../../components/form/FormUI';
import LineItemRow from '../../components/shared/LineItemRow';
import { ReportContainer, ReportHeader, Card, SectionCard, DateField } from '../../components/reports/ReportUI';
import type { TransactionsStackParamList } from '../../navigators/stacks/TransactionsStack';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
type Rt = RouteProp<TransactionsStackParamList, 'EstimateForm'>;

interface LineDraft { itemId: string; lineKind: SalesLineKind | ''; description: string; quantity: string; unitPrice: string; taxRate: string; }
// Blank rather than '1' / '0' — see the note in SalesOrderFormScreen; the
// same defaults were prefilling this form's Qty and Rate as if entered.
const blankLine = (): LineDraft => ({ itemId: '', lineKind: '', description: '', quantity: '', unitPrice: '', taxRate: '0' });
const rs = (n: number) => formatCurrency(n, 'Rs ');
// Local calendar date: toISOString() is UTC and reads yesterday in PKT before 05:00.
const today = () => toIsoDate(new Date());

const EstimateFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const editingId = route.params?.estimateId;
  const dispatch = useAppDispatch();
  const customers = useAppSelector(selectCustomers);
  const inventory = useAppSelector(selectInventoryItems);
  const features = useAppSelector(selectFeatures);

  const [customerId, setCustomerId] = useState('');
  const [estimateDate, setEstimateDate] = useState(today());
  const [expiryDate, setExpiryDate] = useState('');
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'amount'>('none');
  const [discountValue, setDiscountValue] = useState('0');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatch(fetchCustomers());
    // Inventory is tier-gated (FinMatrix.md) — skip the fetch entirely for
    // companies without the feature instead of firing a guaranteed 403.
    if (features?.inventory !== false) dispatch(fetchInventoryItems());
  }, [dispatch, features?.inventory]);

  // ── Line picker: a stock item, or explicitly a service / charge ──
  // In an inventory company a product must be a stock item, so selling it
  // moves stock and posts cost of sales; the server refuses a typed line that
  // is not marked as a service (LINE_ITEM_REQUIRED).
  const inventoryEnabled = features?.inventory !== false;
  const itemOptions = useMemo(() => salesLineOptions(inventory), [inventory]);

  // Keyed by index, not by id: these lines are local drafts with no stable id
  // (the list is rendered and updated by position).
  const handleSelectItem = useCallback(
    (i: number, itemId: string) => {
      const it = inventory.find(x => x.id === itemId);
      if (itemId === SERVICE_LINE_VALUE) {
        // The text and price stay the user's: a service is described by hand.
        setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, itemId: '', lineKind: 'service' } : l)));
        return;
      }
      setLines(prev => prev.map((l, idx) => (idx === i
        ? {
            ...l,
            itemId,
            lineKind: itemId ? 'item' : '',
            ...(it ? { description: it.name, unitPrice: String(it.sellingPrice) } : {}),
          }
        : l)));
    },
    [inventory],
  );

  useEffect(() => {
    if (!editingId) return;
    getEstimateByIdAPI(editingId).then(p => {
      const e = estimateSingleSerializer(p);
      if (!e) return;
      setCustomerId(e.customerId);
      setEstimateDate(e.estimateDate);
      setExpiryDate(e.expiryDate ?? '');
      setDiscountType(e.discountType);
      setDiscountValue(String(e.discountValue));
      setNotes(e.notes);
      setLines(e.lines.length ? e.lines.map(l => ({
        itemId: l.itemId ?? '',
        lineKind: kindOfStoredLine(l.itemId),
        description: l.description, quantity: String(l.quantity), unitPrice: String(l.unitPrice), taxRate: String(l.taxRate),
      })) : [blankLine()]);
    }).catch(() => {});
  }, [editingId]);

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    lines.forEach(l => {
      const base = (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
      subtotal += base;
      tax += base * (parseFloat(l.taxRate) || 0) / 100;
    });
    let disc = 0;
    if (discountType === 'percent') disc = subtotal * (parseFloat(discountValue) || 0) / 100;
    else if (discountType === 'amount') disc = parseFloat(discountValue) || 0;
    disc = Math.min(disc, subtotal);
    return { subtotal, tax, disc, total: subtotal - disc + tax };
  }, [lines, discountType, discountValue]);

  const updateLine = (i: number, patch: Partial<LineDraft>) =>
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = async () => {
    if (!customerId) { Toast.show({ type: 'error', text1: 'Missing customer', text2: 'Please select a customer.' }); return; }
    const valid = lines.filter(l => l.description.trim());
    if (valid.length === 0) { Toast.show({ type: 'error', text1: 'No items', text2: 'Add at least one line item.' }); return; }
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
    const unclassified = firstUnclassifiedLine(valid, inventoryEnabled);
    if (unclassified >= 0) {
      Toast.show({ type: 'error', text1: `Line ${unclassified + 1}: item or service?`, text2: UNCLASSIFIED_LINE_MESSAGE });
      return;
    }
    const payload = {
      customerId, estimateDate, expiryDate: expiryDate || undefined,
      discountType, discountValue, status: 'sent',
      notes: notes || undefined,
      lines: valid.map(l => ({
        description: l.description, quantity: l.quantity || '0', unitPrice: l.unitPrice || '0', taxRate: l.taxRate,
        // itemId only when linked (an empty string fails @IsUUID); a line
        // without one says it is a service.
        ...salesLineKindPayload(l, inventoryEnabled),
      })),
    };
    setSaving(true);
    try {
      if (editingId) await updateEstimateAPI(editingId, payload);
      else await createEstimateAPI(payload);
      navigation.goBack();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Save failed', text2: e?.message ?? 'Could not save estimate' });
    } finally { setSaving(false); }
  };

  return (
    <ReportContainer>
      <ReportHeader title={editingId ? 'Edit Estimate' : 'New Estimate'} subtitle="Quote / proposal" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <CustomDropdown label="Customer" placeholder="Select customer"
            options={customers.map((c: any) => ({ label: c.name, value: c.id }))}
            value={customerId} onChange={setCustomerId} />
          <View style={styles.row}>
            <View style={styles.col}>
              <DateField label="Estimate Date" value={estimateDate} onChangeText={setEstimateDate} />
            </View>
            <View style={styles.col}>
              {/* Expiry is a future date → allow dates after today; never before the estimate date. */}
              <DateField
                label="Expiry Date"
                value={expiryDate}
                onChangeText={setExpiryDate}
                placeholder="Optional"
                minimumDate={estimateDate ? new Date(estimateDate) : undefined}
                maximumDate={new Date(2100, 11, 31)}
              />
            </View>
          </View>
        </Card>

        <SectionCard title="Line Items" icon="list">
          {lines.map((l, i) => (
            <LineItemRow key={i} index={i}
              // Hidden rather than empty when the company has no inventory:
              // the fetch above is skipped there, so the dropdown's only entry
              // would be "No item" — a dead control implying a feature they
              // have not bought.
              topSlot={features?.inventory !== false ? (
                <View>
                  <CustomDropdown
                    label="Item or service *"
                    options={itemOptions}
                    value={salesLinePickerValue(l)}
                    onChange={v => handleSelectItem(i, v)}
                    placeholder="Pick a stock item…"
                    searchable
                  />
                  {l.lineKind === 'service' && !l.itemId && (
                    <Text style={styles.lineHint}>Service / charge — no stock moves</Text>
                  )}
                  {(() => {
                    const h = stockHint(inventory.find(x => x.id === l.itemId), l.quantity);
                    return h ? (
                      <Text style={[styles.lineHint, h.short && styles.lineHintShort]}>{h.text}</Text>
                    ) : null;
                  })()}
                </View>
              ) : undefined}
              description={l.description} quantity={l.quantity} unitPrice={l.unitPrice} taxRate={l.taxRate}
              lineAmount={(parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0)}
              onDescriptionChange={v => updateLine(i, { description: v })}
              onQuantityChange={v => updateLine(i, { quantity: v })}
              onUnitPriceChange={v => updateLine(i, { unitPrice: v })}
              onTaxRateChange={v => updateLine(i, { taxRate: v })}
              onDelete={() => setLines(prev => prev.filter((_, idx) => idx !== i))}
              // Removable down to zero; save refuses an empty document.
              canDelete />
          ))}
          <AddButton label="Add Item" onPress={() => setLines(prev => [...prev, blankLine()])} />
        </SectionCard>

        <Card>
          <CustomDropdown label="Discount Type"
            options={[{ label: 'None', value: 'none' }, { label: 'Percent (%)', value: 'percent' }, { label: 'Amount (Rs)', value: 'amount' }]}
            value={discountType} onChange={v => setDiscountType(v as any)} />
          {discountType !== 'none' && <CustomInput label="Discount Value" value={discountValue} onChangeText={setDiscountValue} keyboardType="numeric" />}
          <CustomInput label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" />
        </Card>

        <Card>
          <Row label="Subtotal" value={rs(totals.subtotal)} />
          {totals.disc > 0 && <Row label="Discount" value={`- ${rs(totals.disc)}`} />}
          <Row label="Tax" value={rs(totals.tax)} />
          <Row label="Total" value={rs(totals.total)} strong />
        </Card>

        <CustomButton title={editingId ? 'Update Estimate' : 'Create Estimate'} onPress={save} isLoading={saving} fullWidth />
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
  content: { padding: 16, gap: 14 },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  totalLabel: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary },
  totalValue: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  lineHint: { ...THEME.typography.caption, color: THEME.colors.textSecondary, marginTop: -4, marginBottom: 6 },
  lineHintShort: { color: THEME.colors.warning },
  bold: { ...THEME.typography.labelLg, color: THEME.colors.textPrimary },
});

export default EstimateFormScreen;
