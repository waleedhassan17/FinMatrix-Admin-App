// ═══════════════════════════════════════════════════════
// FinMatrix — Agency Form Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════
// Co-located with AgencyFormScreen.tsx
// Manages form state + inline inventory items.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { AgencyType } from '../../../models/agencyModel';

export interface AgencyFormSliceState {
  name: string;
  type: AgencyType | '';
  description: string;
  address: string;
  city: string;
  province: string;
  contactPhone: string;
  contactEmail: string;
  errors: Record<string, string>;
  isSaving: boolean;
  saveError: string;
}

const initialState: AgencyFormSliceState = {
  name: '',
  type: '',
  description: '',
  address: '',
  city: '',
  province: '',
  contactPhone: '',
  contactEmail: '',
  errors: {},
  isSaving: false,
  saveError: '',
};

export const agencyFormSlice = createAppSlice({
  name: 'agencyForm',
  initialState,
  reducers: create => ({
    setField: create.reducer((state, action: PayloadAction<{ key: keyof AgencyFormSliceState; value: any }>) => {
      (state as any)[action.payload.key] = action.payload.value;
    }),
    setErrors: create.reducer((state, action: PayloadAction<Record<string, string>>) => {
      state.errors = action.payload;
    }),
    setIsSaving: create.reducer((state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload;
    }),
    setSaveError: create.reducer((state, action: PayloadAction<string>) => {
      state.saveError = action.payload;
    }),
    loadAgencyForEdit: create.reducer(
      (state, action: PayloadAction<{
        name: string; type: AgencyType; description: string; address: string;
        city: string; province: string; contactPhone: string; contactEmail: string;
      }>) => {
        const d = action.payload;
        state.name = d.name;
        state.type = d.type;
        state.description = d.description;
        state.address = d.address;
        state.city = d.city;
        state.province = d.province;
        state.contactPhone = d.contactPhone;
        state.contactEmail = d.contactEmail;
        state.errors = {};
        state.isSaving = false;
        state.saveError = '';
      },
    ),
    resetAgencyForm: create.reducer(state => {
      Object.assign(state, initialState);
    }),
  }),

  selectors: {
    selectAgencyFormState: state => state,
    selectAgencyFormErrors: state => state.errors,
    selectAgencyFormIsSaving: state => state.isSaving,
  },
});

export const {
  setField,
  setErrors,
  setIsSaving,
  setSaveError,
  loadAgencyForEdit,
  resetAgencyForm,
} = agencyFormSlice.actions;

export const {
  selectAgencyFormState,
  selectAgencyFormErrors,
  selectAgencyFormIsSaving,
} = agencyFormSlice.selectors;
