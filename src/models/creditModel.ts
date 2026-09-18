// ═══════════════════════════════════════════════════════
// FinMatrix — Customer credit limit
// ═══════════════════════════════════════════════════════
// A sale that would take a customer past their credit limit is refused by the
// server with 422 CREDIT_LIMIT_EXCEEDED and this breakdown in error.details.
// The way forward: take an advance of at least the excess, or (owner only)
// let it through with a reason, which the server audits.

export interface CreditAssessment {
  customerId: string;
  customerName: string;
  limit: number;
  openInvoices: number;
  inTransit: number;
  shippedNotInvoiced: number;
  advances: number;
  credits: number;
  thisAmount: number;
  exposure: number;
  excess: number;
  requiredAdvance: number;
}

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

export const CREDIT_LIMIT_EXCEEDED = 'CREDIT_LIMIT_EXCEEDED';

/** The breakdown off a refused request, or null when it is some other error. */
export function creditAssessmentFrom(error: any): CreditAssessment | null {
  if (error?.code !== CREDIT_LIMIT_EXCEEDED || !error?.details) return null;
  const d = error.details;
  return {
    customerId: d.customerId ?? '',
    customerName: d.customerName ?? '',
    limit: num(d.limit),
    openInvoices: num(d.openInvoices),
    inTransit: num(d.inTransit),
    shippedNotInvoiced: num(d.shippedNotInvoiced),
    advances: num(d.advances),
    credits: num(d.credits),
    thisAmount: num(d.thisAmount),
    exposure: num(d.exposure),
    excess: num(d.excess),
    requiredAdvance: num(d.requiredAdvance),
  };
}

/** The server's own floor for an override reason. */
export const MIN_OVERRIDE_REASON = 5;

export const creditOverrideBody = (reason?: string) =>
  reason ? { creditOverride: { reason } } : {};
