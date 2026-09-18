// ═══════════════════════════════════════════════════════
// FinMatrix — DP Delivery List Slice (Delivery Execution flow)
// ═══════════════════════════════════════════════════════
// Co-located with DPDeliveryListScreen.tsx
// Owns ONLY UI state for this screen (sort order).
//
// Architecture (mirrors GL):
//   • models/deliveryModel.ts        — entity types
//   • network/deliveryNetwork.ts     — getDeliveriesAPI
//   • serializers/deliverySerializer.ts — deliveryListSerializer
//   • Delivery records themselves are owned by the canonical
//     `screens/Delivery/Admin/AssignDeliveries/deliverySlice.ts`,
//     which exposes `fetchDeliveries` (GL pipeline) for refresh.

import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

type DeliveryListSortBy = 'time' | 'priority';

export interface DPDeliveryListSliceState {
  sortBy: DeliveryListSortBy;
}

const initialState: DPDeliveryListSliceState = {
  sortBy: 'time',
};

export const dpDeliveryListSlice = createAppSlice({
  name: 'dpDeliveryList',
  initialState,
  reducers: create => ({
    setDeliveryListSortBy: create.reducer((state, action: PayloadAction<DeliveryListSortBy>) => {
      state.sortBy = action.payload;
    }),
  }),
  selectors: {
    selectDeliveryListSortBy: state => state.sortBy,
  },
});

export const { setDeliveryListSortBy } = dpDeliveryListSlice.actions;
export const { selectDeliveryListSortBy } = dpDeliveryListSlice.selectors;
