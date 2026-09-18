import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

export interface DeliveryOnboardingSliceState {
  currentSlide: number;
  status: 'idle' | 'loading' | 'failed';
  error: string;
}

const initialState: DeliveryOnboardingSliceState = {
  currentSlide: 0,
  status: 'idle',
  error: '',
};

export const deliveryOnboardingSlice = createAppSlice({
  name: 'deliveryOnboarding',
  initialState,
  reducers: create => ({
    setCurrentSlide: create.reducer(
      (state, action: PayloadAction<number>) => {
        state.currentSlide = action.payload;
      },
    ),
    resetDeliveryOnboarding: create.reducer(state => {
      state.currentSlide = 0;
      state.status = 'idle';
      state.error = '';
    }),
  }),

  selectors: {
    selectCurrentSlide: state => state.currentSlide,
    selectDeliveryOnboardingStatus: state => state.status,
  },
});

export const {
  setCurrentSlide,
  resetDeliveryOnboarding,
} = deliveryOnboardingSlice.actions;

export const {
  selectCurrentSlide,
  selectDeliveryOnboardingStatus,
} = deliveryOnboardingSlice.selectors;
