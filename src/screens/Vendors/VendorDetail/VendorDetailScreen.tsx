// ═══════════════════════════════════════════════════════
// FinMatrix — Vendor Detail Screen
// ═══════════════════════════════════════════════════════

import React, { useCallback, useMemo, useState } from 'react';
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
import { selectVendors, upsertVendor } from '../VendorList/vendorListSlice';
import { selectAccounts } from '../../ChartOfAccounts/COAList/coaListSlice';
import {
  selectVendorDetail,
  selectVendorDetailTab,
  selectVendorDetailStatus,
  selectVendorDetailBills,
  selectVendorDetailPayments,
  setActiveTab,
  resetVendorDetail,
  fetchVendorDetail,
  fetchVendorBills,
  fetchVendorPayments,
  toggleActiveOnDetail,
  type VendorDetailTab
} from './vendorDetailSlice';
import CustomButton from '../../../Custom-Components/CustomButton';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { PAYMENT_TERMS_LABELS } from '../../../models/vendorModel';
import {
  vendorSingleSerializer,
  type VendorBillRow,
  type VendorPaymentRow
} from '../../../serializers/vendorSerializer';
import { getVendorStatementAPI } from '../../../networks/purchases/vendorNetwork';
import { shareVendorStatementPdf } from '../../../utils/statementPdf';
import { useCompanyInfo } from '../../../utils/companyInfo';
import type { PaymentTerms, Vendor } from '../../../types';
import type { MoreStackParamList } from '../../../navigators/stacks/MoreStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<MoreStackParamList>;
type DetailRoute = RouteProp<MoreStackParamList, 'VendorDetail'>;

const TABS: { key: VendorDetailTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'bills', label: 'Bills' },
  { key: 'payments', label: 'Payments' },
];

const BILL_STATUS_COLORS: Record<string, string> = {
  paid: colors.success,
  open: colors.secondary,
  received: colors.secondary,
  partial: colors.warning,
  overdue: colors.danger,
  draft: colors.textTertiary,
  void: colors.textTertiary
};

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const VendorDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const dispatch = useAppDispatch();
  const companyInfo = useCompanyInfo();

  const vendors = useAppSelector(selectVendors);
  const accounts = useAppSelector(selectAccounts);
  const activeTab = useAppSelector(selectVendorDetailTab);
  const detailVendor = useAppSelector(selectVendorDetail);
  const detailStatus = useAppSelector(selectVendorDetailStatus);

  // Prefer the detail-slice copy (always API-fresh) and fall back
  // to the list copy if the detail fetch is still in flight.
  const vendor = detailVendor ?? vendors.find(v => v.id === route.params.vendorId);

  const expenseAccountName = useMemo(() => {
    if (!vendor?.defaultExpenseAccountId) return '';
    const acct = accounts.find(a => a.id === vendor.defaultExpenseAccountId);
    return acct ? `${acct.code} – ${acct.name}` : vendor.defaultExpenseAccountId;
  }, [vendor, accounts]);

  const billsTab = useAppSelector(selectVendorDetailBills);
  const paymentsTab = useAppSelector(selectVendorDetailPayments);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSharingStatement, setIsSharingStatement] = useState(false);
  const vendorId = route.params.vendorId;

  React.useEffect(() => {
    return () => { dispatch(resetVendorDetail()); };
  }, [dispatch]);

  // Refetch whenever the screen gains focus so the balance and histories
  // stay fresh after paying a bill / creating one elsewhere.
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchVendorDetail(vendorId));
      dispatch(fetchVendorBills({ vendorId }));
      dispatch(fetchVendorPayments({ vendorId }));
    }, [dispatch, vendorId]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchVendorDetail(vendorId)),
        dispatch(fetchVendorBills({ vendorId })),
        dispatch(fetchVendorPayments({ vendorId })),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch, vendorId]);

  if (!vendor) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          {detailStatus === 'loading' ? (
            <Text style={styles.emptyText}>Loading vendor…</Text>
          ) : (
            <>
              <Text style={styles.emptyIcon}>🏪</Text>
              <Text style={styles.emptyText}>Vendor not found</Text>
              <CustomButton title="Go Back" onPress={() => navigation.goBack()} variant="primary" size="md" />
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ── Action handlers ─────────────────────────────
  // initial: false on both hops. Without it React Navigation initialises the
  // Transactions stack as [BillForm] with no hub underneath, so back has
  // nothing to pop and falls through to the tab navigator's 'firstRoute'
  // default — the Dashboard — while stranding the form on that tab.
  const handleCreateBill = () => {
    (navigation as unknown as NativeStackNavigationProp<Record<string, object>>)
      .navigate('TransactionsStack', {
        screen: 'BillForm',
        params: { vendorId: vendor.id },
        initial: false
      });
  };
  const handleRecordPayment = () => {
    (navigation as unknown as NativeStackNavigationProp<Record<string, object>>)
      .navigate('TransactionsStack', {
        screen: 'PayBills',
        params: { vendorId: vendor.id },
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
      const payload = await getVendorStatementAPI(vendor.id, {
        startDate: toIso(start),
        endDate: toIso(now),
      });
      const result = await shareVendorStatementPdf(payload, companyInfo);
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
    const result: any = await dispatch(toggleActiveOnDetail(vendor.id));
    if (!result.error && result.payload) {
      // Keep the list slice in sync so the badge updates everywhere.
      const updated = vendorSingleSerializer(result.payload);
      if (updated) dispatch(upsertVendor(updated));
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{vendor.name}</Text>
        </View>
        <CustomButton
          title="Edit"
          onPress={() => navigation.navigate('VendorForm', { vendorId: vendor.id })}
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
        {/* ── Top Card: Balance ───────────────────── */}
        <View style={styles.topCard}>
          <View style={styles.topCardRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.topCardLabel}>Outstanding Balance</Text>
              <Text style={styles.topCardBalance}>{formatCurrency(vendor.balance, 'Rs ')}</Text>
            </View>
          </View>

          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: vendor.isActive ? colors.success + '18' : colors.textTertiary + '18' }]}>
            <Text style={[styles.statusBadgeText, { color: vendor.isActive ? colors.success : colors.textTertiary }]}>
              {vendor.isActive ? '● Active' : '● Inactive'}
            </Text>
          </View>
        </View>

        {/* ── Action Buttons ─────────────────────── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleCreateBill} activeOpacity={0.7}>
            <Feather name="file-text" size={20} color={colors.actionGreen} style={{ marginBottom: spacing.xxs }} />
            <Text style={styles.actionLabel}>Create Bill</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleRecordPayment} activeOpacity={0.7}>
            <Feather name="dollar-sign" size={20} color={colors.actionGreen} style={{ marginBottom: spacing.xxs }} />
            <Text style={styles.actionLabel}>Record Payment</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, isSharingStatement && { opacity: 0.5 }]}
            onPress={handleSendStatement}
            activeOpacity={0.7}
            disabled={isSharingStatement}
          >
            <Feather name="send" size={20} color={colors.actionGreen} style={{ marginBottom: spacing.xxs }} />
            <Text style={styles.actionLabel}>{isSharingStatement ? 'Preparing…' : 'Send Statement'}</Text>
          </TouchableOpacity>
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
          <OverviewTab vendor={vendor} expenseAccountName={expenseAccountName} onToggleActive={handleToggleActive} />
        )}
        {activeTab === 'bills' && (
          <BillsTab
            tab={billsTab}
            onRetry={() => dispatch(fetchVendorBills({ vendorId }))}
            onLoadMore={() => dispatch(fetchVendorBills({ vendorId, page: billsTab.page + 1 }))}
          />
        )}
        {activeTab === 'payments' && (
          <PaymentsTab
            tab={paymentsTab}
            onRetry={() => dispatch(fetchVendorPayments({ vendorId }))}
            onLoadMore={() => dispatch(fetchVendorPayments({ vendorId, page: paymentsTab.page + 1 }))}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

const OverviewTab: React.FC<{
  vendor: Vendor;
  expenseAccountName: string;
  onToggleActive: () => void;
}> = ({ vendor, expenseAccountName, onToggleActive }) => (
  <View style={styles.tabContent}>
    {/* Contact Info */}
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>Contact Information</Text>
      <InfoRow icon="✉️" label="Email" value={vendor.email} />
      <InfoRow icon="📞" label="Phone" value={vendor.phone} />
      {!!vendor.contactPerson && <InfoRow icon="👤" label="Contact" value={vendor.contactPerson} />}
      {!!vendor.taxId && <InfoRow icon="🆔" label="Tax ID" value={vendor.taxId} />}
    </View>

    {/* Address */}
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>Address</Text>
      <Text style={styles.addressText}>
        {vendor.address}{'\n'}
        {vendor.city}{vendor.state ? `, ${vendor.state}` : ''} {vendor.zipCode}{'\n'}
        {vendor.country}
      </Text>
    </View>

    {/* Terms & Details */}
    <View style={styles.infoCard}>
      <Text style={styles.infoCardTitle}>Terms & Details</Text>
      <InfoRow icon="📋" label="Payment Terms" value={PAYMENT_TERMS_LABELS[vendor.paymentTerms as PaymentTerms] ?? vendor.paymentTerms} />
      {!!expenseAccountName && <InfoRow icon="📒" label="Expense Acct" value={expenseAccountName} />}
      <InfoRow icon="📅" label="Vendor Since" value={formatDate(vendor.createdAt)} />
      <InfoRow icon="🔄" label="Last Updated" value={formatDate(vendor.updatedAt)} />
    </View>

    {/* Notes */}
    {!!vendor.notes && (
      <View style={styles.infoCard}>
        <Text style={styles.infoCardTitle}>Notes</Text>
        <Text style={styles.notesText}>{vendor.notes}</Text>
      </View>
    )}

    {/* Toggle Active */}
    <CustomButton
      title={vendor.isActive ? 'Deactivate Vendor' : 'Activate Vendor'}
      onPress={onToggleActive}
      variant={vendor.isActive ? 'danger' : 'primary'}
      size="md"
      fullWidth
    />
  </View>
);

const TabStateBlock: React.FC<{
  loading: boolean;
  failed: boolean;
  error: string;
  isEmpty: boolean;
  emptyText: string;
  onRetry: () => void;
  children: React.ReactNode;
}> = ({ loading, failed, error, isEmpty, emptyText, onRetry, children }) => {
  if (loading && isEmpty) {
    return (
      <View style={styles.tabStateBlock}>
        <ActivityIndicator size="small" color={colors.actionGreen} />
        <Text style={styles.tabStateText}>Loading…</Text>
      </View>
    );
  }
  if (failed && isEmpty) {
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
        <Feather name="inbox" size={28} color={colors.textTertiary} />
        <Text style={styles.tabStateText}>{emptyText}</Text>
      </View>
    );
  }
  return <>{children}</>;
};

const BILL_STATUS_LABELS: Record<string, string> = {
  paid: 'Paid',
  open: 'Open',
  received: 'Received',
  partial: 'Partial',
  overdue: 'Overdue',
  draft: 'Draft',
  void: 'Void'
};

const BillsTab: React.FC<{
  tab: { rows: VendorBillRow[]; status: string; error: string; page: number; totalPages: number };
  onRetry: () => void;
  onLoadMore: () => void;
}> = ({ tab, onRetry, onLoadMore }) => (
  <TabStateBlock
    loading={tab.status === 'loading' || tab.status === 'idle'}
    failed={tab.status === 'failed'}
    error={tab.error}
    isEmpty={tab.rows.length === 0}
    emptyText="No bills from this vendor yet."
    onRetry={onRetry}
  >
    <View style={styles.tabContent}>
      {tab.rows.map(bill => (
        <View key={bill.id} style={styles.listCard}>
          <View style={styles.listCardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listCardTitle}>{bill.billNumber}</Text>
              <Text style={styles.listCardSub}>{formatDate(bill.date)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.listCardAmount}>{formatCurrency(bill.amount, 'Rs ')}</Text>
              <View style={[styles.miniStatusBadge, { backgroundColor: (BILL_STATUS_COLORS[bill.status] ?? colors.textTertiary) + '18' }]}>
                <Text style={[styles.miniStatusText, { color: BILL_STATUS_COLORS[bill.status] ?? colors.textTertiary }]}>
                  {BILL_STATUS_LABELS[bill.status] ?? bill.status}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.listCardDetail}>
            {bill.dueDate ? `Due: ${formatDate(bill.dueDate)}` : ''}
            {bill.balance > 0 ? `  ·  Balance: ${formatCurrency(bill.balance, 'Rs ')}` : ''}
          </Text>
        </View>
      ))}
      {tab.page < tab.totalPages && (
        <CustomButton title="Load more" variant="secondary" size="sm" onPress={onLoadMore} />
      )}
    </View>
  </TabStateBlock>
);

const PaymentsTab: React.FC<{
  tab: { rows: VendorPaymentRow[]; status: string; error: string; page: number; totalPages: number };
  onRetry: () => void;
  onLoadMore: () => void;
}> = ({ tab, onRetry, onLoadMore }) => (
  <TabStateBlock
    loading={tab.status === 'loading' || tab.status === 'idle'}
    failed={tab.status === 'failed'}
    error={tab.error}
    isEmpty={tab.rows.length === 0}
    emptyText="No payments made to this vendor yet."
    onRetry={onRetry}
  >
    <View style={styles.tabContent}>
      {tab.rows.map(pay => (
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
        </View>
      ))}
      {tab.page < tab.totalPages && (
        <CustomButton title="Load more" variant="secondary" size="sm" onPress={onLoadMore} />
      )}
    </View>
  </TabStateBlock>
);

const InfoRow: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoIcon}>{icon}</Text>
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
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: spacing.xs },
  backBtn: { marginRight: spacing.xxs, padding: spacing.xxs / 2 },
  backIcon: { ...typography.h1, color: colors.secondary, fontWeight: typography.labelLg.fontWeight },
  headerTitle: { ...THEME.typography.h2, color: colors.textPrimary, flex: 1 },
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
  topCardLabel: { ...THEME.typography.caption, color: colors.textSecondary, marginBottom: 2 },
  topCardBalance: { ...THEME.typography.h1, color: colors.actionGreen },

  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xxs,
    borderRadius: 6,
    marginTop: spacing.xxs,
  },
  statusBadgeText: { ...THEME.typography.caption, fontWeight: typography.labelLg.fontWeight },

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
  actionIcon: { ...typography.h2, marginBottom: spacing.xxs },
  actionLabel: { ...THEME.typography.labelSm, color: colors.textPrimary, textAlign: 'center' },

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
  tabText: { ...THEME.typography.labelLg, color: colors.textSecondary },
  tabTextActive: { color: colors.surface },

  // ── Tab Content ────────────────────────────────
  tabContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs },

  // ── Info Cards ─────────────────────────────────
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...shadows.xs,
  },
  infoCardTitle: {
    ...THEME.typography.h4,
    
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xxs + 1,
  },
  infoIcon: { ...typography.bodySm, marginRight: spacing.xs, width: 22 },
  infoLabel: { ...THEME.typography.bodySm, color: colors.textSecondary, width: 100 },
  infoValue: { ...THEME.typography.labelMd,  color: colors.textPrimary, flex: 1 },

  addressText: { ...THEME.typography.bodyMd, color: colors.textPrimary, lineHeight: 22 },
  notesText: { ...THEME.typography.bodyMd, color: colors.textSecondary, lineHeight: 21 },

  // ── List Cards (Bills / Payments) ──────────────
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...shadows.xs,
  },
  listCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  listCardTitle: { ...THEME.typography.h4,  color: colors.textPrimary },
  listCardSub: { ...THEME.typography.caption, color: colors.textSecondary, marginTop: 2 },
  listCardAmount: { ...THEME.typography.h4,  color: colors.textPrimary },
  listCardDetail: { ...THEME.typography.caption, color: colors.textTertiary, marginTop: spacing.xs },

  miniStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  tabStateBlock: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  tabStateText: { ...typography.bodySm, color: colors.textSecondary, textAlign: 'center' },
  miniStatusText: { ...THEME.typography.labelSm, fontWeight: typography.labelLg.fontWeight },

  // ── Empty / Center ─────────────────────────────
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  emptyIcon: { ...typography.displayLg },
  emptyText: { ...typography.bodyLg, color: colors.textSecondary }
});

export default VendorDetailScreen;
