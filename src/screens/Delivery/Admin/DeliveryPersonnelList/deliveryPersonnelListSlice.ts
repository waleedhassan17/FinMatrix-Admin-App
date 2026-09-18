import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

export interface DeliveryPersonnelListSliceState {
  searchQuery: string;
  activeFilter: 'all' | 'available' | 'busy' | 'on_leave';
  status: 'idle' | 'loading' | 'failed';
  error: string;
}

const initialState: DeliveryPersonnelListSliceState = {
  searchQuery: '',
  activeFilter: 'all',
  status: 'idle',
  error: '',
};

export const deliveryPersonnelListSlice = createAppSlice({
  name: 'deliveryPersonnelList',
  initialState,
  reducers: create => ({
    setSearchQuery: create.reducer(
      (state, action: PayloadAction<string>) => {
        state.searchQuery = action.payload;
      },
    ),
    setActiveFilter: create.reducer(
      (state, action: PayloadAction<DeliveryPersonnelListSliceState['activeFilter']>) => {
        state.activeFilter = action.payload;
      },
    ),
    resetDeliveryPersonnelList: create.reducer(state => {
      state.searchQuery = '';
      state.activeFilter = 'all';
      state.status = 'idle';
      state.error = '';
    }),
  }),

  selectors: {
    selectSearchQuery: state => state.searchQuery,
    selectActiveFilter: state => state.activeFilter,
    selectDeliveryPersonnelListStatus: state => state.status,
  },
});

export const {
  setSearchQuery,
  setActiveFilter,
  resetDeliveryPersonnelList,
} = deliveryPersonnelListSlice.actions;

export const {
  selectSearchQuery,
  selectActiveFilter,
  selectDeliveryPersonnelListStatus,
} = deliveryPersonnelListSlice.selectors;
