// ═══════════════════════════════════════════════════════
// FinMatrix — Create Company slice
// ═══════════════════════════════════════════════════════
// Holds the Company Details form as the user types, so a reload, a token
// expiry or a sign-out does not throw away everything they had entered. The
// company row does not exist until they submit, so until then this slice is
// the only place that input lives.
//
// Persisted (see persistConfig in store/store.ts) and deliberately preserved
// through the sign-out wipe. `ownerUserId` is what makes that safe: the draft
// is restored only for the user who typed it, and discarded the moment a
// different account signs in on the same device.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

/** Every field on the Company Details screen. */
export interface CompanyDraft {
  companyName: string;
  industry: string;
  legalStructure: string;
  street: string;
  city: string;
  stateProv: string;
  zipCode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
}

export type CompanyDraftField = keyof CompanyDraft;

export interface CreateCompanySliceState {
  currentStep: number;
  status: 'idle' | 'loading' | 'failed';
  error: string;
  /** Whose draft this is; null when empty. */
  ownerUserId: string | null;
  /** Last edit, for debugging a stale restore. */
  updatedAt: string | null;
  draft: CompanyDraft;
}

const EMPTY_DRAFT: CompanyDraft = {
  companyName: '',
  industry: '',
  legalStructure: '',
  street: '',
  city: '',
  stateProv: '',
  zipCode: '',
  country: 'Pakistan',
  phone: '',
  email: '',
  website: '',
  taxId: '',
};

const initialState: CreateCompanySliceState = {
  currentStep: 0,
  status: 'idle',
  error: '',
  ownerUserId: null,
  updatedAt: null,
  draft: { ...EMPTY_DRAFT },
};

export const createCompanySlice = createAppSlice({
  name: 'createCompany',
  initialState,
  reducers: create => ({
    setStep: create.reducer((state, action: PayloadAction<number>) => {
      state.currentStep = action.payload;
    }),
    nextStep: create.reducer(state => {
      state.currentStep += 1;
    }),
    prevStep: create.reducer(state => {
      if (state.currentStep > 0) state.currentStep -= 1;
    }),
    setCreateCompanyError: create.reducer(
      (state, action: PayloadAction<string>) => {
        state.status = 'failed';
        state.error = action.payload;
      },
    ),

    /** Record a single field as the user types. */
    setDraftField: create.reducer(
      (
        state,
        action: PayloadAction<{
          field: CompanyDraftField;
          value: string;
          userId: string | null;
        }>,
      ) => {
        const { field, value, userId } = action.payload;
        state.draft[field] = value;
        state.ownerUserId = userId ?? state.ownerUserId;
        state.updatedAt = new Date().toISOString();
      },
    ),

    /**
     * Drop the draft. Called once the company is actually created, and on
     * mount when the stored draft belongs to a different user.
     */
    clearCompanyDraft: create.reducer(state => {
      state.draft = { ...EMPTY_DRAFT };
      state.ownerUserId = null;
      state.updatedAt = null;
    }),

    resetCreateCompany: create.reducer(state => {
      state.currentStep = 0;
      state.status = 'idle';
      state.error = '';
    }),
  }),

  selectors: {
    selectCompanyDraft: state => state.draft,
    selectDraftOwnerId: state => state.ownerUserId,
    selectCreateCompanyStep: state => state.currentStep,
    selectCreateCompanyError: state => state.error,
  },
});

export const {
  setStep,
  nextStep,
  prevStep,
  setCreateCompanyError,
  setDraftField,
  clearCompanyDraft,
  resetCreateCompany,
} = createCompanySlice.actions;

export const {
  selectCompanyDraft,
  selectDraftOwnerId,
  selectCreateCompanyStep,
  selectCreateCompanyError,
} = createCompanySlice.selectors;
