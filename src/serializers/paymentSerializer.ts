// ═══════════════════════════════════════════════════════
// FinMatrix — Payment Serializer
// ═══════════════════════════════════════════════════════
// Sits BETWEEN network and slice. Maps the backend Payment
// entity (paymentDate / paymentMethod / memo …) onto the
// UI-facing `Payment` shape used by the invoice detail and
// payment-history screens.

import type { Payment, PaymentAllocation, PaymentMethod } from '../types';

const toNum = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

/**
 * Reverse of the slice's `toBackendPaymentMethod`.
 *
 * Exported because reviewing a staff payment request has to run it the same
 * way: the stored payload holds the API's vocabulary, and an unmapped value
 * must land on something the dropdown can show rather than leaving it blank.
 */
export function toUiPaymentMethod(method: string): PaymentMethod {
  switch (method) {
    case 'check':
      return 'cheque';
    case 'other':
    case 'credit_card':
      return 'online';
    case 'cash':
    case 'bank_transfer':
      return method;
    default:
      return 'online';
  }
}

export const mapPayment = (raw: any): Payment => {
  const applications: PaymentAllocation[] = Array.isArray(raw?.applications)
    ? raw.applications.map((a: any) => ({
        invoiceId: a.invoiceId ?? '',
        invoiceNumber: a.invoiceNumber ?? '',
        amount: toNum(a.amountApplied ?? a.amount),
        invoiceBalance: a.invoiceBalance == null ? null : toNum(a.invoiceBalance),
      }))
    : [];

  const allocated = applications.reduce((s, a) => s + a.amount, 0);
  const amount = toNum(raw?.amount);

  return {
    id: raw?.id ?? '',
    companyId: raw?.companyId ?? '',
    // Receipts are numbered RCT-YYYY-NNNN by the server. The reference and
    // id fallbacks only cover responses from before that numbering existed.
    paymentNumber:
      raw?.paymentNumber || raw?.reference || (raw?.id ? `PAY-${String(raw.id).slice(0, 8)}` : ''),
    customerId: raw?.customerId ?? '',
    customerName: raw?.customerName ?? '',
    date: raw?.date ?? raw?.paymentDate ?? '',
    method: toUiPaymentMethod(raw?.method ?? raw?.paymentMethod ?? ''),
    reference: raw?.reference ?? '',
    amount,
    allocations: applications,
    // Held as a customer advance until applied to an invoice.
    creditAmount:
      raw?.unapplied != null
        ? Math.max(0, Math.round(toNum(raw.unapplied) * 100) / 100)
        : Math.max(0, Math.round((amount - allocated) * 100) / 100),
    notes: raw?.memo ?? raw?.notes ?? '',
    createdBy: raw?.createdBy ?? '',
    createdAt: raw?.createdAt ?? '',
    updatedAt: raw?.updatedAt ?? '',
  };
};

/** Accepts the raw list envelope ({ data: [...] } or a bare array). */
export function paymentListSerializer(payload: any): Payment[] {
  const data = payload?.data ?? payload;
  const raw: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : [];
  return raw.map(mapPayment);
}

/** A receipt still holding money the customer paid in advance. */
export interface CustomerAdvance {
  paymentId: string;
  paymentNumber: string;
  paymentDate: string;
  unapplied: number;
}

/** GET /payments/customer/:id/advances — a bare array or `{ data }`. */
export function customerAdvancesSerializer(payload: any): CustomerAdvance[] {
  const data = payload?.data ?? payload;
  const raw: any[] = Array.isArray(data) ? data : [];
  return raw
    .map(r => ({
      paymentId: r?.paymentId ?? '',
      paymentNumber: r?.paymentNumber ?? '',
      paymentDate: r?.paymentDate ?? '',
      unapplied: Math.round(toNum(r?.unapplied) * 100) / 100,
    }))
    .filter(a => a.paymentId && a.unapplied > 0.004);
}
