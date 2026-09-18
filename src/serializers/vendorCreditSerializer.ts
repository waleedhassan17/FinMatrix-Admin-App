import type { VendorCredit, VendorCreditLine, VendorCreditStatus } from '../models/vendorCreditModel';

const toNum = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const mapLine = (raw: any): VendorCreditLine => ({
  id: raw.id,
  accountId: raw.accountId ?? '',
  itemId: raw.itemId ?? '',
  quantity: toNum(raw.quantity),
  description: raw.description ?? '',
  amount: toNum(raw.amount),
  taxRate: toNum(raw.taxRate),
});

export const mapVendorCredit = (raw: any): VendorCredit => ({
  id: raw.id ?? '',
  vendorCreditNumber: raw.vendorCreditNumber ?? '',
  vendorId: raw.vendorId ?? '',
  vendorName: raw.vendorName ?? '',
  date: raw.date ?? '',
  originalBillId: raw.originalBillId ?? null,
  reason: raw.reason ?? '',
  // subtotal + taxAmount = total. The tax is input tax being reversed out of
  // Sales Tax Recoverable (1300), so it is real money the supplier owes back,
  // not a presentational figure — the detail screen has to show all three or
  // the credit cannot be reconciled to the supplier's own credit note.
  subtotal: toNum(raw.subtotal),
  taxAmount: toNum(raw.taxAmount),
  total: toNum(raw.total),
  amountApplied: toNum(raw.amountApplied),
  balance: toNum(raw.balance),
  status: (raw.status ?? 'open') as VendorCreditStatus,
  lines: Array.isArray(raw.lines) ? raw.lines.map(mapLine) : [],
});

const arrayFrom = (payload: any): any[] => {
  const d = payload?.data ?? payload;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};

export const vendorCreditListSerializer = (payload: any): VendorCredit[] => arrayFrom(payload).map(mapVendorCredit);

export const vendorCreditSingleSerializer = (payload: any): VendorCredit | null => {
  const raw = payload?.data ?? payload;
  if (!raw || Array.isArray(raw) || !raw.id) return null;
  return mapVendorCredit(raw);
};
