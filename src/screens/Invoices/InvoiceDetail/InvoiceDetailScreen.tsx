// ═══════════════════════════════════════════════════════
// FinMatrix — Invoice Detail Screen
// Professional invoice preview with company info, bill-to,
// metadata, line items table, totals, payment history,
// remaining balance, and status-based action bar.
// ═══════════════════════════════════════════════════════

import React, { useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Alert } from '../../../utils/alert';
import ApplyAdvanceModal from '../../../components/shared/ApplyAdvanceModal';
import CreditLimitModal from '../../../components/shared/CreditLimitModal';
import { creditAssessmentFrom, type CreditAssessment } from '../../../models/creditModel';
import { useCustomerAdvanceTotal } from '../../../hooks/useCustomerAdvanceTotal';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { usePendingApprovals } from '../../../hooks/usePendingApprovals';
import { hasOutstandingPaymentFor } from '../../../models/approvalModel';
import {
  fetchInvoiceDetail,
  resetInvoiceDetail,
  selectInvoiceDetail,
  selectInvoicePayments,
  selectInvoiceDetailLoading,
  selectInvoiceDetailSending,
  selectInvoiceDetailError,
  sendInvoice,
} from './invoiceDetailSlice';
import {
  fetchInvoices,
  selectInvoices,
  upsertInvoice,
} from '../InvoiceList/invoiceListSlice';
import {
  fetchCustomers,
  selectCustomers,
} from '../../Customers/CustomerList/customerListSlice';
import CustomButton from '../../../Custom-Components/CustomButton';
import {
  ReportContainer,
  ReportHeader,
  Badge,
  EmptyBlock,
  LoadingBlock,
  ErrorBlock,
} from '../../../components/reports/ReportUI';
import { txnStatusColor } from '../../../components/transactions/txnStatus';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import {
  shareInvoicePdf,
  openWhatsAppChat,
  sanitizePhoneForWhatsApp,
} from '../../../utils/invoiceShare';
import { useCompanyInfo } from '../../../utils/companyInfo';
import type { InvoiceStatus, Payment } from '../../../types';
import type { TransactionsStackParamList } from '../../../navigators/stacks/TransactionsStack';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
type DetailRoute = RouteProp<TransactionsStackParamList, 'InvoiceDetail'>;
const { colors, radius, shadows, spacing, typography } = THEME;

// Deliberately not shared with the list screen's map. There the label sits in
// a compact pill on every row; here it has a whole header line, so the draft
// state can say what it actually means — a draft posts no journal entry, so it
// is in no report until it is posted, and "Draft" alone never conveyed that.
const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Draft — not posted',
  sent: 'Sent',
  partial: 'Partial',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
  cancelled: 'Cancelled',
};

const METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  cheque: 'Cheque',
  bank_transfer: 'Bank Transfer',
  online: 'Online',
};

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const InvoiceDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const dispatch = useAppDispatch();
  const companyInfo = useCompanyInfo();

  const invoiceId = route.params.invoiceId;
  const invoice = useAppSelector(selectInvoiceDetail);
  const payments = useAppSelector(selectInvoicePayments);
  const isLoading = useAppSelector(selectInvoiceDetailLoading);
  const isSending = useAppSelector(selectInvoiceDetailSending);
  const error = useAppSelector(selectInvoiceDetailError);
  const customers = useAppSelector(selectCustomers);
  const invoicesList = useAppSelector(selectInvoices);

  const [refreshing, setRefreshing] = React.useState(false);

  // ── Load data ───────────────────────────────
  // A staff member cannot record a payment directly: it goes to the owner. Two
  // things follow. The invoice stays unpaid while the request waits — correctly,
  // nothing has posted — and Record Payment would otherwise sit here fully
  // tappable, letting them file the same request over and over for the owner to
  // untangle.
  const {
    requests: paymentRequests,
    reload: loadPendingPayments,
  } = usePendingApprovals('invoice_payment', 'payment.receive');

  const paymentAwaitingApproval = useMemo(
    () => hasOutstandingPaymentFor(paymentRequests, invoiceId),
    [paymentRequests, invoiceId],
  );

  useEffect(() => {
    dispatch(fetchInvoiceDetail(invoiceId));
    // Customers are needed for the Bill-To block on the PDF
    // and for the WhatsApp phone-number lookup.
    if (customers.length === 0) dispatch(fetchCustomers());
    // Also here, not only on focus: the listener below skips the first focus by
    // design, which would leave the button enabled on the very first render.
    void loadPendingPayments();
    return () => { dispatch(resetInvoiceDetail()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, dispatch]);

  // Re-fetch whenever the screen regains focus (e.g. after returning from
  // Record Payment) so the balance, status badge and payment history reflect
  // the freshly-recorded payment. The initial mount is skipped — the effect
  // above already loads it.
  useEffect(() => {
    let isInitial = true;
    const unsubscribe = navigation.addListener('focus', () => {
      if (isInitial) { isInitial = false; return; }
      dispatch(fetchInvoiceDetail(invoiceId));
      // Filing a payment request goBack()s straight onto this screen, so this
      // is the path that actually locks the button.
      void loadPendingPayments();
    });
    return unsubscribe;
  }, [navigation, invoiceId, dispatch, loadPendingPayments]);

  // Resolve the customer record that matches this invoice.
  const customer = useMemo(
    () => customers.find(c => c.id === invoice?.customerId) || null,
    [customers, invoice?.customerId],
  );
  const customerHasWhatsApp = !!sanitizePhoneForWhatsApp(customer?.phone);
  void invoicesList;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      dispatch(fetchInvoiceDetail(invoiceId)),
      loadPendingPayments(),
    ]);
    setRefreshing(false);
  }, [invoiceId, dispatch, loadPendingPayments]);

  // ── Derived ─────────────────────────────────────
  const balance = useMemo(
    () => (invoice ? invoice.total - invoice.amountPaid : 0),
    [invoice],
  );

  // Advances the customer already paid. Offered ahead of Record Payment: an
  // invoice the customer has paid for is settled from the advance, not by
  // recording the same cash a second time.
  const invoiceCustomerId = invoice?.customerId;
  const { total: advanceTotal, reload: loadAdvances } = useCustomerAdvanceTotal(invoiceCustomerId);
  const [applyOpen, setApplyOpen] = React.useState(false);

  // ── Actions ─────────────────────────────────

  /** After a successful share we transition the invoice to
   *  "sent" on the backend and refresh the list behind the
   *  scenes so the status badge updates everywhere. */
  // Posting a draft is a sale, so it is checked against the credit limit.
  const [creditRefusal, setCreditRefusal] = React.useState<CreditAssessment | null>(null);

  const markAsSentOnBackend = useCallback(
    async (channel: 'whatsapp' | 'email' | 'share', toPhone?: string) => {
      if (!invoice) return;
      const action = await dispatch(
        sendInvoice({ id: invoice.id, channel, toPhone }),
      );
      const refused = creditAssessmentFrom((action as any)?.payload);
      if (refused) {
        setCreditRefusal(refused);
        return;
      }
      // Keep the list slice in sync without a full re-fetch.
      const payload: any = (action as any)?.payload;
      const updated = payload?.data?.invoice;
      if (updated) dispatch(upsertInvoice(updated));
      else dispatch(fetchInvoices());
    },
    [dispatch, invoice],
  );

  const handleSharePdf = useCallback(async () => {
    if (!invoice) return;
    const result = await shareInvoicePdf({ invoice, customer, company: companyInfo });
    if (result.shared && invoice.status === 'draft') {
      await markAsSentOnBackend('share');
    }
  }, [invoice, customer, markAsSentOnBackend]);

  /**
   * Post a draft to the books without sharing it.
   *
   * A draft posts no journal entry — correct accounting, since a draft is not
   * a transaction. But the ONLY way to leave that state used to be completing
   * the OS share sheet: cancel the sheet and the invoice stayed a draft,
   * absent from the ledger and every report, with no button anywhere that
   * would post it. Sharing a PDF and recognising revenue are two different
   * decisions and now have two different buttons.
   *
   * Confirms first, because this is the moment the sale enters the books.
   */
  const postWithOverride = useCallback(
    async (overrideReason: string) => {
      if (!invoice) return;
      try {
        await dispatch(sendInvoice({ id: invoice.id, channel: 'share', overrideReason })).unwrap();
        dispatch(fetchInvoices());
      } catch (e: any) {
        Alert.alert('Could not post', e?.message ?? 'Failed to post the invoice.');
      }
    },
    [dispatch, invoice],
  );

  const handlePostToBooks = useCallback(() => {
    if (!invoice) return;
    Alert.alert(
      'Post to books?',
      `Invoice ${invoice.invoiceNumber} will be recorded as sent and posted to the general ledger. This is what makes it show up in your reports.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Post',
          onPress: async () => {
            try {
              await dispatch(sendInvoice({ id: invoice.id, channel: 'share' })).unwrap();
              dispatch(fetchInvoices());
            } catch (e: any) {
              const refused = creditAssessmentFrom(e);
              if (refused) {
                setCreditRefusal(refused);
                return;
              }
              // INVOICE_ZERO_TOTAL lands here with a message naming the fix.
              Alert.alert('Could not post', e?.message ?? 'Failed to post the invoice.');
            }
          },
        },
      ],
    );
  }, [dispatch, invoice]);

  const handleOpenWhatsAppChat = useCallback(async () => {
    if (!invoice) return;
    const result = await openWhatsAppChat({ invoice, customer });
    if (!result.opened) {
      Alert.alert('WhatsApp', result.reason || 'Could not open WhatsApp.');
    }
  }, [invoice, customer]);

  // ── Loading / Error states ──────────────────────
  // Both keep the header, so the back affordance never disappears.
  if (isLoading && !invoice) {
    return (
      <ReportContainer>
        <ReportHeader title="Invoice" onBack={() => navigation.goBack()} />
        <LoadingBlock />
      </ReportContainer>
    );
  }

  if (error || !invoice) {
    return (
      <ReportContainer>
        <ReportHeader title="Invoice" onBack={() => navigation.goBack()} />
        <ErrorBlock message={error || 'Invoice not found'} />
      </ReportContainer>
    );
  }

  // The same action in two status branches, so it is built once.
  //
  // A badge rather than a disabled button, following the delivery sign-off:
  // "State, not a disabled control: a greyed-out Approve reads as 'try again
  // later', which is wrong. Someone else signs this off." The same is true
  // here — nothing the staff member does will unlock it, the owner has to
  // decide. It also fixes the layout: a faded primary kept "Waiting for
  // approval" on two lines beside Share and Remind, because CustomButton sets
  // no numberOfLines and the label simply wrapped, growing the whole bar.
  const recordPaymentAction = paymentAwaitingApproval ? (
    <View style={styles.actionPrimary}>
      <View style={styles.waitingBadge}>
        <Feather name="clock" size={13} color={colors.warning} />
        <Text style={styles.waitingBadgeText}>Awaiting approval</Text>
      </View>
    </View>
  ) : (
    <View style={styles.actionPrimary}>
      <CustomButton
        title="Record Payment"
        onPress={() =>
          navigation.navigate('ReceivePayment', {
            customerId: invoice.customerId,
            invoiceId: invoice.id,
          })
        }
        variant="primary"
        size="sm"
        fullWidth
      />
    </View>
  );

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <ReportContainer>
      <ReportHeader
        title={invoice.invoiceNumber}
        subtitle={invoice.customerName || customer?.name}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {advanceTotal > 0 && balance > 0 &&
          ['sent', 'overdue', 'partial'].includes(invoice.status) &&
          !paymentAwaitingApproval && (
          <View style={styles.advanceBanner}>
            <Feather name="info" size={14} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.advanceBannerText}>
                {invoice.customerName || customer?.name || 'This customer'} holds{' '}
                {formatCurrency(advanceTotal, 'Rs ')} in advances.
              </Text>
              <TouchableOpacity onPress={() => setApplyOpen(true)} accessibilityRole="button">
                <Text style={styles.advanceBannerLink}>Apply advance to this invoice</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Company Info ────────────────────────── */}
        <View style={styles.invoiceCard}>
          <View style={styles.statusRow}>
            <Badge label={STATUS_LABEL[invoice.status]} color={txnStatusColor(invoice.status)} dot />
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

          {/* ── Invoice heading ───────────────────── */}
          <Text style={styles.invoiceLabel}>INVOICE</Text>

          {/* ── Metadata row ──────────────────────── */}
          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaKey}>Invoice #</Text>
              <Text style={styles.metaVal}>{invoice.invoiceNumber}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaKey}>Issue Date</Text>
              <Text style={styles.metaVal}>{formatDate(invoice.issueDate)}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaKey}>Due Date</Text>
              <Text style={styles.metaVal}>{formatDate(invoice.dueDate)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* ── Bill To ───────────────────────────── */}
          <Text style={styles.sectionLabel}>Bill To</Text>
          {/* GET /invoices/:id does not carry customerName — only the LIST
              endpoint decorates rows from its customerNameMap — so this read
              blank for every invoice, always. The customer is already resolved
              above for the PDF and the WhatsApp lookup; using it here is the
              fix, and it works against the deployed backend rather than waiting
              on a release. Same fallback the forms use. */}
          <Text style={styles.billToName}>
            {invoice.customerName || customer?.name || '—'}
          </Text>

          <View style={styles.divider} />

          {/* ── Line Items Table ──────────────────── */}
          <Text style={styles.sectionLabel}>Items</Text>

          {/* Table header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.thText, { flex: 2.5 }]}>Description</Text>
            <Text style={[styles.thText, styles.thRight, { flex: 0.5 }]}>Qty</Text>
            <Text style={[styles.thText, styles.thRight, { flex: 0.9 }]}>Rate</Text>
            <Text style={[styles.thText, styles.thRight, { flex: 0.5 }]}>Tax</Text>
            <Text style={[styles.thText, styles.thRight, { flex: 1.1 }]}>Amount</Text>
          </View>

          {/* Table rows */}
          {invoice.lines.map((line, idx) => (
            <View
              key={line.id}
              style={[styles.tableRow, idx % 2 === 0 && styles.tableRowEven]}
            >
              <View style={{ flex: 2.5 }}>
                <Text style={styles.tdText} numberOfLines={2}>{line.description || line.itemName}</Text>
              </View>
              <Text style={[styles.tdText, styles.tdRight, { flex: 0.5 }]}>{line.quantity}</Text>
              <Text style={[styles.tdText, styles.tdRight, { flex: 0.9 }]}>
                {formatCurrency(line.unitPrice, 'Rs ')}
              </Text>
              <Text style={[styles.tdText, styles.tdRight, { flex: 0.5 }]}>{line.taxRate}%</Text>
              <Text style={[styles.tdText, styles.tdRight, { flex: 1.1 }]}>
                {formatCurrency(line.amount, 'Rs ')}
              </Text>
            </View>
          ))}

          <View style={styles.divider} />

          {/* ── Totals ────────────────────────────── */}
          <View style={styles.totalsBlock}>
            <TotalsRow label="Subtotal" value={formatCurrency(invoice.subtotal, 'Rs ')} />
            {invoice.discountAmount > 0 && (
              <TotalsRow
                label={
                  invoice.discountType === 'percent'
                    ? `Discount (${invoice.discountValue}%)`
                    : 'Discount (Fixed)'
                }
                value={`− ${formatCurrency(invoice.discountAmount, 'Rs ')}`}
                valueColor={colors.success}
              />
            )}
            <TotalsRow label="Tax" value={formatCurrency(invoice.taxAmount, 'Rs ')} />

            <View style={styles.grandTotalDivider} />
            <TotalsRow label="Grand Total" value={formatCurrency(invoice.total, 'Rs ')} bold />
            <TotalsRow label="Amount Paid" value={formatCurrency(invoice.amountPaid, 'Rs ')} valueColor={colors.success} />
            <View style={styles.grandTotalDivider} />
            <TotalsRow
              label="Balance Due"
              value={formatCurrency(balance, 'Rs ')}
              bold
              valueColor={balance > 0 ? colors.danger : colors.success}
            />
          </View>

          {/* ── Notes ─────────────────────────────── */}
          {!!invoice.notes && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>Notes</Text>
              <Text style={styles.notesText}>{invoice.notes}</Text>
            </>
          )}
        </View>

        {/* ── Payment History ─────────────────────── */}
        <Text style={styles.outerSectionTitle}>Payment History</Text>
        {payments.length === 0 ? (
          <EmptyBlock icon="credit-card" title="No payments recorded yet" />
        ) : (
          payments.map((pmt: Payment) => (
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
              {pmt.allocations
                .filter(a => a.invoiceId === invoice.id)
                .map(a => (
                  <Text key={a.invoiceId} style={styles.paymentRef}>
                    Applied {formatCurrency(a.amount, 'Rs ')}
                    {a.invoiceBalance != null
                      ? a.invoiceBalance > 0.005
                        ? ` · ${formatCurrency(a.invoiceBalance, 'Rs ')} still owing`
                        : ' · invoice settled'
                      : ''}
                  </Text>
                ))}
            </View>
          ))
        )}

        {/* Bottom spacer */}
        <View style={{ height: spacing.xxl * 3 }} />
      </ScrollView>

      {/* ── Action Bar ──────────────────────────────── */}
      <View style={styles.actionBar}>
        {/* Draft: Edit + Share, with Post as the primary action. Posting is
            what puts the invoice in the ledger, so it gets the primary slot;
            sharing a PDF is a separate decision and no longer the only route
            out of draft. */}
        {invoice.status === 'draft' && (
          <>
            <View style={styles.actionShare}>
              <CustomButton
                title="Edit"
                onPress={() => navigation.navigate('InvoiceForm', { invoiceId: invoice.id })}
                variant="text"
                size="sm"
                fullWidth
              />
            </View>
            <View style={styles.actionSecondary}>
              <CustomButton
                title={isSending ? 'Sending…' : 'Share'}
                onPress={handleSharePdf}
                variant="secondary"
                size="sm"
                fullWidth
                disabled={isSending}
              />
            </View>
            <View style={styles.actionPrimary}>
              <CustomButton
                title={isSending ? 'Posting…' : 'Post'}
                onPress={handlePostToBooks}
                variant="primary"
                size="sm"
                fullWidth
                disabled={isSending}
              />
            </View>
          </>
        )}

        {/* Sent / overdue: Record Payment primary, WhatsApp resend + share secondary */}
        {(invoice.status === 'sent' || invoice.status === 'overdue') && (
          <>
            <View style={styles.actionShare}>
              <CustomButton
                title="Share"
                onPress={handleSharePdf}
                variant="text"
                size="sm"
                fullWidth
              />
            </View>
            {/* Only when it genuinely opens the customer's chat. The old
                fallback here was a second Share PDF wearing a WhatsApp label. */}
            {customerHasWhatsApp && (
              <View style={styles.actionSecondary}>
                <CustomButton
                  title="Remind"
                  onPress={handleOpenWhatsAppChat}
                  variant="secondary"
                  size="sm"
                  fullWidth
                />
              </View>
            )}
            {recordPaymentAction}
          </>
        )}

        {/* Partial: same as sent/overdue — can still record payment */}
        {invoice.status === 'partial' && (
          <>
            <View style={styles.actionShare}>
              <CustomButton
                title="Share"
                onPress={handleSharePdf}
                variant="text"
                size="sm"
                fullWidth
              />
            </View>
            {/* Only when it genuinely opens the customer's chat. The old
                fallback here was a second Share PDF wearing a WhatsApp label. */}
            {customerHasWhatsApp && (
              <View style={styles.actionSecondary}>
                <CustomButton
                  title="Remind"
                  onPress={handleOpenWhatsAppChat}
                  variant="secondary"
                  size="sm"
                  fullWidth
                />
              </View>
            )}
            {recordPaymentAction}
          </>
        )}

        {/* Paid / void / cancelled: share PDF only */}
        {(invoice.status === 'paid' || invoice.status === 'void' || invoice.status === 'cancelled') && (
          <>
            <View style={styles.actionSecondary}>
              <CustomButton
                title="Share"
                onPress={handleSharePdf}
                variant="secondary"
                size="sm"
                fullWidth
              />
            </View>
            <View style={styles.actionPrimary}>
              <CustomButton
                title="New Invoice"
                onPress={() => navigation.navigate('InvoiceForm')}
                variant="primary"
                size="sm"
                fullWidth
              />
            </View>
          </>
        )}
      </View>
      <CreditLimitModal
        assessment={creditRefusal}
        busy={isSending}
        onClose={() => setCreditRefusal(null)}
        onOverride={reason => {
          setCreditRefusal(null);
          void postWithOverride(reason);
        }}
        onRecordAdvance={a => {
          setCreditRefusal(null);
          navigation.navigate('ReceivePayment', { customerId: a.customerId });
        }}
      />
      <ApplyAdvanceModal
        visible={applyOpen}
        customerId={invoice.customerId}
        customerName={invoice.customerName || customer?.name}
        invoiceId={invoice.id}
        onClose={() => setApplyOpen(false)}
        onApplied={() => {
          loadAdvances();
          void loadPendingPayments();
          dispatch(fetchInvoiceDetail(invoiceId));
        }}
      />
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
// move onto the design system.
const styles = StyleSheet.create({
  advanceBanner: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    marginBottom: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.warningLight,
  },
  advanceBannerText: { ...typography.caption, color: colors.textPrimary },
  advanceBannerLink: { ...typography.labelSm, color: colors.primary, marginTop: spacing.xxs },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },

  // ── Invoice card ───────────────────────────────
  invoiceCard: {
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
  invoiceLabel: {
    ...typography.h2,
    color: colors.actionGreen,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },

  // ── Meta row ───────────────────────────────────
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metaCol: { alignItems: 'center', flex: 1 },
  metaKey: { ...typography.caption, color: colors.textTertiary, marginBottom: 2 },
  metaVal: { ...typography.labelMd, color: colors.textPrimary },

  // ── Bill To ────────────────────────────────────
  // THE section-header spec, shared with every form section header.
  sectionLabel: { ...THEME.form.sectionTitle, marginBottom: spacing.xxs },
  billToName: { ...typography.labelLg, color: colors.textPrimary },

  // ── Line items table ───────────────────────────
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

  // ── Totals ─────────────────────────────────────
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

  // ── Payment History ────────────────────────────
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

  // ── Action Bar ─────────────────────────────────
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
  // Mirrors InventoryApprovalScreen's waitingBadge: warning tint, clock, and
  // centred text that wraps gracefully rather than distorting the bar.
  waitingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warning + '1A',
  },
  waitingBadgeText: {
    ...typography.labelSm,
    color: colors.warning,
    textAlign: 'center',
  },
  actionSecondary: { flex: 1 },
  actionShare: { flex: 1 },
});

export default InvoiceDetailScreen;
