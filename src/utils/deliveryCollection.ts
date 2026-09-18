// ═══════════════════════════════════════════════════════
// FinMatrix — What the rider collects at the door
// ═══════════════════════════════════════════════════════
// A delivery's sale is settled from, in order:
//   1. the advance the customer paid before dispatch (fully or in part),
//   2. the cash the rider collects at the door,
//   3. whatever is left, which stays on the customer's account.
//
// This mirrors the server's delivery-collection.util.ts for DISPLAY: the
// rider sees the amount to collect as they record returns. The server
// recomputes it on submission and is the authority — a figure it disagrees
// with comes back as COLLECTED_OUT_OF_RANGE.
//
// Money is worked in whole paisa so 0.1 + 0.2 never shows up at the door.

export type DeliveryPaidStatus = 'paid' | 'partial' | 'unpaid';

export const PAID_STATUS_LABELS: Record<DeliveryPaidStatus, string> = {
  paid: 'PAID',
  partial: 'PART PAID',
  unpaid: 'NOT PAID',
};

export interface DoorLine {
  /** Units the customer kept. */
  deliveredQty: number;
  unitPrice: number;
  /** Percent, e.g. 17. */
  taxRate?: number | null;
}

const toPaisa = (rupees: number): number => Math.round((Number(rupees) || 0) * 100);
const toRupees = (paisa: number): number => paisa / 100;

export interface DoorAmounts {
  /** Tax-inclusive value of what the customer kept. */
  gross: number;
  /** The part of the advance this sale uses. */
  advanceApplied: number;
  /** What the rider collects for everything to be paid. */
  amountDue: number;
  /** True when nothing is left to collect — fully prepaid, or covered by the advance. */
  nothingDue: boolean;
}

/**
 * The amount to collect for the goods the customer kept.
 *
 * `prepaid` without an `advanceAmount` is an older prepaid delivery whose
 * advance was the whole order — it covers any sale the delivery can make.
 */
export const doorAmounts = (
  lines: DoorLine[],
  advance: { advanceAmount?: number | null; prepaid?: boolean | null },
): DoorAmounts => {
  const grossPaisa = lines.reduce((sum, l) => {
    const base = (Number(l.deliveredQty) || 0) * (Number(l.unitPrice) || 0);
    return sum + toPaisa(base * (1 + (Number(l.taxRate) || 0) / 100));
  }, 0);
  const advancePaisa =
    advance.prepaid && !(Number(advance.advanceAmount) > 0)
      ? grossPaisa
      : toPaisa(Number(advance.advanceAmount) || 0);
  const appliedPaisa = Math.min(Math.max(advancePaisa, 0), grossPaisa);
  const duePaisa = grossPaisa - appliedPaisa;
  return {
    gross: toRupees(grossPaisa),
    advanceApplied: toRupees(appliedPaisa),
    amountDue: toRupees(duePaisa),
    nothingDue: duePaisa <= 0,
  };
};

/**
 * The rider's PARTIAL figure: more than nothing, no more than is due. A figure
 * equal to the amount due is accepted — the server records it as PAID.
 */
export const partialAmountError = (raw: string, amountDue: number): string | undefined => {
  const v = raw.replace(/[,\s]/g, '');
  if (v === '') return 'Enter how much the customer paid.';
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return 'Enter an amount, e.g. 500 or 500.50.';
  const paisa = toPaisa(Number(v));
  if (paisa <= 0) return 'More than zero — choose NOT PAID if the customer paid nothing.';
  if (paisa > toPaisa(amountDue)) return 'That is more than is due on this delivery.';
  return undefined;
};
