// ═══════════════════════════════════════════════════════
// FinMatrix — PO Detail Screen
// Activity Diagram steps:
//   • Open PO, tap "Receive Items"
//   • Enter received qty for each line
//   • Save — Received Qty updated
//   • Fully received? → Tap "Convert to Bill"
//   • Bill created — JE: DR Inventory, CR AP
// ═══════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Alert } from '../../../utils/alert';
import { useCompanyInfo } from '../../../utils/companyInfo';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import Toast from 'react-native-toast-message';
import {
  fetchInventoryItems,
  editInventoryItem,
  selectInventoryItems,
} from '../../Inventory/InventoryList/inventoryListSlice';
import { inventoryListSerializer } from '../../../serializers/inventorySerializer';
import { fetchVendors, selectVendors } from '../../Vendors/VendorList/vendorListSlice';
import { convertPOToBillAPI } from '../../../networks/purchases/purchaseOrderNetwork';
import { fetchBills } from '../../Bills/BillList/billListSlice';
import { THEME } from '../../../utils/theme';
import {
  ReportContainer,
  ReportHeader,
  Badge,
  LoadingBlock,
  ErrorBlock,
} from '../../../components/reports/ReportUI';
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import { useCapability } from '../../../hooks/useCapability';
import {
  fetchPODetail,
  updatePOStatus,
  receivePOItems,
  enterReceivingMode,
  exitReceivingMode,
  setReceivingQty,
  clearDetail,
  selectItem,
  selectIsLoading,
  selectDetailError,
  selectReceivingMode,
  selectReceivingLines,
  selectIsReceiving,
  selectIsUpdatingStatus,
} from './poDetailSlice';
import { upsertPurchaseOrder } from '../POList/poListSlice';
import { PO_STATUS_COLORS, PO_STATUS_LABELS, formatPODate } from '../../../models/purchaseOrderModel';
import { purchaseOrderSingleSerializer } from '../../../serializers/purchaseOrderSerializer';
import CustomButton from '../../../Custom-Components/CustomButton';
import { formatCurrency } from '../../../utils/formatters';
import type { PurchaseOrderStatus } from '../../../types';
import type { TransactionsStackParamList } from '../../../navigators/stacks/TransactionsStack';

const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
type DetailRoute = RouteProp<TransactionsStackParamList, 'PODetail'>;

// ═══════════════════════════════════════════════════════
const PODetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const dispatch = useAppDispatch();
  const companyInfo = useCompanyInfo();
  const poId = route.params.poId;

  const po = useAppSelector(selectItem);
  const isLoading = useAppSelector(selectIsLoading);
  const error = useAppSelector(selectDetailError);
  const receivingMode = useAppSelector(selectReceivingMode);
  const receivingLines = useAppSelector(selectReceivingLines);
  const isReceiving = useAppSelector(selectIsReceiving);
  const isUpdatingStatus = useAppSelector(selectIsUpdatingStatus);
  // The API returns neither an item name on PO lines nor a vendor name on the
  // detail payload, so both are resolved here from their own lists.
  const inventory = useAppSelector(selectInventoryItems);
  const vendors = useAppSelector(selectVendors);
  // PATCH /purchase-orders/:id is owner-only at the server, so for staff Edit
  // is a button that can only 403. Sending and closing are theirs.
  const editCap = useCapability('purchaseOrder.edit');

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    dispatch(fetchPODetail(poId));
    dispatch(fetchInventoryItems());
    dispatch(fetchVendors());
    return () => { dispatch(clearDetail()); };
  }, [poId, dispatch]);

  const itemNames = useMemo(
    () => new Map(inventory.map(i => [i.itemId ?? i.id, i.name])),
    [inventory],
  );
  const nameForLine = useCallback(
    (line: { itemId: string; itemName: string; description: string }) =>
      itemNames.get(line.itemId) || line.itemName || line.description || 'Item',
    [itemNames],
  );
  const vendorName = useMemo(
    () => po?.vendorName || vendors.find(v => v.id === po?.vendorId)?.name || '—',
    [po?.vendorName, po?.vendorId, vendors],
  );

  /** After a receipt has moved an item's average cost, offer to carry the same
   *  proportion onto its selling price. Cost is read back from the server
   *  rather than recomputed locally: a concurrent receipt would make a local
   *  figure wrong, and a bad selling price writes silently. */
  const offerRepricing = useCallback(
    async (before: Map<string, { cost: number; price: number; name: string }>) => {
      if (before.size === 0) return;

      const refreshed: any = await dispatch(fetchInventoryItems());
      if (refreshed.error) return; // never guess at a price
      const fresh = inventoryListSerializer(refreshed.payload).items;

      const proposals = fresh
        .map(item => {
          const prev = before.get(item.itemId ?? item.id);
          if (!prev || prev.cost <= 0 || prev.price <= 0) return null;
          if (item.unitCost === prev.cost) return null;
          const newPrice = Math.round(prev.price * (item.unitCost / prev.cost) * 100) / 100;
          if (Math.abs(newPrice - prev.price) < 0.01) return null;
          return { itemId: item.itemId ?? item.id, name: prev.name, oldCost: prev.cost, newCost: item.unitCost, oldPrice: prev.price, newPrice };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      if (proposals.length === 0) return;

      const body = proposals.length === 1
        ? `${proposals[0].name} cost ${formatCurrency(proposals[0].oldCost)} → ${formatCurrency(proposals[0].newCost)}.\n\nUpdate its selling price ${formatCurrency(proposals[0].oldPrice)} → ${formatCurrency(proposals[0].newPrice)} to keep the same margin?`
        : `${proposals.slice(0, 6).map(p => `${p.name}: ${formatCurrency(p.oldPrice)} → ${formatCurrency(p.newPrice)}`).join('\n')}${proposals.length > 6 ? `\n+${proposals.length - 6} more` : ''}\n\nKeeping each item's current margin.`;

      Alert.alert(proposals.length === 1 ? 'Cost changed' : 'Update selling prices?', body, [
        { text: 'Skip', style: 'cancel' },
        {
          text: 'Update prices',
          onPress: async () => {
            const results = await Promise.allSettled(
              proposals.map(p =>
                dispatch(editInventoryItem({ itemId: p.itemId, data: { sellingPrice: String(p.newPrice) } })).unwrap(),
              ),
            );
            const failed = results.filter(r => r.status === 'rejected').length;
            Toast.show(
              failed === 0
                ? { type: 'success', text1: 'Prices updated', text2: `${proposals.length} selling price${proposals.length === 1 ? '' : 's'} updated.` }
                : { type: 'error', text1: 'Some prices not updated', text2: `${failed} of ${proposals.length} failed. Try again from the item screen.` },
            );
          },
        },
      ]);
    },
    [dispatch],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchPODetail(poId));
    setRefreshing(false);
  }, [poId, dispatch]);

  // ── Status transition helper ────────────────
  const transitionStatus = useCallback(
    async (status: PurchaseOrderStatus, message: string) => {
      if (!po) return;
      const result: any = await dispatch(updatePOStatus({ id: po.id, status }));
      if (result.error) {
        // What the server said, not a generic stand-in: this path spent its
        // life reporting "Failed to update purchase order." for a permission
        // refusal that arrived here already worded ("You do not have
        // permission for this action."), which made a role problem look like
        // an outage. Same shape as handleSaveReceive below.
        Alert.alert('Error', result.error?.message || 'Failed to update purchase order.');
        return;
      }
      const updated = purchaseOrderSingleSerializer(result.payload);
      if (updated) dispatch(upsertPurchaseOrder(updated));
      Alert.alert('Success', message);
    },
    [po, dispatch],
  );

  // A draft is a purchase requisition: approving it issues the order to the
  // vendor, and only an issued order can be received or billed.
  const handleSend = useCallback(
    () => po && transitionStatus('sent', `Requisition ${po.poNumber} approved and sent to ${vendorName}.`),
    [po, vendorName, transitionStatus],
  );

  const handleClose = useCallback(() => {
    if (!po) return;
    Alert.alert(
      'Close Purchase Order',
      `Mark ${po.poNumber} as closed? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: () => transitionStatus('closed', `${po.poNumber} has been closed.`),
        },
      ],
    );
  }, [po, transitionStatus]);

  // ── Receiving flow ──────────────────────────
  // Receiving is the ONLY event that changes an item's cost: the server folds
  // the PO price into the weighted average and posts DR Inventory / CR GRNI in
  // the same transaction. Selling price is not part of that — it carries no
  // ledger meaning — so we offer to re-price afterwards rather than moving a
  // customer-facing number on the user's behalf.
  const handleSaveReceive = useCallback(async () => {
    if (!po) return;
    if (!receivingLines.some(rl => rl.receivingQty > 0)) {
      Alert.alert('Nothing to Receive', 'Enter received quantities for at least one line.');
      return;
    }

    // Snapshot BEFORE the receipt. Reading this after the await would see the
    // already-updated cost and compare it against itself.
    const receivedItemIds = new Set(
      receivingLines
        .filter(rl => rl.receivingQty > 0)
        .map(rl => po.lines.find(l => l.id === rl.lineId)?.itemId)
        .filter((id): id is string => !!id),
    );
    const before = new Map(
      inventory
        .filter(i => receivedItemIds.has(i.itemId ?? i.id))
        .map(i => [i.itemId ?? i.id, { cost: i.unitCost, price: i.sellingPrice, name: i.name }]),
    );

    const result: any = await dispatch(receivePOItems({ id: po.id }));
    if (result.error) {
      Alert.alert('Error', result.error?.message || 'Failed to record received items.');
      return;
    }

    const updated = purchaseOrderSingleSerializer(result.payload);
    if (updated) {
      dispatch(upsertPurchaseOrder(updated));
      const allReceived = updated.lines.every(l => l.receivedQuantity >= l.quantity);
      Toast.show({
        type: 'success',
        text1: 'Items Received',
        text2: allReceived
          ? 'All items fully received and added to stock. You can now Convert to Bill.'
          : 'Received quantities have been recorded.',
      });
    }

    await offerRepricing(before);
  }, [po, receivingLines, inventory, dispatch, offerRepricing]);

  // Billing a received PO is DR GRNI / CR AP — it CLEARS the GRNI raised at
  // receipt rather than debiting Inventory a second time. Only the server's
  // create-bill endpoint posts that entry. It bills what was received and not
  // yet billed, tax included, so a PO received in parts is billed once per
  // receipt.
  const [isConverting, setIsConverting] = React.useState(false);

  const handleConvertToBill = useCallback(() => {
    if (!po || isConverting) return;

    // The server's own figure, tax included. Computing received × rate here
    // left the tax out, so the prompt showed less than the bill it created.
    const unbilled = po.unbilledValueGross;

    Alert.alert(
      'Convert to Bill',
      `Bill ${vendorName} ${formatCurrency(unbilled, 'Rs ')} (incl. tax) for goods received on ${po.poNumber} and not yet billed.\n\n` +
        "Dated today, due by the vendor's payment terms.\n\n" +
        'This clears Goods Received Not Invoiced and raises Accounts Payable.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create bill',
          onPress: async () => {
            setIsConverting(true);
            try {
              // No dates: the server defaults the bill date to the business
              // date and the due date to the vendor's terms. The phone's
              // toISOString() date is UTC and read yesterday in Pakistan
              // before 05:00.
              const envelope = await convertPOToBillAPI(po.id, {});
              const data = envelope?.data ?? envelope;
              const billId = data?.billId ?? data?.bill?.id;
              await dispatch(fetchPODetail(po.id));
              await dispatch(fetchBills());
              Toast.show({
                type: 'success',
                text1: data?.bill?.billNumber ? `${data.bill.billNumber} created` : 'Bill created',
                text2: 'DR Goods Received Not Invoiced · CR Accounts Payable.',
              });
              // push, not navigate: a drill-down that must leave the PO
              // underneath it.
              if (billId) navigation.push('BillDetail', { billId });
            } catch (e: any) {
              Toast.show({
                type: 'error',
                text1: 'Could not create bill',
                text2: e?.message || 'Please try again.',
              });
            } finally {
              setIsConverting(false);
            }
          },
        },
      ],
    );
  }, [po, isConverting, vendorName, dispatch, navigation]);

  // Read the id out first: closing over `po` would widen the dependency to the
  // whole object and make React Compiler skip the component.
  const linkedBillId = po?.billId;
  const handleViewBill = useCallback(() => {
    if (linkedBillId) navigation.push('BillDetail', { billId: linkedBillId });
  }, [linkedBillId, navigation]);

  // ── Loading / Error ─────────────────────────────
  // Both keep the header, so the back affordance never disappears.
  if (isLoading && !po) {
    return (
      <ReportContainer>
        <ReportHeader title="Purchase Order" onBack={() => navigation.goBack()} />
        <LoadingBlock />
      </ReportContainer>
    );
  }

  if (error || !po) {
    return (
      <ReportContainer>
        <ReportHeader title="Purchase Order" onBack={() => navigation.goBack()} />
        <ErrorBlock message={error || 'Purchase order not found'} />
      </ReportContainer>
    );
  }
  const isRequisition = po.status === 'draft';
  const isFullyReceived = po.status === 'fully_received';
  const canReceive = po.status === 'sent' || po.status === 'partially_received';
  const isBilled = po.bills.length > 0 || !!po.billId;
  // Received goods not yet billed, tax included. A PO is billed per receipt,
  // so this — not "has a bill" — decides whether another bill can be raised.
  const canConvertToBill =
    po.unbilledValueGross > 0.005 &&
    (po.status === 'sent' || po.status === 'fully_received' || po.status === 'partially_received');

  // ═════════════════════════════════════════════════════
  return (
    <ReportContainer>
      <ReportHeader
        title={isRequisition ? `Requisition ${po.poNumber}` : po.poNumber}
        subtitle={po.vendorName}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* ── PO Card ─────────────────────────── */}
        <View style={styles.poCard}>
          <View style={styles.statusRow}>
            <Badge label={PO_STATUS_LABELS[po.status]} color={PO_STATUS_COLORS[po.status]} dot />
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

          {/* A draft has not been issued to the vendor: it is a request to
              buy, so it is titled as one rather than stamped DRAFT over a
              purchase order. */}
          <Text style={styles.poLabel}>{isRequisition ? 'PURCHASE REQUISITION' : 'PURCHASE ORDER'}</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaCol}>
              <Text style={styles.metaKey}>{isRequisition ? 'Requisition #' : 'PO #'}</Text>
              <Text style={styles.metaVal}>{po.poNumber}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaKey}>Order Date</Text>
              <Text style={styles.metaVal}>{formatPODate(po.orderDate)}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaKey}>Expected</Text>
              <Text style={styles.metaVal}>{formatPODate(po.expectedDate)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>Vendor</Text>
          <Text style={styles.vendorName}>{vendorName}</Text>

          <View style={styles.divider} />

          {/* ── Items Table (or Receiving Editor) ──── */}
          {receivingMode ? (
            <>
              <Text style={styles.sectionLabel}>Receive Items</Text>
              {receivingLines.map(rl => (
                <View key={rl.lineId} style={styles.receivingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.receivingItemName}>{rl.itemName}</Text>
                    <Text style={styles.receivingMeta}>
                      Ordered: {rl.ordered} • Received: {rl.previouslyReceived} • Remaining: {rl.remaining}
                    </Text>
                  </View>
                  <View style={styles.receivingInputWrap}>
                    <TextInput
                      style={styles.receivingInput}
                      value={String(rl.receivingQty || '')}
                      onChangeText={v =>
                        dispatch(setReceivingQty({ lineId: rl.lineId, qty: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0 }))
                      }
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      editable={rl.remaining > 0}
                    />
                    <Text style={styles.receivingMaxText}>/ {rl.remaining}</Text>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Items</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.thText, { flex: 2 }]}>Item</Text>
                <Text style={[styles.thText, styles.thRight, { flex: 0.6 }]}>Qty</Text>
                {!isRequisition && (
                  <Text style={[styles.thText, styles.thRight, { flex: 0.7 }]}>Recvd</Text>
                )}
                <Text style={[styles.thText, styles.thRight, { flex: 1 }]}>Rate</Text>
                <Text style={[styles.thText, styles.thRight, { flex: 1 }]}>Amount</Text>
              </View>
              <View>
                <Text style={styles.tdSub}>Amounts exclude tax</Text>
              </View>
              {po.lines.map((line, idx) => (
                <View
                  key={line.id}
                  style={[styles.tableRow, idx % 2 === 0 && styles.tableRowEven]}
                >
                  <View style={{ flex: 2 }}>
                    <Text style={styles.tdText} numberOfLines={1}>{nameForLine(line)}</Text>
                    {!!line.description && (
                      <Text style={styles.tdSub} numberOfLines={1}>{line.description}</Text>
                    )}
                    {line.taxRate > 0 && (
                      <Text style={styles.tdSub}>+ tax {line.taxRate}%</Text>
                    )}
                  </View>
                  <Text style={[styles.tdText, styles.tdRight, { flex: 0.6 }]}>{line.quantity}</Text>
                  {!isRequisition && (
                    <Text
                      style={[
                        styles.tdText,
                        styles.tdRight,
                        { flex: 0.7 },
                        line.receivedQuantity >= line.quantity && styles.tdReceivedFull,
                        line.receivedQuantity > 0 && line.receivedQuantity < line.quantity && styles.tdReceivedPartial,
                      ]}
                    >
                      {line.receivedQuantity}
                    </Text>
                  )}
                  <Text style={[styles.tdText, styles.tdRight, { flex: 1 }]}>
                    {formatCurrency(line.unitPrice, 'Rs ')}
                  </Text>
                  <Text style={[styles.tdText, styles.tdRight, { flex: 1 }]}>
                    {formatCurrency(line.amount, 'Rs ')}
                  </Text>
                </View>
              ))}
            </>
          )}

          <View style={styles.divider} />

          {/* ── Totals ──────────────────────────── */}
          <View style={styles.totalsBlock}>
            <TotalsRow label="Subtotal" value={formatCurrency(po.subtotal, 'Rs ')} />
            {po.taxAmount > 0 && (
              <TotalsRow label="Tax" value={formatCurrency(po.taxAmount, 'Rs ')} />
            )}
            <View style={styles.grandTotalDivider} />
            <TotalsRow label="Total" value={formatCurrency(po.total, 'Rs ')} bold />
            {!isRequisition && (po.receivedValueGross > 0 || isBilled) && (
              <>
                <TotalsRow label="Received (incl. tax)" value={formatCurrency(po.receivedValueGross, 'Rs ')} />
                <TotalsRow label="Billed (incl. tax)" value={formatCurrency(po.billedValueGross, 'Rs ')} />
                {po.unbilledValueGross > 0.005 && (
                  <TotalsRow
                    label="Received, not billed"
                    value={formatCurrency(po.unbilledValueGross, 'Rs ')}
                    valueColor={colors.warning}
                  />
                )}
              </>
            )}
          </View>

          {po.bills.length > 0 && !receivingMode && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>Bills</Text>
              {po.bills.map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.billRow}
                  onPress={() => navigation.push('BillDetail', { billId: b.id })}
                  accessibilityRole="button"
                  accessibilityLabel={`Open bill ${b.billNumber}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tdText}>{b.billNumber}</Text>
                    <Text style={styles.tdSub}>{formatPODate(b.billDate)} · {b.status}</Text>
                  </View>
                  <Text style={[styles.tdText, styles.tdRight]}>{formatCurrency(b.total, 'Rs ')}</Text>
                  <Feather name="chevron-right" size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </>
          )}

          {!!po.notes && !receivingMode && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionLabel}>Notes</Text>
              <Text style={styles.notesText}>{po.notes}</Text>
            </>
          )}
        </View>

        <View style={{ height: spacing.xl * 3 }} />
      </ScrollView>

      {/* ── Action Bar (matches Estimates / SO / Bills) ── */}
      <View style={styles.actionBar}>
        {receivingMode ? (
          <>
            <View style={styles.actionSecondary}>
              <CustomButton
                title="Cancel"
                onPress={() => dispatch(exitReceivingMode())}
                variant="secondary"
                size="sm"
                fullWidth
                disabled={isReceiving}
              />
            </View>
            <View style={styles.actionPrimary}>
              <CustomButton
                title="Save Received"
                onPress={handleSaveReceive}
                variant="primary"
                size="sm"
                fullWidth
                isLoading={isReceiving}
                disabled={isReceiving}
              />
            </View>
          </>
        ) : (
          <>
            {/* Draft: Edit + Send */}
            {po.status === 'draft' && (
              <>
                {editCap.allowed && (
                  <View style={styles.actionSecondary}>
                    <CustomButton
                      title="Edit"
                      onPress={() => navigation.push('POForm', { poId: po.id })}
                      variant="secondary"
                      size="sm"
                      fullWidth
                    />
                  </View>
                )}
                <View style={styles.actionPrimary}>
                  <CustomButton
                    title="Approve & Send"
                    onPress={handleSend}
                    variant="primary"
                    size="sm"
                    fullWidth
                    isLoading={isUpdatingStatus}
                    disabled={isUpdatingStatus}
                  />
                </View>
              </>
            )}

            {/* Sent / Partially received: Receive + Convert + Close */}
            {canReceive && (
              <>
                {(canConvertToBill || isBilled) && (
                  <View style={styles.actionSecondary}>
                    <CustomButton
                      title={canConvertToBill ? 'To Bill' : 'View Bill'}
                      onPress={canConvertToBill ? handleConvertToBill : handleViewBill}
                      variant="secondary"
                      size="sm"
                      fullWidth
                      isLoading={isConverting}
                      disabled={isConverting}
                    />
                  </View>
                )}
                <View style={styles.actionSecondary}>
                  <CustomButton
                    title="Close"
                    onPress={handleClose}
                    variant="secondary"
                    size="sm"
                    fullWidth
                    disabled={isUpdatingStatus}
                  />
                </View>
                <View style={styles.actionPrimary}>
                  <CustomButton
                    title="Receive Items"
                    onPress={() => dispatch(enterReceivingMode())}
                    variant="primary"
                    size="sm"
                    fullWidth
                  />
                </View>
              </>
            )}

            {/* Fully received: Convert to Bill — or open the bill it became */}
            {isFullyReceived && (
              <>
                <View style={styles.actionSecondary}>
                  <CustomButton
                    title="Close"
                    onPress={handleClose}
                    variant="secondary"
                    size="sm"
                    fullWidth
                    disabled={isUpdatingStatus}
                  />
                </View>
                <View style={styles.actionPrimary}>
                  <CustomButton
                    title={canConvertToBill ? 'Convert to Bill' : `View ${po.billNumber || 'Bill'}`}
                    onPress={canConvertToBill ? handleConvertToBill : handleViewBill}
                    variant="primary"
                    size="sm"
                    fullWidth
                    isLoading={isConverting}
                    disabled={isConverting}
                  />
                </View>
              </>
            )}

            {/* Closed: read-only.

                This used to be "View Bills" onto the whole BillList, which was
                wrong twice over. A closed PO has exactly one bill and that is
                what the user wants — the global list makes them hunt for it.
                And navigate('BillList') PUSHES a second BillList even when one
                is already in the stack (React Navigation 7 only merges params
                when the target is the focused screen), so the trail filled up
                with repeated list screens and Back stopped landing where the
                user expected. popTo returns to the existing one. */}
            {po.status === 'closed' && (
              <View style={styles.actionPrimary}>
                <CustomButton
                  title={linkedBillId ? 'View Bill' : 'View Bills'}
                  onPress={
                    linkedBillId ? handleViewBill : () => navigation.popTo('BillList')
                  }
                  variant="primary"
                  size="sm"
                  fullWidth
                />
              </View>
            )}
          </>
        )}
      </View>
    </ReportContainer>
  );
};

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
// The document look (letterhead, ruled table, totals block) is deliberate --
// this is what gets shared as a PDF -- so the structure stays; only the values
// move onto the design system. Mirrors Invoice/BillDetail exactly.
const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },

  poCard: {
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
  poLabel: {
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
  tdSub: { ...typography.overline, textTransform: 'none', color: colors.textTertiary, marginTop: 1 },
  // Figures align digit-for-digit down the column.
  tdRight: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  // labelSm keeps the 12px cell size while carrying the emphasis weight.
  tdReceivedFull: { ...typography.labelSm, color: colors.success },
  tdReceivedPartial: { ...typography.labelSm, color: colors.warning },

  // Receiving mode
  receivingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  receivingItemName: { ...typography.labelMd, color: colors.textPrimary },
  receivingMeta: { ...typography.overline, textTransform: 'none', color: colors.textSecondary, marginTop: 2 },
  receivingInputWrap: { flexDirection: 'row', alignItems: 'center', marginLeft: spacing.xs },
  receivingInput: {
    width: 56,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    ...typography.h5,
    color: colors.textPrimary,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  receivingMaxText: { ...typography.caption, color: colors.textTertiary, marginLeft: spacing.xxs },

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

  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },

  notesText: { ...typography.bodySm, color: colors.textSecondary },

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

export default PODetailScreen;
