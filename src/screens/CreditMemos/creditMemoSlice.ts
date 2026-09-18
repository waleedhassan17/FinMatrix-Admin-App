import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { CreditMemo, CreditMemoStatus } from '../../models/creditMemoModel';
import {
  getCreditMemosAPI, getCreditMemoByIdAPI, createCreditMemoAPI,
  applyCreditMemoAPI, refundCreditMemoAPI, voidCreditMemoAPI, deleteCreditMemoAPI,
} from '../../networks/sales/creditMemoNetwork';
import { creditMemoListSerializer, creditMemoSingleSerializer } from '../../serializers/creditMemoSerializer';

export type CreditMemoStatusFilter = 'all' | CreditMemoStatus;

interface CreditMemoState {
  creditMemos: CreditMemo[];
  current: CreditMemo | null;
  statusFilter: CreditMemoStatusFilter;
  isLoading: boolean;
  isSaving: boolean;
  error: string;
}

const initialState: CreditMemoState = {
  creditMemos: [], current: null, statusFilter: 'all', isLoading: false, isSaving: false, error: '',
};

export const creditMemoSlice = createAppSlice({
  name: 'creditMemos',
  initialState,
  reducers: create => ({
    setCreditMemoStatusFilter: create.reducer((state, action: PayloadAction<CreditMemoStatusFilter>) => { state.statusFilter = action.payload; }),
    fetchCreditMemos: create.asyncThunk(
      async (params: { status?: string } | undefined) => getCreditMemosAPI(params ?? {}),
      {
        pending: state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action) => { state.isLoading = false; state.creditMemos = creditMemoListSerializer(action.payload); },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load credit memos'; },
      },
    ),
    fetchCreditMemo: create.asyncThunk(
      async (id: string) => getCreditMemoByIdAPI(id),
      {
        pending: state => { state.isLoading = true; state.error = ''; state.current = null; },
        fulfilled: (state, action) => { state.isLoading = false; state.current = creditMemoSingleSerializer(action.payload); },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load credit memo'; },
      },
    ),
    saveCreditMemo: create.asyncThunk(
      async (data: any) => createCreditMemoAPI(data),
      {
        pending: state => { state.isSaving = true; state.error = ''; },
        fulfilled: (state, action) => { state.isSaving = false; state.current = creditMemoSingleSerializer(action.payload); },
        rejected: (state, action) => { state.isSaving = false; state.error = action.error?.message ?? 'Failed to save credit memo'; },
      },
    ),
    applyCreditMemo: create.asyncThunk(
      async (p: { id: string; invoiceId: string; amount: string }) => applyCreditMemoAPI(p.id, p.invoiceId, p.amount),
      {
        fulfilled: (state, action) => { state.current = creditMemoSingleSerializer(action.payload); },
        rejected: (state, action) => { state.error = action.error?.message ?? 'Failed to apply the credit memo'; },
      },
    ),
    refundCreditMemo: create.asyncThunk(
      async (id: string) => refundCreditMemoAPI(id),
      {
        fulfilled: (state, action) => { state.current = creditMemoSingleSerializer(action.payload); },
        rejected: (state, action) => { state.error = action.error?.message ?? 'Failed to refund the credit memo'; },
      },
    ),
    voidCreditMemo: create.asyncThunk(
      async (id: string) => voidCreditMemoAPI(id),
      {
        fulfilled: (state, action) => { state.current = creditMemoSingleSerializer(action.payload); },
        rejected: (state, action) => { state.error = action.error?.message ?? 'Failed to void the credit memo'; },
      },
    ),
    removeCreditMemo: create.asyncThunk(
      async (id: string) => { await deleteCreditMemoAPI(id); return id; },
      {
        fulfilled: (state, action: PayloadAction<string>) => { state.creditMemos = state.creditMemos.filter(c => c.id !== action.payload); },
        rejected: (state, action) => { state.error = action.error?.message ?? 'Failed to delete the credit memo'; },
      },
    ),
  }),
  selectors: { selectCreditMemoState: state => state },
});

export const {
  setCreditMemoStatusFilter, fetchCreditMemos, fetchCreditMemo, saveCreditMemo,
  applyCreditMemo, refundCreditMemo, voidCreditMemo, removeCreditMemo,
} = creditMemoSlice.actions;

export const selectCreditMemoState = (rootState: { creditMemos?: CreditMemoState }) =>
  rootState.creditMemos ?? initialState;
