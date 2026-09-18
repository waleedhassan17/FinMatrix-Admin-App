// ═══════════════════════════════════════════════════════
// FinMatrix — Bill Detail Slice (createAppSlice)
// ═══════════════════════════════════════════════════════
// Owns:
//   • Bill detail fetch (single bill) + payment history
//   • Status transitions (mark-open / void) — flows through serializer
// Mirrors GL/Vendor/Credit-Memo slice architecture.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { Bill, BillPayment, BillStatus } from '../../../types';
import {
  getBillByIdAPI,
  getBillPaymentsByBillAPI,
  updateBillAPI,
} from '../../../networks/purchases/billNetwork';
import {
  billSingleSerializer,
  billPaymentsSerializer,
} from '../../../serializers/billSerializer';

export interface BillDetailSliceState {
  bill: Bill | null;
  payments: BillPayment[];
  isLoading: boolean;
  error: string;
  isUpdatingStatus: boolean;
}

const initialState: BillDetailSliceState = {
  bill: null,
  payments: [],
  isLoading: false,
  error: '',
  isUpdatingStatus: false,
};

export const billDetailSlice = createAppSlice({
  name: 'billDetail',
  initialState,
  reducers: create => ({
    resetBillDetail: create.reducer(state => {
      Object.assign(state, initialState);
    }),

    fetchBillDetail: create.asyncThunk(
      async (billId: string) => {
        const [billEnv, paymentsEnv] = await Promise.all([
          getBillByIdAPI(billId),
          getBillPaymentsByBillAPI(billId),
        ]);
        return {
          bill: billSingleSerializer(billEnv),
          payments: billPaymentsSerializer(paymentsEnv),
        };
      },
      {
        pending: state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action: PayloadAction<{ bill: Bill | null; payments: BillPayment[] }>) => {
          state.bill = action.payload.bill;
          state.payments = action.payload.payments;
          state.isLoading = false;
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.error = action.error?.message ?? 'Failed to load bill';
        },
      },
    ),

    /** Generic status transition (mark-open, void, etc.) */
    updateBillStatus: create.asyncThunk(
      async ({ id, status }: { id: string; status: BillStatus }) =>
        updateBillAPI(id, { status }),
      {
        pending: state => { state.isUpdatingStatus = true; },
        fulfilled: (state, action: PayloadAction<any>) => {
          const b = billSingleSerializer(action.payload);
          if (b) state.bill = b;
          state.isUpdatingStatus = false;
        },
        rejected: state => { state.isUpdatingStatus = false; },
      },
    ),
  }),

  selectors: {
    selectBillDetail: state => state.bill,
    selectBillPayments: state => state.payments,
    selectBillDetailLoading: state => state.isLoading,
    selectBillDetailError: state => state.error,
    selectBillDetailIsUpdatingStatus: state => state.isUpdatingStatus,
  },
});

export const {
  resetBillDetail,
  fetchBillDetail,
  updateBillStatus,
} = billDetailSlice.actions;

export const {
  selectBillDetail,
  selectBillPayments,
  selectBillDetailLoading,
  selectBillDetailError,
  selectBillDetailIsUpdatingStatus,
} = billDetailSlice.selectors;
