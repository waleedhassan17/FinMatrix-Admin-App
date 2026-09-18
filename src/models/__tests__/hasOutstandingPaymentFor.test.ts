// ═══════════════════════════════════════════════════════
// FinMatrix — hasOutstandingPaymentFor
// ═══════════════════════════════════════════════════════
// The predicate behind the locked "Waiting for approval" button on an invoice.
// Every way it can be wrong is silent: get it too loose and staff can never
// record a payment, too tight and they file the same request repeatedly for the
// owner to untangle.
//
// It lives in the model rather than beside the hook that calls it precisely so
// it can be tested like this: approvalModel has no React or redux in its import
// graph, and react-redux ships ESM the jest preset does not transform.

import {
  hasOutstandingPaymentFor,
  type ApprovalRequest,
  type ApprovalStatus,
} from '../approvalModel';

const INVOICE = 'inv-1';
const OTHER = 'inv-2';

const request = (
  payload: unknown,
  status: ApprovalStatus = 'pending',
): ApprovalRequest =>
  ({ id: `req-${Math.random()}`, type: 'invoice_payment', status, payload } as unknown as ApprovalRequest);

const forInvoices = (...ids: string[]) => ({
  applications: ids.map(invoiceId => ({ invoiceId, amount: '50.00' })),
});

describe('a request against this invoice locks it', () => {
  it('matches on applications[].invoiceId', () => {
    expect(hasOutstandingPaymentFor([request(forInvoices(INVOICE))], INVOICE)).toBe(true);
  });

  // One payment can settle several invoices, which is why the matcher looks at
  // every application rather than the first.
  it('matches when the request covers several invoices', () => {
    const req = request(forInvoices(OTHER, 'inv-3', INVOICE));

    expect(hasOutstandingPaymentFor([req], INVOICE)).toBe(true);
  });

  it('matches when any one of several requests covers it', () => {
    const requests = [request(forInvoices(OTHER)), request(forInvoices(INVOICE))];

    expect(hasOutstandingPaymentFor(requests, INVOICE)).toBe(true);
  });

  // isPendingApproval excludes 'approving' on purpose — it is a transient claim
  // rather than a resting state. For a BUTTON that exclusion is wrong: the
  // server may be posting this payment right now, and re-enabling here is how a
  // customer gets paid in twice.
  it('stays locked while the request is being dispatched', () => {
    const req = request(forInvoices(INVOICE), 'approving');

    expect(hasOutstandingPaymentFor([req], INVOICE)).toBe(true);
  });
});

describe('anything else leaves it unlocked', () => {
  it('ignores a request for a different invoice', () => {
    expect(hasOutstandingPaymentFor([request(forInvoices(OTHER))], INVOICE)).toBe(false);
  });

  it.each(['approved', 'rejected', 'cancelled'] as ApprovalStatus[])(
    'unlocks once the request is %s',
    status => {
      const req = request(forInvoices(INVOICE), status);

      expect(hasOutstandingPaymentFor([req], INVOICE)).toBe(false);
    },
  );

  it('handles an empty list', () => {
    expect(hasOutstandingPaymentFor([], INVOICE)).toBe(false);
  });

  // `applications` is OMITTED entirely for a pure prepayment — absent, not
  // empty — so this is a real shape, not a hypothetical one.
  it('does not throw on a prepayment with no applications', () => {
    const req = request({ customerId: 'cust-1', amount: '500.00' });

    expect(hasOutstandingPaymentFor([req], INVOICE)).toBe(false);
  });

  // payload is typed Record<string, unknown>; nothing may assume its shape.
  it('survives every malformed payload without throwing', () => {
    const requests = [
      request(undefined),
      request(null),
      request({}),
      request({ applications: null }),
      request({ applications: 'nope' }),
      request({ applications: [null, undefined] }),
      request({ applications: [{ amount: '10.00' }] }),
    ];

    expect(() => hasOutstandingPaymentFor(requests, INVOICE)).not.toThrow();
    expect(hasOutstandingPaymentFor(requests, INVOICE)).toBe(false);
  });

  it('does not match a malformed request sitting beside a real one', () => {
    const requests = [request({ applications: null }), request(forInvoices(INVOICE))];

    expect(hasOutstandingPaymentFor(requests, INVOICE)).toBe(true);
  });
});
