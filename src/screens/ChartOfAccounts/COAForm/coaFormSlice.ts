// ═══════════════════════════════════════════════════════
// FinMatrix — COA Form Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Co-located with COAFormScreen.tsx
// Manages form-level state: field values, validation errors, saving status.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { COAFormData } from '../../../models/coaModel';

export interface COAFormSliceState {
  formData: COAFormData;
  errors: Record<string, string>;
  isSaving: boolean;
  status: 'idle' | 'loading' | 'failed';
  error: string;
}

const initialFormData: COAFormData = {
  code: '',
  name: '',
  type: '',
  subTypeLabel: '',
  parentId: '',
  description: '',
  openingBalance: '',
  isActive: true,
};

const initialState: COAFormSliceState = {
  formData: initialFormData,
  errors: {},
  isSaving: false,
  status: 'idle',
  error: '',
};

export const coaFormSlice = createAppSlice({
  name: 'coaForm',
  initialState,
  reducers: create => ({
    setFormField: create.reducer(
      (state, action: PayloadAction<{ key: keyof COAFormData; value: string | boolean }>) => {
        (state.formData as any)[action.payload.key] = action.payload.value;
        if (state.errors[action.payload.key]) {
          delete state.errors[action.payload.key];
        }
      },
    ),
    setFormData: create.reducer((state, action: PayloadAction<COAFormData>) => {
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
    resetCoaForm: create.reducer(state => {
      state.formData = initialFormData;
      state.errors = {};
      state.isSaving = false;
      state.status = 'idle';
      state.error = '';
    }),
  }),

  selectors: {
    selectFormData: state => state.formData,
    selectFormErrors: state => state.errors,
    selectIsSaving: state => state.isSaving,
    selectCoaFormStatus: state => state.status,
    selectCoaFormError: state => state.error,
  },
});

export const {
  setFormField,
  setFormData,
  setFormErrors,
  setIsSaving,
  resetCoaForm,
} = coaFormSlice.actions;

export const {
  selectFormData,
  selectFormErrors,
  selectIsSaving,
  selectCoaFormStatus,
  selectCoaFormError,
} = coaFormSlice.selectors;
