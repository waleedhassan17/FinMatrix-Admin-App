// ═══════════════════════════════════════════════════════
// FinMatrix — Bill List Screen
// Same pattern as InvoiceListScreen with
// Status: Draft / Open / Partially Paid / Paid / Overdue
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  fetchBills,
  selectBills,
  selectBillSearchQuery,
  selectBillStatusFilter,
  selectBillIsLoading,
  selectBillError,
  setSearchQuery,
  setStatusFilter,
  type BillStatusFilter,
} from './billListSlice';
import {
  ReportContainer,
  ReportHeader,
  HeaderAction,
  HeaderIconButton,
  EmptyBlock,
  LoadingBlock,
  ErrorBlock,
} from '../../../components/reports/ReportUI';
import { TxnCard } from '../../../components/transactions/TxnListUI';
import { FilterTabs, type TabItem } from '../../../components/shared/Tabs';
import { BILL_STATUS_COLORS, BILL_STATUS_LABELS } from '../../../models/billModel';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import type { Bill } from '../../../types';
import type { TransactionsStackParamList } from '../../../navigators/stacks/TransactionsStack';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
const { colors, radius, shadows, spacing, typography } = THEME;

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const BillListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();

  const bills = useAppSelector(selectBills);
  const searchQuery = useAppSelector(selectBillSearchQuery);
  const statusFilter = useAppSelector(selectBillStatusFilter);
  const isLoading = useAppSelector(selectBillIsLoading);
  const error = useAppSelector(selectBillError);
  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Refetch on focus so a payment or edit made elsewhere is reflected without
  // a manual pull — matches InvoiceListScreen.
  useFocusEffect(useCallback(() => { dispatch(fetchBills()); }, [dispatch]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchBills());
    setRefreshing(false);
  }, [dispatch]);

  // ── Tab counts ──────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bills.length, draft: 0, open: 0, partial: 0, paid: 0, overdue: 0, void: 0 };
    bills.forEach(b => { c[b.status] = (c[b.status] ?? 0) + 1; });
    return c;
  }, [bills]);

  const TABS: TabItem<BillStatusFilter>[] = [
    { label: 'All', value: 'all', count: counts.all },
    { label: 'Draft', value: 'draft', count: counts.draft },
    { label: 'Open', value: 'open', count: counts.open },
    { label: 'Overdue', value: 'overdue', count: counts.overdue },
    { label: 'Part. Paid', value: 'partial', count: counts.partial },
    { label: 'Paid', value: 'paid', count: counts.paid },
  ];

  // ── Filtered list ───────────────────────────────
  const filtered = useMemo(() => {
    let list = bills;
    if (statusFilter !== 'all') list = list.filter(b => b.status === statusFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        b => b.billNumber.toLowerCase().includes(q) || b.vendorName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [bills, statusFilter, searchQuery]);

  // ── Summary values ──────────────────────────────
  const { totalOutstanding, overdueAmount } = useMemo(() => {
    let outstanding = 0;
    let overdue = 0;
    bills.forEach(b => {
      if (b.status === 'open' || b.status === 'overdue' || b.status === 'partial') {
        const bal = b.total - b.amountPaid;
        outstanding += bal;
        if (b.status === 'overdue') overdue += bal;
      }
    });
    return { totalOutstanding: outstanding, overdueAmount: overdue };
  }, [bills]);

  // ── Render card ─────────────────────────────────
  const renderCard = useCallback(({ item }: { item: Bill }) => {
    const balance = item.total - item.amountPaid;

    return (
      <TxnCard
        number={item.billNumber}
        subtitle={item.vendorName}
        statusLabel={BILL_STATUS_LABELS[item.status]}
        statusColor={BILL_STATUS_COLORS[item.status]}
        metaLeft={`Issued: ${formatDate(item.issueDate)}`}
        metaRight={`Due: ${formatDate(item.dueDate)}`}
        primaryLabel="Total"
        primaryValue={formatCurrency(item.total, 'Rs ')}
        secondaryLabel="Balance"
        secondaryValue={formatCurrency(balance, 'Rs ')}
        secondaryColor={balance > 0 ? colors.danger : undefined}
        onPress={() => navigation.push('BillDetail', { billId: item.id })}
      />
    );
  }, [navigation]);

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  const initialLoading = isLoading && bills.length === 0;
  const loadFailed = !!error && bills.length === 0;

  // Genuine first-run: no bills at all, and neither loading nor failed.
  // Hide summary, tabs and FAB for a clean, professional zero-state.
  const isFirstRun = !initialLoading && !loadFailed && bills.length === 0;
  // Summary / search / tabs only make sense once there is a list to act on.
  const showChrome = !initialLoading && !loadFailed && !isFirstRun;

  return (
    <ReportContainer>
      <ReportHeader
        title="Bills"
        onBack={() => navigation.goBack()}
        right={
          <>
            <HeaderIconButton icon="search" onPress={() => setSearchOpen(p => !p)} />
            <HeaderAction label="New" onPress={() => navigation.push('BillForm')} />
          </>
        }
      />

      {/* ── Summary Bar — hidden on first-run ───── */}
      {!showChrome ? null : (
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryMoney}>{formatCurrency(totalOutstanding, 'Rs ')}</Text>
          <Text style={styles.summaryLabel}>Outstanding</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryMoney, { color: colors.danger }]}>
            {formatCurrency(overdueAmount, 'Rs ')}
          </Text>
          <Text style={styles.summaryLabel}>Overdue</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{counts.all}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
      </View>
      )}

      {/* ── Search ──────────────────────────────── */}
      {searchOpen && showChrome && (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={v => dispatch(setSearchQuery(v))}
            placeholder="Search bills…"
            placeholderTextColor={colors.textTertiary}
            autoFocus
          />
        </View>
      )}

      {/* ── Filter Tabs — hidden on first-run ───── */}
      {showChrome && (
        <FilterTabs
          tabs={TABS}
          active={statusFilter}
          onChange={v => dispatch(setStatusFilter(v))}
        />
      )}

      {/* ── List / states ───────────────────────── */}
      {initialLoading ? (
        <LoadingBlock />
      ) : loadFailed ? (
        <ErrorBlock message={error!} onRetry={() => dispatch(fetchBills())} />
      ) : isFirstRun ? (
        <EmptyBlock
          icon="file-text"
          title="No bills yet"
          hint="Record your first vendor bill to track expenses and payments."
          actionLabel="Create Bill"
          onAction={() => navigation.push('BillForm')}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <EmptyBlock
              icon="search"
              title="No bills found"
              hint={searchQuery ? `No results for "${searchQuery}"` : 'Try a different filter.'}
            />
          }
        />
      )}
    </ReportContainer>
  );
};

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
// Scaffold, tabs and cards now come from ReportUI / TxnListUI; what remains
// is the summary strip and the search field, which are specific to this screen.
const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    ...shadows.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryValue: { ...typography.h3, color: colors.actionGreen },
  // Money sits a step smaller than the plain count so a long figure fits.
  summaryMoney: { ...typography.h5, color: colors.actionGreen, fontVariant: ['tabular-nums'] },
  summaryLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  searchRow: { paddingHorizontal: spacing.xl, marginBottom: spacing.xs },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: THEME.form.controlRadius,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.bodyMd,
    color: colors.textPrimary,
  },

  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xxs, paddingBottom: spacing.xxxxl + spacing.xxl },
});

export default BillListScreen;
