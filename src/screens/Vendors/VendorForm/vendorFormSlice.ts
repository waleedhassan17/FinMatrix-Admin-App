// ═══════════════════════════════════════════════════════
// FinMatrix — Vendor Form Slice (createAppSlice)
// ═══════════════════════════════════════════════════════
// Owns the form state for create/edit AND the save thunk
// that posts via the network + serializer pipeline.
// Mirrors the GL/Credit Memo slice architecture.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { PaymentTerms, Vendor } from '../../../types';
import {
  createVendorAPI,
  updateVendorAPI,
  getVendorByIdAPI,
} from '../../../networks/purchases/vendorNetwork';
import { vendorSingleSerializer } from '../../../serializers/vendorSerializer';
import { PAYMENT_TERMS_TO_API } from '../../../models/customerModel';

export interface VendorFormSliceState {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  paymentTerms: PaymentTerms | '';
  taxId: string;
  defaultExpenseAccountId: string;
  notes: string;
  errors: Record<string, string>;
  isSaving: boolean;
  saveError: string;
  isEditMode: boolean;
  editId: string;
}

const initialState: VendorFormSliceState = {
  name: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'Pakistan',
  paymentTerms: '',
  taxId: '',
  defaultExpenseAccountId: '',
  notes: '',
  errors: {},
  isSaving: false,
  saveError: '',
  isEditMode: false,
  editId: '',
};

// ─── Save payload builder ───────────────────────────
// Shapes the payload the way the API's CreateVendorDto expects:
// `companyName` (not `name`), a structured `address` object with
// `postalCode`, and `net30`-style payment-terms codes. Anything else is
// stripped by DTO whitelisting or rejected by validation.
const buildSavePayload = (state: VendorFormSliceState): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    companyName: state.name.trim(),
    contactPerson: state.contactPerson.trim() || undefined,
    email: state.email.trim() || undefined,
    phone: state.phone.trim() || undefined,
    address: {
      street: state.address.trim(),
      city: state.city.trim(),
      state: state.state.trim(),
      postalCode: state.zipCode.trim(),
      country: state.country.trim() || 'Pakistan',
    },
    taxId: state.taxId.trim() || undefined,
    notes: state.notes.trim() || undefined,
  };
  if (state.paymentTerms) {
    payload.paymentTerms = PAYMENT_TERMS_TO_API[state.paymentTerms];
  }
  // Empty string would fail the API's @IsUUID check — only send a real id.
  if (state.defaultExpenseAccountId) {
    payload.defaultExpenseAccountId = state.defaultExpenseAccountId;
  }
  return payload;
};

export const vendorFormSlice = createAppSlice({
  name: 'vendorForm',
  initialState,
  reducers: create => ({
    setField: create.reducer(
      (state, action: PayloadAction<{ key: keyof VendorFormSliceState; value: any }>) => {
        (state as any)[action.payload.key] = action.payload.value;
        // Clear field error on change
        if (state.errors[action.payload.key as string]) {
          const { [action.payload.key as string]: _, ...rest } = state.errors;
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
    loadVendorForEdit: create.reducer(
      (state, action: PayloadAction<Omit<VendorFormSliceState, 'errors' | 'isSaving' | 'saveError' | 'isEditMode' | 'editId'> & { editId?: string }>) => {
        const d = action.payload;
        state.name = d.name;
        state.contactPerson = d.contactPerson;
        state.email = d.email;
        state.phone = d.phone;
        state.address = d.address;
        state.city = d.city;
        state.state = d.state;
        state.zipCode = d.zipCode;
        state.country = d.country;
        state.paymentTerms = d.paymentTerms;
        state.taxId = d.taxId;
        state.defaultExpenseAccountId = d.defaultExpenseAccountId;
        state.notes = d.notes;
        if (d.editId) {
          state.isEditMode = true;
          state.editId = d.editId;
        }
      },
    ),
    resetVendorForm: create.reducer(state => {
      Object.assign(state, initialState);
    }),

    // ── Async thunks ────────────────────────────────

    /** Activity diagram step: "Save — vendor available for Bills & POs" */
    saveVendor: create.asyncThunk(
      async (_arg, thunkAPI) => {
        const root = thunkAPI.getState() as { vendorForm: VendorFormSliceState };
        const f = root.vendorForm;
        const payload = buildSavePayload(f);
        const envelope = f.isEditMode && f.editId
          ? await updateVendorAPI(f.editId, payload)
          : await createVendorAPI(payload);
        return vendorSingleSerializer(envelope);
      },
      {
        pending: state => { state.isSaving = true; state.saveError = ''; },
        fulfilled: (state, action: PayloadAction<Vendor | null>) => {
          state.isSaving = false;
          if (action.payload) {
            state.editId = action.payload.id;
            state.isEditMode = true;
          }
        },
        rejected: (state, action) => {
          state.isSaving = false;
          state.saveError = action.error?.message ?? 'Failed to save vendor';
        },
      },
    ),

    /** Loads an existing vendor into the form for editing. */
    fetchVendorForEdit: create.asyncThunk(
      async (id: string) => getVendorByIdAPI(id),
      {
        fulfilled: (state, action: PayloadAction<any>) => {
          const v = vendorSingleSerializer(action.payload);
          if (!v) return;
          state.isEditMode = true;
          state.editId = v.id;
          state.name = v.name;
          state.contactPerson = v.contactPerson;
          state.email = v.email;
          state.phone = v.phone;
          state.address = v.address;
          state.city = v.city;
          state.state = v.state;
          state.zipCode = v.zipCode;
          state.country = v.country;
          state.paymentTerms = (v.paymentTerms as PaymentTerms | '') || '';
          state.taxId = v.taxId;
          state.defaultExpenseAccountId = v.defaultExpenseAccountId;
          state.notes = v.notes;
          state.errors = {};
        },
      },
    ),
  }),

  selectors: {
    selectVendorFormState: state => state,
    selectVendorFormErrors: state => state.errors,
    selectVendorFormIsSaving: state => state.isSaving,
    selectVendorFormIsEditMode: state => state.isEditMode,
  },
});

export const {
  setField,
  setErrors,
  setIsSaving,
  loadVendorForEdit,
  resetVendorForm,
  saveVendor,
  fetchVendorForEdit,
} = vendorFormSlice.actions;

export const {
  selectVendorFormState,
  selectVendorFormErrors,
  selectVendorFormIsSaving,
  selectVendorFormIsEditMode,
} = vendorFormSlice.selectors;
