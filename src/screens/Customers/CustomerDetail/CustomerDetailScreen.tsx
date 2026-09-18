// ═══════════════════════════════════════════════════════
// FinMatrix — Customer Detail Screen
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Alert } from '../../../utils/alert';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { toggleCustomerActive, upsertCustomer } from '../CustomerList/customerListSlice';
import {
  selectCustomerDetailTab,
  selectCustomerDetail,
  selectCustomerDetailStatus,
  selectCustomerDetailError,
  selectCustomerDetailInvoices,
  selectCustomerDetailPayments,
  setActiveTab,
  resetCustomerDetail,
  upsertDetailCustomer,
  fetchCustomerDetail,
  fetchCustomerInvoices,
  fetchCustomerPayments,
  type CustomerDetailTab
} from './customerDetailSlice';
import CustomButton from '../../../Custom-Components/CustomButton';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { PAYMENT_TERMS_LABELS } from '../../../models/customerModel';
import { getCustomerStatementAPI } from '../../../networks/sales/customerNetwork';
import { statementSerializer, shareStatementPdf } from '../../../utils/statementPdf';
import { useCompanyInfo } from '../../../utils/companyInfo';
import { mapCustomer } from '../../../serializers/customerSerializer';
import type { PaymentTerms, Customer } from '../../../types';
import ApplyAdvanceModal from '../../../components/shared/ApplyAdvanceModal';
import type { MoreStackParamList } from '../../../navigators/stacks/MoreStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;
type DetailRoute = RouteProp<MoreStackParamList, 'CustomerDetail'>;

const TABS: { key: CustomerDetailTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
];

const INVOICE_STATUS_COLORS: Record<string, string> = {
  paid: colors.success,
  sent: colors.secondary,
  partial: colors.warning,
  overdue: colors.danger,
  draft: colors.textTertiary,
  void: colors.textTertiary
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  sent: 'Sent',
  partial: 'Partial',
  overdue: 'Overdue',
  draft: 'Draft',
  void: 'Void'
};

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const CustomerDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const dispatch = useAppDispatch();
  const companyInfo = useCompanyInfo();
  const customerId = route.params.customerId;

  const customer = useAppSelector(selectCustomerDetail);
  const status = useAppSelector(selectCustomerDetailStatus);
  const error = useAppSelector(selectCustomerDetailError);
  const activeTab = useAppSelector(selectCustomerDetailTab);
  const invoicesTab = useAppSelector(selectCustomerDetailInvoices);
  const paymentsTab = useAppSelector(selectCustomerDetailPayments);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSharingStatement, setIsSharingStatement] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);

  useEffect(() => {
    return () => { dispatch(resetCustomerDetail()); };
  }, [dispatch]);

  // Refetch whenever the screen gains focus so the balance and histories
  // stay fresh after recording a payment / creating an invoice elsewhere.
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchCustomerDetail(customerId));
      dispatch(fetchCustomerInvoices({ customerId }));
      dispatch(fetchCustomerPayments({ customerId }));
    }, [dispatch, customerId]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchCustomerDetail(customerId)),
        dispatch(fetchCustomerInvoices({ customerId })),
        dispatch(fetchCustomerPayments({ customerId })),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, customerId]);

  // ── Loading / error states for the record itself ──
  if (!customer && status === 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Customer" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.actionGreen} />
          <Text style={styles.emptyText}>Loading customer…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Customer" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Feather name="user-x" size={40} color={colors.textTertiary} />
          <Text style={styles.emptyText}>{error || 'Customer not found'}</Text>
          <CustomButton
            title="Retry"
            onPress={() => dispatch(fetchCustomerDetail(customerId))}
            variant="primary"
            size="md"
          />
          <CustomButton title="Go Back" onPress={() => navigation.goBack()} variant="secondary" size="md" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Credit usage ────────────────────────────────
  // Exposure, not the ledger balance: unpaid invoices plus goods shipped on
  // credit, less advances — the figure a sale is actually checked against.
  const exposure = customer.credit?.exposure ?? customer.balance;
  const advancesHeld = customer.credit?.advances ?? 0;
  const creditUsagePercent = customer.creditLimit > 0
    ? Math.max(0, Math.min((exposure / customer.creditLimit) * 100, 100))
    : 0;
  const creditBarColor = creditUsagePercent >= 80
    ? colors.danger
    : creditUsagePercent >= 50
      ? colors.warning
      : colors.success;

  // ── Action handlers ─────────────────────────────
  // initial: false on both hops — see VendorDetailScreen. Without it the
  // Transactions stack initialises as [InvoiceForm] with no hub beneath, and
  // back lands on the Dashboard rather than returning into that tab.
  const handleCreateInvoice = () => {
    (navigation as unknown as NativeStackNavigationProp<Record<string, object>>)
      .navigate('TransactionsStack', {
        screen: 'InvoiceForm',
        params: { customerId: customer.id },
        initial: false
      });
  };
  const handleRecordPayment = () => {
    (navigation as unknown as NativeStackNavigationProp<Record<string, object>>)
      .navigate('TransactionsStack', {
        screen: 'ReceivePayment',
        params: { customerId: customer.id },
        initial: false
      });
  };
  const handleSendStatement = async () => {
    if (isSharingStatement) return;
    setIsSharingStatement(true);
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const toIso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const payload = await getCustomerStatementAPI(customer.id, {
        startDate: toIso(start),
        endDate: toIso(now),
      });
      const data = statementSerializer(payload);
      if (!data) throw new Error('Could not load the statement.');
      const result = await shareStatementPdf(data, companyInfo);
      if (!result.shared && result.reason) {
        Alert.alert('Statement', result.reason);
      }
    } catch (e: any) {
      Alert.alert('Statement failed', e?.message || 'Could not generate the statement. Please try again.');
    } finally {
      setIsSharingStatement(false);
    }
  };
  const handleToggleActive = async () => {
    if (isToggling) return;
    setIsToggling(true);
    try {
      const action: any = await dispatch(toggleCustomerActive(customer.id));
      if (toggleCustomerActive.rejected.match(action)) {
        throw new Error(action.error?.message);
      }
      const updatedRaw = action.payload?.data;
      if (updatedRaw?.id) {
        const updated: Customer = mapCustomer(updatedRaw);
        dispatch(upsertDetailCustomer(updated));
        dispatch(upsertCustomer(updated));
      }
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Could not update the customer. Please try again.');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTitleRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              activeOpacity={0.7}>
              <Feather name="arrow-left" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{customer.name}</Text>
          </View>
        </View>
        <CustomButton
          title="Edit"
          onPress={() => navigation.navigate('CustomerForm', { customerId: customer.id })}
          variant="secondary"
          size="sm"
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.actionGreen} />
        }
      >
        {/* ── Top Card: Balance + Credit Usage ────── */}
        <View style={styles.topCard}>
          <View style={styles.topCardRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.topCardLabel}>Outstanding Balance</Text>
              <Text style={styles.topCardBalance}>{formatCurrency(customer.balance, 'Rs ')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.topCardLabel}>Total Purchases</Text>
              <Text style={styles.topCardPurchases}>{formatCurrency(customer.totalPurchases, 'Rs ')}</Text>
            </View>
          </View>

          {/* Credit Usage Bar */}
          {customer.creditLimit > 0 && (
            <View style={styles.creditSection}>
              <View style={styles.creditHeader}>
                <Text style={styles.creditLabel}>Credit Usage</Text>
                <Text style={styles.creditPercent}>{creditUsagePercent.toFixed(0)}%</Text>
              </View>
              <View style={styles.creditBarTrack}>
                <View
                  style={[styles.creditBarFill, { width: `${creditUsagePercent}%`, backgroundColor: creditBarColor }]}
                />
              </View>
              <View style={styles.creditFooter}>
                <Text style={styles.creditFooterText}>
                  {formatCurrency(exposure, 'Rs ')} of {formatCurrency(customer.creditLimit, 'Rs ')}
                  {customer.credit?.available != null ? ` · ${formatCurrency(Math.max(0, customer.credit.available), 'Rs ')} available` : ''}
                </Text>
              </View>
            </View>
          )}
          {customer.creditLimit <= 0 && (
            <Text style={styles.creditFooterText}>Credit limit: no limit</Text>
          )}

          {/* Advances: money already paid, waiting to be set against an
              invoice. Applying it settles invoices without recording new
              cash — recording the cash again is how a payment gets doubled. */}
          {advancesHeld > 0 && (
            <View style={styles.creditSection}>
              <View style={styles.creditHeader}>
                <Text style={styles.creditLabel}>Advances held</Text>
                <Text style={styles.creditPercent}>{formatCurrency(advancesHeld, 'Rs ')}</Text>
              </View>
              <CustomButton title="Apply to invoices" variant="secondary" size="sm" onPress={() => setApplyOpen(true)} />
            </View>
          )}

          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: customer.isActive ? colors.success + '18' : colors.textTertiary + '18' }]}>
            <Text style={[styles.statusBadgeText, { color: customer.isActive ? colors.success : colors.textTertiary }]}>
              {customer.isActive ? '● Active' : '● Inactive'}
            </Text>
          </View>
        </View>

        {/* ── Action Buttons ─────────────────────── */}
        <View style={styles.actionRow}>
          <ActionButton icon="file-text" label="Create Invoice" onPress={handleCreateInvoice} />
          <ActionButton icon="dollar-sign" label="Record Payment" onPress={handleRecordPayment} />
          <ActionButton
            icon="send"
            label={isSharingStatement ? 'Preparing…' : 'Send Statement'}
            onPress={handleSendStatement}
            disabled={isSharingStatement}
          />
        </View>

        {/* ── Tabs ───────────────────────────────── */}
        <View style={styles.tabRow}>
          {TABS.map(t => {
            const isActive = activeTab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.tab, isActive && styles.tabActive]}
                activeOpacity={0.7}
                onPress={() => dispatch(setActiveTab(t.key))}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Tab Content ────────────────────────── */}
        {activeTab === 'overview' && (
          <OverviewTab customer={customer} onToggleActive={handleToggleActive} isToggling={isToggling} />
        )}
        {activeTab === 'invoices' && (
          <ListTabState
            status={invoicesTab.status}
            error={invoicesTab.error}
            isEmpty={invoicesTab.rows.length === 0}
            emptyIcon="file-text"
            emptyText="No invoices for this customer yet."
            onRetry={() => dispatch(fetchCustomerInvoices({ customerId }))}
          >
            <View style={styles.tabContent}>
              {invoicesTab.rows.map(inv => (
                <View key={inv.id} style={styles.listCard}>
                  <View style={styles.listCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listCardTitle}>{inv.invoiceNumber}</Text>
                      <Text style={styles.listCardSub}>{formatDate(inv.date)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.listCardAmount}>{formatCurrency(inv.amount, 'Rs ')}</Text>
                      <View style={[styles.miniStatusBadge, { backgroundColor: (INVOICE_STATUS_COLORS[inv.status] ?? colors.textTertiary) + '18' }]}>
                        <Text style={[styles.miniStatusText, { color: INVOICE_STATUS_COLORS[inv.status] ?? colors.textTertiary }]}>
                          {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.listCardDetail}>
                    {inv.dueDate ? `Due: ${formatDate(inv.dueDate)}` : ''}
                    {inv.balance > 0 ? `  ·  Balance: ${formatCurrency(inv.balance, 'Rs ')}` : ''}
                  </Text>
                </View>
              ))}
              {invoicesTab.page < invoicesTab.totalPages && (
                <CustomButton
                  title="Load more"
                  variant="secondary"
                  size="sm"
                  onPress={() => dispatch(fetchCustomerInvoices({ customerId, page: invoicesTab.page + 1 }))}
                />
              )}
            </View>
          </ListTabState>
        )}
        {activeTab === 'payments' && (
          <ListTabState
            status={paymentsTab.status}
            error={paymentsTab.error}
            isEmpty={paymentsTab.rows.length === 0}
            emptyIcon="dollar-sign"
            emptyText="No payments recorded for this customer yet."
            onRetry={() => dispatch(fetchCustomerPayments({ customerId }))}
          >
            <View style={styles.tabContent}>
              {paymentsTab.rows.map(pay => (
                <View key={pay.id} style={styles.listCard}>
                  <View style={styles.listCardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listCardTitle}>{pay.reference}</Text>
                      <Text style={styles.listCardSub}>{formatDate(pay.date)}</Text>
                    </View>
                    <Text style={[styles.listCardAmount, { color: colors.success }]}>
                      {formatCurrency(pay.amount, 'Rs ')}
                    </Text>
                  </View>
                  <Text style={styles.listCardDetail}>Method: {pay.method}</Text>
                  {pay.applied.map(line => (
                    <Text key={line} style={styles.listCardDetail}>{line}</Text>
                  ))}
                </View>
              ))}
              {paymentsTab.page < paymentsTab.totalPages && (
                <CustomButton
                  title="Load more"
                  variant="secondary"
                  size="sm"
                  onPress={() => dispatch(fetchCustomerPayments({ customerId, page: paymentsTab.page + 1 }))}
                />
              )}
            </View>
          </ListTabState>
        )}
      </ScrollView>
      <ApplyAdvanceModal
        visible={applyOpen}
        customerId={customer.id}
        customerName={customer.name}
        onClose={() => setApplyOpen(false)}
        onApplied={() => {
          dispatch(fetchCustomerDetail(customerId));
          dispatch(fetchCustomerPayments({ customerId }));
        }}
      />
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

const ScreenHeader: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
  <View style={styles.header}>
    <View style={styles.headerLeft}>
      <View style={styles.headerTitleRow}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      </View>
    </View>
  </View>
);

const ActionButton: React.FC<{
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}> = ({ icon, label, onPress, disabled }) => (
  <TouchableOpacity
    style={[styles.actionBtn, disabled && { opacity: 0.5 }]}
    onPress={onPress}
    activeOpacity={0.7}
    disabled={disabled}
  >
    <Feather name={icon} size={20} color={colors.actionGreen} style={{ marginBottom: spacing.xxs }} />
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

/** Loading / error / empty / success wrapper for the list tabs. */
const ListTabState: React.FC<{
  status: 'idle' | 'loading' | 'failed' | 'loaded';
  error: string;
  isEmpty: boolean;
  emptyIcon: keyof typeof Feather.glyphMap;
  emptyText: string;
  onRetry: () => void;
  children: React.ReactNode;
}> = ({ status, error, isEmpty, emptyIcon, emptyText, onRetry, children }) => {
  if ((status === 'loading' || status === 'idle') && isEmpty) {
    return (
      <View style={styles.tabStateBlock}>
        <ActivityIndicator size="small" color={colors.actionGreen} />
        <Text style={styles.tabStateText}>Loading…</Text>
      </View>
    );
  }
  if (status === 'failed' && isEmpty) {
    return (
      <View style={styles.tabStateBlock}>
        <Feather name="alert-circle" size={28} color={colors.danger} />
        <Text style={styles.tabStateText}>{error || 'Something went wrong.'}</Text>
        <CustomButton title="Retry" onPress={onRetry} variant="secondary" size="sm" />
      </View>
    );
  }
  if (isEmpty) {
    return (
      <View style={styles.tabStateBlock}>
        <Feather name={emptyIcon} size={28} color={colors.textTertiary} />
        <Text style={styles.tabStateText}>{emptyText}</Text>
      </View>
    );
  }
  return <>{children}</>;
};

const OverviewTab: React.FC<{
  customer: Customer;
  onToggleActive: () => void;
  isToggling: boolean;
}> = ({ customer, onToggleActive, isToggling }) => (
  <View style={styles.tabContent}>
    {/* Contact Info */}
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>Contact Information</Text>
      <InfoRow icon="mail" label="Email" value={customer.email || '—'} />
      <InfoRow icon="phone" label="Phone" value={customer.phone || '—'} />
      {!!customer.contactPerson && <InfoRow icon="user" label="Contact" value={customer.contactPerson} />}
      {!!customer.company && <InfoRow icon="briefcase" label="Company" value={customer.company} />}
      {!!customer.taxId && <InfoRow icon="hash" label="Tax ID" value={customer.taxId} />}
    </View>

    {/* Billing Address */}
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>Billing Address</Text>
      <Text style={styles.addressText}>{formatAddress(customer.billingAddress)}</Text>
    </View>

    {/* Shipping Address */}
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>Shipping Address</Text>
      <Text style={styles.addressText}>{formatAddress(customer.shippingAddress)}</Text>
    </View>

    {/* Terms & Dates */}
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>Terms & Details</Text>
      <InfoRow icon="clipboard" label="Payment Terms" value={PAYMENT_TERMS_LABELS[customer.paymentTerms as PaymentTerms] ?? customer.paymentTerms} />
      <InfoRow icon="credit-card" label="Credit Limit" value={formatCurrency(customer.creditLimit, 'Rs ')} />
      <InfoRow icon="calendar" label="Customer Since" value={formatDate(customer.createdAt)} />
      <InfoRow icon="refresh-cw" label="Last Updated" value={formatDate(customer.updatedAt)} />
    </View>

    {/* Notes */}
    {!!customer.notes && (
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Notes</Text>
        <Text style={styles.notesText}>{customer.notes}</Text>
      </View>
    )}

    {/* Toggle Active */}
    <CustomButton
      title={isToggling ? 'Updating…' : customer.isActive ? 'Deactivate Customer' : 'Activate Customer'}
      onPress={onToggleActive}
      variant={customer.isActive ? 'danger' : 'primary'}
      size="md"
      fullWidth
      disabled={isToggling}
    />
  </View>
);

function formatAddress(addr: Customer['billingAddress']): string {
  const line1 = addr.street;
  const line2 = [addr.city, addr.state, addr.zipCode].filter(Boolean).join(', ');
  const parts = [line1, line2, addr.country].filter(Boolean);
  return parts.length ? parts.join('\n') : 'Not provided';
}

const InfoRow: React.FC<{ icon: keyof typeof Feather.glyphMap; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Feather name={icon} size={14} color={colors.textSecondary} style={styles.infoIcon} />
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
  </View>
);

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flex: 1, marginRight: spacing.xs },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: spacing.xxs, padding: spacing.xxs / 2 },
  headerTitle: { ...typography.h3, flex: 1, color: colors.textPrimary },
  scrollContent: { paddingBottom: spacing.xxl },

  // ── Top Card ───────────────────────────────────
  topCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  topCardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  topCardLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
  topCardBalance: { ...typography.displaySm, color: colors.actionGreen },
  topCardPurchases: { ...typography.h4, color: colors.textPrimary },

  creditSection: { marginBottom: spacing.xs },
  creditHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xxs },
  creditLabel: { ...typography.labelMd, color: colors.textSecondary },
  creditPercent: { ...typography.labelMd, color: colors.textPrimary },
  creditBarTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  creditBarFill: { height: '100%', borderRadius: 4 },
  creditFooter: { marginTop: spacing.xxs },
  creditFooterText: { ...typography.caption, color: colors.textTertiary },

  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xxs,
    borderRadius: 6,
    marginTop: spacing.xxs,
  },
  statusBadgeText: { ...typography.labelSm },

  // ── Action Buttons ─────────────────────────────
  actionRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadows.xs,
  },
  actionLabel: { ...typography.overline, color: colors.textPrimary, textAlign: 'center' },

  // ── Tabs ───────────────────────────────────────
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.xxs,
    ...shadows.xs,
  },
  tab: { flex: 1, paddingVertical: spacing.xs, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: colors.actionGreen },
  tabText: { ...typography.h5, color: colors.textSecondary },
  tabTextActive: { color: colors.surface },

  // ── Tab Content ────────────────────────────────
  tabContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs, gap: 0 },
  tabStateBlock: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  tabStateText: { ...typography.bodySm, color: colors.textSecondary, textAlign: 'center' },

  // ── Info Cards ─────────────────────────────────
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...shadows.xs,
  },
  infoCardTitle: {
    ...typography.labelLg,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xxs + 1,
  },
  infoIcon: { marginRight: spacing.xs, width: 22 },
  infoLabel: { ...typography.bodySm, color: colors.textSecondary, width: 100 },
  infoValue: { ...typography.labelMd, color: colors.textPrimary, flex: 1 },

  addressText: { ...typography.bodySm, color: colors.textPrimary, lineHeight: 22 },
  notesText: { ...typography.bodySm, color: colors.textSecondary, lineHeight: 21 },

  // ── List Cards (Invoices / Payments) ───────────
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...shadows.xs,
  },
  listCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  listCardTitle: { ...typography.labelLg, color: colors.textPrimary },
  listCardSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  listCardAmount: { ...typography.h4, color: colors.textPrimary },
  listCardDetail: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.xs },

  miniStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  miniStatusText: { ...typography.overline },

  // ── Empty / Center ─────────────────────────────
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xxl },
  emptyText: { ...typography.bodyMd, color: colors.textSecondary, textAlign: 'center' }
});

export default CustomerDetailScreen;
