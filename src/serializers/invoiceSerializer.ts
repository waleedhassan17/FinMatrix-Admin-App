// ═══════════════════════════════════════════════════════
// FinMatrix — Invoice Serializer
// ═══════════════════════════════════════════════════════
// Sits BETWEEN network and slice.
// Takes the raw API envelope ({ success, data: { ... } })
// and returns a clean, UI-ready data structure.

import type {
  DiscountType,
  Invoice,
  InvoiceLine,
  InvoiceStatus,
} from '../types';
import type { InvoiceApiEntity, InvoiceApiLine } from '../models/invoiceModel';

// ─── Output shapes for the slice ─────────────────────

export interface SerializedInvoiceList {
  invoices: Invoice[];
  page: number;
  totalPages: number;
  totalInvoices: number;
}

// ─── Helpers ──────────────────────────────────────────
const toNum = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

// ─── Raw → UI mappers ────────────────────────────────

export const mapInvoiceLine = (raw: any): InvoiceLine => ({
  id: raw.id ?? '',
  itemId: raw.itemId ?? raw.inventoryItemId ?? '',
  itemName: raw.itemName ?? raw.description ?? '',
  description: raw.description ?? '',
  quantity: toNum(raw.quantity),
  unitPrice: toNum(raw.unitPrice),
  taxRate: toNum(raw.taxRate),
  amount: toNum(raw.amount ?? raw.lineTotal),
});

export const mapInvoice = (raw: any): Invoice => ({
  id: raw.id ?? '',
  companyId: raw.companyId ?? '',
  invoiceNumber: raw.invoiceNumber ?? '',
  customerId: raw.customerId ?? '',
  customerName: raw.customerName ?? raw.customer?.name ?? '',
  issueDate: raw.issueDate ?? raw.invoiceDate ?? '',
  dueDate: raw.dueDate ?? '',
  status: (raw.status ?? 'draft') as InvoiceStatus,
  lines: Array.isArray(raw.lines) ? raw.lines.map(mapInvoiceLine) : Array.isArray(raw.items) ? raw.items.map(mapInvoiceLine) : [],
  subtotal: toNum(raw.subtotal),
  taxAmount: toNum(raw.taxAmount),
  discountType: (raw.discountType ?? 'none') as DiscountType,
  discountValue: toNum(raw.discountValue),
  discountAmount: toNum(raw.discountAmount),
  total: toNum(raw.total),
  amountPaid: toNum(raw.amountPaid),
  notes: raw.notes ?? '',
  createdBy: raw.createdBy ?? '',
  createdAt: raw.createdAt ?? '',
  updatedAt: raw.updatedAt ?? '',
});

// ─── Envelope serializers ────────────────────────────

export function invoiceListSerializer(payload: any): SerializedInvoiceList {
  const data = payload?.data;
  // Backend returns flat array: { success: true, data: [...] }
  // Also support nested: { data: { invoices: [...], pagination: {...} } }
  const raw: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.invoices)
      ? data.invoices
      : [];
  const pagination = (data && !Array.isArray(data)) ? (data.pagination || {}) : {};

  return {
    invoices: raw.map(mapInvoice),
    page: pagination.page ?? 1,
    totalPages: pagination.totalPages ?? 1,
    totalInvoices: pagination.total ?? raw.length,
  };
}

export function invoiceSingleSerializer(payload: any): Invoice | null {
  // Support both { data: { invoice: {...} } } and { data: {...} }
  const raw = payload?.data?.invoice ?? payload?.data;
  if (!raw || Array.isArray(raw)) return null;
  return mapInvoice(raw);
}
