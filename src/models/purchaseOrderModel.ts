// ═══════════════════════════════════════════════════════
// FinMatrix — Purchase Order Model & Validation
// ═══════════════════════════════════════════════════════
// Mirrors `billModel.ts` / `glModel.ts`:
//   • API entity types describing the raw backend shape
//   • Pagination envelope
//   • Query params for the list endpoint
// Plus the existing form-validation helpers used by the form screen.

import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from '../types';
import { formatDate } from '../utils/formatters';
import { txnStatusColor } from '../components/transactions/txnStatus';

// ─── Raw API entity (backend shape) ──────────────────
// These mirror what `/purchase-orders` ACTUALLY returns, verified against the
// live API. Two things differ from the UI types and used to be mis-declared
// here, which made every PO render as zero:
//   • decimals arrive as STRINGS ('40.0000') — TypeORM numeric columns
//   • lines use orderedQty / receivedQty / unitCost / lineTotal, and carry no
//     itemName (resolve it from inventory) and no vendorName on the detail
export interface PurchaseOrderApiLineEntity {
  id: string;
  orderId: string;
  itemId: string | null;
  accountId: string | null;
  description: string;
  orderedQty: string;
  receivedQty: string;
  billedQty?: string;
  unitCost: string;
  taxRate: string;
  lineTotal: string;
  lineOrder: number;
}

export interface PurchaseOrderApiEntity {
  id: string;
  companyId: string;
  poNumber: string;
  vendorId: string;
  vendorName?: string;
  orderDate: string;
  expectedDate: string | null;
  status: ApiPOStatus;
  lines: PurchaseOrderApiLineEntity[];
  subtotal: string;
  taxAmount: string;
  total: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Set by GET /purchase-orders/:id when this PO has been converted. */
  billId?: string | null;
  billNumber?: string | null;
  /** Every bill raised from this PO (a PO is billed per receipt). */
  bills?: Array<{
    id: string;
    billNumber: string;
    billDate: string;
    total: string;
    balance: string;
    status: string;
  }>;
  /** Tax-inclusive, comparable with `total`. */
  receivedValueGross?: string;
  billedValueGross?: string;
  unbilledValueGross?: string;
}

// ─── Status vocabulary ───────────────────────────────
// The API and the UI name two of these differently, and the column is
// varchar(16) — sending 'partially_received' (18 chars) is a Postgres 22001,
// i.e. a 500. Always translate at the boundary, never pass through.
export type ApiPOStatus = 'draft' | 'sent' | 'partial' | 'received' | 'closed';

export const toApiPOStatus = (status: PurchaseOrderStatus | 'all'): ApiPOStatus | undefined => {
  if (status === 'all') return undefined;
  if (status === 'partially_received') return 'partial';
  if (status === 'fully_received') return 'received';
  return status;
};

export const fromApiPOStatus = (raw: string | undefined | null): PurchaseOrderStatus => {
  if (raw === 'partial') return 'partially_received';
  if (raw === 'received') return 'fully_received';
  if (raw === 'draft' || raw === 'sent' || raw === 'closed') return raw;
  return 'draft';
};

// ─── Pagination envelope ─────────────────────────────
export interface PurchaseOrderApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Query params for list endpoint ──────────────────
export interface PurchaseOrderQueryParams {
  search?: string;
  status?: 'all' | PurchaseOrderStatus;
  vendorId?: string;
  page?: number;
  limit?: number;
}

// ─── Re-export the canonical UI types for convenience ─
export type { PurchaseOrder, PurchaseOrderLine };

/** `expectedDate` is nullable on the API and lands here as '', which dayjs
 *  renders as the literal string "Invalid Date". */
export const formatPODate = (value: string | null | undefined): string =>
  value ? formatDate(value) : '—';

export const PO_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: 'Requisition',
  sent: 'Sent',
  partially_received: 'Partially Received',
  fully_received: 'Fully Received',
  closed: 'Closed',
};

/** Presentation-only: resolved from the canonical stack-wide status palette. */
export const PO_STATUS_COLORS: Record<PurchaseOrderStatus, string> = {
  draft: txnStatusColor('draft'),
  sent: txnStatusColor('sent'),
  partially_received: txnStatusColor('partially_received'),
  fully_received: txnStatusColor('fully_received'),
  closed: txnStatusColor('closed'),
};

export interface POFormLineData {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: number;
}

export interface POFormData {
  vendorId: string;
  vendorName: string;
  poNumber: string;
  orderDate: string;
  expectedDate: string;
  notes: string;
  lines: POFormLineData[];
}

export const freshPOLine = (id: string): POFormLineData => ({
  id,
  itemId: '',
  itemName: '',
  description: '',
  quantity: '',
  unitPrice: '',
  amount: 0,
});

export const validatePO = (data: POFormData): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (!data.vendorId) errors.vendorId = 'Vendor is required';
  if (!data.orderDate) errors.orderDate = 'Order date is required';
  if (!data.expectedDate) errors.expectedDate = 'Expected date is required';
  const validLines = data.lines.filter(
    l => l.itemId && parseFloat(l.quantity) > 0 && parseFloat(l.unitPrice) > 0,
  );
  if (validLines.length === 0) errors.lines = 'At least one valid line item is required';
  return errors;
};
