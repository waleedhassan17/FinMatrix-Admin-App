export type VendorCreditStatus = 'open' | 'applied' | 'closed' | 'void';

export interface VendorCreditLine {
  id?: string;
  /** The expense (or Inventory) account this line credits. */
  accountId?: string;
  itemId?: string;
  quantity?: number;
  description: string;
  /** NET of tax — the API documents `amount` as "excluding tax". */
  amount: number;
  /**
   * Percent of input tax reversed out of Sales Tax Recoverable (1300).
   *
   * Not cosmetic. A vendor credit reverses the net cost AND the recoverable
   * input tax claimed on the original bill, so omitting this leaves that tax
   * sitting in 1300 as recoverable when it no longer is — and relieves A/P by
   * the net while the supplier's own credit note is for the gross.
   */
  taxRate?: number;
}

export interface VendorCredit {
  id: string;
  vendorCreditNumber: string;
  vendorId: string;
  vendorName: string;
  date: string;
  originalBillId: string | null;
  reason: string;
  /** The invariant the entity holds: total = subtotal + taxAmount. */
  subtotal: number;
  taxAmount: number;
  total: number;
  amountApplied: number;
  balance: number;
  status: VendorCreditStatus;
  lines: VendorCreditLine[];
}

// ═══════════════════════════════════════════════════════
// Form → API
// ═══════════════════════════════════════════════════════

/** One line of the editor. Every figure is a string — it is an input. */
export interface VendorCreditLineDraft {
  itemId: string;
  accountId: string;
  quantity: string;
  description: string;
  /** Net of tax. */
  amount: string;
  taxRate: string;
}

export interface VendorCreditLinePayload {
  description: string;
  amount: string;
  taxRate?: string;
  itemId?: string;
  quantity?: string;
  accountId?: string;
}

/**
 * One editor line as the API wants it.
 *
 * Extracted from the form screen so the omission rules can be tested without
 * rendering it — each one was a wrong journal entry rather than a cosmetic gap:
 *
 *   taxRate    omitted at 0. Sending it reverses the input tax claimed on the
 *              original bill out of Sales Tax Recoverable (1300); omitting it
 *              relieved A/P by the net while the supplier's credit note was for
 *              the gross, and left that tax recoverable when it no longer was.
 *   accountId  omitted when blank AND on an item line. `@IsOptional() @IsUUID()`
 *              rejects "", an item line posts to Inventory and ignores the
 *              field, and a money-only line WITHOUT one falls back to COGS —
 *              which is what sent every freight credit into cost of sales, and
 *              every reversed Fixed Asset or Prepaid purchase into the P&L.
 *   quantity   rides along only with an item. The API relieves stock BY it, so
 *              a returned item needs one; a money-only line has nothing to count.
 */
export const vendorCreditLineToPayload = (
  line: VendorCreditLineDraft,
): VendorCreditLinePayload => {
  const payload: VendorCreditLinePayload = {
    description: line.description.trim(),
    amount: line.amount,
  };

  if (parseFloat(line.taxRate) > 0) payload.taxRate = line.taxRate;

  if (line.itemId) {
    payload.itemId = line.itemId;
    payload.quantity = line.quantity || '1';
  } else if (line.accountId) {
    payload.accountId = line.accountId;
  }

  return payload;
};

export interface VendorCreditTotals {
  subtotal: number;
  tax: number;
  total: number;
}

/**
 * Tax is charged per line on that line's own net amount — the same shape the
 * bill and the credit memo use, and the reason none of the three has a
 * document-level rate. The total comes off the UNROUNDED tax, matching the
 * API's own `subtotal.plus(tax)`.
 */
export const vendorCreditTotals = (
  lines: readonly VendorCreditLineDraft[],
): VendorCreditTotals => {
  let subtotal = 0;
  let tax = 0;
  lines.forEach(l => {
    const net = parseFloat(l.amount) || 0;
    subtotal += net;
    tax += (net * (parseFloat(l.taxRate) || 0)) / 100;
  });
  return { subtotal, tax, total: subtotal + tax };
};
