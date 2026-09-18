// ═══════════════════════════════════════════════════════
// FinMatrix — Inventory Detail Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Co-located with InventoryDetailScreen.tsx
// Manages detail-screen UI state: active tab + the item's movement history.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { getStockMovementsAPI } from '../../../networks/inventory/inventoryNetwork';
import { getPurchaseOrdersAPI } from '../../../networks/purchases/purchaseOrderNetwork';
import { fetchApprovals } from '../../../networks/approvals/approvalsNetwork';
import { stockMovementsSerializer } from '../../../serializers/inventorySerializer';
import { purchaseOrderListSerializer } from '../../../serializers/purchaseOrderSerializer';
import type { StockMovement } from '../../../models/inventoryModel';
import { isPendingApproval, type ApprovalRequest } from '../../../models/approvalModel';
import type { PurchaseOrder } from '../../../types';

export type InventoryDetailTab = 'stock' | 'transactions' | 'purchaseOrders';

export interface InventoryDetailSliceState {
  activeTab: InventoryDetailTab;
  movements: StockMovement[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string;
  /** The in-flight movements request — see the stale-response guard below. */
  movementsRequestId: string;
  /** POs with a line for this item, and — for staff — their own pending
   *  requests for one, which are not POs yet and have no id to open. */
  purchaseOrders: PurchaseOrder[];
  pendingPORequests: ApprovalRequest[];
  poStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  poError: string;
  /** The in-flight PO request — see the stale-response guard below. */
  poRequestId: string;
  /** True when the item has more POs than the one page this screen fetches. */
  poTruncated: boolean;
}

const initialState: InventoryDetailSliceState = {
  activeTab: 'stock',
  movements: [],
  status: 'idle',
  error: '',
  movementsRequestId: '',
  purchaseOrders: [],
  pendingPORequests: [],
  poStatus: 'idle',
  poError: '',
  poRequestId: '',
  poTruncated: false,
};

/** One page of purchase orders. Past this the item needs a server-side filter,
 *  and the screen says so rather than implying the list is complete. */
export const PO_FETCH_LIMIT = 100;

export const inventoryDetailSlice = createAppSlice({
  name: 'inventoryDetail',
  initialState,
  reducers: create => ({
    setActiveTab: create.reducer((state, action: PayloadAction<InventoryDetailTab>) => {
      state.activeTab = action.payload;
    }),
    resetInventoryDetail: create.reducer(state => {
      state.activeTab = 'stock';
      state.movements = [];
      state.status = 'idle';
      state.error = '';
      state.movementsRequestId = '';
      state.purchaseOrders = [];
      state.pendingPORequests = [];
      state.poStatus = 'idle';
      state.poError = '';
      state.poRequestId = '';
      state.poTruncated = false;
    }),

    // The inventory audit trail. Every stock movement the server recorded for
    // this item — receipts, adjustments, deliveries, sales, returns — which
    // the Transactions tab used to claim was always empty because the model
    // helper it read returned a hardcoded [].
    fetchItemMovements: create.asyncThunk(
      async (itemId: string) => getStockMovementsAPI(itemId),
      {
        pending: (state, action) => {
          state.status = 'loading';
          state.error = '';
          state.movementsRequestId = action.meta.requestId;
        },
        fulfilled: (state, action) => {
          // Same stale-response guard as the purchase orders below. Keyed on
          // requestId rather than itemId: this slice is shared across items, so
          // item A's fetch can land after item B mounted — but two fetches for
          // the SAME item also overlap (focus, then Retry, or a fast tab
          // bounce), and an older snapshot resolving last would overwrite the
          // newer one. Only the most recent request may write.
          if (action.meta.requestId !== state.movementsRequestId) return;
          state.movements = stockMovementsSerializer(action.payload);
          state.status = 'succeeded';
        },
        rejected: (state, action) => {
          if (action.meta.requestId !== state.movementsRequestId) return;
          state.status = 'failed';
          state.error = action.error?.message ?? 'Failed to load stock movements';
        },
      },
    ),

    // Purchase orders that carry this item. There is no per-item PO endpoint —
    // GET /purchase-orders filters by search/status/vendor only — so the list
    // is fetched and filtered here on the line items.
    //
    // Not poListSlice.fetchPurchaseOrders: that one takes no argument and reads
    // the search and status filters off its own state, so it would return a
    // subset whenever the user had left a filter set on the PO list, and would
    // overwrite that screen's rows on the way back.
    fetchItemPurchaseOrders: create.asyncThunk(
      async ({ itemId, includePending }: { itemId: string; includePending: boolean }) => {
        // In parallel — two sequential round trips are a visible wait on a
        // phone. Only the PO call may reject: the pending strip fails soft.
        const [envelope, requests] = await Promise.all([
          // One page, capped. Filtering page 1 of a paginated endpoint would
          // silently drop older POs; past 100 this needs a server-side itemId
          // filter rather than a bigger number.
          getPurchaseOrdersAPI({ limit: PO_FETCH_LIMIT }),
          // Staff only: the owner's POs never wait on anyone, and an
          // unfiltered GET /approvals would hand them the whole company inbox.
          // Losing the strip beats blanking rows that loaded fine.
          includePending
            ? fetchApprovals('pending', 'po').catch(() => [] as ApprovalRequest[])
            : Promise.resolve([] as ApprovalRequest[]),
        ]);
        return { envelope, requests, itemId };
      },
      {
        pending: (state, action) => {
          state.poStatus = 'loading';
          state.poError = '';
          state.poRequestId = action.meta.requestId;
        },
        fulfilled: (state, action) => {
          // Only the most recent request may write. Keyed on requestId, not
          // itemId: that covers both a response for an item we have navigated
          // away from AND two overlapping fetches for the same item (focus then
          // Retry, or a fast tab bounce), where an older snapshot resolving last
          // would drop a PO the user had just created.
          if (action.meta.requestId !== state.poRequestId) return;

          const { itemId } = action.payload;
          const { purchaseOrders, totalPOs } = purchaseOrderListSerializer(action.payload.envelope);
          state.purchaseOrders = purchaseOrders.filter(po =>
            po.lines?.some(line => line.itemId === itemId),
          );
          // Past one page the filter can only see what it was given, and an
          // unqualified "No purchase orders for this item" would be a confident
          // wrong answer to "is this already on order?".
          state.poTruncated = totalPOs > purchaseOrders.length;

          // `payload` is the original request body the server replays on
          // approval, so it is shaped like the PO write payload — but it is
          // typed as an open record, so nothing here may assume it.
          state.pendingPORequests = action.payload.requests.filter(req => {
            // 'approving' is a transient claim held while the server posts the
            // request, and the list endpoint reports it under `pending` — but
            // the PO may already exist by then, so it is not "waiting" and must
            // not be shown as such. See isPendingApproval in approvalModel.
            if (!req || !isPendingApproval(req)) return false;
            const lines = (req.payload as { lines?: unknown })?.lines;
            return (
              Array.isArray(lines) &&
              lines.some(l => (l as { itemId?: string })?.itemId === itemId)
            );
          });
          state.poStatus = 'succeeded';
        },
        rejected: (state, action) => {
          if (action.meta.requestId !== state.poRequestId) return;
          state.poStatus = 'failed';
          state.poError = action.error?.message ?? 'Failed to load purchase orders';
        },
      },
    ),
  }),

  selectors: {
    selectInventoryDetailTab: state => state.activeTab,
    selectInventoryDetailMovements: state => state.movements,
    selectInventoryDetailStatus: state => state.status,
    selectInventoryDetailError: state => state.error,
    selectInventoryDetailPOs: state => state.purchaseOrders,
    selectInventoryDetailPendingPOs: state => state.pendingPORequests,
    selectInventoryDetailPOStatus: state => state.poStatus,
    selectInventoryDetailPOError: state => state.poError,
    selectInventoryDetailPOTruncated: state => state.poTruncated,
  },
});

export const {
  setActiveTab,
  resetInventoryDetail,
  fetchItemMovements,
  fetchItemPurchaseOrders,
} = inventoryDetailSlice.actions;

export const {
  selectInventoryDetailTab,
  selectInventoryDetailMovements,
  selectInventoryDetailStatus,
  selectInventoryDetailError,
  selectInventoryDetailPOs,
  selectInventoryDetailPendingPOs,
  selectInventoryDetailPOStatus,
  selectInventoryDetailPOError,
  selectInventoryDetailPOTruncated,
} = inventoryDetailSlice.selectors;
