// ═══════════════════════════════════════════════════════
// FinMatrix — Invoice Detail Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Flow: Screen → Slice → Network → Serializer (in fulfilled) → Screen

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { Invoice, Payment } from '../../../types';
import {
  getInvoiceByIdAPI,
  sendInvoiceAPI,
} from '../../../networks/sales/invoiceNetwork';
import { getPaymentsByInvoiceAPI } from '../../../networks/sales/paymentNetwork';
import { invoiceSingleSerializer } from '../../../serializers/invoiceSerializer';
import { paymentListSerializer } from '../../../serializers/paymentSerializer';

export interface InvoiceDetailSliceState {
  invoice: Invoice | null;
  payments: Payment[];
  isLoading: boolean;
  isSending: boolean;
  error: string;
}

const initialState: InvoiceDetailSliceState = {
  invoice: null,
  payments: [],
  isLoading: false,
  isSending: false,
  error: '',
};

export const invoiceDetailSlice = createAppSlice({
  name: 'invoiceDetail',
  initialState,
  reducers: create => ({
    resetInvoiceDetail: create.reducer(state => {
      state.invoice = null;
      state.payments = [];
      state.isLoading = false;
      state.isSending = false;
      state.error = '';
    }),

    fetchInvoiceDetail: create.asyncThunk(
      async (invoiceId: string) => {
        const [invoiceEnvelope, payments] = await Promise.all([
          getInvoiceByIdAPI(invoiceId),
          getPaymentsByInvoiceAPI(invoiceId),
        ]);
        return { invoiceEnvelope, payments };
      },
      {
        pending: state => {
          state.isLoading = true;
          state.error = '';
        },
        fulfilled: (state, action: PayloadAction<any>) => {
          state.invoice = invoiceSingleSerializer(action.payload.invoiceEnvelope);
          state.payments = paymentListSerializer(action.payload.payments);
          state.isLoading = false;
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.error = action.error?.message ?? 'Failed to load invoice';
        },
      },
    ),

    // Marks invoice as sent via WhatsApp / email / generic share.
    // The backend transitions `draft → sent` automatically.
    sendInvoice: create.asyncThunk(
      async (
        args: {
          id: string;
          channel: 'whatsapp' | 'email' | 'share';
          toPhone?: string;
          /** Owner only: past the customer's credit limit, with a reason. */
          overrideReason?: string;
        },
        thunkAPI,
      ) =>
        sendInvoiceAPI(args.id, { channel: args.channel, toPhone: args.toPhone }, args.overrideReason).catch(
          (e: any) => thunkAPI.rejectWithValue({ message: e?.message, code: e?.code, details: e?.details }),
        ),
      {
        pending: state => {
          state.isSending = true;
          state.error = '';
        },
        fulfilled: (state, action: PayloadAction<any>) => {
          const updated = invoiceSingleSerializer(action.payload);
          if (updated) state.invoice = updated;
          state.isSending = false;
        },
        rejected: (state, action) => {
          state.isSending = false;
          state.error =
            (action.payload as any)?.message ?? action.error?.message ?? 'Failed to record invoice send';
        },
      },
    ),
  }),

  selectors: {
    selectInvoiceDetail: state => state.invoice,
    selectInvoicePayments: state => state.payments,
    selectInvoiceDetailLoading: state => state.isLoading,
    selectInvoiceDetailSending: state => state.isSending,
    selectInvoiceDetailError: state => state.error,
  },
});

export const {
  resetInvoiceDetail,
  fetchInvoiceDetail,
  sendInvoice,
} = invoiceDetailSlice.actions;

export const {
  selectInvoiceDetail,
  selectInvoicePayments,
  selectInvoiceDetailLoading,
  selectInvoiceDetailSending,
  selectInvoiceDetailError,
} = invoiceDetailSlice.selectors;
