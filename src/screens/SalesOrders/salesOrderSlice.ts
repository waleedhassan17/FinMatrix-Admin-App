// ═══════════════════════════════════════════════════════
// FinMatrix — Sales Orders Slice (list + detail + actions)
// ═══════════════════════════════════════════════════════
import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { SalesOrder, SalesOrderStatus } from '../../models/salesOrderModel';
import {
  getSalesOrdersAPI, getSalesOrderByIdAPI, fulfillSalesOrderAPI,
  convertSalesOrderToInvoiceAPI, cancelSalesOrderAPI, deleteSalesOrderAPI,
} from '../../networks/sales/salesOrderNetwork';
import { salesOrderListSerializer, salesOrderSingleSerializer } from '../../serializers/salesOrderSerializer';

export type SalesOrderStatusFilter = 'all' | SalesOrderStatus;

interface SalesOrderState {
  salesOrders: SalesOrder[];
  current: SalesOrder | null;
  statusFilter: SalesOrderStatusFilter;
  isLoading: boolean;
  isSaving: boolean;
  error: string;
}

const initialState: SalesOrderState = {
  salesOrders: [], current: null, statusFilter: 'all',
  isLoading: false, isSaving: false, error: '',
};

export const salesOrderSlice = createAppSlice({
  name: 'salesOrders',
  initialState,
  reducers: create => ({
    setSalesOrderStatusFilter: create.reducer((state, action: PayloadAction<SalesOrderStatusFilter>) => { state.statusFilter = action.payload; }),
    fetchSalesOrders: create.asyncThunk(
      async (params: { status?: string } | undefined) => getSalesOrdersAPI(params ?? {}),
      {
        pending: state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action) => { state.isLoading = false; state.salesOrders = salesOrderListSerializer(action.payload).salesOrders; },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load sales orders'; },
      },
    ),
    fetchSalesOrder: create.asyncThunk(
      async (id: string) => getSalesOrderByIdAPI(id),
      {
        pending: state => { state.isLoading = true; state.error = ''; state.current = null; },
        fulfilled: (state, action) => { state.isLoading = false; state.current = salesOrderSingleSerializer(action.payload); },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load sales order'; },
      },
    ),
    fulfillSalesOrder: create.asyncThunk(
      // rejectWithValue keeps the server's code and details: shipping can be
      // refused for the credit limit (with its breakdown) or short stock.
      async (
        payload: { id: string; lines: { lineId: string; quantityFulfilled: string }[]; overrideReason?: string },
        thunkAPI,
      ) => fulfillSalesOrderAPI(payload.id, payload.lines, payload.overrideReason).catch((e: any) => thunkAPI.rejectWithValue({ message: e?.message, code: e?.code, details: e?.details })),
      {
        pending: state => { state.isSaving = true; },
        fulfilled: (state, action) => { state.isSaving = false; state.current = salesOrderSingleSerializer(action.payload) ?? state.current; },
        rejected: state => { state.isSaving = false; },
      },
    ),
    convertSalesOrderInvoice: create.asyncThunk(
      async (arg: string | { id: string; overrideReason?: string }, thunkAPI) => {
        const { id, overrideReason } = typeof arg === 'string' ? { id: arg, overrideReason: undefined } : arg;
        return convertSalesOrderToInvoiceAPI(id, undefined, overrideReason).catch((e: any) => thunkAPI.rejectWithValue({ message: e?.message, code: e?.code, details: e?.details }));
      },
      {
        pending: state => { state.isSaving = true; },
        fulfilled: (state, action) => {
          state.isSaving = false;
          // Staff get an approval request back and the order is unchanged.
          const so = action.payload?.data?.salesOrder;
          if (so) state.current = salesOrderSingleSerializer({ data: so });
        },
        rejected: state => { state.isSaving = false; },
      },
    ),
    cancelSalesOrder: create.asyncThunk(
      async (id: string) => cancelSalesOrderAPI(id),
      { fulfilled: (state, action) => { state.current = salesOrderSingleSerializer(action.payload); } },
    ),
    removeSalesOrder: create.asyncThunk(
      async (id: string) => { await deleteSalesOrderAPI(id); return id; },
      { fulfilled: (state, action: PayloadAction<string>) => { state.salesOrders = state.salesOrders.filter(o => o.id !== action.payload); } },
    ),
  }),
  selectors: { selectSalesOrderState: state => state },
});

export const {
  setSalesOrderStatusFilter, fetchSalesOrders, fetchSalesOrder,
  fulfillSalesOrder, convertSalesOrderInvoice, cancelSalesOrder, removeSalesOrder,
} = salesOrderSlice.actions;

export const selectSalesOrderState = (rootState: { salesOrders?: SalesOrderState }) =>
  rootState.salesOrders ?? initialState;
