import { mapEstimateLine } from '../estimateSerializer';
import { mapSalesOrderLine } from '../salesOrderSerializer';

/**
 * The inventory item link on quote and order lines.
 *
 * These two forms gained an item picker mirroring the invoice's, and the whole
 * point of storing the id is that it survives: estimate -> sales order ->
 * invoice, where posting finally spends it on COGS and a stock movement. If
 * the serializer drops it, the picker still looks right on a fresh form and
 * silently forgets the item every time an existing document is reopened for
 * editing — which is exactly the failure that is hard to notice by hand.
 *
 * The empty string matters as much as the id. It is fed straight to
 * CustomDropdown's `value`, and null there would not match the
 * "No item (free-text)" option.
 */
describe.each([
  ['mapEstimateLine', mapEstimateLine],
  ['mapSalesOrderLine', mapSalesOrderLine],
])('%s — inventory item link', (_name, map) => {
  const raw = { id: 'l1', description: 'Widget', quantity: '2', unitPrice: '50', taxRate: '0' };

  it('carries the itemId through from the API payload', () => {
    expect(map({ ...raw, itemId: 'item-uuid' }).itemId).toBe('item-uuid');
  });

  it('gives a free-text line an empty string, not undefined', () => {
    expect(map(raw).itemId).toBe('');
  });

  it('normalises a null from the API to an empty string', () => {
    // The column is nullable, so every line written before the picker shipped
    // comes back as null.
    expect(map({ ...raw, itemId: null }).itemId).toBe('');
  });
});
