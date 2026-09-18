// ═══════════════════════════════════════════════════════
// FinMatrix — statement formatting helpers
// The pure half of the reports UI kit: money formatting, period labels
// and chart-of-accounts classification. Kept free of React and
// react-native imports so it stays directly unit-testable; ReportUI
// re-exports everything here, so screens keep importing from ReportUI.
// ═══════════════════════════════════════════════════════

import dayjs from 'dayjs';
import { formatCurrency } from '../../utils/formatters';

/**
 * Accounting-style money: negatives in parentheses rather than with a minus.
 *
 *   -1234 -> "(Rs 1,234.00)"      1234 -> "Rs 1,234.00"      0 -> "Rs 0.00"
 *
 * Wraps formatCurrency rather than reimplementing it, so rounding and
 * thousands separators stay identical to the rest of the app. formatCurrency
 * itself is untouched — the KPI tiles and every non-statement surface keep
 * their existing minus-sign format.
 */
export const parenNegative = (n: number, currency = 'Rs '): string => {
  const value = Number.isFinite(n) ? n : 0;
  const body = formatCurrency(Math.abs(value), currency);
  return value < 0 ? `(${body})` : body;
};

/** "As of August 20, 2026" */
export const asOfLabel = (date: string): string => `As of ${dayjs(date).format('MMMM D, YYYY')}`;

/** "January 1 – August 21, 2026" */
export const rangeLabel = (start: string, end: string): string =>
  `${dayjs(start).format('MMMM D, YYYY')} – ${dayjs(end).format('MMMM D, YYYY')}`;

/** Where an account sits on the statements, by its number. */
export type AccountGroup =
  | 'bank'
  | 'ar'
  | 'otherCurrentAsset'
  | 'fixedAsset'
  | 'currentLiability'
  | 'longTermLiability'
  | 'equity'
  | 'income'
  | 'cogs'
  | 'expense'
  | 'other';

/**
 * Standard chart-of-accounts numbering → statement group. Pure.
 *
 * Note 1200–1499 deliberately covers Inventory (1200) AND Goods in Transit
 * (1250): both are other current assets, and the delivery flow routes stock
 * through 1250 between dispatch and approval. 2000–2399 likewise covers A/P
 * (2000) and GRNI (2050).
 *
 * A code that is not a number falls to 'other' rather than throwing — the
 * statements must still render for a hand-edited chart.
 */
export const classifyAccount = (code: string): AccountGroup => {
  const n = parseInt(code, 10);
  if (!Number.isFinite(n)) return 'other';
  if (n >= 1000 && n <= 1099) return 'bank';
  if (n >= 1100 && n <= 1199) return 'ar';
  if (n >= 1200 && n <= 1499) return 'otherCurrentAsset';
  if (n >= 1500 && n <= 1999) return 'fixedAsset';
  if (n >= 2000 && n <= 2399) return 'currentLiability';
  if (n >= 2400 && n <= 2999) return 'longTermLiability';
  if (n >= 3000 && n <= 3999) return 'equity';
  if (n >= 4000 && n <= 4999) return 'income';
  if (n >= 5000 && n <= 5999) return 'cogs';
  if (n >= 6000 && n <= 7999) return 'expense';
  return 'other';
};

/**
 * Guard for a rendered subtotal against the server's authoritative figure.
 * The server total is ALWAYS what gets displayed; this only surfaces a
 * mismatch to a developer, and is silent in production.
 */
export const reconcile = (displaySum: number, serverTotal: number, label: string): number => {
  if (__DEV__ && Math.abs(displaySum - serverTotal) > 0.01) {
    // eslint-disable-next-line no-console
    console.warn(
      `[reports] ${label}: rendered lines sum to ${displaySum} but the server reports ` +
        `${serverTotal}. Showing the server figure.`,
    );
  }
  return serverTotal;
};
