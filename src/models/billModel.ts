// ═══════════════════════════════════════════════════════
// FinMatrix — Bill Model & Validation
// ═══════════════════════════════════════════════════════
// Mirrors `glModel.ts`:
//   • API entity types describing the raw backend shape
//   • Pagination envelope
//   • Query params for the list endpoint
// Plus the existing form-validation helpers used by the form screen.

import type { Bill, BillLine, BillStatus } from '../types';
import { txnStatusColor } from '../components/transactions/txnStatus';

// ─── Raw API entity (backend shape) ──────────────────
// 1-to-1 with the `Bill` UI type today; defined separately so
// future backend-only fields can be added without leaking into UI.
export interface BillApiLineEntity {
  id: string;
  accountId: string;
  accountName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

export interface BillApiEntity {
  id: string;
  companyId: string;
  billNumber: string;
  vendorId: string;
  vendorName: string;
  issueDate: string;
  dueDate: string;
  status: BillStatus;
  lines: BillApiLineEntity[];
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Pagination envelope ─────────────────────────────
export interface BillApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Query params for list endpoint ──────────────────
export interface BillQueryParams {
  search?: string;
  status?: 'all' | BillStatus;
  vendorId?: string;
  page?: number;
  limit?: number;
}

// ─── Re-export the canonical UI types for convenience ─
export type { Bill, BillLine };

export interface ValidationErrors {
  [key: string]: string;
}

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  partial: 'Partially Paid',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

/** Presentation-only: resolved from the canonical stack-wide status palette. */
export const BILL_STATUS_COLORS: Record<BillStatus, string> = {
  draft: txnStatusColor('draft'),
  open: txnStatusColor('open'),
  partial: txnStatusColor('partial'),
  paid: txnStatusColor('paid'),
  overdue: txnStatusColor('overdue'),
  void: txnStatusColor('void'),
};

export interface BillFormLineData {
  id: string;
  accountId: string;
  accountName: string;
  description: string;
  amount: string;
  taxRate: string;
}

export interface BillFormData {
  billNumber: string;
  vendorId: string;
  vendorName: string;
  issueDate: string;
  dueDate: string;
  notes: string;
  lines: BillFormLineData[];
}

export const validateBill = (data: BillFormData): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (!data.vendorId) errors.vendorId = 'Select a vendor';
  if (!data.billNumber.trim()) errors.billNumber = 'Bill number is required';
  if (!data.issueDate) errors.issueDate = 'Issue date is required';
  if (!data.dueDate) errors.dueDate = 'Due date is required';

  if (data.lines.length === 0) {
    errors.lines = 'At least one line item is required';
  }

  const hasEmptyLine = data.lines.some(
    l => !l.accountId || !(parseFloat(l.amount) > 0),
  );
  if (hasEmptyLine) errors.lines = 'All line items must have an account and amount';

  return errors;
};
