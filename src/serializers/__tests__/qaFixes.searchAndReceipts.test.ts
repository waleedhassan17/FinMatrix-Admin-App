// Search covers every document type — INV-2026-0027 and PO-2026-0027 share a
// suffix, and searching "0027" found only the invoice. Receipts carry their
// own RCT numbers and report the advance they still hold.

// The real helper module pulls in the API client (expo env, axios).
jest.mock('../../networks/reports/reportHelpers', () => ({
  unwrapEnvelope: (response: any) => response?.data ?? response,
}));

import { searchResultsSerializer } from '../globalSearchSerializer';
import { customerAdvancesSerializer, mapPayment } from '../paymentSerializer';
import { customerPaymentsSerializer } from '../customerSerializer';

describe('global search', () => {
  it('groups an invoice and a purchase order with the same suffix separately', () => {
    const results = searchResultsSerializer({
      data: {
        query: '0027',
        results: {
          invoices: [{ id: 'i1', invoiceNumber: 'INV-2026-0027', total: '100', status: 'sent' }],
          purchaseOrders: [{ id: 'p1', poNumber: 'PO-2026-0027', vendorName: 'Supplier', total: '47736', status: 'draft' }],
          payments: [{ id: 'r1', paymentNumber: 'RCT-2026-0027', customerId: 'c1', customerName: 'Allama Iqbal', amount: '1200' }],
          journalEntries: [{ id: 'j1', reference: 'JE-0027', memo: 'Receipt', date: '2026-09-01', status: 'posted' }],
        },
      },
    });
    expect(results.map(r => [r.module, r.title])).toEqual([
      ['Invoices', 'INV-2026-0027'],
      ['Purchase Orders', 'PO-2026-0027'],
      ['Receipts', 'RCT-2026-0027'],
      ['Journal Entries', 'JE-0027'],
    ]);
    expect(results[1]).toMatchObject({ routeName: 'PODetail', routeParams: { poId: 'p1' } });
    expect(results[1].subtitle).toContain('Requisition');
    expect(results[2]).toMatchObject({ routeName: 'CustomerDetail', routeParams: { customerId: 'c1' } });
  });

  it('skips malformed buckets and rows', () => {
    expect(searchResultsSerializer({ data: { results: { salesOrders: 'x', estimates: [{}] } } })).toEqual([]);
  });
});

describe('receipts and advances', () => {
  it('shows the RCT number and the unapplied advance from the server', () => {
    const p = mapPayment({ id: 'x', paymentNumber: 'RCT-2026-0001', reference: 'CHQ-1', amount: '107250', unapplied: '106050', applications: [] });
    expect(p.paymentNumber).toBe('RCT-2026-0001');
    expect(p.creditAmount).toBe(106050);
  });

  it('lists only receipts still holding money', () => {
    expect(
      customerAdvancesSerializer({
        data: [
          { paymentId: 'a', paymentNumber: 'RCT-1', paymentDate: '2026-09-01', unapplied: '106050.0000' },
          { paymentId: 'b', paymentNumber: 'RCT-2', paymentDate: '2026-09-02', unapplied: '0.0000' },
        ],
      }),
    ).toEqual([{ paymentId: 'a', paymentNumber: 'RCT-1', paymentDate: '2026-09-01', unapplied: 106050 }]);
  });
});

describe('customer payment rows', () => {
  it('say what a part-payment applied and what is still owing', () => {
    const { rows } = customerPaymentsSerializer({
      data: [
        {
          id: 'p1',
          paymentNumber: 'RCT-2026-0040',
          amount: '758',
          paymentMethod: 'cash',
          applications: [{ invoiceNumber: 'INV-2026-0052', amountApplied: '758', invoiceBalance: '6823.6' }],
        },
      ],
    });
    expect(rows[0].reference).toBe('RCT-2026-0040');
    expect(rows[0].applied).toEqual([expect.stringMatching(/INV-2026-0052: Rs\s?758\.00 · Rs\s?6,823\.60 still owing/)]);
  });
});
