// ═══════════════════════════════════════════════════════
// FinMatrix — Pay Bills Screen
// Premium Enterprise UI
// ═══════════════════════════════════════════════════════

import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '../../../utils/alert';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import { THEME } from '../../../utils/theme';
const PANEL = THEME.form.summaryPanel;
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  selectPayBillsState,
  setPayBillField,
  setPayBillVendor,
  toggleBillCheck,
  payAllBills,
  setBillAllocation,
  toggleAllBills,
  toggleBillCredit,
  fetchVendorCreditsForPayment,
  preselectBill,
  setPayBillErrors,
  resetPayBills,
  fetchAllBillsForPayment,
  savePayment,
  clearPaymentProof,
  uploadPaymentProof,
  selectPayBillProof,
} from './payBillsSlice';
import { fetchVendors, selectVendors } from '../../Vendors/VendorList/vendorListSlice';
import { fetchBills } from '../BillList/billListSlice';
import { fetchAccounts, selectAccounts } from '../../ChartOfAccounts/COAList/coaListSlice';
import CustomInput from '../../../Custom-Components/CustomInput';
import CustomButton from '../../../Custom-Components/CustomButton';
import CustomDropdown from '../../../Custom-Components/CustomDropdown';
import { PrimaryButton, SecondaryButton } from '../../../components/form/FormUI';
import { DateField, ReportHeader, HEADER_NAVY, LoadingBlock } from '../../../components/reports/ReportUI';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import type { PaymentMethod } from '../../../types';
import type { TransactionsStackParamList } from '../../../navigators/stacks/TransactionsStack';
import Toast from 'react-native-toast-message';
import { useCapability } from '../../../hooks/useCapability';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
type PayRoute = RouteProp<TransactionsStackParamList, 'PayBills'>;

const METHOD_OPTIONS = [
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Cash', value: 'cash' },
  { label: 'Cheque', value: 'cheque' },
  { label: 'Online (EasyPaisa / JazzCash)', value: 'online' },
];

// ═══════════════════════════════════════════════════════
const PayBillsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<PayRoute>();
  const dispatch = useAppDispatch();

  const preVendorId = route.params?.vendorId;
  const preBillId = route.params?.billId;

  const form = useAppSelector(selectPayBillsState);
  const proof = useAppSelector(selectPayBillProof);
  const vendors = useAppSelector(selectVendors);
  const accounts = useAppSelector(selectAccounts);

  const vendorOptions = useMemo(
    () => vendors.filter(v => v.isActive).map(v => ({ label: v.name, value: v.id })),
    [vendors],
  );

  // Cash/Bank asset accounts from the backend chart of accounts —
  // the payment source QuickBooks lets you pick when paying bills.
  const payableAccounts = useMemo(
    () => accounts.filter(a => a.isActive && a.type === 'asset' && ['Cash', 'Bank'].includes(String(a.subType))),
    [accounts],
  );

  // Show what each account actually holds. Paying from an account without the
  // funds is legitimate for a bank (an overdraft), but for Cash it means the
  // books claim you handed over notes you did not have — and it is invisible
  // until the balance is already negative.
  const bankAccountOptions = useMemo(
    () =>
      payableAccounts.map(a => ({
        label: `${a.name} (${a.code}) · ${formatCurrency(a.balance, 'Rs ')}`,
        value: a.id,
      })),
    [payableAccounts],
  );

  const generatePaymentNumber = useCallback(() => `BPAY-${String(Date.now()).slice(-6)}`, []);

  useEffect(() => {
    dispatch(fetchVendors());
    dispatch(fetchAccounts());
    dispatch(fetchAllBillsForPayment());
    dispatch(setPayBillField({ key: 'reference', value: generatePaymentNumber() }));
    // Today, read now rather than whenever the bundle started. This one is the
    // sharpest of the set: paymentDate becomes the accounting date of a posted
    // cash payment, so a stale value writes money out of the bank on the wrong day.
    dispatch(setPayBillField({ key: 'paymentDate', value: dayjs().format('YYYY-MM-DD') }));
    return () => { dispatch(resetPayBills()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    if (preVendorId && !form.vendorId && form.allBills.length > 0 && vendors.length > 0) {
      const vendor = vendors.find(v => v.id === preVendorId);
      if (vendor) dispatch(setPayBillVendor({ id: vendor.id, name: vendor.name }));
    }
  }, [preVendorId, form.vendorId, form.allBills, vendors, dispatch]);

  useEffect(() => {
    if (preBillId && form.outstandingRows.length > 0) dispatch(preselectBill(preBillId));
  }, [preBillId, form.outstandingRows.length, dispatch]);

  const handleVendorChange = useCallback(
    (vendorId: string) => {
      const vendor = vendors.find(v => v.id === vendorId);
      if (!vendor) return;
      dispatch(setPayBillVendor({ id: vendor.id, name: vendor.name }));
    },
    [vendors, dispatch],
  );

  const totalAllocated = useMemo(
    () => form.outstandingRows.reduce((s, r) => s + r.allocated, 0),
    [form.outstandingRows],
  );

  const paymentAmount = parseFloat(form.amount) || 0;
  useEffect(() => {
    if (form.vendorId) dispatch(fetchVendorCreditsForPayment(form.vendorId));
  }, [form.vendorId, dispatch]);

  const creditTotal = form.availableCredits.reduce((sum, c) => sum + c.balance, 0);
  const creditUsed = form.outstandingRows.reduce((sum, r) => sum + r.creditApplied, 0);
  const creditLeft = Math.round((creditTotal - creditUsed) * 100) / 100;
  const checkedCount = form.outstandingRows.filter(r => r.checked).length;
  const allChecked = form.outstandingRows.length > 0 && checkedCount === form.outstandingRows.length;
  const payFromAccount = useMemo(
    () => payableAccounts.find(a => a.id === form.bankAccountId),
    [payableAccounts, form.bankAccountId],
  );

  // Cash is leaving the account, so evidence is required. A credit-only
  // settlement moves none and posts nothing.
  const needsProof = totalAllocated > 0;

  const overdraw = useMemo(() => {
    const acct = payableAccounts.find(a => a.id === form.bankAccountId);
    if (!acct || totalAllocated <= 0 || totalAllocated <= acct.balance) return null;
    return {
      name: acct.name,
      balance: acct.balance,
      shortfall: Math.round((totalAllocated - acct.balance) * 100) / 100,
    };
  }, [payableAccounts, form.bankAccountId, totalAllocated]);

  const validate = useCallback((): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.vendorId) errs.vendorId = 'Select a vendor';
    if (!form.bankAccountId) errs.bankAccountId = 'Select a bank account';
    if (!form.paymentDate) errs.paymentDate = 'Payment date is required';
    // The total IS the sum of the rows, so there is no separate amount to
    // validate and no way to overpay.
    const creditOnly = form.outstandingRows.some(r => r.creditApplied > 0);
    if (totalAllocated <= 0 && !creditOnly) {
      errs.allocations = 'Enter an amount against at least one bill';
    }
    // A credit-only settlement moves no cash, so no account is needed.
    if (totalAllocated <= 0 && creditOnly) delete errs.bankAccountId;
    return errs;
  }, [form, totalAllocated]);

  // ── Payment proof ───────────────────────────────
  // Uploaded the moment it is picked, so by the time Record Payment is
  // pressable the file is already durable on the server. The button below
  // stays disabled until `proof.id` exists — not merely until a file is
  // chosen — so a payment can never be recorded against a failed upload.
  const startUpload = useCallback(
    (file: { uri: string; name: string; mimeType: string }) => {
      dispatch(uploadPaymentProof(file));
    },
    [dispatch],
  );

  const pickImage = useCallback(
    async (fromCamera: boolean) => {
      const perm = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          fromCamera ? 'Camera access needed' : 'Photo access needed',
          'Allow access so the receipt can be attached to this payment.',
        );
        return;
      }
      const res = fromCamera
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      startUpload({
        uri: a.uri,
        name: a.fileName ?? `receipt-${Date.now()}.jpg`,
        mimeType: a.mimeType ?? 'image/jpeg',
      });
    },
    [startUpload],
  );

  const pickDocument = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    startUpload({
      uri: a.uri,
      name: a.name ?? `proof-${Date.now()}`,
      mimeType: a.mimeType ?? 'application/pdf',
    });
  }, [startUpload]);

  const chooseProof = useCallback(() => {
    Alert.alert('Attach payment proof', 'Where is the receipt?', [
      { text: 'Take a photo', onPress: () => pickImage(true) },
      { text: 'Choose a photo', onPress: () => pickImage(false) },
      { text: 'Choose a PDF', onPress: pickDocument },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [pickImage, pickDocument]);

  // Cash leaving the bank: staff send it to the owner, who approves before
  // any money moves.
  const payCap = useCapability('bill.pay');

  const handleSave = useCallback(async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      dispatch(setPayBillErrors(validationErrors));
      Alert.alert('Validation Error', Object.values(validationErrors)[0]);
      return;
    }

    const allocations = form.outstandingRows
      .filter(r => r.allocated > 0 || r.creditApplied > 0)
      .map(r => ({ billId: r.billId, billNumber: r.billNumber, amount: r.allocated }));

    try {
      const reference = form.reference || generatePaymentNumber();
      const saved: any = await dispatch(
        savePayment({ paymentNumber: reference, allocations }),
      ).unwrap();
      await dispatch(fetchBills());

      // Paying a bill is the cash-out moment, so staff file a request instead.
      // No money has moved, so the payment RECEIPT below would be a lie — and
      // worse, it reads as proof the supplier was paid.
      if (saved?.data?.pending ?? saved?.pending) {
        Toast.show({
          type: 'success',
          text1: 'Sent to the owner for approval',
          text2: 'The bill stays unpaid until they approve the payment.',
        });
        navigation.goBack();
        return;
      }

      // `replace`, not `navigate`: the receipt takes this screen's place so
      // Back cannot return to a filled-in form and post the payment twice.
      navigation.replace('PaymentSuccess', {
        amount: totalAllocated,
        creditApplied: creditUsed,
        vendorName: form.vendorName,
        accountName: payFromAccount?.name ?? '',
        paymentDate: form.paymentDate,
        reference,
        method: form.method,
        billId: preBillId,
        lines: allocations.map(a => {
          const row = form.outstandingRows.find(r => r.billId === a.billId);
          return {
            billNumber: a.billNumber,
            applied: a.amount + (row?.creditApplied ?? 0),
            remaining: Math.round(((row?.balance ?? 0) - a.amount - (row?.creditApplied ?? 0)) * 100) / 100,
          };
        }),
      });
    } catch (e: any) {
      // The API says exactly what is wrong (e.g. PAYMENT_EXCEEDS_BALANCE with
      // the amounts) — showing "try again" instead just hides it.
      Alert.alert('Error', e?.message || 'Failed to record payment. Please try again.');
    }
  }, [form, totalAllocated, payFromAccount, preBillId, dispatch, navigation, validate, generatePaymentNumber]);

  // ═════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, styles.safeTop]} edges={['top']}>
      <ReportHeader
        title={'Pay Bills'}
        subtitle={'Record a vendor payment'}
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.neutral100 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Payment Details ─────────────────────── */}
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionDot, { backgroundColor: colors.danger }]} />
            <Text style={styles.sectionTitle}>PAYMENT DETAILS</Text>
          </View>
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
              <CustomDropdown
                label="Pay from account *"
                options={bankAccountOptions}
                value={form.bankAccountId}
                onChange={v => dispatch(setPayBillField({ key: 'bankAccountId', value: v }))}
                placeholder="Select the account…"
                error={form.errors.bankAccountId}
              />
              <Text style={styles.fieldHint}>
                The account the money leaves — choose Cash for a cash payment. The
                method above is just how you paid.
              </Text>
              {/* A warning, not a block: a bank overdraft is a real thing. */}
              {!!overdraw && (
                <Text style={styles.overdrawNote}>
                  This pays {formatCurrency(totalAllocated, 'Rs ')} from {overdraw.name}, which holds{' '}
                  {formatCurrency(overdraw.balance, 'Rs ')}. It will go {formatCurrency(overdraw.shortfall, 'Rs ')} overdrawn.
                </Text>
              )}
              <View style={styles.rowFields}>
                <View style={{ flex: 1, marginRight: spacing.xs }}>
                  <DateField
                    label="Payment Date *"
                    value={form.paymentDate}
                    onChangeText={v => dispatch(setPayBillField({ key: 'paymentDate', value: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <CustomDropdown
                    label="Method"
                    options={METHOD_OPTIONS}
                    value={form.method}
                    onChange={v => dispatch(setPayBillField({ key: 'method', value: v as PaymentMethod }))}
                  />
                </View>
              </View>
              <CustomInput
                label="Reference / Cheque #"
                value={form.reference}
                onChangeText={v => dispatch(setPayBillField({ key: 'reference', value: v }))}
                placeholder="e.g. CHQ-12345"
              />
              <View style={styles.amountRow}>
                <View style={{ flex: 1, marginRight: spacing.xs }}>
                  <View style={styles.totalReadout}>
                    <Text style={styles.totalReadoutLabel}>Total payment</Text>
                    <Text style={styles.totalReadoutValue}>{formatCurrency(totalAllocated, 'Rs ')}</Text>
                    <Text style={styles.totalReadoutHint}>
                      Sum of the amounts you enter against each bill below.
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.payAllChip, form.outstandingRows.length === 0 && styles.payAllChipDisabled]}
                  onPress={() => dispatch(payAllBills())}
                  activeOpacity={0.7}
                  disabled={form.outstandingRows.length === 0}
                >
                  <Feather name="zap" size={14} color={colors.danger} />
                  <Text style={styles.payAllChipText}>Pay All</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── Outstanding Bills ─────────────────────── */}
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionDot, { backgroundColor: colors.secondary }]} />
            <Text style={styles.sectionTitle}>OUTSTANDING BILLS</Text>
          </View>

          {creditTotal > 0 && (
            <View style={styles.creditBanner}>
              <Feather name="gift" size={16} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={styles.creditBannerTitle}>
                  {formatCurrency(creditLeft, 'Rs ')} vendor credit available
                </Text>
                <Text style={styles.creditBannerHint}>
                  {creditUsed > 0
                    ? `${formatCurrency(creditUsed, 'Rs ')} applied — that much less cash leaves your account.`
                    : 'Tap "Use credit" on a bill to settle it without paying cash.'}
                </Text>
              </View>
            </View>
          )}

          {form.isLoadingBills ? (
            <LoadingBlock label="Loading outstanding bills…" />
          ) : form.outstandingRows.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBg}>
                <Feather name="file-text" size={20} color={colors.secondary} />
              </View>
              <Text style={styles.emptyTitle}>
                {form.vendorId ? 'No outstanding bills' : 'Select a vendor'}
              </Text>
              <Text style={styles.emptyText}>
                {form.vendorId
                  ? 'Everything from this vendor is settled. Nothing to pay.'
                  : 'Pick a vendor above to see their outstanding bills.'}
              </Text>
              {!!form.vendorId && (
                <View style={styles.emptyCta}>
                  <CustomButton
                    title="Create a bill"
                    onPress={() => navigation.push('BillForm', { vendorId: form.vendorId })}
                    variant="secondary"
                    size="sm"
                  />
                </View>
              )}
            </View>
          ) : (
            <>
              {form.errors.allocations && (
                <Text style={styles.errorText}>{form.errors.allocations}</Text>
              )}
              <View style={styles.tableWrap}>
                <View style={styles.tableHeader}>
                  <TouchableOpacity
                    style={styles.checkboxWrap}
                    onPress={() => dispatch(toggleAllBills())}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View style={[styles.checkbox, allChecked && styles.checkboxChecked]}>
                      {allChecked && <Feather name="check" size={13} color={colors.neutral0} />}
                    </View>
                  </TouchableOpacity>
                  <Text style={[styles.thText, { flex: 1.3 }]}>Bill</Text>
                  <Text style={[styles.thText, styles.thRight, { flex: 1 }]}>Bill Amt</Text>
                  <Text style={[styles.thText, styles.thRight, { flex: 1 }]}>Balance</Text>
                  <Text style={[styles.thText, styles.thRight, { width: 96 }]}>Amt To Pay</Text>
                </View>
                {form.outstandingRows.map((row, idx) => (
                  <View
                    key={row.billId}
                    style={[styles.tableRow, idx % 2 === 0 && styles.tableRowEven, row.checked && styles.tableRowChecked]}
                  >
                    <TouchableOpacity
                      style={styles.checkboxWrap}
                      onPress={() => dispatch(toggleBillCheck(row.billId))}
                      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                    >
                      <View style={[styles.checkbox, row.checked && styles.checkboxChecked]}>
                        {row.checked && <Feather name="check" size={13} color={colors.neutral0} />}
                      </View>
                    </TouchableOpacity>
                    <View style={{ flex: 1.3 }}>
                      <Text style={[styles.tdText, styles.tdStrong]} numberOfLines={1}>{row.billNumber}</Text>
                      <Text style={styles.tdSub}>Due {formatDate(row.dueDate)}</Text>
                    </View>
                    <Text style={[styles.tdText, styles.tdRight, { flex: 1 }]}>{formatCurrency(row.total, 'Rs ')}</Text>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.tdText}>{formatCurrency(row.balance, 'Rs ')}</Text>
                      {(creditTotal > 0 || row.creditApplied > 0) && (
                        <TouchableOpacity
                          onPress={() => dispatch(toggleBillCredit(row.billId))}
                          disabled={row.creditApplied === 0 && creditLeft <= 0}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text
                            style={[
                              styles.creditChip,
                              row.creditApplied > 0 && styles.creditChipOn,
                              row.creditApplied === 0 && creditLeft <= 0 && styles.creditChipOff,
                            ]}
                          >
                            {row.creditApplied > 0
                              ? `− ${formatCurrency(row.creditApplied, 'Rs ')} credit`
                              : 'Use credit'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {/* Editable per bill — this is what lets you settle a newer
                        bill in full while paying an older one in part. Clamped
                        to the balance in the reducer. */}
                    <TextInput
                      style={[styles.allocInput, row.allocated > 0 && styles.allocInputActive]}
                      value={row.allocated > 0 ? String(row.allocated) : ''}
                      onChangeText={(v: string) =>
                        dispatch(setBillAllocation({ billId: row.billId, value: v.replace(/[^0-9.]/g, '') }))
                      }
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                      editable={!form.isSaving}
                    />
                  </View>
                ))}
                <View style={styles.tableTotalRow}>
                  <Text style={styles.tableTotalLabel}>
                    {checkedCount} of {form.outstandingRows.length} bill{form.outstandingRows.length === 1 ? '' : 's'}
                  </Text>
                  <Text style={styles.tableTotalValue}>{formatCurrency(totalAllocated, 'Rs ')}</Text>
                </View>
              </View>
            </>
          )}

          {/* ── Summary ─────────────────────────────── */}
          {paymentAmount > 0 && (
            <LinearGradient
              colors={PANEL.gradient}
              style={styles.summaryCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.summaryHeader}>
                <Feather name="credit-card" size={16} color={PANEL.accent} />
                <Text style={styles.summaryHeaderText}>Payment Summary</Text>
              </View>
              <View style={styles.summaryDivider} />
              <SummaryRow label="Bills selected" value={String(checkedCount)} />
              {creditUsed > 0 && (
                <SummaryRow label="Vendor credit applied" value={`− ${formatCurrency(creditUsed, 'Rs ')}`} valueColor={PANEL.positive} />
              )}
              <SummaryRow label="Total payment" value={formatCurrency(totalAllocated, 'Rs ')} />
              {!!payFromAccount && (
                <SummaryRow
                  label={`${payFromAccount.name} after payment`}
                  value={formatCurrency(payFromAccount.balance - totalAllocated, 'Rs ')}
                  valueColor={payFromAccount.balance - totalAllocated < 0 ? PANEL.caution : undefined}
                />
              )}
            </LinearGradient>
          )}

          {/* ── Notes ────────────────────────────────── */}
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionDot, { backgroundColor: colors.secondary }]} />
            <Text style={styles.sectionTitle}>NOTES</Text>
          </View>
          <View style={styles.sectionCard}>
            <View style={[styles.cardAccent, { backgroundColor: colors.secondary }]} />
            <View style={styles.cardBody}>
              <CustomInput
                label="Payment Notes"
                value={form.notes}
                onChangeText={v => dispatch(setPayBillField({ key: 'notes', value: v }))}
                placeholder="Optional notes…"
                multiline
              />
            </View>
          </View>

          {/* ── Payment proof ────────────────────────── */}
          <View style={styles.sectionLabelRow}>
            <View style={[styles.sectionDot, { backgroundColor: colors.info }]} />
            <Text style={styles.sectionTitle}>PAYMENT PROOF</Text>
          </View>
          <View style={styles.sectionCard}>
            <View style={[styles.cardAccent, { backgroundColor: colors.info }]} />
            <View style={styles.cardBody}>
              <Text style={styles.proofHelp}>
                Attach a receipt, bank confirmation, or a photo of the cash voucher.
              </Text>

              {!proof.localUri ? (
                <TouchableOpacity style={styles.proofPick} onPress={chooseProof} activeOpacity={0.75}>
                  <Feather name="paperclip" size={16} color={colors.actionGreen} />
                  <Text style={styles.proofPickText}>Attach proof</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.proofRow}>
                  {proof.mimeType.startsWith('image/') ? (
                    <Image source={{ uri: proof.localUri }} style={styles.proofThumb} />
                  ) : (
                    <View style={[styles.proofThumb, styles.proofThumbDoc]}>
                      <Feather name="file-text" size={20} color={colors.textSecondary} />
                    </View>
                  )}

                  <View style={styles.proofMeta}>
                    <Text style={styles.proofName} numberOfLines={1}>{proof.name}</Text>
                    {proof.isUploading ? (
                      <View style={styles.proofStatusRow}>
                        <ActivityIndicator size="small" color={colors.actionGreen} />
                        <Text style={styles.proofStatus}>Uploading…</Text>
                      </View>
                    ) : proof.error ? (
                      <TouchableOpacity
                        onPress={() =>
                          startUpload({
                            uri: proof.localUri,
                            name: proof.name,
                            mimeType: proof.mimeType,
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <Text style={styles.proofRetry}>{proof.error} Tap to retry.</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.proofStatusRow}>
                        <Feather name="check-circle" size={12} color={colors.success} />
                        <Text style={[styles.proofStatus, { color: colors.success }]}>Attached</Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    onPress={() => dispatch(clearPaymentProof())}
                    disabled={proof.isUploading}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Feather name="x" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* ── Actions ──────────────────────────────── */}
          <View style={styles.btnRow}>
            <View style={{ flex: 1, marginRight: spacing.xs }}>
              <SecondaryButton title="Cancel" onPress={() => navigation.goBack()} disabled={form.isSaving} />
            </View>
            <View style={{ flex: 1.4 }}>
              {/* Gated on proof.id, not on a file being chosen: the upload must
                  have come back before money can move.

                  Only when cash actually moves, though. A settlement funded
                  entirely from vendor credit posts no payment — savePayment
                  returns before calling the API — so there is nothing to
                  evidence and demanding a receipt would just block it. */}
              <PrimaryButton
                title={
                  form.isSaving
                    ? 'Recording…'
                    : payCap.submitLabel('Record Payment')
                }
                onPress={handleSave}
                isLoading={form.isSaving}
                disabled={form.isSaving || (needsProof && !proof.id)}
                icon={<Feather name="check-circle" size={16} color={colors.neutral0} />}
              />
            </View>
          </View>
          {needsProof && !proof.id && (
            <Text style={styles.proofGate}>
              Attach a payment proof to record this payment.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
const SummaryRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({ label, value, valueColor }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryLabel}>{label}</Text>
    <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
  </View>
);

// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  // ── Payment proof ─────────────────────────────────
  proofHelp: {
    ...typography.caption, color: colors.textSecondary,
    lineHeight: 17, marginBottom: spacing.xs,
  },
  proofPick: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xxs,
    paddingVertical: spacing.xs + 4, borderRadius: radius.sm,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.actionGreen + '55',
    backgroundColor: colors.actionGreen + '08',
  },
  proofPickText: {
    ...typography.labelMd, color: colors.actionGreen,
  },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  proofThumb: {
    width: 44, height: 44, borderRadius: radius.sm,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  proofThumbDoc: { alignItems: 'center', justifyContent: 'center' },
  proofMeta: { flex: 1 },
  proofName: {
    ...typography.labelMd, color: colors.textPrimary,
  },
  proofStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  proofStatus: {
    ...typography.caption, color: colors.textSecondary,
  },
  proofRetry: {
    ...typography.caption, color: colors.danger, marginTop: 2,
  },
  proofGate: {
    ...typography.caption, color: colors.textTertiary, textAlign: 'center',
    marginTop: spacing.xxs,
  },

  container: { flex: 1, backgroundColor: colors.neutral100 },
  safeTop: { backgroundColor: HEADER_NAVY[0] },

  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl },

  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xs, gap: spacing.xxs + 2 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { ...THEME.form.sectionTitle },

  sectionCard: {
    flexDirection: 'row', backgroundColor: colors.neutral0, borderRadius: radius.lg,
    overflow: 'hidden', ...shadows.xs, borderWidth: 1, borderColor: colors.neutral200,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: spacing.md },
  rowFields: { flexDirection: 'row' },
  overdrawNote: {
    ...THEME.typography.caption,
    color: colors.warning,
    marginTop: -spacing.xxs,
    marginBottom: spacing.xs,
  },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end' },

  payAllChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.xs + 4, paddingVertical: spacing.xs + 2,
    backgroundColor: colors.dangerLighter, borderWidth: 1, borderColor: colors.dangerLight,
    borderRadius: 20, marginBottom: spacing.xxs,
  },
  payAllChipText: { ...typography.labelMd, color: colors.danger },

  emptyCard: {
    backgroundColor: colors.neutral0, borderRadius: radius.lg, paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.neutral200, borderStyle: 'dashed',
  },
  emptyIconBg: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.secondaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxs },
  emptyTitle: { ...typography.h5, color: colors.textPrimary, marginBottom: 2 },
  emptyText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center' },
  errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.xs },

  tableWrap: { backgroundColor: colors.neutral0, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.neutral200, ...shadows.xs },
  tableHeader: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xxs + 2,
    paddingHorizontal: spacing.xs, backgroundColor: colors.neutral50, borderBottomWidth: 2, borderBottomColor: colors.danger,
  },
  thText: { ...typography.overline, color: colors.danger },
  thRight: { textAlign: 'right' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs, backgroundColor: colors.neutral0,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.neutral100,
  },
  tableRowEven: { backgroundColor: colors.backgroundAlt },
  tableRowChecked: { backgroundColor: colors.dangerLighter },
  tdText: { ...typography.caption, color: colors.textPrimary },
  // labelSm carries emphasis at the same 12px, so an emphasised cell
  // never reflows the column.
  tdStrong: { ...typography.labelSm },
  tdRight: { textAlign: 'right' },

  checkboxWrap: { width: 32, alignItems: 'center' },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: colors.neutral300,
    justifyContent: 'center', alignItems: 'center', backgroundColor: colors.neutral0,
  },
  checkboxChecked: { backgroundColor: colors.danger, borderColor: colors.danger },

  summaryCard: { borderRadius: radius.lg + 4, padding: spacing.md + 4, marginTop: spacing.xl, ...shadows.md },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs + 2, marginBottom: spacing.xs },
  summaryHeaderText: { ...typography.labelMd, color: PANEL.accent, letterSpacing: 0.5 },
  summaryDivider: { height: 1, backgroundColor: PANEL.divider, marginVertical: spacing.xxs + 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xxs + 1 },
  summaryLabel: { ...typography.bodySm, color: PANEL.label },
  summaryValue: { ...typography.h5, color: PANEL.text, fontVariant: ['tabular-nums'] },

  creditBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: colors.actionGreenLighter, borderWidth: 1, borderColor: colors.successLight,
    borderRadius: radius.sm, padding: spacing.xs, marginBottom: spacing.xs,
  },
  creditBannerTitle: { ...typography.labelMd, color: colors.actionGreenDark },
  creditBannerHint: { ...THEME.typography.caption, color: colors.actionGreenDark, marginTop: 1 },
  creditChip: { ...typography.labelSm, color: colors.success, marginTop: 2 },
  creditChipOn: { color: colors.actionGreenDark },
  creditChipOff: { opacity: 0.35 },
  emptyCta: { marginTop: 12 },
  fieldHint: { ...THEME.typography.caption, color: colors.textSecondary, marginTop: -spacing.xxs, marginBottom: spacing.xs },
  totalReadout: { paddingVertical: 4 },
  totalReadoutLabel: { ...THEME.typography.caption, color: colors.textSecondary },
  totalReadoutValue: { ...typography.h3, color: colors.textPrimary, marginTop: 2, fontVariant: ['tabular-nums'] },
  totalReadoutHint: { ...THEME.typography.caption, color: colors.textTertiary, marginTop: 2 },
  payAllChipDisabled: { opacity: 0.4 },
  tdSub: { ...THEME.typography.caption, color: colors.textTertiary, marginTop: 1 },
  allocInput: {
    width: 96,
    height: 38,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    textAlign: 'right',
    ...THEME.typography.bodySm,
    color: colors.textPrimary,
    backgroundColor: colors.neutral0,
  },
  allocInputActive: { borderColor: colors.success, backgroundColor: colors.actionGreenLighter },
  tableTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.neutral50,
  },
  tableTotalLabel: { ...THEME.typography.caption, color: colors.textSecondary },
  tableTotalValue: { ...typography.labelLg, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  btnRow: { flexDirection: 'row', marginTop: spacing.xl, marginBottom: spacing.md },
});

export default PayBillsScreen;
