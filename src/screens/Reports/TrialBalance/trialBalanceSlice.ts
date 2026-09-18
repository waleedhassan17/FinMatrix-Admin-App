import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { type ReportDateRange, getDefaultReportRange } from '../../../models/reportModel';
import type { TrialBalanceReport } from '../../../models/trialBalanceModel';
import { getTrialBalanceReportAPI } from '../../../networks/reports/trialBalanceNetwork';
import { trialBalanceSerializer } from '../../../serializers/trialBalanceSerializer';

interface TrialBalanceState {
  range: ReportDateRange;
  /** True once the user picks their own dates — see getDefaultReportRange. */
  isCustomRange: boolean;
  report: TrialBalanceReport | null;
  isLoading: boolean;
  error: string;
}

const initialState: TrialBalanceState = {
  range: getDefaultReportRange(),
  isCustomRange: false,
  report: null,
  isLoading: false,
  error: '',
};

export const trialBalanceSlice = createAppSlice({
  name: 'trialBalance',
  initialState,
  reducers: create => ({
    setTrialBalanceRange: create.reducer((state, action: PayloadAction<ReportDateRange>) => {
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
    refreshTrialBalanceRange: create.reducer(state => {
      if (!state.isCustomRange) state.range = getDefaultReportRange();
    }),
    fetchTrialBalanceReport: create.asyncThunk(
      async (range: ReportDateRange) => trialBalanceSerializer(await getTrialBalanceReportAPI(range)),
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
          state.error = action.error?.message ?? 'Failed to load trial balance';
        },
      },
    ),
  }),
  selectors: {
    selectTrialBalanceState: state => state,
  },
});

export const { setTrialBalanceRange, refreshTrialBalanceRange, fetchTrialBalanceReport } = trialBalanceSlice.actions;
export const selectTrialBalanceState = (rootState: { trialBalance?: TrialBalanceState }) =>
  rootState.trialBalance ?? initialState;
