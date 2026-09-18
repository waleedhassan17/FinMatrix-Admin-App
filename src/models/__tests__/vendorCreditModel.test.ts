// ═══════════════════════════════════════════════════════
// FinMatrix — vendorCreditModel
// ═══════════════════════════════════════════════════════
// The payload rules behind a vendor credit's journal entry. Every one of these
// was wrong, and none of them failed loudly — the credit saved, the screen went
// back, and the books were misstated:
//
//   * no taxRate  the API set taxAmount = 0, so it debited A/P by the NET while
//                 the supplier's credit note was for the gross, and never
//                 credited Sales Tax Recoverable (1300) — leaving input tax
//                 claimed on the original bill still sitting there as
//                 recoverable when the return had made it not.
//   * no accountId  the API falls back to COGS for any line naming no item.
//                 Reversing a bill coded to Fixed Asset, Prepaid or Other Asset
//                 — all of which the bill form offers — therefore moved a
//                 balance-sheet figure into the P&L and made net income wrong.
//
// Tested here rather than through the screen because the model has no React or
// redux in its import graph.

import {
  vendorCreditLineToPayload,
  vendorCreditTotals,
  type VendorCreditLineDraft,
} from '../vendorCreditModel';

const line = (over: Partial<VendorCreditLineDraft> = {}): VendorCreditLineDraft => ({
  itemId: '',
  accountId: '',
  quantity: '',
  description: 'Overcharged on freight',
  amount: '1000',
  taxRate: '0',
  ...over,
});

describe('vendorCreditLineToPayload', () => {
  it('sends a money-only line as description and amount', () => {
    expect(vendorCreditLineToPayload(line())).toEqual({
      description: 'Overcharged on freight',
      amount: '1000',
    });
  });

  it('trims the description', () => {
    expect(vendorCreditLineToPayload(line({ description: '  Freight  ' })).description)
      .toBe('Freight');
  });

  // ── taxRate ────────────────────────────────────────────
  it('sends taxRate so the input tax claim is reversed', () => {
    expect(vendorCreditLineToPayload(line({ taxRate: '17' })).taxRate).toBe('17');
  });

  it('omits taxRate at zero rather than sending "0"', () => {
    expect('taxRate' in vendorCreditLineToPayload(line({ taxRate: '0' }))).toBe(false);
  });

  it('omits taxRate when it is blank or unparseable', () => {
    expect('taxRate' in vendorCreditLineToPayload(line({ taxRate: '' }))).toBe(false);
    expect('taxRate' in vendorCreditLineToPayload(line({ taxRate: 'abc' }))).toBe(false);
  });

  // ── accountId ──────────────────────────────────────────
  it('sends accountId on a money-only line so the credit misses COGS', () => {
    expect(vendorCreditLineToPayload(line({ accountId: 'acct-6000' })).accountId)
      .toBe('acct-6000');
  });

  it('omits accountId rather than sending an empty string', () => {
    // @IsOptional() @IsUUID() — "" is present and fails validation outright.
    expect('accountId' in vendorCreditLineToPayload(line({ accountId: '' }))).toBe(false);
  });

  it('drops accountId on an item line, which posts to Inventory instead', () => {
    // The API refuses a NON-stock line aimed at 1200 and ignores accountId on a
    // stock line, so a stale one is misleading either way.
    const payload = vendorCreditLineToPayload(
      line({ itemId: 'item-1', quantity: '2', accountId: 'acct-6000' }),
    );
    expect('accountId' in payload).toBe(false);
    expect(payload.itemId).toBe('item-1');
  });

  // ── quantity ───────────────────────────────────────────
  it('sends quantity only alongside an item', () => {
    const payload = vendorCreditLineToPayload(line({ itemId: 'item-1', quantity: '3' }));
    expect(payload.quantity).toBe('3');
  });

  it('never sends quantity on a money-only line', () => {
    expect('quantity' in vendorCreditLineToPayload(line({ quantity: '5' }))).toBe(false);
  });

  it('defaults an item line with no quantity to 1 rather than 0', () => {
    // Stock is relieved BY the quantity, so 0 would take nothing off the shelf.
    expect(vendorCreditLineToPayload(line({ itemId: 'item-1', quantity: '' })).quantity)
      .toBe('1');
  });
});

describe('vendorCreditTotals', () => {
  it('sums the net line amounts', () => {
    expect(vendorCreditTotals([line({ amount: '1000' }), line({ amount: '250.50' })]))
      .toEqual({ subtotal: 1250.5, tax: 0, total: 1250.5 });
  });

  it('charges tax per line on that line’s own net amount', () => {
    // 1000 @ 17% = 170; 500 @ 0% = 0.
    expect(
      vendorCreditTotals([
        line({ amount: '1000', taxRate: '17' }),
        line({ amount: '500', taxRate: '0' }),
      ]),
    ).toEqual({ subtotal: 1500, tax: 170, total: 1670 });
  });

  it('makes the total the gross the supplier actually owes', () => {
    // The figure that has to agree with their credit note, and the one the API
    // debits A/P by. Net-only was the whole defect.
    expect(vendorCreditTotals([line({ amount: '100000', taxRate: '17' })]).total)
      .toBe(117000);
  });

  it('treats a blank or unparseable amount as zero', () => {
    expect(
      vendorCreditTotals([
        line({ amount: '' }),
        line({ amount: 'abc' }),
        line({ amount: '40' }),
      ]).total,
    ).toBe(40);
  });

  it('is zero for no lines', () => {
    expect(vendorCreditTotals([])).toEqual({ subtotal: 0, tax: 0, total: 0 });
  });
});
