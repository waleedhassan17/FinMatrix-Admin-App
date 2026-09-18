/**
 * A staff request awaiting the owner's decision.
 *
 * The row does nothing until approved: no ledger entry, no document. `payload`
 * is the original request body, replayed against the owning service the moment
 * the owner says yes — which is why a rejected or cancelled request needs no
 * unwinding.
 */
export type ApprovalType =
  | 'adjustment'
  | 'journal'
  | 'credit_memo'
  | 'vendor_credit'
  | 'void'
  | 'bill_payment'
  | 'po'
  | 'invoice'
  | 'invoice_payment'
  | 'delivery_undo'
  | 'delivery_advance';

/**
 * The form a request opens in so the owner can judge it on its contents rather
 * than on the summary line.
 *
 * A type absent from this map has no form to show — `void` and `delivery_undo`
 * are actions on an existing document, not documents — and its card stays
 * untappable rather than advertising a screen that does not exist.
 */
export const APPROVAL_REVIEW_SCREEN: Partial<Record<ApprovalType, string>> = {
  po: 'POForm',
  invoice: 'InvoiceForm',
  invoice_payment: 'ReceivePayment',
};

/**
 * `approving` is a transient claim held while the server dispatches the
 * action, not a resting state. The list endpoint reports it under `pending`.
 */
export type ApprovalStatus =
  | 'pending'
  | 'approving'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  status: ApprovalStatus;
  summary: string;
  /** Why it was asked for. Required for a delivery undo. */
  reason: string | null;
  payload: Record<string, unknown>;
  requestedBy: string;
  reviewedBy: string | null;
  /** 'admin' or 'staff' — the authority that decided it. */
  reviewerRole: string | null;
  reviewedAt: string | null;
  reviewerComment: string | null;
  journalEntryId: string | null;
  resultId: string | null;
  /** Why the last approval attempt failed — a closed period, no stock, … */
  lastError: string | null;
  createdAt: string;
}

/** Human labels for each type, used in the inbox and in "My requests". */
export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = {
  adjustment: 'Inventory adjustment',
  journal: 'Manual journal',
  credit_memo: 'Credit memo',
  vendor_credit: 'Vendor credit',
  void: 'Void / reversal',
  bill_payment: 'Bill payment',
  po: 'Purchase order',
  invoice: 'Invoice',
  invoice_payment: 'Customer payment',
  delivery_undo: 'Undo a delivery',
  delivery_advance: 'Delivery with advance',
};

/** One line explaining what approving will actually do to the books. */
export const APPROVAL_TYPE_EFFECTS: Record<ApprovalType, string> = {
  adjustment: 'Adjusts stock and posts the difference to the ledger.',
  journal: 'Posts a manual journal entry.',
  credit_memo: 'Reverses part of a posted sale.',
  vendor_credit: 'Reduces what is owed to a supplier.',
  void: 'Posts a balancing entry that reverses the original.',
  bill_payment: 'Moves money out of the bank account.',
  po: 'Creates the purchase order. Posts nothing on its own.',
  invoice: 'Creates the invoice and recognises the sale.',
  invoice_payment: 'Records money received and clears the invoice balance.',
  delivery_undo: 'Reverses a delivery that was already approved.',
  delivery_advance:
    'Creates the delivery and records the advance as a cash receipt, held in Customer Advances until the delivery is approved.',
};

/**
 * Awaiting a decision and safe to act on.
 *
 * `approving` is deliberately NOT included. It means a decision was
 * interrupted mid-post, so the work may already have gone through — offering
 * Approve there invites a second attempt at something that may already be
 * done. The server refuses it with APPROVAL_INTERRUPTED either way.
 */
export const isPendingApproval = (r: ApprovalRequest): boolean =>
  r.status === 'pending';

/** Stranded mid-post by a crash. Needs a human to check the ledger. */
export const isInterruptedApproval = (r: ApprovalRequest): boolean =>
  r.status === 'approving';

/**
 * Does an outstanding customer-payment request cover this invoice?
 *
 * Exported and pure so it can be tested directly — it is the part with the
 * traps, and every one of them fails silently:
 *
 *   • `payload` is typed Record<string, unknown>, so nothing may assume a shape;
 *   • `applications` is OMITTED entirely for a pure prepayment, so it can be
 *     absent rather than empty;
 *   • one request can settle several invoices, so it is `.some`, never `[0]`;
 *   • `approving` counts. isPendingApproval excludes it on purpose — it is a
 *     transient claim, not a resting state — but a request being dispatched
 *     right now may already be posting, and re-enabling the button there is how
 *     a customer gets paid in twice.
 */
export const hasOutstandingPaymentFor = (
  requests: ApprovalRequest[],
  invoiceId: string,
): boolean =>
  requests.some(req => {
    if (!req || !(isPendingApproval(req) || isInterruptedApproval(req))) return false;
    const applications = (req.payload as { applications?: unknown })?.applications;
    return (
      Array.isArray(applications) &&
      applications.some(a => (a as { invoiceId?: string })?.invoiceId === invoiceId)
    );
  });
