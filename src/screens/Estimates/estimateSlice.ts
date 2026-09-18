// ═══════════════════════════════════════════════════════
// FinMatrix — Estimates Slice (list + detail + CRUD)
// ═══════════════════════════════════════════════════════
import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { Estimate, EstimateStatus } from '../../models/estimateModel';
import {
  getEstimatesAPI, getEstimateByIdAPI, createEstimateAPI, updateEstimateAPI,
  setEstimateStatusAPI, convertEstimateToInvoiceAPI, convertEstimateToSalesOrderAPI, deleteEstimateAPI,
} from '../../networks/sales/estimateNetwork';
import { estimateListSerializer, estimateSingleSerializer } from '../../serializers/estimateSerializer';

export type EstimateStatusFilter = 'all' | EstimateStatus;

interface EstimateState {
  estimates: Estimate[];
  current: Estimate | null;
  searchQuery: string;
  statusFilter: EstimateStatusFilter;
  isLoading: boolean;
  isSaving: boolean;
  error: string;
}

const initialState: EstimateState = {
  estimates: [],
  current: null,
  searchQuery: '',
  statusFilter: 'all',
  isLoading: false,
  isSaving: false,
  error: '',
};

export const estimateSlice = createAppSlice({
  name: 'estimates',
  initialState,
  reducers: create => ({
    setEstimateSearch: create.reducer((state, action: PayloadAction<string>) => { state.searchQuery = action.payload; }),
    setEstimateStatusFilter: create.reducer((state, action: PayloadAction<EstimateStatusFilter>) => { state.statusFilter = action.payload; }),
    clearCurrentEstimate: create.reducer(state => { state.current = null; }),

    fetchEstimates: create.asyncThunk(
      async (params: { status?: string; search?: string } | undefined) => getEstimatesAPI(params ?? {}),
      {
        pending: state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action) => {
          state.isLoading = false;
          state.estimates = estimateListSerializer(action.payload).estimates;
        },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load estimates'; },
      },
    ),
    fetchEstimate: create.asyncThunk(
      async (id: string) => getEstimateByIdAPI(id),
      {
        pending: state => { state.isLoading = true; state.error = ''; state.current = null; },
        fulfilled: (state, action) => { state.isLoading = false; state.current = estimateSingleSerializer(action.payload); },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load estimate'; },
      },
    ),
    saveEstimate: create.asyncThunk(
      async (payload: { id?: string; data: any }) =>
        payload.id ? updateEstimateAPI(payload.id, payload.data) : createEstimateAPI(payload.data),
      {
        pending: state => { state.isSaving = true; state.error = ''; },
        fulfilled: (state, action) => { state.isSaving = false; state.current = estimateSingleSerializer(action.payload); },
        rejected: (state, action) => { state.isSaving = false; state.error = action.error?.message ?? 'Failed to save estimate'; },
      },
    ),
    changeEstimateStatus: create.asyncThunk(
      async (payload: { id: string; status: 'sent' | 'accepted' | 'declined' }) =>
        setEstimateStatusAPI(payload.id, payload.status),
      { fulfilled: (state, action) => { state.current = estimateSingleSerializer(action.payload); } },
    ),
    convertEstimateInvoice: create.asyncThunk(
      async (arg: string | { id: string; overrideReason?: string }, thunkAPI) => {
        const { id, overrideReason } = typeof arg === 'string' ? { id: arg, overrideReason: undefined } : arg;
        return convertEstimateToInvoiceAPI(id, undefined, overrideReason).catch((e: any) => thunkAPI.rejectWithValue({ message: e?.message, code: e?.code, details: e?.details }));
      },
      {
        pending: state => { state.isSaving = true; },
        fulfilled: (state, action) => {
          state.isSaving = false;
          const est = action.payload?.data?.estimate;
          if (est) state.current = estimateSingleSerializer({ data: est });
        },
        rejected: state => { state.isSaving = false; },
      },
    ),
    convertEstimateSalesOrder: create.asyncThunk(
      async (arg: string | { id: string; acceptBackorder?: boolean }, thunkAPI) => {
        const { id, acceptBackorder } = typeof arg === 'string' ? { id: arg, acceptBackorder: false } : arg;
        return convertEstimateToSalesOrderAPI(id, { acceptBackorder }).catch((e: any) => thunkAPI.rejectWithValue({ message: e?.message, code: e?.code, details: e?.details }));
      },
      {
        pending: state => { state.isSaving = true; },
        fulfilled: (state, action) => {
          state.isSaving = false;
          const est = action.payload?.data?.estimate;
          if (est) state.current = estimateSingleSerializer({ data: est });
        },
        rejected: state => { state.isSaving = false; },
      },
    ),
    removeEstimate: create.asyncThunk(
      async (id: string) => { await deleteEstimateAPI(id); return id; },
      { fulfilled: (state, action: PayloadAction<string>) => { state.estimates = state.estimates.filter(e => e.id !== action.payload); } },
    ),
  }),
  selectors: { selectEstimateState: state => state },
});

export const {
  setEstimateSearch, setEstimateStatusFilter, clearCurrentEstimate,
  fetchEstimates, fetchEstimate, saveEstimate, changeEstimateStatus,
  convertEstimateInvoice, convertEstimateSalesOrder, removeEstimate,
} = estimateSlice.actions;

export const selectEstimateState = (rootState: { estimates?: EstimateState }) =>
  rootState.estimates ?? initialState;
