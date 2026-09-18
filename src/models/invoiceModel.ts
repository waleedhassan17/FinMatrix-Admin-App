// ═══════════════════════════════════════════════════════
// FinMatrix — Invoice Model
// ═══════════════════════════════════════════════════════
// Defines the expected shape of the Invoice data as it is
// received from the (dummy) backend API. This is the raw
// wire-format; the serializer converts it to the UI-ready
// `Invoice` type in src/types.

import type { DiscountType, InvoiceStatus } from '../types';

// ─── Raw API line item ───────────────────────────────
export interface InvoiceApiLine {
  id: string;
  itemId: string;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

// ─── Raw API invoice entity ──────────────────────────
export interface InvoiceApiEntity {
  id: string;
  companyId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  lines: InvoiceApiLine[];
  subtotal: number;
  taxAmount: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Optional delivery metadata tracked when we share the
  // invoice (e.g. via WhatsApp). Backend-agnostic.
  sentAt?: string;
  sentChannel?: 'whatsapp' | 'email' | 'share' | null;
  sentToPhone?: string;
}

// ─── Pagination envelope ─────────────────────────────
export interface InvoiceApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Query params (mirrors what the real backend accepts) ───
export interface InvoiceQueryParams {
  search?: string;
  status?: InvoiceStatus | 'all';
  customerId?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}
