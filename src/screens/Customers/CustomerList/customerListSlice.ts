// ═══════════════════════════════════════════════════════
// FinMatrix — Customer List Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { Customer } from '../../../types';
import {
  getCustomersAPI,
  createCustomerAPI,
  updateCustomerAPI,
  deleteCustomerAPI,
  toggleCustomerActiveAPI,
} from '../../../networks/sales/customerNetwork';
import {
  customerListSerializer,
  customerSingleSerializer,
} from '../../../serializers/customerSerializer';

export type CustomerStatusFilter = 'all' | 'active' | 'inactive';
export type CustomerSortField = 'name' | 'balance' | 'recent';

export interface CustomerListSliceState {
  customers: Customer[];
  searchQuery: string;
  statusFilter: CustomerStatusFilter;
  sortField: CustomerSortField;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string;
  page: number;
  totalPages: number;
  totalCustomers: number;
}

const initialState: CustomerListSliceState = {
  customers: [],
  searchQuery: '',
  statusFilter: 'all',
  sortField: 'name',
  isLoading: false,
  isLoadingMore: false,
  error: '',
  page: 1,
  totalPages: 1,
  totalCustomers: 0,
};

const PAGE_SIZE = 50;

interface FetchCustomersArg {
  page?: number;
  search?: string;
  append?: boolean;
}

export const customerListSlice = createAppSlice({
  name: 'customerList',
  initialState,
  reducers: create => ({
    setCustomers: create.reducer((state, action: PayloadAction<Customer[]>) => {
      state.customers = action.payload;
    }),
    upsertCustomer: create.reducer((state, action: PayloadAction<Customer>) => {
      const idx = state.customers.findIndex(c => c.id === action.payload.id);
      if (idx !== -1) state.customers[idx] = action.payload;
      else state.customers.unshift(action.payload);
    }),
    setSearchQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    }),
    setStatusFilter: create.reducer((state, action: PayloadAction<CustomerStatusFilter>) => {
      state.statusFilter = action.payload;
    }),
    setSortField: create.reducer((state, action: PayloadAction<CustomerSortField>) => {
      state.sortField = action.payload;
    }),
    resetCustomerList: create.reducer(state => {
      state.searchQuery = '';
      state.statusFilter = 'all';
      state.sortField = 'name';
      state.isLoading = false;
      state.error = '';
    }),

    // ── Async thunks (flow: Network → Serializer → State) ──
    fetchCustomers: create.asyncThunk(
      async (arg: FetchCustomersArg | void) => {
        const a = (arg ?? {}) as FetchCustomersArg;
        const payload = await getCustomersAPI({
          page: a.page ?? 1,
          limit: PAGE_SIZE,
          search: a.search?.trim() || undefined,
        });
        return { payload, append: a.append === true };
      },
      {
        pending: (state, action) => {
          const a = (action.meta.arg ?? {}) as FetchCustomersArg;
          if (a.append) state.isLoadingMore = true;
          else state.isLoading = true;
          state.error = '';
        },
        fulfilled: (state, action: PayloadAction<{ payload: any; append: boolean }>) => {
          const data = customerListSerializer(action.payload.payload);
          if (action.payload.append) {
            const existing = new Set(state.customers.map(c => c.id));
            state.customers.push(...data.customers.filter(c => !existing.has(c.id)));
          } else {
            state.customers = data.customers;
          }
          state.page = data.page;
          state.totalPages = data.totalPages;
          state.totalCustomers = data.totalCustomers;
          state.isLoading = false;
          state.isLoadingMore = false;
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.isLoadingMore = false;
          state.error = action.error?.message ?? 'Failed to fetch customers';
        },
      },
    ),
    createCustomer: create.asyncThunk(
      async (data: Record<string, unknown>) => createCustomerAPI(data),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const customer = customerSingleSerializer(action.payload);
          if (customer) state.customers.push(customer);
        },
      },
    ),
    editCustomer: create.asyncThunk(
      async ({ id, data }: { id: string; data: Record<string, unknown> }) =>
        updateCustomerAPI(id, data),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const customer = customerSingleSerializer(action.payload);
          if (!customer) return;
          const idx = state.customers.findIndex(c => c.id === customer.id);
          if (idx !== -1) state.customers[idx] = customer;
        },
      },
    ),
    removeCustomer: create.asyncThunk(
      async (id: string) => {
        await deleteCustomerAPI(id);
        return id;
      },
      {
        fulfilled: (state, action: PayloadAction<string>) => {
          state.customers = state.customers.filter(c => c.id !== action.payload);
        },
      },
    ),
    toggleCustomerActive: create.asyncThunk(
      async (id: string) => toggleCustomerActiveAPI(id),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const customer = customerSingleSerializer(action.payload);
          if (!customer) return;
          const idx = state.customers.findIndex(c => c.id === customer.id);
          if (idx !== -1) state.customers[idx] = customer;
        },
      },
    ),
  }),

  selectors: {
    selectCustomers: state => state.customers,
    selectCustomerSearchQuery: state => state.searchQuery,
    selectCustomerStatusFilter: state => state.statusFilter,
    selectCustomerSortField: state => state.sortField,
    selectCustomerIsLoading: state => state.isLoading,
    selectCustomerIsLoadingMore: state => state.isLoadingMore,
    selectCustomerError: state => state.error,
    selectCustomerPage: state => state.page,
    selectCustomerTotalPages: state => state.totalPages,
    selectCustomerTotal: state => state.totalCustomers,
  },
});

export const {
  setCustomers,
  upsertCustomer,
  setSearchQuery,
  setStatusFilter,
  setSortField,
  resetCustomerList,
  fetchCustomers,
  createCustomer,
  editCustomer,
  removeCustomer,
  toggleCustomerActive,
} = customerListSlice.actions;

export const {
  selectCustomers,
  selectCustomerSearchQuery,
  selectCustomerStatusFilter,
  selectCustomerSortField,
  selectCustomerIsLoading,
  selectCustomerIsLoadingMore,
  selectCustomerError,
  selectCustomerPage,
  selectCustomerTotalPages,
  selectCustomerTotal,
} = customerListSlice.selectors;
