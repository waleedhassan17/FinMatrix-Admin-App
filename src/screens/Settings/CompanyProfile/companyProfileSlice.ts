import { createAppSlice } from '@store/createAppSlice';
import type { PayloadAction } from '@reduxjs/toolkit';
import { saveCompanyProfile, type CompanyProfilePayload } from '../../../networks/settings/settingsNetwork';

interface CompanyProfileForm {
  name: string;
  industry: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  fiscalYearStart: string;
}

interface CompanyProfileState {
  form: CompanyProfileForm;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: CompanyProfileState = {
  form: {
    name: '',
    industry: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'Pakistan',
    phone: '',
    email: '',
    website: '',
    taxId: '',
    fiscalYearStart: 'July',
  },
  isSaving: false,
  isLoading: false,
  error: null,
};

export const companyProfileSlice = createAppSlice({
  name: 'companyProfile',
  initialState,
  reducers: create => ({
    setField: create.reducer(
      (state, action: PayloadAction<{ key: keyof CompanyProfileForm; value: string }>) => {
        state.form[action.payload.key] = action.payload.value;
      },
    ),
    loadCompanyData: create.reducer(
      (state, action: PayloadAction<Partial<CompanyProfileForm>>) => {
        Object.assign(state.form, action.payload);
      },
    ),
    saveProfile: create.asyncThunk(
      async (_: void, { getState }) => {
        const state = getState() as { companyProfile: CompanyProfileState };
        const payload: CompanyProfilePayload = { ...state.companyProfile.form };
        return saveCompanyProfile(payload);
      },
      {
        pending: state => { state.isSaving = true; state.error = null; },
        fulfilled: state => { state.isSaving = false; },
        rejected: (state, action) => {
          state.isSaving = false;
          state.error = action.error?.message ?? 'Failed to save';
        },
      },
    ),
  }),
  selectors: {
    selectCompanyProfileForm: state => state.form,
    selectCompanyProfileSaving: state => state.isSaving,
  },
});

export const { setField, loadCompanyData, saveProfile } = companyProfileSlice.actions;
export const { selectCompanyProfileForm, selectCompanyProfileSaving } = companyProfileSlice.selectors;
