// ═══════════════════════════════════════════════════════
// FinMatrix — PO List Screen
// Mirrors Bills / Sales Orders / Estimates list UX:
//   • Always-rendered FlatList
//   • Initial centered loader only when (isLoading && items=0)
//   • Pull-to-refresh via separate `refreshing` state
//   • Pill status tabs, summary cards, FAB, "+ New" sm button
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  fetchPurchaseOrders,
  selectItems,
  selectSearchQuery,
  selectStatusFilter,
  selectIsLoading,
  selectError,
  selectCounts,
  selectListTotals,
  setSearchQuery,
  setStatusFilter,
  type POStatusFilter,
} from './poListSlice';
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
import { PO_STATUS_COLORS, PO_STATUS_LABELS, formatPODate } from '../../../models/purchaseOrderModel';
import { formatCurrency } from '../../../utils/formatters';
import type { PurchaseOrder } from '../../../types';
import type { TransactionsStackParamList } from '../../../navigators/stacks/TransactionsStack';
import { usePendingApprovals } from '../../../hooks/usePendingApprovals';

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
const { colors, radius, shadows, spacing, typography } = THEME;

const POListScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();

  const rawItems = useAppSelector(selectItems);
  const searchQuery = useAppSelector(selectSearchQuery);
  const statusFilter = useAppSelector(selectStatusFilter);
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectError);
  const rawCounts = useAppSelector(selectCounts);
  const totals = useAppSelector(selectListTotals);

  const items = useMemo(() => (Array.isArray(rawItems) ? rawItems : []), [rawItems]);
  const counts = useMemo(
    () => ({
      all: Number(rawCounts?.all ?? 0),
      draft: Number(rawCounts?.draft ?? 0),
      sent: Number(rawCounts?.sent ?? 0),
      partially_received: Number(rawCounts?.partially_received ?? 0),
      fully_received: Number(rawCounts?.fully_received ?? 0),
      closed: Number(rawCounts?.closed ?? 0),
    }),
    [rawCounts],
  );

  const [searchOpen, setSearchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // A staff member's PO does not exist until the owner approves it, so it is
  // absent from this list entirely — which reads as "my request vanished".
  // Showing the pending requests above the list closes that gap without
  // faking a PO row: these are requests, and they say so.
  //
  // The role gate, the fetch and the fail-soft moved into the hook; this was
  // the first of four copies of them.
  const {
    requests: pendingRequests,
    reload: loadPending,
    showsPending,
  } = usePendingApprovals('po', 'purchaseOrder.create');

  // Re-fetch whenever filter/search changes. Also covers the first load.
  useEffect(() => {
    dispatch(fetchPurchaseOrders());
  }, [statusFilter, searchQuery, dispatch]);

  // On focus, not just on mount: the owner approves elsewhere, and coming back
  // to this screen is exactly when the real PO should appear and the pending
  // row drop off. Without this the list was stale until a manual pull.
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchPurchaseOrders());
      void loadPending();
    }, [dispatch, loadPending]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([dispatch(fetchPurchaseOrders()), loadPending()]);
    setRefreshing(false);
  }, [dispatch, loadPending]);

  const TABS: TabItem<POStatusFilter>[] = [
    { label: 'All', value: 'all', count: counts.all },
    { label: 'Requisitions', value: 'draft', count: counts.draft },
    { label: 'Sent', value: 'sent', count: counts.sent },
    { label: 'Partial', value: 'partially_received', count: counts.partially_received },
    { label: 'Received', value: 'fully_received', count: counts.fully_received },
    { label: 'Closed', value: 'closed', count: counts.closed },
  ];

  // ── Render card ─────────────────────────────────
  const renderCard = useCallback(
    ({ item }: { item: PurchaseOrder }) => {
      const lines = Array.isArray(item.lines) ? item.lines : [];
      const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
      const totalReceived = lines.reduce((s, l) => s + l.receivedQuantity, 0);
      const receivedColor =
        totalQty > 0 && totalReceived === totalQty
          ? colors.success
          : totalReceived > 0
            ? colors.warning
            : undefined;

      return (
        <TxnCard
          number={item.poNumber}
          subtitle={item.vendorName}
          statusLabel={PO_STATUS_LABELS[item.status]}
          statusColor={PO_STATUS_COLORS[item.status]}
          metaLeft={`Ordered: ${formatPODate(item.orderDate)}`}
          metaRight={`Expected: ${formatPODate(item.expectedDate)}`}
          primaryLabel="Total"
          primaryValue={formatCurrency(item.total, 'Rs ')}
          secondaryLabel="Received"
          secondaryValue={`${totalReceived} / ${totalQty}`}
          secondaryColor={receivedColor}
          onPress={() => navigation.push('PODetail', { poId: item.id })}
        />
      );
    },
    [navigation],
  );

  /**
   * The requests waiting on the owner, above the real POs.
   *
   * Read-only on purpose: there is no PO to open yet, so tapping goes to My
   * Requests — the one screen that owns request status, including a rejection
   * and its reason. Rendering an editable-looking PO row here would promise
   * something that does not exist.
   */
  const openMyRequests = useCallback(() => {
    // This screen sits in the Transactions tab; My Requests is in the staff
    // More tab, so the hop goes through the parent tab navigator (same pattern
    // as the delivery reversal hand-off).
    const tabs = (navigation.getParent() ?? navigation) as unknown as {
      navigate: (name: string, params?: Record<string, unknown>) => void;
    };
    // initial: false puts StaffMoreHub underneath, so back returns there
    // instead of finding an empty stack and falling through to the Dashboard.
    tabs.navigate('StaffMoreStack', { screen: 'MyRequests', initial: false });
  }, [navigation]);

  const PendingSection = useMemo(() => {
    if (!showsPending || pendingRequests.length === 0) return null;
    return (
      <View style={styles.pendingBlock}>
        <Text style={styles.pendingHeading}>
          Waiting for approval · {pendingRequests.length}
        </Text>
        {pendingRequests.map(req => (
          <TouchableOpacity
            key={req.id}
            style={styles.pendingRow}
            onPress={openMyRequests}
            activeOpacity={0.7}
          >
            <Feather name="clock" size={15} color={colors.warning} />
            <View style={styles.pendingBody}>
              <Text style={styles.pendingSummary} numberOfLines={2}>
                {req.summary}
              </Text>
              <Text style={styles.pendingMeta}>
                Sent to the owner · not a purchase order yet
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>
    );
  }, [showsPending, pendingRequests, openMyRequests]);

  // Only the FIRST load takes over the screen; background re-fetches must
  // never hide the FlatList (that used to leave a stuck spinner over no data).
  const initialLoading = isLoading && items.length === 0 && !refreshing;
  const loadFailed = !!error && items.length === 0;

  // Genuine first-run: no POs at all (not a filter/search result). Hide the
  // summary, tabs and FAB for a clean, professional zero-state.
  const isFirstRun =
    !initialLoading && !loadFailed && items.length === 0 && statusFilter === 'all' && !searchQuery.trim();
  // Summary / search / tabs only make sense once there is a list to act on.
  const showChrome = !initialLoading && !loadFailed && !isFirstRun;

  return (
    <ReportContainer>
      <ReportHeader
        title="Purchase Orders"
        onBack={() => navigation.goBack()}
        right={
          <>
            <HeaderIconButton icon="search" onPress={() => setSearchOpen(p => !p)} />
            <HeaderAction label="New" onPress={() => navigation.push('POForm')} />
          </>
        }
      />

      {/* ── Summary — the loader keeps it visible, as it did before ─────── */}
      {(showChrome || initialLoading) && (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totals.totalPOs}</Text>
            <Text style={styles.summaryLabel}>Orders</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryMoney}>{formatCurrency(totals.totalValue, 'Rs ')}</Text>
            <Text style={styles.summaryLabel}>Total Value</Text>
          </View>
        </View>
      )}

      {/* ── Waiting on the owner ────────────────────────────────────────────
          Above the list and outside `showChrome` on purpose: a staff member's
          very first PO is a pending request with no PO behind it, which is
          exactly the first-run state — the one time this strip matters most. */}
      {PendingSection}

      {/* ── Search ──────────────────────────────── */}
      {searchOpen && showChrome && (
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={v => dispatch(setSearchQuery(v))}
            placeholder="Search purchase orders…"
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
        <ErrorBlock message={error!} onRetry={() => dispatch(fetchPurchaseOrders())} />
      ) : isFirstRun ? (
        <EmptyBlock
          icon="clipboard"
          title="No purchase orders yet"
          hint="Create your first purchase order to track what you've ordered from vendors."
          actionLabel="Create PO"
          onAction={() => navigation.push('POForm')}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
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
              title="No purchase orders found"
              hint={searchQuery ? `No results for "${searchQuery}"` : 'Try a different filter.'}
            />
          }
        />
      )}
    </ReportContainer>
  );
};

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

  // Deliberately lighter than a TxnCard: these are not purchase orders, and
  // should not compete with the real ones below.
  pendingBlock: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xs,
  },
  pendingHeading: {
    ...typography.overline,
    color: colors.textTertiary,
    marginBottom: spacing.xs,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warning + '0F',
    borderWidth: 1,
    borderColor: colors.warning + '33',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xxs,
  },
  pendingBody: { flex: 1 },
  pendingSummary: { ...typography.labelMd, color: colors.textPrimary },
  pendingMeta: { ...typography.caption, color: colors.textTertiary, marginTop: 1 },
});

export default POListScreen;
