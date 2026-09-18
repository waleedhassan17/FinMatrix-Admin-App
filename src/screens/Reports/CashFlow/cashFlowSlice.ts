import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import { type ReportDateRange, getDefaultReportRange } from '../../../models/reportModel';
import type { CashFlowReport } from '../../../models/cashFlowModel';
import { getCashFlowReportAPI } from '../../../networks/reports/cashFlowNetwork';
import { cashFlowSerializer } from '../../../serializers/cashFlowSerializer';

interface CashFlowState {
  range: ReportDateRange;
  /** True once the user picks their own dates — see getDefaultReportRange. */
  isCustomRange: boolean;
  report: CashFlowReport | null;
  isLoading: boolean;
  error: string;
}

const initialState: CashFlowState = {
  range: getDefaultReportRange(),
  isCustomRange: false,
  report: null,
  isLoading: false,
  error: '',
};

export const cashFlowSlice = createAppSlice({
  name: 'cashFlow',
  initialState,
  reducers: create => ({
    setCashFlowRange: create.reducer((state, action: PayloadAction<ReportDateRange>) => {
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
    refreshCashFlowRange: create.reducer(state => {
      if (!state.isCustomRange) state.range = getDefaultReportRange();
    }),
    fetchCashFlowReport: create.asyncThunk(
      async (range: ReportDateRange) => cashFlowSerializer(await getCashFlowReportAPI(range)),
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
          state.error = action.error?.message ?? 'Failed to load cash flow';
        },
      },
    ),
  }),
  selectors: {
    selectCashFlowState: state => state,
  },
});

export const { setCashFlowRange, refreshCashFlowRange, fetchCashFlowReport } = cashFlowSlice.actions;
export const selectCashFlowState = (rootState: { cashFlow?: CashFlowState }) =>
  rootState.cashFlow ?? initialState;
