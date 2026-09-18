// ═══════════════════════════════════════════════════════
// FinMatrix — Purchase Order Serializer
// ═══════════════════════════════════════════════════════
// Sits BETWEEN network and slice.
// Takes the raw API envelope and returns a clean,
// UI-ready data structure with inline field mapping.
// Mirrors `billSerializer.ts` / `glSerializer.ts`.

import type { PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from '../types';
import type {
  PurchaseOrderApiEntity,
  PurchaseOrderApiLineEntity,
} from '../models/purchaseOrderModel';
import { fromApiPOStatus } from '../models/purchaseOrderModel';

// Every decimal on the wire is a TypeORM numeric, i.e. a STRING ('40.0000').
// The old mappers tested `typeof raw.x === 'number'` and so resolved every
// figure to 0 — which zeroed each PO's totals AND made `remaining` 0, which
// disabled the receive input. Mirrors billSerializer.ts.
const toNum = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

// ─── Serialized output for the list slice ────────────
export interface SerializedPOList {
  purchaseOrders: PurchaseOrder[];
  page: number;
  totalPages: number;
  totalPOs: number;
  counts: Record<'all' | PurchaseOrderStatus, number>;
  totalValue: number;
}

// ─── Raw → UI mappers ────────────────────────────────
const mapPOLine = (raw: Partial<PurchaseOrderApiLineEntity>): PurchaseOrderLine => ({
  id: raw.id ?? '',
  itemId: raw.itemId ?? '',
  // The API never returns an item name — screens resolve it from inventory
  // and fall back to the line description, which is what the vendor sees.
  itemName: '',
  description: raw.description ?? '',
  quantity: toNum(raw.orderedQty),
  unitPrice: toNum(raw.unitCost),
  taxRate: toNum(raw.taxRate),
  amount: toNum(raw.lineTotal),
  receivedQuantity: toNum(raw.receivedQty),
  billedQuantity: toNum(raw.billedQty),
});

export const mapPO = (raw: Partial<PurchaseOrderApiEntity>): PurchaseOrder => ({
  id: raw.id ?? '',
  companyId: raw.companyId ?? '',
  poNumber: raw.poNumber ?? '',
  vendorId: raw.vendorId ?? '',
  vendorName: raw.vendorName ?? '',
  orderDate: raw.orderDate ?? '',
  expectedDate: raw.expectedDate ?? '',
  status: fromApiPOStatus(raw.status),
  lines: Array.isArray(raw.lines) ? raw.lines.map(mapPOLine) : [],
  subtotal: toNum(raw.subtotal),
  taxAmount: toNum(raw.taxAmount),
  total: toNum(raw.total),
  notes: raw.notes ?? '',
  billId: raw.billId ?? '',
  billNumber: raw.billNumber ?? '',
  bills: Array.isArray(raw.bills)
    ? raw.bills.map(b => ({
        id: b.id ?? '',
        billNumber: b.billNumber ?? '',
        billDate: b.billDate ?? '',
        total: toNum(b.total),
        balance: toNum(b.balance),
        status: b.status ?? '',
      }))
    : [],
  receivedValueGross: toNum(raw.receivedValueGross),
  billedValueGross: toNum(raw.billedValueGross),
  unbilledValueGross: toNum(raw.unbilledValueGross),
  createdBy: '',
  createdAt: raw.createdAt ?? '',
  updatedAt: raw.updatedAt ?? '',
});

// ─── Envelope serializers ────────────────────────────
export function purchaseOrderListSerializer(payload: any): SerializedPOList {
  const data = payload?.data;
  const raw: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.purchaseOrders)
      ? data.purchaseOrders
      : [];
  const pagination = (data && !Array.isArray(data)) ? (data.pagination || {}) : {};
  const totals = (data && !Array.isArray(data)) ? (data.totals || {}) : {};

  const purchaseOrders = raw.map(mapPO);

  // Compute counts client-side if backend didn't provide them.
  const counts: Record<'all' | PurchaseOrderStatus, number> = totals.counts || {
    all: purchaseOrders.length,
    draft: purchaseOrders.filter(p => p.status === 'draft').length,
    sent: purchaseOrders.filter(p => p.status === 'sent').length,
    partially_received: purchaseOrders.filter(p => p.status === 'partially_received').length,
    fully_received: purchaseOrders.filter(p => p.status === 'fully_received').length,
    closed: purchaseOrders.filter(p => p.status === 'closed').length,
  };

  const totalValue =
    typeof totals.totalValue === 'number'
      ? totals.totalValue
      : purchaseOrders.reduce((s, p) => s + p.total, 0);

  return {
    purchaseOrders,
    page: pagination.page ?? 1,
    totalPages: pagination.totalPages ?? 1,
    totalPOs: pagination.total ?? purchaseOrders.length,
    counts,
    totalValue,
  };
}

export function purchaseOrderSingleSerializer(payload: any): PurchaseOrder | null {
  const raw = payload?.data?.purchaseOrder ?? payload?.data?.po ?? (payload?.data && !Array.isArray(payload.data) ? payload.data : null);
  if (!raw) return null;
  return mapPO(raw);
}
