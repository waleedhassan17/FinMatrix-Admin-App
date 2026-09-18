// AP aging shares A/R's bucket model: the backend builds both with the same
// bucketAging() helper, so the row/total shapes are identical.
import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { ARAgingReport } from '../../../models/arAgingModel';
import { getAPAgingReportAPI } from '../../../networks/reports/apAgingNetwork';
import { arAgingSerializer } from '../../../serializers/arAgingSerializer';
import { toIsoDate } from '../../../models/reportModel';

interface APAgingState {
  /** True once the user picks their own date — see getDefaultReportRange. */
  isCustomRange: boolean;
  asOfDate: string;
  report: ARAgingReport | null;
  isLoading: boolean;
  error: string;
}

const initialState: APAgingState = {
  isCustomRange: false,
  // LOCAL calendar date — toISOString() is UTC and ages the buckets from
  // yesterday in PKT until 05:00 local.
  asOfDate: toIsoDate(new Date()),
  report: null,
  isLoading: false,
  error: '',
};

export const apAgingSlice = createAppSlice({
  name: 'apAging',
  initialState,
  reducers: create => ({
    setAPAgingAsOfDate: create.reducer((state, action: PayloadAction<string>) => {
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
    refreshAPAgingAsOfDate: create.reducer(state => {
      if (!state.isCustomRange) state.asOfDate = toIsoDate(new Date());
    }),
    fetchARAgingReport: create.asyncThunk(
      async (asOfDate: string) => arAgingSerializer(await getAPAgingReportAPI(asOfDate)),
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
          state.error = action.error?.message ?? 'Failed to load AP aging';
        },
      },
    ),
  }),
  selectors: {
    selectAPAgingState: state => state,
  },
});

export const { setAPAgingAsOfDate, refreshAPAgingAsOfDate, fetchARAgingReport } = apAgingSlice.actions;
export const selectAPAgingState = (rootState: { apAging?: APAgingState }) =>
  rootState.apAging ?? initialState;
