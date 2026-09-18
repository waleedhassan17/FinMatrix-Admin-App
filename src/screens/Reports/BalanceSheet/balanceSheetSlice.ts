import type { PayloadAction } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { BalanceSheetReport } from '../../../models/balanceSheetModel';
import { getBalanceSheetReportAPI } from '../../../networks/reports/balanceSheetNetwork';
import { balanceSheetSerializer } from '../../../serializers/balanceSheetSerializer';
import { toIsoDate } from '../../../models/reportModel';

interface BalanceSheetState {
  /** True once the user picks their own date — see getDefaultReportRange. */
  isCustomRange: boolean;
  asOfDate: string;
  report: BalanceSheetReport | null;
  isLoading: boolean;
  error: string;
}

const initialState: BalanceSheetState = {
  isCustomRange: false,
  // LOCAL calendar date. toISOString() is UTC, so in PKT (UTC+5) it returns
  // yesterday until 05:00 — the sheet would open closed as of the wrong day.
  //
  // This is still only the value at bundle startup; refreshBalanceSheetAsOfDate
  // is what keeps it honest once the app has been running for a while.
  asOfDate: toIsoDate(new Date()),
  report: null,
  isLoading: false,
  error: '',
};

export const balanceSheetSlice = createAppSlice({
  name: 'balanceSheet',
  initialState,
  reducers: create => ({
    setBalanceSheetAsOfDate: create.reducer((state, action: PayloadAction<string>) => {
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
    refreshBalanceSheetAsOfDate: create.reducer(state => {
      if (!state.isCustomRange) state.asOfDate = toIsoDate(new Date());
    }),
    fetchBalanceSheetReport: create.asyncThunk(
      async (asOfDate: string) => balanceSheetSerializer(await getBalanceSheetReportAPI(asOfDate)),
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
          state.error = action.error?.message ?? 'Failed to load balance sheet';
        },
      },
    ),
  }),
  selectors: {
    selectBalanceSheetState: state => state,
  },
});

export const { setBalanceSheetAsOfDate, refreshBalanceSheetAsOfDate, fetchBalanceSheetReport } = balanceSheetSlice.actions;
export const selectBalanceSheetState = (rootState: { balanceSheet?: BalanceSheetState }) =>
  rootState.balanceSheet ?? initialState;
