// ═══════════════════════════════════════════════════════
// FinMatrix — Inventory approvals
// ═══════════════════════════════════════════════════════
// The review queue where a rider's delivery becomes a posted sale. That makes
// it the highest-consequence screen in the delivery flow, so it is framed like
// every other one: the navy ReportHeader, the house card, and the shared
// loading / error / empty blocks.
//
// It used to build its own white header bar, render the request list twice
// (once as cards, again as "Approved" / "Rejected" summary cards beneath), and
// show "Nothing waiting for review" while the first fetch was still in flight.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from '../../../../utils/alert';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { THEME, statusStyle } from '../../../../utils/theme';
import { formatCurrency, formatDateTime } from '../../../../utils/formatters';
import {
  ReportContainer,
  ReportHeader,
  Divider,
  LoadingBlock,
  ErrorBlock,
  EmptyBlock,
} from '../../../../components/reports/ReportUI';
import { FilterTabs, type TabItem } from '../../../../components/shared/Tabs';
import Disclosure from '../../../../components/shared/Disclosure';
import { useAppDispatch, useAppSelector } from '../../../../hooks/useReduxHooks';
import type { MoreStackParamList } from '../../../../navigators/stacks/MoreStack';
import {
  selectInventoryApprovalFilter,
  selectInventoryApprovalRequests,
  selectInventoryApprovalAuditTrail,
  selectPendingApprovalCount,
  setInventoryApprovalFilter,
  fetchApprovalRequests,
  approveRequestAsync,
  rejectRequestAsync,
  undoApprovalAsync,
  type InventoryApprovalFilter
} from './inventoryApprovalSlice';
import { fetchInventoryItems } from '../../../Inventory/InventoryList/inventoryListSlice';
import { clearShadowInventoryForRequest } from '../../Admin/AssignDeliveries/deliverySlice';
import type { InventoryUpdateRequest } from '../../../../models/deliveryModel';
import { PAID_STATUS_LABELS, type DeliveryPaidStatus } from '../../../../utils/deliveryCollection';
import CustomButton from '../../../../Custom-Components/CustomButton';
import { downloadBillPhoto } from '../../../../networks/delivery/deliveryNetwork';
import { requestDeliveryUndo } from '../../../../networks/approvals/approvalsNetwork';
import { useCapability, useIsOwner } from '../../../../hooks/useCapability';

// Design-system tokens (see src/theme/theme.ts).
const { colors, radius, shadows, spacing, typography } = THEME;

type Props = NativeStackScreenProps<MoreStackParamList, 'InventoryApproval'>;
type ModalMode = 'approve' | 'reject' | 'undo' | 'undo-request' | null;

/** The server refuses a review note shorter than this, so the button waits for it. */
const MIN_REASON = 5;

/**
 * "{reference} · {name}" with the separator dropped when a side is missing.
 * Older requests carry neither, and the raw template rendered them as a lone
 * "·" — a row that looked like a rendering fault.
 */
const summaryLabel = (reference?: string | null, personnel?: string | null): string => {
  const parts = [reference, personnel].map(v => (v ?? '').trim()).filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Unnamed request';
};

const FILTERS: Array<{ key: InventoryApprovalFilter; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

/** "Pending", not "PENDING" — a shout for a state the colour already carries. */
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const initials = (name?: string | null) => (name || '—').slice(0, 2).toUpperCase();

// The review/undo backend endpoints require a real UUID. Guard against
// non-synced / legacy requests so the user gets a clear message instead of a
// cryptic "uuid is expected / request not found" error.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isSyncedRequest = (id: string) => UUID_RE.test(id);

/**
 * True once approval has posted the sale (Dr Cash-or-A/R / Cr Sales,
 * Dr COGS / Cr Goods in Transit). Those are reversed with a credit memo;
 * legacy deliveries, which never posted one, keep the old stock-only undo.
 */
const isLedgerCommitted = (request: InventoryUpdateRequest): boolean =>
  request.ledgerStatus === 'committed';

/**
 * What approving this delivery does, in the order it matters: WHAT MOVED, WHAT
 * THE MONEY DOES, WHERE IT POSTS.
 *
 * This copy used to be concatenated into an OS alert with blank lines between
 * the paragraphs. It is the same wording; the confirm modal gives it the
 * hierarchy the alert could not — the amount as a figure, the posting note in
 * its own box.
 */
const approvalSummary = (request: InventoryUpdateRequest, cashCounted?: number) => {
  const amount = Number(request.saleAmount ?? '0');
  const delivered = (request.changes ?? []).reduce((n, c) => n + c.deliveredQty, 0);
  const returned = (request.changes ?? []).reduce((n, c) => n + c.returnedQty, 0);
  const settled = settlementOf(request, cashCounted);

  const parts: string[] = [];
  if (settled.advance > 0) parts.push(`${formatCurrency(settled.advance)} was paid in advance`);
  if (settled.cash > 0) parts.push(`the rider collected ${formatCurrency(settled.cash)} in cash`);
  const paidLine = parts.length ? `${parts.join(' and ')}.` : 'Nothing has been paid yet.';

  return {
    amount,
    settled,
    stockLine: returned > 0
      ? `${delivered} delivered · ${returned} returned to stock`
      : `${delivered} delivered`,
    moneyLine:
      settled.onAccount > 0
        ? `${paidLine.charAt(0).toUpperCase()}${paidLine.slice(1)} ${formatCurrency(settled.onAccount)} will sit in Accounts Receivable until the customer pays.`
        : `${paidLine.charAt(0).toUpperCase()}${paidLine.slice(1)} Nothing is left to collect.`,
    postingLine:
      'Approving raises the invoice, applies what was paid (advance from Customer Advances, cash into Cash) and moves the stock cost out of Goods in Transit into Cost of Goods Sold.',
  };
};

/**
 * How a request's sale is settled: the advance, then cash, then Accounts
 * Receivable. `cashCounted` replaces the rider's figure with the owner's count.
 * Worked in paisa; the server recomputes and is the authority.
 */
const settlementOf = (request: InventoryUpdateRequest, cashCounted?: number) => {
  const p = (v: unknown) => Math.round((Number(v) || 0) * 100);
  const due = p(request.amountDue ?? request.saleAmount);
  const advance = p(request.advanceApplied);
  const cash = Math.min(Math.max(p(cashCounted ?? request.amountCollected), 0), due);
  const onAccount = due - cash;
  const status: DeliveryPaidStatus = onAccount <= 0 ? 'paid' : cash > 0 || advance > 0 ? 'partial' : 'unpaid';
  return { advance: advance / 100, cash: cash / 100, onAccount: onAccount / 100, due: due / 100, status };
};

const InventoryApprovalScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  // The slice carries no loading or error state — three other surfaces select
  // from it, so the flags live here rather than reshaping it. Without them the
  // screen rendered "Nothing waiting for review" until the first fetch landed:
  // a false negative on every cold open.
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // The error clears on SUCCESS rather than optimistically at the top: this
    // runs from the mount effect too, and setting state before the first await
    // would be a synchronous render-phase write. It also stops a failing retry
    // from flashing the list empty between the clear and the next failure.
    try {
      await dispatch(fetchApprovalRequests()).unwrap();
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message ?? 'Could not load approval requests.');
    } finally {
      setInitialLoading(false);
    }
  }, [dispatch]);

  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await load();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [load]);

  const requests = useAppSelector(selectInventoryApprovalRequests);
  const activeFilter = useAppSelector(selectInventoryApprovalFilter);
  const pendingCount = useAppSelector(selectPendingApprovalCount);
  const auditTrail = useAppSelector(selectInventoryApprovalAuditTrail);

  useEffect(() => {
    // `void` the promise rather than calling load() bare: the effect must not
    // be treated as returning a cleanup function, and nothing here writes
    // state until the fetch settles.
    void load();
  }, [load]);

  // The stored billPhotoUri is NOT a public CDN link — storage.service composes
  // it as <API_URL>/api/v1/inventory-update-requests/<id>/bill-photo, a route
  // behind JwtAuthGuard + CompanyGuard. RN's <Image source={{uri, headers}}>
  // does not reliably attach auth headers, so the endpoint answered 401, RN
  // could not decode the JSON, and the black container behind the image was
  // all the admin ever saw. Download it natively with the token instead, the
  // same way billingNetwork does for payment screenshots.
  const [photoUris, setPhotoUris] = useState<Record<string, string>>({});
  const [photoErrors, setPhotoErrors] = useState<Record<string, boolean>>({});

  const resolvePhoto = useCallback(async (request: InventoryUpdateRequest) => {
    const raw = request.proof?.billPhotoUri;
    if (!raw) return;
    // Already local (rider's own capture) or inline — nothing to fetch.
    if (raw.startsWith('file://') || raw.startsWith('data:')) {
      setPhotoUris(prev => ({ ...prev, [request.id]: raw }));
      return;
    }
    setPhotoErrors(prev => ({ ...prev, [request.id]: false }));
    try {
      const uri = await downloadBillPhoto(request.id);
      setPhotoUris(prev => ({ ...prev, [request.id]: uri }));
    } catch {
      setPhotoErrors(prev => ({ ...prev, [request.id]: true }));
    }
  }, []);

  /**
   * Ids the auto-loader has already tried. A ref, not state, deliberately:
   * recording an attempt must not itself re-run the effect.
   *
   * This loop used to blow the render stack with "Maximum update depth
   * exceeded". The effect depended on photoErrors, and resolvePhoto's first
   * line sets photoErrors to a NEW object — so the effect re-ran on its own
   * write, and the `!photoErrors[r.id]` guard could never stop it because the
   * value it had just written was `false`, which passes that test.
   */
  const attemptedPhotos = useRef<Set<string>>(new Set());

  useEffect(() => {
    requests.forEach(r => {
      if (!r.proof?.billPhotoUri) return;
      if (attemptedPhotos.current.has(r.id)) return;
      attemptedPhotos.current.add(r.id);
      resolvePhoto(r);
    });
    // Intentionally NOT depending on photoUris/photoErrors: this effect writes
    // both, and the ref above is what decides whether work is still needed.
  }, [requests, resolvePhoto]);

  const [proofFor, setProofFor] = useState<InventoryUpdateRequest | null>(null);
  const [photoFullscreen, setPhotoFullscreen] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [undoReason, setUndoReason] = useState('');
  // Undo reverses recognised revenue, so only the owner does it directly.
  // Staff see the same button, but it files a request carrying a reason.
  const isOwner = useIsOwner();
  // Signing off recognises the sale, so it is the owner's alone. Staff still
  // see the queue and still reject from it — only Approve is withheld, and the
  // server refuses it too (403 on both doors into the same method).
  const approveCap = useCapability('delivery.approveCompletion');
  const [targetRequest, setTargetRequest] = useState<InventoryUpdateRequest | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  // The owner's count of the cash the rider handed in; starts at the rider's figure.
  const [cashText, setCashText] = useState('');

  const visibleRequests = useMemo(() => {
    if (activeFilter === 'all') return requests;
    return requests.filter(r => r.status === activeFilter);
  }, [requests, activeFilter]);

  // Counts ride on the tabs, which is where a filter count belongs. They used
  // to be absent here entirely, with a single "Pending N" badge stranded in the
  // header competing with the title.
  const tabs: TabItem<InventoryApprovalFilter>[] = useMemo(() => {
    const countOf = (key: InventoryApprovalFilter) =>
      key === 'all' ? requests.length : requests.filter(r => r.status === key).length;
    return FILTERS.map(f => ({
      label: f.label,
      value: f.key,
      count: f.key === 'pending' ? pendingCount : countOf(f.key),
    }));
  }, [requests, pendingCount]);

  const closeModal = () => {
    setModalMode(null);
    setTargetRequest(null);
    setRejectComment('');
    setUndoReason('');
  };

  // Core approve logic — takes the request directly so it works from the modal
  // OR the native confirmation dialog.
  const doApprove = async (request: InventoryUpdateRequest, cashCounted?: number) => {
    const changes = request.changes ?? [];
    const riderFigure = Number(request.amountCollected ?? '0') || 0;
    const amountCollected =
      cashCounted !== undefined && Math.abs(cashCounted - riderFigure) > 0.005
        ? cashCounted.toFixed(2)
        : undefined;
    try {
      await dispatch(
        approveRequestAsync({ requestId: request.id, reviewedBy: 'Admin', amountCollected }),
      ).unwrap();

      // The server already moved the stock: approving posts COGS, relieves
      // Goods in Transit and writes quantityOnHand inside one transaction.
      // Deducting again in Redux showed the deduction twice until the next
      // refetch. Re-read instead of re-applying.
      dispatch(fetchInventoryItems());
      dispatch(
        clearShadowInventoryForRequest({
          personnelId: request.personnelId,
          itemIds: changes.map(c => c.itemId),
        }),
      );

      closeModal();
      Alert.alert('Approved', 'Delivery changes applied to real inventory and shadow inventory cleared.');
    } catch (e: any) {
      // Approving is the moment the sale is recognised, so the server can
      // refuse for a reason the owner can actually act on. Those come back as
      // codes; give them a title that names the fix instead of "Error", which
      // says nothing and leaves the delivery stuck in transit with no clue why.
      // Anything else keeps the previous behaviour.
      const title =
        e?.code === 'DELIVERY_ITEM_NO_PRICE' || e?.code === 'INVOICE_ZERO_TOTAL'
          ? 'Set a selling price first'
          : e?.code === 'COLLECTED_OUT_OF_RANGE'
            ? 'Check the cash counted'
            : 'Error';
      Alert.alert(title, e?.message ?? 'Failed to approve request.');
    }
  };

  /**
   * Open the confirm modal, not an OS alert.
   *
   * Approve and Undo used to confirm through Alert.alert while Reject used an
   * in-app modal — two confirmation languages on the same row of buttons, and
   * on web the alert degrades to a bare browser confirm box. The modals below
   * already existed; they were simply never opened.
   */
  const promptApprove = (request: InventoryUpdateRequest) => {
    if (!isSyncedRequest(request.id)) { Alert.alert('Please refresh', "This request hasn't finished syncing with the server. Pull to refresh and try again."); return; }
    setTargetRequest(request);
    setCashText((Number(request.amountCollected ?? '0') || 0).toFixed(2));
    setModalMode('approve');
  };

  const approveDue = targetRequest ? settlementOf(targetRequest).due : 0;
  const cashCountError = (() => {
    if (!targetRequest || approveDue <= 0) return undefined;
    const v = cashText.replace(/[,\s]/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return 'Enter the cash handed in (0 if none).';
    if (Math.round(Number(v) * 100) > Math.round(approveDue * 100)) {
      return `No more than the ${formatCurrency(approveDue)} due.`;
    }
    return undefined;
  })();
  const cashCounted =
    targetRequest && approveDue > 0 && !cashCountError ? Number(cashText.replace(/[,\s]/g, '')) : undefined;

  const confirmApprove = async () => {
    if (!targetRequest || cashCountError) return;
    await doApprove(targetRequest, cashCounted);
  };

  const doUndo = async (request: InventoryUpdateRequest) => {
    try {
      await dispatch(undoApprovalAsync({ requestId: request.id })).unwrap();
      closeModal();
      Alert.alert('Undone', 'Approval reversed and sent back to pending. You can approve or reject it again.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to undo approval.');
    }
  };

  /**
   * Once a delivery has posted its sale, the correction is a credit memo —
   * which is what undoApproval has always said, without doing anything about
   * it. The form arrives pre-filled from the delivery's own figures.
   */
  const openReversal = (request: InventoryUpdateRequest) => {
    if (!isSyncedRequest(request.id)) {
      Alert.alert('Please refresh', "This request hasn't finished syncing with the server. Pull to refresh and try again.");
      return;
    }
    // The credit memo form lives in the Transactions tab, and this screen is
    // registered in the More tab of BOTH navigators — so the hop goes through
    // the parent tab navigator. Typed locally rather than cast to `never`,
    // which would hide a genuine mistake in the route name or params.
    const tabs = (navigation.getParent() ?? navigation) as unknown as {
      navigate: (name: string, params?: Record<string, unknown>) => void;
    };
    // initial: false so TransactionsHub sits underneath — otherwise that stack
    // initialises as [CreditMemoForm] alone and back leaves for the Dashboard.
    tabs.navigate('TransactionsStack', {
      screen: 'CreditMemoForm',
      params: { fromDeliveryRequestId: request.id },
      initial: false,
    });
  };

  const requestUndo = (request: InventoryUpdateRequest) => {
    setTargetRequest(request);
    setUndoReason('');
    setModalMode('undo-request');
  };

  /**
   * Staff ask; the owner decides.
   *
   * The reason is not decoration — the owner is being asked to reverse
   * recognised revenue and has nothing else to judge the request on. The
   * server refuses without one, and refuses ANY undo once the delivery is
   * ledger-committed, in which case the honest route is a credit memo (which
   * staff can also request). That message is surfaced rather than swallowed.
   */
  const submitUndoRequest = async () => {
    if (!targetRequest || undoReason.trim().length < MIN_REASON) return;
    try {
      await requestDeliveryUndo(targetRequest.id, undoReason.trim());
      closeModal();
      Alert.alert(
        'Sent to the owner',
        'They will see your reason and decide. Track it under My requests.',
      );
    } catch (e: any) {
      // The server refuses an undo outright once the delivery is
      // ledger-committed, and says so — surface that rather than a generic
      // failure, because the message names the alternative (a credit memo).
      Alert.alert('Could not send', e?.message ?? 'Failed to send the request.');
    }
  };

  const promptUndo = (request: InventoryUpdateRequest) => {
    if (!isSyncedRequest(request.id)) { Alert.alert('Please refresh', "This request hasn't finished syncing with the server. Pull to refresh and try again."); return; }
    if (!isOwner) { requestUndo(request); return; }
    setTargetRequest(request);
    setModalMode('undo');
  };

  const confirmUndo = async () => {
    if (!targetRequest) return;
    await doUndo(targetRequest);
  };

  // Core reject logic — takes the request + reason directly.
  const doReject = async (request: InventoryUpdateRequest, comment: string) => {
    try {
      await dispatch(
        rejectRequestAsync({ requestId: request.id, reviewedBy: 'Admin', reviewerComment: comment }),
      ).unwrap();

      dispatch(
        clearShadowInventoryForRequest({
          personnelId: request.personnelId,
          itemIds: (request.changes ?? []).map(c => c.itemId),
        }),
      );

      closeModal();
      Alert.alert('Rejected', 'Request marked rejected. Shadow inventory reverted and personnel notified.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to reject request.');
    }
  };

  // Rejection needs a REASON, not a rubber stamp. This used to fire a plain
  // alert and send the literal string 'Rejected by admin', so every rejected
  // delivery carried the same meaningless audit note and the rider was told
  // nothing about what to fix. The modal that collects a real reason already
  // existed in this file — it was simply never opened.
  const promptReject = (request: InventoryUpdateRequest) => {
    if (!isSyncedRequest(request.id)) { Alert.alert('Please refresh', "This request hasn't finished syncing with the server. Pull to refresh and try again."); return; }
    setRejectComment('');
    setTargetRequest(request);
    setModalMode('reject');
  };

  const confirmReject = async () => {
    // The Reject button is disabled below this length, so reaching here with a
    // short reason would take a race — guard anyway rather than let the server
    // bounce the admin with a validation error after the fact.
    if (!targetRequest || rejectComment.trim().length < MIN_REASON) return;
    await doReject(targetRequest, rejectComment);
  };

  /**
   * One block per item rather than a five-column grid.
   *
   * The grid gave each number column about 57px inside a card on a 360dp
   * phone, so "Delivered" and "Returned" clipped their own headers. Stacked,
   * the name gets the full width and the figures read as a sentence.
   */
  const renderChangeRows = (request: InventoryUpdateRequest) =>
    (request.changes ?? []).map(change => {
      // beforeQty is WAREHOUSE stock, and the dispatched units already left it
      // when the delivery was assigned (they sit in Goods in Transit). Only the
      // returns come back; subtracting `delivered` here counted the outflow twice.
      const afterQty = change.beforeQty + change.returnedQty;

      return (
        <View key={`${request.id}_${change.itemId}`} style={styles.itemRow}>
          <Text style={styles.itemName} numberOfLines={2}>{change.itemName}</Text>
          <Text style={styles.itemFigures}>
            <Text style={styles.itemFigureMuted}>{change.beforeQty} in stock</Text>
            <Text style={styles.itemFigureMuted}> · </Text>
            <Text style={styles.itemFigureStrong}>{change.deliveredQty} delivered</Text>
            {change.returnedQty > 0 && (
              <>
                <Text style={styles.itemFigureMuted}> · </Text>
                <Text style={styles.itemFigureStrong}>{change.returnedQty} returned</Text>
              </>
            )}
            <Text style={styles.itemFigureMuted}>{`  →  ${afterQty}`}</Text>
          </Text>
        </View>
      );
    });

  const renderRequest = ({ item: request }: { item: InventoryUpdateRequest }) => {
    const tone = statusStyle(request.status);
    const paidTone =
      request.paidStatus === 'paid' ? colors.success : request.paidStatus === 'partial' ? colors.info : colors.warning;

    return (
      <View style={styles.card}>
        {/* ── Who ─────────────────────────────────────── */}
        <View style={styles.cardTopRow}>
          <View style={styles.personBlock}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(request.personnelName)}</Text>
            </View>
            <View style={styles.personMeta}>
              <Text style={styles.personName} numberOfLines={1}>{request.personnelName}</Text>
              <Text style={styles.personSub} numberOfLines={1}>
                {summaryLabel(request.deliveryReference, request.routeLabel)}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
            <Text style={[styles.statusText, { color: tone.fg }]}>{titleCase(request.status)}</Text>
          </View>
        </View>

        <Divider style={styles.cardRule} />

        {/* ── What it is worth ────────────────────────── */}
        {/* phase1.md: the rider's PAID/NOT PAID flag + the sale the approval will post */}
        <View style={styles.ledgerStrip}>
          <View style={[styles.paidBadge, { backgroundColor: paidTone + '1A' }]}>
            <Feather
              name={request.paidStatus === 'paid' ? 'check-circle' : 'clock'}
              size={13}
              color={paidTone}
            />
            <Text style={[styles.paidBadgeText, { color: paidTone }]}>
              {request.prepaid ? 'PRE-PAID' : PAID_STATUS_LABELS[request.paidStatus ?? 'unpaid']}
            </Text>
          </View>
          <View style={styles.ledgerMeta}>
            {!!request.customerName && (
              <Text style={styles.ledgerCustomer} numberOfLines={1}>{request.customerName}</Text>
            )}
            <Text style={styles.ledgerAmount}>
              {formatCurrency(Number(request.saleAmount ?? '0'))}
            </Text>
          </View>
        </View>
        {request.status === 'pending' && (
          <Text style={styles.ledgerHint}>
            {(() => {
              const x = settlementOf(request);
              if (request.prepaid && x.due <= 0) return 'Pre-paid — approving applies the advance; the rider collected nothing.';
              const bits: string[] = [];
              if (x.advance > 0) bits.push(`${formatCurrency(x.advance)} advance`);
              if (x.cash > 0) bits.push(`${formatCurrency(x.cash)} cash from the rider`);
              if (x.onAccount > 0) bits.push(`${formatCurrency(x.onAccount)} to A/R`);
              return `Approving invoices this delivery: ${bits.join(' · ') || 'nothing to settle'}.`;
            })()}
          </Text>
        )}

        <Divider style={styles.cardRule} />

        {/* ── What moved ──────────────────────────────── */}
        <Text style={styles.blockLabel}>ITEMS</Text>
        {renderChangeRows(request)}

        {request.proof?.billPhotoUri ? (
          <View style={styles.billPhotoRow}>
            <TouchableOpacity
              onPress={() => {
                if (photoUris[request.id]) setPhotoFullscreen(photoUris[request.id]);
                else resolvePhoto(request);
              }}
              activeOpacity={0.85}
              style={styles.billPhotoThumbWrap}
              accessibilityRole="button"
              accessibilityLabel={photoUris[request.id] ? 'View signed bill photo' : 'Load signed bill photo'}
            >
              {photoUris[request.id] ? (
                <>
                  <Image
                    source={{ uri: photoUris[request.id] }}
                    style={styles.billPhotoThumb}
                    resizeMode="cover"
                    onError={() => setPhotoErrors(prev => ({ ...prev, [request.id]: true }))}
                  />
                  <View style={styles.billPhotoBadge}>
                    <Text style={styles.billPhotoBadgeText}>Tap to view</Text>
                  </View>
                </>
              ) : (
                // Never a silent black box again: say which state we are in.
                <View style={styles.billPhotoPending}>
                  <Feather
                    name={photoErrors[request.id] ? 'alert-circle' : 'image'}
                    size={18}
                    color={photoErrors[request.id] ? colors.danger : colors.textSecondary}
                  />
                  <Text style={styles.billPhotoPendingText}>
                    {photoErrors[request.id] ? 'Tap to retry' : 'Loading…'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.billPhotoMeta}>
              <Text style={styles.billPhotoLabel}>Signed bill photo</Text>
              <Text style={styles.billPhotoSub}>Signed by {request.proof.signedBy || 'customer'}</Text>
              <TouchableOpacity
                style={styles.proofBtn}
                onPress={() => setProofFor(request)}
                accessibilityRole="button"
                accessibilityLabel="View full proof details"
              >
                <Feather name="file-text" size={13} color={colors.primary} />
                <Text style={styles.proofBtnText}>Full proof</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.proofBtn, styles.proofBtnStandalone]}
            onPress={() => setProofFor(request)}
            accessibilityRole="button"
            accessibilityLabel="View delivery proof"
          >
            <Feather name="file-text" size={13} color={colors.primary} />
            <Text style={styles.proofBtnText}>View delivery proof</Text>
          </TouchableOpacity>
        )}

        <View style={styles.metaRow}>
          {/* "Shadow" is our word for the rider's van stock, not the reviewer's. */}
          <Text style={styles.metaText}>Rider&apos;s stock: {request.shadowStatus}</Text>
          <Text style={styles.metaText}>{formatDateTime(request.submittedAt)}</Text>
        </View>

        {request.status === 'pending' && (
          <View style={styles.actionRow}>
            {/* Approving posts the sale, so staff do not get the button — and
                would get a 403 if they did. State, not a disabled control:
                a greyed-out Approve reads as "try again later", which is
                wrong. Someone else signs this off. */}
            {approveCap.allowed ? (
              <View style={styles.actionBtn}>
                <CustomButton title="Approve" onPress={() => promptApprove(request)} fullWidth />
              </View>
            ) : (
              <View style={styles.actionBtn}>
                <View style={styles.waitingBadge}>
                  <Feather name="clock" size={13} color={colors.warning} />
                  <Text style={styles.waitingBadgeText}>Waiting for Admin Approval</Text>
                </View>
              </View>
            )}
            {/* Rejecting stays with staff: no sale was recognised, so there is
                nothing to correct, and waiting would strand the stock in
                transit. */}
            <View style={styles.actionBtn}>
              <CustomButton title="Reject" onPress={() => promptReject(request)} variant="danger" fullWidth />
            </View>
          </View>
        )}

        {request.status !== 'pending' && (
          <View style={styles.reviewInfoBox}>
            {/* Which AUTHORITY signed this off, not just who. Approving is the
                owner's now, but rejecting is not, and older rows were approved
                by staff back when that was allowed — so the distinction still
                has to survive in the history. */}
            <Text style={styles.reviewInfoText}>
              {request.reviewerRole === 'staff'
                ? 'Staff approved'
                : request.reviewerRole === 'admin'
                  ? 'Owner approved'
                  : 'Reviewed'}
              {' · '}
              {request.reviewedBy ?? '—'}
              {' · '}
              {request.reviewedAt ? formatDateTime(request.reviewedAt) : '—'}
            </Text>
            {!!request.reviewerComment && <Text style={styles.reviewComment}>{request.reviewerComment}</Text>}
            {request.status === 'approved' && request.reversalCreditMemoId ? (
              // Already reversed. Offering the button again would let a
              // second credit memo debit Sales twice for one sale — every
              // entry balanced, so nothing downstream would notice.
              <Text style={styles.reversedNote}>
                Reversed by a credit memo. Nothing further to do here.
              </Text>
            ) : request.status === 'approved' && (
              <View style={styles.undoBtnWrap}>
                {/* A delivery that posted a sale is reversed with a credit
                    memo, not unwound — corrections reverse rather than
                    delete. Same route for both roles; what differs is only
                    whether submitting posts or asks. A legacy delivery
                    never recognised revenue, so it keeps the old undo. */}
                <CustomButton
                  title={
                    isLedgerCommitted(request)
                      ? 'Reverse with credit memo'
                      : isOwner
                        ? 'Undo approval'
                        : 'Request undo'
                  }
                  onPress={() =>
                    isLedgerCommitted(request)
                      ? openReversal(request)
                      : promptUndo(request)
                  }
                  variant="danger"
                  size="sm"
                />
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  /**
   * The audit trail is queue-wide, so it renders under every filter — it used
   * to appear only on "All", alongside two summary cards that re-listed the
   * requests already on screen above them. Collapsed: it is history, not work.
   */
  const auditSection = (
    <Disclosure
      title="Audit trail"
      subtitle={auditTrail.length ? `${auditTrail.length} entries` : 'No entries yet'}
      icon="clock"
      defaultOpen={false}
    >
      {auditTrail.length === 0 ? (
        <Text style={styles.summaryEmpty}>No audit entries yet.</Text>
      ) : (
        auditTrail.map(a => (
          <View key={a.id} style={styles.summaryRow}>
            {/* Resolve the request to its delivery reference. Printing
                requestId put a raw UUID in the audit list. */}
            <Text style={styles.summaryMain}>
              {titleCase(a.action)} ·{' '}
              {requests.find(r => r.id === a.requestId)?.deliveryReference ?? 'request'}
            </Text>
            <Text style={styles.summaryMeta}>{a.details}</Text>
          </View>
        ))
      )}
    </Disclosure>
  );

  const approve = targetRequest ? approvalSummary(targetRequest, cashCounted) : null;

  return (
    <ReportContainer>
      <ReportHeader
        title="Inventory approvals"
        subtitle="Delivery updates waiting for review"
        onBack={() => navigation.goBack()}
      />

      {/* Outside the list, so switching filters never means scrolling back up. */}
      <FilterTabs<InventoryApprovalFilter>
        tabs={tabs}
        active={activeFilter}
        onChange={value => dispatch(setInventoryApprovalFilter(value))}
      />

      {initialLoading ? (
        <LoadingBlock label="Loading approvals…" />
      ) : loadError && requests.length === 0 ? (
        <ErrorBlock message={loadError} onRetry={load} />
      ) : (
        <FlatList
          data={visibleRequests}
          keyExtractor={r => r.id}
          renderItem={renderRequest}
          style={styles.list}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isPullRefreshing}
              onRefresh={handlePullRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            // An empty Pending queue is good news; an empty filter is not.
            activeFilter === 'pending' ? (
              <EmptyBlock
                icon="check-circle"
                title="Nothing waiting for review"
                hint="Riders' delivery updates appear here for approval."
              />
            ) : (
              <EmptyBlock
                icon="search"
                title={activeFilter === 'all' ? 'No requests yet' : `No ${activeFilter} requests`}
                hint="Switch the filter above to see other requests."
              />
            )
          }
          ListFooterComponent={<View style={styles.footer}>{auditSection}</View>}
        />
      )}

      <Modal visible={modalMode === 'approve' && !!targetRequest} transparent statusBarTranslucent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Approve delivery — {targetRequest?.customerName || 'this customer'}
            </Text>

            {!!approve && (
              <>
                <Text style={styles.modalAmount}>{formatCurrency(approve.amount)}</Text>
                <Text style={styles.modalSub}>{approve.moneyLine}</Text>
                <Text style={styles.modalStock}>{approve.stockLine}</Text>
                {approve.settled.due > 0 ? (
                  <>
                    <Text style={styles.modalStock}>Cash handed in by the rider</Text>
                    <TextInput
                      value={cashText}
                      onChangeText={t => setCashText(t.replace(/[^0-9.]/g, ''))}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.commentInput, { minHeight: 0 }]}
                    />
                    <Text style={styles.inputHint}>
                      {cashCountError ??
                        `${formatCurrency(approve.settled.due)} was due at the door; the rider reported ${formatCurrency(
                          Number(targetRequest?.amountCollected ?? '0') || 0,
                        )}. Change it if your count differs — both are kept.`}
                    </Text>
                  </>
                ) : null}
                <Text style={styles.modalStock}>
                  Recorded as {PAID_STATUS_LABELS[approve.settled.status]}
                  {approve.settled.onAccount > 0 ? ` · ${formatCurrency(approve.settled.onAccount)} on account` : ''}
                </Text>
                <View style={styles.noteBox}>
                  <Feather name="info" size={13} color={colors.textSecondary} />
                  <Text style={styles.noteText}>{approve.postingLine}</Text>
                </View>
                <Text style={styles.modalWarn}>
                  This posts to your books and can only be undone, not edited.
                </Text>
              </>
            )}

            <View style={styles.modalActionRow}>
              <View style={styles.modalBtn}><CustomButton title="Cancel" onPress={closeModal} variant="secondary" fullWidth /></View>
              <View style={styles.modalBtn}><CustomButton title="Approve" onPress={confirmApprove} disabled={!!cashCountError} fullWidth /></View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalMode === 'reject' && !!targetRequest} transparent statusBarTranslucent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Reject delivery — {targetRequest?.customerName || 'this customer'}
            </Text>
            <Text style={styles.modalSub}>
              Nothing posts to your books. The stock stays in Goods in Transit until the
              rider resubmits or brings it back. Your reason goes to the rider.
            </Text>
            <TextInput
              value={rejectComment}
              onChangeText={setRejectComment}
              placeholder="Reason for rejection"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={styles.commentInput}
            />
            {/* Disabled until the reason is usable, rather than an alert after
                the tap — the rider reads this, and it becomes the audit note. */}
            <Text style={styles.inputHint}>
              {rejectComment.trim().length < MIN_REASON
                ? 'Say why — the rider sees this, and it becomes the audit note.'
                : ' '}
            </Text>
            <View style={styles.modalActionRow}>
              <View style={styles.modalBtn}><CustomButton title="Cancel" onPress={closeModal} variant="secondary" fullWidth /></View>
              <View style={styles.modalBtn}>
                <CustomButton
                  title="Reject"
                  onPress={confirmReject}
                  disabled={rejectComment.trim().length < MIN_REASON}
                  variant="danger"
                  fullWidth
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Staff asking the owner to reverse an approved delivery. A modal
          rather than Alert.prompt: that is iOS-only in React Native and would
          silently do nothing on Android. */}
      <Modal visible={modalMode === 'undo-request' && !!targetRequest} transparent statusBarTranslucent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ask the owner to undo this</Text>
            <Text style={styles.modalSub}>
              Undoing reverses revenue that has already posted, so the owner
              decides. Tell them what happened — they see this reason.
            </Text>
            <TextInput
              value={undoReason}
              onChangeText={setUndoReason}
              placeholder="Why should this be undone?"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={styles.commentInput}
            />
            <View style={styles.modalActionRow}>
              <View style={styles.modalBtn}><CustomButton title="Cancel" onPress={closeModal} variant="secondary" fullWidth /></View>
              <View style={styles.modalBtn}>
                <CustomButton
                  title="Send request"
                  onPress={submitUndoRequest}
                  disabled={undoReason.trim().length < MIN_REASON}
                  fullWidth
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!proofFor} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setProofFor(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delivery proof</Text>
            <View style={styles.proofGrid}>
              <ProofRow label="Signed by" value={proofFor?.proof?.signedBy} />
              <ProofRow label="Verification" value={proofFor?.proof?.verificationMethod} />
              <ProofRow label="Verified by" value={proofFor?.proof?.verifiedBy} />
              <ProofRow
                label="Verified at"
                value={proofFor?.proof?.verifiedAt ? formatDateTime(proofFor.proof.verifiedAt) : undefined}
              />
            </View>
            {proofFor?.proof?.billPhotoUri ? (
              <TouchableOpacity
                onPress={() => {
                  if (proofFor && photoUris[proofFor.id]) setPhotoFullscreen(photoUris[proofFor.id]);
                  else if (proofFor) resolvePhoto(proofFor);
                }}
                activeOpacity={0.85}
                style={styles.proofPhotoTouchable}
                accessibilityRole="button"
                accessibilityLabel="View signed bill photo full screen"
              >
                {photoUris[proofFor.id] ? (
                  <Image
                    source={{ uri: photoUris[proofFor.id] }}
                    style={styles.proofPhoto}
                    resizeMode="cover"
                    onError={() => setPhotoErrors(prev => ({ ...prev, [proofFor.id]: true }))}
                  />
                ) : (
                  <View style={[styles.proofPhoto, styles.billPhotoPending]}>
                    <Feather
                      name={photoErrors[proofFor.id] ? 'alert-circle' : 'image'}
                      size={20}
                      color={photoErrors[proofFor.id] ? colors.danger : colors.textSecondary}
                    />
                    <Text style={styles.billPhotoPendingText}>
                      {photoErrors[proofFor.id] ? 'Photo unavailable — tap to retry' : 'Loading photo…'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              !!proofFor?.proof?.signatureBase64 && (
                <ProofRow label="Signature" value={proofFor?.proof?.signatureBase64} />
              )
            )}
            {/* A dismiss is not the primary action on the screen. */}
            <CustomButton title="Close" onPress={() => setProofFor(null)} variant="secondary" fullWidth />
          </View>
        </View>
      </Modal>

      <Modal visible={modalMode === 'undo' && !!targetRequest} transparent statusBarTranslucent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Undo approval</Text>
            <Text style={styles.modalSub}>
              This reverses the inventory changes this approval made. The request returns to
              Pending for re-review and the stock goes back where it was.
            </Text>
            <View style={styles.proofGrid}>
              <ProofRow label="Delivery" value={targetRequest?.deliveryReference} />
              <ProofRow label="Rider" value={targetRequest?.personnelName} />
            </View>
            {(targetRequest?.changes ?? []).map(c => (
              <Text key={c.itemId} style={styles.modalStock}>
                {c.itemName}: {c.beforeQty + c.returnedQty} → {c.beforeQty} (restored)
              </Text>
            ))}
            <View style={styles.modalActionRow}>
              <View style={styles.modalBtn}><CustomButton title="Cancel" onPress={closeModal} variant="secondary" fullWidth /></View>
              <View style={styles.modalBtn}><CustomButton title="Undo" onPress={confirmUndo} variant="danger" fullWidth /></View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!photoFullscreen} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setPhotoFullscreen(null)}>
        <View style={styles.fullscreenBackdrop}>
          <TouchableOpacity
            style={[styles.fullscreenClose, { top: insets.top + spacing.xs }]}
            onPress={() => setPhotoFullscreen(null)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          >
            <Feather name="x" size={22} color={colors.neutral0} />
          </TouchableOpacity>
          {!!photoFullscreen && (
            <Image
              source={{ uri: photoFullscreen }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </ReportContainer>
  );
};

/** Label + value line, used by the proof and undo modals. */
const ProofRow: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <View style={styles.proofRow}>
    <Text style={styles.proofRowLabel}>{label}</Text>
    <Text style={styles.proofRowValue} numberOfLines={1}>{value || '—'}</Text>
  </View>
);

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { padding: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl, flexGrow: 1 },
  footer: { marginTop: spacing.xs },

  // The app's card: radius.lg, a hairline border and the one shared elevation.
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cardRule: { marginVertical: spacing.sm },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.xs },
  personBlock: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  // Navy, not violet: on this card colour carries status and nothing else.
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { ...typography.labelMd, color: colors.primary },
  personMeta: { marginLeft: spacing.xs, flex: 1 },
  personName: { ...typography.labelLg, color: colors.textPrimary },
  personSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full },
  statusText: { ...typography.labelSm },

  ledgerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  paidBadgeText: { ...typography.labelSm, letterSpacing: 0.4 },
  ledgerMeta: { flex: 1, alignItems: 'flex-end' },
  ledgerCustomer: { ...typography.labelSm, color: colors.textSecondary },
  // The amount is what the approval is worth, so it is the card's one figure.
  ledgerAmount: {
    ...typography.h4,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  ledgerHint: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.xs, lineHeight: 16 },

  blockLabel: { ...typography.overline, color: colors.textTertiary, marginBottom: spacing.xs },
  itemRow: { marginBottom: spacing.xs },
  itemName: { ...typography.labelMd, color: colors.textPrimary },
  itemFigures: { marginTop: 1 },
  itemFigureMuted: { ...typography.bodySm, color: colors.textTertiary },
  itemFigureStrong: { ...typography.labelSm, color: colors.textSecondary },

  proofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginTop: spacing.xxs,
  },
  proofBtnStandalone: { marginTop: spacing.xs },
  proofBtnText: { ...typography.labelSm, color: colors.primary },
  billPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    padding: spacing.xs,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  billPhotoThumbWrap: { width: 72, height: 96, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.neutral900 },
  billPhotoThumb: { width: '100%', height: '100%' },
  billPhotoPending: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
    gap: 4, padding: 6,
    backgroundColor: colors.backgroundAlt,
  },
  billPhotoPendingText: { ...typography.overline, color: colors.textSecondary, textAlign: 'center' },
  billPhotoBadge: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 2, backgroundColor: colors.overlay },
  billPhotoBadgeText: { ...typography.overline, color: colors.neutral0, textAlign: 'center' },
  billPhotoMeta: { flex: 1 },
  billPhotoLabel: { ...typography.labelMd, color: colors.textPrimary },
  billPhotoSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  proofPhotoTouchable: { width: '100%', aspectRatio: 3 / 4, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.neutral900, marginBottom: spacing.sm },
  proofPhoto: { width: '100%', height: '100%' },
  // A lightbox wants an opaque ground, not a scrim: the solid ink token reads
  // as "the photo, full screen" where the old 'rgba(0,0,0,0.92)' was a raw
  // colour approximating it. The close chip is one step lighter so it stays
  // visible over a dark photograph.
  fullscreenBackdrop: { flex: 1, backgroundColor: colors.neutral900, justifyContent: 'center', alignItems: 'center' },
  fullscreenImage: { width: '100%', height: '100%' },
  fullscreenClose: {
    position: 'absolute',
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.neutral800,
    borderWidth: 1,
    borderColor: colors.neutral700,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, gap: spacing.xs },
  metaText: { ...typography.caption, color: colors.textTertiary },

  actionRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  actionBtn: { flex: 1 },

  // Sits where Approve sits for the owner, and has to read as state rather
  // than as a button someone forgot to enable — hence the tinted pill and no
  // press affordance. Height tracks the Reject button beside it.
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

  reviewInfoBox: {
    backgroundColor: colors.neutral50,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  reviewInfoText: { ...typography.caption, color: colors.textSecondary },
  reviewComment: { ...typography.bodySm, color: colors.textPrimary, marginTop: spacing.xxs },
  reversedNote: { ...typography.bodySm, color: colors.textSecondary, marginTop: spacing.xs },
  undoBtnWrap: { marginTop: spacing.sm, alignSelf: 'flex-start' },

  summaryRow: { marginBottom: spacing.xs },
  summaryMain: { ...typography.labelMd, color: colors.textPrimary },
  summaryMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  summaryEmpty: { ...typography.caption, color: colors.textSecondary },

  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  modalTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  modalAmount: { ...typography.h2, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  modalSub: { ...typography.bodySm, color: colors.textSecondary, marginBottom: spacing.xs },
  modalStock: { ...typography.labelMd, color: colors.textPrimary, marginBottom: spacing.xxs },
  modalWarn: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.xs },
  noteBox: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.neutral50,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  noteText: { ...typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 17 },

  proofGrid: { marginBottom: spacing.sm },
  proofRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 5 },
  proofRowLabel: { ...typography.caption, color: colors.textSecondary },
  proofRowValue: { ...typography.labelSm, color: colors.textPrimary, flex: 1, textAlign: 'right' },

  modalActionRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  modalBtn: { flex: 1 },
  commentInput: {
    ...typography.bodyMd,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 90,
    textAlignVertical: 'top',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
  },
  inputHint: { ...typography.caption, color: colors.textTertiary, marginTop: spacing.xxs, minHeight: 16 },
});

export default InventoryApprovalScreen;
