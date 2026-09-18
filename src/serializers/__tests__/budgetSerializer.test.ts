import { budgetVsActualSerializer } from '../budgetSerializer';

describe('budgetVsActualSerializer', () => {
  it('keeps each row’s monthly breakdown', () => {
    const va = budgetVsActualSerializer({
      success: true,
      data: {
        budget: { id: 'b1', name: 'FY2026', fiscalYear: 2026, status: 'active' },
        totals: { budgeted: '1200', actual: '1100', variance: '100' },
        rows: [
          {
            accountId: 'a1',
            accountCode: '6000',
            accountName: 'Rent',
            accountType: 'expense',
            budgeted: 1200,
            actual: 1100,
            variance: 100,
            percentUsed: 91.7,
            months: [
              { month: 1, budgeted: '100', actual: '90', variance: '10' },
              { month: 2, budgeted: 100, actual: 110, variance: -10 },
            ],
          },
        ],
      },
    });
    expect(va?.rows[0].months).toEqual([
      { month: 1, budgeted: 100, actual: 90, variance: 10 },
      { month: 2, budgeted: 100, actual: 110, variance: -10 },
    ]);
    expect(va?.totals.variance).toBe(100);
  });

  it('gives an empty breakdown when the server sends none', () => {
    const va = budgetVsActualSerializer({ rows: [{ accountId: 'a', budgeted: 1, actual: 1 }], totals: {} });
    expect(va?.rows[0].months).toEqual([]);
  });
});
