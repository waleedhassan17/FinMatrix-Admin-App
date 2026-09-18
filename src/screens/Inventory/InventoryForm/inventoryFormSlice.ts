// ═══════════════════════════════════════════════════════
// FinMatrix — Inventory Form Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Co-located with InventoryFormScreen.tsx
// Manages form-level state: field values, validation errors, saving status.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { InventoryFormData } from '../../../models/inventoryModel';

export interface InventoryFormSliceState {
  formData: InventoryFormData;
  errors: Record<string, string>;
  isSaving: boolean;
  status: 'idle' | 'loading' | 'failed';
  error: string;
}

const initialFormData: InventoryFormData = {
  name: '',
  sku: '',
  description: '',
  category: '',
  unitOfMeasure: 'Unit',
  // 'average' is the only value the API accepts; the old 'FIFO' default made
  // every create/edit fail validation with a 400.
  costMethod: 'average',
  unitCost: '',
  sellingPrice: '',
  quantityOnHand: '',
  reorderPoint: '',
  reorderQuantity: '',
  minStock: '',
  maxStock: '',
  barcodeData: '',
  sourceAgencyId: '',
};

const initialState: InventoryFormSliceState = {
  formData: initialFormData,
  errors: {},
  isSaving: false,
  status: 'idle',
  error: '',
};

export const inventoryFormSlice = createAppSlice({
  name: 'inventoryForm',
  initialState,
  reducers: create => ({
    setFormField: create.reducer(
      (state, action: PayloadAction<{ key: keyof InventoryFormData; value: string | boolean }>) => {
        (state.formData as any)[action.payload.key] = action.payload.value;
        if (state.errors[action.payload.key]) {
          delete state.errors[action.payload.key];
        }
      },
    ),
    setFormData: create.reducer((state, action: PayloadAction<InventoryFormData>) => {
      state.formData = action.payload;
      state.errors = {};
    }),
    setFormErrors: create.reducer(
      (state, action: PayloadAction<Record<string, string>>) => {
        state.errors = action.payload;
      },
    ),
    setIsSaving: create.reducer((state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload;
    }),
    resetInventoryForm: create.reducer(state => {
      state.formData = initialFormData;
      state.errors = {};
      state.isSaving = false;
      state.status = 'idle';
      state.error = '';
    }),
  }),

  selectors: {
    selectInventoryFormData: state => state.formData,
    selectInventoryFormErrors: state => state.errors,
    selectInventoryIsSaving: state => state.isSaving,
    selectInventoryFormStatus: state => state.status,
    selectInventoryFormError: state => state.error,
  },
});

export const {
  setFormField,
  setFormData,
  setFormErrors,
  setIsSaving,
  resetInventoryForm,
} = inventoryFormSlice.actions;

export const {
  selectInventoryFormData,
  selectInventoryFormErrors,
  selectInventoryIsSaving,
  selectInventoryFormStatus,
  selectInventoryFormError,
} = inventoryFormSlice.selectors;
