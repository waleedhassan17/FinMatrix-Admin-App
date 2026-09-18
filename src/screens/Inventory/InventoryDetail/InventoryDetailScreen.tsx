// ═══════════════════════════════════════════════════════
// FinMatrix — Inventory Detail Screen
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar
} from 'react-native';
import { Alert } from '../../../utils/alert';
import Toast from 'react-native-toast-message';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { HEADER_NAVY } from '../../../components/reports/ReportUI';
import { THEME } from '../../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  selectInventoryItems,
  setOpeningStock,
  toggleInventoryItem
} from '../InventoryList/inventoryListSlice';
import {
  selectInventoryDetailTab,
  selectInventoryDetailMovements,
  selectInventoryDetailStatus,
  selectInventoryDetailError,
  selectInventoryDetailPOs,
  selectInventoryDetailPendingPOs,
  selectInventoryDetailPOStatus,
  selectInventoryDetailPOError,
  selectInventoryDetailPOTruncated,
  setActiveTab,
  resetInventoryDetail,
  fetchItemMovements,
  fetchItemPurchaseOrders,
  PO_FETCH_LIMIT
} from './inventoryDetailSlice';
import type { InventoryDetailTab } from './inventoryDetailSlice';
import { movementLabel } from '../../../models/inventoryModel';
import { PO_STATUS_COLORS, PO_STATUS_LABELS } from '../../../models/purchaseOrderModel';
import { useCapability } from '../../../hooks/useCapability';
import type { PurchaseOrderStatus } from '../../../types';
import { isFeatureEnabled } from '../../../utils/featureGates';
import { warehouseAgencies } from '../../../models/agencyModel';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import type { InventoryStackParamList } from '../../../navigators/stacks/InventoryStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type DetailRoute = RouteProp<InventoryStackParamList, 'InventoryDetail'>;
type Nav = NativeStackNavigationProp<InventoryStackParamList>;

// ── Helpers ───────────────────────────────────────────
const getStockStatusLabel = (qty: number, reorder: number) => {
  if (qty <= 0) return { label: 'Out of Stock', color: colors.danger };
  if (qty <= reorder) return { label: 'Low Stock', color: colors.warning };
  return { label: 'In Stock', color: colors.success };
};

// PO_STATUS_LABELS is the canonical vocabulary, but "Partially Received" and
// "Fully Received" are list-screen widths — in a badge sharing a row with a PO
// number, a vendor and a quantity they squeeze the number to an ellipsis. Only
// the two long ones are shortened; the colours stay canonical.
//
// These render uppercased: styles.poStatusText spreads typography.overline,
// which carries textTransform. The casing here is the source string, not what
// the badge shows.
const shortPOStatus = (status: PurchaseOrderStatus) => {
  if (status === 'partially_received') return 'Partial';
  if (status === 'fully_received') return 'Received';
  return PO_STATUS_LABELS[status] ?? status;
};

// Keyed to the movement types the API actually emits. This used to switch on
// 'Purchase' / 'Sale' / 'Adjustment', none of which the backend has ever sent,
// so every badge fell through to grey.
const getMovementColor = (type: string) => {
  switch (type) {
    case 'receipt': return colors.success;
    case 'return': return colors.success;
    case 'sale': return colors.danger;
    case 'delivery': return colors.danger;
    case 'adjustment': return colors.warning;
    case 'transfer': return colors.secondary;
    default: return colors.textSecondary;
  }
};

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
const InventoryDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const dispatch = useAppDispatch();

  const items = useAppSelector(selectInventoryItems);
  const item = items.find(i => i.itemId === route.params.itemId);
  const activeTab = useAppSelector(selectInventoryDetailTab);
  const movements = useAppSelector(selectInventoryDetailMovements);
  const movementsStatus = useAppSelector(selectInventoryDetailStatus);
  const movementsError = useAppSelector(selectInventoryDetailError);
  const purchaseOrders = useAppSelector(selectInventoryDetailPOs);
  const pendingPORequests = useAppSelector(selectInventoryDetailPendingPOs);
  const poStatus = useAppSelector(selectInventoryDetailPOStatus);
  const poError = useAppSelector(selectInventoryDetailPOError);
  const poTruncated = useAppSelector(selectInventoryDetailPOTruncated);
  // Whether the tab currently has anything to show. A re-fetch keeps these on
  // screen rather than collapsing the card to a spinner.
  const hasPORows = purchaseOrders.length > 0 || pendingPORequests.length > 0;

  // Staff may raise a purchase order — it files a request the owner approves,
  // rather than the 403 this screen used to assume (see utils/capabilities.ts).
  // The label says which of the two tapping will do.
  const poCap = useCapability('purchaseOrder.create');

  const itemId = route.params.itemId;

  useEffect(() => {
    return () => { dispatch(resetInventoryDetail()); };
  }, [dispatch]);

  const loadDetailData = useCallback(() => {
    if (!itemId) return;
    dispatch(fetchItemMovements(itemId));
    dispatch(fetchItemPurchaseOrders({ itemId, includePending: poCap.needsApproval }));
  }, [dispatch, itemId, poCap.needsApproval]);

  // On focus, not on mount. Both lists live in one shared slice, so opening a
  // second item overwrites them and unmounting that item clears them — coming
  // back to this one would otherwise show an empty table. Refetching on focus
  // also picks up an adjustment just posted from here, and the PO (or the
  // request for one) just raised from the button below.
  useFocusEffect(loadDetailData);

  const agencyName = useMemo(() => {
    if (!item?.sourceAgencyId) return null;
    return warehouseAgencies.find(a => a.id === item.sourceAgencyId)?.name ?? null;
  }, [item]);

  const handleEdit = useCallback(() => {
    if (item) navigation.navigate('InventoryForm', { itemId: item.itemId });
  }, [item, navigation]);

  // Opening stock: what was already on the shelf when the company started using
  // FinMatrix. Offered only while the item has never held stock — after that a
  // correction is an adjustment, and the server enforces the same rule.
  const handleOpeningStock = useCallback(() => {
    if (!item) return;
    if (!Alert.prompt) {
      Alert.alert(
        'Opening Stock',
        'Recording opening stock needs text entry, which this platform does not support in a dialog. Use a Purchase Order to bring the stock in instead.',
      );
      return;
    }
    Alert.prompt(
          'Opening Stock',
          `How many ${item.name} did you already own?\n\nThis records existing stock against Opening Balance Equity. It does not affect profit.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Record',
              onPress: async (val?: string) => {
                const qty = parseFloat(val ?? '');
                if (isNaN(qty) || qty <= 0) return;
                try {
                  await dispatch(
                    setOpeningStock({ itemId: item.itemId, quantity: qty, notes: 'Opening stock' }),
                  ).unwrap();
                  Toast.show({
                    type: 'success',
                    text1: 'Opening stock recorded',
                    text2: `${item.name}: ${qty} on hand`
                  });
                } catch (e: any) {
                  Toast.show({
                    type: 'error',
                    text1: 'Could not record opening stock',
                    text2: e?.message || 'Please try again.',
                  });
                }
              },
            },
          ],
          'plain-text',
          '',
          'numeric',
        );
  }, [item, dispatch]);

  // The full Adjustment screen, not an inline prompt. The old quick action
  // hardcoded reason:'correction' so damage, theft and obsolescence were all
  // filed as corrections — and it ran on Alert.prompt, which is iOS-only, so
  // on Android it offered the Edit screen instead, which cannot move stock.
  const handleAdjust = useCallback(() => {
    if (item) navigation.navigate('Adjustment', { itemId: item.itemId });
  }, [item, navigation]);

  // POForm is registered in THIS stack (see navigations-maps/Inventory), not
  // reached by hopping to the Transactions tab: raising a PO starts here and
  // has to come back here. The old cross-tab navigate left the form stranded on
  // the Transactions tab and sent back to the Dashboard.
  const handleCreatePO = useCallback(() => {
    if (!item) return;
    navigation.navigate('POForm', { prefillItemId: item.itemId });
  }, [item, navigation]);

  // PODetail stays a cross-tab hop — unlike POForm it is a document owned by
  // the Transactions tab, and it reaches BillDetail/BillList, which this stack
  // does not have.
  //
  // `initial: false` is load-bearing: without it React Navigation builds the
  // target stack as [PODetail] alone, so back has nothing to pop and falls
  // through to the tab navigator's 'firstRoute' default — the Dashboard. The
  // flag makes it build the real initial state (TransactionsHub) underneath,
  // and the nested params still ride along on the navigate it dispatches.
  const handleOpenPO = useCallback((poId: string) => {
    (navigation as unknown as NativeStackNavigationProp<Record<string, object>>)
      .navigate('TransactionsStack', { screen: 'PODetail', params: { poId }, initial: false });
  }, [navigation]);

  // A pending request is not a purchase order and has nothing to open, so it
  // goes where the PO list's pending strip goes. My Requests is in the staff
  // More tab, so the hop goes through the parent tab navigator — same as
  // POListScreen.openMyRequests.
  const handleOpenMyRequests = useCallback(() => {
    const tabs = (navigation.getParent() ?? navigation) as unknown as {
      navigate: (name: string, params?: Record<string, unknown>) => void;
    };
    tabs.navigate('StaffMoreStack', { screen: 'MyRequests', initial: false });
  }, [navigation]);

  const handleToggle = useCallback(() => {
    if (!item) return;

    // Deactivating an item that still holds stock strands its value in the GL
    // Inventory account with nothing on screen to explain it — the item drops
    // out of every active-items list while 1200 keeps carrying it. The server
    // does not enforce this, so this guard is the only one.
    if (item.isActive && item.quantityOnHand !== 0) {
      Alert.alert(
        'Stock still on hand',
        `This item still holds ${item.quantityOnHand} units (${formatCurrency(
          item.quantityOnHand * item.unitCost,
        )}). Clear the stock with an adjustment before deactivating.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Adjust Stock', onPress: handleAdjust },
        ],
      );
      return;
    }

    Alert.alert(
      item.isActive ? 'Deactivate Item' : 'Activate Item',
      `Are you sure you want to ${item.isActive ? 'deactivate' : 'activate'} "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: item.isActive ? 'Deactivate' : 'Activate',
          style: item.isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await dispatch(toggleInventoryItem(item.itemId)).unwrap();
              Toast.show({
                type: 'success',
                text1: item.isActive ? 'Item deactivated' : 'Item activated',
                text2: item.name,
              });
            } catch (e: any) {
              Toast.show({
                type: 'error',
                text1: item.isActive ? 'Could not deactivate' : 'Could not activate',
                text2: e?.message || 'Please try again.',
              });
            }
          },
        },
      ],
    );
  }, [item, dispatch, handleAdjust]);

  if (!item) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.centered}>
          <Text style={styles.notFound}>Item not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}><Feather name="arrow-left" size={17} color={colors.secondary} style={{ marginRight: 2 }} /><Text style={styles.goBack}>Go Back</Text></View>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const status = getStockStatusLabel(item.quantityOnHand, item.reorderPoint);

  // ── Tabs ──────────────────────────────────────────
  const TABS: { key: InventoryDetailTab; label: string }[] = [
    { key: 'stock', label: 'Stock Info' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'purchaseOrders', label: 'POs' },
  ];

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, styles.safeTop]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={HEADER_NAVY[0]} />
      <View style={styles.body}>
      {/* Header */}
      <LinearGradient colors={HEADER_NAVY} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={24} color={colors.neutral0} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Item Detail</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Card ── */}
        <View style={styles.topCard}>
          <View style={styles.topCardRow}>
            <View style={styles.topCardLeft}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemSku}>{item.sku}</Text>
              <Text style={styles.itemCategory}>{item.category}</Text>
            </View>
            <View style={styles.topCardRight}>
              <View style={[styles.statusBadge, { backgroundColor: status.color + '15' }]}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.statusText, { color: status.color }]}>
                  {status.label}
                </Text>
              </View>
              {agencyName && (
                <View style={styles.agencyBadge}>
                  <Text style={styles.agencyBadgeText}>{agencyName}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── Metrics Row ──
            On Order and Committed used to sit here. Both read real columns
            that the backend only ever writes '0' to — nothing increments
            quantity_on_order on a PO, and quantity_committed is unused
            entirely — so they were permanent zeros, and "Available"
            (onHand − committed) was On Hand under another name. */}
        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{item.quantityOnHand}</Text>
            <Text style={styles.metricLabel}>On Hand</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.secondary }]}>
              {formatCurrency(item.quantityOnHand * item.unitCost)}
            </Text>
            <Text style={styles.metricLabel}>Total Value</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: colors.warning }]}>
              {item.reorderPoint}
            </Text>
            <Text style={styles.metricLabel}>Reorder Point</Text>
          </View>
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actionRow}>
          {item.quantityOnHand === 0 ? (
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={handleOpeningStock}>
              <Text style={styles.actionBtnIcon}>🏷️</Text>
              <Text style={styles.actionBtnText}>Opening</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={handleAdjust}>
            <Text style={styles.actionBtnIcon}>📊</Text>
            <Text style={styles.actionBtnText}>Adjust</Text>
          </TouchableOpacity>
          {poCap.allowed && (
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={handleCreatePO}>
              <Text style={styles.actionBtnIcon}>📝</Text>
              <Text style={styles.actionBtnText}>
                {poCap.needsApproval ? 'Request PO' : 'Create PO'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7} onPress={handleEdit}>
            <Text style={styles.actionBtnIcon}>✏️</Text>
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabBar}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              activeOpacity={0.7}
              onPress={() => dispatch(setActiveTab(tab.key))}
            >
              <Text
                style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Tab Content ── */}
        {activeTab === 'stock' && (
          <View style={styles.infoCard}>
            {[
              { label: 'Cost Method', value: 'Weighted Average' },
              { label: 'Unit Cost', value: formatCurrency(item.unitCost) },
              { label: 'Selling Price', value: formatCurrency(item.sellingPrice) },
              { label: 'Markup', value: item.unitCost > 0 ? `${(((item.sellingPrice - item.unitCost) / item.unitCost) * 100).toFixed(1)}%` : '—' },
              { label: 'Total Value', value: formatCurrency(item.unitCost * item.quantityOnHand) },
              { label: 'Reorder Point', value: item.reorderPoint.toString() },
              { label: 'Reorder Quantity', value: item.reorderQuantity.toString() },
              { label: 'Min Stock', value: item.minStock.toString() },
              { label: 'Max Stock', value: item.maxStock.toString() },
              { label: 'Barcode', value: item.barcodeData || '—' },
              // Was its own Locations tab. The app has no location concept —
              // no endpoint exposes inventory_locations — so a source agency
              // is all there is, and it is one row, not a tab. Dropped
              // entirely, not blanked, while the agencies feature is off.
              ...(isFeatureEnabled('agencies')
                ? [{ label: 'Source Agency', value: agencyName || '—' }]
                : []),
              { label: 'Unit of Measure', value: item.unitOfMeasure },
              { label: 'Status', value: item.isActive ? 'Active' : 'Inactive' },
              { label: 'Last Updated', value: formatDate(item.lastUpdated) },
            ].map(row => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'transactions' && (
          <View style={styles.txnCard}>
            <View style={styles.txnHeaderRow}>
              <Text style={[styles.txnHeaderText, { flex: 1 }]}>Date</Text>
              <Text style={[styles.txnHeaderText, { width: 70 }]}>Type</Text>
              <Text style={[styles.txnHeaderText, { width: 55, textAlign: 'right' }]}>Qty</Text>
              <Text style={[styles.txnHeaderText, { width: 55, textAlign: 'right' }]}>Bal</Text>
              <Text style={[styles.txnHeaderText, { flex: 1.2, textAlign: 'right' }]}>Reference</Text>
            </View>

            {movementsStatus === 'loading' && (
              <View style={styles.emptyTab}>
                <ActivityIndicator color={colors.actionGreen} />
              </View>
            )}

            {movementsStatus === 'failed' && (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabText}>
                  {movementsError || 'Could not load stock movements'}
                </Text>
                <TouchableOpacity onPress={loadDetailData} activeOpacity={0.7} style={styles.retryBtn}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Only a successful fetch that came back with nothing is an empty
                item. This used to render unconditionally, because the model
                helper behind it returned a hardcoded []. */}
            {movementsStatus === 'succeeded' && movements.length === 0 && (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabText}>No stock movements recorded</Text>
              </View>
            )}

            {movements.map((mv, idx) => (
              <View
                key={mv.id}
                style={[styles.txnRow, idx % 2 === 0 && styles.txnRowAlt]}
              >
                <Text style={[styles.txnDate, { flex: 1 }]}>{formatDate(mv.date)}</Text>
                <View style={[styles.mvTypeBadge, { backgroundColor: getMovementColor(mv.type) + '15' }]}>
                  <Text style={[styles.mvTypeText, { color: getMovementColor(mv.type) }]}>
                    {movementLabel(mv)}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.mvQty,
                    { color: mv.quantityChange >= 0 ? colors.success : colors.danger },
                  ]}
                >
                  {mv.quantityChange > 0 ? '+' : ''}{mv.quantityChange}
                </Text>
                <Text style={styles.mvBalance}>{mv.balanceAfter}</Text>
                <Text style={[styles.txnRef, { flex: 1.2, textAlign: 'right' }]} numberOfLines={1}>
                  {mv.reference || mv.description || '—'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'purchaseOrders' && (
          <View style={styles.txnCard}>
            {/* Only the FIRST load takes over the tab; a background re-fetch
                must never replace rows that are already on screen. Coming back
                from a PO refires the focus effect, and gating the rows on
                'succeeded' collapsed the card to a lone spinner and jumped the
                scroll position every time. Same rule as POListScreen. */}
            {(poStatus === 'loading' || poStatus === 'idle') && !hasPORows && (
              <View style={styles.emptyTab}>
                <ActivityIndicator color={colors.actionGreen} />
              </View>
            )}

            {poStatus === 'failed' && !hasPORows && (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabText}>
                  {poError || 'Could not load purchase orders'}
                </Text>
                <TouchableOpacity onPress={loadDetailData} activeOpacity={0.7} style={styles.retryBtn}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Requests first: this is the staff member's own PO, waiting on
                the owner. Without it, raising one from this screen and coming
                back to an empty tab reads as "my request vanished" — the same
                gap the PO list closes with its pending strip. */}
            {pendingPORequests.map(req => (
              <TouchableOpacity
                key={req.id}
                style={styles.poRow}
                activeOpacity={0.7}
                onPress={handleOpenMyRequests}
              >
                <Feather name="clock" size={15} color={colors.warning} style={{ marginRight: spacing.xs }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.poNumber} numberOfLines={1}>
                    {req.summary || 'Purchase order request'}
                  </Text>
                  <Text style={styles.poMeta}>Sent to the owner · not a purchase order yet</Text>
                </View>
                <View style={[styles.poStatusBadge, { backgroundColor: colors.warning + '15' }]}>
                  <Text style={[styles.poStatusText, { color: colors.warning }]}>Pending</Text>
                </View>
              </TouchableOpacity>
            ))}

            {purchaseOrders.map(po => {
              // The tab is about THIS item, so the quantity shown is this
              // item's lines, not the PO total.
              const lines = po.lines.filter(l => l.itemId === itemId);
              const ordered = lines.reduce((sum, l) => sum + l.quantity, 0);
              const received = lines.reduce((sum, l) => sum + l.receivedQuantity, 0);
              const statusColor = PO_STATUS_COLORS[po.status] ?? colors.textSecondary;
              return (
                <TouchableOpacity
                  key={po.id}
                  style={styles.poRow}
                  activeOpacity={0.7}
                  onPress={() => handleOpenPO(po.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.poNumber} numberOfLines={1}>
                      {po.poNumber || 'Purchase order'}
                    </Text>
                    <Text style={styles.poMeta} numberOfLines={1}>
                      {[po.vendorName, po.orderDate ? formatDate(po.orderDate) : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <View style={styles.poQtyBlock}>
                    <Text style={styles.poQty}>{ordered}</Text>
                    {/* Report receipts whenever there are any — the old test
                        also required received < ordered, so the count vanished
                        exactly when the receipt completed. */}
                    <Text style={styles.poQtyLabel}>
                      {received > 0 ? `${received} recvd` : 'ordered'}
                    </Text>
                  </View>
                  <View style={[styles.poStatusBadge, { backgroundColor: statusColor + '15' }]}>
                    <Text style={[styles.poStatusText, { color: statusColor }]} numberOfLines={1}>
                      {shortPOStatus(po.status)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Only a settled fetch that found nothing is an empty item —
                otherwise a slow load flashes "no purchase orders" first. And
                say so when the answer is only as good as the page we read:
                claiming "none" to someone checking whether stock is already on
                order is worse than admitting the list was cut short. */}
            {poStatus === 'succeeded' && !hasPORows && (
              <View style={styles.emptyTab}>
                <Text style={styles.emptyTabText}>
                  {poTruncated
                    ? `None in the ${PO_FETCH_LIMIT} most recent purchase orders — there are older ones this screen cannot search.`
                    : 'No purchase orders for this item'}
                </Text>
              </View>
            )}

            {poStatus === 'succeeded' && hasPORows && poTruncated && (
              <View style={styles.poTruncatedNote}>
                <Text style={styles.poTruncatedText}>
                  Searched the {PO_FETCH_LIMIT} most recent purchase orders. Older ones are not shown.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Deactivate / Activate ── */}
        <TouchableOpacity
          style={[styles.toggleBtn, !item.isActive && styles.toggleBtnActive]}
          activeOpacity={0.7}
          onPress={handleToggle}
        >
          <Text style={[styles.toggleBtnText, !item.isActive && styles.toggleBtnTextActive]}>
            {item.isActive ? '⛔ Deactivate Item' : '✅ Activate Item'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
      </View>
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeTop: { backgroundColor: HEADER_NAVY[0] },
  body: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { ...typography.bodyLg, color: colors.textSecondary, marginBottom: spacing.md },
  goBack: { ...typography.labelLg, color: colors.secondary },

  // ── Header ────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backBtn: { marginRight: spacing.xxs, padding: spacing.xxs / 2 },
  headerTitle: { ...typography.h3, color: colors.neutral0 },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.xl },

  // ── Top Card ──────────────────────────────────────
  topCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  topCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topCardLeft: { flex: 1, marginRight: spacing.xs },
  topCardRight: { alignItems: 'flex-end' },
  itemName: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  itemSku: {
    ...typography.bodySm,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  itemCategory: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xxs,
    borderRadius: 12,
    marginBottom: spacing.xxs,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4, marginRight: spacing.xxs },
  statusText: { ...typography.labelSm },
  agencyBadge: {
    backgroundColor: colors.secondary + '15',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 8,
  },
  agencyBadgeText: {
    ...typography.overline,
    color: colors.secondary,
  },

  // ── Metrics ───────────────────────────────────────
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.xs,
    alignItems: 'center',
    ...shadows.xs,
  },
  metricValue: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  metricLabel: {
    ...typography.overline,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // ── Action Buttons ────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnIcon: { ...typography.h3, marginBottom: 2 },
  actionBtnText: { ...typography.overline, color: colors.textPrimary },

  // ── Tabs ──────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 3,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderRadius: radius.sm - 2,
  },
  tabActive: { backgroundColor: colors.actionGreen },
  tabText: { ...typography.bodySm, color: colors.textSecondary },
  tabTextActive: { color: colors.surface, fontWeight: typography.labelLg.fontWeight },

  // ── Info Card ─────────────────────────────────────
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: { ...typography.bodySm, color: colors.textSecondary },
  infoValue: { ...typography.labelMd, color: colors.textPrimary, maxWidth: '55%', textAlign: 'right' },

  // ── Transactions ──────────────────────────────────
  txnCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  txnHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.actionGreen + '08',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  txnHeaderText: {
    ...typography.overline,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  txnRowAlt: { backgroundColor: colors.backgroundAlt },
  txnDate: { ...typography.caption, color: colors.textPrimary },
  txnRef: { ...typography.caption, color: colors.textSecondary },
  mvTypeBadge: {
    width: 70,
    paddingHorizontal: spacing.xxs + 2,
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
  },
  mvTypeText: {
    ...typography.overline,
    
  },
  mvQty: {
    ...typography.labelMd,
    width: 55,
    textAlign: 'right',
    marginRight: spacing.xs,
  },
  mvBalance: {
    ...typography.labelSm,
    width: 55,
    textAlign: 'right',
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  // ── Purchase Orders tab ───────────────────────────
  poRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  poNumber: { ...typography.labelMd, color: colors.textPrimary },
  poMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
  poQtyBlock: { alignItems: 'flex-end', marginHorizontal: spacing.xs },
  poQty: { ...typography.labelMd, color: colors.textPrimary },
  poQtyLabel: { ...typography.overline, color: colors.textTertiary },
  poStatusBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 62,
    alignItems: 'center',
  },
  poStatusText: { ...typography.overline },
  poTruncatedNote: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.backgroundAlt,
  },
  poTruncatedText: { ...typography.caption, color: colors.textTertiary },

  emptyTab: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyTabText: {
    ...typography.bodySm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.secondary + '40',
  },
  retryBtnText: {
    ...typography.labelMd,
    color: colors.secondary,
  },

  // ── Toggle Button ─────────────────────────────────
  toggleBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs + 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.danger + '40',
    alignItems: 'center',
  },
  toggleBtnActive: {
    borderColor: colors.success + '40',
    backgroundColor: colors.success + '08',
  },
  toggleBtnText: {
    ...typography.h5,
    color: colors.danger,
  },
  toggleBtnTextActive: {
    color: colors.success,
  }
});

export default InventoryDetailScreen;
