// Cut the network chain at its root. Importing a report slice reaches its
// network module AND its serializer, both of which land on apiHelpers → axios,
// expo-constants and AsyncStorage — none of which a reducer test needs. Mocked
// with a factory rather than automocked, because automock still evaluates the
// real module.
jest.mock('../../../networks/network/apiHelpers', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  API_BASE_URL: 'http://test.local/api/v1',
  extractErrorMessage: jest.fn(),
  unwrapEnvelope: (r: unknown) => r,
}));

import { trialBalanceSlice } from '../TrialBalance/trialBalanceSlice';
import { balanceSheetSlice } from '../BalanceSheet/balanceSheetSlice';
import { generalLedgerSlice } from '../GeneralLedger/generalLedgerSlice';
import { toIsoDate } from '../../../models/reportModel';

/**
 * Regression cover for reports that quietly stop updating.
 *
 * Every report slice seeds its window in `initialState`, and an `initialState`
 * literal is evaluated ONCE — when the store imports the slice at JS-bundle
 * startup. Nothing recomputed it afterwards: no report screen refreshed on
 * focus, there is no pull-to-refresh under src/screens/Reports/, and no
 * AppState listener. Report slices are not persisted either, so the window only
 * reset on a full process kill; signing out and back in restored the SAME stale
 * date, because that is what initialState holds.
 *
 * On a phone left running for a few days that reads as "the books stopped
 * updating" — the screen fetches, spins, and returns real data for a window
 * that closed days ago.
 *
 * The two properties that matter: a range nobody touched follows the calendar,
 * and a range the user chose is left exactly alone.
 */

const TODAY = toIsoDate(new Date());
const STALE = '2026-09-02';

describe('report ranges follow the calendar', () => {
  describe('trialBalance', () => {
    const { setTrialBalanceRange, refreshTrialBalanceRange } = trialBalanceSlice.actions;
    const reduce = trialBalanceSlice.reducer;

    it('brings a stale, untouched window up to today', () => {
      // The exact failure: state left over from a bundle that started days ago.
      const stale = { ...trialBalanceSlice.getInitialState(), range: { startDate: '2026-01-01', endDate: STALE } };
      expect(stale.isCustomRange).toBe(false);

      const next = reduce(stale, refreshTrialBalanceRange());
      expect(next.range.endDate).toBe(TODAY);
    });

    it('leaves a range the user chose completely alone', () => {
      const chosen = { startDate: '2026-04-01', endDate: '2026-04-30' };
      const picked = reduce(trialBalanceSlice.getInitialState(), setTrialBalanceRange(chosen));
      expect(picked.isCustomRange).toBe(true);

      // Navigating away and back must not wipe out the period being examined.
      expect(reduce(picked, refreshTrialBalanceRange()).range).toEqual(chosen);
    });
  });

  describe('generalLedger', () => {
    const { setLedgerRange, refreshLedgerRange } = generalLedgerSlice.actions;
    const reduce = generalLedgerSlice.reducer;

    it('brings a stale, untouched window up to today', () => {
      const stale = { ...generalLedgerSlice.getInitialState(), range: { startDate: '2026-01-01', endDate: STALE } };
      expect(reduce(stale, refreshLedgerRange()).range.endDate).toBe(TODAY);
    });

    it('leaves a range the user chose completely alone', () => {
      const chosen = { startDate: '2026-02-01', endDate: '2026-02-28' };
      const picked = reduce(generalLedgerSlice.getInitialState(), setLedgerRange(chosen));
      expect(reduce(picked, refreshLedgerRange()).range).toEqual(chosen);
    });
  });

  describe('balanceSheet (as-of date rather than a range)', () => {
    const { setBalanceSheetAsOfDate, refreshBalanceSheetAsOfDate } = balanceSheetSlice.actions;
    const reduce = balanceSheetSlice.reducer;

    it('closes as of today when the date was never touched', () => {
      const stale = { ...balanceSheetSlice.getInitialState(), asOfDate: STALE };
      expect(reduce(stale, refreshBalanceSheetAsOfDate()).asOfDate).toBe(TODAY);
    });

    it('leaves a date the user chose completely alone', () => {
      const picked = reduce(balanceSheetSlice.getInitialState(), setBalanceSheetAsOfDate('2026-06-30'));
      expect(reduce(picked, refreshBalanceSheetAsOfDate()).asOfDate).toBe('2026-06-30');
    });
  });

  it('every report slice starts out following the calendar, not pinned', () => {
    expect(trialBalanceSlice.getInitialState().isCustomRange).toBe(false);
    expect(generalLedgerSlice.getInitialState().isCustomRange).toBe(false);
    expect(balanceSheetSlice.getInitialState().isCustomRange).toBe(false);
  });
});
