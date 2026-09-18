import {
  evenMonthlySpread,
  favourableVariance,
  isBudgetableAccount,
  isFavourableVariance,
  splitBudgetTotals,
  varianceLabel,
} from '../budgetMath';

const rs = (n: number) => `Rs ${n.toFixed(2)}`;

describe('variance, read the way an accountant reads it', () => {
  it('spending under budget is favourable', () => {
    const r = { accountType: 'expense', budgeted: 10000, actual: 8000 };
    expect(favourableVariance(r)).toBe(2000);
    expect(isFavourableVariance(r)).toBe(true);
    expect(varianceLabel(r, rs)).toBe('Rs 2000.00 under budget');
  });

  it('revenue ABOVE target is favourable — the server sign reads it backwards', () => {
    const r = { accountType: 'revenue', budgeted: 50000, actual: 60000 };
    expect(favourableVariance(r)).toBe(10000);
    expect(isFavourableVariance(r)).toBe(true);
    expect(varianceLabel(r, rs)).toBe('Rs 10000.00 above target');
    expect(isFavourableVariance({ accountType: 'revenue', budgeted: 50000, actual: 40000 })).toBe(false);
  });

  it('keeps revenue and spending totals apart', () => {
    expect(
      splitBudgetTotals([
        { accountType: 'revenue', budgeted: 100, actual: 120 },
        { accountType: 'expense', budgeted: 60, actual: 50 },
        { accountType: 'expense', budgeted: 40, actual: 45 },
      ]),
    ).toEqual({ revenue: { budgeted: 100, actual: 120 }, spending: { budgeted: 100, actual: 95 } });
  });

  it('budgets only revenue and expense accounts', () => {
    expect(isBudgetableAccount('revenue')).toBe(true);
    expect(isBudgetableAccount('expense')).toBe(true);
    expect(isBudgetableAccount('asset')).toBe(false);
  });
});

describe('evenMonthlySpread', () => {
  it('adds back to exactly the annual amount, remainder in December', () => {
    const months = evenMonthlySpread(100000);
    expect(months.slice(0, 11).every(m => m === 8333.33)).toBe(true);
    expect(months[11]).toBe(8333.37);
    expect(Math.round(months.reduce((s, m) => s + m, 0) * 100)).toBe(10000000);
  });
});
