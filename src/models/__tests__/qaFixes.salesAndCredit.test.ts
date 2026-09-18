// ═══════════════════════════════════════════════════════
// FinMatrix — sales line classification, backorders, credit limit
// ═══════════════════════════════════════════════════════
// QA sold "Roar-X Drinks", a product the company neither stocks nor
// catalogues, and shipped Rs 107,250 to a customer with a Rs 100,000 limit.
// The server now refuses both; these pin what the app sends and how it reads
// the refusals.

import {
  SERVICE_LINE_VALUE,
  backorderShortfalls,
  firstUnclassifiedLine,
  kindOfStoredLine,
  salesLineKindPayload,
  salesLineOptions,
  salesLinePickerValue,
  stockHint,
} from '../salesLineModel';
import { creditAssessmentFrom, creditOverrideBody } from '../creditModel';

const item = { id: 'item-1', sku: 'RX-1', name: 'Roar-X', quantityOnHand: 40, isActive: true };

describe('sales line classification', () => {
  it('sends an item line with its id and kind', () => {
    expect(salesLineKindPayload({ itemId: 'item-1', lineKind: 'item' }, true)).toEqual({
      itemId: 'item-1',
      lineKind: 'item',
    });
  });

  it('sends a typed line only as an explicit service in an inventory company', () => {
    expect(salesLineKindPayload({ itemId: '', lineKind: 'service' }, true)).toEqual({ lineKind: 'service' });
    expect(salesLineKindPayload({ itemId: '', lineKind: '' }, true)).toEqual({});
  });

  it('treats every typed line as a service without inventory', () => {
    expect(salesLineKindPayload({ itemId: '', lineKind: '' }, false)).toEqual({ lineKind: 'service' });
    expect(firstUnclassifiedLine([{ itemId: '', lineKind: '' }], false)).toBe(-1);
  });

  it('finds the first line that is neither item nor service', () => {
    expect(
      firstUnclassifiedLine(
        [
          { itemId: 'item-1', lineKind: 'item' },
          { itemId: '', lineKind: 'service' },
          { itemId: '', lineKind: '' },
        ],
        true,
      ),
    ).toBe(2);
  });

  it('offers no "free text" choice — items, then service / charge', () => {
    const options = salesLineOptions([item]);
    expect(options.map(o => o.value)).toEqual(['item-1', SERVICE_LINE_VALUE]);
    expect(options[0].label).toContain('on hand 40');
    expect(options.some(o => o.value === '')).toBe(false);
  });

  it('reads stored lines without an item as services', () => {
    expect(kindOfStoredLine(null)).toBe('service');
    expect(kindOfStoredLine('item-1')).toBe('item');
    expect(salesLinePickerValue({ itemId: '', lineKind: 'service' })).toBe(SERVICE_LINE_VALUE);
  });

  it('flags a quantity beyond stock as a backorder', () => {
    expect(stockHint(item, '10')).toEqual({ text: 'On hand 40', short: false });
    expect(stockHint(item, '1500')).toEqual({ text: 'On hand 40 · backorder 1460', short: true });
  });

  it('reads the backorder shortfalls off a 409', () => {
    const err = {
      code: 'BACKORDER_CONFIRMATION_REQUIRED',
      details: { lines: [{ name: 'Roar-X', requested: '1500.0000', available: '40.0000', shortfall: '1460.0000' }] },
    };
    expect(backorderShortfalls(err)).toEqual([{ name: 'Roar-X', requested: 1500, available: 40, shortfall: 1460 }]);
    expect(backorderShortfalls({ code: 'OTHER' })).toBeNull();
  });
});

describe('credit limit refusal', () => {
  it('reads the breakdown and the advance required', () => {
    const a = creditAssessmentFrom({
      code: 'CREDIT_LIMIT_EXCEEDED',
      details: {
        customerId: 'c-1',
        customerName: 'Allama Iqbal',
        limit: '100000.0000',
        openInvoices: '0.0000',
        thisAmount: '107250.0000',
        exposure: '107250.0000',
        excess: '7250.0000',
        requiredAdvance: '7250.0000',
      },
    });
    expect(a).toMatchObject({ customerName: 'Allama Iqbal', limit: 100000, exposure: 107250, requiredAdvance: 7250 });
  });

  it('ignores other errors', () => {
    expect(creditAssessmentFrom({ code: 'INSUFFICIENT_STOCK', details: {} })).toBeNull();
    expect(creditAssessmentFrom(undefined)).toBeNull();
  });

  it('adds an override only when there is a reason', () => {
    expect(creditOverrideBody()).toEqual({});
    expect(creditOverrideBody('cheque received')).toEqual({ creditOverride: { reason: 'cheque received' } });
  });
});
