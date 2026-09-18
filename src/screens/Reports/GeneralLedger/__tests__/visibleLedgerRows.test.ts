import { displayOrder, visibleLedgerRows, ROW_CAP } from '../ledgerRows';
import type { LedgerEntry } from '../../../../models/generalLedgerModel';

/**
 * Regression cover for the bug that made the warehouse pilot look broken.
 *
 * GET /ledger returns the ledger OLDEST-FIRST. The screen capped the table with
 * `entries.slice(0, 300)`, which keeps the oldest 300 and throws away
 * everything after — silently, with no indicator. On the live books row 300
 * fell on 2 September, so the General Ledger showed nothing newer for a week
 * while the ledger itself was completely up to date. Restarting the app did not
 * help, and it never recovers: the window stays pinned at row 300 and falls
 * further behind with every entry posted.
 *
 * The property that has to hold is simple and is asserted directly below: over
 * the cap, THE LAST ENTRY OF THE LEDGER IS STILL ON SCREEN.
 */

const entry = (date: string, reference: string): LedgerEntry => ({
  date,
  postedAt: `${date}T10:00:00.000Z`,
  reference,
  accountCode: '1000',
  accountName: 'Cash',
  memo: '',
  debit: 100,
  credit: 0,
  balance: 100,
  sourceType: 'journal_entry',
  sourceId: reference,
});

/** Ascending by date, the order the API actually returns. */
const ledgerOf = (n: number): LedgerEntry[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 0, 1));
    d.setUTCDate(d.getUTCDate() + i);
    return entry(d.toISOString().slice(0, 10), `JE-${i + 1}`);
  });

describe('visibleLedgerRows', () => {
  it('keeps the NEWEST rows when the ledger is over the cap', () => {
    const entries = ledgerOf(ROW_CAP + 84); // the production shape: 384 vs a 300 cap
    const { rows, hiddenCount } = visibleLedgerRows(entries);

    // The exact failure that shipped: the last row must be the ledger's last
    // entry, not the one sitting at the cap boundary.
    expect(rows[rows.length - 1]).toEqual(entries[entries.length - 1]);
    expect(rows[rows.length - 1].reference).toBe(`JE-${entries.length}`);
    expect(rows).toHaveLength(ROW_CAP);
    expect(hiddenCount).toBe(84);
  });

  it('drops from the OLD end, so what is hidden is the earliest activity', () => {
    const entries = ledgerOf(ROW_CAP + 5);
    const { rows } = visibleLedgerRows(entries);

    expect(rows[0]).toEqual(entries[5]);
    expect(rows).not.toContain(entries[0]);
  });

  it('preserves ascending order — the grouping and running balances depend on it', () => {
    const { rows } = visibleLedgerRows(ledgerOf(ROW_CAP + 40));
    const dates = rows.map((r) => r.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('reports nothing hidden, and changes nothing, under the cap', () => {
    const entries = ledgerOf(12);
    const { rows, hiddenCount } = visibleLedgerRows(entries);

    expect(rows).toEqual(entries);
    expect(hiddenCount).toBe(0);
  });

  it('handles exactly the cap as a complete ledger', () => {
    const entries = ledgerOf(ROW_CAP);
    const { rows, hiddenCount } = visibleLedgerRows(entries);

    expect(rows).toHaveLength(ROW_CAP);
    expect(hiddenCount).toBe(0);
  });

  it('handles an empty ledger', () => {
    expect(visibleLedgerRows([])).toEqual({ rows: [], hiddenCount: 0 });
  });

  it('hiddenCount is exactly what the notice promises the user', () => {
    const entries = ledgerOf(ROW_CAP + 7);
    const { rows, hiddenCount } = visibleLedgerRows(entries);
    expect(rows.length + hiddenCount).toBe(entries.length);
  });
});

describe('displayOrder', () => {
  it('shows the newest posting first without disturbing the chronological rows', () => {
    const rows = [entry('2026-09-01', 'JE-1'), entry('2026-09-02', 'JE-2')];
    expect(displayOrder(rows, true).map(r => r.reference)).toEqual(['JE-2', 'JE-1']);
    expect(rows.map(r => r.reference)).toEqual(['JE-1', 'JE-2']);
    expect(displayOrder(rows, false)).toBe(rows);
  });
});
