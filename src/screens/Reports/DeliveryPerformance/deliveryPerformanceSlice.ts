import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { ReportDateRange } from '../../../models/reportModel';
import { getLastNDaysRange } from '../../../models/reportModel';
import type { DeliveryPerformanceReport } from '../../../models/deliveryPerformanceModel';
import { getDeliveryPerformanceAPI } from '../../../networks/reports/deliveryPerformanceNetwork';
import { deliveryPerformanceSerializer } from '../../../serializers/deliveryPerformanceSerializer';

interface DeliveryPerformanceState {
  report: DeliveryPerformanceReport | null;
  range: ReportDateRange;
  /** True once the user picks their own dates — see getDefaultReportRange. */
  isCustomRange: boolean;
  isLoading: boolean;
  error: string;
}

const initialState: DeliveryPerformanceState = {
  report: null,
  range: getLastNDaysRange(14),
  isCustomRange: false,
  isLoading: false,
  error: '',
};

export const deliveryPerformanceSlice = createAppSlice({
  name: 'deliveryPerformance',
  initialState,
  reducers: create => ({
    setDeliveryPerformanceRange: create.reducer((state, action: PayloadAction<ReportDateRange>) => {
      state.range = action.payload;
      state.isCustomRange = true;
    }),
    /**
     * Re-seed the window to today unless the user chose their own.
     *
     * initialState is evaluated once at bundle startup, so without this the
     * range freezes on the day the app launched and the report silently
     * stops including anything newer. Screens dispatch this on focus.
     */
    refreshDeliveryPerformanceRange: create.reducer(state => {
      if (!state.isCustomRange) state.range = getLastNDaysRange(14);
    }),
    fetchDeliveryPerformance: create.asyncThunk(
      async (range: ReportDateRange) => deliveryPerformanceSerializer(await getDeliveryPerformanceAPI(range)),
      {
        pending: state => {
          state.isLoading = true;
          state.error = '';
        },
        fulfilled: (state, action) => {
          state.isLoading = false;
          state.report = action.payload;
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.error = action.error?.message ?? 'Failed to load performance report';
        },
      },
    ),
  }),
  selectors: {
    selectDeliveryPerformanceState: state => state,
  },
});

export const { setDeliveryPerformanceRange, refreshDeliveryPerformanceRange, fetchDeliveryPerformance } =
  deliveryPerformanceSlice.actions;

// Manual selector – RTK's auto-generated slice.selectors can return
// undefined before redux-persist rehydrates the store.
export const selectDeliveryPerformanceState = (rootState: { deliveryPerformance?: DeliveryPerformanceState }) =>
  rootState.deliveryPerformance ?? initialState;
