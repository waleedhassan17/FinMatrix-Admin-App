// ═══════════════════════════════════════════════════════
// FinMatrix — DP Delivery Detail Slice (GL pattern)
// ═══════════════════════════════════════════════════════
// Co-located with DPDeliveryDetailScreen.tsx.
// Owns UI state (items toggle) and exposes an async thunk that
// updates delivery execution status through network → serializer
// then dispatches cross-slice into the canonical deliverySlice.

import { createAppSlice } from '@store/createAppSlice';
import type {
  DeliveryExecutionStatus,
  UpdateDeliveryStatusResult,
} from '../../../../models/dpDeliveryDetailModel';
import { updateDeliveryStatusAPI } from '../../../../networks/delivery/dpDeliveryDetailNetwork';
import { dpDeliveryDetailSerializer } from '../../../../serializers/dpDeliveryDetailSerializer';
import { updateDeliveryStatus } from '../../Admin/AssignDeliveries/deliverySlice';
import { locationService } from '../../../../services/locationService';

export interface DPDeliveryDetailSliceState {
  showItems: boolean;
  isUpdatingStatus: boolean;
  statusError: string;
  lastStatusResult: UpdateDeliveryStatusResult | null;
}

const initialState: DPDeliveryDetailSliceState = {
  showItems: true,
  isUpdatingStatus: false,
  statusError: '',
  lastStatusResult: null,
};

export const dpDeliveryDetailSlice = createAppSlice({
  name: 'dpDeliveryDetail',
  initialState,
  reducers: create => ({
    toggleShowItems: create.reducer(state => {
      state.showItems = !state.showItems;
    }),
    resetDeliveryDetailState: create.reducer(() => initialState),

    updateDeliveryExecutionStatus: create.asyncThunk(
      async (
        payload: { deliveryId: string; status: DeliveryExecutionStatus; note?: string },
        thunkAPI,
      ) => {
        // Send immediate GPS ping on status transition for precise milestone tracking
        await locationService.sendImmediateUpdate();

        const result = dpDeliveryDetailSerializer(await updateDeliveryStatusAPI(payload));
        if (result) {
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
          state.isUpdatingStatus = true;
          state.statusError = '';
        },
        fulfilled: (state, action) => {
          state.isUpdatingStatus = false;
          state.lastStatusResult = action.payload;
        },
        rejected: (state, action) => {
          state.isUpdatingStatus = false;
          state.statusError = action.error?.message ?? 'Failed to update delivery status';
        },
      },
    ),
  }),
  selectors: {
    selectShowItems: state => state.showItems,
    selectDPDeliveryDetailState: state => state,
  },
});

export const { toggleShowItems, resetDeliveryDetailState, updateDeliveryExecutionStatus } =
  dpDeliveryDetailSlice.actions;
export const { selectShowItems, selectDPDeliveryDetailState } = dpDeliveryDetailSlice.selectors;
