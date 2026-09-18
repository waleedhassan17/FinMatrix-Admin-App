// ═══════════════════════════════════════════════════════
// FinMatrix — typed tax rate
// ═══════════════════════════════════════════════════════
// Tax is typed on every document line, not picked from 0/5/10/17, so this is
// the client's only guard before the server's @IsTaxRate refuses the save.

import { lineTaxError, taxRateError } from '../taxRate';

describe('taxRateError', () => {
  it.each(['', '0', '5', '12.5', '17', '17.25', '100', '0.0001'])('accepts "%s"', rate => {
    expect(taxRateError(rate)).toBeNull();
  });

  it.each(['-1', '100.01', '150', '1000', '1.23456', '17%', 'abc', '.5'])('refuses "%s"', rate => {
    expect(taxRateError(rate)).not.toBeNull();
  });
});

describe('lineTaxError', () => {
  it('names the first line with an impossible rate', () => {
    expect(lineTaxError([{ taxRate: '12.5' }, { taxRate: '150' }, { taxRate: '-1' }])).toBe(
      'Line 2: Tax cannot exceed 100%',
    );
  });

  it('passes when every rate is valid, including blank', () => {
    expect(lineTaxError([{ taxRate: '18' }, { taxRate: '' }, {}])).toBeNull();
  });
});
