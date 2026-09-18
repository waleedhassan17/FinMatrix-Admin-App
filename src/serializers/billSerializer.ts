// ═══════════════════════════════════════════════════════
// FinMatrix — Bill Serializer
// ═══════════════════════════════════════════════════════
// Sits BETWEEN network and slice.
// Takes the raw API envelope and returns a clean,
// UI-ready data structure with inline field mapping.
// Mirrors `glSerializer.ts`.

import type { Bill, BillLine, BillPayment, BillStatus } from '../types';
import type {
  BillApiEntity,
  BillApiLineEntity,
} from '../models/billModel';

// ─── Serialized output for the list slice ────────────
export interface SerializedBillList {
  bills: Bill[];
  page: number;
  totalPages: number;
  totalBills: number;
  // Status counts (used for tab badges)
  counts: Record<'all' | BillStatus, number>;
  totalOutstanding: number;
  overdueAmount: number;
}

// ─── Raw → UI mappers ────────────────────────────────
const mapBillLine = (raw: Partial<BillApiLineEntity>): BillLine => ({
  id: raw.id ?? '',
  accountId: raw.accountId ?? '',
  accountName: raw.accountName ?? '',
  description: raw.description ?? '',
  quantity: typeof raw.quantity === 'number' ? raw.quantity : 1,
  unitPrice: typeof raw.unitPrice === 'number' ? raw.unitPrice : 0,
  taxRate: typeof raw.taxRate === 'number' ? raw.taxRate : 0,
  amount: typeof raw.amount === 'number' ? raw.amount : 0,
});

const toNum = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

export const mapBill = (raw: Partial<BillApiEntity> & { billDate?: string; memo?: string }): Bill => ({
  id: raw.id ?? '',
  companyId: raw.companyId ?? '',
  billNumber: raw.billNumber ?? '',
  vendorId: raw.vendorId ?? '',
  vendorName: raw.vendorName ?? '',
  issueDate: (raw as any).billDate ?? raw.issueDate ?? '',
  dueDate: raw.dueDate ?? '',
  status: (raw.status as BillStatus) ?? 'draft',
  lines: Array.isArray(raw.lines) ? raw.lines.map(mapBillLine) : [],
  subtotal: toNum(raw.subtotal),
  taxAmount: toNum(raw.taxAmount),
  total: toNum(raw.total),
  amountPaid: toNum(raw.amountPaid),
  notes: (raw as any).memo ?? raw.notes ?? '',
  createdBy: raw.createdBy ?? '',
  createdAt: raw.createdAt ?? '',
  updatedAt: raw.updatedAt ?? '',
});

// ─── Envelope serializers ────────────────────────────
export function billListSerializer(payload: any): SerializedBillList {
  const data = payload?.data;
  const raw: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.bills)
      ? data.bills
      : [];
  const pagination = (data && !Array.isArray(data)) ? (data.pagination || {}) : {};
  const totals = (data && !Array.isArray(data)) ? (data.totals || {}) : {};

  const bills = raw.map(mapBill);

  // Compute counts client-side if not provided.
  const counts: Record<'all' | BillStatus, number> = totals.counts || {
    all: bills.length,
    draft: bills.filter(b => b.status === 'draft').length,
    open: bills.filter(b => b.status === 'open').length,
    partial: bills.filter(b => b.status === 'partial').length,
    paid: bills.filter(b => b.status === 'paid').length,
    overdue: bills.filter(b => b.status === 'overdue').length,
  };

  let totalOutstanding = 0;
  let overdueAmount = 0;
  bills.forEach(b => {
    if (b.status === 'open' || b.status === 'overdue' || b.status === 'partial') {
      const bal = b.total - b.amountPaid;
      totalOutstanding += bal;
      if (b.status === 'overdue') overdueAmount += bal;
    }
  });

  return {
    bills,
    page: pagination.page ?? 1,
    totalPages: pagination.totalPages ?? 1,
    totalBills: pagination.total ?? bills.length,
    counts,
    totalOutstanding: totals.totalOutstanding ?? totalOutstanding,
    overdueAmount: totals.overdueAmount ?? overdueAmount,
  };
}

export function billSingleSerializer(payload: any): Bill | null {
  const raw = payload?.data?.bill ?? (payload?.data && !Array.isArray(payload.data) ? payload.data : null);
  if (!raw) return null;
  return mapBill(raw);
}

// The API names these paymentDate / totalAmount / paymentMethod / reference;
// the UI type and the detail screen read date / amount / method /
// paymentNumber. Spreading the raw row left every field undefined, so each
// payment rendered a blank reference, `dayjs(undefined)` (today's date) and
// `Rs NaN`. Map them.
export function billPaymentsSerializer(payload: any): BillPayment[] {
  const raw = payload?.data?.payments;
  if (!Array.isArray(raw)) return [];
  return raw.map(p => ({
    ...p,
    paymentNumber: p.paymentNumber ?? p.reference ?? '',
    date: p.date ?? p.paymentDate ?? '',
    method: p.method ?? p.paymentMethod ?? '',
    amount: toNum(p.amount ?? p.totalAmount),
    reference: p.reference ?? '',
    allocations: Array.isArray(p.allocations)
      ? p.allocations.map((a: any) => ({ ...a, amount: toNum(a.amount) }))
      : [],
  }));
}
