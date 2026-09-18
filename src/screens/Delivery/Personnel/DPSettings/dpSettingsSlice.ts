import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

export interface DPSettingsSliceState {
  pushNotifications: boolean;
  smsNotifications: boolean;
  emailNotifications: boolean;
}

const initialState: DPSettingsSliceState = {
  pushNotifications: true,
  smsNotifications: true,
  emailNotifications: false,
};

export const dpSettingsSlice = createAppSlice({
  name: 'dpSettings',
  initialState,
  reducers: create => ({
    setPushNotifications: create.reducer((state, action: PayloadAction<boolean>) => {
      state.pushNotifications = action.payload;
    }),
    setSmsNotifications: create.reducer((state, action: PayloadAction<boolean>) => {
      state.smsNotifications = action.payload;
    }),
    setEmailNotifications: create.reducer((state, action: PayloadAction<boolean>) => {
      state.emailNotifications = action.payload;
    }),
  }),
  selectors: {
    selectDPSettings: state => state,
  },
});

export const { setPushNotifications, setSmsNotifications, setEmailNotifications } = dpSettingsSlice.actions;
export const { selectDPSettings } = dpSettingsSlice.selectors;
