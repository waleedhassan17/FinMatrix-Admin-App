// ═══════════════════════════════════════════════════════
// FinMatrix — Agency List Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Co-located with AgencyListScreen.tsx
// Owns all agency data + CRUD thunks + list UI state.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { WarehouseAgency } from '../../../models/agencyModel';
import {
  getAgenciesAPI,
  createAgencyAPI,
  updateAgencyAPI,
  deleteAgencyAPI,
} from '../../../networks/inventory/agencyNetwork';
import {
  agencyDeleteSerializer,
  agencyListSerializer,
  agencySingleSerializer,
} from '../../../serializers/agencySerializer';

export interface AgencyListSliceState {
  agencies: WarehouseAgency[];
  searchQuery: string;
  typeFilter: string;
  isLoading: boolean;
  error: string;
}

const initialState: AgencyListSliceState = {
  agencies: [],
  searchQuery: '',
  typeFilter: 'all',
  isLoading: false,
  error: '',
};

export const agencyListSlice = createAppSlice({
  name: 'agencyList',
  initialState,
  reducers: create => ({
    setAgencies: create.reducer((state, action: PayloadAction<WarehouseAgency[]>) => {
      state.agencies = action.payload;
    }),
    setSearchQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    }),
    setTypeFilter: create.reducer((state, action: PayloadAction<string>) => {
      state.typeFilter = action.payload;
    }),
    resetAgencyList: create.reducer(state => {
      state.searchQuery = '';
      state.typeFilter = 'all';
      state.isLoading = false;
      state.error = '';
    }),

    // ── Async thunks ────────────────────────────────
    fetchAgencies: create.asyncThunk(
      async () => {
        const envelope = await getAgenciesAPI();
        return agencyListSerializer(envelope);
      },
      {
        pending: state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action) => {
          state.agencies = action.payload;
          state.isLoading = false;
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.error = action.error?.message ?? 'Failed to fetch agencies';
        },
      },
    ),
    createAgency: create.asyncThunk(
      async (data: Omit<WarehouseAgency, 'id' | 'productCount'>) => {
        const envelope = await createAgencyAPI(data);
        return agencySingleSerializer(envelope);
      },
      {
        fulfilled: (state, action) => {
          if (action.payload) state.agencies.push(action.payload);
        },
      },
    ),
    editAgency: create.asyncThunk(
      async ({ id, data }: { id: string; data: Partial<WarehouseAgency> }) => {
        const envelope = await updateAgencyAPI(id, data);
        return agencySingleSerializer(envelope);
      },
      {
        fulfilled: (state, action) => {
          if (!action.payload) return;
          const idx = state.agencies.findIndex(a => a.id === action.payload!.id);
          if (idx !== -1) state.agencies[idx] = action.payload;
        },
      },
    ),
    removeAgency: create.asyncThunk(
      async (id: string) => {
        const envelope = await deleteAgencyAPI(id);
        return agencyDeleteSerializer(envelope) || id;
      },
      {
        fulfilled: (state, action) => {
          state.agencies = state.agencies.filter(a => a.id !== action.payload);
        },
      },
    ),
  }),

  selectors: {
    selectAgencies: state => state.agencies,
    selectAgencySearchQuery: state => state.searchQuery,
    selectAgencyTypeFilter: state => state.typeFilter,
    selectAgencyIsLoading: state => state.isLoading,
    selectAgencyError: state => state.error,
  },
});

export const {
  setAgencies,
  setSearchQuery,
  setTypeFilter,
  resetAgencyList,
  fetchAgencies,
  createAgency,
  editAgency,
  removeAgency,
} = agencyListSlice.actions;

export const {
  selectAgencies,
  selectAgencySearchQuery,
  selectAgencyTypeFilter,
  selectAgencyIsLoading,
  selectAgencyError,
} = agencyListSlice.selectors;
