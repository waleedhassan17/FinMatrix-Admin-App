// ═══════════════════════════════════════════════════════
// FinMatrix — Bill Detail Screen
// Professional bill preview with vendor info, metadata,
// line items table, totals, payment history,
// remaining balance, and status-based action bar.
// Actions: Edit, Pay, Void.
// ═══════════════════════════════════════════════════════

import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Alert } from '../../../utils/alert';
import { useCompanyInfo } from '../../../utils/companyInfo';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  fetchBillDetail,
  resetBillDetail,
  selectBillDetail,
  selectBillPayments,
  selectBillDetailLoading,
  selectBillDetailError,
  updateBillStatus,
} from './billDetailSlice';
import { fetchBills, upsertBill, removeBill } from '../BillList/billListSlice';
import { BILL_STATUS_COLORS, BILL_STATUS_LABELS } from '../../../models/billModel';
import { billSingleSerializer } from '../../../serializers/billSerializer';
import CustomButton from '../../../Custom-Components/CustomButton';
import {
  ReportContainer,
  ReportHeader,
  Badge,
  EmptyBlock,
  LoadingBlock,
  ErrorBlock,
} from '../../../components/reports/ReportUI';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import type { BillStatus, BillPayment } from '../../../types';
import {
  downloadBillPaymentProof,
  proofIdFromUrl,
} from '../../../networks/purchases/billNetwork';
import type { TransactionsStackParamList } from '../../../navigators/stacks/TransactionsStack';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
type DetailRoute = RouteProp<TransactionsStackParamList, 'BillDetail'>;
const { colors, radius, shadows, spacing, typography } = THEME;

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  cheque: 'Cheque',
  bank_transfer: 'Bank Transfer',
  online: 'Online',
};

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const BillDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const dispatch = useAppDispatch();
  const companyInfo = useCompanyInfo();

  const billId = route.params.billId;
  const bill = useAppSelector(selectBillDetail);
  const payments = useAppSelector(selectBillPayments);
  const [openingProofId, setOpeningProofId] = React.useState<string | null>(null);

  /**
   * Download with the token, then hand the OS a local file.
   *
   * The stored URL is an auth-gated API route, not a CDN link — opening it
   * directly would 401. Images and PDFs both go through the same path; the
   * platform viewer decides what to do with the bytes.
   */
  const openProof = React.useCallback(async (proofId: string) => {
    setOpeningProofId(proofId);
    try {
      const uri = await downloadBillPaymentProof(proofId);
      await Linking.openURL(uri);
    } catch (e: any) {
      Alert.alert('Could not open the proof', e?.message ?? 'Please try again.');
    } finally {
      setOpeningProofId(null);
    }
  }, []);
  const isLoading = useAppSelector(selectBillDetailLoading);
  const error = useAppSelector(selectBillDetailError);

  const [refreshing, setRefreshing] = React.useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const paymentsY = useRef(0);
  // "View Payments" used to be onPress={() => {}} — a button that did nothing.
  const scrollToPayments = useCallback(
    () => scrollRef.current?.scrollTo({ y: Math.max(0, paymentsY.current - 12), animated: true }),
    [],
  );

  // Refetch on focus, not just on mount. This screen stays mounted while Pay
  // Bills is pushed over it, so returning from a payment used to show the
  // pre-payment bill — which is why a fully paid bill kept offering Pay Bill,
  // Edit and Void, and why Amount Paid looked unchanged.
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchBillDetail(billId));
    }, [billId, dispatch]),
  );

  useEffect(() => () => { dispatch(resetBillDetail()); }, [dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchBillDetail(billId));
    setRefreshing(false);
  }, [billId, dispatch]);

  const balance = useMemo(
    () => (bill ? bill.total - bill.amountPaid : 0),
    [bill],
  );

  // Money left to pay, not merely a status string. A hair of tolerance so a
  // rounding remainder never leaves a bill looking payable.
  const isSettled = !!bill && balance <= 0.005 && bill.status !== 'void';
  const canPay = !!bill && balance > 0.005 && bill.status !== 'draft' && bill.status !== 'void';
  // The API refuses to edit anything but a draft (CANNOT_EDIT_POSTED), so
  // offering Edit on a posted bill was offering a guaranteed failure.
  const canEdit = !!bill && bill.status === 'draft';
  // DELETE reverses the bill; the server blocks it once payments exist.
  const canDelete = !!bill && bill.amountPaid <= 0.005 && bill.status !== 'void';

  // ── Delete action ───────────────────────
  // What used to be "Void" sent `status: 'draft'`, but UpdateBillDto has no
  // status field and the API whitelists it away — so it 400'd with
  // CANNOT_EDIT_POSTED and reported "Voided" anyway. DELETE is the real
  // reversal: it posts a reversing journal entry and the server already
  // refuses when the bill has payments (BILL_HAS_PAYMENTS).
  const handleDelete = useCallback(async () => {
    if (!bill) return;
    Alert.alert(
      'Delete Bill',
      `Delete ${bill.billNumber}? A reversing journal entry is posted, so the ledger stays auditable.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(removeBill(bill.id)).unwrap();
              Toast.show({ type: 'success', text1: 'Bill deleted', text2: `${bill.billNumber} was reversed and removed.` });
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Could not delete', e?.message ?? 'Please try again.');
            }
          },
        },
      ],
    );
  }, [bill, dispatch, navigation]);

  // ── Loading / Error ─────────────────────────────
  // Both keep the header, so the back affordance never disappears.
  if (isLoading && !bill) {
    return (
      <ReportContainer>
        <ReportHeader title="Bill" onBack={() => navigation.goBack()} />
        <LoadingBlock />
      </ReportContainer>
    );
  }

  if (error || !bill) {
    return (
      <ReportContainer>
        <ReportHeader title="Bill" onBack={() => navigation.goBack()} />
        <ErrorBlock message={error || 'Bill not found'} />
      </ReportContainer>
    );
  }

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <ReportContainer>
      <ReportHeader
        title={bill.billNumber}
        subtitle={bill.vendorName}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* ── Bill Card ───────────────────────────── */}
        <View style={styles.billCard}>
          <View style={styles.statusRow}>
            <Badge label={BILL_STATUS_LABELS[bill.status]} color={BILL_STATUS_COLORS[bill.status]} dot />
          </View>
          <Text style={styles.companyName}>{companyInfo.name}</Text>
          {(companyInfo.addressLine1 || companyInfo.addressLine2) ? (
            <Text style={styles.companyMeta}>
              {[companyInfo.addressLine1, companyInfo.addressLine2].filter(Boolean).join(', ')}
            </Text>
          ) : null}
          {(companyInfo.email || companyInfo.phone) ? (
            <Text style={styles.companyMeta}>
              {[companyInfo.email, companyInfo.phone].filter(Boolean).join('  •  ')}
            </Text>
          ) : null}

          <View style={styles.divider} />

          <Text style={styles.billLabel}>BILL</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaKey}>Bill #</Text>
              <Text style={styles.metaVal}>{bill.billNumber}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaKey}>Issue Date</Text>
              <Text style={styles.metaVal}>{formatDate(bill.issueDate)}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaKey}>Due Date</Text>
              <Text style={styles.metaVal}>{formatDate(bill.dueDate)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* ── Vendor ────────────────────────────── */}
          <Text style={styles.sectionLabel}>Vendor</Text>
          <Text style={styles.vendorName}>{bill.vendorName}</Text>

          <View style={styles.divider} />

          {/* ── Line Items Table ──────────────────── */}
          <Text style={styles.sectionLabel}>Items</Text>

          <View style={styles.tableHeader}>
            <Text style={[styles.thText, { flex: 1.2 }]}>Account</Text>
            <Text style={[styles.thText, { flex: 1.5 }]}>Description</Text>
            <Text style={[styles.thText, styles.thRight, { flex: 0.6 }]}>Tax</Text>
            <Text style={[styles.thText, styles.thRight, { flex: 1 }]}>Amount</Text>
          </View>

          {bill.lines.map((line, idx) => (
            <View
              key={line.id}
              style={[styles.tableRow, idx % 2 === 0 && styles.tableRowEven]}
            >
              <Text style={[styles.tdText, { flex: 1.2 }]} numberOfLines={1}>
                {line.accountName}
              </Text>
              <Text style={[styles.tdText, { flex: 1.5 }]} numberOfLines={2}>
                {line.description}
              </Text>
              <Text style={[styles.tdText, styles.tdRight, { flex: 0.6 }]}>{line.taxRate}%</Text>
              <Text style={[styles.tdText, styles.tdRight, { flex: 1 }]}>
                {formatCurrency(line.amount, 'Rs ')}
              </Text>
            </View>
          ))}

          <View style={styles.divider} />

          {/* ── Totals ────────────────────────────── */}
          <View style={styles.totalsBlock}>
            <TotalsRow label="Subtotal" value={formatCurrency(bill.subtotal, 'Rs ')} />
            <TotalsRow label="Tax" value={formatCurrency(bill.taxAmount, 'Rs ')} />
            <View style={styles.grandTotalDivider} />
            <TotalsRow label="Grand Total" value={formatCurrency(bill.total, 'Rs ')} bold />
            <TotalsRow label="Amount Paid" value={formatCurrency(bill.amountPaid, 'Rs ')} valueColor={colors.success} />
            <View style={styles.grandTotalDivider} />
            <TotalsRow
              label="Balance Due"
              value={formatCurrency(balance, 'Rs ')}
              bold
              valueColor={balance > 0 ? colors.danger : colors.success}
            />
          </View>

          {/* ── Notes ─────────────────────────────── */}
          {!!bill.notes && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>Notes</Text>
              <Text style={styles.notesText}>{bill.notes}</Text>
            </>
          )}
        </View>

        {/* ── Payment History ─────────────────────── */}
        <View onLayout={e => { paymentsY.current = e.nativeEvent.layout.y; }} />
        <Text style={styles.outerSectionTitle}>Payment History</Text>
        {payments.length === 0 ? (
          <EmptyBlock icon="credit-card" title="No payments recorded yet" />
        ) : (
          payments.map((pmt: BillPayment) => (
            <View key={pmt.id} style={styles.paymentCard}>
              <View style={styles.paymentTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentNumber}>{pmt.paymentNumber}</Text>
                  <Text style={styles.paymentDate}>{formatDate(pmt.date)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.paymentAmount}>{formatCurrency(pmt.amount, 'Rs ')}</Text>
                  <View style={styles.methodBadge}>
                    <Text style={styles.methodBadgeText}>{METHOD_LABEL[pmt.method] ?? pmt.method}</Text>
                  </View>
                </View>
              </View>
              {!!pmt.reference && (
                <Text style={styles.paymentRef}>Ref: {pmt.reference}</Text>
              )}
              {/* Only payments recorded since proof became mandatory carry one;
                  older rows simply show nothing here. */}
              {!!proofIdFromUrl(pmt.proofUrl) && (
                <TouchableOpacity
                  style={styles.proofLink}
                  activeOpacity={0.7}
                  onPress={() => openProof(proofIdFromUrl(pmt.proofUrl) as string)}
                  disabled={openingProofId === proofIdFromUrl(pmt.proofUrl)}
                >
                  {openingProofId === proofIdFromUrl(pmt.proofUrl) ? (
                    <ActivityIndicator size="small" color={colors.secondary} />
                  ) : (
                    <Feather name="paperclip" size={13} color={colors.secondary} />
                  )}
                  <Text style={styles.proofLinkText}>View payment proof</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        <View style={{ height: spacing.xl * 3 }} />
      </ScrollView>

      {/* ── Action Bar ──────────────────────────────
          Gated on the BALANCE, not just the status: a bill with nothing left
          to pay must not keep offering Pay Bill / Edit / Delete. */}
      <View style={styles.actionBar}>
        {canEdit && (
          <View style={styles.actionSecondary}>
            <CustomButton
              title="Edit"
              onPress={() => navigation.push('BillForm', { billId: bill.id })}
              variant="secondary"
              size="sm"
              fullWidth
            />
          </View>
        )}

        {canDelete && (
          <View style={styles.actionSecondary}>
            <CustomButton title="Delete" onPress={handleDelete} variant="secondary" size="sm" fullWidth />
          </View>
        )}

        {canPay && (
          <View style={styles.actionPrimary}>
            <CustomButton
              title="Pay Bill"
              onPress={() => navigation.push('PayBills', { vendorId: bill.vendorId, billId: bill.id })}
              variant="primary"
              size="sm"
              fullWidth
            />
          </View>
        )}

        {isSettled && (
          <View style={styles.actionPrimary}>
            <CustomButton title="View Payments" onPress={scrollToPayments} variant="primary" size="sm" fullWidth />
          </View>
        )}

        {bill.status === 'void' && (
          <View style={styles.actionPrimary}>
            {/* popTo, not navigate: this is a BACK action. navigate() pushes a
                second BillList on top even when one is already in the stack,
                which left Back pointing at the voided bill the user had just
                walked away from. popTo unwinds to the existing list, and adds
                it if they never came through one. */}
            <CustomButton
              title="Back to Bills"
              onPress={() => navigation.popTo('BillList')}
              variant="secondary"
              size="sm"
              fullWidth
            />
          </View>
        )}
      </View>
    </ReportContainer>
  );
};

// ═══════════════════════════════════════════════════════
// TOTALS ROW HELPER
// ═══════════════════════════════════════════════════════
const TotalsRow: React.FC<{
  label: string;
  value: string;
  bold?: boolean;
  valueColor?: string;
}> = ({ label, value, bold, valueColor }) => (
  <View style={styles.totalsRow}>
    <Text style={[styles.totalsLabel, bold && styles.totalsLabelBold]}>{label}</Text>
    <Text
      style={[
        styles.totalsValue,
        bold && styles.totalsValueBold,
        valueColor ? { color: valueColor } : undefined,
      ]}
    >
      {value}
    </Text>
  </View>
);

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
// The document look (letterhead, ruled table, totals block) is deliberate --
// this is what gets shared as a PDF -- so the structure stays; only the values
// move onto the design system. Mirrors InvoiceDetail exactly.
const styles = StyleSheet.create({
  proofLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  proofLinkText: { ...typography.labelSm, color: colors.secondary },

  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },

  billCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusRow: { flexDirection: 'row', marginBottom: spacing.xs },
  companyName: { ...typography.h3, color: colors.actionGreen, marginBottom: 2 },
  companyMeta: { ...typography.caption, color: colors.textSecondary, lineHeight: 18 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  billLabel: {
    ...typography.h2,
    color: colors.actionGreen,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaCol: { alignItems: 'center', flex: 1 },
  metaKey: { ...typography.caption, color: colors.textTertiary, marginBottom: 2 },
  metaVal: { ...typography.labelMd, color: colors.textPrimary },

  // THE section-header spec, shared with every form section header.
  sectionLabel: { ...THEME.form.sectionTitle, marginBottom: spacing.xxs },
  vendorName: { ...typography.labelLg, color: colors.textPrimary },

  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.actionGreen,
  },
  thText: { ...typography.overline, color: colors.actionGreen },
  thRight: { textAlign: 'right' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tableRowEven: { backgroundColor: colors.background },
  tdText: { ...typography.caption, color: colors.textPrimary },
  // Figures align digit-for-digit down the column.
  tdRight: { textAlign: 'right', fontVariant: ['tabular-nums'] },

  totalsBlock: { marginLeft: 'auto', width: '65%' },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xxs,
  },
  totalsLabel: { ...typography.bodySm, color: colors.textSecondary },
  totalsLabelBold: { ...typography.h5, color: colors.textPrimary },
  totalsValue: { ...typography.labelMd, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  totalsValueBold: { ...typography.h4, fontVariant: ['tabular-nums'] },
  grandTotalDivider: { height: 1.5, backgroundColor: colors.actionGreen, marginVertical: spacing.xxs },

  notesText: { ...typography.bodySm, color: colors.textSecondary },

  outerSectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },

  paymentCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...shadows.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  paymentNumber: { ...typography.h5, color: colors.textPrimary },
  paymentDate: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  paymentAmount: { ...typography.h4, color: colors.success, fontVariant: ['tabular-nums'] },
  methodBadge: {
    marginTop: spacing.xxs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    backgroundColor: colors.secondary + '18',
    borderRadius: radius.xs,
  },
  methodBadgeText: { ...typography.labelSm, color: colors.secondary },
  paymentRef: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.xxs },

  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xxs,
    ...shadows.xs,
  },
  actionPrimary: { flex: 1.4 },
  actionSecondary: { flex: 1 },
});

export default BillDetailScreen;
