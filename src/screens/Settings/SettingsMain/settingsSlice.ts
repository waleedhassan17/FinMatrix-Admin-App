import { createAppSlice } from '@store/createAppSlice';
import type { PayloadAction } from '@reduxjs/toolkit';
import {
  fetchPreferences as apiFetchPrefs,
  savePreferences as apiSavePrefs,
} from '../../../networks/settings/settingsNetwork';
import type { AppPreferences } from '../../../models/settingsModel';
import { DEFAULT_PREFERENCES } from '../../../models/settingsModel';

interface SettingsState {
  preferences: AppPreferences;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  preferences: DEFAULT_PREFERENCES,
  isLoading: false,
  isSaving: false,
  error: null,
};

export const settingsSlice = createAppSlice({
  name: 'settings',
  initialState,
  reducers: create => ({
    setPreference: create.reducer(
      (state, action: PayloadAction<{ key: keyof AppPreferences; value: any }>) => {
        (state.preferences as any)[action.payload.key] = action.payload.value;
      },
    ),
    loadPreferences: create.asyncThunk(
      async () => apiFetchPrefs(),
      {
        pending: state => { state.isLoading = true; state.error = null; },
        fulfilled: (state, action) => {
          state.isLoading = false;
          state.preferences = action.payload;
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.error = action.error?.message ?? 'Failed to load preferences';
        },
      },
    ),
    savePreferences: create.asyncThunk(
      async (_: void, { getState }) => {
        const state = getState() as { settings: SettingsState };
        return apiSavePrefs(state.settings.preferences);
      },
      {
        pending: state => { state.isSaving = true; state.error = null; },
        fulfilled: (state, action) => {
          state.isSaving = false;
          state.preferences = action.payload;
        },
        rejected: (state, action) => {
          state.isSaving = false;
          state.error = action.error?.message ?? 'Failed to save preferences';
        },
      },
    ),
  }),
  selectors: {
    selectPreferences: state => state.preferences,
    selectSettingsLoading: state => state.isLoading,
    selectSettingsSaving: state => state.isSaving,
  },
});

export const { setPreference, loadPreferences, savePreferences } = settingsSlice.actions;
export const { selectPreferences, selectSettingsLoading, selectSettingsSaving } = settingsSlice.selectors;
