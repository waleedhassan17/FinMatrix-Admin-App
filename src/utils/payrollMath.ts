// ═══════════════════════════════════════════════════════
// FinMatrix — Payroll arithmetic
// ═══════════════════════════════════════════════════════
// Mirrors the server's PayrollService, so the app can check an employee's pay
// before saving and date a run the way the web console does:
//
//   gross (salaried) = ANNUAL salary ÷ periods per year (52 / 26 / 12)
//   gross (hourly)   = hourly rate × hours (the server assumes 160 if none)
//   net              = gross − the fixed per-period deduction

export const PERIODS_PER_YEAR: Record<string, number> = { weekly: 52, biweekly: 26, monthly: 12 };

/** What the server assumes for an hourly employee with no hours entered. */
export const DEFAULT_HOURS = 160;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface PayProfile {
  payType: string;
  salary: number;
  hourlyRate: number;
  payFrequency: string;
}

/** One period's gross pay, as PayrollService.grossFor computes it. */
export const periodGross = (e: PayProfile, hours: number = DEFAULT_HOURS): number =>
  e.payType === 'hourly'
    ? round2(e.hourlyRate * (hours || 0))
    : round2(e.salary / (PERIODS_PER_YEAR[e.payFrequency] ?? 12));

const MONEY = /^\d+(\.\d{1,2})?$/;

/**
 * Why an employee's pay details cannot be saved, or null when they can.
 *
 * The server accepts a zero rate and a deduction larger than the pay itself —
 * the second posts NEGATIVE net pay, a credit to Cash for money never paid —
 * so both are refused here.
 */
export const validateEmployeePay = (
  e: PayProfile & { deduction: string },
): string | null => {
  const rate = e.payType === 'hourly' ? e.hourlyRate : e.salary;
  if (!(rate > 0)) {
    return e.payType === 'hourly' ? 'Enter the hourly rate.' : 'Enter the annual salary.';
  }
  const ded = (e.deduction ?? '').trim() === '' ? '0' : e.deduction.trim().replace(/,/g, '');
  if (!MONEY.test(ded)) return 'The deduction must be an amount of 0 or more.';
  const gross = periodGross(e);
  if (parseFloat(ded) > gross) {
    return `The deduction is more than one period’s gross pay (Rs ${gross.toFixed(2)}${
      e.payType === 'hourly' ? ` at ${DEFAULT_HOURS} hours` : ''
    }).`;
  }
  return null;
};

/** `YYYY-MM-DD` from the LOCAL calendar — toISOString() is UTC and reads yesterday in PKT. */
export const localIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The month containing `date` as a pay period: "September 2026", the 1st to
 * the last day, paid today.
 *
 * The label is built by hand rather than with toLocaleString, whose month
 * names depend on the device's Intl support. It must match the web console
 * exactly: the server refuses a second run for a pay period already paid by
 * comparing this string.
 */
export const payrollPeriodFor = (date: Date) => {
  const y = date.getFullYear();
  const m = date.getMonth();
  return {
    payPeriod: `${MONTH_NAMES[m]} ${y}`,
    periodStart: localIsoDate(new Date(y, m, 1)),
    periodEnd: localIsoDate(new Date(y, m + 1, 0)),
    payDate: localIsoDate(date),
  };
};
