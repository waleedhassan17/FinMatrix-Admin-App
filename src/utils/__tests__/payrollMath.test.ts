import {
  DEFAULT_HOURS,
  localIsoDate,
  payrollPeriodFor,
  periodGross,
  validateEmployeePay,
} from '../payrollMath';

const salaried = { payType: 'salary', salary: 1200000, hourlyRate: 0, payFrequency: 'monthly' };
const hourly = { payType: 'hourly', salary: 0, hourlyRate: 500, payFrequency: 'monthly' };

describe('periodGross (mirrors PayrollService)', () => {
  it('divides an ANNUAL salary by the periods in a year', () => {
    expect(periodGross(salaried)).toBe(100000);
    expect(periodGross({ ...salaried, payFrequency: 'weekly' })).toBe(23076.92);
    expect(periodGross({ ...salaried, payFrequency: 'biweekly' })).toBe(46153.85);
  });

  it('multiplies the hourly rate by hours, defaulting to 160', () => {
    expect(DEFAULT_HOURS).toBe(160);
    expect(periodGross(hourly)).toBe(80000);
    expect(periodGross(hourly, 100)).toBe(50000);
  });
});

describe('validateEmployeePay', () => {
  it('accepts a sensible salary and deduction', () => {
    expect(validateEmployeePay({ ...salaried, deduction: '5000' })).toBeNull();
    expect(validateEmployeePay({ ...salaried, deduction: '' })).toBeNull();
  });

  it('refuses a zero rate', () => {
    expect(validateEmployeePay({ ...salaried, salary: 0, deduction: '0' })).toMatch(/annual salary/);
    expect(validateEmployeePay({ ...hourly, hourlyRate: 0, deduction: '0' })).toMatch(/hourly rate/);
  });

  it('refuses a deduction larger than a period’s gross — negative net pay', () => {
    expect(validateEmployeePay({ ...salaried, deduction: '100000.01' })).toMatch(/more than one period/);
    expect(validateEmployeePay({ ...salaried, deduction: '100000' })).toBeNull();
    expect(validateEmployeePay({ ...salaried, deduction: 'abc' })).toMatch(/amount of 0 or more/);
  });
});

describe('payroll period dates', () => {
  it('uses the local calendar, not UTC', () => {
    // 00:30 local on 1 October: toISOString() would say 30 September in PKT.
    const justAfterMidnight = new Date(2026, 9, 1, 0, 30);
    expect(localIsoDate(justAfterMidnight)).toBe('2026-10-01');
  });

  it('builds the month period with a stable label matching the web console', () => {
    expect(payrollPeriodFor(new Date(2026, 8, 11, 23, 50))).toEqual({
      payPeriod: 'September 2026',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      payDate: '2026-09-11',
    });
    expect(payrollPeriodFor(new Date(2028, 1, 29)).periodEnd).toBe('2028-02-29');
  });
});
