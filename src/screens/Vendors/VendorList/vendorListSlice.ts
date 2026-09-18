// ═══════════════════════════════════════════════════════
// FinMatrix — Vendor List Slice (createAppSlice)
// ═══════════════════════════════════════════════════════
// Co-located with VendorListScreen.tsx
// Flow: Screen → Slice → Network → Serializer (in fulfilled) → Screen
// Mirrors `glSlice.ts`.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { Vendor } from '../../../types';
import {
  getVendorsAPI,
  createVendorAPI,
  updateVendorAPI,
  deleteVendorAPI,
  toggleVendorActiveAPI,
} from '../../../networks/purchases/vendorNetwork';
import { vendorListSerializer, vendorSingleSerializer } from '../../../serializers/vendorSerializer';

export type VendorStatusFilter = 'all' | 'active' | 'inactive';
export type VendorSortField = 'name' | 'balance' | 'recent';

export interface VendorListSliceState {
  vendors: Vendor[];
  searchQuery: string;
  statusFilter: VendorStatusFilter;
  sortField: VendorSortField;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string;
  page: number;
  totalPages: number;
  totalVendors: number;
  activeCount: number;
  inactiveCount: number;
  totalBalance: number;
}

const initialState: VendorListSliceState = {
  vendors: [],
  searchQuery: '',
  statusFilter: 'all',
  sortField: 'name',
  isLoading: false,
  isLoadingMore: false,
  error: '',
  page: 1,
  totalPages: 1,
  totalVendors: 0,
  activeCount: 0,
  inactiveCount: 0,
  totalBalance: 0,
};

export const vendorListSlice = createAppSlice({
  name: 'vendorList',
  initialState,
  reducers: create => ({
    setVendors: create.reducer((state, action: PayloadAction<Vendor[]>) => {
      state.vendors = action.payload;
    }),
    setSearchQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    }),
    setStatusFilter: create.reducer((state, action: PayloadAction<VendorStatusFilter>) => {
      state.statusFilter = action.payload;
    }),
    setSortField: create.reducer((state, action: PayloadAction<VendorSortField>) => {
      state.sortField = action.payload;
    }),
    /** Upsert a single vendor — used after create/edit/toggle without
     *  refetching the whole list. */
    upsertVendor: create.reducer((state, action: PayloadAction<Vendor>) => {
      const idx = state.vendors.findIndex(v => v.id === action.payload.id);
      if (idx === -1) state.vendors.push(action.payload);
      else state.vendors[idx] = action.payload;
    }),
    resetVendorList: create.reducer(state => {
      state.searchQuery = '';
      state.statusFilter = 'all';
      state.sortField = 'name';
      state.isLoading = false;
      state.error = '';
    }),

    // ── Async thunks ────────────────────────────────
    fetchVendors: create.asyncThunk(
      async (arg: { page?: number; append?: boolean } | void, thunkAPI) => {
        const a = (arg ?? {}) as { page?: number; append?: boolean };
        const root = thunkAPI.getState() as { vendorList: VendorListSliceState };
        const { searchQuery, statusFilter, sortField } = root.vendorList;
        const payload = await getVendorsAPI({
          ...(searchQuery ? { search: searchQuery } : {}),
          status: statusFilter,
          sort: sortField,
          page: a.page ?? 1,
          limit: 50,
        });
        return { payload, append: a.append === true };
      },
      {
        pending: (state, action) => {
          const a = (action.meta.arg ?? {}) as { append?: boolean };
          if (a.append) state.isLoadingMore = true;
          else state.isLoading = true;
          state.error = '';
        },
        fulfilled: (state, action: PayloadAction<{ payload: any; append: boolean }>) => {
          const data = vendorListSerializer(action.payload.payload);
          if (action.payload.append) {
            const existing = new Set(state.vendors.map(v => v.id));
            state.vendors.push(...data.vendors.filter(v => !existing.has(v.id)));
          } else {
            state.vendors = data.vendors;
          }
          state.page = data.page;
          state.totalPages = data.totalPages;
          state.totalVendors = data.totalVendors;
          state.activeCount = data.activeCount;
          state.inactiveCount = data.inactiveCount;
          state.totalBalance = data.totalBalance;
          state.isLoading = false;
          state.isLoadingMore = false;
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.isLoadingMore = false;
          state.error = action.error?.message ?? 'Failed to fetch vendors';
        },
      },
    ),

    createVendor: create.asyncThunk(
      async (data: Record<string, unknown>) => createVendorAPI(data),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const v = vendorSingleSerializer(action.payload);
          if (v) state.vendors.push(v);
        },
      },
    ),
    editVendor: create.asyncThunk(
      async ({ id, data }: { id: string; data: Record<string, unknown> }) =>
        updateVendorAPI(id, data),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const v = vendorSingleSerializer(action.payload);
          if (!v) return;
          const idx = state.vendors.findIndex(x => x.id === v.id);
          if (idx !== -1) state.vendors[idx] = v;
        },
      },
    ),
    removeVendor: create.asyncThunk(
      async (id: string) => {
        await deleteVendorAPI(id);
        return id;
      },
      {
        fulfilled: (state, action) => {
          state.vendors = state.vendors.filter(v => v.id !== action.payload);
        },
      },
    ),
    toggleVendorActive: create.asyncThunk(
      async (id: string) => toggleVendorActiveAPI(id),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const v = vendorSingleSerializer(action.payload);
          if (!v) return;
          const idx = state.vendors.findIndex(x => x.id === v.id);
          if (idx !== -1) state.vendors[idx] = v;
        },
      },
    ),
  }),

  selectors: {
    selectVendors: state => state.vendors,
    selectVendorSearchQuery: state => state.searchQuery,
    selectVendorStatusFilter: state => state.statusFilter,
    selectVendorSortField: state => state.sortField,
    selectVendorIsLoading: state => state.isLoading,
    selectVendorIsLoadingMore: state => state.isLoadingMore,
    selectVendorPage: state => state.page,
    selectVendorTotalPages: state => state.totalPages,
    selectVendorError: state => state.error,
    selectVendorTotalVendors: state => state.totalVendors,
    selectVendorActiveCount: state => state.activeCount,
    selectVendorInactiveCount: state => state.inactiveCount,
    selectVendorTotalBalance: state => state.totalBalance,
  },
});

export const {
  setVendors,
  setSearchQuery,
  setStatusFilter,
  setSortField,
  upsertVendor,
  resetVendorList,
  fetchVendors,
  createVendor,
  editVendor,
  removeVendor,
  toggleVendorActive,
} = vendorListSlice.actions;

export const {
  selectVendors,
  selectVendorSearchQuery,
  selectVendorStatusFilter,
  selectVendorSortField,
  selectVendorIsLoading,
  selectVendorIsLoadingMore,
  selectVendorPage,
  selectVendorTotalPages,
  selectVendorError,
  selectVendorTotalVendors,
  selectVendorActiveCount,
  selectVendorInactiveCount,
  selectVendorTotalBalance,
} = vendorListSlice.selectors;

/** Memoized — returns a stable object reference unless inputs change. */
export const selectVendorTotals = createSelector(
  [
    selectVendorTotalVendors,
    selectVendorActiveCount,
    selectVendorInactiveCount,
    selectVendorTotalBalance,
  ],
  (totalVendors, activeCount, inactiveCount, totalBalance) => ({
    totalVendors,
    activeCount,
    inactiveCount,
    totalBalance,
  }),
);
