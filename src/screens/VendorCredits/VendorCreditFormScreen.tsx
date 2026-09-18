import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { THEME } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../hooks/useReduxHooks';
import { useCapability } from '../../hooks/useCapability';
import { fetchVendors, selectVendors } from '../Vendors/VendorList/vendorListSlice';
import { fetchInventoryItems, selectInventoryItems } from '../Inventory/InventoryList/inventoryListSlice';
import { fetchAccounts, selectAccounts } from '../ChartOfAccounts/COAList/coaListSlice';
import { createVendorCreditAPI } from '../../networks/purchases/vendorCreditNetwork';
import {
  vendorCreditLineToPayload,
  vendorCreditTotals,
  type VendorCreditLineDraft,
} from '../../models/vendorCreditModel';
import { formatCurrency } from '../../utils/formatters';
import CustomDropdown from '../../Custom-Components/CustomDropdown';
import CustomInput from '../../Custom-Components/CustomInput';
import CustomButton from '../../Custom-Components/CustomButton';
import { AddButton } from '../../components/form/FormUI';
import TaxField from '../../components/form/TaxField';
import { ReportContainer, ReportHeader, Card, SectionCard, DateField } from '../../components/reports/ReportUI';
import type { TransactionsStackParamList } from '../../navigators/stacks/TransactionsStack';
import { toIsoDate } from '../../models/reportModel';
import { lineTaxError } from '../../models/taxRate';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
// A line either returns STOCK to the supplier or credits money only.
// Naming the item is what lets the credit post Dr A/P / Cr Inventory and take
// the units off the shelf; without it the API can only credit an expense
// account, because crediting Inventory with no quantity would move the control
// account while stock stood still.
//
// `accountId` and `taxRate` were both missing here, and each produced a wrong
// journal entry rather than a cosmetic gap:
//
//   accountId  the API falls back to COGS for any line that names no item
//              (`l.accountId ?? cogs.id`). Since a bill can be coded to Fixed
//              Asset, Prepaid or Other Asset, reversing one of those sent a
//              balance-sheet figure to the P&L and made net income wrong.
//   taxRate    the credit reverses the input tax claimed on the original bill
//              out of Sales Tax Recoverable (1300). At 0, A/P was relieved by
//              the net while the supplier's credit note was for the gross, and
//              the tax stayed in 1300 as recoverable when it no longer was.
//
// The payload and totals live in the model so both rules are pinned by tests
// rather than buried in this screen — see models/__tests__/vendorCreditModel.
type LineDraft = VendorCreditLineDraft;
const blankLine = (): LineDraft => ({
  itemId: '', accountId: '', quantity: '', description: '', amount: '0', taxRate: '0',
});
const rs = (n: number) => formatCurrency(n, 'Rs ');

const VendorCreditFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const vendors = useAppSelector(selectVendors);
  const items = useAppSelector(selectInventoryItems);
  const accounts = useAppSelector(selectAccounts);
  const creditCap = useCapability('vendorCredit.manage');

  const [vendorId, setVendorId] = useState('');
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatch(fetchVendors());
    dispatch(fetchInventoryItems());
    dispatch(fetchAccounts());
  }, [dispatch]);

  const itemOptions = useMemo(
    () => [
      { label: 'No item — money only', value: '' },
      ...items.filter(i => i.isActive).map(i => ({ label: `${i.sku} — ${i.name}`, value: i.itemId ?? i.id })),
    ],
    [items],
  );

  // The same set the bill form offers — every expense account plus purchasable
  // assets — MINUS Inventory. A credit line that names an item already posts to
  // Inventory and relieves the stock with it; a money-only line pointed at 1200
  // is refused outright (INVENTORY_LINE_NEEDS_ITEM), because it would move the
  // control account while stock stood still. Filtering it out means the user is
  // never offered the one choice that cannot work.
  const accountOptions = useMemo(() => {
    const assetSubTypes = ['Fixed Asset', 'Prepaid', 'Other Asset', 'fixed_asset'];
    return accounts
      .filter(a => {
        if (!a.isActive) return false;
        if (a.type === 'expense') return true;
        return a.type === 'asset' && assetSubTypes.includes(String(a.subType));
      })
      .map(a => ({ label: `${a.code} — ${a.name}`, value: a.id }));
  }, [accounts]);

  // Returning stock credits it at what the books carry it at, so the amount is
  // derived from the item's cost rather than typed — a hand-entered figure
  // would credit Inventory by one number while stock moved by another.
  const selectItem = (i: number, itemId: string) => {
    const item = items.find(x => (x.itemId ?? x.id) === itemId);
    if (!item) { updateLine(i, { itemId: '', quantity: '' }); return; }
    const qty = parseFloat(lines[i].quantity) || 1;
    updateLine(i, {
      itemId,
      // Cleared deliberately: this leg now posts to Inventory, and leaving a
      // stale account behind would send a field the API ignores while the form
      // still showed it as chosen.
      accountId: '',
      quantity: String(qty),
      description: lines[i].description.trim() || item.name,
      amount: String(Math.round(qty * item.unitCost * 100) / 100),
    });
  };

  const setQty = (i: number, value: string) => {
    const line = lines[i];
    const item = items.find(x => (x.itemId ?? x.id) === line.itemId);
    const qty = parseFloat(value) || 0;
    updateLine(i, item
      ? { quantity: value, amount: String(Math.round(qty * item.unitCost * 100) / 100) }
      : { quantity: value });
  };

  const totals = useMemo(() => vendorCreditTotals(lines), [lines]);

  const updateLine = (i: number, patch: Partial<LineDraft>) =>
    setLines(prev => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = async () => {
    if (!vendorId) { Toast.show({ type: 'error', text1: 'Missing vendor', text2: 'Please select a vendor.' }); return; }

    const valid = lines.filter(l => l.description.trim() && parseFloat(l.amount) > 0);
    if (valid.length === 0) { Toast.show({ type: 'error', text1: 'No items', text2: 'Add at least one credit line with an amount.' }); return; }

    // Called out rather than dropped. A line carrying an amount with no
    // description used to be filtered away silently, so a figure the user had
    // typed vanished and the credit posted short of what the supplier owed.
    const missingDescription = lines.some(l => !l.description.trim() && parseFloat(l.amount) > 0);
    if (missingDescription) {
      Toast.show({ type: 'error', text1: 'A line needs a description', text2: 'Every line with an amount has to say what it is for.' });
      return;
    }

    // The API allows a blank quantity but relieves stock BY it, so a returned
    // item with none would take nothing off the shelf.
    const missingQuantity = valid.some(l => l.itemId && !(parseFloat(l.quantity) > 0));
    if (missingQuantity) {
      Toast.show({ type: 'error', text1: 'A returned item needs a quantity', text2: 'Say how many units are going back to the supplier.' });
      return;
    }

    const taxError = lineTaxError(lines);
    if (taxError) {
      Toast.show({ type: 'error', text1: 'Check the tax %', text2: taxError });
      return;
    }

    setSaving(true);
    try {
      const res: any = await createVendorCreditAPI({
        vendorId, date, reason: reason || undefined,
        lines: valid.map(vendorCreditLineToPayload),
      });

      // Staff get a pending request, not a credit. Nothing has been credited to
      // the supplier and no stock has moved, and going back in silence had them
      // believe otherwise — and re-enter it.
      if (res?.data?.pending ?? res?.pending) {
        Toast.show({
          type: 'success',
          text1: 'Sent to the owner for approval',
          text2: 'Nothing is credited until they approve it.',
        });
      }
      navigation.goBack();
    } catch (e: any) { Toast.show({ type: 'error', text1: 'Save failed', text2: e?.message ?? 'Could not save vendor credit' }); }
    finally { setSaving(false); }
  };

  return (
    <ReportContainer>
      <ReportHeader title="New Vendor Credit" subtitle="Return / overcharge credit" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {creditCap.needsApproval && (
          <View style={styles.approvalBanner}>
            <Text style={styles.approvalBody}>
              This vendor credit goes to the owner for approval. Nothing is
              credited to the supplier and no stock moves until they approve it.
            </Text>
          </View>
        )}

        <Card>
          <CustomDropdown label="Vendor" placeholder="Select vendor"
            options={vendors.map((v: any) => ({ label: v.name, value: v.id }))} value={vendorId} onChange={setVendorId} />
          <DateField label="Date" value={date} onChangeText={setDate} />
          <CustomInput label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. overcharge / returned stock" />
        </Card>

        <SectionCard title="Credit Lines" icon="list">
          {lines.map((l, i) => (
            <View key={i} style={styles.lineRow}>
              <View style={styles.lineMain}>
                <CustomDropdown
                  label={`Line ${i + 1} — returned item`}
                  placeholder="Select item (or leave blank)"
                  options={itemOptions}
                  value={l.itemId}
                  onChange={v => selectItem(i, v)}
                  searchable
                />
                {!!l.itemId && (
                  <CustomInput label="Quantity returned" value={l.quantity} onChangeText={v => setQty(i, v)} keyboardType="numeric" />
                )}
                {/* Only one of the two ever applies, so only one is shown. An
                    item line credits Inventory; anything else credits the
                    account the original bill was coded to — and without this
                    the API silently fell back to COGS. */}
                {!l.itemId && (
                  <CustomDropdown
                    label="Credit to account"
                    placeholder="Select account (defaults to Cost of Goods Sold)"
                    options={accountOptions}
                    value={l.accountId}
                    onChange={v => updateLine(i, { accountId: v })}
                    searchable
                  />
                )}
                <CustomInput label="Description" value={l.description} onChangeText={v => updateLine(i, { description: v })} placeholder="Description" />
                <View style={styles.lineNumRow}>
                  <View style={styles.amountCol}>
                    <CustomInput
                      label={l.itemId ? 'Amount (at cost)' : 'Amount'}
                      value={l.amount}
                      onChangeText={v => updateLine(i, { amount: v })}
                      keyboardType="numeric"
                      disabled={!!l.itemId}
                    />
                  </View>
                  <View style={styles.taxCol}>
                    <TaxField value={l.taxRate} onChange={v => updateLine(i, { taxRate: v })} />
                  </View>
                </View>
                {parseFloat(l.taxRate) > 0 && (
                  <Text style={styles.costHint}>
                    Line with tax {rs((parseFloat(l.amount) || 0) * (1 + (parseFloat(l.taxRate) || 0) / 100))}
                    {' '}· reverses the input tax claimed on the original bill.
                  </Text>
                )}
                {!!l.itemId && (
                  <Text style={styles.costHint}>Credited at the cost your books carry, so stock and Inventory stay in step.</Text>
                )}
              </View>
              {lines.length > 1 && (
                <TouchableOpacity onPress={() => setLines(prev => prev.filter((_, idx) => idx !== i))} style={styles.del}>
                  <Feather name="trash-2" size={16} color={THEME.colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <AddButton label="Add Line" onPress={() => setLines(prev => [...prev, blankLine()])} />
        </SectionCard>

        {/* Three figures, not one. The supplier's credit note is for the gross,
            so a single "Total Credit" gave nothing to reconcile against. */}
        <Card>
          <Row label="Subtotal" value={rs(totals.subtotal)} />
          <Row label="Input tax reversed" value={rs(totals.tax)} />
          <Row label="Total Credit" value={rs(totals.total)} strong />
        </Card>

        <CustomButton
          title={creditCap.submitLabel('Record Vendor Credit')}
          onPress={save}
          isLoading={saving}
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
  content: { padding: 16, gap: 14 },
  approvalBanner: {
    backgroundColor: THEME.colors.warningLighter,
    borderRadius: THEME.radius.md,
    padding: THEME.spacing.md,
  },
  approvalBody: { ...THEME.typography.bodySm, color: THEME.colors.textPrimary },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: THEME.colors.borderLight },
  costHint: { ...THEME.typography.caption, color: THEME.colors.textTertiary, marginTop: -4, marginBottom: 8 },
  lineMain: { flex: 1 },
  // Amount and tax share a row, the same pairing the bill and invoice lines use.
  lineNumRow: { flexDirection: 'row', alignItems: 'flex-start' },
  amountCol: { flex: 1, minWidth: 132, marginRight: THEME.spacing.xs },
  taxCol: { flex: 1 },
  del: { paddingTop: 28, paddingHorizontal: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { ...THEME.typography.bodySm, color: THEME.colors.textSecondary },
  totalValue: { ...THEME.typography.labelMd, color: THEME.colors.textPrimary },
  bold: { ...THEME.typography.labelLg, color: THEME.colors.textPrimary },
});

export default VendorCreditFormScreen;
