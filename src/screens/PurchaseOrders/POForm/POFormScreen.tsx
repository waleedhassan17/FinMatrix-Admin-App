// ═══════════════════════════════════════════════════════
// FinMatrix — PO Form Screen (Create / Edit)
// Premium Enterprise UI
// ═══════════════════════════════════════════════════════

import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import { THEME } from '../../../utils/theme';
const PANEL = THEME.form.summaryPanel;
import { useAppDispatch, useAppSelector } from '../../../hooks/useReduxHooks';
import {
  selectPOFormState,
  setField,
  setVendor,
  setErrors,
  addLine,
  removeLine,
  updateLine,
  setLineItem,
  loadFromRequestPayload,
  resetForm,
  savePurchaseOrder,
  fetchPOForEdit,
} from './poFormSlice';
import { selectItems as selectPOs, upsertPurchaseOrder, fetchPurchaseOrders } from '../POList/poListSlice';
import { fetchVendors, selectVendors } from '../../Vendors/VendorList/vendorListSlice';
import { previewWeightedAverage } from '../../../models/inventoryModel';
import {
  fetchInventoryItems,
  selectInventoryItems,
} from '../../Inventory/InventoryList/inventoryListSlice';
import CustomInput from '../../../Custom-Components/CustomInput';
import CustomDropdown from '../../../Custom-Components/CustomDropdown';
import {
  AddButton,
  FormSectionHeader,
  PrimaryButton,
  SecondaryButton,
} from '../../../components/form/FormUI';
import { DateField, ReportHeader, HEADER_NAVY } from '../../../components/reports/ReportUI';
import TaxField from '../../../components/form/TaxField';
import { lineTaxError } from '../../../models/taxRate';
import { useCapability } from '../../../hooks/useCapability';
import { fetchApprovalById } from '../../../networks/approvals/approvalsNetwork';
import { decideApproval } from '../../Approvals/approvalsSlice';
import { APPROVAL_TYPE_EFFECTS, isPendingApproval } from '../../../models/approvalModel';
import type { ApprovalRequest } from '../../../models/approvalModel';
import RejectReasonModal from '../../Approvals/RejectReasonModal';
import { formatCurrency } from '../../../utils/formatters';
import type { PurchaseOrderStatus } from '../../../types';
import type { PurchaseOrderWritePayload } from '../../../networks/purchases/purchaseOrderNetwork';
import type { TransactionsStackParamList } from '../../../navigators/stacks/TransactionsStack';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Nav = NativeStackNavigationProp<TransactionsStackParamList>;
type FormRoute = RouteProp<TransactionsStackParamList, 'POForm'>;

// ═══════════════════════════════════════════════════════
const POFormScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<FormRoute>();
  const dispatch = useAppDispatch();

  const editingId = route.params?.poId;
  const isEditing = !!editingId;
  // Set when arriving from an inventory item's "Create PO" action.
  const prefillItemId = route.params?.prefillItemId;
  // Set when arriving from the approvals inbox or My Requests: the form shows
  // a staff request read-only so it can be judged on its contents.
  const approvalRequestId = route.params?.fromApprovalRequestId;
  const isReviewing = !!approvalRequestId;
  const pos = useAppSelector(selectPOs);
  const vendors = useAppSelector(selectVendors);
  const items = useAppSelector(selectInventoryItems);
  const form = useAppSelector(selectPOFormState);
  // Staff file a request rather than creating a PO. Draft-vs-send is a
  // distinction they do not have: the create DTO has no status field, so both
  // buttons would send the same request and approve into the same draft.
  const poCap = useCapability('purchaseOrder.create');
  // Only the owner decides. Staff opening their own request from My Requests
  // get the identical read-only form with no decision buttons.
  const decideCap = useCapability('approvals.decide');
  const hydratedRef = React.useRef(false);
  const prefilledRef = React.useRef(false);
  const requestLoadedRef = React.useRef(false);

  // The request under review. Held locally, not in the form slice: it is
  // metadata about the decision, not part of the purchase order being drawn.
  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(isReviewing);
  const [deciding, setDeciding] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  const vendorOptions = useMemo(
    () => vendors.filter(v => v.isActive).map(v => ({ label: v.name, value: v.id })),
    [vendors],
  );

  const itemOptions = useMemo(
    () =>
      items
        .filter(i => i.isActive)
        .map(i => ({ label: `${i.sku} — ${i.name}`, value: i.itemId ?? i.id })),
    [items],
  );

  useEffect(() => {
    dispatch(fetchVendors());
    dispatch(fetchInventoryItems());

    if (hydratedRef.current) return;
    hydratedRef.current = true;

    if (isReviewing) {
      // Nothing seeded here — the request's own payload is loaded by the
      // effect below, once vendors and items are available to name its ids.
    } else if (isEditing && editingId) {
      dispatch(fetchPOForEdit(editingId));
    } else {
      // No PO number is seeded: the server assigns it (PO-2026-0001) and
      // ignores anything we send, so anything shown here before saving would
      // be a guess that gets overwritten.
      // Both read now rather than whenever the bundle started: the slice's
      // initialState is evaluated once, so a long-running app would post the
      // launch date as the order date. dayjs formats in LOCAL time — the
      // toISOString() this used reads yesterday in PKT before 05:00.
      dispatch(setField({ key: 'orderDate', value: dayjs().format('YYYY-MM-DD') }));
      dispatch(setField({ key: 'expectedDate', value: dayjs().add(14, 'day').format('YYYY-MM-DD') }));
    }

    return () => { dispatch(resetForm()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, editingId, isReviewing, dispatch]);

  // Load the approval request and put its payload back in the form.
  //
  // Deliberately NOT gated on vendors and items having arrived. Waiting for a
  // lookup list means a 403 or an offline device leaves the owner staring at a
  // blank form with no explanation — and they can approve from it.
  // CustomDropdown resolves its label from its own options at render, so
  // setting the id is enough; the names fill in when the lists land.
  // `cancelled` rather than a ref for the async part, following
  // CreditMemoFormScreen's reversal loader.
  useEffect(() => {
    if (!approvalRequestId || requestLoadedRef.current) return;
    requestLoadedRef.current = true;

    let cancelled = false;
    const bail = (text2: string) => {
      if (cancelled) return;
      // Never leave a blank form standing in for a request: the owner would
      // approve against whatever it happened to show.
      Toast.show({ type: 'error', text1: 'Could not open this request', text2 });
      navigation.goBack();
    };

    (async () => {
      try {
        const req = await fetchApprovalById(approvalRequestId);
        if (cancelled) return;
        if (req?.type !== 'po') {
          bail('Only purchase order requests can be opened here.');
          return;
        }
        const payload = (req.payload ?? {}) as Partial<PurchaseOrderWritePayload>;
        if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
          bail('This request has no line items to show.');
          return;
        }
        setRequest(req);
        dispatch(
          loadFromRequestPayload({
            payload,
            vendorName: vendors.find(v => v.id === payload.vendorId)?.name ?? '',
            itemNames: Object.fromEntries(
              items.map(i => [i.itemId ?? i.id, i.name]),
            ),
          }),
        );
        setLoadingRequest(false);
      } catch (e: any) {
        bail(e?.message || 'Please try again.');
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approvalRequestId, vendors, items, dispatch, navigation]);

  // Seed the first line from the item the user pressed "Create PO" on. This
  // has to wait for fetchInventoryItems() above to land — the item's name and
  // cost come from the list, which is usually empty on first render.
  //
  // The vendor is deliberately left blank: an inventory item carries a source
  // agency, not a vendor, and the API requires a real vendorId, so there is
  // nothing here to guess from.
  useEffect(() => {
    if (!prefillItemId || isEditing || prefilledRef.current) return;
    const item = items.find(i => (i.itemId ?? i.id) === prefillItemId);
    if (!item) return;
    const firstLine = form.lines[0];
    if (!firstLine) return;
    prefilledRef.current = true;

    dispatch(
      setLineItem({
        id: firstLine.id,
        itemId: item.itemId ?? item.id,
        itemName: item.name,
        description: item.description || item.name,
        unitPrice: String(item.unitCost),
      }),
    );
    dispatch(
      updateLine({
        id: firstLine.id,
        field: 'quantity',
        value: String(Math.max(item.reorderQuantity, 1)),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillItemId, isEditing, items, dispatch]);

  // The API's PATCH rebuilds every line from scratch and resets receivedQty to
  // zero — on a PO that has receipts that would orphan stock and a posted
  // journal entry. This screen is deep-linkable, so refuse here rather than
  // rely on the Detail screen only offering Edit for drafts.
  const editingStatus = useMemo(
    () => (editingId ? pos.find(p => p.id === editingId)?.status : undefined),
    [pos, editingId],
  );
  useEffect(() => {
    if (!isEditing || !editingStatus || editingStatus === 'draft') return;
    Toast.show({
      type: 'error',
      text1: 'Cannot edit this PO',
      text2: 'Only draft purchase orders can be edited — this one has already been sent or received.',
    });
    navigation.goBack();
  }, [isEditing, editingStatus, navigation]);

  const handleVendorChange = useCallback(
    (vendorId: string) => {
      const vendor = vendors.find(v => v.id === vendorId);
      if (!vendor) return;
      dispatch(setVendor({ id: vendor.id, name: vendor.name }));
    },
    [vendors, dispatch],
  );

  const handleItemChange = useCallback(
    (lineId: string, itemId: string) => {
      const item = items.find(i => (i.itemId ?? i.id) === itemId);
      if (!item) return;
      dispatch(
        setLineItem({
          id: lineId,
          itemId: item.itemId ?? item.id,
          itemName: item.name,
          // A purchase is priced at COST, not at the selling price.
          description: item.description || item.name,
          unitPrice: String(item.unitCost),
        }),
      );
    },
    [items, dispatch],
  );

  /** What each line does to its item's average cost if received at the price
   *  typed. Walks lines in order with a running per-item tally, because the
   *  server folds multiple lines for one item sequentially — otherwise two
   *  lines for the same item would both project from the same stale figure. */
  const costPreviews = useMemo(() => {
    const running = new Map<string, { qty: number; cost: number }>();
    const out = new Map<string, { onHand: number; before: number; after: number }>();
    for (const line of form.lines) {
      const item = items.find(i => (i.itemId ?? i.id) === line.itemId);
      const qty = parseFloat(line.quantity);
      const price = parseFloat(line.unitPrice);
      if (!item || !(qty > 0) || !(price >= 0)) continue;
      const key = item.itemId ?? item.id;
      const state = running.get(key) ?? { qty: item.quantityOnHand, cost: item.unitCost };
      const after = previewWeightedAverage(state.qty, state.cost, qty, price);
      out.set(line.id, { onHand: state.qty, before: state.cost, after });
      running.set(key, { qty: state.qty + qty, cost: after });
    }
    return out;
  }, [form.lines, items]);

  const validate = useCallback((): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.vendorId) errs.vendorId = 'Select a vendor';
    if (!form.orderDate) errs.orderDate = 'Order date is required';
    if (!form.expectedDate) errs.expectedDate = 'Expected date is required';
    if (form.lines.length === 0) errs.lines = 'At least one line item is required';
    const hasEmptyLine = form.lines.some(
      l => !l.itemId || !(parseFloat(l.quantity) > 0),
    );
    const taxError = lineTaxError(form.lines);
    if (hasEmptyLine) errs.lines = 'All line items must have an item and quantity';
    else if (taxError) errs.lines = taxError;
    return errs;
  }, [form]);

  // ── Deciding a request under review ─────────────
  //
  // Dispatches the approvals slice thunk rather than the network function so
  // the inbox behind this screen updates the row in place and drops its badge
  // count, which that slice already does.
  const decide = useCallback(
    async (decision: 'approve' | 'reject', comment?: string) => {
      if (!request || deciding) return null;
      setDeciding(true);
      try {
        const result: any = await dispatch(
          decideApproval({ id: request.id, decision, comment }),
        );
        if (result.error) throw new Error(result.error.message);
        return result.payload as ApprovalRequest;
      } catch (e: any) {
        Toast.show({
          type: 'error',
          text1: decision === 'approve' ? 'Could not approve' : 'Could not reject',
          text2: e?.message || 'Please try again.',
        });
        return null;
      } finally {
        setDeciding(false);
      }
    },
    [request, deciding, dispatch],
  );

  const handleApprove = useCallback(async () => {
    const decided = await decide('approve');
    if (!decided) return;
    Toast.show({
      type: 'success',
      text1: 'Request approved',
      text2: 'The purchase order has been created as a draft.',
    });
    navigation.goBack();
  }, [decide, navigation]);

  // Approving replays the stored payload untouched — there is no endpoint that
  // accepts an amended one. So editing happens after: the PO lands as a draft,
  // which posts nothing to the ledger, and this drops the owner straight into
  // it. `resultId` is the created document, but the field carries no contract
  // in the model, so a missing one falls back to saying what happened rather
  // than navigating to poId: undefined.
  const handleApproveAndEdit = useCallback(async () => {
    const decided = await decide('approve');
    if (!decided) return;
    if (decided.resultId) {
      navigation.replace('POForm', { poId: decided.resultId });
      return;
    }
    Toast.show({
      type: 'success',
      text1: 'Request approved',
      text2: 'The draft purchase order is in the PO list — open it there to edit.',
    });
    navigation.goBack();
  }, [decide, navigation]);

  const handleReject = useCallback(
    async (comment: string) => {
      setRejectOpen(false);
      const decided = await decide('reject', comment);
      if (!decided) return;
      Toast.show({
        type: 'success',
        text1: 'Request rejected',
        text2: 'The requester sees your reason in My requests.',
      });
      navigation.goBack();
    },
    [decide, navigation],
  );

  const handleSave = useCallback(
    async (saveStatus: PurchaseOrderStatus = 'draft') => {
      const validationErrors = validate();
      if (Object.keys(validationErrors).length > 0) {
        dispatch(setErrors(validationErrors));
        Toast.show({ type: 'error', text1: 'Validation Error', text2: Object.values(validationErrors)[0] });
        return;
      }

      try {
        const result: any = await dispatch(savePurchaseOrder(saveStatus));
        if (result.error) throw new Error(result.error.message);
        const { po: saved, pending, sendFailed } = result.payload ?? {};

        // Staff get a pending request back instead of a PO. Nothing exists
        // yet — a PO posts nothing either way, which is exactly why gating it
        // is safe — so navigating to a PODetail that has no row would 404.
        //
        // Checked before the upsert: `saved` is null here, and pushing it into
        // the list would put a blank Rs 0 row at the top of the PO list.
        if (pending) {
          Toast.show({
            type: 'success',
            text1: 'Sent to the owner for approval',
            // The create DTO carries no status, so the request replays as a
            // create and lands as a draft — the owner sends it to the vendor
            // afterwards. Saying "created" alone reads as "the vendor has it".
            text2: 'It becomes a draft purchase order once they approve.',
          });
          navigation.goBack();
          return;
        }

        if (saved) dispatch(upsertPurchaseOrder(saved));
        await dispatch(fetchPurchaseOrders());

        // The PO number comes back from the server — the form never had one.
        const ref = saved?.poNumber ?? 'The purchase order';
        if (sendFailed) {
          // The PO exists; only the status change failed. Reporting an outright
          // failure here would send the user off to create a duplicate.
          Toast.show({
            type: 'error',
            text1: 'Saved as draft',
            text2: `${ref} was created but could not be marked Sent. Open it and tap "Send to Vendor".`,
          });
        } else {
          Toast.show({
            type: 'success',
            text1: isEditing ? 'PO Updated' : 'PO Created',
            text2: `${ref} has been ${isEditing ? 'updated' : 'created'} ${saveStatus === 'sent' ? 'and sent to vendor' : 'as draft'}.`,
          });
        }
        // This form is mounted in two navigators: TransactionsStack, where
        // PODetail sits beside it, and DashboardStack, where the quick-action
        // tile opens it and PODetail is not registered. Asking the navigator
        // what it knows about keeps one behaviour per place without a prop
        // that callers could forget to pass: from Transactions you land on the
        // PO you just made, from the dashboard you go back to the dashboard.
        const canOpenDetail = navigation.getState().routeNames.includes('PODetail');
        if (saved?.id && canOpenDetail) navigation.replace('PODetail', { poId: saved.id });
        else navigation.goBack();
      } catch (e: any) {
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: e?.message || 'Failed to save purchase order. Please try again.',
        });
      }
    },
    [isEditing, dispatch, navigation, validate],
  );

  // ═════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════
  return (
    <SafeAreaView style={[styles.container, styles.safeTop]} edges={['top']}>
      <ReportHeader
        title={
          isReviewing
            ? 'Review request'
            : isEditing
              ? `Edit ${form.poNumber}`
              : 'New Purchase Order'
        }
        subtitle={
          isReviewing
            ? request?.requestedBy
              ? `Raised by ${request.requestedBy}`
              : 'Raised by a staff member'
            : isEditing
              ? 'Update PO details'
              : 'Order items from a vendor'
        }
        onBack={() => navigation.goBack()}
      />

      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.neutral100 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {isReviewing && (
            <View style={styles.reviewBanner}>
              <Feather name="clock" size={16} color={colors.warning} />
              <View style={{ flex: 1, marginLeft: spacing.xs }}>
                <Text style={styles.reviewBannerTitle}>
                  {loadingRequest ? 'Loading request…' : 'Waiting for your decision'}
                </Text>
                <Text style={styles.reviewBannerBody}>
                  {request?.summary || 'A staff member asked you to approve this purchase order.'}
                </Text>
                <Text style={styles.reviewBannerBody}>
                  {APPROVAL_TYPE_EFFECTS.po}
                </Text>
                {!!request?.reason && (
                  <Text style={styles.reviewBannerBody}>Reason given: {request.reason}</Text>
                )}
              </View>
            </View>
          )}

          {/* Nothing in the form is editable while reviewing: approving replays
              the payload exactly as submitted, so an edit here would be a lie.
              Gated at the container because DateField has no disabled prop —
              the controls that do have one also carry the muted styling. */}
          <View pointerEvents={isReviewing ? 'none' : 'auto'}>
          {/* ── PO Details ─────────────────────────── */}
          <FormSectionHeader title="PO DETAILS" dotColor={colors.info} />
          <View style={styles.sectionCard}>
            <View style={[styles.cardAccent, { backgroundColor: colors.info }]} />
            <View style={styles.cardBody}>
              <CustomDropdown
                label="Vendor *"
                options={vendorOptions}
                value={form.vendorId}
                onChange={handleVendorChange}
                placeholder="Select vendor…"
                error={form.errors.vendorId}
                searchable
                disabled={isReviewing}
              />
              {/* The server owns this number and ignores anything we send,
                  so it is shown, never typed. */}
              <CustomInput
                label="PO #"
                value={form.poNumber}
                onChangeText={() => {}}
                placeholder="Assigned on save"
                disabled
              />
              <View style={styles.rowFields}>
                <View style={{ flex: 1, marginRight: spacing.xs }}>
                  <DateField
                    label="Order Date *"
                    value={form.orderDate}
                    onChangeText={v => dispatch(setField({ key: 'orderDate', value: v }))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  {/* Expected delivery is a future date → allow dates after today;
                      never before the order date. */}
                  <DateField
                    label="Expected Date *"
                    value={form.expectedDate}
                    onChangeText={v => dispatch(setField({ key: 'expectedDate', value: v }))}
                    minimumDate={form.orderDate ? new Date(form.orderDate) : undefined}
                    maximumDate={new Date(2100, 11, 31)}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* ── Line Items ─────────────────────────── */}
          <FormSectionHeader
            title="ITEMS"
            dotColor={colors.secondary}
            right={
              isReviewing ? undefined : (
                <AddButton label="Add Item" onPress={() => dispatch(addLine())} />
              )
            }
          />
          {!!form.errors.lines && (
            <Text style={styles.lineError}>{form.errors.lines}</Text>
          )}

          {form.lines.map((line, idx) => (
            <View key={line.id} style={styles.lineCard}>
              <View style={[styles.lineCardAccent, { backgroundColor: idx % 2 === 0 ? colors.info : colors.secondary }]} />
              <View style={styles.lineCardBody}>
                <View style={styles.lineHeader}>
                  <View style={styles.lineBadge}>
                    <Text style={styles.lineBadgeText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.lineLabel}>Item</Text>
                  {form.lines.length > 1 && (
                    <TouchableOpacity style={styles.lineDeleteBtn} disabled={isReviewing} onPress={() => dispatch(removeLine(line.id))}>
                      <Feather name="trash-2" size={14} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>

                <CustomDropdown
                  label="Item *"
                  options={itemOptions}
                  value={line.itemId}
                  onChange={v => handleItemChange(line.id, v)}
                  placeholder="Select item…"
                  searchable
                />

                <TextInput
                  style={styles.descInput}
                  value={line.description}
                  onChangeText={v => dispatch(updateLine({ id: line.id, field: 'description', value: v }))}
                  placeholder="Description"
                  placeholderTextColor={colors.textTertiary}
                />

                <View style={styles.lineNumRow}>
                  <View style={{ flex: 1, minWidth: 132, marginRight: spacing.xs }}>
                    <Text style={styles.fieldLabel}>Quantity</Text>
                    <TextInput
                      style={styles.numericInput}
                      value={line.quantity}
                      onChangeText={v =>
                        dispatch(updateLine({ id: line.id, field: 'quantity', value: v.replace(/[^0-9.]/g, '') }))
                      }
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1, marginRight: spacing.xs }}>
                    <Text style={styles.fieldLabel}>Unit Price (Rs)</Text>
                    <TextInput
                      style={styles.numericInput}
                      value={line.unitPrice}
                      onChangeText={v =>
                        dispatch(updateLine({ id: line.id, field: 'unitPrice', value: v.replace(/[^0-9.]/g, '') }))
                      }
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ width: 88 }}>
                    <TaxField
                      value={line.taxRate}
                      onChange={v => dispatch(updateLine({ id: line.id, field: 'taxRate', value: v }))}
                    />
                  </View>
                </View>

                {/* What receiving at this price would do to the item's
                    weighted-average cost. A projection — the cost only moves
                    when the goods are actually received, with its journal
                    entry. */}
                {costPreviews.has(line.id) && (
                  <View style={styles.costPreview}>
                    <Text style={styles.costPreviewText}>
                      On hand {costPreviews.get(line.id)!.onHand} · Avg cost{' '}
                      {formatCurrency(costPreviews.get(line.id)!.before, 'Rs ')}
                    </Text>
                    <Text style={styles.costPreviewText}>
                      If received at this price →{' '}
                      <Text
                        style={[
                          styles.costPreviewAfter,
                          {
                            color:
                              costPreviews.get(line.id)!.after > costPreviews.get(line.id)!.before
                                ? colors.warning
                                : colors.success,
                          },
                        ]}
                      >
                        {formatCurrency(costPreviews.get(line.id)!.after, 'Rs ')}
                      </Text>
                    </Text>
                  </View>
                )}

                <View style={styles.lineTotalRow}>
                  <Feather name="arrow-right" size={12} color={colors.actionGreen} />
                  <Text style={styles.lineTotal}>
                    Line total (excl. tax): {formatCurrency(line.amount, 'Rs ')}
                  </Text>
                </View>
                {(parseFloat(line.taxRate) || 0) > 0 && (
                  <Text style={styles.lineTaxNote}>
                    Tax {line.taxRate}%: {formatCurrency(Math.round(line.amount * (parseFloat(line.taxRate) || 0)) / 100, 'Rs ')}
                    {' · '}Incl. tax {formatCurrency(line.amount + Math.round(line.amount * (parseFloat(line.taxRate) || 0)) / 100, 'Rs ')}
                  </Text>
                )}
              </View>
            </View>
          ))}

          {/* ── Totals ─────────────────────────────── */}
          <LinearGradient
            colors={PANEL.gradient}
            style={styles.totalsCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.totalsHeader}>
              <Feather name="credit-card" size={16} color={PANEL.accent} />
              <Text style={styles.totalsHeaderText}>PO Summary</Text>
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
              <Text style={styles.grandTotalLabel}>Total (incl. tax)</Text>
              <Text style={styles.grandTotalValue}>{formatCurrency(form.total, 'Rs ')}</Text>
            </View>
          </LinearGradient>

          {/* ── Notes ──────────────────────────────── */}
          <FormSectionHeader title="NOTES" dotColor={colors.secondary} />
          <View style={styles.sectionCard}>
            <View style={[styles.cardAccent, { backgroundColor: colors.secondary }]} />
            <View style={styles.cardBody}>
              <CustomInput
                label="Notes (Optional)"
                value={form.notes}
                onChangeText={v => dispatch(setField({ key: 'notes', value: v }))}
                placeholder="Additional notes…"
                multiline
              />
            </View>
          </View>

          </View>

          {/* ── Actions ────────────────────────────── */}
          {isReviewing ? (
            // Only the owner decides. Staff reach this same screen from My
            // Requests to see what they submitted, and get no buttons.
            decideCap.allowed && request && isPendingApproval(request) ? (
              <View>
                <View style={styles.btnRow}>
                  <View style={{ flex: 1, marginRight: spacing.xs }}>
                    <SecondaryButton
                      title="Reject"
                      onPress={() => setRejectOpen(true)}
                      disabled={deciding}
                      icon={<Feather name="x" size={16} color={colors.actionGreen} />}
                    />
                  </View>
                  <View style={{ flex: 1.4 }}>
                    <PrimaryButton
                      title={deciding ? 'Approving…' : 'Approve'}
                      onPress={handleApprove}
                      isLoading={deciding}
                      icon={<Feather name="check" size={16} color={colors.neutral0} />}
                    />
                  </View>
                </View>
                {/* The payload cannot be amended before approval — no endpoint
                    accepts one. Approving creates a DRAFT PO, which posts
                    nothing, so edits happen there instead. */}
                <SecondaryButton
                  title="Approve & edit the draft"
                  onPress={handleApproveAndEdit}
                  disabled={deciding}
                  icon={<Feather name="edit-2" size={16} color={colors.actionGreen} />}
                />
              </View>
            ) : (
              <View style={styles.reviewNote}>
                <Text style={styles.reviewNoteText}>
                  {request && !isPendingApproval(request)
                    ? 'This request has already been decided.'
                    : 'Only the owner can approve or reject a request.'}
                </Text>
              </View>
            )
          ) : poCap.needsApproval && !isEditing ? (
            // One button, because there is only one outcome: the request is
            // filed either way. 'draft' rather than 'sent' — the status PATCH
            // has nothing to act on while the PO does not exist yet.
            //
            // Creation only. Editing an existing PO is a different action the
            // capability map does not cover, and collapsing its two buttons
            // would silently drop the send the user asked for.
            <View style={styles.btnRow}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title={form.isSaving ? 'Sending…' : poCap.submitLabel('Save & Send')}
                  onPress={() => handleSave('draft')}
                  isLoading={form.isSaving}
                  icon={<Feather name="send" size={16} color={colors.neutral0} />}
                />
              </View>
            </View>
          ) : (
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
                  title={form.isSaving ? 'Saving…' : isEditing ? 'Update & Send' : 'Save & Send'}
                  onPress={() => handleSave('sent')}
                  isLoading={form.isSaving}
                  icon={<Feather name="send" size={16} color={colors.neutral0} />}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <RejectReasonModal
        visible={rejectOpen}
        summary={request?.summary}
        onCancel={() => setRejectOpen(false)}
        onSubmit={handleReject}
      />
    </SafeAreaView>
  );
};

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

  lineCard: {
    flexDirection: 'row', backgroundColor: colors.neutral0, borderRadius: radius.lg,
    overflow: 'hidden', marginBottom: spacing.xs, ...shadows.xs, borderWidth: 1, borderColor: colors.neutral200,
  },
  lineCardAccent: { width: 4 },
  lineCardBody: { flex: 1, padding: spacing.md },
  lineHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xxs, gap: spacing.xxs },
  lineBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.neutral100, alignItems: 'center', justifyContent: 'center' },
  lineBadgeText: { ...typography.overline, color: colors.neutral500 },
  lineLabel: { flex: 1, ...typography.overline, color: colors.textTertiary },
  lineDeleteBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.dangerLight, justifyContent: 'center', alignItems: 'center' },

  descInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.xs, paddingVertical: spacing.xs,
    ...THEME.typography.bodyMd, color: colors.textPrimary, marginTop: spacing.xxs,
  },
  lineNumRow: { flexDirection: 'row', marginTop: spacing.xs, flexWrap: 'wrap', rowGap: spacing.xxs },
  fieldLabel: { ...typography.labelSm, color: colors.textSecondary, marginBottom: spacing.xxs },
  numericInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.xs, paddingVertical: spacing.xs,
    ...THEME.typography.bodyMd, color: colors.textPrimary,
  },
  lineTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: spacing.xs },
  costPreview: { marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: colors.border },
  costPreviewText: { ...THEME.typography.caption, color: colors.textSecondary, fontFamily: THEME.typography.fontFamily },
  costPreviewAfter: { fontWeight: typography.labelLg.fontWeight },
  lineTaxNote: { ...typography.caption, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },
  lineTotal: { ...typography.labelMd, color: colors.actionGreen, fontVariant: ['tabular-nums'] },

  totalsCard: { borderRadius: radius.lg + 4, padding: spacing.md + 4, marginTop: spacing.xl, ...shadows.md },
  totalsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs + 2, marginBottom: spacing.xs },
  totalsHeaderText: { ...typography.labelMd, color: PANEL.accent, letterSpacing: 0.5 },
  totalsDivider: { height: 1, backgroundColor: PANEL.divider, marginVertical: spacing.xxs + 2 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xxs },
  // h5's 14px at body weight -- the label is quieter than the value beside it.
  totalsLabel: { ...typography.h5, fontWeight: typography.bodyMd.fontWeight, color: PANEL.label },
  totalsValue: { ...typography.h5, color: PANEL.text, fontVariant: ['tabular-nums'] },
  grandTotalLabel: { ...typography.h4, color: PANEL.accent },
  grandTotalValue: { ...typography.h2, color: colors.neutral0, fontVariant: ['tabular-nums'] },

  btnRow: { flexDirection: 'row', marginTop: spacing.xl, marginBottom: spacing.md },
  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warning + '12',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  reviewBannerTitle: { ...typography.labelMd, color: colors.textPrimary },
  reviewBannerBody: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reviewNote: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundAlt,
  },
  reviewNoteText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default POFormScreen;
