// ═══════════════════════════════════════════════════════
// FinMatrix — savePayment: the staff approval path
// ═══════════════════════════════════════════════════════
// Banking a customer receipt used to be direct for staff. The screen dispatched
// without .unwrap(), ignored the payload entirely, and then showed a full-screen
// "Payment Recorded!" — which for a pending request would not merely be wrong,
// it reads as a receipt: proof to a customer that they have paid.
//
// The thunk now reports `pending` so the screen can return before that modal.

import { configureStore } from '@reduxjs/toolkit';

jest.mock('../../../../networks/sales/paymentNetwork', () => ({
  createPaymentAPI: jest.fn(),
  receivePaymentAPI: jest.fn(),
  getOutstandingInvoicesAPI: jest.fn(),
  getPaymentHistoryAPI: jest.fn(),
  getPaymentByIdAPI: jest.fn(),
  getPaymentsAPI: jest.fn(),
  getPaymentsByInvoiceAPI: jest.fn(),
}));
jest.mock('../../../../networks/sales/invoiceNetwork', () => ({
  getInvoicesAPI: jest.fn(),
  getInvoiceByIdAPI: jest.fn(),
}));

import { createPaymentAPI } from '../../../../networks/sales/paymentNetwork';
import {
  receivePaymentSlice,
  savePayment,
  setPaymentCustomer,
  setPaymentField,
} from '../receivePaymentSlice';

const createPayment = createPaymentAPI as jest.Mock;

const makeStore = () =>
  configureStore({ reducer: { receivePayment: receivePaymentSlice.reducer } });

/** Enough for buildSavePayload: a customer and an amount. With no invoice rows
 *  loaded the whole amount is a prepayment, which the thunk handles by omitting
 *  `applications` — a valid body, and the simplest one to seed. */
const seed = (store: ReturnType<typeof makeStore>) => {
  store.dispatch(setPaymentCustomer({ id: 'cust-1', name: 'Acme Ltd' }));
  store.dispatch(setPaymentField({ key: 'amount', value: '500' }));
};

type SaveResult = { payment: unknown; pending: boolean };

const saved = async (store: ReturnType<typeof makeStore>) => {
  const result = await store.dispatch(savePayment());
  return result.payload as SaveResult;
};

beforeEach(() => jest.clearAllMocks());

describe('staff — the response is an approval request, not a payment', () => {
  it('reports pending and returns no payment', async () => {
    createPayment.mockResolvedValue({ data: { pending: true } });
    const store = makeStore();
    seed(store);

    expect(await saved(store)).toEqual({ payment: null, pending: true });
  });

  // The network layer returns response.data un-unwrapped, so the flag may sit
  // at either depth. `(created?.data ?? created)?.pending` is NOT the same
  // test: ?? picks whichever operand is merely present, so a truthy `data`
  // wins and its missing `.pending` reads undefined.
  it('reads pending at the top level even when a data object is also present', async () => {
    createPayment.mockResolvedValue({
      success: true,
      pending: true,
      data: { requestId: 'req-4', type: 'invoice_payment' },
    });
    const store = makeStore();
    seed(store);

    expect(await saved(store)).toEqual({ payment: null, pending: true });
  });
});

describe('owner — the payment posts', () => {
  it('returns the created payment', async () => {
    createPayment.mockResolvedValue({ data: { id: 'pay-1' } });
    const store = makeStore();
    seed(store);

    const result = await saved(store);

    expect(result.pending).toBe(false);
    expect(result.payment).toBeTruthy();
  });

  it('sends the amount and method the server expects', async () => {
    createPayment.mockResolvedValue({ data: { id: 'pay-1' } });
    const store = makeStore();
    seed(store);
    store.dispatch(setPaymentField({ key: 'method', value: 'cheque' }));

    await saved(store);

    const body = createPayment.mock.calls[0][0];
    expect(body.customerId).toBe('cust-1');
    expect(body.amount).toBe('500.00');
    // 'cheque' is the form's word; the API's is 'check'.
    expect(body.paymentMethod).toBe('check');
  });
});

// ═══════════════════════════════════════════════════════
// Loading a staff request back in, for review
// ═══════════════════════════════════════════════════════
// The owner opened a payment request and saw an EMPTY form: no customer,
// Amount 0, no allocations. The screen fetched the request for its banner and
// never put the payload anywhere. These pin the reconstruction.
//
// It is two-phase on purpose. outstandingRows are built from allInvoices, and
// fetchAllInvoicesForPayment REBUILDS them (allocated: 0, checked: false) when
// it lands — so allocations applied before that arrives are silently wiped.

import {
  loadFromRequestPayload,
  applyRequestAllocations,
  fetchAllInvoicesForPayment,
} from '../receivePaymentSlice';

const payload = {
  customerId: 'cust-1',
  paymentDate: '2026-09-07',
  paymentMethod: 'bank_transfer',
  amount: '60000.00',
  reference: 'PAY-000123',
  memo: 'Cleared by cheque deposit',
  applications: [{ invoiceId: 'inv-1', amount: '60000.00' }],
};

/** An invoice list shaped as the serializer leaves it. */
const invoiceRow = (id: string, total: number, amountPaid = 0) => ({
  id,
  invoiceNumber: `INV-${id}`,
  customerId: 'cust-1',
  status: 'sent',
  dueDate: '2026-10-07',
  total: String(total),
  amountPaid: String(amountPaid),
  lines: [] as unknown[],
});

const withInvoices = (store: ReturnType<typeof makeStore>, rows: object[]) =>
  store.dispatch({
    type: fetchAllInvoicesForPayment.fulfilled.type,
    payload: { invoices: rows.map(r => r as never) },
  });

describe('loadFromRequestPayload — phase one', () => {
  const load = (p: object, customerName = 'Acme Ltd') => {
    const store = makeStore();
    store.dispatch(loadFromRequestPayload({ payload: p as never, customerName }));
    return store.getState().receivePayment;
  };

  it('reconstructs every scalar the staff member entered', () => {
    const form = load(payload);

    expect(form.customerId).toBe('cust-1');
    expect(form.customerName).toBe('Acme Ltd');
    expect(form.paymentDate).toBe('2026-09-07');
    expect(form.amount).toBe('60000.00');
    // The payload's `memo` is the form's `notes` — a rename easy to miss.
    expect(form.notes).toBe('Cleared by cheque deposit');
  });

  // The mount effect stamps a fresh PAY-xxxxxx; a review must show the number
  // the staff member actually used, not a new one.
  it('overwrites the auto-generated reference', () => {
    expect(load(payload).reference).toBe('PAY-000123');
  });

  it('maps the API method vocabulary back to the one the form uses', () => {
    expect(load({ ...payload, paymentMethod: 'check' }).method).toBe('cheque');
    expect(load({ ...payload, paymentMethod: 'bank_transfer' }).method).toBe('bank_transfer');
    expect(load({ ...payload, paymentMethod: 'cash' }).method).toBe('cash');
    // Unmapped must land on something the dropdown can show, never blank.
    expect(load({ ...payload, paymentMethod: 'crypto' }).method).toBe('online');
    expect(load({ ...payload, paymentMethod: undefined }).method).toBe('online');
  });

  it('survives a payload with every optional key omitted', () => {
    const form = load({ customerId: 'cust-1', paymentDate: '2026-09-07', amount: '10.00' });

    expect(form.reference).toBe('');
    expect(form.notes).toBe('');
    expect(form.amount).toBe('10.00');
  });
});

describe('applyRequestAllocations — phase two', () => {
  const loaded = (p: object = payload, rows = [invoiceRow('inv-1', 60000)]) => {
    const store = makeStore();
    withInvoices(store, rows);
    store.dispatch(loadFromRequestPayload({ payload: p as never, customerName: 'Acme Ltd' }));
    return store;
  };

  it('puts the allocation on the matching row', () => {
    const store = loaded();
    store.dispatch(applyRequestAllocations(payload.applications));

    const row = store.getState().receivePayment.outstandingRows.find(r => r.invoiceId === 'inv-1');
    expect(row?.allocated).toBe(60000);
    expect(row?.checked).toBe(true);
  });

  it('splits across several invoices exactly as submitted', () => {
    const store = loaded(payload, [invoiceRow('inv-1', 60000), invoiceRow('inv-2', 40000)]);
    store.dispatch(
      applyRequestAllocations([
        { invoiceId: 'inv-1', amount: '25000.00' },
        { invoiceId: 'inv-2', amount: '15000.00' },
      ]),
    );

    const rows = store.getState().receivePayment.outstandingRows;
    // Not redistributed oldest-first: this is a replay of a split someone chose.
    expect(rows.find(r => r.invoiceId === 'inv-1')?.allocated).toBe(25000);
    expect(rows.find(r => r.invoiceId === 'inv-2')?.allocated).toBe(15000);
  });

  // The invoice may have been paid another way since, or fall outside the page
  // this screen fetches. The amount still tells the owner what they approve.
  it('ignores an allocation whose row is gone, without throwing', () => {
    const store = loaded();
    expect(() =>
      store.dispatch(applyRequestAllocations([{ invoiceId: 'vanished', amount: '5.00' }])),
    ).not.toThrow();
    expect(store.getState().receivePayment.outstandingRows[0].allocated).toBe(0);
  });

  it('never allocates more than the invoice still owes', () => {
    const store = loaded(payload, [invoiceRow('inv-1', 100, 0)]);
    store.dispatch(applyRequestAllocations([{ invoiceId: 'inv-1', amount: '999.00' }]));

    expect(store.getState().receivePayment.outstandingRows[0].allocated).toBe(100);
  });

  it('survives malformed applications', () => {
    const store = loaded();
    expect(() =>
      store.dispatch(
        applyRequestAllocations([
          { amount: '5.00' },
          { invoiceId: 'inv-1' },
          null as never,
        ]),
      ),
    ).not.toThrow();
  });
});

describe('money not applied to an invoice is held as a customer advance', () => {
  // With no applications the server AUTO-APPLIES oldest-first. Omitting them
  // was how "Save as customer credit" ended up doing the opposite.
  it('asks the server to hold the whole receipt when nothing is allocated', async () => {
    createPayment.mockResolvedValue({ data: { id: 'pay-1' } });
    const store = makeStore();
    seed(store);
    await store.dispatch(savePayment());
    const body = createPayment.mock.calls[0][0];
    expect(body.holdAsAdvance).toBe(true);
    expect(body.applications).toBeUndefined();
  });

  it('invents no PAY- reference', async () => {
    createPayment.mockResolvedValue({ data: { id: 'pay-1' } });
    const store = makeStore();
    seed(store);
    await store.dispatch(savePayment());
    expect(createPayment.mock.calls[0][0].reference).toBeUndefined();
  });
});
