import { recentTransactionsSerializer } from '../adminDashboardSerializer';
import type { AdminDashboardData } from '../../models/adminDashboardModel';

/**
 * The dashboard's Recent transactions rows are links now — an invoice row
 * opens InvoiceDetail, a bill row opens BillDetail.
 *
 * What makes that safe is `kind` being carried through from the API. The
 * serializer used to keep only `type: 'income' | 'expense'`, and the row
 * worked out what it was with `isIncome ? 'Invoice' : 'Bill'` — correct only
 * for as long as there are exactly two document types. Routing on that would
 * send any third type to BillDetail with an id that is not a bill's.
 *
 * These assertions exist so the mapping cannot quietly collapse back into the
 * income/expense flag.
 */
const data = (
  rows: AdminDashboardData['recentTransactions'],
): AdminDashboardData =>
  ({ recentTransactions: rows } as unknown as AdminDashboardData);

const row = (over: Partial<AdminDashboardData['recentTransactions'][0]> = {}) => ({
  id: 'x1',
  type: 'invoice' as const,
  description: 'INV-0001',
  date: '2026-08-20',
  amount: 1200,
  status: 'paid',
  ...over,
});

describe('recentTransactionsSerializer — document kind', () => {
  it('carries an invoice through as an invoice', () => {
    const [t] = recentTransactionsSerializer(data([row({ type: 'invoice' })]));
    expect(t.kind).toBe('invoice');
    expect(t.type).toBe('income');
    expect(t.description).toBe('Invoice INV-0001');
  });

  it('carries a bill through as a bill', () => {
    const [t] = recentTransactionsSerializer(
      data([row({ type: 'bill', description: 'BILL-0009' })]),
    );
    expect(t.kind).toBe('bill');
    expect(t.type).toBe('expense');
    expect(t.description).toBe('Bill BILL-0009');
  });

  it('keeps the row id, which is what the row routes on', () => {
    const [t] = recentTransactionsSerializer(data([row({ id: 'abc-123' })]));
    expect(t.id).toBe('abc-123');
  });

  /**
   * The important one. A document type this build does not know about must not
   * inherit "bill" from being an outflow — the row still shows, but `kind` is
   * `unknown`, and the screen leaves such a row without an onPress.
   */
  it('does not call an unrecognised document type a bill', () => {
    const [t] = recentTransactionsSerializer(
      data([
        row({
          type: 'credit_memo' as unknown as 'bill',
          description: 'CM-0004',
        }),
      ]),
    );
    expect(t.kind).toBe('unknown');
    expect(t.description).toBe('CM-0004');
  });

  it('maps a whole feed without losing rows', () => {
    const out = recentTransactionsSerializer(
      data([
        row({ id: 'a', type: 'invoice' }),
        row({ id: 'b', type: 'bill' }),
        row({ id: 'c', type: 'invoice' }),
      ]),
    );
    expect(out).toHaveLength(3);
    expect(out.map(t => t.kind)).toEqual(['invoice', 'bill', 'invoice']);
  });
});
