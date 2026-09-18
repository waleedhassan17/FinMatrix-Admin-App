import { resolvePlanFeatures } from '../planFeatures';

describe('resolvePlanFeatures — no card names a plan the reader cannot see', () => {
  it('spells out what "Everything in Large Organization" included', () => {
    expect(
      resolvePlanFeatures([
        'Everything in Large Organization',
        'Full inventory + purchase orders (GRNI 3-way match)',
        'Deliveries with rider app & admin approval',
        'Goods-in-Transit accounting built in',
      ]),
    ).toEqual([
      'Complete accounting: invoices, bills, payments, tax & reports',
      'Payroll, budgets, bank reconciliation & team roles',
      'Full inventory + purchase orders (GRNI 3-way match)',
      'Deliveries with rider app & admin approval',
      'Goods-in-Transit accounting built in',
    ]);
  });

  it('handles Small Business, drops a tier it does not know, and removes repeats', () => {
    expect(
      resolvePlanFeatures([
        'everything in small business.',
        'Everything in Standard',
        'Complete accounting: invoices, bills, payments, tax & reports',
        'Payroll, employees & payslips',
      ]),
    ).toEqual(['Complete accounting: invoices, bills, payments, tax & reports', 'Payroll, employees & payslips']);
  });

  it('passes the current server copy through unchanged', () => {
    const current = [
      'Complete accounting: invoices, bills, payments, tax & reports',
      'Payroll, budgets, bank reconciliation & team roles',
      'Full inventory + purchase orders (GRNI 3-way match)',
      'Deliveries with rider app, admin approval & Goods-in-Transit accounting',
    ];
    expect(resolvePlanFeatures(current)).toEqual(current);
  });

  it('survives a missing or malformed list', () => {
    expect(resolvePlanFeatures(undefined)).toEqual([]);
    expect(resolvePlanFeatures(null)).toEqual([]);
    expect(resolvePlanFeatures(['', '  ', 42, 'Reports'])).toEqual(['Reports']);
  });
});
