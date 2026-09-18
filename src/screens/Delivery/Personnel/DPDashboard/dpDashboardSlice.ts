// ═══════════════════════════════════════════════════════
// FinMatrix — DP Dashboard Slice (GL pattern)
// ═══════════════════════════════════════════════════════
// Co-located with DPDashboardScreen.tsx.
// Owns UI state (highlightNextDelivery) and exposes an async thunk that
// starts a delivery through network → serializer then dispatches cross-slice
// into the canonical deliverySlice.

import { createAppSlice } from '@store/createAppSlice';
import type { StartDeliveryResult } from '../../../../models/dpDashboardModel';
import { startDeliveryAPI } from '../../../../networks/delivery/dpDashboardNetwork';
import { dpDashboardSerializer } from '../../../../serializers/dpDashboardSerializer';
import { updateDeliveryStatus } from '../../Admin/AssignDeliveries/deliverySlice';

export interface DPDashboardSliceState {
  highlightNextDelivery: boolean;
  isStartingDelivery: boolean;
  startError: string;
  lastStartResult: StartDeliveryResult | null;
}

const initialState: DPDashboardSliceState = {
  highlightNextDelivery: true,
  isStartingDelivery: false,
  startError: '',
  lastStartResult: null,
};

export const dpDashboardSlice = createAppSlice({
  name: 'dpDashboard',
  initialState,
  reducers: create => ({
    toggleHighlightNextDelivery: create.reducer(state => {
      state.highlightNextDelivery = !state.highlightNextDelivery;
    }),
    resetDashboardState: create.reducer(() => initialState),

    startDelivery: create.asyncThunk(
      async (
        payload: { deliveryId: string; note?: string; status: 'picked_up' | 'in_transit' },
        thunkAPI,
      ) => {
        const result = dpDashboardSerializer(await startDeliveryAPI(payload));
        if (result) {
          // Mirror the SAME status the server accepted. This used to say
          // 'in_transit' regardless, so local state disagreed with the server
          // the moment the target was anything else.
          thunkAPI.dispatch(
            updateDeliveryStatus({
              deliveryId: payload.deliveryId,
              status: payload.status,
              note: payload.note,
            }),
          );
        }
        return result;
      },
      {
        pending: state => {
          state.isStartingDelivery = true;
          state.startError = '';
        },
        fulfilled: (state, action) => {
          state.isStartingDelivery = false;
          state.lastStartResult = action.payload;
        },
        rejected: (state, action) => {
          state.isStartingDelivery = false;
          state.startError = action.error?.message ?? 'Failed to start delivery';
        },
      },
    ),
  }),
  selectors: {
    selectHighlightNextDelivery: state => state.highlightNextDelivery,
    selectDPDashboardState: state => state,
  },
});

export const { toggleHighlightNextDelivery, resetDashboardState, startDelivery } =
  dpDashboardSlice.actions;
export const { selectHighlightNextDelivery, selectDPDashboardState } = dpDashboardSlice.selectors;
