// ═══════════════════════════════════════════════════════
// FinMatrix — Intelligent Account Number Utilities
// ═══════════════════════════════════════════════════════
// Industry-standard numbering aligned with QuickBooks &
// Peachtree (Sage 50). First digit identifies the type:
//   1=Assets  2=Liabilities  3=Equity  4=Revenue
//   5=COGS   6=Expenses      7=Other Expenses
// Configurable ranges — add new entries to extend.

import type { Account, AccountType } from '../types';

// ─── Type-Level Ranges (QuickBooks / Peachtree) ──────
// Standard first-digit convention used by QB, Sage 50,
// Xero, and most industry accounting software.
export const ACCOUNT_TYPE_RANGES: Record<AccountType, [number, number]> = {
  asset:     [1000, 1999],   // 1xxx — Assets
  liability: [2000, 2999],   // 2xxx — Liabilities
  equity:    [3000, 3999],   // 3xxx — Equity
  revenue:   [4000, 4999],   // 4xxx — Revenue / Income
  expense:   [5000, 7999],   // 5xxx COGS, 6xxx Operating, 7xxx Other
};

// Full system range across all types
const GLOBAL_RANGE: [number, number] = [1000, 7999];

// ─── Sub-Type Label Ranges ───────────────────────────
// Matches QuickBooks & Peachtree sub-category numbering.
// Keyed by "type::label" — add new entries to extend.
export const SUB_TYPE_LABEL_RANGES: Record<string, [number, number]> = {
  // ── Assets 1xxx (QB: Cash & Bank 10xx, AR 11xx, Other Current 12xx–14xx, Fixed 15xx–17xx, Other 18xx–19xx) ──
  'asset::Cash':                 [1000, 1099],
  'asset::Bank':                 [1100, 1199],
  'asset::Accounts Receivable':  [1200, 1299],
  'asset::Inventory':            [1300, 1399],
  'asset::Prepaid':              [1400, 1499],
  'asset::Fixed Asset':          [1500, 1799],
  'asset::Other Asset':          [1800, 1999],

  // ── Liabilities 2xxx (QB: AP 20xx, CC 21xx, Other Current 22xx–24xx, Long-term 25xx–29xx) ──
  'liability::Accounts Payable': [2000, 2099],
  'liability::Credit Card':      [2100, 2199],
  'liability::Payroll Liability':[2200, 2399],
  'liability::Tax Payable':      [2400, 2499],
  'liability::Notes Payable':    [2500, 2799],
  'liability::Other Liability':  [2800, 2999],

  // ── Equity 3xxx (QB: Owner's Equity 30xx, Retained Earnings 31xx, Draws 32xx, Other 33xx–39xx) ──
  'equity::Owner Equity':        [3000, 3099],
  'equity::Retained Earnings':   [3100, 3199],
  'equity::Owner Draws':         [3200, 3299],
  'equity::Other Equity':        [3300, 3999],

  // ── Revenue 4xxx (QB: Sales 40xx–42xx, Service 43xx–44xx, Other Revenue 45xx–49xx) ──
  'revenue::Sales':              [4000, 4299],
  'revenue::Service':            [4300, 4499],
  'revenue::Interest':           [4500, 4599],
  'revenue::Other Revenue':      [4600, 4999],

  // ── COGS 5xxx (QB: Cost of Goods Sold 50xx–59xx) ───
  'expense::Cost of Goods':      [5000, 5999],

  // ── Operating Expenses 6xxx ────────────────────────
  // In QuickBooks & Peachtree, the entire 6xxx block is
  // operating expenses. Sub-labels (Payroll, Tax, etc.)
  // share the same range — differentiation is by name,
  // not by number. This matches production QB behavior.
  'expense::Operating':          [6000, 6999],
  'expense::Payroll':            [6000, 6999],
  'expense::Tax':                [6000, 6999],
  'expense::Depreciation':       [6000, 6999],

  // ── Other Expenses 7xxx ────────────────────────────
  'expense::Other Expense':      [7000, 7999],
};

// ─── getAccountRange ─────────────────────────────────
// Returns the [min, max] range for a given account type.
export const getAccountRange = (
  type: AccountType,
): [number, number] => {
  return ACCOUNT_TYPE_RANGES[type] ?? [1000, 9999];
};

// ─── getSubTypeRange ─────────────────────────────────
// Returns the [min, max] range for a type + sub-type label.
// Falls back to the type-level range if no label match.
export const getSubTypeRange = (
  type: AccountType,
  subTypeLabel?: string,
): [number, number] => {
  if (subTypeLabel) {
    const key = `${type}::${subTypeLabel}`;
    const labelRange = SUB_TYPE_LABEL_RANGES[key];
    if (labelRange) return labelRange;
  }
  return getAccountRange(type);
};

// ─── getNextAvailableAccountNumber ───────────────────
// Scans existing accounts, finds all codes within the
// target range, and returns the next available number.
// Increments by 10 for clean spacing between accounts.
export const getNextAvailableAccountNumber = (
  type: AccountType,
  subTypeLabel: string | undefined,
  accounts: Account[],
): string => {
  const [min, max] = getSubTypeRange(type, subTypeLabel);

  // Collect existing codes that fall within the range
  const usedNumbers = accounts
    .map(a => parseInt(a.code, 10))
    .filter(n => !isNaN(n) && n >= min && n <= max)
    .sort((a, b) => a - b);

  // If no accounts exist in this range, start at the range minimum
  if (usedNumbers.length === 0) {
    return min.toString();
  }

  // Try incrementing from the highest used number by 10
  const candidate = usedNumbers[usedNumbers.length - 1] + 10;
  if (candidate <= max) {
    return candidate.toString();
  }

  // Range is tight — find the first gap
  for (let n = min; n <= max; n++) {
    if (!usedNumbers.includes(n)) {
      return n.toString();
    }
  }

  // Range fully exhausted (unlikely) — return max as a signal
  return max.toString();
};

// ─── isAccountNumberInRange ──────────────────────────
// Validates whether a given code falls within the allowed
// range for the specified type + sub-type label.
export const isAccountNumberInRange = (
  code: string,
  type: AccountType,
  subTypeLabel?: string,
): boolean => {
  const num = parseInt(code, 10);
  if (isNaN(num)) return false;
  const [min, max] = getSubTypeRange(type, subTypeLabel);
  return num >= min && num <= max;
};

// ─── getNearestValidNumber ───────────────────────────
// Clamps a manually entered number to the nearest valid
// value within the allowed range.
export const getNearestValidNumber = (
  code: string,
  type: AccountType,
  subTypeLabel?: string,
): string => {
  const num = parseInt(code, 10);
  if (isNaN(num)) {
    // Not a number — return range start
    const [min] = getSubTypeRange(type, subTypeLabel);
    return min.toString();
  }
  const [min, max] = getSubTypeRange(type, subTypeLabel);
  return Math.min(Math.max(num, min), max).toString();
};

// ─── getRangeDisplayText ─────────────────────────────
// Returns a human-readable description of the current range
// for use as helper text in the UI.
export const getRangeDisplayText = (
  type: AccountType,
  subTypeLabel?: string,
): string => {
  const [min, max] = getSubTypeRange(type, subTypeLabel);
  return `Valid range: ${min}–${max}`;
};

// ─── getAvailableAccountNumbers ──────────────────────
// Returns a list of candidate account numbers (as dropdown
// options) within the range, excluding already-used codes.
// Generates numbers in increments of 10 for clean spacing.
export const getAvailableAccountNumbers = (
  type: AccountType,
  subTypeLabel: string | undefined,
  accounts: Account[],
  limit: number = 20,
): { label: string; value: string }[] => {
  const [min, max] = getSubTypeRange(type, subTypeLabel);
  return generateOptionsInRange(min, max, accounts, limit);
};

// ─── getAllAvailableAccountNumbers ────────────────────
// Returns candidate numbers across ALL types (1000–7999).
// Used when no account type has been selected yet.
export const getAllAvailableAccountNumbers = (
  accounts: Account[],
  limit: number = 30,
): { label: string; value: string }[] => {
  const [min, max] = GLOBAL_RANGE;
  return generateOptionsInRange(min, max, accounts, limit);
};

// ─── Internal: generate options within a range ───────
const generateOptionsInRange = (
  min: number,
  max: number,
  accounts: Account[],
  limit: number,
): { label: string; value: string }[] => {
  const usedSet = new Set(
    accounts
      .map(a => parseInt(a.code, 10))
      .filter(n => !isNaN(n)),
  );

  const options: { label: string; value: string }[] = [];

  // Generate candidates in increments of 10 starting from range min
  for (let n = min; n <= max && options.length < limit; n += 10) {
    if (!usedSet.has(n)) {
      options.push({ label: n.toString(), value: n.toString() });
    }
  }

  // If we got fewer than desired (e.g. many x0 slots taken), fill gaps
  if (options.length < limit) {
    for (let n = min; n <= max && options.length < limit; n++) {
      if (!usedSet.has(n) && n % 10 !== 0) {
        options.push({ label: n.toString(), value: n.toString() });
      }
    }
    options.sort((a, b) => parseInt(a.value, 10) - parseInt(b.value, 10));
  }

  return options;
};
