import type { LedgerEntry } from '../../../models/generalLedgerModel';

/**
 * How many ledger lines the table will draw.
 *
 * This was 300, and the rows were taken from the FRONT of the list. GET /ledger
 * returns the ledger oldest-first, so `slice(0, 300)` kept the oldest 300 and
 * silently dropped everything after. On the live warehouse books row 300 fell
 * on 2 September, so the General Ledger showed nothing newer for a week while
 * the ledger itself was completely up to date. Restarting the app did not help,
 * and it never recovers on its own: the window stays pinned at row 300 and
 * falls further behind with every entry posted.
 *
 * 1000 because that company posts roughly 500 lines a year — years of headroom,
 * and still a bound, because the table renders inside a plain ScrollView rather
 * than a virtualised list.
 */
export const ROW_CAP = 1000;

/**
 * The rows the table will draw, and how many were left out.
 *
 * Takes the TAIL, not the head. A ledger screen exists to answer "what has
 * happened lately", so hiding the latest activity is the one thing it must
 * never do — and hiding it *silently* is what turned a display cap into a
 * week of apparently missing accounts.
 *
 * Slicing from the end also preserves ascending order, which the caller
 * depends on: entries are grouped by account in the order they arrive, and the
 * closing balance shown per account is the running balance the SERVER computed
 * on the last row of that account. Reversing or re-sorting here would quietly
 * corrupt both.
 *
 * Kept in its own module, free of React and navigation imports, so the
 * property that matters can be tested directly.
 */
export const visibleLedgerRows = (
  entries: LedgerEntry[],
  cap: number = ROW_CAP,
): { rows: LedgerEntry[]; hiddenCount: number } => {
  if (entries.length <= cap) return { rows: entries, hiddenCount: 0 };
  return { rows: entries.slice(-cap), hiddenCount: entries.length - cap };
};

/**
 * A group's rows in the order they are drawn. The ledger arrives oldest-first
 * and every running balance is computed in that order on the server; showing
 * newest first only flips the presentation, so the latest postings sit at the
 * top where people look for them. Returns a copy — the chronological array is
 * what the closing balance is read from.
 */
export const displayOrder = <T,>(rows: T[], newestFirst: boolean): T[] =>
  newestFirst ? [...rows].reverse() : rows;
