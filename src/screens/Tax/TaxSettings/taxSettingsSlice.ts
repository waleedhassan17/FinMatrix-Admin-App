// ═══════════════════════════════════════════════════════
// FinMatrix — Tax Settings Slice
// ═══════════════════════════════════════════════════════

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { TaxRate, TaxType } from '../../../types';
import {
  getTaxRatesAPI,
  createTaxRateAPI,
  updateTaxRateAPI,
  deleteTaxRateAPI,
} from '../../../networks/purchases/taxNetwork';
import {
  taxRateDeleteSerializer,
  taxRateListSerializer,
  taxRateSingleSerializer,
} from '../../../serializers/taxSerializer';

export interface TaxRateForm {
  name: string;
  rate: string;
  taxType: TaxType;
  description: string;
  isActive: boolean;
}

export interface TaxSettingsState {
  rates: TaxRate[];
  isLoading: boolean;
  error: string;
  modalVisible: boolean;
  editingId: string | null;
  form: TaxRateForm;
  isSaving: boolean;
}

const emptyForm: TaxRateForm = {
  name: '',
  rate: '',
  taxType: 'GST',
  description: '',
  isActive: true,
};

const initialState: TaxSettingsState = {
  rates: [],
  isLoading: false,
  error: '',
  modalVisible: false,
  editingId: null,
  form: { ...emptyForm },
  isSaving: false,
};

export const taxSettingsSlice = createAppSlice({
  name: 'taxSettings',
  initialState,
  reducers: create => ({
    openAddModal: create.reducer(state => {
      state.modalVisible = true;
      state.editingId = null;
      state.form = { ...emptyForm };
      state.error = '';
    }),

    openEditModal: create.reducer((state, action: PayloadAction<TaxRate>) => {
      state.modalVisible = true;
      state.editingId = action.payload.id;
      state.form = {
        name: action.payload.name,
        rate: String(action.payload.rate),
        taxType: action.payload.taxType,
        description: action.payload.description,
        isActive: action.payload.isActive,
      };
      state.error = '';
    }),

    closeModal: create.reducer(state => {
      state.modalVisible = false;
      state.editingId = null;
      state.form = { ...emptyForm };
      state.error = '';
    }),

    setFormField: create.reducer((state, action: PayloadAction<Partial<TaxRateForm>>) => {
      Object.assign(state.form, action.payload);
    }),

    fetchTaxRates: create.asyncThunk(
      async () => {
        const envelope = await getTaxRatesAPI();
        return taxRateListSerializer(envelope);
      },
      {
        pending:   state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action) => { state.rates = action.payload; state.isLoading = false; },
        rejected:  (state, action) => { state.isLoading = false; state.error = action.error?.message ?? 'Failed to load'; },
      },
    ),

    saveTaxRate: create.asyncThunk(
      async (_: void, { getState }) => {
        const s = (getState() as { taxSettings: TaxSettingsState }).taxSettings;
        const { form, editingId } = s;
        const data = {
          name: form.name.trim(),
          rate: parseFloat(form.rate) || 0,
          taxType: form.taxType,
          description: form.description.trim(),
          isActive: form.isActive,
        };
        const envelope = editingId
          ? await updateTaxRateAPI(editingId, data)
          : await createTaxRateAPI(data);
        return taxRateSingleSerializer(envelope);
      },
      {
        pending: state => { state.isSaving = true; state.error = ''; },
        fulfilled: (state, action) => {
          state.isSaving = false;
          state.modalVisible = false;
          if (!action.payload) return;
          const idx = state.rates.findIndex(r => r.id === action.payload!.id);
          if (idx >= 0) {
            state.rates[idx] = action.payload;
          } else {
            state.rates.push(action.payload);
          }
        },
        rejected: (state, action) => {
          state.isSaving = false;
          state.error = action.error?.message ?? 'Save failed';
        },
      },
    ),

    toggleActive: create.asyncThunk(
      async (rateId: string, { getState }) => {
        const s = (getState() as { taxSettings: TaxSettingsState }).taxSettings;
        const rate = s.rates.find(r => r.id === rateId);
        if (!rate) throw new Error('Tax rate not found');
        const envelope = await updateTaxRateAPI(rateId, { isActive: !rate.isActive });
        return taxRateSingleSerializer(envelope);
      },
      {
        fulfilled: (state, action) => {
          if (!action.payload) return;
          const idx = state.rates.findIndex(r => r.id === action.payload!.id);
          if (idx >= 0) state.rates[idx] = action.payload;
        },
        rejected: (state, action) => { state.error = action.error?.message ?? 'Toggle failed'; },
      },
    ),

    removeTaxRate: create.asyncThunk(
      async (rateId: string) => {
        const envelope = await deleteTaxRateAPI(rateId);
        return taxRateDeleteSerializer(envelope) || rateId;
      },
      {
        fulfilled: (state, action) => {
          state.rates = state.rates.filter(r => r.id !== action.payload);
        },
        rejected: (state, action) => { state.error = action.error?.message ?? 'Delete failed'; },
      },
    ),
  }),

  selectors: {
    selectTaxRates:           state => state.rates,
    selectTaxSettingsLoading: state => state.isLoading,
    selectTaxSettingsError:   state => state.error,
    selectTaxModalVisible:    state => state.modalVisible,
    selectTaxEditingId:       state => state.editingId,
    selectTaxForm:            state => state.form,
    selectTaxIsSaving:        state => state.isSaving,
  },
});

export const {
  openAddModal, openEditModal, closeModal, setFormField,
  fetchTaxRates, saveTaxRate, toggleActive, removeTaxRate,
} = taxSettingsSlice.actions;

export const {
  selectTaxRates, selectTaxSettingsLoading, selectTaxSettingsError,
  selectTaxModalVisible, selectTaxEditingId, selectTaxForm, selectTaxIsSaving,
} = taxSettingsSlice.selectors;
