// ═══════════════════════════════════════════════════════
// FinMatrix — Vendor Detail Slice (createAppSlice)
// ═══════════════════════════════════════════════════════
// Owns:
//   • UI tab state (overview / bills / payments)
//   • Detail fetch (single vendor) — flows through serializer
//   • Toggle-active action — flows through serializer
// Mirrors the GL slice architecture.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { Vendor } from '../../../types';
import {
  getVendorByIdAPI,
  getVendorBillsAPI,
  getVendorPaymentsAPI,
  toggleVendorActiveAPI,
} from '../../../networks/purchases/vendorNetwork';
import {
  vendorSingleSerializer,
  vendorBillsSerializer,
  vendorPaymentsSerializer,
  type VendorBillRow,
  type VendorPaymentRow,
} from '../../../serializers/vendorSerializer';

export type VendorDetailTab = 'overview' | 'bills' | 'payments';

type TabLoadStatus = 'idle' | 'loading' | 'failed' | 'loaded';

interface VendorTabListState<T> {
  rows: T[];
  status: TabLoadStatus;
  error: string;
  page: number;
  totalPages: number;
}

const emptyTabList = <T,>(): VendorTabListState<T> => ({
  rows: [],
  status: 'idle',
  error: '',
  page: 1,
  totalPages: 1,
});

export interface VendorDetailSliceState {
  activeTab: VendorDetailTab;
  vendor: Vendor | null;
  status: 'idle' | 'loading' | 'failed';
  error: string;
  isToggling: boolean;
  bills: VendorTabListState<VendorBillRow>;
  payments: VendorTabListState<VendorPaymentRow>;
}

const initialState: VendorDetailSliceState = {
  activeTab: 'overview',
  vendor: null,
  status: 'idle',
  error: '',
  isToggling: false,
  bills: emptyTabList<VendorBillRow>(),
  payments: emptyTabList<VendorPaymentRow>(),
};

const PAGE_SIZE = 25;

export const vendorDetailSlice = createAppSlice({
  name: 'vendorDetail',
  initialState,
  reducers: create => ({
    setActiveTab: create.reducer((state, action: PayloadAction<VendorDetailTab>) => {
      state.activeTab = action.payload;
    }),
    setVendorDetail: create.reducer((state, action: PayloadAction<Vendor | null>) => {
      state.vendor = action.payload;
    }),
    resetVendorDetail: create.reducer(() => initialState),

    fetchVendorDetail: create.asyncThunk(
      async (id: string) => getVendorByIdAPI(id),
      {
        pending: state => { state.status = 'loading'; state.error = ''; },
        fulfilled: (state, action: PayloadAction<any>) => {
          state.vendor = vendorSingleSerializer(action.payload);
          state.status = 'idle';
        },
        rejected: (state, action) => {
          state.status = 'failed';
          state.error = action.error?.message ?? 'Failed to load vendor';
        },
      },
    ),

    fetchVendorBills: create.asyncThunk(
      async (arg: { vendorId: string; page?: number }) => {
        const payload = await getVendorBillsAPI(arg.vendorId, {
          page: arg.page ?? 1,
          limit: PAGE_SIZE,
        });
        return { payload, append: (arg.page ?? 1) > 1 };
      },
      {
        pending: state => { state.bills.status = 'loading'; state.bills.error = ''; },
        fulfilled: (state, action: PayloadAction<{ payload: any; append: boolean }>) => {
          const data = vendorBillsSerializer(action.payload.payload);
          state.bills.rows = action.payload.append
            ? [...state.bills.rows, ...data.rows]
            : data.rows;
          state.bills.page = data.page;
          state.bills.totalPages = data.totalPages;
          state.bills.status = 'loaded';
        },
        rejected: (state, action) => {
          state.bills.status = 'failed';
          state.bills.error = action.error?.message ?? 'Failed to load bills';
        },
      },
    ),

    fetchVendorPayments: create.asyncThunk(
      async (arg: { vendorId: string; page?: number }) => {
        const payload = await getVendorPaymentsAPI(arg.vendorId, {
          page: arg.page ?? 1,
          limit: PAGE_SIZE,
        });
        return { payload, append: (arg.page ?? 1) > 1 };
      },
      {
        pending: state => { state.payments.status = 'loading'; state.payments.error = ''; },
        fulfilled: (state, action: PayloadAction<{ payload: any; append: boolean }>) => {
          const data = vendorPaymentsSerializer(action.payload.payload);
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

    toggleActiveOnDetail: create.asyncThunk(
      async (id: string) => toggleVendorActiveAPI(id),
      {
        pending: state => { state.isToggling = true; },
        fulfilled: (state, action: PayloadAction<any>) => {
          const v = vendorSingleSerializer(action.payload);
          if (v) state.vendor = v;
          state.isToggling = false;
        },
        rejected: state => { state.isToggling = false; },
      },
    ),
  }),

  selectors: {
    selectVendorDetailTab: state => state.activeTab,
    selectVendorDetailStatus: state => state.status,
    selectVendorDetail: state => state.vendor,
    selectVendorDetailError: state => state.error,
    selectVendorDetailIsToggling: state => state.isToggling,
    selectVendorDetailBills: state => state.bills,
    selectVendorDetailPayments: state => state.payments,
  },
});

export const {
  setActiveTab,
  setVendorDetail,
  resetVendorDetail,
  fetchVendorDetail,
  fetchVendorBills,
  fetchVendorPayments,
  toggleActiveOnDetail,
} = vendorDetailSlice.actions;

export const {
  selectVendorDetailTab,
  selectVendorDetailStatus,
  selectVendorDetail,
  selectVendorDetailError,
  selectVendorDetailIsToggling,
  selectVendorDetailBills,
  selectVendorDetailPayments,
} = vendorDetailSlice.selectors;
