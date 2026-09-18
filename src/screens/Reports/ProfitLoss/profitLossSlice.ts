import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import {
  type ReportDateRange,
  getComparisonRange,
  getDefaultReportRange,
} from '../../../models/reportModel';
import type { ProfitLossReport } from '../../../models/profitLossModel';
import { getProfitLossReportAPI } from '../../../networks/reports/profitLossNetwork';
import { profitLossSerializer } from '../../../serializers/profitLossSerializer';

interface ProfitLossState {
  range: ReportDateRange;
  /** True once the user picks their own dates — see getDefaultReportRange. */
  isCustomRange: boolean;
  comparisonEnabled: boolean;
  report: ProfitLossReport | null;
  isLoading: boolean;
  error: string;
}

const initialState: ProfitLossState = {
  range: getDefaultReportRange(),
  isCustomRange: false,
  comparisonEnabled: false,
  report: null,
  isLoading: false,
  error: '',
};

export const profitLossSlice = createAppSlice({
  name: 'profitLoss',
  initialState,
  reducers: create => ({
    setProfitLossRange: create.reducer((state, action: PayloadAction<ReportDateRange>) => {
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
    refreshProfitLossRange: create.reducer(state => {
      if (!state.isCustomRange) state.range = getDefaultReportRange();
    }),
    setProfitLossComparisonEnabled: create.reducer((state, action: PayloadAction<boolean>) => {
      state.comparisonEnabled = action.payload;
    }),
    fetchProfitLossReport: create.asyncThunk(
      async (
        payload: { range: ReportDateRange; comparisonEnabled: boolean },
      ) => {
        const comparisonRange = payload.comparisonEnabled
          ? getComparisonRange(payload.range)
          : undefined;
        return profitLossSerializer(
          await getProfitLossReportAPI(payload.range, comparisonRange),
        );
      },
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
          state.error = action.error?.message ?? 'Failed to load P&L report';
        },
      },
    ),
  }),
  selectors: {
    selectProfitLossState: state => state,
  },
});

export const {
  setProfitLossRange,
  refreshProfitLossRange,
  setProfitLossComparisonEnabled,
  fetchProfitLossReport,
} = profitLossSlice.actions;

export const selectProfitLossState = (rootState: { profitLoss?: ProfitLossState }) =>
  rootState.profitLoss ?? initialState;
