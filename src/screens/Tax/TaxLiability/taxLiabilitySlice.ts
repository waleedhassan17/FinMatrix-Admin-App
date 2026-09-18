// ═══════════════════════════════════════════════════════
// FinMatrix — Tax Liability Slice
// ═══════════════════════════════════════════════════════

import type { PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from '@reduxjs/toolkit';
import { createAppSlice } from '@store/createAppSlice';
import type { TaxLiabilityRow, TaxLiabilityReport } from '../../../types';
import { getTaxLiabilityAPI } from '../../../networks/purchases/taxNetwork';
import { taxLiabilitySerializer } from '../../../serializers/taxSerializer';

export interface DateRange {
  from: string;
  to: string;
}

export interface TaxLiabilityState {
  rows: TaxLiabilityRow[];
  totalCollected: number;
  totalPaid: number;
  totalNet: number;
  range: DateRange;
  isLoading: boolean;
  error: string;
}

const initialState: TaxLiabilityState = {
  rows: [],
  totalCollected: 0,
  totalPaid: 0,
  totalNet: 0,
  /**
   * Blank, not a date literal.
   *
   * This was hardcoded to 2026-01-01 → 2026-03-31. Every tax movement in a
   * company that started trading in July fell outside it, so the screen opened
   * reporting Rs 0 against a real Rs 57,989.10 of collected-but-unremitted
   * sales tax — and read as a broken feature rather than a stale constant.
   *
   * `getTaxLiabilityAPI` omits a blank param and `tax.service.getLiability`
   * already defaults startDate to 1970-01-01 and endDate to today, so an empty
   * range asks for the whole history through today. That is what this screen
   * promises: "Net Due" and "Outstanding tax liability" describe a balance
   * owed, not a slice of one period.
   *
   * Deliberately not "current month" or "current year" either. Unremitted tax
   * accumulates on 2300 until it is paid over, so ANY fixed window can hide
   * part of a real liability — a one-year default would be the same mistake in
   * a smaller size. Show everything by default; let the user narrow to a
   * filing period with the date fields.
   */
  range: { from: '', to: '' },
  isLoading: false,
  error: '',
};

export const taxLiabilitySlice = createAppSlice({
  name: 'taxLiability',
  initialState,
  reducers: create => ({
    setRange: create.reducer((state, action: PayloadAction<DateRange>) => {
      state.range = action.payload;
    }),

    fetchTaxLiability: create.asyncThunk(
      async ({ from, to }: DateRange) => {
        const envelope = await getTaxLiabilityAPI(from, to);
        return taxLiabilitySerializer(envelope);
      },
      {
        pending:   state => { state.isLoading = true; state.error = ''; },
        fulfilled: (state, action: PayloadAction<TaxLiabilityReport>) => {
          state.rows           = action.payload.rows;
          state.totalCollected = action.payload.totalCollected;
          state.totalPaid      = action.payload.totalPaid;
          state.totalNet       = action.payload.totalNet;
          state.isLoading      = false;
        },
        rejected: (state, action) => {
          state.isLoading = false;
          state.error = action.error?.message ?? 'Failed to load liability report';
        },
      },
    ),
  }),

  selectors: {
    selectTaxLiabilityRows:        state => state.rows,
    selectTaxLiabilityCollected:   state => state.totalCollected,
    selectTaxLiabilityPaid:        state => state.totalPaid,
    selectTaxLiabilityNet:         state => state.totalNet,
    selectTaxLiabilityRange:       state => state.range,
    selectTaxLiabilityLoading:     state => state.isLoading,
    selectTaxLiabilityError:       state => state.error,
  },
});

export const { setRange, fetchTaxLiability } = taxLiabilitySlice.actions;

export const {
  selectTaxLiabilityRows,
  selectTaxLiabilityCollected,
  selectTaxLiabilityPaid,
  selectTaxLiabilityNet,
  selectTaxLiabilityRange,
  selectTaxLiabilityLoading,
  selectTaxLiabilityError,
} = taxLiabilitySlice.selectors;

/** Memoized — returns a stable object reference unless inputs change. */
export const selectTaxLiabilityTotals = createSelector(
  [selectTaxLiabilityCollected, selectTaxLiabilityPaid, selectTaxLiabilityNet],
  (collected, paid, net) => ({ collected, paid, net }),
);
