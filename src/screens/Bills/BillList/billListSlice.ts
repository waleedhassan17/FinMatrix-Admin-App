// ═══════════════════════════════════════════════════════
// FinMatrix — Bill List Slice (createAppSlice)
// ═══════════════════════════════════════════════════════
// Co-located with BillListScreen.tsx
// Flow: Screen → Slice → Network → Serializer (in fulfilled) → Screen
// Mirrors `glSlice.ts`.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { Bill, BillStatus } from '../../../types';
import {
  getBillsAPI,
  createBillAPI,
  updateBillAPI,
  deleteBillAPI,
} from '../../../networks/purchases/billNetwork';
import {
  billListSerializer,
  billSingleSerializer,
} from '../../../serializers/billSerializer';

export type BillStatusFilter = 'all' | BillStatus;


export interface BillListSliceState {
  bills: Bill[];
  searchQuery: string;
  statusFilter: BillStatusFilter;
  isLoading: boolean;
  error: string;
  page: number;
  totalPages: number;
  totalBills: number;
  counts: Record<'all' | BillStatus, number>;
  totalOutstanding: number;
  overdueAmount: number;
}

const initialState: BillListSliceState = {
  bills: [],
  searchQuery: '',
  statusFilter: 'all',
  isLoading: false,
  error: '',
  page: 1,
  totalPages: 1,
  totalBills: 0,
  counts: { all: 0, draft: 0, open: 0, partial: 0, paid: 0, overdue: 0, void: 0 },
  totalOutstanding: 0,
  overdueAmount: 0,
};

export const billListSlice = createAppSlice({
  name: 'billList',
  initialState,
  reducers: create => ({
    setSearchQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    }),
    setStatusFilter: create.reducer((state, action: PayloadAction<BillStatusFilter>) => {
      state.statusFilter = action.payload;
    }),
    /** Upsert a single bill — used after create/edit/void without
     *  refetching the whole list. */
    upsertBill: create.reducer((state, action: PayloadAction<Bill>) => {
      const idx = state.bills.findIndex(b => b.id === action.payload.id);
      if (idx === -1) state.bills.unshift(action.payload);
      else state.bills[idx] = action.payload;
    }),
    resetBillList: create.reducer(state => {
      Object.assign(state, initialState);
    }),

    // ── Async thunks ────────────────────────────────
    fetchBills: create.asyncThunk(
      async (_arg, thunkAPI) => {
        const root = thunkAPI.getState() as { billList: BillListSliceState };
        const { searchQuery } = root.billList;
        // The status tab is applied client-side ONLY. Filtering server-side
        // too meant `bills` held just that tab, so the Outstanding tile read
        // Rs 0 on the Paid tab and every other tab's count collapsed to 0.
        // The limit is explicit because the API defaults to 50 and silently
        // drops the rest.
        return getBillsAPI({
          ...(searchQuery ? { search: searchQuery } : {}),
          limit: 200,
        });
      },
      {
        pending: state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action: PayloadAction<any>) => {
          const data = billListSerializer(action.payload);
          state.bills = data.bills;
          state.page = data.page;
          state.totalPages = data.totalPages;
          state.totalBills = data.totalBills;
          state.counts = data.counts;
          state.totalOutstanding = data.totalOutstanding;
          state.overdueAmount = data.overdueAmount;
          state.isLoading = false;
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.error = action.error?.message ?? 'Failed to load bills';
        },
      },
    ),

    createBill: create.asyncThunk(
      async (data: Omit<Bill, 'id' | 'createdAt' | 'updatedAt'>) =>
        createBillAPI(data),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const b = billSingleSerializer(action.payload);
          if (b) state.bills.unshift(b);
        },
      },
    ),

    editBill: create.asyncThunk(
      async ({ id, data }: { id: string; data: Partial<Bill> }) =>
        updateBillAPI(id, data),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const b = billSingleSerializer(action.payload);
          if (!b) return;
          const idx = state.bills.findIndex(x => x.id === b.id);
          if (idx !== -1) state.bills[idx] = b;
        },
      },
    ),

    removeBill: create.asyncThunk(
      async (billId: string) => {
        await deleteBillAPI(billId);
        return billId;
      },
      {
        fulfilled: (state, action) => {
          state.bills = state.bills.filter(b => b.id !== action.payload);
        },
      },
    ),
  }),

  selectors: {
    selectBills: state => state.bills,
    selectBillSearchQuery: state => state.searchQuery,
    selectBillStatusFilter: state => state.statusFilter,
    selectBillIsLoading: state => state.isLoading,
    selectBillError: state => state.error,
    selectBillCounts: state => state.counts,
    selectBillTotalOutstanding: state => state.totalOutstanding,
    selectBillOverdueAmount: state => state.overdueAmount,
    selectBillTotalBills: state => state.totalBills,
  },
});

export const {
  setSearchQuery,
  setStatusFilter,
  upsertBill,
  resetBillList,
  fetchBills,
  createBill,
  editBill,
  removeBill,
} = billListSlice.actions;

export const {
  selectBills,
  selectBillSearchQuery,
  selectBillStatusFilter,
  selectBillIsLoading,
  selectBillError,
  selectBillCounts,
  selectBillTotalOutstanding,
  selectBillOverdueAmount,
  selectBillTotalBills,
} = billListSlice.selectors;

/** Memoized — returns a stable object reference unless inputs change. */
export const selectBillTotals = createSelector(
  [selectBillTotalOutstanding, selectBillOverdueAmount, selectBillTotalBills],
  (totalOutstanding, overdueAmount, totalBills) => ({
    totalOutstanding,
    overdueAmount,
    totalBills,
  }),
);
