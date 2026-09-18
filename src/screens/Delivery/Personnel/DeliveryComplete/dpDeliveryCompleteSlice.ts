// ═══════════════════════════════════════════════════════
// FinMatrix — DP Delivery Complete Slice (GL pattern)
// ═══════════════════════════════════════════════════════
// Co-located with DeliveryCompleteScreen.tsx
// Owns local UI/loading state and exposes an async thunk that
// posts the post-completion shadow-inventory submit through the
// network → serializer pipeline. Canonical delivery state is
// updated via cross-slice dispatch into deliverySlice.

import { createAppSlice } from '@store/createAppSlice';
import type { DeliveryCompleteResult } from '../../../../models/dpDeliveryCompleteModel';
import { submitDeliveryCompleteAPI } from '../../../../networks/delivery/dpDeliveryCompleteNetwork';
import { dpDeliveryCompleteSerializer } from '../../../../serializers/dpDeliveryCompleteSerializer';
import { submitShadowInventoryUpdateForDelivery } from '../../Admin/AssignDeliveries/deliverySlice';

export interface DPDeliveryCompleteSliceState {
  inventoryRequestSubmitted: boolean;
  isSubmitting: boolean;
  error: string;
  lastResult: DeliveryCompleteResult | null;
}

const initialState: DPDeliveryCompleteSliceState = {
  inventoryRequestSubmitted: false,
  isSubmitting: false,
  error: '',
  lastResult: null,
};

export const dpDeliveryCompleteSlice = createAppSlice({
  name: 'dpDeliveryComplete',
  initialState,
  reducers: create => ({
    setInventoryRequestSubmitted: create.reducer((state, action: { payload: boolean }) => {
      state.inventoryRequestSubmitted = action.payload;
    }),
    resetDeliveryCompleteState: create.reducer(() => initialState),

    submitDeliveryComplete: create.asyncThunk(
      async (
        payload: { deliveryId: string; personnelId: string },
        thunkAPI,
      ) => {
        const result = dpDeliveryCompleteSerializer(await submitDeliveryCompleteAPI(payload));
        if (result) {
          // Cross-slice update: keep canonical delivery state in sync.
          thunkAPI.dispatch(
            submitShadowInventoryUpdateForDelivery({
              deliveryId: payload.deliveryId,
              personnelId: payload.personnelId,
            }),
          );
        }
        return result;
      },
      {
        pending: state => {
          state.isSubmitting = true;
          state.error = '';
        },
        fulfilled: (state, action) => {
          state.isSubmitting = false;
          state.lastResult = action.payload;
          if (action.payload) state.inventoryRequestSubmitted = true;
        },
        rejected: (state, action) => {
          state.isSubmitting = false;
          state.error = action.error?.message ?? 'Failed to submit delivery completion';
        },
      },
    ),
  }),
  selectors: {
    selectInventoryRequestSubmitted: state => state.inventoryRequestSubmitted,
    selectDPDeliveryCompleteState: state => state,
  },
});

export const {
  setInventoryRequestSubmitted,
  resetDeliveryCompleteState,
  submitDeliveryComplete,
} = dpDeliveryCompleteSlice.actions;
export const {
  selectInventoryRequestSubmitted,
  selectDPDeliveryCompleteState,
} = dpDeliveryCompleteSlice.selectors;
