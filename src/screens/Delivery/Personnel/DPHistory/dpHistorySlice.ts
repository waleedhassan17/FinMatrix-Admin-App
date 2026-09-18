import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';

export interface DPHistorySliceState {
  statusFilter: 'all' | 'delivered' | 'failed' | 'returned';
  dateFilter: string;
  datePreset: 'all' | 'today' | 'last_7_days' | 'this_month' | 'custom';
  customDateStart: string;
  customDateEnd: string;
  isDatePickerOpen: boolean;
  page: number;
  pageSize: number;
}

const initialState: DPHistorySliceState = {
  statusFilter: 'all',
  dateFilter: '',
  datePreset: 'all',
  customDateStart: '',
  customDateEnd: '',
  isDatePickerOpen: false,
  page: 1,
  pageSize: 8,
};

export const dpHistorySlice = createAppSlice({
  name: 'dpHistory',
  initialState,
  reducers: create => ({
    setHistoryStatusFilter: create.reducer((state, action: PayloadAction<DPHistorySliceState['statusFilter']>) => {
      state.statusFilter = action.payload;
      state.page = 1;
    }),
    setHistoryDateFilter: create.reducer((state, action: PayloadAction<string>) => {
      state.dateFilter = action.payload;
      state.datePreset = action.payload ? 'custom' : 'all';
      state.page = 1;
    }),
    setHistoryDatePreset: create.reducer((state, action: PayloadAction<DPHistorySliceState['datePreset']>) => {
      state.datePreset = action.payload;
      if (action.payload !== 'custom') {
        state.dateFilter = '';
      }
      state.page = 1;
    }),
    setHistoryDatePickerOpen: create.reducer((state, action: PayloadAction<boolean>) => {
      state.isDatePickerOpen = action.payload;
    }),
    nextHistoryPage: create.reducer(state => {
      state.page += 1;
    }),
    prevHistoryPage: create.reducer(state => {
      state.page = Math.max(1, state.page - 1);
    }),
    setHistoryCustomDateStart: create.reducer((state, action: PayloadAction<string>) => {
      state.customDateStart = action.payload;
      state.page = 1;
    }),
    setHistoryCustomDateEnd: create.reducer((state, action: PayloadAction<string>) => {
      state.customDateEnd = action.payload;
      state.page = 1;
    }),
    setHistoryPage: create.reducer((state, action: PayloadAction<number>) => {
      state.page = Math.max(1, action.payload);
    }),
  }),
  selectors: {
    selectDPHistoryState: state => state,
    selectDPHistoryUI: state => state,
  },
});

export const {
  setHistoryStatusFilter,
  setHistoryDateFilter,
  setHistoryDatePreset,
  setHistoryDatePickerOpen,
  nextHistoryPage,
  prevHistoryPage,
  setHistoryCustomDateStart,
  setHistoryCustomDateEnd,
  setHistoryPage,
} = dpHistorySlice.actions;
export const { selectDPHistoryState, selectDPHistoryUI } = dpHistorySlice.selectors;
