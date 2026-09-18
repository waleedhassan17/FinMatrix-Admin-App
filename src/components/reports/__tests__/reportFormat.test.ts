import { classifyAccount, parenNegative } from '../reportFormat';
import { formatCurrency } from '../../../utils/formatters';

/**
 * The two pure helpers behind the statement layout. Everything else in
 * ReportUI is a component; these carry the logic worth pinning, because a
 * misclassified account silently moves money between statement sections and a
 * broken sign convention misreads a loss as a profit.
 */

describe('parenNegative', () => {
  it('wraps negatives in parentheses instead of using a minus', () => {
    expect(parenNegative(-1234)).toBe('(Rs 1,234.00)');
  });

  it('leaves positives plain', () => {
    expect(parenNegative(1234)).toBe('Rs 1,234.00');
  });

  it('renders zero without parentheses', () => {
    expect(parenNegative(0)).toBe('Rs 0.00');
    // -0 is still zero, and must not read as "(Rs 0.00)".
    expect(parenNegative(-0)).toBe('Rs 0.00');
  });

  it('honours a custom currency prefix', () => {
    expect(parenNegative(-50, '$')).toBe('($50.00)');
  });

  it('rounds exactly like formatCurrency, so statements and tiles agree', () => {
    for (const n of [0.005, 1234.567, 99999.994, 1e6]) {
      expect(parenNegative(n)).toBe(formatCurrency(n));
      expect(parenNegative(-n)).toBe(`(${formatCurrency(n)})`);
    }
  });

  it('treats a non-finite amount as zero rather than printing NaN', () => {
    expect(parenNegative(Number.NaN)).toBe('Rs 0.00');
    expect(parenNegative(Number.POSITIVE_INFINITY)).toBe('Rs 0.00');
  });
});

describe('classifyAccount', () => {
  it('maps each documented range', () => {
    expect(classifyAccount('1000')).toBe('bank');
    expect(classifyAccount('1100')).toBe('ar');
    expect(classifyAccount('1200')).toBe('otherCurrentAsset');
    expect(classifyAccount('1500')).toBe('fixedAsset');
    expect(classifyAccount('2000')).toBe('currentLiability');
    expect(classifyAccount('2400')).toBe('longTermLiability');
    expect(classifyAccount('3000')).toBe('equity');
    expect(classifyAccount('4000')).toBe('income');
    expect(classifyAccount('5000')).toBe('cogs');
    expect(classifyAccount('6000')).toBe('expense');
    expect(classifyAccount('8000')).toBe('other');
  });

  it('puts the real chart of accounts where it belongs', () => {
    // The accounts this product actually seeds.
    expect(classifyAccount('1010')).toBe('bank'); // Business Checking
    expect(classifyAccount('1200')).toBe('otherCurrentAsset'); // Inventory
    expect(classifyAccount('1250')).toBe('otherCurrentAsset'); // Goods in Transit
    expect(classifyAccount('1300')).toBe('otherCurrentAsset'); // Input tax
    expect(classifyAccount('2050')).toBe('currentLiability'); // GRNI
    expect(classifyAccount('2300')).toBe('currentLiability'); // Sales tax payable
    expect(classifyAccount('2400')).toBe('longTermLiability'); // Customer advances
    expect(classifyAccount('3900')).toBe('equity'); // Opening Balance Equity
    expect(classifyAccount('6400')).toBe('expense'); // Inventory adjustment
  });

  it('splits exactly on every boundary', () => {
    expect(classifyAccount('1099')).toBe('bank');
    expect(classifyAccount('1100')).toBe('ar');
    expect(classifyAccount('1199')).toBe('ar');
    expect(classifyAccount('1200')).toBe('otherCurrentAsset');
    expect(classifyAccount('1499')).toBe('otherCurrentAsset');
    expect(classifyAccount('1500')).toBe('fixedAsset');
    expect(classifyAccount('1999')).toBe('fixedAsset');
    expect(classifyAccount('2000')).toBe('currentLiability');
    expect(classifyAccount('2399')).toBe('currentLiability');
    expect(classifyAccount('2400')).toBe('longTermLiability');
    expect(classifyAccount('2999')).toBe('longTermLiability');
    expect(classifyAccount('3000')).toBe('equity');
    expect(classifyAccount('3999')).toBe('equity');
    expect(classifyAccount('4000')).toBe('income');
    expect(classifyAccount('4999')).toBe('income');
    expect(classifyAccount('5000')).toBe('cogs');
    expect(classifyAccount('5999')).toBe('cogs');
    expect(classifyAccount('6000')).toBe('expense');
    expect(classifyAccount('7999')).toBe('expense');
    expect(classifyAccount('8000')).toBe('other');
  });

  it('falls back to other rather than throwing on a hand-edited chart', () => {
    // Statements must still render if someone codes an account oddly.
    expect(classifyAccount('')).toBe('other');
    expect(classifyAccount('ABC')).toBe('other');
    expect(classifyAccount('999')).toBe('other'); // below the chart
  });
});
