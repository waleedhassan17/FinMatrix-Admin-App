import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { DeliveryRecordStatus } from '../../../../models/deliveryModel';

export type MonitorFilterStatus = 'all' | DeliveryRecordStatus;
export type MonitorSortBy = 'time' | 'status' | 'priority';

export interface DeliveryMonitorSliceState {
  filterStatus: MonitorFilterStatus;
  sortBy: MonitorSortBy;
}

const initialState: DeliveryMonitorSliceState = {
  filterStatus: 'all',
  sortBy: 'time',
};

export const deliveryMonitorSlice = createAppSlice({
  name: 'deliveryMonitor',
  initialState,
  reducers: create => ({
    setFilterStatus: create.reducer((state, action: PayloadAction<MonitorFilterStatus>) => {
      state.filterStatus = action.payload;
    }),
    setSortBy: create.reducer((state, action: PayloadAction<MonitorSortBy>) => {
      state.sortBy = action.payload;
    }),
  }),
  selectors: {
    selectMonitorFilter: state => state.filterStatus,
    selectMonitorSort: state => state.sortBy,
  },
});

export const { setFilterStatus, setSortBy } = deliveryMonitorSlice.actions;
export const { selectMonitorFilter, selectMonitorSort } = deliveryMonitorSlice.selectors;
