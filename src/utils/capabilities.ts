/**
 * WHO CAN DO WHAT — the client-side mirror of the server's permission matrix.
 *
 * This is a UX map, never a security boundary. The server decides: staff hit a
 * 403 on anything they may not do, and a request they may only ask for comes
 * back as a pending approval no matter what this file says. What this map buys
 * is an interface that tells the truth — no buttons that lead to a 403, and
 * "Send for approval" instead of "Save" where that is what will happen.
 *
 * Three outcomes:
 *   'direct'   the action completes immediately
 *   'request'  it becomes a pending request the owner approves before it posts
 *   false      hidden here, and refused by the server
 *
 * Keep this in step with the backend's @Roles decorators and the gates in the
 * owning controllers. `capabilities.test.ts` asserts the shape against the
 * matrix so a drift shows up as a failing test rather than a dead button.
 */
import type { UserRole } from '../types';

export type Capability =
  // ── Sales & operations: value IN ────────────────────────────────────────
  | 'invoice.create'
  | 'estimate.create'
  | 'salesOrder.create'
  | 'payment.receive'
  | 'customer.manage'
  | 'vendor.manage'
  | 'delivery.create'
  | 'delivery.assign'
  | 'delivery.approveCompletion'
  | 'delivery.rejectCompletion'
  | 'personnel.manage'
  | 'stock.receive'
  | 'inventory.manageItems'
  | 'purchaseOrder.updateStatus'
  // ── Money out & corrections: needs the owner ────────────────────────────
  | 'inventory.adjust'
  | 'journal.post'
  | 'creditMemo.manage'
  | 'vendorCredit.manage'
  | 'transaction.void'
  | 'bill.pay'
  | 'purchaseOrder.create'
  | 'purchaseOrder.edit'
  | 'delivery.undo'
  // ── Governance: owner only ──────────────────────────────────────────────
  | 'approvals.decide'
  | 'users.manage'
  | 'settings.manage'
  | 'chartOfAccounts.manage'
  | 'period.close';

export type CapabilityOutcome = 'direct' | 'request' | false;

/**
 * Table A and Table B, transcribed. The owner column is 'direct' throughout by
 * definition — they are the approver, so nothing they do waits on anyone.
 */
const STAFF_CAPABILITIES: Record<Capability, CapabilityOutcome> = {
  // Value in — staff run the day-to-day, and nothing waits on the owner.
  // Two exceptions live in the money-out block below: raising an invoice and
  // banking a customer payment, which the owner asked to sign off. They are
  // the only value-in rows that ever moved.
  'estimate.create': 'direct',
  'salesOrder.create': 'direct',
  'customer.manage': 'direct',
  'vendor.manage': 'direct',
  'delivery.create': 'direct',
  // Posts Dr Goods in Transit / Cr Inventory at cost. The one ledger-moving
  // action staff take with no approval at all — deliberately NOT a request.
  'delivery.assign': 'direct',
  // Table B row 6: a failed delivery goes back on the shelf. No sale was ever
  // recognised, so there is nothing to correct and nobody to ask — and gating
  // it would strand the stock in transit until the owner next logged in.
  'delivery.rejectCompletion': 'direct',
  'personnel.manage': 'direct',
  'stock.receive': 'direct',
  'inventory.manageItems': 'direct',
  // Send to vendor / close. Posts nothing — the order is a commitment, not a
  // transaction — and the owner's control point is approving the PO into
  // existence. Gating it only stranded an approved PO in draft, since
  // receiving against it requires 'sent'.
  'purchaseOrder.updateStatus': 'direct',

  // Billing and cash in — prepared by staff, posted by the owner.
  // These began in the value-in block above. Raising an invoice recognises
  // revenue and banking a receipt moves cash, and the owner wanted their
  // signature on both. The cost is real and was accepted: staff cannot bill a
  // customer, or clear a balance, until the owner acts.
  'invoice.create': 'request',
  // The cash-IN mirror of bill.pay below.
  'payment.receive': 'request',

  // Money out and corrections — prepared by staff, approved by the owner.
  'inventory.adjust': 'request',
  'journal.post': 'request',
  'creditMemo.manage': 'request',
  'vendorCredit.manage': 'request',
  'transaction.void': 'request',
  'bill.pay': 'request',
  'purchaseOrder.create': 'request',
  // Reverses recognised revenue: staff ask, with a reason.
  'delivery.undo': 'request',

  // Signing off a rider's delivery recognises the sale: Dr A/R / Cr Sales,
  // then Dr COGS / Cr Goods in Transit. The largest ledger event in the
  // product, so it is the owner's signature — staff see the pending request
  // and a "Waiting for Admin Approval" badge where Approve used to be.
  //
  // Not filed under GOVERNANCE_CAPABILITIES on purpose: those are surfaces
  // staff never reach at all, and staff very much still reach this queue —
  // they submit to it, watch it, and reject from it.
  'delivery.approveCompletion': false,

  // Rewriting an existing PO — vendor, quantities, costs — is refused outright
  // rather than queued: the owner already approved this order into existence,
  // and an edit would undo that signature without asking anyone. Note the pair
  // this makes with 'purchaseOrder.create' above, which staff very much do
  // reach, as a request. Not governance for the same reason as the delivery
  // sign-off: staff are all over purchase orders otherwise.
  'purchaseOrder.edit': false,

  // Governance — the owner's alone, and a 403 at the server for staff.
  'approvals.decide': false,
  'users.manage': false,
  'settings.manage': false,
  'chartOfAccounts.manage': false,
  'period.close': false,
};

export const ALL_CAPABILITIES = Object.keys(STAFF_CAPABILITIES) as Capability[];

/** Capabilities that become a pending request when staff perform them. */
export const STAFF_REQUEST_CAPABILITIES = ALL_CAPABILITIES.filter(
  c => STAFF_CAPABILITIES[c] === 'request',
);

/** Capabilities no staff member may reach at all. */
export const GOVERNANCE_CAPABILITIES: Capability[] = [
  'approvals.decide',
  'users.manage',
  'settings.manage',
  'chartOfAccounts.manage',
  'period.close',
];

/**
 * What happens if this role performs this action.
 *
 * Riders never see these surfaces (they have their own navigator), and
 * super_admin is a platform console outside the company model — both get
 * `false` rather than a special case scattered through the screens.
 */
export const capabilityFor = (
  role: UserRole | null | undefined,
  capability: Capability,
): CapabilityOutcome => {
  if (role === 'admin') return 'direct';
  if (role === 'staff') return STAFF_CAPABILITIES[capability] ?? false;
  return false;
};

/** True when the action is available at all, however it completes. */
export const can = (
  role: UserRole | null | undefined,
  capability: Capability,
): boolean => capabilityFor(role, capability) !== false;

/** True when performing it files a request instead of completing. */
export const needsApproval = (
  role: UserRole | null | undefined,
  capability: Capability,
): boolean => capabilityFor(role, capability) === 'request';

/**
 * The wording a submit button should carry. Staff filing a request are told
 * so before they tap, not after.
 */
export const submitLabelFor = (
  role: UserRole | null | undefined,
  capability: Capability,
  directLabel: string,
): string => (needsApproval(role, capability) ? 'Send for approval' : directLabel);
