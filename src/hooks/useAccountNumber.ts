// ═══════════════════════════════════════════════════════
// FinMatrix — useAccountNumber Hook
// ═══════════════════════════════════════════════════════
// Provides dropdown options, range validation, and helper
// text for the Account Number field in the COA form.
// Auto-fill is handled synchronously by the form handlers.

import { useMemo } from 'react';
import type { AccountType, Account } from '../types';
import {
  getSubTypeRange,
  getAvailableAccountNumbers,
  getAllAvailableAccountNumbers,
  isAccountNumberInRange,
  getRangeDisplayText,
} from '../utils/accountNumberUtils';

interface UseAccountNumberProps {
  type: string;               // AccountType or empty string
  subTypeLabel: string;       // Human-readable sub-type label
  currentCode: string;        // Current value of the code field
  accounts: Account[];        // All existing accounts
}

interface UseAccountNumberReturn {
  /** Dropdown options of available account numbers */
  codeOptions: { label: string; value: string }[];
  /** Human-readable range for helper text */
  rangeText: string;
  /** Validation error if code is outside allowed range (empty string = valid) */
  rangeError: string;
}

export const useAccountNumber = ({
  type,
  subTypeLabel,
  currentCode,
  accounts,
}: UseAccountNumberProps): UseAccountNumberReturn => {
  // ── Dropdown options ──────────────────────────────
  // When type is selected → show numbers in that type/subtype range
  // When no type selected → show numbers across all types (1000–7999)
  const codeOptions = useMemo(() => {
    if (!type) {
      return getAllAvailableAccountNumbers(accounts);
    }
    return getAvailableAccountNumbers(
      type as AccountType,
      subTypeLabel || undefined,
      accounts,
    );
  }, [type, subTypeLabel, accounts]);

  // ── Range text for helper display ─────────────────
  const rangeText = type
    ? getRangeDisplayText(type as AccountType, subTypeLabel || undefined)
    : 'Select account type to narrow the range';

  // ── Range validation ──────────────────────────────
  // Only validate when a type is selected — if no type yet, any number is fine
  let rangeError = '';
  if (type && currentCode) {
    const valid = isAccountNumberInRange(
      currentCode,
      type as AccountType,
      subTypeLabel || undefined,
    );
    if (!valid) {
      const [min, max] = getSubTypeRange(type as AccountType, subTypeLabel || undefined);
      rangeError = `Account number must be between ${min} and ${max}`;
    }
  }

  return { codeOptions, rangeText, rangeError };
};
