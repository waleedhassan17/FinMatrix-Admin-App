// ═══════════════════════════════════════════════════════
// FinMatrix — Stock Adjustment Model
// ═══════════════════════════════════════════════════════
// Adjustments are posted by /api/v1/inventory/items/:id/adjust, which moves
// the quantity AND posts the matching journal entry in one transaction. This
// file holds the reason codes and a preview of the entry that will post, so
// the form can show the accounting before the user commits to it.

// The VALUE is the code AdjustQuantityDto accepts; the LABEL is what the user
// reads. These were Title Case UI strings that the API had never accepted —
// 'Return'/'Received' are rejected outright, and 'correction'/'obsolescence'
// could not be expressed at all.
//
// 'reversal' is deliberately absent: the backend writes it itself from
// reverseAdjustment() and uses it as the marker that stops a reversal being
// reversed again, so it must never be selectable here.
export type AdjustmentReason =
  | 'physical_count'
  | 'damage'
  | 'theft'
  | 'correction'
  | 'obsolescence'
  | 'other';

export const ADJUSTMENT_REASONS: {
  label: string;
  value: AdjustmentReason;
  hint: string;
}[] = [
  { label: 'Physical Count', value: 'physical_count', hint: 'A stock count found a different quantity than the books showed.' },
  { label: 'Damage', value: 'damage', hint: 'Stock was broken, spoiled or otherwise made unsellable.' },
  { label: 'Theft', value: 'theft', hint: 'Stock is missing and believed stolen.' },
  { label: 'Correction', value: 'correction', hint: 'A data-entry mistake is being put right.' },
  { label: 'Obsolescence', value: 'obsolescence', hint: 'Stock is expired or no longer sellable.' },
  { label: 'Other', value: 'other', hint: 'Anything the codes above do not cover — explain it in the notes.' },
];

export const reasonHint = (reason: AdjustmentReason | ''): string =>
  ADJUSTMENT_REASONS.find(r => r.value === reason)?.hint ?? '';

// ─── Posting preview ─────────────────────────────────
// Mirrors postInventoryAdjustmentJe() and ADJUSTMENT_REASON_ACCOUNTS in the
// backend's inventory.service.ts / accounts.constants.ts. Keep them in step if
// the chart of accounts moves — this drives what the user is shown before they
// commit, so a stale copy here is the form telling them a lie.
export const ACCT_INVENTORY = '1200';
export const ACCT_INVENTORY_NAME = 'Inventory';

/**
 * Legacy. Every adjustment posted here before the reason drove the account.
 * Nothing new lands here; kept only so an older entry can still be named.
 */
export const ACCT_INVENTORY_ADJUSTMENT = '6400';
export const ACCT_INVENTORY_ADJUSTMENT_NAME = 'Inventory Adjustment / Shrinkage';

/**
 * The account each reason offsets Inventory against, and how it reads on the
 * P&L. All 54xx / Cost of Goods: stock bought to sell and then lost is a cost
 * of goods, so it reduces GROSS profit — same treatment QuickBooks gives it.
 */
export const REASON_ACCOUNTS: Record<
  AdjustmentReason,
  { accountNumber: string; accountName: string }
> = {
  damage: { accountNumber: '5400', accountName: 'Inventory Shrinkage – Damage' },
  theft: { accountNumber: '5410', accountName: 'Inventory Shrinkage – Theft' },
  obsolescence: { accountNumber: '5420', accountName: 'Inventory Shrinkage – Obsolescence' },
  // A count variance and a data-entry correction are the same event
  // accounting-wise: the books said one thing, the shelf said another.
  physical_count: { accountNumber: '5430', accountName: 'Inventory Count Variance' },
  correction: { accountNumber: '5430', accountName: 'Inventory Count Variance' },
  other: { accountNumber: '5430', accountName: 'Inventory Count Variance' },
};

export interface AdjustmentPostingLine {
  side: 'debit' | 'credit';
  accountNumber: string;
  accountName: string;
  amount: number;
}

export interface AdjustmentPosting {
  /** |variance| × unit cost — what the entry is worth. */
  value: number;
  lines: AdjustmentPostingLine[];
  /**
   * True when the entry would be worth nothing, which happens whenever the
   * item has no unit cost. The server skips the journal entry entirely in
   * that case and moves the quantity on its own, so the form has to say so.
   */
  postsNothing: boolean;
}

/**
 * The journal entry the server will post for this adjustment.
 *
 *   increase (variance > 0): DR 1200 Inventory  / CR the reason's account
 *   decrease (variance < 0): DR the reason's account / CR 1200 Inventory
 *
 * Valued at the item's CURRENT weighted-average cost — the same figure the
 * server reads — so what the form shows is what lands in the ledger.
 *
 * The reason genuinely picks the account: it used to reach the journal memo
 * and nothing else, so this preview showed 6400 whatever the user chose.
 */
export const previewAdjustmentPosting = (
  variance: number,
  unitCost: number,
  reason: AdjustmentReason | '',
): AdjustmentPosting => {
  const value = Math.abs(variance) * unitCost;
  if (!(value > 0)) return { value: 0, lines: [], postsNothing: true };

  const inventory = { accountNumber: ACCT_INVENTORY, accountName: ACCT_INVENTORY_NAME };
  // Before a reason is picked, name the account the commonest case would use
  // rather than showing a blank line — the figures are already correct, and
  // the row updates the moment they choose.
  const adjustment = reason ? REASON_ACCOUNTS[reason] : REASON_ACCOUNTS.correction;

  return {
    value,
    postsNothing: false,
    lines:
      variance > 0
        ? [
            { side: 'debit', ...inventory, amount: value },
            { side: 'credit', ...adjustment, amount: value },
          ]
        : [
            { side: 'debit', ...adjustment, amount: value },
            { side: 'credit', ...inventory, amount: value },
          ],
  };
};
