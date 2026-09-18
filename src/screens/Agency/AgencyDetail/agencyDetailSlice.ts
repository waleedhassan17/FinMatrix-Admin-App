// ═══════════════════════════════════════════════════════
// FinMatrix — Agency Detail Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Co-located with AgencyDetailScreen.tsx
// Manages detail-screen UI state: active tab, search, sort.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

export type AgencyDetailTab = 'inventory' | 'deliveries' | 'analytics';
export type InventorySortField = 'name' | 'sku' | 'quantity' | 'value';

export interface AgencyDetailSliceState {
  activeTab: AgencyDetailTab;
  inventorySearch: string;
  inventorySort: InventorySortField;
  inventorySortAsc: boolean;
  status: 'idle' | 'loading' | 'failed';
  error: string;
}

const initialState: AgencyDetailSliceState = {
  activeTab: 'inventory',
  inventorySearch: '',
  inventorySort: 'name',
  inventorySortAsc: true,
  status: 'idle',
  error: '',
};

export const agencyDetailSlice = createAppSlice({
  name: 'agencyDetail',
  initialState,
  reducers: create => ({
    setActiveTab: create.reducer((state, action: PayloadAction<AgencyDetailTab>) => {
      state.activeTab = action.payload;
    }),
    setInventorySearch: create.reducer((state, action: PayloadAction<string>) => {
      state.inventorySearch = action.payload;
    }),
    setInventorySort: create.reducer((state, action: PayloadAction<InventorySortField>) => {
      if (state.inventorySort === action.payload) {
        state.inventorySortAsc = !state.inventorySortAsc;
      } else {
        state.inventorySort = action.payload;
        state.inventorySortAsc = true;
      }
    }),
    resetAgencyDetail: create.reducer(state => {
      state.activeTab = 'inventory';
      state.inventorySearch = '';
      state.inventorySort = 'name';
      state.inventorySortAsc = true;
      state.status = 'idle';
      state.error = '';
    }),
  }),

  selectors: {
    selectAgencyDetailTab: state => state.activeTab,
    selectInventorySearch: state => state.inventorySearch,
    selectInventorySort: state => state.inventorySort,
    selectInventorySortAsc: state => state.inventorySortAsc,
    selectAgencyDetailStatus: state => state.status,
    selectAgencyDetailError: state => state.error,
  },
});

export const {
  setActiveTab,
  setInventorySearch,
  setInventorySort,
  resetAgencyDetail,
} = agencyDetailSlice.actions;

export const {
  selectAgencyDetailTab,
  selectInventorySearch,
  selectInventorySort,
  selectInventorySortAsc,
  selectAgencyDetailStatus,
  selectAgencyDetailError,
} = agencyDetailSlice.selectors;
