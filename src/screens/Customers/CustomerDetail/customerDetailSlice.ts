// ═══════════════════════════════════════════════════════
// FinMatrix — Customer Detail Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Owns the detail screen's server data: the fresh customer record
// (GET /customers/:id) plus the real invoice and payment histories
// (GET /customers/:id/invoices | /payments) shown in the tabs.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { Customer } from '../../../types';
import {
  getCustomerByIdAPI,
  getCustomerInvoicesAPI,
  getCustomerPaymentsAPI,
} from '../../../networks/sales/customerNetwork';
import {
  customerSingleSerializer,
  customerInvoicesSerializer,
  customerPaymentsSerializer,
  type CustomerInvoiceRow,
  type CustomerPaymentRow,
} from '../../../serializers/customerSerializer';

export type CustomerDetailTab = 'overview' | 'invoices' | 'payments';

type LoadStatus = 'idle' | 'loading' | 'failed' | 'loaded';

interface TabListState<T> {
  rows: T[];
  status: LoadStatus;
  error: string;
  page: number;
  totalPages: number;
}

const emptyTabList = <T,>(): TabListState<T> => ({
  rows: [],
  status: 'idle',
  error: '',
  page: 1,
  totalPages: 1,
});

export interface CustomerDetailSliceState {
  activeTab: CustomerDetailTab;
  customer: Customer | null;
  status: LoadStatus;
  error: string;
  invoices: TabListState<CustomerInvoiceRow>;
  payments: TabListState<CustomerPaymentRow>;
}

const initialState: CustomerDetailSliceState = {
  activeTab: 'overview',
  customer: null,
  status: 'idle',
  error: '',
  invoices: emptyTabList<CustomerInvoiceRow>(),
  payments: emptyTabList<CustomerPaymentRow>(),
};

const PAGE_SIZE = 25;

export const customerDetailSlice = createAppSlice({
  name: 'customerDetail',
  initialState,
  reducers: create => ({
    setActiveTab: create.reducer((state, action: PayloadAction<CustomerDetailTab>) => {
      state.activeTab = action.payload;
    }),
    resetCustomerDetail: create.reducer(() => initialState),
    // Keeps the header/balance in sync after a toggle-active or edit
    // without a full refetch.
    upsertDetailCustomer: create.reducer((state, action: PayloadAction<Customer>) => {
      if (state.customer && state.customer.id === action.payload.id) {
        // totalPurchases only comes from the detail endpoint — keep it.
        state.customer = { ...action.payload, totalPurchases: state.customer.totalPurchases };
      }
    }),

    fetchCustomerDetail: create.asyncThunk(
      async (customerId: string) => getCustomerByIdAPI(customerId),
      {
        pending: state => { state.status = 'loading'; state.error = ''; },
        fulfilled: (state, action: PayloadAction<any>) => {
          state.customer = customerSingleSerializer(action.payload);
          state.status = state.customer ? 'loaded' : 'failed';
          if (!state.customer) state.error = 'Customer not found';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = action.error?.message ?? 'Failed to load customer';
        },
      },
    ),

    fetchCustomerInvoices: create.asyncThunk(
      async (arg: { customerId: string; page?: number }) => {
        const payload = await getCustomerInvoicesAPI(arg.customerId, {
          page: arg.page ?? 1,
          limit: PAGE_SIZE,
        });
        return { payload, append: (arg.page ?? 1) > 1 };
      },
      {
        pending: state => { state.invoices.status = 'loading'; state.invoices.error = ''; },
        fulfilled: (state, action: PayloadAction<{ payload: any; append: boolean }>) => {
          const data = customerInvoicesSerializer(action.payload.payload);
          state.invoices.rows = action.payload.append
            ? [...state.invoices.rows, ...data.rows]
            : data.rows;
          state.invoices.page = data.page;
          state.invoices.totalPages = data.totalPages;
          state.invoices.status = 'loaded';
        },
        rejected: (state, action) => {
          state.invoices.status = 'failed';
          state.invoices.error = action.error?.message ?? 'Failed to load invoices';
        },
      },
    ),

    fetchCustomerPayments: create.asyncThunk(
      async (arg: { customerId: string; page?: number }) => {
        const payload = await getCustomerPaymentsAPI(arg.customerId, {
          page: arg.page ?? 1,
          limit: PAGE_SIZE,
        });
        return { payload, append: (arg.page ?? 1) > 1 };
      },
      {
        pending: state => { state.payments.status = 'loading'; state.payments.error = ''; },
        fulfilled: (state, action: PayloadAction<{ payload: any; append: boolean }>) => {
          const data = customerPaymentsSerializer(action.payload.payload);
          state.payments.rows = action.payload.append
            ? [...state.payments.rows, ...data.rows]
            : data.rows;
          state.payments.page = data.page;
          state.payments.totalPages = data.totalPages;
          state.payments.status = 'loaded';
        },
        rejected: (state, action) => {
          state.payments.status = 'failed';
          state.payments.error = action.error?.message ?? 'Failed to load payments';
        },
      },
    ),
  }),

  selectors: {
    selectCustomerDetailTab: state => state.activeTab,
    selectCustomerDetail: state => state.customer,
    selectCustomerDetailStatus: state => state.status,
    selectCustomerDetailError: state => state.error,
    selectCustomerDetailInvoices: state => state.invoices,
    selectCustomerDetailPayments: state => state.payments,
  },
});

export const {
  setActiveTab,
  resetCustomerDetail,
  upsertDetailCustomer,
  fetchCustomerDetail,
  fetchCustomerInvoices,
  fetchCustomerPayments,
} = customerDetailSlice.actions;

export const {
  selectCustomerDetailTab,
  selectCustomerDetail,
  selectCustomerDetailStatus,
  selectCustomerDetailError,
  selectCustomerDetailInvoices,
  selectCustomerDetailPayments,
} = customerDetailSlice.selectors;
