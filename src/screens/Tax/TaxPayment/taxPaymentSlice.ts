// ═══════════════════════════════════════════════════════
// FinMatrix — Tax Payment Slice
// ═══════════════════════════════════════════════════════

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { TaxRate, TaxType } from '../../../types';
import { getTaxRatesAPI, createTaxPaymentAPI } from '../../../networks/purchases/taxNetwork';
import {
  taxPaymentSingleSerializer,
  taxRateListSerializer,
} from '../../../serializers/taxSerializer';
import { toIsoDate } from '../../../models/reportModel';

export interface TaxPaymentForm {
  taxRateId: string;
  amount: string;
  date: string;
  reference: string;
  notes: string;
}

export interface TaxPaymentState {
  taxRates: TaxRate[];
  form: TaxPaymentForm;
  isLoading: boolean;
  isSaving: boolean;
  error: string;
  saved: boolean;
}

const buildInitialForm = (): TaxPaymentForm => ({
  taxRateId: '',
  amount: '',
  date: toIsoDate(new Date()),
  reference: '',
  notes: '',
});

const initialState: TaxPaymentState = {
  taxRates: [],
  form: buildInitialForm(),
  isLoading: false,
  isSaving: false,
  error: '',
  saved: false,
};

export const taxPaymentSlice = createAppSlice({
  name: 'taxPayment',
  initialState,
  reducers: create => ({
    setFormField: create.reducer((state, action: PayloadAction<Partial<TaxPaymentForm>>) => {
      Object.assign(state.form, action.payload);
    }),

    resetForm: create.reducer(state => {
      state.form = buildInitialForm();
      state.saved = false;
      state.error = '';
    }),

    initForTaxRate: create.reducer((state, action: PayloadAction<string>) => {
      state.form.taxRateId = action.payload;
    }),

    loadTaxPaymentDeps: create.asyncThunk(
      async () => {
        const ratesEnvelope = await getTaxRatesAPI();
        return { rates: taxRateListSerializer(ratesEnvelope) };
      },
      {
        pending: state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action) => {
          const { rates } = action.payload;
          state.taxRates = rates.filter(r => r.isActive);
          if (!state.form.taxRateId && state.taxRates.length > 0) {
            state.form.taxRateId = state.taxRates[0].id;
          }
          state.isLoading = false;
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.error = action.error?.message ?? 'Failed to load options';
        },
      },
    ),

    submitTaxPayment: create.asyncThunk(
      async (_: void, { getState }) => {
        const s = (getState() as { taxPayment: TaxPaymentState }).taxPayment;
        const { form, taxRates } = s;
        const rate = taxRates.find(r => r.id === form.taxRateId);
        const envelope = await createTaxPaymentAPI({
          taxRateId:   form.taxRateId,
          taxRateName: rate?.name ?? '',
          taxType:     (rate?.taxType ?? 'GST') as TaxType,
          amount:      parseFloat(form.amount) || 0,
          date:        form.date + 'T00:00:00Z',
          reference:   form.reference.trim(),
          notes:       form.notes.trim(),
        });
        return taxPaymentSingleSerializer(envelope);
      },
      {
        pending:   state => { state.isSaving = true; state.error = ''; },
        fulfilled: state => { state.isSaving = false; state.saved = true; },
        rejected:  (state, action) => {
          state.isSaving = false;
          state.error = action.error?.message ?? 'Payment submission failed';
        },
      },
    ),
  }),

  selectors: {
    selectTaxPaymentForm:    state => state.form,
    selectTaxPaymentRates:   state => state.taxRates,
    selectTaxPaymentLoading: state => state.isLoading,
    selectTaxPaymentSaving:  state => state.isSaving,
    selectTaxPaymentError:   state => state.error,
    selectTaxPaymentSaved:   state => state.saved,
  },
});

export const {
  setFormField, resetForm, initForTaxRate,
  loadTaxPaymentDeps, submitTaxPayment,
} = taxPaymentSlice.actions;

export const {
  selectTaxPaymentForm, selectTaxPaymentRates,
  selectTaxPaymentLoading, selectTaxPaymentSaving,
  selectTaxPaymentError, selectTaxPaymentSaved,
} = taxPaymentSlice.selectors;
