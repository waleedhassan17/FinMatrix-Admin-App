import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { ARAgingReport } from '../../../models/arAgingModel';
import { getARAgingReportAPI } from '../../../networks/reports/arAgingNetwork';
import { arAgingSerializer } from '../../../serializers/arAgingSerializer';
import { toIsoDate } from '../../../models/reportModel';

interface ARAgingState {
  /** True once the user picks their own date — see getDefaultReportRange. */
  isCustomRange: boolean;
  asOfDate: string;
  report: ARAgingReport | null;
  isLoading: boolean;
  error: string;
}

const initialState: ARAgingState = {
  isCustomRange: false,
  // LOCAL calendar date — toISOString() is UTC and ages the buckets from
  // yesterday in PKT until 05:00 local.
  asOfDate: toIsoDate(new Date()),
  report: null,
  isLoading: false,
  error: '',
};

export const arAgingSlice = createAppSlice({
  name: 'arAging',
  initialState,
  reducers: create => ({
    setARAgingAsOfDate: create.reducer((state, action: PayloadAction<string>) => {
      state.asOfDate = action.payload;
      state.isCustomRange = true;
    }),
    /**
     * Re-seed to today unless the user chose their own date.
     *
     * initialState is evaluated once at bundle startup, so without this the
     * date freezes on the day the app launched and the report silently
     * stops including anything newer. Screens dispatch this on focus.
     */
    refreshARAgingAsOfDate: create.reducer(state => {
      if (!state.isCustomRange) state.asOfDate = toIsoDate(new Date());
    }),
    fetchARAgingReport: create.asyncThunk(
      async (asOfDate: string) => arAgingSerializer(await getARAgingReportAPI(asOfDate)),
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
          state.error = action.error?.message ?? 'Failed to load AR aging';
        },
      },
    ),
  }),
  selectors: {
    selectARAgingState: state => state,
  },
});

export const { setARAgingAsOfDate, refreshARAgingAsOfDate, fetchARAgingReport } = arAgingSlice.actions;
export const selectARAgingState = (rootState: { arAging?: ARAgingState }) =>
  rootState.arAging ?? initialState;
