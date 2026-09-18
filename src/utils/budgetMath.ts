// ═══════════════════════════════════════════════════════
// FinMatrix — Budget arithmetic
// ═══════════════════════════════════════════════════════
// The server reports variance as budgeted − actual for EVERY account. For an
// expense that reads correctly (positive = under budget = good). For revenue it
// reads backwards: selling more than planned gives a negative variance. These
// helpers put the sign — and the colour — where an accountant expects it, and
// keep revenue and spending totals apart instead of adding them together.

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const isRevenueType = (type: string): boolean => {
  const t = (type ?? '').toLowerCase();
  return t === 'revenue' || t === 'income';
};

/** Only these are budgeted: the prefill returns nothing else, and the web console offers nothing else. */
export const isBudgetableAccount = (type: string): boolean =>
  isRevenueType(type) || (type ?? '').toLowerCase() === 'expense';

interface VarianceInput {
  accountType: string;
  budgeted: number;
  actual: number;
}

/** Positive is good: revenue above target, or spending under budget. */
export const favourableVariance = (r: VarianceInput): number =>
  round2(isRevenueType(r.accountType) ? r.actual - r.budgeted : r.budgeted - r.actual);

export const isFavourableVariance = (r: VarianceInput): boolean => favourableVariance(r) >= 0;

/** "Rs 4,000.00 under budget", "Rs 1,200.00 above target", "On budget". */
export const varianceLabel = (r: VarianceInput, format: (n: number) => string): string => {
  const v = favourableVariance(r);
  if (v === 0) return 'On budget';
  const amount = format(Math.abs(v));
  if (isRevenueType(r.accountType)) return v > 0 ? `${amount} above target` : `${amount} below target`;
  return v > 0 ? `${amount} under budget` : `${amount} over budget`;
};

/** Revenue and spending totals, kept apart — their sum is not a figure anyone can act on. */
export const splitBudgetTotals = (rows: VarianceInput[]) =>
  rows.reduce(
    (t, r) => {
      const side = isRevenueType(r.accountType) ? t.revenue : t.spending;
      side.budgeted = round2(side.budgeted + r.budgeted);
      side.actual = round2(side.actual + r.actual);
      return t;
    },
    { revenue: { budgeted: 0, actual: 0 }, spending: { budgeted: 0, actual: 0 } },
  );

/**
 * An annual amount spread over twelve months in whole paise, the rounding
 * remainder landing in December — so the months add back to exactly the annual
 * figure. (100,000 ÷ 12 rounded per month summed to 99,999.96.)
 */
export const evenMonthlySpread = (annual: number): number[] => {
  const paise = Math.round((annual || 0) * 100);
  const base = Math.floor(paise / 12);
  const months = Array.from({ length: 12 }, () => base);
  months[11] += paise - base * 12;
  return months.map(p => p / 100);
};
