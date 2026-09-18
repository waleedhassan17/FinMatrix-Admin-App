// ═══════════════════════════════════════════════════════
// FinMatrix — inventory detail: the purchase orders tab
// ═══════════════════════════════════════════════════════
// There is no per-item PO endpoint, so the tab fetches one page of
// /purchase-orders and filters on the line items here. That filtering, the
// staff pending-request matching, and the stale-response guard are all logic
// no static check can see and no manual tester can reliably reproduce — the
// race needs a slow connection and precise timing.
//
// The reducers are driven directly through the thunk's own action creators,
// so no thunk runs and no network is touched. The three network modules are
// still factory-mocked, purely to keep apiHelpers (axios → react-native
// Platform → AsyncStorage) out of the module graph when the slice is imported.

jest.mock('../../../../networks/purchases/purchaseOrderNetwork', () => ({
  getPurchaseOrdersAPI: jest.fn(),
}));
jest.mock('../../../../networks/approvals/approvalsNetwork', () => ({
  fetchApprovals: jest.fn(),
}));
jest.mock('../../../../networks/inventory/inventoryNetwork', () => ({
  getStockMovementsAPI: jest.fn(),
}));

import type { ApprovalRequest } from '../../../../models/approvalModel';
import {
  inventoryDetailSlice,
  fetchItemPurchaseOrders,
  fetchItemMovements,
  resetInventoryDetail,
  type InventoryDetailSliceState,
} from '../inventoryDetailSlice';

const reducer = inventoryDetailSlice.reducer;
const ITEM = 'item-A';
const OTHER = 'item-B';

// ── Fixtures ──────────────────────────────────────────
const line = (itemId: string, orderedQty = '5', receivedQty = '0') => ({
  id: `line-${itemId}-${orderedQty}`,
  itemId,
  description: 'Widget',
  orderedQty,
  unitCost: '10',
  lineTotal: '50',
  receivedQty,
});

const rawPO = (id: string, lines: ReturnType<typeof line>[]) => ({
  id,
  poNumber: `PO-${id}`,
  vendorId: 'v1',
  vendorName: 'Acme',
  orderDate: '2026-01-05',
  status: 'sent',
  lines,
});

/** The GET /purchase-orders envelope. `total` drives the truncation flag. */
const envelope = (pos: ReturnType<typeof rawPO>[], total?: number) => ({
  data: { purchaseOrders: pos, pagination: { total: total ?? pos.length } },
});

/** An approval request as the server stores it: `payload` is the original
 *  write body, replayed on approval, so it carries lines[].itemId. */
const request = (id: string, payload: unknown, status = 'pending') =>
  ({ id, type: 'po', status, summary: `Request ${id}`, payload } as unknown as ApprovalRequest);

const arg = { itemId: ITEM, includePending: true };

/** Run pending → fulfilled for one request id, from a given starting state. */
const loadPOs = (
  payload: { envelope: unknown; requests: ApprovalRequest[]; itemId: string },
  state?: InventoryDetailSliceState,
  requestId = 'req-1',
  thunkArg = arg,
) => {
  const started = reducer(state, fetchItemPurchaseOrders.pending(requestId, thunkArg));
  return reducer(
    started,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchItemPurchaseOrders.fulfilled(payload as any, requestId, thunkArg),
  );
};

describe('purchase orders are filtered to this item', () => {
  it('keeps only POs with a line for the item', () => {
    const state = loadPOs({
      envelope: envelope([
        rawPO('1', [line(ITEM)]),
        rawPO('2', [line(OTHER)]),
        rawPO('3', [line(ITEM)]),
      ]),
      requests: [],
      itemId: ITEM,
    });

    expect(state.purchaseOrders.map(p => p.id)).toEqual(['1', '3']);
    expect(state.poStatus).toBe('succeeded');
  });

  it('keeps a PO carrying the item among several other lines', () => {
    const state = loadPOs({
      envelope: envelope([rawPO('1', [line(OTHER), line(ITEM), line('item-C')])]),
      requests: [],
      itemId: ITEM,
    });

    expect(state.purchaseOrders).toHaveLength(1);
  });

  it('drops a PO with no lines at all without throwing', () => {
    const state = loadPOs({
      envelope: envelope([rawPO('1', []), rawPO('2', [line(ITEM)])]),
      requests: [],
      itemId: ITEM,
    });

    expect(state.purchaseOrders.map(p => p.id)).toEqual(['2']);
  });

  it('survives an empty and a malformed envelope', () => {
    expect(loadPOs({ envelope: envelope([]), requests: [], itemId: ITEM }).purchaseOrders)
      .toEqual([]);
    expect(loadPOs({ envelope: null, requests: [], itemId: ITEM }).purchaseOrders)
      .toEqual([]);
  });

  // Past one page the filter only sees what it was given, so "none" would be a
  // confident wrong answer to "is this already on order?".
  it('flags truncation when the server reports more POs than it returned', () => {
    const partial = loadPOs({
      envelope: envelope([rawPO('1', [line(ITEM)])], 250),
      requests: [],
      itemId: ITEM,
    });
    expect(partial.poTruncated).toBe(true);

    const complete = loadPOs({
      envelope: envelope([rawPO('1', [line(ITEM)])]),
      requests: [],
      itemId: ITEM,
    });
    expect(complete.poTruncated).toBe(false);
  });
});

describe("staff's own pending requests", () => {
  it('keeps only requests whose payload names this item', () => {
    const state = loadPOs({
      envelope: envelope([]),
      requests: [
        request('r1', { lines: [{ itemId: ITEM }] }),
        request('r2', { lines: [{ itemId: OTHER }] }),
      ],
      itemId: ITEM,
    });

    expect(state.pendingPORequests.map(r => r.id)).toEqual(['r1']);
  });

  it('shows a request once even when it has two lines for the same item', () => {
    const state = loadPOs({
      envelope: envelope([]),
      requests: [request('r1', { lines: [{ itemId: ITEM }, { itemId: ITEM }] })],
      itemId: ITEM,
    });

    expect(state.pendingPORequests).toHaveLength(1);
  });

  // `payload` is typed Record<string, unknown>; nothing may assume its shape.
  it('drops malformed payloads instead of throwing', () => {
    const state = loadPOs({
      envelope: envelope([]),
      requests: [
        request('r1', undefined),
        request('r2', null),
        request('r3', {}),
        request('r4', { lines: null }),
        request('r5', { lines: 'nope' }),
        request('r6', { lines: [null, undefined] }),
        request('r7', { lines: [{ itemId: ITEM }] }),
      ],
      itemId: ITEM,
    });

    expect(state.pendingPORequests.map(r => r.id)).toEqual(['r7']);
  });

  // 'approving' is a transient claim while the server posts the request — the
  // PO may already exist, so it is not "waiting for the owner" any more.
  it('excludes requests already being dispatched', () => {
    const state = loadPOs({
      envelope: envelope([]),
      requests: [
        request('r1', { lines: [{ itemId: ITEM }] }, 'approving'),
        request('r2', { lines: [{ itemId: ITEM }] }, 'pending'),
      ],
      itemId: ITEM,
    });

    expect(state.pendingPORequests.map(r => r.id)).toEqual(['r2']);
  });
});

describe('stale responses never overwrite fresher ones', () => {
  it('drops a response for an item the user has navigated away from', () => {
    // Item A is in flight, then item B starts and claims the slice.
    const aStarted = reducer(undefined, fetchItemPurchaseOrders.pending('req-A', arg));
    const bStarted = reducer(
      aStarted,
      fetchItemPurchaseOrders.pending('req-B', { itemId: OTHER, includePending: true }),
    );

    const late = reducer(
      bStarted,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchItemPurchaseOrders.fulfilled(
        { envelope: envelope([rawPO('1', [line(ITEM)])]), requests: [], itemId: ITEM } as any,
        'req-A',
        arg,
      ),
    );

    expect(late.purchaseOrders).toEqual([]);
    expect(late.poStatus).toBe('loading');
  });

  // The guard keys on requestId, not itemId, so it also covers two overlapping
  // fetches for the SAME item — focus then Retry, or a fast tab bounce. An
  // older snapshot resolving last would drop a PO just created.
  it('drops an older overlapping fetch for the same item', () => {
    const first = reducer(undefined, fetchItemPurchaseOrders.pending('req-1', arg));
    const second = reducer(first, fetchItemPurchaseOrders.pending('req-2', arg));

    const fresh = reducer(
      second,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchItemPurchaseOrders.fulfilled(
        {
          envelope: envelope([rawPO('new', [line(ITEM)]), rawPO('old', [line(ITEM)])]),
          requests: [],
          itemId: ITEM,
        } as any,
        'req-2',
        arg,
      ),
    );
    const afterStale = reducer(
      fresh,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchItemPurchaseOrders.fulfilled(
        { envelope: envelope([rawPO('old', [line(ITEM)])]), requests: [], itemId: ITEM } as any,
        'req-1',
        arg,
      ),
    );

    expect(afterStale.purchaseOrders.map(p => p.id)).toEqual(['new', 'old']);
  });

  it('ignores a stale rejection', () => {
    const first = reducer(undefined, fetchItemPurchaseOrders.pending('req-1', arg));
    const second = reducer(first, fetchItemPurchaseOrders.pending('req-2', arg));

    const state = reducer(
      second,
      fetchItemPurchaseOrders.rejected(new Error('offline'), 'req-1', arg),
    );

    expect(state.poStatus).toBe('loading');
    expect(state.poError).toBe('');
  });

  it('records the failure when the current request rejects', () => {
    const started = reducer(undefined, fetchItemPurchaseOrders.pending('req-1', arg));
    const state = reducer(
      started,
      fetchItemPurchaseOrders.rejected(new Error('offline'), 'req-1', arg),
    );

    expect(state.poStatus).toBe('failed');
    expect(state.poError).toBe('offline');
  });

  // The movements list shares the slice and had no guard at all.
  it('applies the same guard to stock movements', () => {
    const first = reducer(undefined, fetchItemMovements.pending('mv-1', ITEM));
    const second = reducer(first, fetchItemMovements.pending('mv-2', OTHER));

    const late = reducer(
      second,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchItemMovements.fulfilled({ data: [{ id: 'm1' }] } as any, 'mv-1', ITEM),
    );

    expect(late.movements).toEqual([]);
    expect(late.status).toBe('loading');
  });
});

describe('resetInventoryDetail', () => {
  it('clears everything the next item must not inherit', () => {
    const loaded = loadPOs({
      envelope: envelope([rawPO('1', [line(ITEM)])], 250),
      requests: [request('r1', { lines: [{ itemId: ITEM }] })],
      itemId: ITEM,
    });
    expect(loaded.purchaseOrders).toHaveLength(1);

    const state = reducer(loaded, resetInventoryDetail());

    expect(state.purchaseOrders).toEqual([]);
    expect(state.pendingPORequests).toEqual([]);
    expect(state.poStatus).toBe('idle');
    expect(state.poError).toBe('');
    expect(state.poRequestId).toBe('');
    expect(state.poTruncated).toBe(false);
    expect(state.movements).toEqual([]);
    expect(state.movementsRequestId).toBe('');
    expect(state.activeTab).toBe('stock');
  });

  it('makes an in-flight response from the previous item a no-op', () => {
    const started = reducer(undefined, fetchItemPurchaseOrders.pending('req-1', arg));
    const cleared = reducer(started, resetInventoryDetail());

    const late = reducer(
      cleared,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fetchItemPurchaseOrders.fulfilled(
        { envelope: envelope([rawPO('1', [line(ITEM)])]), requests: [], itemId: ITEM } as any,
        'req-1',
        arg,
      ),
    );

    expect(late.purchaseOrders).toEqual([]);
    expect(late.poStatus).toBe('idle');
  });
});
