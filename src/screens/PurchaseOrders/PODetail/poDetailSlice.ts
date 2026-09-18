// ═══════════════════════════════════════════════════════
// FinMatrix — Purchase Order Detail Slice (createAppSlice)
// ═══════════════════════════════════════════════════════
// Co-located with PODetailScreen.tsx. Owns:
//   • the currently-viewed PO
//   • the receiving-mode UI state (line-item receiving qty editing)
//   • status transition + receive-items async thunks
// Mirrors `billDetailSlice.ts`.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { PurchaseOrder, PurchaseOrderStatus } from '../../../types';
import {
  getPurchaseOrderByIdAPI,
  updatePOStatusAPI,
  receivePurchaseOrderAPI,
} from '../../../networks/purchases/purchaseOrderNetwork';
import { purchaseOrderSingleSerializer } from '../../../serializers/purchaseOrderSerializer';
import { toApiPOStatus } from '../../../models/purchaseOrderModel';

// ─── Receiving-mode line state ───────────────────────
export interface ReceivingLine {
  lineId: string;
  itemName: string;
  ordered: number;
  previouslyReceived: number;
  remaining: number;
  receivingQty: number;
}

export interface PODetailSliceState {
  item: PurchaseOrder | null;
  isLoading: boolean;
  error: string;

  receivingMode: boolean;
  receivingLines: ReceivingLine[];
  isReceiving: boolean;

  isUpdatingStatus: boolean;
}

const initialState: PODetailSliceState = {
  item: null,
  isLoading: false,
  error: '',
  receivingMode: false,
  receivingLines: [],
  isReceiving: false,
  isUpdatingStatus: false,
};

const buildReceivingLines = (po: PurchaseOrder): ReceivingLine[] =>
  po.lines.map(l => ({
    lineId: l.id,
    itemName: l.itemName || l.description || 'Item',
    ordered: l.quantity,
    previouslyReceived: l.receivedQuantity,
    remaining: Math.max(0, l.quantity - l.receivedQuantity),
    receivingQty: 0,
  }));

export const poDetailSlice = createAppSlice({
  name: 'poDetail',
  initialState,
  reducers: create => ({
    enterReceivingMode: create.reducer(state => {
      if (!state.item) return;
      state.receivingMode = true;
      state.receivingLines = buildReceivingLines(state.item);
    }),
    exitReceivingMode: create.reducer(state => {
      state.receivingMode = false;
      state.receivingLines = [];
      state.isReceiving = false;
    }),
    setReceivingQty: create.reducer(
      (state, action: PayloadAction<{ lineId: string; qty: number }>) => {
        const rl = state.receivingLines.find(r => r.lineId === action.payload.lineId);
        if (rl) {
          rl.receivingQty = Math.min(
            Math.max(0, action.payload.qty),
            rl.remaining,
          );
        }
      },
    ),
    setIsReceiving: create.reducer((state, action: PayloadAction<boolean>) => {
      state.isReceiving = action.payload;
    }),

    clearDetail: create.reducer(state => {
      Object.assign(state, initialState);
    }),

    // ── Async thunks ────────────────────────────────

    fetchPODetail: create.asyncThunk(
      async (id: string) => getPurchaseOrderByIdAPI(id),
      {
        pending: state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action: PayloadAction<any>) => {
          state.isLoading = false;
          state.item = purchaseOrderSingleSerializer(action.payload);
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.error = action.error?.message ?? 'Failed to load purchase order';
        },
      },
    ),

    /** PATCH status — for Send / Close / Cancel transitions. */
    updatePOStatus: create.asyncThunk(
      async ({ id, status }: { id: string; status: PurchaseOrderStatus }) =>
        // Translate to the API's vocabulary — its column is varchar(16), so
        // 'partially_received' would be a Postgres 22001.
        updatePOStatusAPI(id, toApiPOStatus(status) ?? 'draft'),
      {
        pending: state => { state.isUpdatingStatus = true; },
        fulfilled: (state, action: PayloadAction<any>) => {
          state.isUpdatingStatus = false;
          const updated = purchaseOrderSingleSerializer(action.payload);
          if (updated) state.item = updated;
        },
        rejected: state => { state.isUpdatingStatus = false; },
      },
    ),

    /** POST /receive — record received quantities and transition status.
     *
     *  The API takes the ABSOLUTE cumulative quantity received per line and
     *  derives this receipt's delta itself. Sending just what is being
     *  received now makes the second partial receipt compute a NEGATIVE
     *  delta — clawing stock back and posting a wrong entry, silently. So the
     *  running total is assembled here, from state, rather than in the screen:
     *  absolute-vs-delta is domain semantics, not a UI concern. */
    receivePOItems: create.asyncThunk(
      async ({ id }: { id: string }, thunkAPI) => {
        const { receivingLines } = (thunkAPI.getState() as {
          poDetail: PODetailSliceState;
        }).poDetail;
        const lines = receivingLines
          .filter(rl => rl.receivingQty > 0)
          .map(rl => ({
            lineId: rl.lineId,
            receivedQty: String(rl.previouslyReceived + rl.receivingQty),
          }));
        return receivePurchaseOrderAPI(id, { lines });
      },
      {
        pending: state => { state.isReceiving = true; },
        fulfilled: (state, action: PayloadAction<any>) => {
          state.isReceiving = false;
          state.receivingMode = false;
          state.receivingLines = [];
          const updated = purchaseOrderSingleSerializer(action.payload);
          if (updated) state.item = updated;
        },
        rejected: state => { state.isReceiving = false; },
      },
    ),
  }),

  selectors: {
    selectItem: s => s.item,
    selectIsLoading: s => s.isLoading,
    selectDetailError: s => s.error,
    selectReceivingMode: s => s.receivingMode,
    selectReceivingLines: s => s.receivingLines,
    selectIsReceiving: s => s.isReceiving,
    selectIsUpdatingStatus: s => s.isUpdatingStatus,
  },
});

export const {
  enterReceivingMode,
  exitReceivingMode,
  setReceivingQty,
  setIsReceiving,
  clearDetail,
  fetchPODetail,
  updatePOStatus,
  receivePOItems,
} = poDetailSlice.actions;

export const {
  selectItem,
  selectIsLoading,
  selectDetailError,
  selectReceivingMode,
  selectReceivingLines,
  selectIsReceiving,
  selectIsUpdatingStatus,
} = poDetailSlice.selectors;
