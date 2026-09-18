import type { CreditMemo, CreditMemoLine, CreditMemoStatus } from '../models/creditMemoModel';

const toNum = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const mapLine = (raw: any): CreditMemoLine => ({
  id: raw.id,
  itemId: raw.itemId ?? null,
  description: raw.description ?? '',
  quantity: toNum(raw.quantity),
  unitPrice: toNum(raw.unitPrice),
  taxRate: toNum(raw.taxRate),
  lineTotal: toNum(raw.lineTotal),
});

export const mapCreditMemo = (raw: any): CreditMemo => ({
  id: raw.id ?? '',
  creditMemoNumber: raw.creditMemoNumber ?? '',
  customerId: raw.customerId ?? '',
  customerName: raw.customerName ?? '',
  date: raw.date ?? '',
  originalInvoiceId: raw.originalInvoiceId ?? null,
  reason: raw.reason ?? '',
  subtotal: toNum(raw.subtotal),
  taxAmount: toNum(raw.taxAmount),
  total: toNum(raw.total),
  amountApplied: toNum(raw.amountApplied),
  balance: toNum(raw.balance),
  status: (raw.status ?? 'open') as CreditMemoStatus,
  lines: Array.isArray(raw.lines) ? raw.lines.map(mapLine) : [],
});

const arrayFrom = (payload: any): any[] => {
  const d = payload?.data ?? payload;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};

export const creditMemoListSerializer = (payload: any): CreditMemo[] => arrayFrom(payload).map(mapCreditMemo);

export const creditMemoSingleSerializer = (payload: any): CreditMemo | null => {
  const raw = payload?.data ?? payload;
  if (!raw || Array.isArray(raw) || !raw.id) return null;
  return mapCreditMemo(raw);
};
