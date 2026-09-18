import type { SalesOrder, SalesOrderLine, SalesOrderStatus, DiscountType } from '../models/salesOrderModel';

const toNum = (v: any): number => {
  if (typeof v === 'number') return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

export const mapSalesOrderLine = (raw: any): SalesOrderLine => ({
  id: raw.id,
  // '' rather than null so it drops straight into CustomDropdown's `value`.
  itemId: raw.itemId ?? '',
  description: raw.description ?? '',
  quantity: toNum(raw.quantity),
  quantityFulfilled: toNum(raw.quantityFulfilled),
  unitPrice: toNum(raw.unitPrice),
  taxRate: toNum(raw.taxRate),
  lineTotal: toNum(raw.lineTotal),
  onHand: raw.stock ? toNum(raw.stock.onHand) : null,
  backorderQty: toNum(raw.backorderQty),
});

export const mapSalesOrder = (raw: any): SalesOrder => ({
  id: raw.id ?? '',
  orderNumber: raw.orderNumber ?? '',
  customerId: raw.customerId ?? '',
  customerName: raw.customerName ?? raw.customer?.name ?? '',
  orderDate: raw.orderDate ?? '',
  expectedDate: raw.expectedDate ?? null,
  status: (raw.status ?? 'open') as SalesOrderStatus,
  lines: Array.isArray(raw.lines) ? raw.lines.map(mapSalesOrderLine) : [],
  subtotal: toNum(raw.subtotal),
  discountType: (raw.discountType ?? 'none') as DiscountType,
  discountValue: toNum(raw.discountValue),
  discountAmount: toNum(raw.discountAmount),
  taxAmount: toNum(raw.taxAmount),
  total: toNum(raw.total),
  notes: raw.notes ?? '',
  invoiceId: raw.invoiceId ?? null,
});

export interface SerializedSalesOrderList { salesOrders: SalesOrder[]; }

export function salesOrderListSerializer(payload: any): SerializedSalesOrderList {
  const d = payload?.data ?? payload;
  const arr: any[] = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
  return { salesOrders: arr.map(mapSalesOrder) };
}

export function salesOrderSingleSerializer(payload: any): SalesOrder | null {
  const raw = payload?.data?.salesOrder ?? payload?.data ?? payload;
  if (!raw || Array.isArray(raw) || !raw.id) return null;
  return mapSalesOrder(raw);
}
