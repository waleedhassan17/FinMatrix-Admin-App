// ═══════════════════════════════════════════════════════
// FinMatrix — Invoice List Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Flow: Screen → Slice → Network → Serializer (in fulfilled) → Screen

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { Invoice, InvoiceStatus } from '../../../types';
import {
  getInvoicesAPI,
  deleteInvoiceAPI,
} from '../../../networks/sales/invoiceNetwork';
import {
  invoiceListSerializer,
  invoiceSingleSerializer,
} from '../../../serializers/invoiceSerializer';

export type InvoiceStatusFilter = 'all' | InvoiceStatus;

export interface InvoiceListSliceState {
  invoices: Invoice[];
  searchQuery: string;
  statusFilter: InvoiceStatusFilter;
  isLoading: boolean;
  error: string;
  page: number;
  totalPages: number;
  totalInvoices: number;
}

const initialState: InvoiceListSliceState = {
  invoices: [],
  searchQuery: '',
  statusFilter: 'all',
  isLoading: false,
  error: '',
  page: 1,
  totalPages: 1,
  totalInvoices: 0,
};

export const invoiceListSlice = createAppSlice({
  name: 'invoiceList',
  initialState,
  reducers: create => ({
    setInvoices: create.reducer((state, action: PayloadAction<Invoice[]>) => {
      state.invoices = action.payload;
    }),
    setSearchQuery: create.reducer((state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    }),
    setStatusFilter: create.reducer((state, action: PayloadAction<InvoiceStatusFilter>) => {
      state.statusFilter = action.payload;
    }),
    resetInvoiceList: create.reducer(state => {
      state.searchQuery = '';
      state.statusFilter = 'all';
      state.isLoading = false;
      state.error = '';
    }),
    // Upsert a single invoice — used after an action (send, edit)
    // updates one item without refetching the whole list.
    upsertInvoice: create.reducer((state, action: PayloadAction<Invoice>) => {
      const idx = state.invoices.findIndex(i => i.id === action.payload.id);
      if (idx === -1) state.invoices.push(action.payload);
      else state.invoices[idx] = action.payload;
    }),

    // ── Async thunks (flow: Network → Serializer → State) ──
    fetchInvoices: create.asyncThunk(
      async () => getInvoicesAPI(),
      {
        pending: state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action: PayloadAction<any>) => {
          const data = invoiceListSerializer(action.payload);
          state.invoices = data.invoices;
          state.page = data.page;
          state.totalPages = data.totalPages;
          state.totalInvoices = data.totalInvoices;
          state.isLoading = false;
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.error = action.error?.message ?? 'Failed to fetch invoices';
        },
      },
    ),
    removeInvoice: create.asyncThunk(
      async (id: string) => {
        await deleteInvoiceAPI(id);
        return id;
      },
      {
        fulfilled: (state, action: PayloadAction<string>) => {
          state.invoices = state.invoices.filter(i => i.id !== action.payload);
        },
      },
    ),
  }),

  selectors: {
    selectInvoices: state => state.invoices,
    selectInvoiceSearchQuery: state => state.searchQuery,
    selectInvoiceStatusFilter: state => state.statusFilter,
    selectInvoiceIsLoading: state => state.isLoading,
    selectInvoiceError: state => state.error,
  },
});

// Exported for consumers who want to apply the serializer locally
// (e.g. after a send-invoice call returns a single updated entity).
export { invoiceSingleSerializer };

export const {
  setInvoices,
  setSearchQuery,
  setStatusFilter,
  resetInvoiceList,
  upsertInvoice,
  fetchInvoices,
  removeInvoice,
} = invoiceListSlice.actions;

export const {
  selectInvoices,
  selectInvoiceSearchQuery,
  selectInvoiceStatusFilter,
  selectInvoiceIsLoading,
  selectInvoiceError,
} = invoiceListSlice.selectors;
