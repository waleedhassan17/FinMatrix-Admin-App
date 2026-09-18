// ═══════════════════════════════════════════════════════
// FinMatrix — Agency Inventory Sync Slice (createAppSlice)
// ═══════════════════════════════════════════════════════
// Co-located with AgencyInventorySyncScreen.tsx
// Manages sync state, selection, and status tracking.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { syncAgencyInventoryAPI } from '../../../networks/inventory/agencyNetwork';
import { agencySingleSerializer } from '../../../serializers/agencySerializer';

export type SyncStatus = 'synced' | 'mismatch' | 'agency_only' | 'system_only';

export interface SyncRow {
  agencyItemId: string;
  name: string;
  sku: string;
  agencyQty: number;
  systemQty: number;
  status: SyncStatus;
  selected: boolean;
}

export interface AgencyInventorySyncSliceState {
  rows: SyncRow[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string;
  searchQuery: string;
  statusFilter: SyncStatus | 'all';
}

const initialState: AgencyInventorySyncSliceState = {
  rows: [],
  isLoading: false,
  isSyncing: false,
  error: '',
  searchQuery: '',
  statusFilter: 'all',
};

export const agencyInventorySyncSlice = createAppSlice({
  name: 'agencyInventorySync',
  initialState,
  reducers: create => ({
    setRows: create.reducer((state, action: PayloadAction<SyncRow[]>) => {
      state.rows = action.payload;
      state.isLoading = false;
    }),
    setSearchQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    }),
    setStatusFilter: create.reducer((state, action: PayloadAction<SyncStatus | 'all'>) => {
      state.statusFilter = action.payload;
    }),
    toggleRowSelection: create.reducer((state, action: PayloadAction<string>) => {
      const row = state.rows.find(r => r.agencyItemId === action.payload);
      if (row) row.selected = !row.selected;
    }),
    selectAll: create.reducer(state => {
      state.rows.forEach(r => { r.selected = true; });
    }),
    deselectAll: create.reducer(state => {
      state.rows.forEach(r => { r.selected = false; });
    }),
    setIsLoading: create.reducer((state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    }),
    setIsSyncing: create.reducer((state, action: PayloadAction<boolean>) => {
      state.isSyncing = action.payload;
    }),
    markRowsSynced: create.reducer((state, action: PayloadAction<string[]>) => {
      for (const id of action.payload) {
        const row = state.rows.find(r => r.agencyItemId === id);
        if (row) {
          row.status = 'synced';
          row.systemQty = row.agencyQty;
          row.selected = false;
        }
      }
    }),
    resetSync: create.reducer(state => {
      Object.assign(state, initialState);
    }),

    // ── Async thunks ────────────────────────────────
    syncSelectedItems: create.asyncThunk(
      async ({ agencyId, itemIds }: { agencyId: string; itemIds: string[] }) => {
        const envelope = await syncAgencyInventoryAPI(agencyId, itemIds);
        return agencySingleSerializer(envelope);
      },
      {
        pending: state => { state.isSyncing = true; state.error = ''; },
        fulfilled: state => { state.isSyncing = false; },
        rejected: (state, action) => {
          state.isSyncing = false;
          state.error = action.error?.message ?? 'Sync failed';
        },
      },
    ),
  }),

  selectors: {
    selectSyncRows: state => state.rows,
    selectSyncIsLoading: state => state.isLoading,
    selectSyncIsSyncing: state => state.isSyncing,
    selectSyncError: state => state.error,
    selectSyncSearchQuery: state => state.searchQuery,
    selectSyncStatusFilter: state => state.statusFilter,
  },
});

export const {
  setRows,
  setSearchQuery,
  setStatusFilter,
  toggleRowSelection,
  selectAll,
  deselectAll,
  setIsLoading,
  setIsSyncing,
  markRowsSynced,
  resetSync,
  syncSelectedItems,
} = agencyInventorySyncSlice.actions;

export const {
  selectSyncRows,
  selectSyncIsLoading,
  selectSyncIsSyncing,
  selectSyncError,
  selectSyncSearchQuery,
  selectSyncStatusFilter,
} = agencyInventorySyncSlice.selectors;
