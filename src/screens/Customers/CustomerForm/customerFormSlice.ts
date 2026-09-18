// ═══════════════════════════════════════════════════════
// FinMatrix — Customer Form Slice (createAppSlice pattern)
// ═══════════════════════════════════════════════════════

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { PaymentTerms } from '../../../types';

export interface CustomerFormSliceState {
  name: string;
  company: string;
  email: string;
  phone: string;
  billingStreet: string;
  billingCity: string;
  billingState: string;
  billingZipCode: string;
  billingCountry: string;
  sameAsBilling: boolean;
  shippingStreet: string;
  shippingCity: string;
  shippingState: string;
  shippingZipCode: string;
  shippingCountry: string;
  creditLimit: string;
  paymentTerms: PaymentTerms | '';
  contactPerson: string;
  taxId: string;
  notes: string;
  errors: Record<string, string>;
  isSaving: boolean;
  saveError: string;
}

const initialState: CustomerFormSliceState = {
  name: '',
  company: '',
  email: '',
  phone: '',
  billingStreet: '',
  billingCity: '',
  billingState: '',
  billingZipCode: '',
  billingCountry: 'Pakistan',
  sameAsBilling: true,
  shippingStreet: '',
  shippingCity: '',
  shippingState: '',
  shippingZipCode: '',
  shippingCountry: 'Pakistan',
  creditLimit: '',
  paymentTerms: '',
  contactPerson: '',
  taxId: '',
  notes: '',
  errors: {},
  isSaving: false,
  saveError: '',
};

export const customerFormSlice = createAppSlice({
  name: 'customerForm',
  initialState,
  reducers: create => ({
    setField: create.reducer(
      (state, action: PayloadAction<{ key: keyof CustomerFormSliceState; value: any }>) => {
        (state as any)[action.payload.key] = action.payload.value;
        // Clear field error on change
        if (state.errors[action.payload.key]) {
          const { [action.payload.key]: _, ...rest } = state.errors;
          state.errors = rest;
        }
      },
    ),
    setErrors: create.reducer((state, action: PayloadAction<Record<string, string>>) => {
      state.errors = action.payload;
    }),
    setIsSaving: create.reducer((state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload;
    }),
    toggleSameAsBilling: create.reducer(state => {
      state.sameAsBilling = !state.sameAsBilling;
      if (state.sameAsBilling) {
        state.shippingStreet = state.billingStreet;
        state.shippingCity = state.billingCity;
        state.shippingState = state.billingState;
        state.shippingZipCode = state.billingZipCode;
        state.shippingCountry = state.billingCountry;
      }
    }),
    loadCustomerForEdit: create.reducer(
      (state, action: PayloadAction<Omit<CustomerFormSliceState, 'errors' | 'isSaving' | 'saveError'>>) => {
        const d = action.payload;
        state.name = d.name;
        state.company = d.company;
        state.email = d.email;
        state.phone = d.phone;
        state.billingStreet = d.billingStreet;
        state.billingCity = d.billingCity;
        state.billingState = d.billingState;
        state.billingZipCode = d.billingZipCode;
        state.billingCountry = d.billingCountry;
        state.sameAsBilling = d.sameAsBilling;
        state.shippingStreet = d.shippingStreet;
        state.shippingCity = d.shippingCity;
        state.shippingState = d.shippingState;
        state.shippingZipCode = d.shippingZipCode;
        state.shippingCountry = d.shippingCountry;
        state.creditLimit = d.creditLimit;
        state.paymentTerms = d.paymentTerms;
        state.contactPerson = d.contactPerson;
        state.taxId = d.taxId;
        state.notes = d.notes;
      },
    ),
    resetCustomerForm: create.reducer(state => {
      Object.assign(state, initialState);
    }),
  }),

  selectors: {
    selectCustomerFormState: state => state,
    selectCustomerFormErrors: state => state.errors,
    selectCustomerFormIsSaving: state => state.isSaving,
    selectCustomerFormSameAsBilling: state => state.sameAsBilling,
  },
});

export const {
  setField,
  setErrors,
  setIsSaving,
  toggleSameAsBilling,
  loadCustomerForEdit,
  resetCustomerForm,
} = customerFormSlice.actions;

export const {
  selectCustomerFormState,
  selectCustomerFormErrors,
  selectCustomerFormIsSaving,
  selectCustomerFormSameAsBilling,
} = customerFormSlice.selectors;
