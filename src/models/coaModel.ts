// ═══════════════════════════════════════════════════════
// FinMatrix — COA Model
// ═══════════════════════════════════════════════════════
// Defines the expected shape of the COA data used by the app.

import type { AccountType, AccountSubType } from '../types';
import { isAccountNumberInRange, getSubTypeRange } from '../utils/accountNumberUtils';

// ─── API Response Types (match backend contract) ─────

export interface COAApiAccount {
  id: string;
  companyId: string;
  code: string;
  name: string;
  type: AccountType;
  subType: AccountSubType;
  description: string;
  parentId: string | null;
  isActive: boolean;
  isSystemAccount: boolean;
  balance: number;
  normalBalance: 'debit' | 'credit';
  createdAt: string;
  updatedAt: string;
}

export interface COAApiResponse {
  success: boolean;
  data: {
    accounts: COAApiAccount[];
  };
}

export interface COAApiSingleResponse {
  success: boolean;
  data: {
    account: COAApiAccount;
  };
}

// ─── Form helpers (used by COAFormScreen) ────────────

export interface ValidationErrors {
  [key: string]: string;
}

// ── SubType options per AccountType ───────────────────
export const SUB_TYPE_OPTIONS: Record<AccountType, { label: string; value: string }[]> = {
  asset: [
    { label: 'Cash', value: 'current_asset' },
    { label: 'Bank', value: 'current_asset' },
    { label: 'Accounts Receivable', value: 'current_asset' },
    { label: 'Inventory', value: 'current_asset' },
    { label: 'Prepaid', value: 'current_asset' },
    { label: 'Fixed Asset', value: 'fixed_asset' },
    { label: 'Other Asset', value: 'current_asset' },
  ],
  liability: [
    { label: 'Accounts Payable', value: 'current_liability' },
    { label: 'Credit Card', value: 'current_liability' },
    { label: 'Payroll Liability', value: 'current_liability' },
    { label: 'Tax Payable', value: 'current_liability' },
    { label: 'Notes Payable', value: 'long_term_liability' },
    { label: 'Other Liability', value: 'current_liability' },
  ],
  equity: [
    { label: 'Owner Equity', value: 'owner_equity' },
    { label: 'Retained Earnings', value: 'retained_earnings' },
    { label: 'Owner Draws', value: 'owner_equity' },
    { label: 'Other Equity', value: 'owner_equity' },
  ],
  revenue: [
    { label: 'Sales', value: 'operating_revenue' },
    { label: 'Service', value: 'operating_revenue' },
    { label: 'Interest', value: 'other_revenue' },
    { label: 'Other Revenue', value: 'other_revenue' },
  ],
  expense: [
    { label: 'Cost of Goods', value: 'cost_of_goods' },
    { label: 'Operating', value: 'operating_expense' },
    { label: 'Payroll', value: 'operating_expense' },
    { label: 'Tax', value: 'operating_expense' },
    { label: 'Depreciation', value: 'operating_expense' },
    { label: 'Other Expense', value: 'operating_expense' },
  ],
};

export const ACCOUNT_TYPE_OPTIONS: { label: string; value: AccountType }[] = [
  { label: 'Asset', value: 'asset' },
  { label: 'Liability', value: 'liability' },
  { label: 'Equity', value: 'equity' },
  { label: 'Revenue', value: 'revenue' },
  { label: 'Expense', value: 'expense' },
];

export interface COAFormData {
  code: string;
  name: string;
  type: string;
  subTypeLabel: string;
  parentId: string;
  description: string;
  openingBalance: string;
  isActive: boolean;
}

export const validateAccount = (
  data: COAFormData,
  existingCodes: string[],
  editingId?: string,
): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Account Number
  if (!data.code.trim()) {
    errors.code = 'Account number is required';
  } else if (
    existingCodes.includes(data.code.trim()) &&
    !editingId
  ) {
    errors.code = 'Account number already exists';
  } else if (data.type && !/^\d+$/.test(data.code.trim())) {
    errors.code = 'Account number must be numeric';
  } else if (data.type && data.code.trim()) {
    // Validate the code falls within the allowed range for its type/sub-type
    const inRange = isAccountNumberInRange(
      data.code.trim(),
      data.type as AccountType,
      data.subTypeLabel || undefined,
    );
    if (!inRange) {
      const [min, max] = getSubTypeRange(
        data.type as AccountType,
        data.subTypeLabel || undefined,
      );
      errors.code = `Must be between ${min} and ${max} for this category`;
    }
  }

  // Name
  if (!data.name.trim()) {
    errors.name = 'Account name is required';
  } else if (data.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters';
  }

  // Type
  if (!data.type) {
    errors.type = 'Account type is required';
  }

  // SubType
  if (!data.subTypeLabel) {
    errors.subTypeLabel = 'Sub type is required';
  }

  // Opening balance (if provided must be numeric)
  if (data.openingBalance.trim()) {
    const cleaned = data.openingBalance.replace(/[$,\s]/g, '');
    if (isNaN(Number(cleaned))) {
      errors.openingBalance = 'Enter a valid number';
    }
  }

  return errors;
};

// NOTE: the old static `chartOfAccountsData` array was removed — the chart of
// accounts is backend-driven. Screens must fetch via coaListSlice.fetchAccounts.
