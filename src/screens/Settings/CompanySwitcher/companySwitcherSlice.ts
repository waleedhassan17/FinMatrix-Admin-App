import { createAppSlice } from '@store/createAppSlice';
import type { PayloadAction } from '@reduxjs/toolkit';
import {
  fetchCompanies as apiFetchCompanies,
  type CompanySwitcherItem,
} from '../../../networks/settings/settingsNetwork';

interface CompanySwitcherState {
  companies: CompanySwitcherItem[];
  isLoading: boolean;
  error: string | null;
}

const initialState: CompanySwitcherState = {
  companies: [],
  isLoading: false,
  error: null,
};

export const companySwitcherSlice = createAppSlice({
  name: 'companySwitcher',
  initialState,
  reducers: create => ({
    loadCompanies: create.asyncThunk(
      async () => apiFetchCompanies(),
      {
        pending: state => { state.isLoading = true; state.error = null; },
        fulfilled: (state, action) => {
          state.isLoading = false;
          state.companies = action.payload;
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.error = action.error?.message ?? 'Failed to load companies';
        },
      },
    ),
  }),
  selectors: {
    selectCompanies: state => state.companies,
    selectSwitcherLoading: state => state.isLoading,
  },
});

export const { loadCompanies } = companySwitcherSlice.actions;
export const { selectCompanies, selectSwitcherLoading } = companySwitcherSlice.selectors;
