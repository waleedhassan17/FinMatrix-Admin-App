import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { VendorCredit, VendorCreditStatus } from '../../models/vendorCreditModel';
import {
  getVendorCreditsAPI, getVendorCreditByIdAPI, createVendorCreditAPI,
  applyVendorCreditAPI, voidVendorCreditAPI, deleteVendorCreditAPI,
} from '../../networks/purchases/vendorCreditNetwork';
import { vendorCreditListSerializer, vendorCreditSingleSerializer } from '../../serializers/vendorCreditSerializer';

export type VendorCreditStatusFilter = 'all' | VendorCreditStatus;

interface VendorCreditState {
  vendorCredits: VendorCredit[];
  current: VendorCredit | null;
  statusFilter: VendorCreditStatusFilter;
  isLoading: boolean;
  isSaving: boolean;
  error: string;
}

const initialState: VendorCreditState = {
  vendorCredits: [], current: null, statusFilter: 'all', isLoading: false, isSaving: false, error: '',
};

export const vendorCreditSlice = createAppSlice({
  name: 'vendorCredits',
  initialState,
  reducers: create => ({
    setVendorCreditStatusFilter: create.reducer((state, action: PayloadAction<VendorCreditStatusFilter>) => { state.statusFilter = action.payload; }),
    fetchVendorCredits: create.asyncThunk(
      async (params: { status?: string } | undefined) => getVendorCreditsAPI(params ?? {}),
      {
        pending: state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action) => { state.isLoading = false; state.vendorCredits = vendorCreditListSerializer(action.payload); },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load vendor credits'; },
      },
    ),
    fetchVendorCredit: create.asyncThunk(
      async (id: string) => getVendorCreditByIdAPI(id),
      {
        pending: state => { state.isLoading = true; state.error = ''; state.current = null; },
        fulfilled: (state, action) => { state.isLoading = false; state.current = vendorCreditSingleSerializer(action.payload); },
        rejected: (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load vendor credit'; },
      },
    ),
    saveVendorCredit: create.asyncThunk(
      async (data: any) => createVendorCreditAPI(data),
      {
        pending: state => { state.isSaving = true; state.error = ''; },
        fulfilled: (state, action) => { state.isSaving = false; state.current = vendorCreditSingleSerializer(action.payload); },
        rejected: (state, action) => { state.isSaving = false; state.error = action.error?.message ?? 'Failed to save vendor credit'; },
      },
    ),
    applyVendorCredit: create.asyncThunk(
      async (p: { id: string; billId: string; amount: string }) => applyVendorCreditAPI(p.id, p.billId, p.amount),
      {
        fulfilled: (state, action) => { state.current = vendorCreditSingleSerializer(action.payload); },
        rejected: (state, action) => { state.error = action.error?.message ?? 'Failed to apply the vendor credit'; },
      },
    ),
    voidVendorCredit: create.asyncThunk(
      async (id: string) => voidVendorCreditAPI(id),
      {
        fulfilled: (state, action) => { state.current = vendorCreditSingleSerializer(action.payload); },
        rejected: (state, action) => { state.error = action.error?.message ?? 'Failed to void the vendor credit'; },
      },
    ),
    removeVendorCredit: create.asyncThunk(
      async (id: string) => { await deleteVendorCreditAPI(id); return id; },
      {
        fulfilled: (state, action: PayloadAction<string>) => { state.vendorCredits = state.vendorCredits.filter(c => c.id !== action.payload); },
        rejected: (state, action) => { state.error = action.error?.message ?? 'Failed to delete the vendor credit'; },
      },
    ),
  }),
  selectors: { selectVendorCreditState: state => state },
});

export const {
  setVendorCreditStatusFilter, fetchVendorCredits, fetchVendorCredit, saveVendorCredit,
  applyVendorCredit, voidVendorCredit, removeVendorCredit,
} = vendorCreditSlice.actions;

export const selectVendorCreditState = (rootState: { vendorCredits?: VendorCreditState }) =>
  rootState.vendorCredits ?? initialState;
