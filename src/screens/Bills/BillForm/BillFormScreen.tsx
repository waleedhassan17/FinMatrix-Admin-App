// ═══════════════════════════════════════════════════════
// FinMatrix — Bill Form Screen (Create / Edit)
// Premium Enterprise UI
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import dayjs from 'dayjs';

import { THEME } from '../../../utils/theme';
const PANEL = THEME.form.summaryPanel;
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  selectBillFormState,
  setBillField,
  setBillVendor,
  setBillErrors,
  addBillLine,
  removeBillLine,
  updateBillLine,
  setBillLineAccount,
  calculateBillTotals,
  resetBillForm,
  saveBill,
  fetchBillForEdit,
  type BillFormLine,
} from './billFormSlice';
import { selectBills, fetchBills, upsertBill } from '../BillList/billListSlice';
import { fetchVendors, selectVendors } from '../../Vendors/VendorList/vendorListSlice';
import { fetchAccounts, selectAccounts } from '../../ChartOfAccounts/COAList/coaListSlice';
import CustomInput from '../../../Custom-Components/CustomInput';
import { DateField, ReportHeader, HEADER_NAVY } from '../../../components/reports/ReportUI';
import CustomDropdown from '../../../Custom-Components/CustomDropdown';
import {
  AddButton,
  FormSectionHeader,
  PrimaryButton,
  SecondaryButton,
} from '../../../components/form/FormUI';
import CustomButton from '../../../Custom-Components/CustomButton';
import TaxField from '../../../components/form/TaxField';
import { lineTaxError } from '../../../models/taxRate';
import { formatCurrency } from '../../../utils/formatters';
import type { BillStatus } from '../../../types';
import type { TransactionsStackParamList } from '../../../navigators/stacks/TransactionsStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
type FormRoute = RouteProp<TransactionsStackParamList, 'BillForm'>;

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const BillFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<FormRoute>();
  const dispatch = useAppDispatch();

  const editingId = route.params?.billId;
  const isEditing = !!editingId;
  const bills = useAppSelector(selectBills);
  const vendors = useAppSelector(selectVendors);
  const accounts = useAppSelector(selectAccounts);
  const form = useAppSelector(selectBillFormState);
  const hydratedRef = React.useRef(false);

  // ── Vendor dropdown options ─────────────────────
  const vendorOptions = useMemo(
    () =>
      vendors
        .filter(v => v.isActive)
        .map(v => ({ label: v.name, value: v.id })),
    [vendors],
  );

  // ── COA account options (backend chart of accounts) ──
  // QuickBooks-style bill categories: every expense account (incl. COGS)
  // plus purchasable assets (Inventory, Fixed Asset, Prepaid, Other Asset).
  const accountOptions = useMemo(() => {
    const assetSubTypes = ['Inventory', 'Fixed Asset', 'Prepaid', 'Other Asset', 'fixed_asset'];
    return accounts
      .filter(a => {
        if (!a.isActive) return false;
        if (a.type === 'expense') return true;
        return a.type === 'asset' && assetSubTypes.includes(String(a.subType));
      })
      .map(a => ({ label: `${a.code} — ${a.name}`, value: a.id }));
  }, [accounts]);

  // ── Auto-generate bill number ───────────────────
  const generateBillNumber = useCallback(() => {
    const maxNum = bills.reduce((max, b) => {
      const match = b.billNumber.match(/BILL-(\d+)/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `BILL-${String(maxNum + 1).padStart(4, '0')}`;
  }, [bills]);

  // ── Load data on mount ──────────────────
  useEffect(() => {
    dispatch(fetchVendors());
    dispatch(fetchAccounts());

    if (hydratedRef.current) return;
    hydratedRef.current = true;

    if (isEditing && editingId) {
      dispatch(fetchBillForEdit(editingId));
    } else {
      dispatch(setBillField({ key: 'billNumber', value: generateBillNumber() }));
      // Today, read now rather than whenever the bundle started — the slice's
      // initialState is evaluated once, so a long-running app would post the
      // launch date as this document's accounting date.
      dispatch(setBillField({ key: 'issueDate', value: dayjs().format('YYYY-MM-DD') }));
      dispatch(setBillField({ key: 'dueDate', value: dayjs().add(30, 'day').format('YYYY-MM-DD') }));
      // Preselect the vendor when launched from a vendor's detail screen.
      const preVendorId = route.params?.vendorId;
      if (preVendorId) {
        dispatch(setBillField({ key: 'vendorId', value: preVendorId }));
      }
    }

    return () => { dispatch(resetBillForm()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editingId, dispatch]);

  // ── Vendor change handler ───────────────────────
  const handleVendorChange = useCallback(
    (vendorId: string) => {
      const vendor = vendors.find(v => v.id === vendorId);
      if (!vendor) return;
      dispatch(setBillVendor({ id: vendor.id, name: vendor.name }));

      const termDays: Record<string, number> = {
        net_15: 15, net_30: 30, net_45: 45, net_60: 60, due_on_receipt: 0,
      };
      const days = termDays[vendor.paymentTerms] ?? 30;
      dispatch(setBillField({ key: 'dueDate', value: dayjs(form.issueDate).add(days, 'day').format('YYYY-MM-DD') }));
    },
    [vendors, dispatch, form.issueDate],
  );

  // ── Account change for a line ───────────────────
  const handleAccountChange = useCallback(
    (lineId: string, accountId: string) => {
      const acct = accounts.find(a => a.id === accountId);
      if (acct) {
        dispatch(setBillLineAccount({ lineId, accountId: acct.id, accountName: acct.name }));
      }
    },
    [accounts, dispatch],
  );

  // ── Validation ──────────────────────────────────
  const validate = useCallback((): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.vendorId) errs.vendorId = 'Select a vendor';
    if (!form.billNumber.trim()) errs.billNumber = 'Bill number is required';
    if (!form.issueDate) errs.issueDate = 'Issue date is required';
    if (!form.dueDate) errs.dueDate = 'Due date is required';
    if (form.lines.length === 0) errs.lines = 'At least one line item is required';

    const hasEmptyLine = form.lines.some(
      l => !l.accountId || !(parseFloat(l.amount) > 0),
    );
    const taxError = lineTaxError(form.lines);
    if (hasEmptyLine) errs.lines = 'All line items must have an account and amount';
    else if (taxError) errs.lines = taxError;

    return errs;
  }, [form]);

  // ── Save ────────────────────────────────────────
  const handleSave = useCallback(
    async (saveStatus: BillStatus = 'draft') => {
      const validationErrors = validate();
      if (Object.keys(validationErrors).length > 0) {
        dispatch(setBillErrors(validationErrors));
        Toast.show({ type: 'error', text1: 'Validation Error', text2: Object.values(validationErrors)[0] });
        return;
      }

      dispatch(calculateBillTotals());

      try {
        const result: any = await dispatch(saveBill(saveStatus));
        if (result.error) throw new Error(result.error.message);
        const saved = result.payload;
        if (saved) dispatch(upsertBill(saved));
        await dispatch(fetchBills());

        Toast.show({
            type: 'success',
            text1: isEditing ? 'Bill Updated' : 'Bill Created',
            text2: `${form.billNumber} has been ${isEditing ? 'updated' : 'created'} as ${saveStatus}.`,
          });
          navigation.goBack();
      } catch (e: any) {
        Toast.show({ type: 'error', text1: 'Error', text2: e?.message || 'Failed to save bill. Please try again.' });
      }
    },
    [form, isEditing, dispatch, navigation, validate],
  );

  // ═════════════════════════════════════════════════════
  // RENDER LINE ITEM
  // ═════════════════════════════════════════════════════
  const renderLineItem = useCallback(
    (line: BillFormLine, idx: number) => (
      <View key={line.id} style={styles.lineCard}>
        <View style={[styles.lineCardAccent, { backgroundColor: idx % 2 === 0 ? colors.danger : colors.secondary }]} />
        <View style={styles.lineCardBody}>
          <View style={styles.lineHeader}>
            <View style={styles.lineBadge}>
              <Text style={styles.lineBadgeText}>{idx + 1}</Text>
            </View>
            <Text style={styles.lineLabel}>Line Item</Text>
            {form.lines.length > 1 && (
              <TouchableOpacity
                style={styles.lineDeleteBtn}
                onPress={() => dispatch(removeBillLine(line.id))}
              >
                <Feather name="trash-2" size={14} color={colors.danger} />
              </TouchableOpacity>
            )}
          </View>

          <CustomDropdown
            label="Account *"
            options={accountOptions}
            value={line.accountId}
            onChange={v => handleAccountChange(line.id, v)}
            placeholder="Select expense account…"
            searchable
          />

          <TextInput
            style={styles.descInput}
            value={line.description}
            onChangeText={v => dispatch(updateBillLine({ id: line.id, field: 'description', value: v }))}
            placeholder="Description"
            placeholderTextColor={colors.textTertiary}
          />

          <View style={styles.lineNumRow}>
            <View style={{ flex: 1, minWidth: 132, marginRight: spacing.xs }}>
              <Text style={styles.fieldLabel}>Amount (Rs)</Text>
              <TextInput
                style={styles.numericInput}
                value={line.amount}
                onChangeText={v =>
                  dispatch(updateBillLine({ id: line.id, field: 'amount', value: v.replace(/[^0-9.]/g, '') }))
                }
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>
            {/* TaxField, not CustomDropdown. The dropdown brought its own
                label role, its own 48px field and a bottom margin, so beside
                the hand-built Amount column the two shared neither a top nor a
                bottom edge. This is the same control the invoice lines use. */}
            <View style={{ flex: 1 }}>
              <TaxField
                value={line.taxRate}
                onChange={v => dispatch(updateBillLine({ id: line.id, field: 'taxRate', value: v }))}
              />
            </View>
          </View>

          <View style={styles.lineTotalRow}>
            <Feather name="arrow-right" size={12} color={colors.actionGreen} />
            <Text style={styles.lineTotal}>
              {formatCurrency(
                (parseFloat(line.amount) || 0) * (1 + (parseFloat(line.taxRate) || 0) / 100),
                'Rs ',
              )}
            </Text>
          </View>
        </View>
      </View>
    ),
    [form.lines.length, accountOptions, dispatch, handleAccountChange],
  );

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, styles.safeTop]} edges={['top']}>
      {/* ── Premium Gradient Header ─────────────────── */}
      <ReportHeader
        title={isEditing ? `Edit ${form.billNumber}` : 'New Bill'}
        subtitle={isEditing ? 'Update bill details' : 'Record a vendor expense'}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.neutral100 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Section: Vendor & Dates ──────────────── */}
          <FormSectionHeader title="BILL DETAILS" dotColor={colors.danger} />
          <View style={styles.sectionCard}>
            <View style={[styles.cardAccent, { backgroundColor: colors.danger }]} />
            <View style={styles.cardBody}>
              <CustomDropdown
                label="Vendor *"
                options={vendorOptions}
                value={form.vendorId}
                onChange={handleVendorChange}
                placeholder="Select vendor…"
                error={form.errors.vendorId}
                searchable
              />
              <CustomInput
                label="Bill #"
                value={form.billNumber}
                onChangeText={v => dispatch(setBillField({ key: 'billNumber', value: v }))}
                placeholder="BILL-0000"
                error={form.errors.billNumber}
                disabled={isEditing}
              />
              <View style={styles.rowFields}>
                <View style={{ flex: 1, marginRight: spacing.xs }}>
                  <DateField
                    label="Issue Date *"
                    value={form.issueDate}
                    onChangeText={v => dispatch(setBillField({ key: 'issueDate', value: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  {/* Due date is a future date → allow dates after today; never
                      before the issue date. */}
                  <DateField
                    label="Due Date *"
                    value={form.dueDate}
                    onChangeText={v => dispatch(setBillField({ key: 'dueDate', value: v }))}
                    minimumDate={form.issueDate ? new Date(form.issueDate) : undefined}
                    maximumDate={new Date(2100, 11, 31)}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* ── Section: Line Items ──────────────────── */}
          <FormSectionHeader
            title="LINE ITEMS"
            dotColor={colors.secondary}
            right={<AddButton label="Add Line" onPress={() => dispatch(addBillLine())} />}
          />
          {form.errors.lines && (
            <Text style={styles.lineError}>{form.errors.lines}</Text>
          )}

          {form.lines.map((line, idx) => renderLineItem(line, idx))}

          {/* ── Section: Notes ───────────────────────── */}
          <FormSectionHeader title="NOTES" dotColor={colors.secondary} />
          <View style={styles.sectionCard}>
            <View style={[styles.cardAccent, { backgroundColor: colors.secondary }]} />
            <View style={styles.cardBody}>
              <CustomInput
                label="Notes"
                value={form.notes}
                onChangeText={v => dispatch(setBillField({ key: 'notes', value: v }))}
                placeholder="Additional notes for this bill…"
                multiline
              />
            </View>
          </View>

          {/* ── Premium Totals Panel ─────────────────── */}
          <LinearGradient
            colors={PANEL.gradient}
            style={styles.totalsCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.totalsHeader}>
              <Feather name="credit-card" size={16} color={PANEL.accent} />
              <Text style={styles.totalsHeaderText}>Bill Summary</Text>
            </View>
            <View style={styles.totalsDivider} />
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{formatCurrency(form.subtotal, 'Rs ')}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>{formatCurrency(form.taxAmount, 'Rs ')}</Text>
            </View>
            <View style={styles.totalsDivider} />
            <View style={styles.totalsRow}>
              <Text style={styles.grandTotalLabel}>Grand Total</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(form.total, 'Rs ')}</Text>
            </View>
          </LinearGradient>

          {/* ── Action Buttons ───────────────────────── */}
          <View style={styles.btnRow}>
            <View style={{ flex: 1, marginRight: spacing.xs }}>
              <SecondaryButton
                title="Save Draft"
                onPress={() => handleSave('draft')}
                disabled={form.isSaving}
                icon={<Feather name="save" size={16} color={colors.actionGreen} />}
              />
            </View>
            <View style={{ flex: 1.4 }}>
              <PrimaryButton
                title={form.isSaving ? 'Saving…' : isEditing ? 'Update & Open' : 'Save & Open'}
                onPress={() => handleSave('open')}
                isLoading={form.isSaving}
                icon={<Feather name="check-circle" size={16} color={colors.neutral0} />}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral100 },
  safeTop: { backgroundColor: HEADER_NAVY[0] },

  // paddingTop 0 — FormSectionHeader's marginTop supplies it (see FormUI).
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: 0, paddingBottom: spacing.xxl },

  sectionCard: {
    flexDirection: 'row', backgroundColor: colors.neutral0, borderRadius: radius.lg,
    overflow: 'hidden', ...shadows.xs, borderWidth: 1, borderColor: colors.neutral200,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: spacing.md },
  rowFields: { flexDirection: 'row' },

  lineError: { ...typography.caption, color: colors.danger, marginBottom: spacing.xs },

  // ── Line Item Card ──────────────────────────────
  lineCard: {
    flexDirection: 'row', backgroundColor: colors.neutral0, borderRadius: radius.lg,
    overflow: 'hidden', marginBottom: spacing.xs, ...shadows.xs,
    borderWidth: 1, borderColor: colors.neutral200,
  },
  lineCardAccent: { width: 4 },
  lineCardBody: { flex: 1, padding: spacing.md },
  lineHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.xxs },
  lineBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.neutral100, alignItems: 'center', justifyContent: 'center',
  },
  lineBadgeText: { ...typography.overline, color: colors.neutral500 },
  lineLabel: { flex: 1, ...typography.labelMd, color: colors.textSecondary },
  lineDeleteBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.dangerLight, justifyContent: 'center', alignItems: 'center',
  },

  descInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.xs, paddingVertical: spacing.xs,
    ...THEME.typography.bodyMd, color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  lineNumRow: { flexDirection: 'row', marginBottom: spacing.xxs, flexWrap: 'wrap', rowGap: spacing.xxs },
  fieldLabel: { ...typography.labelSm, color: colors.textSecondary, marginBottom: spacing.xxs },
  numericInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.xs, paddingVertical: spacing.xs,
    ...THEME.typography.bodyMd, color: colors.textPrimary,
  },
  lineTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: spacing.xxs },
  lineTotal: { ...typography.h5, color: colors.actionGreen, fontVariant: ['tabular-nums'] },

  // ── Totals ─────────────────────────────────────
  totalsCard: { borderRadius: radius.lg + 4, padding: spacing.md + 4, marginTop: spacing.xl, ...shadows.md },
  totalsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs + 2, marginBottom: spacing.xs },
  totalsHeaderText: { ...typography.labelMd, color: PANEL.accent, letterSpacing: 0.5 },
  totalsDivider: { height: 1, backgroundColor: PANEL.divider, marginVertical: spacing.xxs + 2 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xxs + 2 },
  // h5's 14px at body weight -- the label is quieter than the value beside it.
  totalsLabel: { ...typography.h5, fontWeight: typography.bodyMd.fontWeight, color: PANEL.label },
  totalsValue: { ...typography.h5, color: PANEL.text, fontVariant: ['tabular-nums'] },
  grandTotalLabel: { ...typography.h4, color: PANEL.accent },
  grandTotalValue: { ...typography.h2, color: colors.neutral0, fontVariant: ['tabular-nums'] },

  btnRow: { flexDirection: 'row', marginTop: spacing.xl, marginBottom: spacing.md },
});

export default BillFormScreen;
