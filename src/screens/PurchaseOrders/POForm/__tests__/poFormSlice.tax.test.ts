// ═══════════════════════════════════════════════════════
// FinMatrix — purchase order tax
// ═══════════════════════════════════════════════════════
// The PO form had no tax at all: recalc set it to 0, the payload never sent
// it, and editing a draft created on the web silently stripped its tax. Tax is
// typed (whatever the supplier charged), and line totals exclude it.

import { configureStore } from '@reduxjs/toolkit';
import type { PurchaseOrder } from '../../../../types';

jest.mock('../../../../networks/purchases/purchaseOrderNetwork', () => ({
  createPurchaseOrderAPI: jest.fn(),
  updatePurchaseOrderAPI: jest.fn(),
  updatePOStatusAPI: jest.fn(),
  getPurchaseOrderByIdAPI: jest.fn(),
}));

import { createPurchaseOrderAPI } from '../../../../networks/purchases/purchaseOrderNetwork';
import {
  poFormSlice,
  savePurchaseOrder,
  setVendor,
  setLineItem,
  updateLine,
  loadForEdit,
  loadFromRequestPayload,
} from '../poFormSlice';
import { taxRateError } from '../../../../models/taxRate';

const createPO = createPurchaseOrderAPI as jest.Mock;
const makeStore = () => configureStore({ reducer: { poForm: poFormSlice.reducer } });

const seed = (store: ReturnType<typeof makeStore>, taxRate: string) => {
  store.dispatch(setVendor({ id: 'vendor-1', name: 'Supplier' }));
  const id = store.getState().poForm.lines[0].id;
  store.dispatch(setLineItem({ id, itemId: 'item-1', itemName: 'Roar-X', description: 'Roar-X', unitPrice: '1245' }));
  store.dispatch(updateLine({ id, field: 'quantity', value: '150' }));
  store.dispatch(updateLine({ id, field: 'taxRate', value: taxRate }));
  return id;
};

beforeEach(() => jest.clearAllMocks());

it('totals tax on top of the line amount, which excludes it', () => {
  const store = makeStore();
  seed(store, '17');
  const f = store.getState().poForm;
  expect(f.lines[0].amount).toBe(186750);
  expect(f.subtotal).toBe(186750);
  expect(f.taxAmount).toBe(31747.5);
  expect(f.total).toBe(218497.5);
});

it('accepts any typed rate, e.g. 12.5%', () => {
  const store = makeStore();
  seed(store, '12.5');
  expect(store.getState().poForm.taxAmount).toBe(23343.75);
});

it('sends the tax rate and classifies the line as a stock item', async () => {
  createPO.mockResolvedValue({ data: { id: 'po-1', status: 'draft', lines: [] } });
  const store = makeStore();
  seed(store, '17');
  await store.dispatch(savePurchaseOrder('draft'));
  const line = createPO.mock.calls[0][0].lines[0];
  expect(line).toMatchObject({ itemId: 'item-1', taxRate: '17', lineKind: 'item', orderedQty: '150', unitCost: '1245' });
});

it('keeps a draft’s tax when it is loaded for editing', () => {
  const store = makeStore();
  store.dispatch(
    loadForEdit({
      id: 'po-1', poNumber: 'PO-2026-0027', vendorId: 'v', vendorName: 'V', orderDate: '2026-09-01', expectedDate: '',
      notes: '', status: 'draft',
      lines: [{ id: 'l1', itemId: 'item-1', itemName: '', description: 'x', quantity: 2, unitPrice: 100, taxRate: 10, amount: 200, receivedQuantity: 0, billedQuantity: 0 }],
    } as unknown as PurchaseOrder),
  );
  expect(store.getState().poForm.lines[0].taxRate).toBe('10');
  expect(store.getState().poForm.total).toBe(220);
});

it('keeps the tax of a staff request under review', () => {
  const store = makeStore();
  store.dispatch(
    loadFromRequestPayload({
      payload: { vendorId: 'v', orderDate: '2026-09-01', lines: [{ description: 'x', orderedQty: '1', unitCost: '100', taxRate: '17', itemId: 'i' }] },
      vendorName: 'V',
      itemNames: { i: 'Item' },
    }),
  );
  expect(store.getState().poForm.lines[0].taxRate).toBe('17');
});

it('validates a typed rate: 0–100, up to 4 decimals', () => {
  expect(taxRateError('0')).toBeNull();
  expect(taxRateError('17')).toBeNull();
  expect(taxRateError('12.5')).toBeNull();
  expect(taxRateError('150')).not.toBeNull();
  expect(taxRateError('1.23456')).not.toBeNull();
});
