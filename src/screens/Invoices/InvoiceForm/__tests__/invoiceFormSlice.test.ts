// ═══════════════════════════════════════════════════════
// FinMatrix — saveInvoice: the staff approval path
// ═══════════════════════════════════════════════════════
// Raising an invoice used to be direct for staff, and this screen was the only
// gated form with nowhere to notice a pending response: the payload was built
// inline in the component and the API's return value was discarded entirely.
// Both moved into the thunk so the flag can be read, and these pin it.
//
// The network module is factory-mocked, not automocked: automock still
// evaluates the real module, which pulls in apiHelpers → axios, react-native
// Platform and AsyncStorage.

import { configureStore } from '@reduxjs/toolkit';

jest.mock('../../../../networks/sales/invoiceNetwork', () => ({
  createInvoiceAPI: jest.fn(),
  updateInvoiceAPI: jest.fn(),
  getInvoiceByIdAPI: jest.fn(),
}));

import {
  createInvoiceAPI,
  updateInvoiceAPI,
} from '../../../../networks/sales/invoiceNetwork';
import {
  invoiceFormSlice,
  saveInvoice,
  loadFromRequestPayload,
  setCustomer,
  setLineItem,
  updateLine,
} from '../invoiceFormSlice';

const createInvoice = createInvoiceAPI as jest.Mock;
const updateInvoice = updateInvoiceAPI as jest.Mock;

const makeStore = () =>
  configureStore({ reducer: { invoiceForm: invoiceFormSlice.reducer } });

const seedValidForm = (store: ReturnType<typeof makeStore>) => {
  store.dispatch(setCustomer({ id: 'cust-1', name: 'Acme Ltd' }));
  const lineId = store.getState().invoiceForm.lines[0].id;
  store.dispatch(
    setLineItem({ id: lineId, itemId: 'item-A', description: 'Widget', unitPrice: '100' }),
  );
  store.dispatch(updateLine({ id: lineId, field: 'quantity', value: '2' }));
};

type SaveResult = { invoice: unknown; pending: boolean };

const saved = async (store: ReturnType<typeof makeStore>, editingId?: string) => {
  const result = await store.dispatch(saveInvoice({ status: 'sent', editingId }));
  return result.payload as SaveResult;
};

beforeEach(() => jest.clearAllMocks());

describe('staff — the response is an approval request, not an invoice', () => {
  it('reports pending and returns no invoice', async () => {
    createInvoice.mockResolvedValue({ data: { pending: true } });
    const store = makeStore();
    seedValidForm(store);

    expect(await saved(store)).toEqual({ invoice: null, pending: true });
  });

  // The grouping that defeats `(envelope?.data ?? envelope)?.pending`: ?? picks
  // whichever operand is merely PRESENT, so a truthy `data` wins and its
  // missing `.pending` reads undefined. That shipped a bug on the PO form once.
  it('reads pending at the top level even when a data object is also present', async () => {
    createInvoice.mockResolvedValue({
      success: true,
      pending: true,
      data: { requestId: 'req-9', type: 'invoice' },
    });
    const store = makeStore();
    seedValidForm(store);

    expect(await saved(store)).toEqual({ invoice: null, pending: true });
  });

  it('clears the saving flag either way', async () => {
    createInvoice.mockResolvedValue({ data: { pending: true } });
    const store = makeStore();
    seedValidForm(store);
    await saved(store);

    expect(store.getState().invoiceForm.isSaving).toBe(false);
  });
});

describe('owner — a real invoice comes back', () => {
  it('returns the created invoice', async () => {
    createInvoice.mockResolvedValue({ data: { id: 'inv-1', invoiceNumber: 'INV-0001' } });
    const store = makeStore();
    seedValidForm(store);

    const result = await saved(store);

    expect(result.pending).toBe(false);
    expect((result.invoice as any).id).toBe('inv-1');
  });

  it('sends the DTO the server expects, and omits an unlinked itemId', async () => {
    createInvoice.mockResolvedValue({ data: { id: 'inv-1' } });
    const store = makeStore();
    store.dispatch(setCustomer({ id: 'cust-1', name: 'Acme Ltd' }));
    const lineId = store.getState().invoiceForm.lines[0].id;
    store.dispatch(updateLine({ id: lineId, field: 'description', value: 'Consulting' }));
    store.dispatch(updateLine({ id: lineId, field: 'quantity', value: '1' }));
    store.dispatch(updateLine({ id: lineId, field: 'unitPrice', value: '500' }));

    await saved(store);

    const body = createInvoice.mock.calls[0][0];
    expect(body.customerId).toBe('cust-1');
    // invoiceDate, not issueDate — the form's own name is not the DTO's.
    expect(body).toHaveProperty('invoiceDate');
    // An empty string here would fail the backend's @IsUUID.
    expect(body.lines[0]).not.toHaveProperty('itemId');
  });

  it('updates rather than creates when editing', async () => {
    updateInvoice.mockResolvedValue({ data: { id: 'inv-1' } });
    const store = makeStore();
    seedValidForm(store);

    await saved(store, 'inv-1');

    expect(updateInvoice).toHaveBeenCalledTimes(1);
    expect(updateInvoice.mock.calls[0][0]).toBe('inv-1');
    expect(createInvoice).not.toHaveBeenCalled();
  });
});

describe('loadFromRequestPayload — the owner reviewing a request', () => {
  const payload = {
    customerId: 'cust-1',
    invoiceDate: '2026-02-01',
    dueDate: '2026-03-03',
    status: 'sent',
    discountType: 'percent',
    discountValue: '10',
    notes: 'Rush',
    lines: [
      { description: 'Widget', quantity: '2', unitPrice: '100', taxRate: '0', itemId: 'item-A' },
      { description: 'Gadget', quantity: '1', unitPrice: '50', taxRate: '0' },
    ],
  };

  const load = (p: object, customerName = 'Acme Ltd') => {
    const store = makeStore();
    store.dispatch(loadFromRequestPayload({ payload: p as any, customerName }));
    return store.getState().invoiceForm;
  };

  it('maps the DTO key names back onto the form', () => {
    const form = load(payload);

    expect(form.customerId).toBe('cust-1');
    expect(form.customerName).toBe('Acme Ltd');
    // invoiceDate → issueDate is the rename that makes a naive reuse wrong.
    expect(form.issueDate).toBe('2026-02-01');
    expect(form.dueDate).toBe('2026-03-03');
    expect(form.notes).toBe('Rush');
    expect(form.lines).toHaveLength(2);
    expect(form.lines[0]).toMatchObject({ description: 'Widget', quantity: '2' });
  });

  it('mints a unique id for every line', () => {
    const ids = load(payload).lines.map(l => l.id);

    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('recalculates the totals rather than trusting the payload', () => {
    const form = load(payload);

    // 250 gross less the 10% the request asked for.
    expect(form.total).toBe(225);
  });

  it('survives a payload with every optional key omitted', () => {
    const form = load({
      customerId: 'cust-1',
      invoiceDate: '2026-02-01',
      dueDate: '2026-03-03',
      lines: [{ description: 'Widget', quantity: '1', unitPrice: '5' }],
    });

    expect(form.notes).toBe('');
    expect(form.lines[0].itemId).toBe('');
    expect(form.lines[0].taxRate).toBe('0');
  });

  it('never leaves the line list empty', () => {
    // Every render indexes lines[0].
    expect(load({ customerId: 'c', invoiceDate: '2026-02-01', lines: [] }).lines).toHaveLength(1);
  });
});
