// Validation for a typed tax percentage, matching the server's @IsTaxRate:
// a number from 0 to 100 with at most 4 decimals. Tax is typed on every
// document line, so this is the client's only guard on the value.

/** An error message for a rate the server would refuse, or null. Blank is fine. */
export const taxRateError = (value: string): string | null => {
  const v = value.trim();
  if (v === '') return null;
  if (!/^\d{1,3}(\.\d{1,4})?$/.test(v)) return 'Enter a percentage, e.g. 17 or 12.5';
  return parseFloat(v) > 100 ? 'Tax cannot exceed 100%' : null;
};

/** The first line whose tax the server would refuse, as a form message, or null. */
export const lineTaxError = (lines: ReadonlyArray<{ taxRate?: string }>): string | null => {
  for (let i = 0; i < lines.length; i++) {
    const error = taxRateError(lines[i].taxRate ?? '');
    if (error) return `Line ${i + 1}: ${error}`;
  }
  return null;
};
